'use client';

import React from 'react';
import ProgressBar from '@/components/ui/ProgressBar';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { StatIcon } from '@/components/ui/ResourceIcon';
import { ENERGY_REGEN_INTERVAL_SECONDS } from '@rpg/shared';
import type { Hero } from '@rpg/shared';

interface EnergyBarProps {
  hero: Hero;
  onRegen?: () => void;
}

export default function EnergyBar({ hero, onRegen }: EnergyBarProps) {
  const maxEnergy = hero.maxEnergy;
  const isFull = hero.energy >= maxEnergy;

  // Time until next energy tick: ENERGY_REGEN_INTERVAL_SECONDS from last regen
  const lastRegen = new Date(hero.lastEnergyRegen);
  const nextRegen = new Date(lastRegen.getTime() + ENERGY_REGEN_INTERVAL_SECONDS * 1000);

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-blue-300 flex items-center gap-1.5"><StatIcon type="maxEnergy" size={14} /> Energy</span>
        <span className="text-sm text-gray-400">{hero.energy} / {maxEnergy}</span>
      </div>
      <ProgressBar value={hero.energy} max={maxEnergy} colorClass="bg-blue-500" />
      {!isFull && (
        <p className="text-xs text-gray-500">
          Next +1 in{' '}
          <CountdownTimer endsAt={nextRegen} onComplete={onRegen} />
        </p>
      )}
    </div>
  );
}
