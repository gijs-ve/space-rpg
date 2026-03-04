'use client';

import React, { useEffect, useState } from 'react';
import { ITEMS, ITEM_RARITY_COLOR, ITEM_CATEGORY_ICON, formatBonus } from '@rpg/shared';
import type { ItemDef, ItemBonus, ItemId } from '@rpg/shared';

// ─── Item Def Tooltip ─────────────────────────────────────────────────────────
// Wraps any children with a hover tooltip showing full item details.
// `placement="above"` (default) positions the tooltip above — good for cards.
// `placement="below"` positions below — good for table rows inside overflow-x:auto.

export function ItemDefTooltip({
  def,
  children,
  className,
  placement = 'above',
}: {
  def: ItemDef;
  children: React.ReactNode;
  className?: string;
  placement?: 'above' | 'below';
}) {
  const color = ITEM_RARITY_COLOR[def.rarity];
  const bonusEntries = (
    Object.entries(def.bonuses) as [keyof ItemBonus, number | undefined][]
  ).filter(([, v]) => v !== undefined && v !== 0) as [keyof ItemBonus, number][];

  const tooltipPos =
    placement === 'above'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      : 'top-full left-1/2 -translate-x-1/2 mt-2';

  return (
    <div className={`relative group/itooltip ${className ?? ''}`}>
      {children}
      <div
        className={[
          'pointer-events-none absolute z-50 w-56',
          tooltipPos,
          'bg-gray-950 border border-gray-700 rounded-xl p-3 shadow-2xl',
          'opacity-0 group-hover/itooltip:opacity-100 transition-opacity duration-150',
          'text-left',
        ].join(' ')}
      >
        {/* Name */}
        <div className="font-bold text-xs mb-0.5" style={{ color }}>
          {def.name}
        </div>
        {/* Category + Rarity */}
        <div className="text-[10px] text-gray-400 mb-2">
          {ITEM_CATEGORY_ICON[def.category]}{' '}
          <span className="capitalize">{def.category}</span>
          {' · '}
          <span className="capitalize" style={{ color }}>
            {def.rarity}
          </span>
        </div>
        {/* Description */}
        <p className="text-[10px] text-gray-500 leading-relaxed mb-2">{def.description}</p>
        {/* Bonuses */}
        {bonusEntries.length > 0 && (
          <div className="border-t border-gray-800 pt-2 space-y-0.5">
            {bonusEntries.map(([key, val]) => (
              <div key={key} className="text-[10px] text-green-400">
                {formatBonus(key, val)}
              </div>
            ))}
          </div>
        )}
        {/* Grid size */}
        <div className="text-[10px] text-gray-600 mt-1.5">
          Grid: {def.width}×{def.height}
          {def.rotatable ? ' · rotatable' : ''}
        </div>
      </div>
    </div>
  );
}

// ─── Item Catalog Modal ───────────────────────────────────────────────────────
// Displays all item definitions (except market_voucher) sorted by rarity then
// alphabetically. Used by the Black Market "Buy Item" tab.

const CATALOG_RARITY_RANK: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  legendary: 3,
};

const ALL_CATALOG_ITEMS = Object.values(ITEMS)
  .filter((d) => d.id !== 'market_voucher')
  .sort((a, b) => {
    const ra = CATALOG_RARITY_RANK[a.rarity] ?? 99;
    const rb = CATALOG_RARITY_RANK[b.rarity] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

export function ItemCatalogModal({
  selected,
  onSelect,
  onClose,
}: {
  selected: ItemId | '';
  onSelect: (id: ItemId) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = query.trim()
    ? ALL_CATALOG_ITEMS.filter(
        (d) =>
          d.name.toLowerCase().includes(query.toLowerCase()) ||
          d.category.toLowerCase().includes(query.toLowerCase()) ||
          d.rarity.toLowerCase().includes(query.toLowerCase()),
      )
    : ALL_CATALOG_ITEMS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700/80 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold text-gray-200">Select Item Type</h3>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-400 text-lg leading-none transition"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-800 shrink-0">
          <input
            type="text"
            autoFocus
            placeholder="Search by name, category or rarity…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-600"
          />
        </div>

        {/* Grid */}
        <div className="p-4 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2">
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-xs text-gray-600 py-8">No items match.</p>
          )}
          {filtered.map((def) => {
            const color = ITEM_RARITY_COLOR[def.rarity];
            const isSelected = selected === def.id;
            const bonusEntries = (
              Object.entries(def.bonuses) as [keyof ItemBonus, number | undefined][]
            ).filter(([, v]) => v !== undefined && v !== 0) as [keyof ItemBonus, number][];

            return (
              <button
                key={def.id}
                onClick={() => onSelect(def.id as ItemId)}
                className={[
                  'flex flex-col gap-1 p-3 rounded-xl border text-left transition',
                  isSelected
                    ? 'border-amber-500 bg-amber-900/20 ring-1 ring-amber-600/40'
                    : 'border-gray-800 bg-gray-800/60 hover:border-amber-600/50 hover:bg-amber-900/10',
                ].join(' ')}
              >
                <div className="text-xl">{ITEM_CATEGORY_ICON[def.category]}</div>
                <div className="font-semibold text-xs leading-tight" style={{ color }}>
                  {def.name}
                </div>
                <div className="text-[10px] text-gray-500 capitalize">
                  {def.rarity} · {def.category}
                </div>
                <p className="text-[10px] text-gray-600 leading-snug line-clamp-2 mt-0.5">
                  {def.description}
                </p>
                {bonusEntries.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {bonusEntries.map(([key, val]) => (
                      <div key={key} className="text-[10px] text-green-500">
                        {formatBonus(key, val)}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
