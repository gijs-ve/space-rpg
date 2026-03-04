'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { getSocket } from '@/lib/socket';
import ResourceBar from '@/components/base/ResourceBar';
import BuildingGrid from '@/components/base/BuildingGrid';
import TroopsPanel from '@/components/base/TroopsPanel';
import ArmoryPanel from '@/components/inventory/ArmoryPanel';
import { useGameInventory } from '@/context/inventory';
import type { BaseDetailResponse } from '@rpg/shared';
import { useSetBaseHeader } from '@/context/header';

const TABS = ['Resources', 'Buildings', 'Troops', 'Inventory'] as const;
type Tab = typeof TABS[number];

export default function BasePage() {
  const params = useParams<{ id: string }>();
  const cityId = params.id;

  const [activeTab, setActiveTab] = useState<Tab>('Buildings');
  const { token } = useAuth();
  const { baseItems, armoryGridSizes, fetchHeroItems } = useGameInventory();
  const [data, setData] = useState<BaseDetailResponse | null>(null);
  const [error, setError] = useState('');

  const fetchCity = useCallback(async () => {
    try {
      const res = await apiFetch<BaseDetailResponse>(`/bases/${cityId}`, { token: token ?? undefined });
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load base');
    }
  }, [cityId, token]);

  /** Refresh both base info and item data (armory) */
  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchCity(), fetchHeroItems()]);
  }, [fetchCity, fetchHeroItems]);

  useEffect(() => { fetchCity(); }, [fetchCity]);

  // Real-time updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('construction:complete', fetchCity);
    socket.on('training:complete', fetchCity);
    socket.on('resource:tick', fetchCity);
    return () => {
      socket.off('construction:complete', fetchCity);
      socket.off('training:complete', fetchCity);
      socket.off('resource:tick', fetchCity);
    };
  }, [fetchCity]);

  // Push live resource data to the header (null until data loaded)
  useSetBaseHeader(
    data
      ? {
          baseName: data.city.name,
          resources: data.city.resources,
          production: data.city.productionRates,
          storageCap: data.city.storageCap,
        }
      : null,
  );

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return <p className="text-gray-400 animate-pulse">Loading base…</p>;

  const { city, activeJobs } = data;
  const constructionJob = activeJobs.find((j) => j.type === 'construction') ?? null;
  const trainingJobs    = activeJobs.filter((j) => j.type === 'training');

  return (
    <div className="w-full space-y-5">
      {/* ── Base name ───────────────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h1 className="text-2xl font-bold text-amber-400">{city.name}</h1>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-xl">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab
                ? 'bg-gray-700 text-white shadow'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      {activeTab === 'Resources' && (
        <ResourceBar
          resources={city.resources}
          production={city.productionRates}
          storageCap={city.storageCap}
        />
      )}

      {activeTab === 'Buildings' && (
        <BuildingGrid
          buildings={city.buildings}
          resources={city.resources}
          activeJob={constructionJob ?? null}
          cityId={cityId}
          onBuildComplete={fetchCity}
        />
      )}

      {activeTab === 'Troops' && (
        <TroopsPanel
          troops={city.troops}
          resources={city.resources}
          buildings={city.buildings}
          cityId={cityId}
          trainingJobs={trainingJobs}
          onRefresh={fetchCity}
        />
      )}

      {activeTab === 'Inventory' && (
        armoryGridSizes.length === 0 ? (
          <ArmoryPanel
            armoryIndex={0}
            armoryGridSize={{ cols: 0, rows: 0 }}
            armoryItems={[]}
            token={token}
            onRefresh={handleRefresh}
          />
        ) : (
          <div className="space-y-4">
            {armoryGridSizes.map(({ armoryIndex, cols, rows }) => (
              <ArmoryPanel
                key={armoryIndex}
                armoryIndex={armoryIndex}
                armoryGridSize={{ cols, rows }}
                armoryItems={baseItems.filter(
                  (i) => i.location === 'base_armory' &&
                         (i.buildingSlotIndex === armoryIndex ||
                          (armoryIndex === 0 && i.buildingSlotIndex === null)),
                )}
                token={token}
                onRefresh={handleRefresh}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
