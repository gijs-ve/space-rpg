'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CRAFTING_RECIPES,
  ITEMS,
  ITEM_CATEGORY_ICON,
  RESOURCE_LABELS,
  recipesForBuilding,
  craftingDurationSeconds,
} from '@rpg/shared';
import type {
  BuildingId,
  CityBuilding,
  CraftingSlotState,
  ItemInstance,
  ResourceType,
} from '@rpg/shared';
import { apiFetch } from '@/lib/api';
import { ResourceIcon } from '@/components/ui/ResourceIcon';
import { useAuth } from '@/context/auth';
import { useGameInventory } from '@/context/inventory';
import CountdownTimer from '@/components/ui/CountdownTimer';

interface CraftingPanelProps {
  /** Building slot index this panel belongs to */
  buildingSlotIndex: number;
  /** The building definition id (e.g. 'forge') */
  buildingId: BuildingId;
  /** Current building level */
  buildingLevel: number;
  /** City the building belongs to */
  cityId: string;
}

interface SlotsResponse {
  slots: CraftingSlotState[];
}
interface QueueResponse {
  slot: CraftingSlotState;
  jobStarted: boolean;
}
interface CollectResponse {
  resourceType: string;
  amount: number;
  reportId: string;
  slots: CraftingSlotState[];
}

