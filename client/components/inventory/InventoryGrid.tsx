'use client';

import React, { useState, useCallback } from 'react';
import {
  ITEMS,
  ITEM_RARITY_COLOR,
  ITEM_RARITY_BG,
  ITEM_CATEGORY_ICON,
  HERO_BONUS_KEYS,
  BASE_BONUS_KEYS,
  formatBonus,
} from '@rpg/shared';
import type { ItemId, ItemInstance, ItemBonus } from '@rpg/shared';
import { CELL_SIZE, HeldItem } from './types';

// ─── Hover tooltip ────────────────────────────────────────────────────────────

const ACTIVE_COL   = '#4ade80'; // green-400
const INACTIVE_COL = '#374151'; // gray-700 — label when inactive
const INACTIVE_VAL = '#6b7280'; // gray-500 — value when inactive

export function ItemTooltip({ item }: { item: ItemInstance }) {
  const def = ITEMS[item.itemDefId as ItemId];
  if (!def) return null;

  const rarityCol = ITEM_RARITY_COLOR[def.rarity];

  const heroActive = item.location === 'hero_equipped';
  const baseActive = item.location === 'base_armory'    || item.location === 'base_building_equip';

  const allBonusEntries = (Object.entries(def.bonuses) as [keyof ItemBonus, number][])
    .filter(([, v]) => v !== undefined && v !== 0);
  const heroBonuses = allBonusEntries.filter(([k]) => (HERO_BONUS_KEYS as string[]).includes(k));
  const baseBonuses = allBonusEntries.filter(([k]) => (BASE_BONUS_KEYS  as string[]).includes(k));
  const hasBonuses  = heroBonuses.length > 0 || baseBonuses.length > 0;

  return (
    <div
      className="w-52 bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-1.5 shadow-2xl pointer-events-none"
      style={{ borderTopColor: rarityCol }}
    >
      <p className="font-semibold text-sm leading-tight" style={{ color: rarityCol }}>{def.name}</p>
      <p className="text-gray-500 text-[10px] capitalize">{def.rarity} · {def.category}</p>
      {def.description && (
        <p className="text-gray-400 text-[10px] leading-relaxed">{def.description}</p>
      )}

      {hasBonuses && (
        <div className="border-t border-gray-800 pt-1.5 space-y-2">
          {/* Hero bonuses */}
          {heroBonuses.length > 0 && (
            <div className="space-y-0.5">
              <p
                className="text-[9px] uppercase tracking-widest font-bold"
                style={{ color: heroActive ? ACTIVE_COL : INACTIVE_COL }}
              >
                Hero
              </p>
              {heroBonuses.map(([k, v]) => (
                <div key={k} className="flex justify-between text-[10px] gap-3">
                  <span
                    className="capitalize"
                    style={{ color: heroActive ? '#d1fae5' : INACTIVE_VAL }}
                  >
                    {k.replace(/Bonus$/, '').replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span
                    className="font-medium shrink-0"
                    style={{ color: heroActive ? ACTIVE_COL : INACTIVE_COL }}
                  >
                    {formatBonus(k, v)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Base bonuses */}
          {baseBonuses.length > 0 && (
            <div className="space-y-0.5">
              <p
                className="text-[9px] uppercase tracking-widest font-bold"
                style={{ color: baseActive ? ACTIVE_COL : INACTIVE_COL }}
              >
                Base
              </p>
              {baseBonuses.map(([k, v]) => (
                <div key={k} className="flex justify-between text-[10px] gap-3">
                  <span
                    className="capitalize"
                    style={{ color: baseActive ? '#d1fae5' : INACTIVE_VAL }}
                  >
                    {k.replace(/Bonus$/, '').replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span
                    className="font-medium shrink-0"
                    style={{ color: baseActive ? ACTIVE_COL : INACTIVE_COL }}
                  >
                    {formatBonus(k, v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-gray-600 text-[9px] pt-0.5">Right-click for options</p>
    </div>
  );
}

// ─── Client-side placement validator ─────────────────────────────────────────

export function canPlaceClient(
  cols: number,
  rows: number,
  items: ItemInstance[],
  newItem: { id?: string; width: number; height: number; gridX: number; gridY: number },
): boolean {
  if (
    newItem.gridX < 0 ||
    newItem.gridY < 0 ||
    newItem.gridX + newItem.width  > cols ||
    newItem.gridY + newItem.height > rows
  ) return false;

  for (const ex of items) {
    if (ex.id === newItem.id) continue;
    if (ex.gridX === null || ex.gridY === null) continue;
    const def = ITEMS[ex.itemDefId as ItemId];
    if (!def) continue;
    const ew = ex.rotated ? def.height : def.width;
    const eh = ex.rotated ? def.width  : def.height;
    if (
      !(newItem.gridX + newItem.width  <= ex.gridX ||
        ex.gridX + ew <= newItem.gridX ||
        newItem.gridY + newItem.height <= ex.gridY ||
        ex.gridY + eh <= newItem.gridY)
    ) return false;
  }
  return true;
}

/** Find the first grid position where `item` fits (tries unrotated, then rotated). */
export function findFirstFreeSlotClient(
  cols: number,
  rows: number,
  items: ItemInstance[],
  item: { itemDefId: string; id?: string },
): { gridX: number; gridY: number; rotated: boolean } | null {
  const def = ITEMS[item.itemDefId as ItemId];
  if (!def) return null;
  for (const rotated of [false, true]) {
    if (rotated && !def.rotatable) continue;
    const w = rotated ? def.height : def.width;
    const h = rotated ? def.width  : def.height;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (canPlaceClient(cols, rows, items, { id: item.id, width: w, height: h, gridX: x, gridY: y })) {
          return { gridX: x, gridY: y, rotated };
        }
      }
    }
  }
  return null;
}

// ─── Item tile ────────────────────────────────────────────────────────────────

function ItemTile({
  item,
  heldItem,
  onPickUp,
  onDrop,
  hoverCell,
  gridCols,
  gridRows,
  gridItems,
  onRightClick,
  onHoverEnter,
  onHoverLeave,
}: {
  item:          ItemInstance;
  heldItem:      HeldItem | null;
  onPickUp:      (item: ItemInstance) => void;
  onDrop:        (gridX: number, gridY: number) => void;
  hoverCell:     { col: number; row: number } | null;
  gridCols:      number;
  gridRows:      number;
  gridItems:     ItemInstance[];
  onRightClick?: (item: ItemInstance, x: number, y: number) => void;
  onHoverEnter:  (item: ItemInstance) => void;
  onHoverLeave:  () => void;
}) {
  if (item.gridX === null || item.gridY === null) return null;
  const def = ITEMS[item.itemDefId as ItemId];
  if (!def) return null;

  const isHeld    = heldItem?.instance.id === item.id;
  const w         = item.rotated ? def.height : def.width;
  const h         = item.rotated ? def.width  : def.height;
  const px        = item.gridX * CELL_SIZE;
  const py        = item.gridY * CELL_SIZE;
  const rarityBg  = ITEM_RARITY_BG[def.rarity];
  const rarityCol = ITEM_RARITY_COLOR[def.rarity];

  if (isHeld) return null; // ghost follows cursor instead

  return (
    <div
      style={{
        position:  'absolute',
        left:      px,
        top:       py,
        width:     w * CELL_SIZE - 2,
        height:    h * CELL_SIZE - 2,
        background: rarityBg,
        border:    `1px solid ${rarityCol}`,
        zIndex:    10,
      }}
      className="rounded-sm overflow-hidden cursor-pointer hover:brightness-110 active:scale-95 transition-all select-none"
      onMouseEnter={() => onHoverEnter(item)}
      onMouseLeave={onHoverLeave}
      onClick={(e) => {
        e.stopPropagation();
        if (heldItem) {
          onDrop(item.gridX!, item.gridY!);
        } else {
          onPickUp(item);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRightClick?.(item, e.clientX, e.clientY);
      }}
    >
      {/* Item content */}
      <div className="flex flex-col items-center justify-center w-full h-full p-0.5">
        {h >= 2 ? (
          <>
            <span className="text-base leading-none" style={{ fontSize: Math.min(CELL_SIZE * 0.55, 22) }}>
              {ITEM_CATEGORY_ICON[def.category]}
            </span>
            {w * CELL_SIZE >= 60 && h * CELL_SIZE >= 60 && (
              <span
                className="text-center leading-tight font-medium"
                style={{
                  fontSize: 9,
                  color: rarityCol,
                  overflow: 'hidden',
                  maxWidth: '100%',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {def.name}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs leading-none" style={{ fontSize: Math.min(CELL_SIZE * 0.5, 18) }}>
            {ITEM_CATEGORY_ICON[def.category]}
          </span>
        )}
      </div>

      {/* Rarity dot */}
      <div
        className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full"
        style={{ background: rarityCol }}
      />
    </div>
  );
}

// ─── Ghost overlay ────────────────────────────────────────────────────────────

function GhostOverlay({
  heldItem,
  hoverCell,
  gridCols,
  gridRows,
  gridItems,
}: {
  heldItem:  HeldItem;
  hoverCell: { col: number; row: number } | null;
  gridCols:  number;
  gridRows:  number;
  gridItems: ItemInstance[];
}) {
  if (!hoverCell) return null;

  const valid = canPlaceClient(gridCols, gridRows, gridItems, {
    id:     heldItem.instance.id,
    width:  heldItem.effectiveWidth,
    height: heldItem.effectiveHeight,
    gridX:  hoverCell.col,
    gridY:  hoverCell.row,
  });

  const w   = heldItem.effectiveWidth;
  const h   = heldItem.effectiveHeight;
  const def = ITEMS[heldItem.instance.itemDefId as ItemId];
  const rarityBg  = def ? ITEM_RARITY_BG[def.rarity]    : 'transparent';
  const rarityCol = def ? ITEM_RARITY_COLOR[def.rarity] : '#666';

  const commonStyle: React.CSSProperties = {
    position:      'absolute',
    left:          hoverCell.col * CELL_SIZE,
    top:           hoverCell.row * CELL_SIZE,
    width:         w * CELL_SIZE - 2,
    height:        h * CELL_SIZE - 2,
    borderRadius:  2,
    pointerEvents: 'none',
  };

  return (
    <>
      {/* Faded item preview */}
      <div style={{ ...commonStyle, background: rarityBg, border: `1px solid ${rarityCol}`, opacity: 0.45, zIndex: 19 }}>
        <div className="flex flex-col items-center justify-center w-full h-full p-0.5">
          {h >= 2 ? (
            <>
              <span style={{ fontSize: Math.min(CELL_SIZE * 0.55, 22) }}>
                {def ? ITEM_CATEGORY_ICON[def.category] : '?'}
              </span>
              {w * CELL_SIZE >= 60 && h * CELL_SIZE >= 60 && def && (
                <span className="text-center leading-tight font-medium" style={{ fontSize: 9, color: rarityCol, overflow: 'hidden', maxWidth: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {def.name}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: Math.min(CELL_SIZE * 0.5, 18) }}>
              {def ? ITEM_CATEGORY_ICON[def.category] : '?'}
            </span>
          )}
        </div>
      </div>
      {/* Valid / invalid border */}
      <div
        style={{
          ...commonStyle,
          background:  valid ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
          border:      `2px solid ${valid ? '#22c55e' : '#ef4444'}`,
          zIndex:      20,
          transition:  'background 0.08s, border-color 0.08s',
        }}
      />
    </>
  );
}

// ─── InventoryGrid ────────────────────────────────────────────────────────────

interface InventoryGridProps {
  cols:           number;
  rows:           number;
  /** Items currently placed in this grid (only those with non-null gridX/gridY) */
  items:          ItemInstance[];
  heldItem:       HeldItem | null;
  onPickUp:       (item: ItemInstance) => void;
  /** Called when player clicks a cell to place the held item */
  onDrop:         (gridX: number, gridY: number) => void;
  /** Called when player right-clicks → Examine option */
  onInspect?:     (item: ItemInstance) => void;
  /** Called when player right-clicks → Consume option (consumable items) */
  onConsume?:     (item: ItemInstance) => void;
  /** Called when player right-clicks → Move to base option */
  onMoveToBase?:  (item: ItemInstance) => void;
  /** Called when player right-clicks → Move to hero option (for base-side grids) */
  onMoveToHero?:  (item: ItemInstance) => void;
  /** Called when player right-clicks → Discard option */
  onDiscard?:     (item: ItemInstance) => void;
  label?:         string;
  disabled?:      boolean;
  /** Optional highlight colour for the grid frame (default: gray) */
  accent?:        string;
}

export default function InventoryGrid({
  cols,
  rows,
  items,
  heldItem,
  onPickUp,
  onDrop,
  onInspect,
  onConsume,
  onMoveToBase,
  onMoveToHero,
  onDiscard,
  label,
  disabled = false,
  accent = 'rgba(255,255,255,0.06)',
}: InventoryGridProps) {
  const [hoverCell,     setHoverCell]     = useState<{ col: number; row: number } | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ item: ItemInstance; x: number; y: number } | null>(null);

  // Close context menu on Escape
  React.useEffect(() => {
    if (!ctxMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtxMenu(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctxMenu]);

  const gridW = cols * CELL_SIZE;
  const gridH = rows * CELL_SIZE;

  const handleCellClick = useCallback(
    (col: number, row: number) => {
      if (disabled || !heldItem) return;
      onDrop(col, row);
    },
    [disabled, heldItem, onDrop],
  );

  // Derive the hovered item instance for the floating tooltip
  const hoveredItem = hoveredItemId ? items.find((i) => i.id === hoveredItemId) ?? null : null;
  // Compute tooltip left/top offset (to the right of the item)
  const tooltipStyle = hoveredItem && hoveredItem.gridX !== null && hoveredItem.gridY !== null
    ? (() => {
        const def = ITEMS[hoveredItem.itemDefId as ItemId];
        const w   = def ? (hoveredItem.rotated ? def.height : def.width) : 1;
        return {
          left: hoveredItem.gridX * CELL_SIZE + w * CELL_SIZE + 6,
          top:  hoveredItem.gridY * CELL_SIZE,
        };
      })()
    : null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {label && (
        <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1 font-semibold">
          {label}
        </p>
      )}
      <div
        style={{
          position: 'relative',
          width:    gridW,
          height:   gridH,
          flexShrink: 0,
          border:   `1px solid ${accent}`,
          borderRadius: 4,
          overflow: 'hidden',
          opacity:  disabled ? 0.4 : 1,
          cursor:   heldItem && !disabled ? 'crosshair' : 'default',
        }}
        onMouseLeave={() => setHoverCell(null)}
      >
        {/* Dark grid background */}
        <div
          style={{
            position:        'absolute',
            inset:           0,
            background:      '#0d0f12',
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
            `,
            backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
          }}
        />

        {/* Click / hover hit areas */}
        {!disabled && Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => (
            <div
              key={`${c}-${r}`}
              style={{
                position: 'absolute',
                left:     c * CELL_SIZE,
                top:      r * CELL_SIZE,
                width:    CELL_SIZE,
                height:   CELL_SIZE,
                zIndex:   5,
              }}
              onMouseEnter={() => setHoverCell({ col: c, row: r })}
              onClick={() => handleCellClick(c, r)}
            />
          ))
        )}

        {/* Item tiles */}
        {items.map((item) => (
          <ItemTile
            key={item.id}
            item={item}
            heldItem={heldItem}
            onPickUp={onPickUp}
            onDrop={onDrop}
            hoverCell={hoverCell}
            gridCols={cols}
            gridRows={rows}
            gridItems={items}
            onRightClick={(itm, x, y) => setCtxMenu({ item: itm, x, y })}
            onHoverEnter={(i) => setHoveredItemId(i.id)}
            onHoverLeave={() => setHoveredItemId(null)}
          />
        ))}

        {/* Ghost preview when holding */}
        {heldItem && hoverCell && (
          <GhostOverlay
            heldItem={heldItem}
            hoverCell={hoverCell}
            gridCols={cols}
            gridRows={rows}
            gridItems={items}
          />
        )}
      </div>

      {/* Floating tooltip — rendered outside overflow:hidden grid so it isn't clipped */}
      {hoveredItem && tooltipStyle && !heldItem && (
        <div style={{ position: 'absolute', left: tooltipStyle.left, top: tooltipStyle.top, zIndex: 50, pointerEvents: 'none' }}>
          <ItemTooltip item={hoveredItem} />
        </div>
      )}

      {/* Right-click context menu — backdrop closes on outside click, menu floats at cursor */}
      {ctxMenu && (
        <>
          {/* Transparent full-screen backdrop — click/right-click anywhere outside closes the menu */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
            onClick={() => setCtxMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}
          />
          <div
            style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 200 }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden min-w-35 text-sm">
            {onInspect && (
              <button
                className="w-full text-left px-3 py-2 text-gray-200 hover:bg-gray-700 flex items-center gap-2 transition-colors"
                onClick={() => { setCtxMenu(null); onInspect(ctxMenu.item); }}
              >
                <span className="text-xs">🔍</span> Examine
              </button>
            )}
            {onConsume && ITEMS[ctxMenu.item.itemDefId as ItemId]?.consumeEffect && (
              <button
                className="w-full text-left px-3 py-2 text-green-400 hover:bg-gray-700 flex items-center gap-2 transition-colors"
                onClick={() => { setCtxMenu(null); onConsume(ctxMenu.item); }}
              >
                <span className="text-xs">💊</span> Consume
              </button>
            )}
            {onMoveToBase && (
              <button
                className="w-full text-left px-3 py-2 text-teal-300 hover:bg-gray-700 flex items-center gap-2 transition-colors"
                onClick={() => { setCtxMenu(null); onMoveToBase(ctxMenu.item); }}
              >
                <span className="text-xs">🏠</span> Move to base
              </button>
            )}
            {onMoveToHero && (
              <button
                className="w-full text-left px-3 py-2 text-blue-300 hover:bg-gray-700 flex items-center gap-2 transition-colors"
                onClick={() => { setCtxMenu(null); onMoveToHero(ctxMenu.item); }}
              >
                <span className="text-xs">🎒</span> Move to hero
              </button>
            )}
            {(onInspect || onMoveToBase || onMoveToHero) && onDiscard && (
              <div className="border-t border-gray-800" />
            )}
            {onDiscard && (
              <button
                className="w-full text-left px-3 py-2 text-red-400 hover:bg-gray-700 flex items-center gap-2 transition-colors"
                onClick={() => { setCtxMenu(null); onDiscard(ctxMenu.item); }}
              >
                <span className="text-xs">🗑</span> Discard
              </button>
            )}
          </div>
          </div>
        </>
      )}
    </div>
  );
}
