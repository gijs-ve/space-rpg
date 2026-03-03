'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import type { CitiesResponse } from '@rpg/shared';

export default function CityIndexPage() {
  const router = useRouter();
  const { token } = useAuth();

  useEffect(() => {
    apiFetch<CitiesResponse>('/cities', { token: token ?? undefined })
      .then((res) => {
        if (res.cities.length > 0) {
          router.replace(`/city/${res.cities[0].id}`);
        }
      })
      .catch(() => router.replace('/hero'));
  }, [router, token]);

  return <p className="text-gray-400 animate-pulse">Loading cities…</p>;
}
