'use client';

import React, { useState } from 'react';
import { UNITS, BUILDINGS, canAfford, computeTrainingTime } from '@rpg/shared';
import type { TroopMap, ResourceMap, Job, BaseBuilding, TrainingJobMeta, UnitId, ResourceType } from '@rpg/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { ResourceIcon, ResourceAmount } from '@/components/ui/ResourceIcon';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TroopsPanelProps {
  troops:       TroopMap;
  resources:    ResourceMap;
  buildings:    BaseBuilding[];
  cityId:       string;
  trainingJobs: Job[];
  onRefresh:    () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TroopsPanel({
  troops,
  resources,
  buildings,
  cityId,
  trainingJobs,
  onRefresh,
}: TroopsPanelProps) {
  const { token } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<UnitId>(Object.keys(UNITS)[0] as UnitId);
  const [amount, setAmount]     = useState(1);
  const [loading, setLoading]   = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError]       = useState('');

  // Sort the queue by endsAt so oldest are first
  const sortedQueue = [...trainingJobs].sort(
    (a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime()
  );

  // Compute building level for a given building id (0 = not built)
  function getBuildingLevel(buildingId: string): number {
    const b = buildings.find((bl) => bl.buildingId === buildingId);
    return b?.level ?? 0;
  }

  // Effective training time for display (building level speed, no item bonus on client)
  function effectiveTrainTime(unitId: UnitId): number {
    const unitDef = UNITS[unitId];
    const level   = getBuildingLevel(unitDef.trainingBuilding);
    if (level === 0) return unitDef.trainingTime;
    return computeTrainingTime(unitId, level, 0);
  }

  // Whether the player has the required building
  function canTrainUnit(unitId: UnitId): boolean {
    const unitDef = UNITS[unitId];
    return getBuildingLevel(unitDef.trainingBuilding) >= unitDef.trainingBuildingLevel;
  }

  const selectedUnit  = UNITS[selectedUnitId];
  const totalCost     = selectedUnit
    ? (Object.fromEntries(
        Object.entries(selectedUnit.cost)
          .filter(([, v]) => (v as number) > 0)
          .map(([k, v]) => [k, (v as number) * amount])
      ) as ResourceMap)
    : {} as ResourceMap;
  const affordable    = selectedUnit ? canAfford(resources, totalCost) : false;
  const canTrainSel   = canTrainUnit(selectedUnitId);

  async function handleTrain() {
    setError('');
    setLoading(true);
    try {
      await apiFetch(`/bases/${cityId}/train`, {
        method: 'POST',
        body:   JSON.stringify({ unitId: selectedUnitId, quantity: amount }),
        token:  token ?? undefined,
      });
      onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to queue training');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(jobId: string) {
    setCancelling(jobId);
    try {
      await apiFetch(`/bases/${cityId}/train-job/${jobId}`, {
        method: 'DELETE',
        token:  token ?? undefined,
      });
      onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to cancel');
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Garrison ───────────────────────────────────────────────────── */}
      <section className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Garrison</h2>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(UNITS).map(([id, def]) => {
            const count = (troops as Record<string, number>)[id] ?? 0;
            return (
              <div key={id} className="bg-gray-700/60 rounded-lg px-3 py-2 flex justify-between items-center text-sm">
                <span className="text-gray-300">{def.name}</span>
                <span className="text-white font-semibold tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Training Queue ─────────────────────────────────────────────── */}
      {sortedQueue.length > 0 && (
        <section className="bg-gray-800 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Training Queue ({sortedQueue.length})
          </h2>
          <div className="space-y-2">
            {sortedQueue.map((job, idx) => {
              const meta   = job.metadata as TrainingJobMeta;
              const uDef   = UNITS[meta.unitId as UnitId];
              const isActive = idx === 0;
              return (
                <div
                  key={job.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm
                    ${isActive ? 'bg-amber-900/40 border border-amber-700/50' : 'bg-gray-700/50'}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono shrink-0
                      ${isActive ? 'bg-amber-700 text-amber-100' : 'bg-gray-600 text-gray-300'}`}>
                      {idx + 1}
                    </span>
                    <span className="text-white font-medium truncate">{uDef?.name ?? meta.unitId}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    {isActive ? (
                      <span className="text-amber-300 text-xs font-mono">
                        <CountdownTimer endsAt={job.endsAt} onComplete={onRefresh} />
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs font-mono">
                        <CountdownTimer endsAt={job.endsAt} onComplete={onRefresh} />
                      </span>
                    )}
                    <button
                      onClick={() => handleCancel(job.id)}
                      disabled={cancelling === job.id}
                      className="text-red-400 hover:text-red-300 disabled:opacity-40 text-xs font-medium transition"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Train Units ───────────────────────────────────────────────── */}
      <section className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Train Units</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Object.values(UNITS).map((u) => {
            const available  = canTrainUnit(u.id);
            const bDef       = BUILDINGS[u.trainingBuilding];
            const bLevel     = getBuildingLevel(u.trainingBuilding);
            const trainSecs  = available ? effectiveTrainTime(u.id) : u.trainingTime;
            const selected   = selectedUnitId === u.id;
            const nonZeroCost = Object.entries(u.cost).filter(([, v]) => (v as number) > 0);

            return (
              <button
                key={u.id}
                onClick={() => available && setSelectedUnitId(u.id)}
                disabled={!available}
                className={`w-full text-left rounded-xl border p-3 transition-all
                  ${selected
                    ? 'border-amber-500 bg-gray-700 shadow-lg shadow-amber-900/20'
                    : available
                      ? 'border-gray-700 bg-gray-700/40 hover:border-gray-500 hover:bg-gray-700/70'
                      : 'border-gray-800 bg-gray-800/50 opacity-50 cursor-not-allowed'
                  }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-white font-semibold text-sm leading-tight">{u.name}</p>
                    <p className="text-gray-400 text-xs leading-snug mt-0.5">{u.description}</p>
                  </div>
                  {selected && (
                    <span className="shrink-0 text-amber-400 text-xs font-bold mt-0.5">Selected</span>
                  )}
                </div>

                {/* Stats row */}
                <div className="flex gap-3 text-xs text-gray-400 mb-2">
                  <span><span className="text-red-400 font-medium">ATK</span> {u.stats.attack}</span>
                  <span><span className="text-blue-400 font-medium">DEF</span> {u.stats.defense}</span>
                  <span><span className="text-yellow-400 font-medium">SPD</span> {u.stats.speed}</span>
                  <span><span className="text-green-400 font-medium">CAR</span> {u.stats.carry}</span>
                </div>

                {/* Cost row */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-2">
                  {nonZeroCost.map(([res, val]) => (
                    <ResourceAmount
                      key={res}
                      type={res as ResourceType}
                      amount={val as number}
                      size={13}
                      amountClassName={
                        (resources[res as keyof ResourceMap] ?? 0) >= (val as number)
                          ? 'text-green-400 font-medium'
                          : 'text-red-400 font-medium'
                      }
                    />
                  ))}
                </div>

                {/* Footer: time + building req */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    ⏱ <span className="text-gray-200 font-mono">{formatDuration(trainSecs)}</span>
                    {available && bLevel > 1 && (
                      <span className="text-green-400 ml-1">
                        (lv{bLevel} -{Math.min(50, (bLevel - 1) * 8)}%)
                      </span>
                    )}
                  </span>
                  {!available ? (
                    <span className="text-red-400">
                      Needs {bDef.name} lv{u.trainingBuildingLevel}
                    </span>
                  ) : (
                    <span className="text-gray-500">{bDef.name} lv{bLevel}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Amount + cost summary + train button */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400 shrink-0">Quantity:</label>
            <input
              type="number"
              min={1}
              max={500}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm w-24 focus:outline-none focus:border-amber-500"
            />
            {selectedUnit && (
              <span className="text-xs text-gray-400">
                Total time: <span className="text-gray-200 font-mono">{formatDuration(effectiveTrainTime(selectedUnitId) * amount)}</span>
              </span>
            )}
          </div>

          {/* Total cost breakdown */}
          {selectedUnit && amount > 1 && (
            <div className="bg-gray-700/50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-400 mb-1">Total cost ({amount}×):</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(totalCost)
                  .filter(([, v]) => (v as number) > 0)
                  .map(([res, val]) => (
                    <ResourceAmount
                      key={res}
                      type={res as ResourceType}
                      amount={val as number}
                      size={13}
                      amountClassName={
                        (resources[res as keyof ResourceMap] ?? 0) >= (val as number)
                          ? 'text-green-400 font-medium'
                          : 'text-red-400 font-medium'
                      }
                    />
                  ))
                }
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleTrain}
            disabled={loading || !affordable || !canTrainSel}
            className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed
                       text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm"
          >
            {loading
              ? 'Queuing…'
              : !canTrainSel
                ? `Requires ${BUILDINGS[selectedUnit?.trainingBuilding].name} lv${selectedUnit?.trainingBuildingLevel}`
                : !affordable
                  ? 'Not enough resources'
                  : `Queue ${amount > 1 ? `${amount}× ` : ''}${selectedUnit?.name}`}
          </button>
        </div>
      </section>
    </div>
  );
}

