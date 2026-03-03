'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { getSocket } from '@/lib/socket';
import ProgressBar from '@/components/ui/ProgressBar';
import CountdownTimer from '@/components/ui/CountdownTimer';
import AdventurePanel from '@/components/hero/AdventurePanel';
import SkillsPanel from '@/components/hero/SkillsPanel';
import InventoryGrid from '@/components/inventory/InventoryGrid';
import EquipmentSlots from '@/components/inventory/EquipmentSlots';
import ActivityReports from '@/components/inventory/ActivityReports';
import ItemInspectModal from '@/components/inventory/ItemInspectModal';
import { useSetHeroHeader } from '@/context/header';
import {
  xpRequiredForLevel,
  BASE_MAX_ENERGY,
  ENERGY_REGEN_INTERVAL_SECONDS,
  ITEMS,
  HERO_INVENTORY_COLS,
  HERO_INVENTORY_ROWS,
} from '@rpg/shared';
import type {
  HeroResponse,
  HeroEquipSlot,
  ItemId,
  ItemInstance,
  ActivityReport,
} from '@rpg/shared';
import { HeldItem } from '@/components/inventory/types';

// ─── Types for server responses ───────────────────────────────────────────────

interface PlayerItemsResponse {
  heroItems:      ItemInstance[];
  baseItems:      ItemInstance[];
  armoryGridSize: { cols: number; rows: number };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HeroPage() {
  const { token } = useAuth();

  // ── Hero data ──────────────────────────────────────────────────────────────
  const [data,  setData]  = useState<HeroResponse | null>(null);
  const [error, setError] = useState('');

  // ── Inventory state ────────────────────────────────────────────────────────
  const [heroItems, setHeroItems]     = useState<ItemInstance[]>([]);
  const [reports,   setReports]       = useState<ActivityReport[]>([]);
  const [heldItem,  setHeldItem]      = useState<HeldItem | null>(null);
  const [inspectItem, setInspectItem] = useState<ItemInstance | null>(null);

  // ── Fetchers ───────────────────────────────────────────────────────────────

  const fetchHero = useCallback(async () => {
    try {
      const res = await apiFetch<HeroResponse>('/hero', { token: token ?? undefined });
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load hero');
    }
  }, [token]);

  const fetchItems = useCallback(async () => {
    try {
      const res = await apiFetch<PlayerItemsResponse>('/items', { token: token ?? undefined });
      setHeroItems(res.heroItems);
    } catch { /* non-fatal */ }
  }, [token]);

  const fetchReports = useCallback(async () => {
    try {
      const res = await apiFetch<ActivityReport[]>('/activity-reports', { token: token ?? undefined });
      setReports(res);
    } catch { /* non-fatal */ }
  }, [token]);

  // ── Initial load + socket ──────────────────────────────────────────────────

  useEffect(() => {
    fetchHero();
    fetchItems();
    fetchReports();
  }, [fetchHero, fetchItems, fetchReports]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onComplete = () => { fetchHero(); fetchReports(); };
    socket.on('adventure:complete', onComplete);
    return () => { socket.off('adventure:complete', onComplete); };
  }, [fetchHero, fetchReports]);

