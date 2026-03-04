'use client';

import React, { useMemo, useState } from 'react';
import { ITEMS, ITEM_CATEGORY_ICON } from '@rpg/shared';
import type { ItemId, ItemInstance } from '@rpg/shared';
import { findFirstFreeSlotClient } from './InventoryGrid';

// ─── Props ────────────────────────────────────────────────────────────────────

interface MoveToBaseModalProps {
  item:            ItemInstance;
  baseName:        string;
  /** One entry per armory building */
  armoryGridSizes: { armoryIndex: number; cols: number; rows: number }[];
  /** All items currently stored in the base armory */
  baseArmoryItems: ItemInstance[];
  onClose:         () => void;
  /** Called with the chosen armoryIndex when the player confirms */
  onConfirm:       (armoryIndex: number) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MoveToBaseModal({
  item,
  baseName,
  armoryGridSizes,
  baseArmoryItems,
  onClose,
  onConfirm,
}: MoveToBaseModalProps) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const def = ITEMS[item.itemDefId as ItemId];

  // ── Per-armory capacity stats ───────────────────────────────────────────────

  const armoryStatsList = useMemo(() =>
    armoryGridSizes.map(({ armoryIndex, cols, rows }) => {
      const totalCells = cols * rows;
      const slotItems  = baseArmoryItems.filter(
        (i) => i.buildingSlotIndex === armoryIndex ||
               (armoryIndex === 0 && i.buildingSlotIndex === null),
      );
      const usedCells = slotItems.reduce((acc, i) => {
        const d = ITEMS[i.itemDefId as ItemId];
        return acc + (d ? d.width * d.height : 1);
      }, 0);
      const hasSpace = findFirstFreeSlotClient(cols, rows, slotItems, { itemDefId: item.itemDefId }) !== null;
      return { armoryIndex, totalCells, usedCells, hasSpace };
    }),
  [armoryGridSizes, baseArmoryItems, item.itemDefId]);

  // ── Move handler ──────────────────────────────────────────────────────────

  const handleMove = async (armoryIndex: number) => {
    setLoading(true);
    setError('');
    try {
      await onConfirm(armoryIndex);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to move item');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div>
          <h2 className="text-white font-bold text-base">Move to Base</h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Select a storage at <span className="text-teal-400">{baseName}</span>
          </p>
        </div>

        {/* Item preview */}
        {def && (
          <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
            <div
              className="w-10 h-10 rounded flex items-center justify-center text-xl shrink-0"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {ITEM_CATEGORY_ICON[def.category]}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-100">{def.name}</p>
              <p className="text-[10px] text-gray-500 capitalize">
                {def.width}×{def.height} · {def.rarity}
              </p>
            </div>
          </div>
        )}

        {/* Storage options */}
        <div className="space-y-2">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest">Storage</p>

          {/* Armory options — one row per armory building */}
          {armoryGridSizes.length === 0 ? (
            <div className="flex items-center justify-between bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 opacity-50">
              <div>
                <p className="text-sm font-medium text-gray-400">🏗 Armory</p>
                <p className="text-[10px] text-gray-600">Not built</p>
              </div>
              <span className="text-[10px] text-gray-600">Unavailable</span>
            </div>
          ) : (
            armoryStatsList.map(({ armoryIndex, totalCells, usedCells, hasSpace }) => (
              <button
                key={armoryIndex}
                className="w-full flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:border-teal-600 hover:enabled:bg-gray-700"
                disabled={!hasSpace || loading}
                onClick={() => handleMove(armoryIndex)}
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-200">
                    🏠 {armoryGridSizes.length > 1 ? `Armory ${armoryIndex + 1}` : 'Armory'}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {usedCells} / {totalCells} cells used
                  </p>
                </div>
                {hasSpace ? (
                  <span className="text-[10px] font-medium text-teal-400 shrink-0">
                    {loading ? 'Moving…' : 'Move here →'}
                  </span>
                ) : (
                  <span className="text-[10px] text-red-400/70 shrink-0">No space</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-xs">{error}</p>
        )}

        {/* Footer */}
        <button
          className="w-full text-center text-xs text-gray-500 hover:text-gray-300 transition-colors pt-1"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
