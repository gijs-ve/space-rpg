'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ITEMS, ITEM_RARITY_COLOR, ITEM_RARITY_BG, ITEM_CATEGORY_ICON } from '@rpg/shared';
import type { ItemId, ItemInstance } from '@rpg/shared';
import { CELL_SIZE, HeldItem } from './types';

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
}: {
  item:       ItemInstance;
  heldItem:   HeldItem | null;
  onPickUp:   (item: ItemInstance) => void;
  onDrop:     (gridX: number, gridY: number) => void;
  hoverCell:  { col: number; row: number } | null;
  gridCols:   number;
  gridRows:   number;
  gridItems:  ItemInstance[];
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
      title={def.name}
      onClick={(e) => {
        e.stopPropagation();
        if (heldItem) {
          // When holding, clicking an existing item swaps (just place at its grid origin)
          onDrop(item.gridX!, item.gridY!);
        } else {
          onPickUp(item);
        }
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

  const w = heldItem.effectiveWidth;
  const h = heldItem.effectiveHeight;

  return (
    <div
      style={{
        position:        'absolute',
        left:            hoverCell.col * CELL_SIZE,
        top:             hoverCell.row * CELL_SIZE,
        width:           w * CELL_SIZE - 2,
        height:          h * CELL_SIZE - 2,
        background:      valid ? 'rgba(34,197,94,0.20)' : 'rgba(239,68,68,0.20)',
        border:          `2px solid ${valid ? '#22c55e' : '#ef4444'}`,
        pointerEvents:   'none',
        zIndex:          20,
        borderRadius:    2,
        transition:      'background 0.08s, border-color 0.08s',
      }}
    />
  );
}

// ─── InventoryGrid ────────────────────────────────────────────────────────────

interface InventoryGridProps {
  cols:       number;
  rows:       number;
  /** Items currently placed in this grid (only those with non-null gridX/gridY) */
  items:      ItemInstance[];
  heldItem:   HeldItem | null;
  onPickUp:   (item: ItemInstance) => void;
  /** Called when player clicks a cell to place the held item */
  onDrop:     (gridX: number, gridY: number) => void;
  label?:     string;
  disabled?:  boolean;
  /** Optional highlight colour for the grid frame (default: gray) */
  accent?:    string;
}

export default function InventoryGrid({
  cols,
  rows,
  items,
  heldItem,
  onPickUp,
  onDrop,
  label,
  disabled = false,
  accent = 'rgba(255,255,255,0.06)',
}: InventoryGridProps) {
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null);

  const gridW = cols * CELL_SIZE;
  const gridH = rows * CELL_SIZE;

  const handleCellClick = useCallback(
    (col: number, row: number) => {
      if (disabled || !heldItem) return;
      onDrop(col, row);
    },
    [disabled, heldItem, onDrop],
  );

  return (
    <div>
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
    </div>
  );
}
