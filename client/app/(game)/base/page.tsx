'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import type { BasesResponse } from '@rpg/shared';

export default function BaseIndexPage() {
  const router = useRouter();
  const { token } = useAuth();

  useEffect(() => {
    apiFetch<BasesResponse>('/bases', { token: token ?? undefined })
      .then((res) => {
        if (res.cities.length > 0) {
          router.replace(`/base/${res.cities[0].id}`);
        }
      })
      .catch(() => router.replace('/hero'));
  }, [router, token]);

  return <p className="text-gray-400 animate-pulse">Loading bases…</p>;
}