export default function CraftingPanel({
  buildingSlotIndex,
  buildingId,
  buildingLevel,
  cityId,
}: CraftingPanelProps) {
  const { token } = useAuth();
  const { baseItems, fetchHeroItems } = useGameInventory();

  const [slots,   setSlots]   = useState<CraftingSlotState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [toast,   setToast]   = useState('');

  const recipes = recipesForBuilding(buildingId);
  const hasMultipleRecipes = recipes.length > 1;

  const fetchSlots = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<SlotsResponse>(`/crafting/${cityId}`, { token });
      setSlots(res.slots);
    } catch { /* ignore */ }
  }, [cityId, token]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // Items in base storage that match a given itemDefId
  const baseItemsForDef = (itemDefId: string): ItemInstance[] =>
    baseItems.filter(
      (i) =>
        i.itemDefId === itemDefId &&
        (i.location === 'base_armory' || i.location === 'base_building_equip'),
    );

  const slotFor = (recipeId: string): CraftingSlotState | undefined =>
    slots.find(
      (s) => s.buildingSlotIndex === buildingSlotIndex && s.recipeId === recipeId,
    );

  /** The recipe currently "holding" this building slot (has queue, active job, or uncollected output). */
  const activeSlot = slots.find(
    (s) =>
      s.buildingSlotIndex === buildingSlotIndex &&
      (s.inputQueueCount > 0 || s.processingJobId !== null || s.outputCount > 0),
  );
  const lockedToRecipeId: string | null = activeSlot?.recipeId ?? null;

  async function handleAddToQueue(recipeId: string) {
    const recipe = CRAFTING_RECIPES[recipeId];
    if (!recipe) return;

    const available = baseItemsForDef(recipe.inputItemId);
    if (available.length === 0) {
      setError(`No ${ITEMS[recipe.inputItemId]?.name ?? recipe.inputItemId} in base storage`);
      return;
    }

    setError(''); setLoading(true);
    try {
      const res = await apiFetch<QueueResponse>(`/crafting/${cityId}/queue`, {
        method: 'POST',
        token:  token ?? undefined,
        body:   JSON.stringify({
          buildingSlotIndex,
          recipeId,
          itemInstanceIds: [available[0].id], // queue one at a time
        }),
      });
      setSlots((prev) => {
        const idx = prev.findIndex(
          (s) => s.buildingSlotIndex === buildingSlotIndex && s.recipeId === recipeId,
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = res.slot;
          return next;
        }
        return [...prev, res.slot];
      });
      await fetchHeroItems(); // refresh base inventory
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to queue item');
    } finally { setLoading(false); }
  }

  async function handleCollect(recipeId: string) {
    setError(''); setLoading(true);
    try {
      const res = await apiFetch<CollectResponse>(`/crafting/${cityId}/collect`, {
        method: 'POST',
        token:  token ?? undefined,
        body:   JSON.stringify({ buildingSlotIndex, recipeId }),
      });
      setSlots(res.slots);
      setToast(`+${res.amount} ${RESOURCE_LABELS[res.resourceType as keyof typeof RESOURCE_LABELS] ?? res.resourceType} collected!`);
      setTimeout(() => setToast(''), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to collect output');
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="bg-green-900/60 border border-green-700/60 text-green-300 text-xs rounded-lg px-3 py-2">
          ✅ {toast}
        </div>
      )}
      {error && (
        <div className="bg-red-900/40 border border-red-800/40 text-red-400 text-xs rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* One-at-a-time notice */}
      {hasMultipleRecipes && (
        <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2 text-[11px] text-amber-400/80">
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>Only one recipe can be active per building at a time. Clear the queue and collect all output to switch recipes.</span>
        </div>
      )}

      {recipes.map((recipe) => {
        const slot      = slotFor(recipe.id);
        const available = baseItemsForDef(recipe.inputItemId);
        const inputDef  = ITEMS[recipe.inputItemId];
        const hasOutput = (slot?.outputCount ?? 0) > 0;
        const isRunning = !!slot?.processingJobId;
        const duration  = craftingDurationSeconds(recipe, buildingLevel);

        const isActive = lockedToRecipeId === recipe.id;
        const isLocked = lockedToRecipeId !== null && !isActive;

        return (
          <div
            key={recipe.id}
            className={`bg-gray-700/40 rounded-xl border p-4 space-y-3 transition-opacity ${
              isLocked
                ? 'border-gray-700/20 opacity-40 pointer-events-none'
                : isActive
                  ? 'border-purple-600/50'
                  : 'border-gray-600/40'
            }`}
          >
            {/* Recipe header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{recipe.label}</p>
                  {isActive && (
                    <span className="text-[9px] uppercase tracking-widest bg-purple-700/60 text-purple-300 px-1.5 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{recipe.description}</p>
              </div>
              <span className="text-[10px] text-gray-500 whitespace-nowrap">
                ⏱ {duration >= 60 ? `${Math.ceil(duration / 60)}m` : `${duration}s`}
              </span>
            </div>

            {/* Input item */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Requires:</span>
              <span className="font-medium text-gray-200">
                {inputDef ? ITEM_CATEGORY_ICON[inputDef.category] : '📦'} {inputDef?.name ?? recipe.inputItemId}
              </span>
              <span className={available.length > 0 ? 'text-green-400' : 'text-red-400'}>
                ({available.length} in base)
              </span>
            </div>

            {/* Output */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Produces:</span>
              <span className="font-medium text-gray-200 flex items-center gap-1">
                {recipe.outputAmount}×
                <ResourceIcon type={recipe.outputResource as ResourceType} size={13} />
                {RESOURCE_LABELS[recipe.outputResource as ResourceType] ?? recipe.outputResource}
              </span>
            </div>

            {/* Slot status */}
            {slot && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-gray-800/60 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">Queue</p>
                  <p className="text-sm font-mono text-amber-300">{slot.inputQueueCount}</p>
                </div>
                <div className="bg-gray-800/60 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">Processing</p>
                  {isRunning && slot.processingEndsAt ? (
                    <CountdownTimer endsAt={slot.processingEndsAt} onComplete={fetchSlots} />
                  ) : (
                    <p className="text-sm font-mono text-gray-500">—</p>
                  )}
                </div>
                <div className="bg-gray-800/60 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">Ready</p>
                  <p className={`text-sm font-mono ${hasOutput ? 'text-green-400' : 'text-gray-500'}`}>
                    {slot.outputCount}
                  </p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleAddToQueue(recipe.id)}
                disabled={loading || available.length === 0 || isLocked}
                className="flex-1 bg-purple-800 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold py-2 px-3 rounded-lg transition"
              >
                + Queue (1×)
              </button>
              {hasOutput && (
                <button
                  onClick={() => handleCollect(recipe.id)}
                  disabled={loading}
                  className="flex-1 bg-green-800 hover:bg-green-700 disabled:opacity-40 text-white text-xs font-semibold py-2 px-3 rounded-lg transition"
                >
                  Collect ×{slot!.outputCount}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {recipes.length === 0 && (
        <p className="text-gray-500 text-sm italic text-center py-4">
          No recipes available for this building.
        </p>
      )}
    </div>
  );
}
