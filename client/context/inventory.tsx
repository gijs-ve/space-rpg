'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import type { Hero, ItemInstance } from '@rpg/shared';
import type { HeldItem } from '@/components/inventory/types';

// ─── Internal response shapes ─────────────────────────────────────────────────

interface PlayerItemsResponse {
  heroItems:       ItemInstance[];
  baseItems:       ItemInstance[];
  armoryGridSizes: { armoryIndex: number; cols: number; rows: number }[];
}

interface HeroEntry {
  hero:            Hero;
  activeAdventure: unknown;
  homeCityName:    string | null;
}

interface MultiHeroResponse {
  heroes:              HeroEntry[];
  totalLevel:          number;
  nextHeroUnlockLevel: number;
}

// ─── Context value ────────────────────────────────────────────────────────────

interface GameInventoryContextValue {
  /** The item currently "held" by the cursor (drag-to-place) */
  heldItem:             HeldItem | null;
  setHeldItem:          React.Dispatch<React.SetStateAction<HeldItem | null>>;
  /** All hero items (inventory + equipped); filter on .location as needed */
  heroItems:            ItemInstance[];
  fetchHeroItems:       () => Promise<void>;
  /** All base items (base_armory location etc.) */
  baseItems:            ItemInstance[];
  /** One entry per armory building; empty = no armory built yet */
  armoryGridSizes:      { armoryIndex: number; cols: number; rows: number }[];
  /**
   * Bumped whenever a report item is manually dragged into the inventory.
   * ReportsPanel watches this to re-fetch its own report list.
   */
  reportRefreshSignal:  number;
  notifyReportRefresh:  () => void;
  /** ID of the hero's home city (null until the player founds their city) */
  heroHomeCityId:       string | null;
  /** Name of the hero's home base (null until the player founds their city) */
  heroHomeCityName:     string | null;
  /** True once the first hero fetch has completed */
  heroMetaLoaded:       boolean;
  /** True if the player has at least one hero */
  hasHero:              boolean;
  /** Re-read hero meta (e.g. after founding a city) */
  refreshHeroMeta:      () => Promise<void>;
  /** IDs of heroes currently on an active adventure */
  heroesOnAdventure:    string[];
}

const GameInventoryContext = createContext<GameInventoryContextValue>({
  heldItem:            null,
  setHeldItem:         () => {},
  heroItems:           [],
  fetchHeroItems:      async () => {},
  baseItems:           [],
  armoryGridSizes:     [],
  reportRefreshSignal: 0,
  notifyReportRefresh: () => {},
  heroHomeCityId:      null,
  heroHomeCityName:    null,
  heroMetaLoaded:      false,
  hasHero:             false,
  refreshHeroMeta:     async () => {},
  heroesOnAdventure:   [],
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GameInventoryProvider({ children }: { children: React.ReactNode }) {
  const { token, logout } = useAuth();

  const [heldItem,            setHeldItem]            = useState<HeldItem | null>(null);
  const [heroItems,           setHeroItems]           = useState<ItemInstance[]>([]);
  const [baseItems,           setBaseItems]           = useState<ItemInstance[]>([]);
  const [armoryGridSizes,     setArmoryGridSizes]     = useState<{ armoryIndex: number; cols: number; rows: number }[]>([]);
  const [reportRefreshSignal, setReportRefreshSignal] = useState(0);
  const [heroHomeCityId,      setHeroHomeCityId]      = useState<string | null>(null);
  const [heroHomeCityName,    setHeroHomeCityName]    = useState<string | null>(null);
  const [heroMetaLoaded,      setHeroMetaLoaded]      = useState(false);
  const [hasHero,             setHasHero]             = useState(false);
  const [heroesOnAdventure,   setHeroesOnAdventure]   = useState<string[]>([]);

  const fetchHeroItems = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<PlayerItemsResponse>('/items', { token: token ?? undefined });
      setHeroItems(res.heroItems);
      setBaseItems(res.baseItems);
      setArmoryGridSizes(res.armoryGridSizes);
    } catch { /* non-fatal */ }
  }, [token]);

  const refreshHeroMeta = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<MultiHeroResponse>('/hero', { token: token ?? undefined });
      setHasHero(res.heroes.length > 0);
      // Pick the first hero that has a home city
      const withCity = res.heroes.find((e) => e.hero.homeCityId);
      setHeroHomeCityId(withCity?.hero.homeCityId ?? null);
      setHeroHomeCityName(withCity?.homeCityName ?? null);
      setHeroMetaLoaded(true);
      // Track which heroes are currently on an active adventure
      setHeroesOnAdventure(res.heroes.filter((e) => !!e.activeAdventure).map((e) => e.hero.id));
    } catch (err: any) {
      // Stale / invalid token — force logout so the user is sent to /login
      if (err?.status === 401) {
        logout();
        return;
      }
      // For other errors (network etc.) mark loaded anyway so the UI unblocks
      setHeroMetaLoaded(true);
    }
  }, [token, logout]);

  const notifyReportRefresh = useCallback(() => {
    setReportRefreshSignal((s) => s + 1);
  }, []);

  // Load on auth change
  useEffect(() => { fetchHeroItems(); }, [fetchHeroItems]);
  useEffect(() => { refreshHeroMeta(); }, [refreshHeroMeta]);

  // Global Escape cancels any held item
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeldItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <GameInventoryContext.Provider
      value={{
        heldItem,
        setHeldItem,
        heroItems,
        fetchHeroItems,
        baseItems,
        armoryGridSizes,
        reportRefreshSignal,
        notifyReportRefresh,
        heroHomeCityId,
        heroHomeCityName,
        heroMetaLoaded,
        hasHero,
        refreshHeroMeta,
        heroesOnAdventure,
      }}
    >
      {children}
    </GameInventoryContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGameInventory() {
  return useContext(GameInventoryContext);
}
