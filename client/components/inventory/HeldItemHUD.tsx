'use client';

import React, { useEffect, useState } from 'react';
import { ITEMS, ITEM_RARITY_COLOR, ITEM_RARITY_BG, ITEM_CATEGORY_ICON } from '@rpg/shared';
import type { ItemId } from '@rpg/shared';
import type { HeldItem } from './types';

interface HeldItemHUDProps {
  heldItem: HeldItem | null;
}

export default function HeldItemHUD({ heldItem }: HeldItemHUDProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  if (!heldItem) return null;

  const def        = ITEMS[heldItem.instance.itemDefId as ItemId];
  const isSquare   = def && def.width === def.height;
  const rarityCol  = def ? ITEM_RARITY_COLOR[def.rarity] : '#9ca3af';
  const rarityBg   = def ? ITEM_RARITY_BG[def.rarity]   : 'transparent';
  const bonuses    = def ? Object.entries(def.bonuses).filter(([, v]) => v !== undefined && v !== 0) : [];

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
        {bonuses.length > 0 && (
          <div className="flex gap-3 flex-wrap py-0.5">
            {bonuses.map(([k, v]) => (
              <span key={k} className="text-[10px] text-green-400">
                +{v} {k.replace(/Bonus$/, '').replace(/([A-Z])/g, ' $1').trim()}
              </span>
            ))}
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
