'use client';

import React, { useState } from 'react';
import {
  BUILDINGS,
  BUILDING_LIST,
  RESOURCE_LABELS,
  RESOURCE_TYPES,
  canAfford,
  computeConstructionTime,
  computeTotalBuildingCost,
  storageExpansionResourceSlots,
} from '@rpg/shared';
import type { BuildingId, CityBuilding, ResourceMap, ResourceType } from '@rpg/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';

interface BuildingModalProps {
  slot:         number;
  existing:     CityBuilding | null;
  allBuildings: CityBuilding[];
  resources:    ResourceMap;
  cityId:       string;
  hasActiveJob: boolean;
  onClose:      () => void;
  onQueued:     () => void;
}

type ModalView = 'pick' | 'detail' | 'refund-confirm';

export default function BuildingModal({
  slot, existing, allBuildings, resources, cityId, hasActiveJob, onClose, onQueued,
}: BuildingModalProps) {
  const { token } = useAuth();

  const [view,         setView]         = useState<ModalView>(existing ? 'detail' : 'pick');
  const [selectedId,   setSelectedId]   = useState<string | null>(existing?.buildingId ?? null);
  const [resourcePick, setResourcePick] = useState<ResourceType[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  // ── Derived data ────────────────────────────────────────────────────────────

  const selectedDef  = selectedId ? BUILDINGS[selectedId as BuildingId] : null;
  const targetLevel  = existing ? existing.level + 1 : 1;
  const levelDef     = selectedDef?.levels[targetLevel - 1] ?? null;
  const affordable   = levelDef ? canAfford(resources, levelDef.cost) : false;
  const buildTime    = levelDef && selectedId
    ? computeConstructionTime(selectedId as BuildingId, targetLevel)
    : 0;

  const isAtMaxLevel = !!existing && !!selectedDef && existing.level >= selectedDef.maxLevel;

  // Per-building counts for maxPerBase enforcement
  const buildingCounts: Record<string, number> = {};
  for (const b of allBuildings) {
    buildingCounts[b.buildingId] = (buildingCounts[b.buildingId] ?? 0) + 1;
  }

  // Storage expansion resource state
  const isStorageExpansion = selectedId === 'storage_expansion';
  const existingResources  = (existing?.meta?.selectedResources as ResourceType[] | undefined) ?? [];
  const slotsAtTarget      = isStorageExpansion ? storageExpansionResourceSlots(targetLevel) : 0;
  const newSlots           = isStorageExpansion ? slotsAtTarget - existingResources.length : 0;
  const pickableResources  = RESOURCE_TYPES.filter((r) => !existingResources.includes(r));
  const storageReady       = !isStorageExpansion || resourcePick.length === newSlots;

  // Refund breakdown (80% of total cost)
  const totalCost = existing
    ? computeTotalBuildingCost(existing.buildingId, existing.level)
    : null;
  const refundAmounts = totalCost
    ? (Object.fromEntries(
        Object.entries(totalCost).map(([r, v]) => [r, Math.floor((v as number) * 0.8)])
      ) as ResourceMap)
    : null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleBuild() {
    if (!selectedId || !affordable || !storageReady) return;
    setError(''); setLoading(true);
    try {
      const body: Record<string, unknown> = { buildingId: selectedId, slotIndex: slot };
      if (isStorageExpansion) {
        body.storageResources = [...existingResources, ...resourcePick];
      }
      await apiFetch(`/bases/${cityId}/build`, {
        method: 'POST',
        body:   JSON.stringify(body),
        token:  token ?? undefined,
      });
      onQueued();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to queue build');
    } finally { setLoading(false); }
  }

  async function handleRefund() {
    setError(''); setLoading(true);
    try {
      await apiFetch(`/bases/${cityId}/refund-building`, {
        method: 'POST',
        body:   JSON.stringify({ slotIndex: slot }),
        token:  token ?? undefined,
      });
      onQueued();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to refund building');
    } finally { setLoading(false); }
  }

  function toggleResource(r: ResourceType) {
    setResourcePick((prev) => {
      if (prev.includes(r)) return prev.filter((x) => x !== r);
      // Single-slot: swap instead of block
      if (newSlots === 1 && prev.length >= 1) return [r];
      if (prev.length >= newSlots) return prev;
      return [...prev, r];
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-2xl p-8 w-full max-w-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            {existing
              ? `${selectedDef?.icon ?? ''} ${selectedDef?.name ?? existing.buildingId}`
              : `Slot ${slot + 1} — Build`}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* ── PICK VIEW ──────────────────────────────────────────────────────── */}
        {view === 'pick' && (
          <div className="grid grid-cols-2 gap-3 max-h-100 overflow-y-auto pr-1">
            {BUILDING_LIST.map((b) => {
              const count   = buildingCounts[b.id] ?? 0;
              const atLimit = b.maxPerBase !== undefined && count >= b.maxPerBase;
              return (
                <button
                  key={b.id}
                  disabled={atLimit}
                  onClick={() => { setSelectedId(b.id); setView('detail'); }}
                  className={[
                    'text-left rounded-lg border px-3 py-2 text-sm transition',
                    atLimit
                      ? 'border-gray-800 bg-gray-800/30 opacity-40 cursor-not-allowed'
                      : 'border-gray-700 hover:border-amber-500 hover:bg-gray-700/60',
                  ].join(' ')}
                >
                  <span className="text-base mr-1">{b.icon}</span>
                  <span className="text-white">{b.name}</span>
                  {b.maxPerBase !== undefined && (
                    <span className="text-[10px] text-gray-500 block mt-0.5">
                      {atLimit ? `Max ${b.maxPerBase}/base` : `${count}/${b.maxPerBase} per base`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── DETAIL VIEW ────────────────────────────────────────────────────── */}
        {view === 'detail' && selectedDef && (
          <>
            {existing && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Level</span>
                <span className="text-white font-semibold">{existing.level}</span>
                {!isAtMaxLevel && (
                  <>
                    <span className="text-gray-600">→</span>
                    <span className="text-amber-300 font-semibold">{targetLevel}</span>
                  </>
                )}
                {isAtMaxLevel && (
                  <span className="text-gray-500 italic text-xs ml-1">(max level)</span>
                )}
              </div>
            )}

            <p className="text-gray-400 text-sm leading-relaxed">{selectedDef.description}</p>

            {/* Locked (already-assigned) resources */}
            {isStorageExpansion && existingResources.length > 0 && (
              <div className="bg-gray-700/40 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Assigned resources</p>
                <div className="flex flex-wrap gap-1.5">
                  {existingResources.map((r) => (
                    <span
                      key={r}
                      className="px-2 py-0.5 rounded bg-teal-900/60 border border-teal-700/60 text-teal-300 text-xs font-medium"
                    >
                      🔒 {RESOURCE_LABELS[r]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* New resource picker */}
            {isStorageExpansion && newSlots > 0 && (
              <div className="bg-gray-700/40 rounded-lg p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-gray-500">
                  Choose {newSlots} resource{newSlots > 1 ? 's' : ''} for this depot
                  <span className="normal-case tracking-normal text-gray-600 ml-1">(permanent)</span>
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {pickableResources.map((r) => {
                    const picked = resourcePick.includes(r);
                    // Swappable when only 1 slot — never fully block
                    const full   = !picked && resourcePick.length >= newSlots && newSlots > 1;
                    return (
                      <button
                        key={r}
                        onClick={() => toggleResource(r)}
                        disabled={full}
                        className={[
                          'px-2 py-1.5 rounded border text-xs font-medium transition',
                          picked
                            ? 'border-teal-500 bg-teal-900/60 text-teal-200'
                            : full
                              ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                              : 'border-gray-600 text-gray-300 hover:border-teal-600 hover:text-teal-300',
                        ].join(' ')}
                      >
                        {RESOURCE_LABELS[r]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cost breakdown */}
            {!isAtMaxLevel && levelDef && (
              <div className="bg-gray-700/60 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-white mb-1.5">Level {targetLevel} cost</p>
                {Object.entries(levelDef.cost)
                  .filter(([, v]) => (v as number) > 0)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-gray-400">{RESOURCE_LABELS[k as ResourceType] ?? k}</span>
                      <span className={(v as number) > (resources[k as keyof ResourceMap] ?? 0) ? 'text-red-400' : 'text-green-400'}>
                        {(v as number).toLocaleString()}
                      </span>
                    </div>
                  ))}
                <p className="text-gray-600 text-[10px] pt-1">⏱ {Math.ceil(buildTime / 60)}m build time</p>
              </div>
            )}

            {hasActiveJob && (
              <p className="text-yellow-400 text-sm">⚠ A construction is already in progress.</p>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-2 pt-1">
              {!isAtMaxLevel && (
                <button
                  onClick={handleBuild}
                  disabled={loading || !affordable || hasActiveJob || !storageReady}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
                >
                  {loading ? 'Queuing…' : existing ? 'Upgrade' : 'Build'}
                </button>
              )}
              {existing && (
                <button
                  onClick={() => setView('refund-confirm')}
                  className="bg-red-900/40 hover:bg-red-900/70 border border-red-800/50 text-red-400 hover:text-red-300 font-semibold py-2 px-3 rounded-lg transition text-sm"
                >
                  Refund
                </button>
              )}
              {!existing && (
                <button
                  onClick={() => setView('pick')}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 px-3 rounded-lg transition text-sm"
                >
                  ← Back
                </button>
              )}
            </div>
          </>
        )}

        {/* ── REFUND CONFIRM VIEW ────────────────────────────────────────────── */}
        {view === 'refund-confirm' && existing && refundAmounts && (
          <>
            <p className="text-gray-300 text-sm">
              Receive <span className="text-green-400 font-semibold">80%</span> of total construction cost:
            </p>

            <div className="bg-gray-700/60 rounded-lg p-3 space-y-1">
              {Object.entries(refundAmounts)
                .filter(([, v]) => (v as number) > 0)
                .map(([r, v]) => (
                  <div key={r} className="flex justify-between text-xs">
                    <span className="text-gray-400">{RESOURCE_LABELS[r as ResourceType] ?? r}</span>
                    <span className="text-green-400">+{(v as number).toLocaleString()}</span>
                  </div>
                ))}
            </div>

            <p className="text-yellow-500 text-xs">
              ⚠ The building will be permanently removed. This cannot be undone.
            </p>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleRefund}
                disabled={loading}
                className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
              >
                {loading ? 'Refunding…' : 'Confirm Refund'}
              </button>
              <button
                onClick={() => setView('detail')}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-2 px-4 rounded-lg transition text-sm"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
