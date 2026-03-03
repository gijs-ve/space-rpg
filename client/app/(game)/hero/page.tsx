'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { getSocket } from '@/lib/socket';
import ProgressBar from '@/components/ui/ProgressBar';
import EnergyBar from '@/components/hero/EnergyBar';
import SkillsPanel from '@/components/hero/SkillsPanel';
import AdventurePanel from '@/components/hero/AdventurePanel';
import { xpRequiredForLevel } from '@rpg/shared';
import type { HeroResponse } from '@rpg/shared';

export default function HeroPage() {
  const { token } = useAuth();
  const [data, setData] = useState<HeroResponse | null>(null);
  const [error, setError] = useState('');

  const fetchHero = useCallback(async () => {
    try {
      const res = await apiFetch<HeroResponse>('/hero', { token: token ?? undefined });
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load hero');
    }
  }, [token]);

  useEffect(() => { fetchHero(); }, [fetchHero]);

  // Refresh hero data on socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('adventure:complete', fetchHero);
    return () => { socket.off('adventure:complete', fetchHero); };
  }, [fetchHero]);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return <p className="text-gray-400 animate-pulse">Loading hero…</p>;

  const { hero, activeAdventure } = data;
  const level = hero.level;
  const xpForCurrentLevel = xpRequiredForLevel(level);
  const xpForNextLevel = xpRequiredForLevel(level + 1);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-amber-400">Your Hero</h1>
          <span className="text-gray-400 text-sm">Level {level}</span>
        </div>
        <ProgressBar
          value={hero.xp - xpForCurrentLevel}
          max={xpForNextLevel - xpForCurrentLevel}
          label={`XP (${hero.xp} / ${xpForNextLevel})`}
          colorClass="bg-amber-500"
        />
      </div>

      {/* Energy */}
      <EnergyBar hero={hero} onRegen={fetchHero} />

      {/* Adventure */}
      <AdventurePanel
        hero={hero}
        activeJob={activeAdventure ?? null}
        onStarted={fetchHero}
        onComplete={fetchHero}
      />

      {/* Skills */}
      <SkillsPanel hero={hero} />
    </div>
  );
}
