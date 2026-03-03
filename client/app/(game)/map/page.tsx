import React from 'react';
import MapViewport from '@/components/map/MapViewport';

export default function MapPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-amber-400 tracking-wider uppercase">World Map</h1>
        <p className="text-xs text-gray-600 mt-0.5 tracking-wide">
          Arrow keys or buttons to pan the viewport.
        </p>
      </div>
      <MapViewport />
    </div>
  );
}