  // ── Keyboard: R = rotate held, Escape = cancel ────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setHeldItem(null); return; }
      if ((e.key === 'r' || e.key === 'R') && heldItem) {
        setHeldItem({
          ...heldItem,
          rotated:         !heldItem.rotated,
          effectiveWidth:  heldItem.effectiveHeight,
          effectiveHeight: heldItem.effectiveWidth,
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [heldItem]);

  // ── Derived inventory slices ───────────────────────────────────────────────

  const equippedItems = useMemo(() => {
    const map: Partial<Record<HeroEquipSlot, ItemInstance>> = {};
    heroItems
      .filter((i) => i.location === 'hero_equipped' && i.equipSlot)
      .forEach((i) => { map[i.equipSlot!] = i; });
    return map;
  }, [heroItems]);

  const inventoryItems = useMemo(
    () => heroItems.filter((i) => i.location === 'hero_inventory'),
    [heroItems],
  );

  // ── Held-item helpers ──────────────────────────────────────────────────────

  const pickUpFromInventory = useCallback((item: ItemInstance) => {
    const def = ITEMS[item.itemDefId as ItemId];
    if (!def) return;
    const w = item.rotated ? def.height : def.width;
    const h = item.rotated ? def.width  : def.height;
    setHeldItem({
      instance:        item,
      effectiveWidth:  w,
      effectiveHeight: h,
      rotated:         item.rotated,
      source:          'hero_inventory',
    });
  }, []);

  const pickUpFromReport = useCallback((item: ItemInstance, reportId: string) => {
    const def = ITEMS[item.itemDefId as ItemId];
    if (!def) return;
    setHeldItem({
      instance:        item,
      effectiveWidth:  def.width,
      effectiveHeight: def.height,
      rotated:         false,
      source:          'activity_report',
      reportId,
    });
  }, []);

  // ── Drop: place held item into hero inventory grid ─────────────────────────

  const handleDrop = useCallback(async (gridX: number, gridY: number) => {
    if (!heldItem) return;
    const { instance, rotated, source, reportId } = heldItem;
    setHeldItem(null);

    try {
      if (source === 'activity_report' && reportId) {
        await apiFetch(`/activity-reports/${reportId}/claim`, {
          method: 'POST',
          token:  token ?? undefined,
          body:   JSON.stringify({ itemId: instance.id, gridX, gridY, rotated }),
        });
        await Promise.all([fetchItems(), fetchReports()]);
      } else {
        await apiFetch('/items/move', {
          method: 'POST',
          token:  token ?? undefined,
          body:   JSON.stringify({ itemId: instance.id, targetLocation: 'hero_inventory', gridX, gridY, rotated }),
        });
        await fetchItems();
      }
    } catch (err: any) {
      // Restore the item if placement failed
      setHeldItem(heldItem);
    }
  }, [heldItem, token, fetchItems, fetchReports]);

  // ── Equip (held → slot click) ──────────────────────────────────────────────

  const handleEquip = useCallback(async (item: ItemInstance, slot: HeroEquipSlot) => {
    setHeldItem(null);
    try {
      await apiFetch('/items/equip', {
        method: 'POST',
        token:  token ?? undefined,
        body:   JSON.stringify({ itemId: item.id, slot }),
      });
      await fetchItems();
    } catch { /* ignore */ }
  }, [token, fetchItems]);

  // ── Unequip (click occupied slot) ─────────────────────────────────────────

  const handleUnequip = useCallback(async (item: ItemInstance) => {
    try {
      await apiFetch('/items/unequip', {
        method: 'POST',
        token:  token ?? undefined,
        body:   JSON.stringify({ itemId: item.id }),
      });
      await fetchItems();
    } catch { /* ignore */ }
  }, [token, fetchItems]);

  // ── Discard ────────────────────────────────────────────────────────────────

  const handleDiscard = useCallback(async (item: ItemInstance) => {
    try {
      await apiFetch(`/items/${item.id}`, {
        method: 'DELETE',
        token:  token ?? undefined,
      });
      await fetchItems();
    } catch { /* ignore */ }
  }, [token, fetchItems]);

  // ── Dismiss report ─────────────────────────────────────────────────────────

  const handleDismiss = useCallback(async (reportId: string) => {
    try {
      await apiFetch(`/activity-reports/${reportId}/dismiss`, {
        method: 'POST',
        token:  token ?? undefined,
        body:   JSON.stringify({}),
      });
      await fetchReports();
    } catch { /* ignore */ }
  }, [token, fetchReports]);

  // ── Header ─────────────────────────────────────────────────────────────────

  const hero = data?.hero ?? null;
  const level = hero?.level ?? 1;
  const xpForCurrentLevel = hero ? xpRequiredForLevel(level)     : 0;
  const xpForNextLevel    = hero ? xpRequiredForLevel(level + 1) : 100;
  useSetHeroHeader(hero ? { hero, xpForCurrentLevel, xpForNextLevel } : null);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data || !hero) return <p className="text-gray-400 animate-pulse">Loading hero…</p>;

  const { activeAdventure } = data;
  const maxEnergy = BASE_MAX_ENERGY;
  const isFull    = hero.energy >= maxEnergy;
  const nextRegen = new Date(
    new Date(hero.lastEnergyRegen).getTime() + ENERGY_REGEN_INTERVAL_SECONDS * 1000,
  );

  return (
    <div
      className="w-full space-y-4"
      /* Clicking outside any interactive element cancels hold */
      onClick={() => { if (heldItem) setHeldItem(null); }}
      style={{ cursor: heldItem ? 'crosshair' : 'default' }}
    >
      {/* ── Top row: stats | inventory | adventure ───────────────────────── */}
      <div className="grid grid-cols-[260px_auto_1fr] gap-4 items-start">

        {/* ── Col 1: hero stats card ──────────────────────────────────────── */}
        <div className="bg-gray-800 rounded-xl p-5 space-y-5">
          {/* Avatar + rank */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-700 border-2 border-amber-700/50 flex items-center justify-center text-3xl select-none shrink-0">
              🚀
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Commander</p>
              <p className="text-amber-400 font-bold text-xl leading-tight">Level {level}</p>
            </div>
          </div>

          {/* XP */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span className="uppercase tracking-wider text-[10px]">Experience</span>
              <span className="tabular-nums">
                {hero.xp - xpForCurrentLevel} / {xpForNextLevel - xpForCurrentLevel}
              </span>
            </div>
            <ProgressBar
              value={hero.xp - xpForCurrentLevel}
              max={xpForNextLevel - xpForCurrentLevel}
              colorClass="bg-amber-500"
            />
          </div>

          {/* Energy */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-blue-300 font-medium uppercase tracking-wider text-[10px]">
                ⚡ Energy
              </span>
              <span className="text-gray-400 tabular-nums">{hero.energy} / {maxEnergy}</span>
            </div>
            <ProgressBar value={hero.energy} max={maxEnergy} colorClass="bg-blue-500" />
            {!isFull && (
              <p className="text-[10px] text-gray-600 mt-1.5">
                Next +1 in <CountdownTimer endsAt={nextRegen} onComplete={fetchHero} />
              </p>
            )}
          </div>
        </div>

        {/* ── Col 2: equipment slots + hero inventory ─────────────────────── */}
        <div
          className="flex flex-col gap-3 bg-gray-800 rounded-xl p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <EquipmentSlots
            equippedItems={equippedItems}
            heldItem={heldItem}
            onEquip={handleEquip}
            onUnequip={handleUnequip}
          />

          <InventoryGrid
            cols={HERO_INVENTORY_COLS}
            rows={HERO_INVENTORY_ROWS}
            items={inventoryItems}
            heldItem={heldItem}
            onPickUp={pickUpFromInventory}
            onDrop={handleDrop}
            label="Inventory"
            accent="rgba(255,255,255,0.06)"
          />

          {heldItem && (
            <p className="text-[9px] text-gray-600 text-center">
              [R] rotate · [Esc] cancel
            </p>
          )}
        </div>

        {/* ── Col 3: adventure panel ──────────────────────────────────────── */}
        <AdventurePanel
          hero={hero}
          activeJob={activeAdventure ?? null}
          onStarted={fetchHero}
          onComplete={() => { fetchHero(); fetchReports(); }}
        />
      </div>

      {/* ── Skills row ───────────────────────────────────────────────────── */}
      <SkillsPanel hero={hero} />

      {/* ── Activity reports ─────────────────────────────────────────────── */}
      {reports.length > 0 && (
        <div
          className="bg-gray-800 rounded-xl p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <ActivityReports
            reports={reports}
            heldItem={heldItem}
            onPickUpFromReport={pickUpFromReport}
            onDismiss={handleDismiss}
          />
        </div>
      )}

      {/* ── Item inspect modal (right-click) ─────────────────────────────── */}
      {inspectItem && (
        <ItemInspectModal
          item={inspectItem}
          onClose={() => setInspectItem(null)}
          onDiscard={handleDiscard}
          onEquip={
            (ITEMS[inspectItem.itemDefId as ItemId]?.heroEquipSlots?.length ?? 0) > 0
              ? (item, slot) => { handleEquip(item, slot); setInspectItem(null); }
              : undefined
          }
        />
      )}
    </div>
  );
}
