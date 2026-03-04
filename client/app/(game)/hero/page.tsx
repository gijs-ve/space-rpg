'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { getSocket } from '@/lib/socket';
import ProgressBar from '@/components/ui/ProgressBar';
import CountdownTimer from '@/components/ui/CountdownTimer';
import AdventurePanel from '@/components/hero/AdventurePanel';
import SkillsPanel from '@/components/hero/SkillsPanel';
import InventoryGrid from '@/components/inventory/InventoryGrid';
import EquipmentSlots from '@/components/inventory/EquipmentSlots';
import ItemInspectModal from '@/components/inventory/ItemInspectModal';
import MoveToBaseModal from '@/components/inventory/MoveToBaseModal';
import HeldItemHUD from '@/components/inventory/HeldItemHUD';
import { useSetHeroHeader } from '@/context/header';
import { useGameInventory } from '@/context/inventory';
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
} from '@rpg/shared';


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HeroPage() {
  const { token } = useAuth();

  // ── Hero data ──────────────────────────────────────────────────────────────
  const [data,  setData]  = useState<HeroResponse | null>(null);
  const [error, setError] = useState('');

  // ── Shared inventory context ────────────────────────────────────────────────
  const {
    heldItem, setHeldItem, heroItems, fetchHeroItems, notifyReportRefresh,
    heroHomeCityId, heroHomeCityName, baseItems, armoryGridSizes,
  } = useGameInventory();

  const [inspectItem,     setInspectItem]     = useState<ItemInstance | null>(null);
  const [moveToBaseItem,  setMoveToBaseItem]  = useState<ItemInstance | null>(null);
  /** Optimistic grid-position overrides while an API call is in flight */
  const [itemPatch, setItemPatch] = useState<Record<string, Partial<ItemInstance>> | null>(null);

  // ── Fetchers ───────────────────────────────────────────────────────────────

  const fetchHero = useCallback(async () => {
    try {
      const res = await apiFetch<HeroResponse>('/hero', { token: token ?? undefined });
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load hero');
    }
  }, [token]);

  // ── Initial load + socket ──────────────────────────────────────────────────

  useEffect(() => {
    fetchHero();
  }, [fetchHero]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('adventure:complete', fetchHero);
    return () => { socket.off('adventure:complete', fetchHero); };
  }, [fetchHero]);

  // ── Keyboard: R = rotate held (Escape is handled globally in context) ──────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && heldItem) {
        const def = ITEMS[heldItem.instance.itemDefId as ItemId];
        // Square items cannot be rotated
        if (def && def.width === def.height) return;
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

  /** Apply any in-flight optimistic position overrides */
  const displayInventoryItems = useMemo(() => {
    if (!itemPatch) return inventoryItems;
    return inventoryItems.map((i) => {
      const patch = itemPatch[i.id];
      return patch ? { ...i, ...patch } : i;
    });
  }, [inventoryItems, itemPatch]);

  // ── Pick up from equipment slot (start dragging) ──────────────────────────

  const pickUpFromEquipped = useCallback((item: ItemInstance) => {
    const def = ITEMS[item.itemDefId as ItemId];
    if (!def) return;
    setHeldItem({
      instance:        item,
      effectiveWidth:  def.width,
      effectiveHeight: def.height,
      rotated:         false,
      source:          'hero_equipped',
    });
  }, []);

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

  // ── Drop: place held item into hero inventory grid ─────────────────────────

  const handleDrop = useCallback(async (gridX: number, gridY: number) => {
    if (!heldItem) return;
    const { instance, rotated, source, reportId } = heldItem;
    setHeldItem(null);
    // Optimistic: instantly show item at new position while waiting for server
    setItemPatch({ [instance.id]: { gridX, gridY, rotated, location: 'hero_inventory' } });
    try {
      if (source === 'activity_report' && reportId) {
        await apiFetch(`/activity-reports/${reportId}/claim`, {
          method: 'POST',
          token:  token ?? undefined,
          body:   JSON.stringify({ itemId: instance.id, gridX, gridY, rotated }),
        });
        notifyReportRefresh();
      } else if (source === 'hero_equipped') {
        // Dragging from equipment slot to a specific inventory cell
        await apiFetch('/items/unequip', {
          method: 'POST',
          token:  token ?? undefined,
          body:   JSON.stringify({ itemId: instance.id, gridX, gridY }),
        });
      } else {
        await apiFetch('/items/move', {
          method: 'POST',
          token:  token ?? undefined,
          body:   JSON.stringify({ itemId: instance.id, targetLocation: 'hero_inventory', gridX, gridY, rotated }),
        });
      }
      await fetchHeroItems();
    } catch {
      setHeldItem(heldItem);
    } finally {
      setItemPatch(null);
    }
  }, [heldItem, token, fetchHeroItems, notifyReportRefresh]);

  // ── Equip (held → slot click) ──────────────────────────────────────────────

  const handleEquip = useCallback(async (item: ItemInstance, slot: HeroEquipSlot) => {
    setHeldItem(null);
    setInspectItem(null);
    try {
      await apiFetch('/items/equip', {
        method: 'POST',
        token:  token ?? undefined,
        body:   JSON.stringify({ itemId: item.id, equipSlot: slot }),
      });
      await fetchHeroItems();
    } catch { /* ignore */ }
  }, [token, fetchHeroItems]);

  // ── Unequip (click occupied slot) ─────────────────────────────────────────

  const handleUnequip = useCallback(async (item: ItemInstance) => {
    try {
      await apiFetch('/items/unequip', {
        method: 'POST',
        token:  token ?? undefined,
        body:   JSON.stringify({ itemId: item.id }),
      });
      await fetchHeroItems();
    } catch { /* ignore */ }
  }, [token, fetchHeroItems]);

  // ── Discard ────────────────────────────────────────────────────────────────

  const handleDiscard = useCallback(async (item: ItemInstance) => {
    try {
      await apiFetch(`/items/${item.id}`, {
        method: 'DELETE',
        token:  token ?? undefined,
      });
      await fetchHeroItems();
    } catch { /* ignore */ }
  }, [token, fetchHeroItems]);
  // ── Move to base ──────────────────────────────────────────────────────

  const handleMoveToBase = useCallback(async (item: ItemInstance) => {
    // Show the base storage picker modal
    setMoveToBaseItem(item);
  }, []);

  const confirmMoveToBase = useCallback(async (armoryIndex: number) => {
    if (!moveToBaseItem) return;
    await apiFetch('/items/move-to-base', {
      method: 'POST',
      token:  token ?? undefined,
      body:   JSON.stringify({ itemId: moveToBaseItem.id, armoryIndex }),
    });
    await fetchHeroItems();
  }, [moveToBaseItem, token, fetchHeroItems]);
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

          {/* Home base */}
          {heroHomeCityId && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Home Base</p>
              <Link
                href={`/base/${heroHomeCityId}`}
                className="text-teal-400 hover:text-teal-300 font-medium text-sm transition"
              >
                🏠 {heroHomeCityName ?? 'Starbase'}
              </Link>
            </div>
          )}
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
            onPickupEquipped={pickUpFromEquipped}
            onUnequip={handleUnequip}
          />

          <InventoryGrid
            cols={HERO_INVENTORY_COLS}
            rows={HERO_INVENTORY_ROWS}
            items={displayInventoryItems}
            heldItem={heldItem}
            onPickUp={pickUpFromInventory}
            onDrop={handleDrop}
            onInspect={(item) => setInspectItem(item)}
            onDiscard={handleDiscard}
            onMoveToBase={heroHomeCityId ? handleMoveToBase : undefined}
            label="Inventory"
            accent="rgba(255,255,255,0.06)"
          />

          <HeldItemHUD heldItem={heldItem} />
        </div>

        {/* ── Col 3: adventure panel ──────────────────────────────────────── */}
        <AdventurePanel
          hero={hero}
          activeJob={activeAdventure ?? null}
          onStarted={fetchHero}
          onComplete={fetchHero}
        />
      </div>

      {/* ── Skills row ───────────────────────────────────────────────────── */}
      <SkillsPanel hero={hero} />


      {/* ── Item inspect modal (right-click → Examine) ───────────────────────── */}
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

      {/* ── Move to base modal (right-click → Move to base) ────────────────── */}
      {moveToBaseItem && (
        <MoveToBaseModal
          item={moveToBaseItem}
          baseName={heroHomeCityName ?? 'Home Base'}
          armoryGridSizes={armoryGridSizes}
          baseArmoryItems={baseItems.filter((i) => i.location === 'base_armory')}
          onClose={() => setMoveToBaseItem(null)}
          onConfirm={confirmMoveToBase}
        />
      )}
    </div>
  );
}
