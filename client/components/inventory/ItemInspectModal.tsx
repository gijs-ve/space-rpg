'use client';

import React from 'react';
import {
  ITEMS,
  ITEM_RARITY_COLOR,
  ITEM_RARITY_BG,
  ITEM_CATEGORY_ICON,
  HERO_EQUIP_SLOT_LABEL,
  HERO_EQUIP_SLOT_ICON,
} from '@rpg/shared';
import type { ItemId, ItemDef, ItemInstance, HeroEquipSlot } from '@rpg/shared';

interface ItemInspectModalProps {
  item:       ItemInstance;
  onClose:    () => void;
  onDiscard:  (item: ItemInstance) => void;
  /** Only present when item can be equipped to a hero slot */
  onEquip?:   (item: ItemInstance, slot: HeroEquipSlot) => void;
}

export default function ItemInspectModal({ item, onClose, onDiscard, onEquip }: ItemInspectModalProps) {
  const def: ItemDef | undefined = ITEMS[item.itemDefId as ItemId];
  if (!def) return null;

  const rarityCol = ITEM_RARITY_COLOR[def.rarity];
  const rarityBg  = ITEM_RARITY_BG[def.rarity];

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div
        className="relative w-72 rounded-lg border border-gray-700 bg-gray-900 shadow-2xl p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
        style={{ borderTopColor: rarityCol }}
      >
        {/* Close */}
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-white text-xs"
          onClick={onClose}
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex items-start gap-3">
          {/* Icon block */}
          <div
            className="flex items-center justify-center rounded-md text-2xl"
            style={{
              width:      52,
              height:     52,
              background: rarityBg,
              border:     `1px solid ${rarityCol}`,
              flexShrink: 0,
            }}
          >
            {ITEM_CATEGORY_ICON[def.category]}
          </div>

          <div>
            <p className="font-bold text-white leading-tight">{def.name}</p>
            <p
              className="text-xs capitalize font-semibold mt-0.5"
              style={{ color: rarityCol }}
            >
              {def.rarity}
            </p>
            <p className="text-gray-500 text-xs capitalize">{def.category}</p>
          </div>
        </div>

        {/* Dimensions */}
        <p className="text-gray-600 text-xs">
          Size: {def.width} × {def.height}{' '}
          {item.rotated ? <span className="text-amber-500">(rotated)</span> : null}
        </p>

        {/* Description */}
        {def.description && (
          <p className="text-gray-400 text-xs leading-relaxed">{def.description}</p>
        )}

        {/* Bonuses */}
        {(() => {
          const bonusEntries = Object.entries(def.bonuses).filter(([, v]) => v !== undefined && v !== 0);
          if (bonusEntries.length === 0) return null;
          return (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold">Bonuses</p>
              {bonusEntries.map(([key, val]) => (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-gray-400 capitalize">{key.replace(/Bonus$/, '').replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="text-green-400 font-medium">+{val}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Equip slots */}
        {def.heroEquipSlots.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>{HERO_EQUIP_SLOT_ICON[def.heroEquipSlots[0]]}</span>
            <span>Equips to {def.heroEquipSlots.map((s) => HERO_EQUIP_SLOT_LABEL[s]).join(' / ')}</span>
            {onEquip && (
              <button
                className="ml-auto px-2 py-0.5 rounded text-[11px] text-white hover:brightness-110 active:scale-95 transition"
                style={{ background: rarityBg, border: `1px solid ${rarityCol}` }}
                onClick={() => onEquip(item, def.heroEquipSlots[0])}
              >
                Equip
              </button>
            )}
          </div>
        )}

        {/* Actions row */}
        <div className="flex gap-2 pt-1 border-t border-gray-800">
          <button
            className="flex-1 text-xs py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition active:scale-95"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="flex-1 text-xs py-1.5 rounded bg-red-900/40 hover:bg-red-900/70 text-red-400 border border-red-900 transition active:scale-95"
            onClick={() => {
              onDiscard(item);
              onClose();
            }}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
