'use client';

import React, { useState } from 'react';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { ACTIVITIES } from '@rpg/shared';
import type { Hero, Job } from '@rpg/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';

interface AdventurePanelProps {
  hero: Hero;
  activeJob: Job | null;
  onStarted: () => void;
  onComplete: () => void;
}

export default function AdventurePanel({ hero, activeJob, onStarted, onComplete }: AdventurePanelProps) {
  const { token } = useAuth();
  const [selected, setSelected] = useState<string>(Object.keys(ACTIVITIES)[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function startAdventure() {
    setError('');
    setLoading(true);
    try {
      await apiFetch('/hero/adventure', {
        method: 'POST',
        body: JSON.stringify({ activityType: selected }),
        token: token ?? undefined,
      });
      onStarted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start adventure');
    } finally {
      setLoading(false);
    }
  }

  if (activeJob) {
    const meta = activeJob.metadata as { activityType: string };
    const activity = ACTIVITIES[meta.activityType as keyof typeof ACTIVITIES];
    return (
      <div className="bg-gray-800 rounded-xl p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Adventure</h2>
        <p className="text-amber-400 font-medium">
          {activity?.name ?? meta.activityType} in progress…
        </p>
        <p className="text-sm text-gray-400">
          Returns in <CountdownTimer endsAt={activeJob.endsAt} onComplete={onComplete} />
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Send on Adventure</h2>

      <div className="grid grid-cols-1 gap-2">
        {Object.values(ACTIVITIES).map((act) => {
          const canAfford = hero.energy >= act.energyCost;
          return (
            <button
              key={act.id}
              onClick={() => setSelected(act.id)}
              className={`text-left rounded-lg border px-3 py-2 text-sm transition
                ${selected === act.id ? 'border-amber-500 bg-gray-700' : 'border-gray-700 hover:border-gray-600'}
                ${!canAfford ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <div className="flex justify-between">
                <span className="font-medium text-white">{act.name}</span>
                <span className="text-blue-300">⚡ {act.energyCost}</span>
              </div>
              <p className="text-gray-400 text-xs mt-0.5">{act.description}</p>
            </button>
          );
        })}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={startAdventure}
        disabled={loading || hero.energy < (ACTIVITIES[selected as keyof typeof ACTIVITIES]?.energyCost ?? 0)}
        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed
                   text-white font-semibold py-2 px-4 rounded-lg transition"
      >
        {loading ? 'Sending…' : 'Start Adventure'}
      </button>
    </div>
  );
}
