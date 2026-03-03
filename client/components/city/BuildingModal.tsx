'use client';

import React, { useState } from 'react';
import { BUILDINGS, canAfford, computeConstructionTime } from '@rpg/shared';
import type { BuildingId, CityBuilding, ResourceMap } from '@rpg/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';

interface BuildingModalProps {
  slot: number;
  existing: CityBuilding | null;
  resources: ResourceMap;
  cityId: string;
  hasActiveJob: boolean;
  onClose: () => void;
  onQueued: () => void;
}

export default function BuildingModal({
  slot,
  existing,
  resources,
  cityId,
  hasActiveJob,
  onClose,
  onQueued,
}: BuildingModalProps) {
  const { token } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(existing?.buildingId ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const buildingList = Object.values(BUILDINGS);

  async function handleBuild() {
    if (!selectedId) return;
    setError('');
    setLoading(true);
    try {
      await apiFetch(`/cities/${cityId}/build`, {
        method: 'POST',
        body: JSON.stringify({ buildingId: selectedId, slotIndex: slot }),
        token: token ?? undefined,
      });
      onQueued();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to queue build');
    } finally {
      setLoading(false);
    }
  }

  const targetLevel = existing ? existing.level + 1 : 1;
  const selectedDef = selectedId ? BUILDINGS[selectedId as keyof typeof BUILDINGS] : null;
  const levelDef = selectedDef?.levels[targetLevel - 1];
  const affordable = levelDef ? canAfford(resources, levelDef.cost) : false;
  const buildTime = levelDef && selectedId ? computeConstructionTime(selectedId as BuildingId, targetLevel) : 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            {existing ? `Upgrade ${selectedDef?.name ?? existing.buildingId}` : `Build — Slot ${slot + 1}`}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {!existing && (
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {buildingList.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={`text-left rounded-lg border px-3 py-2 text-sm transition
                  ${selectedId === b.id ? 'border-amber-500 bg-gray-700' : 'border-gray-700 hover:border-gray-600'}`}
              >
                <span className="text-base mr-1">{b.icon ?? '🏠'}</span>
                <span className="text-white">{b.name}</span>
              </button>
            ))}
          </div>
        )}

        {selectedDef && levelDef && (
          <div className="bg-gray-700 rounded-lg p-3 space-y-1 text-sm">
            <p className="text-gray-300">{selectedDef.description}</p>
            <p className="text-white font-medium mt-2">Level {targetLevel} cost:</p>
            {Object.entries(levelDef.cost).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-gray-400">{k}</span>
                <span className={v > (resources[k as keyof ResourceMap] ?? 0) ? 'text-red-400' : 'text-green-400'}>
                  {v}
                </span>
              </div>
            ))}
            <p className="text-gray-400 text-xs pt-1">Build time: {Math.round(buildTime / 60)}m</p>
          </div>
        )}

        {hasActiveJob && (
          <p className="text-yellow-400 text-sm">⚠ A construction is already in progress.</p>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleBuild}
          disabled={loading || !selectedId || !affordable || hasActiveJob}
          className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed
                     text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          {loading ? 'Queuing…' : existing ? 'Upgrade' : 'Build'}
        </button>
      </div>
    </div>
  );
}
