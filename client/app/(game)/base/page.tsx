'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { useGameInventory } from '@/context/inventory';
import type { BasesResponse } from '@rpg/shared';

export default function BaseIndexPage() {
  const router = useRouter();
  const { token } = useAuth();
  const { heroHomeCityId, heroMetaLoaded } = useGameInventory();

  useEffect(() => {
    if (!token) return;
    apiFetch<BasesResponse>('/bases', { token: token ?? undefined })
      .then((res) => {
        if (res.cities.length > 0) {
          router.replace(`/base/${res.cities[0].id}`);
        }
        // else: no city yet — stay on this page and show the prompt
      })
      .catch(() => {});
  }, [router, token]);

  // Still waiting for hero meta to load
  if (!heroMetaLoaded) {
    return <p className="text-gray-400 animate-pulse p-8">Loading…</p>;
  }

  // If we know from context there's no home city, show the prompt
  if (heroHomeCityId === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <span className="text-5xl">🏗</span>
        <h2 className="text-lg font-semibold text-amber-300">No base yet</h2>
        <p className="text-gray-400 text-sm max-w-xs">
          Head to the map and click any tile to found your starting base.
        </p>
        <Link
          href="/map"
          className="mt-2 px-5 py-2 rounded bg-teal-800 hover:bg-teal-700 text-teal-100 text-sm font-semibold transition"
        >
          🗺 Go to Map
        </Link>
      </div>
    );
  }

  return <p className="text-gray-400 animate-pulse p-8">Loading base…</p>;
}
