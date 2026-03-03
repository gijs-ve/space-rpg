'use client';

import React, { useState } from 'react';
import { BUILDINGS, CITY_BUILDING_SLOTS } from '@rpg/shared';
import type { CityBuilding, ResourceMap, Job } from '@rpg/shared';
import CountdownTimer from '@/components/ui/CountdownTimer';
import BuildingModal from './BuildingModal';

interface BuildingGridProps {
  buildings: CityBuilding[];
  resources: ResourceMap;
  activeJob: Job | null;
  cityId: string;
  onBuildComplete: () => void;
}

export default function BuildingGrid({ buildings, resources, activeJob, cityId, onBuildComplete }: BuildingGridProps) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const slots: Array<CityBuilding | null> = Array.from({ length: CITY_BUILDING_SLOTS }, (_, i) => {
    return buildings.find((b) => b.slotIndex === i) ?? null;
  });

  const constructingSlot = activeJob
    ? ((activeJob.metadata as { slot?: number })?.slot ?? null)
    : null;

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Buildings</h2>
        {activeJob && (
          <span className="text-xs text-amber-300">
            Building… <CountdownTimer endsAt={activeJob.endsAt} onComplete={onBuildComplete} />
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {slots.map((building, slot) => {
          const isConstructing = constructingSlot === slot;
          const def = building ? BUILDINGS[building.buildingId as keyof typeof BUILDINGS] : null;
          return (
            <button
              key={slot}
              onClick={() => setSelectedSlot(slot)}
              className={`rounded-lg border p-2 text-center text-xs transition min-h-[64px] flex flex-col items-center justify-center
                ${building ? 'border-gray-600 bg-gray-700 hover:border-amber-500' : 'border-gray-700 border-dashed hover:border-gray-500'}
                ${isConstructing ? 'border-amber-500 animate-pulse' : ''}`}
            >
              {building ? (
                <>
                  <span className="text-lg">{def?.icon ?? '🏠'}</span>
                  <span className="text-white truncate w-full text-center">{def?.name ?? building.buildingId}</span>
                  <span className="text-gray-400">Lv {building.level}</span>
                </>
              ) : (
                <span className="text-gray-600">+ Build</span>
              )}
              {isConstructing && <span className="text-amber-400 text-xs mt-0.5">🔨</span>}
            </button>
          );
        })}
      </div>

      {selectedSlot !== null && (
        <BuildingModal
          slot={selectedSlot}
          existing={slots[selectedSlot]}
          resources={resources}
          cityId={cityId}
          hasActiveJob={!!activeJob}
          onClose={() => setSelectedSlot(null)}
          onQueued={() => { setSelectedSlot(null); onBuildComplete(); }}
        />
      )}
    </div>
  );
}
