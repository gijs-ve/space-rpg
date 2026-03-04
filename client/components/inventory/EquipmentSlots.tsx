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
} from '@rpg/shared';
import type { HeroEquipSlot, ItemId, ItemInstance } from '@rpg/shared';
import { CELL_SIZE, HeldItem } from './types';

interface EquipmentSlotsProps {
  equippedItems:      Partial<Record<HeroEquipSlot, ItemInstance>>;
  heldItem:           HeldItem | null;
  onEquip:            (item: ItemInstance, slot: HeroEquipSlot) => void;
  /** Pick up an equipped item to start dragging it */
  onPickupEquipped:   (item: ItemInstance) => void;
  /** Auto-unequip (find a free inventory slot automatically) */
  onUnequip:          (item: ItemInstance) => void;
}

export default function EquipmentSlots({
  equippedItems,
  heldItem,
  onEquip,
  onPickupEquipped,
  onUnequip,
}: EquipmentSlotsProps) {
  const SLOT_SIZE = CELL_SIZE * 2;
  const [contextSlot, setContextSlot] = useState<HeroEquipSlot | null>(null);

  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-2 font-semibold">
        Equipment
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        {HERO_EQUIP_SLOTS.map((slot) => {
          const occupant  = equippedItems[slot];
          const def       = occupant ? ITEMS[occupant.itemDefId as ItemId] : undefined;
          const rarityCol = def ? ITEM_RARITY_COLOR[def.rarity] : undefined;
          const rarityBg  = def ? ITEM_RARITY_BG[def.rarity]   : undefined;
          const heldDef   = heldItem ? ITEMS[heldItem.instance.itemDefId as ItemId] : undefined;
          const canAccept = !!(heldItem && heldDef?.heroEquipSlots?.includes(slot));
          const showMenu  = contextSlot === slot && !!occupant;

          return (
            <div
              key={slot}
              className="relative"
            >
              <div
                style={{
                  width:      SLOT_SIZE,
                  height:     SLOT_SIZE,
                  border:     canAccept
                    ? '2px solid #22c55e'
                    : `1px solid ${rarityCol ?? 'rgba(255,255,255,0.06)'}`,
                  background: rarityBg ?? '#0d0f12',
                  cursor:     occupant ? 'grab' : canAccept ? 'crosshair' : 'default',
                  transition: 'border-color 0.1s',
                }}
                className="rounded-md flex flex-col items-center justify-center relative overflow-hidden select-none hover:brightness-110 transition-all"
                title={occupant ? `${def?.name} — drag to move, right-click to unequip` : HERO_EQUIP_SLOT_LABEL[slot]}
                onClick={() => {
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
                  if (occupant) setContextSlot(slot);
                }}
              >
                {occupant && def ? (
                  <>
                    <span className="text-2xl leading-none">{ITEM_CATEGORY_ICON[def.category]}</span>
                    <span
                      className="text-[9px] mt-1 font-semibold text-center leading-tight px-1 truncate w-full"
                      style={{ color: rarityCol }}
                    >
                      {def.name}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xl leading-none opacity-20">
                      {HERO_EQUIP_SLOT_ICON[slot]}
                    </span>
                    <span className="text-[9px] mt-1 text-gray-700 font-medium">
                      {HERO_EQUIP_SLOT_LABEL[slot]}
                    </span>
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
                  {/* Invisible backdrop to close menu */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setContextSlot(null)}
                  />
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
        })}
      </div>
    </div>
  );
}
