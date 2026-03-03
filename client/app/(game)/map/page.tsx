'use client';

import React from 'react';
import MapViewport from '@/components/map/MapViewport';
import { useSetFullBleed } from '@/context/header';

export default function MapPage() {
  useSetFullBleed();

  return (
    <div className="h-full w-full flex flex-col">
      <MapViewport />
    </div>
  );
}
