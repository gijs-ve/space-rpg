import React from 'react';
import { RESOURCE_TYPES, RESOURCE_ICONS, RESOURCE_LABELS } from '@rpg/shared';
import type { ResourceMap } from '@rpg/shared';

interface ResourceBarProps {
  resources: ResourceMap;
  production: ResourceMap;
  storageCap: ResourceMap;
}

export default function ResourceBar({ resources, production, storageCap }: ResourceBarProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Resources</h2>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {RESOURCE_TYPES.map((key) => {
          const amount = resources[key] ?? 0;
          const prod   = production[key] ?? 0;
          const cap    = storageCap[key] ?? 1000;
          const pct    = cap > 0 ? Math.min(100, (amount / cap) * 100) : 0;
          return (
            <div key={key} className="bg-gray-700 rounded-lg p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-lg leading-none">{RESOURCE_ICONS[key]}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wide truncate ml-1">
                  {RESOURCE_LABELS[key]}
                </span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-white font-semibold text-sm tabular-nums">
                  {Math.floor(amount).toLocaleString()}
                </span>
                <span className="text-gray-500 text-[10px] tabular-nums">
                  /{cap.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-amber-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-gray-400 text-xs tabular-nums">
                {prod > 0 ? `+${prod.toFixed(1)}` : prod < 0 ? prod.toFixed(1) : '0'}/hr
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
