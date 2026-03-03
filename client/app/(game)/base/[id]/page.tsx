'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { getSocket } from '@/lib/socket';
import ResourceBar from '@/components/base/ResourceBar';
import BuildingGrid from '@/components/base/BuildingGrid';
import TroopsPanel from '@/components/base/TroopsPanel';
import type { BaseDetailResponse } from '@rpg/shared';
import { useSetBaseHeader } from '@/context/header';

export default function BasePage() {
  const params = useParams<{ id: string }>();
  const cityId = params.id;

  const { token } = useAuth();
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
  const trainingJob = activeJobs.find((j) => j.type === 'training') ?? null;

  return (
    <div className="w-full space-y-5">
      <div className="bg-gray-800 rounded-xl p-5">
        <h1 className="text-2xl font-bold text-amber-400">{city.name}</h1>
        <p className="text-gray-400 text-sm mt-1">
          Storage cap: {Object.values(city.storageCap)[0] ?? 1000}
        </p>
      </div>

      <ResourceBar
        resources={city.resources}
        production={city.productionRates}
        storageCap={city.storageCap}
      />

      <BuildingGrid
        buildings={city.buildings}
        resources={city.resources}
        activeJob={constructionJob ?? null}
        cityId={cityId}
        onBuildComplete={fetchCity}
      />

      <TroopsPanel
        troops={city.troops}
        resources={city.resources}
        cityId={cityId}
        activeJob={trainingJob ?? null}
        onTrained={fetchCity}
      />
    </div>
  );
}
