'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MapViewport from '@/components/map/MapViewport';
import { useSetFullBleed } from '@/context/header';

function MapInner() {
  useSetFullBleed();
  const params = useSearchParams();
  const initialX = params.get('x') ? Number(params.get('x')) : 0;
  const initialY = params.get('y') ? Number(params.get('y')) : 0;

  return (
    <div className="h-full w-full flex flex-col">
      <MapViewport initialX={initialX} initialY={initialY} />
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <MapInner />
    </Suspense>
  );
}
