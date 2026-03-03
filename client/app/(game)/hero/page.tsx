'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { getSocket } from '@/lib/socket';
import ProgressBar from '@/components/ui/ProgressBar';
import CountdownTimer from '@/components/ui/CountdownTimer';
import AdventurePanel from '@/components/hero/AdventurePanel';
import SkillsPanel from '@/components/hero/SkillsPanel';
import { useSetHeroHeader } from '@/context/header';
import { xpRequiredForLevel, BASE_MAX_ENERGY, ENERGY_REGEN_INTERVAL_SECONDS } from '@rpg/shared';
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

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('adventure:complete', fetchHero);
    return () => { socket.off('adventure:complete', fetchHero); };
  }, [fetchHero]);

  const hero = data?.hero ?? null;
  const level = hero?.level ?? 1;
  const xpForCurrentLevel = hero ? xpRequiredForLevel(level)     : 0;
  const xpForNextLevel    = hero ? xpRequiredForLevel(level + 1) : 100;

  // Push hero data up to the header bar
  useSetHeroHeader(hero ? { hero, xpForCurrentLevel, xpForNextLevel } : null);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data || !hero) return <p className="text-gray-400 animate-pulse">Loading hero…</p>;

  const { activeAdventure } = data;
  const maxEnergy  = BASE_MAX_ENERGY;
  const isFull     = hero.energy >= maxEnergy;
  const nextRegen  = new Date(
    new Date(hero.lastEnergyRegen).getTime() + ENERGY_REGEN_INTERVAL_SECONDS * 1000,
  );

  return (
    <div className="w-full space-y-4">

      {/* ── Top row: hero stats left | adventure panel right ─────────────── */}
      <div className="grid grid-cols-[260px_1fr] gap-4 items-start">

        {/* Left – hero stats card */}
        <div className="bg-gray-800 rounded-xl p-5 space-y-5">
          {/* Avatar + rank */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-700 border-2 border-amber-700/50 flex items-center justify-center text-3xl select-none shrink-0">
              🚀
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Commander</p>
              <p className="text-amber-400 font-bold text-xl leading-tight">Level {level}</p>
            </div>
          </div>

          {/* XP */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span className="uppercase tracking-wider text-[10px]">Experience</span>
              <span className="tabular-nums">
                {hero.xp - xpForCurrentLevel} / {xpForNextLevel - xpForCurrentLevel}
              </span>
            </div>
            <ProgressBar
              value={hero.xp - xpForCurrentLevel}
              max={xpForNextLevel - xpForCurrentLevel}
              colorClass="bg-amber-500"
            />
          </div>

          {/* Energy */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-blue-300 font-medium uppercase tracking-wider text-[10px]">⚡ Energy</span>
              <span className="text-gray-400 tabular-nums">{hero.energy} / {maxEnergy}</span>
            </div>
            <ProgressBar value={hero.energy} max={maxEnergy} colorClass="bg-blue-500" />
            {!isFull && (
              <p className="text-[10px] text-gray-600 mt-1.5">
                Next +1 in <CountdownTimer endsAt={nextRegen} onComplete={fetchHero} />
              </p>
            )}
          </div>
        </div>

        {/* Right – adventure panel */}
        <AdventurePanel
          hero={hero}
          activeJob={activeAdventure ?? null}
          onStarted={fetchHero}
          onComplete={fetchHero}
        />
      </div>

      {/* ── Bottom row: skills ───────────────────────────────────────────── */}
      <SkillsPanel hero={hero} />
    </div>
  );
}
