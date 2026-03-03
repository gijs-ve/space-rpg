'use client';

import React from 'react';

interface ZoomControlsProps {
  zoomIdx:   number;
  maxIdx:    number;
  onZoomIn:  () => void;
  onZoomOut: () => void;
}

const BTN =
  'flex items-center justify-center w-7 h-7 rounded ' +
  'bg-black/50 hover:bg-black/70 active:scale-95 disabled:opacity-30 disabled:cursor-default ' +
  'text-amber-400/80 hover:text-amber-300 text-sm font-bold ' +
  'border border-amber-900/40 transition select-none';

export default function ZoomControls({
  zoomIdx,
  maxIdx,
  onZoomIn,
  onZoomOut,
}: ZoomControlsProps) {
  return (
    <div
      className="absolute bottom-3 left-3 z-20 flex flex-col gap-0.5"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        className={BTN}
        disabled={zoomIdx >= maxIdx}
        onClick={onZoomIn}
        title="Zoom in"
      >
        +
      </button>

      {/* Level pips */}
      <div className="flex flex-col items-center gap-0.75 py-1">
        {Array.from({ length: maxIdx + 1 }, (_, i) => (
          <span
            key={i}
            className={`block rounded-full transition-all ${
              i === zoomIdx
                ? 'w-2 h-2 bg-amber-400/90'
                : 'w-1.5 h-1.5 bg-amber-900/50'
            }`}
          />
        ))}
      </div>

      <button
        className={BTN}
        disabled={zoomIdx <= 0}
        onClick={onZoomOut}
        title="Zoom out"
      >
        −
      </button>
    </div>
  );
}
