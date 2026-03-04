'use client';

import React, { useState } from 'react';
import {
  ITEMS,
  ITEM_RARITY_COLOR,
  ITEM_RARITY_BG,
  ITEM_CATEGORY_ICON,
  HERO_EQUIP_SLOT_LABEL,
  HERO_EQUIP_SLOT_ICON,
  HERO_EQUIP_SLOTS,
  HERO_POCKET_SLOTS,
} from '@rpg/shared';
import type { HeroEquipSlot, ItemId, ItemInstance } from '@rpg/shared';
import { CELL_SIZE, HeldItem } from './types';
import { ItemTooltip } from './InventoryGrid';

interface EquipmentSlotsProps {
  equippedItems:      Partial<Record<HeroEquipSlot, ItemInstance>>;
  heldItem:           HeldItem | null;
  onEquip:            (item: ItemInstance, slot: HeroEquipSlot) => void;
  /** Pick up an equipped item to start dragging it */
  onPickupEquipped:   (item: ItemInstance) => void;
  /** Auto-unequip (find a free inventory slot automatically) */
  onUnequip:          (item: ItemInstance) => void;
  /** When true all interactions are blocked (hero is on adventure) */
  disabled?:          boolean;
}

const SLOT_SIZE_GEAR   = CELL_SIZE * 2;       // 84px — main armour/weapon slots
const SLOT_SIZE_POCKET = Math.round(CELL_SIZE * 1.05); // 44px — smaller pocket slots

export default function EquipmentSlots({
  equippedItems,
  heldItem,
  onEquip,
  onPickupEquipped,
  onUnequip,
  disabled = false,
}: EquipmentSlotsProps) {
  const [contextSlot,  setContextSlot]  = useState<HeroEquipSlot | null>(null);
  const [tooltipSlot,  setTooltipSlot]  = useState<HeroEquipSlot | null>(null);
  const [tooltipPos,   setTooltipPos]   = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  /** Render a single equip slot */
  function renderSlot(slot: HeroEquipSlot, slotSize: number) {
    const occupant  = equippedItems[slot];
    const def       = occupant ? ITEMS[occupant.itemDefId as ItemId] : undefined;
    const rarityCol = def ? ITEM_RARITY_COLOR[def.rarity] : undefined;
    const rarityBg  = def ? ITEM_RARITY_BG[def.rarity]   : undefined;
    const heldDef   = heldItem ? ITEMS[heldItem.instance.itemDefId as ItemId] : undefined;
    const canAccept = !disabled && !!(heldItem && heldDef?.heroEquipSlots?.includes(slot));
    const showMenu  = !disabled && contextSlot === slot && !!occupant;
    const isPocket  = slotSize === SLOT_SIZE_POCKET;

    return (
      <div key={slot} className="relative">
        <div
          style={{
            width:      slotSize,
            height:     slotSize,
            border:     canAccept
              ? '2px solid #22c55e'
              : `1px solid ${rarityCol ?? 'rgba(255,255,255,0.06)'}`,
            background: rarityBg ?? '#0d0f12',
            cursor:     disabled
              ? 'not-allowed'
              : occupant ? 'grab' : canAccept ? 'crosshair' : 'default',
            transition: 'border-color 0.1s',
            opacity:    disabled ? 0.55 : 1,
          }}
          className="rounded-md flex flex-col items-center justify-center relative overflow-hidden select-none hover:brightness-110 transition-all"
          onMouseEnter={(e) => {
            if (occupant) {
              setTooltipSlot(slot);
              setTooltipPos({ x: e.clientX, y: e.clientY });
            }
          }}
          onMouseMove={(e) => {
            if (occupant) setTooltipPos({ x: e.clientX, y: e.clientY });
          }}
          onMouseLeave={() => setTooltipSlot(null)}
          onClick={() => {
            if (disabled) return;
            if (contextSlot) { setContextSlot(null); return; }
            if (occupant) {
              onPickupEquipped(occupant);
            } else if (heldItem && heldDef?.heroEquipSlots?.includes(slot)) {
              onEquip(heldItem.instance, slot);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled && occupant) setContextSlot(slot);
          }}
        >
          {occupant && def ? (
            <>
              <span
                className="leading-none"
                style={{ fontSize: isPocket ? 16 : 24 }}
              >
                {ITEM_CATEGORY_ICON[def.category]}
              </span>
              {!isPocket && (
                <span
                  className="text-[9px] mt-1 font-semibold text-center leading-tight px-1 truncate w-full"
                  style={{ color: rarityCol }}
                >
                  {def.name}
                </span>
              )}
            </>
          ) : (
            <>
              <span
                className="leading-none opacity-20"
                style={{ fontSize: isPocket ? 14 : 20 }}
              >
                {HERO_EQUIP_SLOT_ICON[slot]}
              </span>
              {!isPocket && (
                <span className="text-[9px] mt-1 text-gray-700 font-medium">
                  {HERO_EQUIP_SLOT_LABEL[slot]}
                </span>
              )}
            </>
          )}

          {/* Green pulse when held item can drop here */}
          {canAccept && !occupant && (
            <div className="absolute inset-0 bg-green-500/10 animate-pulse pointer-events-none" />
          )}
        </div>

        {/* Right-click context menu */}
        {showMenu && occupant && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextSlot(null)} />
            <div className="absolute left-full ml-1 top-0 z-50 bg-gray-900 border border-gray-700 rounded-lg py-1 shadow-2xl min-w-[140px]">
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition"
                onClick={(e) => {
                  e.stopPropagation();
                  setContextSlot(null);
                  onUnequip(occupant);
                }}
              >
                📦 Auto-unequip
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Resolve hovered item for the floating tooltip
  const hoveredItem = tooltipSlot ? equippedItems[tooltipSlot] ?? null : null;

  return (
    <>
      <div className="space-y-3">

        {/* ── Main gear slots ───────────────────────────────────────────────── */}
        <div>
          <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-2 font-semibold">
            Equipment {disabled && <span className="text-amber-700">— locked on adventure</span>}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {HERO_EQUIP_SLOTS.map((s) => renderSlot(s, SLOT_SIZE_GEAR))}
          </div>
        </div>

        {/* ── Pocket slots ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-2 font-semibold">
            Pockets
          </p>
          <div className="flex gap-1.5">
            {HERO_POCKET_SLOTS.map((s) => renderSlot(s, SLOT_SIZE_POCKET))}
          </div>
        </div>

      </div>

      {/* ── Floating tooltip — rendered outside the spaced container so it
           never affects sibling layout, even though it's position:fixed ── */}
      {hoveredItem && (
        <div
          className="pointer-events-none"
          style={{
            position: 'fixed',
            left:     tooltipPos.x + 14,
            top:      tooltipPos.y + 4,
            zIndex:   9999,
          }}
        >
          <ItemTooltip item={hoveredItem} />
        </div>
      )}
    </>
  );
}
