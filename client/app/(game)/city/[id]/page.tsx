'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { getSocket } from '@/lib/socket';
import ResourceBar from '@/components/city/ResourceBar';
import BuildingGrid from '@/components/city/BuildingGrid';
import TroopsPanel from '@/components/city/TroopsPanel';
import type { CityDetailResponse } from '@rpg/shared';

export default function CityPage() {
  const params = useParams<{ id: string }>();
  const cityId = params.id;

  const { token } = useAuth();
  const [data, setData] = useState<CityDetailResponse | null>(null);
  const [error, setError] = useState('');

  const fetchCity = useCallback(async () => {
    try {
      const res = await apiFetch<CityDetailResponse>(`/cities/${cityId}`, { token: token ?? undefined });
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load city');
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

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return <p className="text-gray-400 animate-pulse">Loading city…</p>;

  const { city, activeJobs } = data;
  const constructionJob = activeJobs.find((j) => j.type === 'construction') ?? null;
  const trainingJob = activeJobs.find((j) => j.type === 'training') ?? null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
