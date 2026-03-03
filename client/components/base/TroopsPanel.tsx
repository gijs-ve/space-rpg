'use client';

import React, { useState } from 'react';
import { UNITS, canAfford } from '@rpg/shared';
import type { TroopMap, ResourceMap, Job } from '@rpg/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import CountdownTimer from '@/components/ui/CountdownTimer';

interface TroopsPanelProps {
  troops: TroopMap;
  resources: ResourceMap;
  cityId: string;
  activeJob: Job | null;
  onTrained: () => void;
}

export default function TroopsPanel({ troops, resources, cityId, activeJob, onTrained }: TroopsPanelProps) {
  const { token } = useAuth();
  const [unitId, setUnitId] = useState<string>(Object.keys(UNITS)[0]);
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleTrain() {
    setError('');
    setLoading(true);
    try {
      await apiFetch(`/bases/${cityId}/train`, {
        method: 'POST',
        body: JSON.stringify({ unitId, quantity: amount }),
        token: token ?? undefined,
      });
      onTrained();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start training');
    } finally {
      setLoading(false);
    }
  }

  const selectedUnit = UNITS[unitId as keyof typeof UNITS];
  const totalCost = selectedUnit
    ? Object.fromEntries(
        Object.entries(selectedUnit.cost).map(([k, v]) => [k, (v as number) * amount])
      )
    : {};
  const affordable = selectedUnit ? canAfford(resources, totalCost as ResourceMap) : false;

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Troops</h2>

      {/* Garrison */}
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(UNITS).map(([id, def]) => {
          const count = (troops as Record<string, number>)[id] ?? 0;
          return (
            <div key={id} className="bg-gray-700 rounded-lg px-3 py-2 flex justify-between text-sm">
              <span className="text-gray-300">{def.name}</span>
              <span className="text-white font-medium">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Active training */}
      {activeJob && (
        <div className="bg-gray-700 rounded-lg p-3 text-sm text-amber-300">
          Training in progress… <CountdownTimer endsAt={activeJob.endsAt} onComplete={onTrained} />
        </div>
      )}

      {/* Train form */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Train units</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(UNITS).map((u) => (
            <button
              key={u.id}
              onClick={() => setUnitId(u.id)}
              className={`text-left rounded-lg border px-3 py-2 text-sm transition
                ${unitId === u.id ? 'border-amber-500 bg-gray-700' : 'border-gray-700 hover:border-gray-600'}`}
            >
              <span className="block text-white font-medium">{u.name}</span>
              <span className="text-gray-400 text-xs">ATK {u.stats.attack} · DEF {u.stats.defense}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-400">Amount:</label>
          <input
            type="number"
            min={1}
            max={500}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm w-20"
          />
        </div>

        {selectedUnit && (
          <div className="text-xs text-gray-400 space-y-0.5">
            <p className="text-white font-medium">Total cost ({amount}×):</p>
            {Object.entries(totalCost).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <span className={(resources[k as keyof ResourceMap] ?? 0) >= (v as number) ? 'text-green-400' : 'text-red-400'}>{v as number}</span>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleTrain}
          disabled={loading || !affordable || !!activeJob}
          className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed
                     text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          {loading ? 'Queuing…' : 'Train'}
        </button>
      </div>
    </div>
  );
}
