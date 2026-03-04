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
  heroItems:      ItemInstance[];
  baseItems:      ItemInstance[];
  armoryGridSize: { cols: number; rows: number };
}

interface HeroResponse {
  hero:         Hero;
  homeCityName: string | null;
}

// ─── Context value ────────────────────────────────────────────────────────────

interface GameInventoryContextValue {
  /** The item currently "held" by the cursor (drag-to-place) */
  heldItem:             HeldItem | null;
  setHeldItem:          React.Dispatch<React.SetStateAction<HeldItem | null>>;
  /** All hero items (inventory + equipped); filter on .location as needed */
  heroItems:            ItemInstance[];
  fetchHeroItems:       () => Promise<void>;
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
  /** Re-read hero meta (e.g. after founding a city) */
  refreshHeroMeta:      () => Promise<void>;
}

const GameInventoryContext = createContext<GameInventoryContextValue>({
  heldItem:            null,
  setHeldItem:         () => {},
  heroItems:           [],
  fetchHeroItems:      async () => {},
  reportRefreshSignal: 0,
  notifyReportRefresh: () => {},
  heroHomeCityId:      null,
  heroHomeCityName:    null,
  heroMetaLoaded:      false,
  refreshHeroMeta:     async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GameInventoryProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();

  const [heldItem,            setHeldItem]            = useState<HeldItem | null>(null);
  const [heroItems,           setHeroItems]           = useState<ItemInstance[]>([]);
  const [reportRefreshSignal, setReportRefreshSignal] = useState(0);
  const [heroHomeCityId,      setHeroHomeCityId]      = useState<string | null>(null);
  const [heroHomeCityName,    setHeroHomeCityName]    = useState<string | null>(null);
  const [heroMetaLoaded,      setHeroMetaLoaded]      = useState(false);

  const fetchHeroItems = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<PlayerItemsResponse>('/items', { token: token ?? undefined });
      setHeroItems(res.heroItems);
    } catch { /* non-fatal */ }
  }, [token]);

  const refreshHeroMeta = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<HeroResponse>('/hero', { token: token ?? undefined });
      setHeroHomeCityId(res.hero.homeCityId ?? null);
      setHeroHomeCityName(res.homeCityName ?? null);
    } catch { /* non-fatal */ } finally {
      setHeroMetaLoaded(true);
    }
  }, [token]);

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
        reportRefreshSignal,
        notifyReportRefresh,
        heroHomeCityId,
        heroHomeCityName,
        heroMetaLoaded,
        refreshHeroMeta,
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
