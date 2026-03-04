'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ITEMS } from '@rpg/shared';
import type { ItemId, ItemInstance } from '@rpg/shared';
import { useGameInventory } from '@/context/inventory';
import InventoryGrid from './InventoryGrid';
import ItemInspectModal from './ItemInspectModal';
import HeldItemHUD from './HeldItemHUD';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ArmoryPanelProps {
  /** 0-based index among armory buildings (matches buildingSlotIndex on items) */
  armoryIndex:    number;
  armoryGridSize: { cols: number; rows: number };
  /** Items in this specific armory (pre-filtered by armoryIndex) */
  armoryItems:    ItemInstance[];
  token:          string | null;
  /** Called after any mutation so the parent can refresh base + item data */
  onRefresh:      () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ArmoryPanel({
  armoryIndex,
  armoryGridSize,
  armoryItems,
  token,
  onRefresh,
}: ArmoryPanelProps) {
  const { heldItem, setHeldItem, fetchHeroItems } = useGameInventory();

  const [inspectItem, setInspectItem] = useState<ItemInstance | null>(null);
  const [moveError,   setMoveError]   = useState<string | null>(null);
  /** Optimistic grid-position overrides while API call is in flight */
  const [itemPatch, setItemPatch] = useState<Record<string, Partial<ItemInstance>> | null>(null);

  const displayArmoryItems = useMemo(() => {
    if (!itemPatch) return armoryItems;
    return armoryItems.map((i) => {
      const patch = itemPatch[i.id];
      return patch ? { ...i, ...patch } : i;
    });
  }, [armoryItems, itemPatch]);

  // ── Keyboard: R = rotate held, Esc = cancel (mirrors hero page) ──────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && heldItem) {
        const def = ITEMS[heldItem.instance.itemDefId as ItemId];
        if (def && def.width === def.height) return; // square — no rotation
        if (!def?.rotatable) return;
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
  }, [heldItem, setHeldItem]);

  // ── Pick up from armory ───────────────────────────────────────────────────

  const handlePickUp = useCallback((item: ItemInstance) => {
    const def = ITEMS[item.itemDefId as ItemId];
    if (!def) return;
    const w = item.rotated ? def.height : def.width;
    const h = item.rotated ? def.width  : def.height;
    setHeldItem({
      instance:        item,
      effectiveWidth:  w,
      effectiveHeight: h,
      rotated:         item.rotated,
      source:          'base_armory',
    });
  }, [setHeldItem]);

  // ── Drop inside armory ────────────────────────────────────────────────────

  const handleDrop = useCallback(async (gridX: number, gridY: number) => {
    if (!heldItem) return;
    const { instance, rotated } = heldItem;
    setHeldItem(null);
    setItemPatch({ [instance.id]: { gridX, gridY, rotated, location: 'base_armory' } });
    try {
      await apiFetch('/items/move', {
        method: 'POST',
        token:  token ?? undefined,
        body:   JSON.stringify({
          itemId:         instance.id,
          targetLocation: 'base_armory',
          gridX,
          gridY,
          rotated,
          armoryIndex,
        }),
      });
      onRefresh();
    } catch {
      setHeldItem(heldItem); // restore on error
    } finally {
      setItemPatch(null);
    }
  }, [heldItem, token, onRefresh, setHeldItem, armoryIndex]);

  // ── Move to hero ──────────────────────────────────────────────────────────

  const handleMoveToHero = useCallback(async (item: ItemInstance) => {
    setMoveError(null);
    try {
      await apiFetch('/items/move-to-hero', {
        method: 'POST',
        token:  token ?? undefined,
        body:   JSON.stringify({ itemId: item.id }),
      });
      // Refresh both the armory view and the hero inventory context
      await fetchHeroItems();
      onRefresh();
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : 'Could not move item');
      // Auto-dismiss error after 3 s
      setTimeout(() => setMoveError(null), 3000);
    }
  }, [token, onRefresh, fetchHeroItems]);

  // ── Discard ───────────────────────────────────────────────────────────────

  const handleDiscard = useCallback(async (item: ItemInstance) => {
    try {
      await apiFetch(`/items/${item.id}`, {
        method: 'DELETE',
        token:  token ?? undefined,
      });
      await fetchHeroItems();
      onRefresh();
    } catch { /* ignore */ }
  }, [token, onRefresh, fetchHeroItems]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalCells = armoryGridSize.cols * armoryGridSize.rows;
  const usedCells  = useMemo(
    () => armoryItems.reduce((acc, i) => {
      const d = ITEMS[i.itemDefId as ItemId];
      return acc + (d ? d.width * d.height : 1);
    }, 0),
    [armoryItems],
  );

  if (armoryGridSize.cols === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-5">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2 font-semibold">
          Armory
        </p>
        <p className="text-gray-600 text-sm">
          Build an <span className="text-gray-400">Armory</span> to store items here.
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-gray-800 rounded-xl p-5 space-y-3"
      onClick={() => { if (heldItem) setHeldItem(null); }}
      style={{ cursor: heldItem ? 'crosshair' : 'default' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">
            {armoryIndex === 0 ? 'Armory' : `Armory ${armoryIndex + 1}`}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {armoryGridSize.cols}×{armoryGridSize.rows} grid · {usedCells}/{totalCells} cells
          </p>
        </div>
        {armoryItems.length === 0 && (
          <p className="text-gray-600 text-xs italic">No items stored</p>
        )}
      </div>

      {/* Error toast */}
      {moveError && (
        <p className="text-red-400 text-xs bg-red-900/20 border border-red-700/30 rounded px-3 py-1.5">
          {moveError}
        </p>
      )}

      {/* Grid */}
      <div
        className="flex"
        onClick={(e) => e.stopPropagation()}
      >
        <InventoryGrid
          cols={armoryGridSize.cols}
          rows={armoryGridSize.rows}
          items={displayArmoryItems}
          heldItem={heldItem}
          onPickUp={handlePickUp}
          onDrop={handleDrop}
          onInspect={(item) => setInspectItem(item)}
          onMoveToHero={handleMoveToHero}
          onDiscard={handleDiscard}
          label=""
          accent="rgba(255,180,0,0.12)"
        />
      </div>

      <HeldItemHUD heldItem={heldItem} />

      {/* Inspect modal */}
      {inspectItem && (
        <ItemInspectModal
          item={inspectItem}
          onClose={() => setInspectItem(null)}
          onDiscard={(item) => { handleDiscard(item); setInspectItem(null); }}
        />
      )}
    </div>
  );
}
