'use client';

import React, { useEffect, useState } from 'react';
import {
  ITEMS,
  ITEM_RARITY_COLOR,
  ITEM_RARITY_BG,
  ITEM_CATEGORY_ICON,
  HERO_BONUS_KEYS,
  BASE_BONUS_KEYS,
  formatBonus,
} from '@rpg/shared';
import type { ItemId, ItemBonus } from '@rpg/shared';
import type { HeldItem } from './types';

interface HeldItemHUDProps {
  heldItem: HeldItem | null;
}

const ACTIVE_COL   = '#4ade80'; // green-400
const INACTIVE_COL = '#374151'; // gray-700
const LABEL_COL    = '#6b7280'; // gray-500 labels when inactive

export default function HeldItemHUD({ heldItem }: HeldItemHUDProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  if (!heldItem) return null;

  const def       = ITEMS[heldItem.instance.itemDefId as ItemId];
  const isSquare  = def && def.width === def.height;
  const rarityCol = def ? ITEM_RARITY_COLOR[def.rarity] : '#9ca3af';
  const rarityBg  = def ? ITEM_RARITY_BG[def.rarity]   : 'transparent';

  // Determine which context is "active" for the item right now.
  const src         = heldItem.source;
  const heroActive  = src === 'hero_inventory' || src === 'hero_equipped';
  const baseActive  = src === 'base_armory';

  // Partition non-zero bonuses into hero / base groups.
  const bonusEntries = def
    ? (Object.entries(def.bonuses) as [keyof ItemBonus, number][]).filter(([, v]) => v !== undefined && v !== 0)
    : [];
  const heroBonuses = bonusEntries.filter(([k]) => (HERO_BONUS_KEYS as string[]).includes(k));
  const baseBonuses = bonusEntries.filter(([k]) => (BASE_BONUS_KEYS  as string[]).includes(k));

  return (
    <div
      className="bg-gray-900/95 border border-gray-700 rounded-xl px-4 py-3 shadow-2xl flex gap-3 items-start"
      style={{
        position:       'fixed',
        left:           pos.x + 20,
        top:            pos.y + 20,
        zIndex:         9999,
        pointerEvents:  'none',
        borderTopColor: rarityCol,
      }}
    >
      <div
        className="flex items-center justify-center rounded-md text-xl shrink-0"
        style={{ width: 44, height: 44, background: rarityBg, border: `1px solid ${rarityCol}` }}
      >
        {def ? ITEM_CATEGORY_ICON[def.category] : '?'}
      </div>
      <div className="space-y-0.5">
        <p className="font-bold text-sm leading-tight" style={{ color: rarityCol }}>
          {def?.name ?? 'Item'}
        </p>
        <p className="text-gray-500 text-[10px] capitalize">
          {def?.rarity} · {def?.category}
        </p>

        {/* Hero bonuses */}
        {heroBonuses.length > 0 && (
          <div className="pt-0.5">
            <span
              className="text-[9px] uppercase tracking-wider font-bold"
              style={{ color: heroActive ? ACTIVE_COL : INACTIVE_COL }}
            >
              Hero
            </span>
            <div className="flex gap-2 flex-wrap">
              {heroBonuses.map(([k, v]) => (
                <span
                  key={k}
                  className="text-[10px]"
                  style={{ color: heroActive ? ACTIVE_COL : LABEL_COL }}
                >
                  {formatBonus(k, v)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Base bonuses */}
        {baseBonuses.length > 0 && (
          <div className="pt-0.5">
            <span
              className="text-[9px] uppercase tracking-wider font-bold"
              style={{ color: baseActive ? ACTIVE_COL : INACTIVE_COL }}
            >
              Base
            </span>
            <div className="flex gap-2 flex-wrap">
              {baseBonuses.map(([k, v]) => (
                <span
                  key={k}
                  className="text-[10px]"
                  style={{ color: baseActive ? ACTIVE_COL : LABEL_COL }}
                >
                  {formatBonus(k, v)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 text-[10px] text-gray-600 pt-1 border-t border-gray-800 mt-1">
          {!isSquare && def?.rotatable && <span>[R] Rotate</span>}
          <span>[Esc] Cancel</span>
        </div>
      </div>
    </div>
  );
}
