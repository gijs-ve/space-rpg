'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth';

export default function Home() {
  const { token, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    if (token) {
      router.replace('/hero');
    } else {
      router.replace('/login');
    }
  }, [token, isLoaded, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400 animate-pulse">Loading…</p>
    </div>
  );
}
