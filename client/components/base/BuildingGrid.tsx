'use client';

import React, { useState } from 'react';
import { BUILDINGS, CITY_BUILDING_SLOTS } from '@rpg/shared';
import type { CityBuilding, ConstructionJobMeta, ResourceMap, Job } from '@rpg/shared';
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

  const constructingMeta = activeJob?.type === 'construction'
    ? (activeJob.metadata as ConstructionJobMeta)
    : null;
  const constructingSlot = constructingMeta?.slotIndex ?? null;

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Buildings</h2>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {slots.map((building, slot) => {
          const isConstructing = constructingSlot === slot;
          const def = building ? BUILDINGS[building.buildingId as keyof typeof BUILDINGS] : null;

          // ── Constructing slot ──────────────────────────────────────────────
          if (isConstructing && constructingMeta) {
            const constructDef = BUILDINGS[constructingMeta.buildingId as keyof typeof BUILDINGS];
            const isUpgrade = !!building;
            const tooltipText = isUpgrade
              ? `Upgrading ${constructDef?.name ?? constructingMeta.buildingId} → Lv ${constructingMeta.targetLevel}`
              : `Constructing ${constructDef?.name ?? constructingMeta.buildingId} (Lv 1)`;

            return (
              <div
                key={slot}
                className="relative group rounded-lg border-2 border-amber-500 bg-gray-700/50 p-2 text-center text-xs min-h-[64px] flex flex-col items-center justify-center cursor-default animate-pulse [animation-duration:2s]"
              >

                <span className="text-lg opacity-70">{constructDef?.icon ?? '🏗'}</span>
                <span className="text-amber-300 text-[10px] truncate w-full text-center leading-tight mt-0.5">
                  {isUpgrade ? `↑ ${def?.name ?? constructDef?.name}` : (constructDef?.name ?? 'Building')}
                </span>
                <span className="text-[9px] text-amber-500 leading-tight">
                  {isUpgrade ? `→ Lv ${constructingMeta.targetLevel}` : 'Lv 1'}
                </span>
                <span className="text-[9px] text-amber-300 tabular-nums mt-0.5">
                  <CountdownTimer endsAt={activeJob!.endsAt} onComplete={onBuildComplete} />
                </span>

                {/* Hover tooltip */}
                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 w-max max-w-[180px] bg-gray-900 border border-amber-700/60 rounded-md px-2.5 py-1.5 text-[10px] leading-snug text-gray-200 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
                  <span className="text-amber-300 font-semibold block mb-0.5">🔨 {isUpgrade ? 'Upgrading' : 'Constructing'}</span>
                  {tooltipText}
                </div>
              </div>
            );
          }

          // ── Normal / empty slot ────────────────────────────────────────────
          return (
            <button
              key={slot}
              onClick={() => setSelectedSlot(slot)}
              className={`rounded-lg border p-2 text-center text-xs transition min-h-[64px] flex flex-col items-center justify-center
                ${building ? 'border-gray-600 bg-gray-700 hover:border-amber-500' : 'border-gray-700 border-dashed hover:border-gray-500'}`}
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
            </button>
          );
        })}
      </div>

      {selectedSlot !== null && (
        <BuildingModal
          slot={selectedSlot}
          existing={slots[selectedSlot]}
          allBuildings={buildings}
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
