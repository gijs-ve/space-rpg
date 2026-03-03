import React from 'react';
import type { ResourceMap } from '@rpg/shared';

interface ResourceBarProps {
  resources: ResourceMap;
  production: ResourceMap;
  storageCap: ResourceMap;
}

const ICONS: Record<string, string> = {
  food: '🌾',
  wood: '🪵',
  stone: '🪨',
  iron: '⚙',
  gold: '💰',
};

export default function ResourceBar({ resources, production, storageCap }: ResourceBarProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Resources</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(resources).map(([key, amount]) => {
          const prod = production[key as keyof ResourceMap] ?? 0;
          const cap = typeof storageCap === 'object'
            ? (storageCap[key as keyof ResourceMap] ?? 1000)
            : storageCap;
          const pct = cap > 0 ? Math.min(100, (amount / cap) * 100) : 0;
          return (
            <div key={key} className="bg-gray-700 rounded-lg p-3 flex flex-col gap-1">
              <span className="text-lg">{ICONS[key] ?? '?'}</span>
              <span className="text-white font-semibold text-sm">{Math.floor(amount)}</span>
              <div className="w-full bg-gray-600 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-amber-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-gray-400 text-xs">+{prod.toFixed(1)}/hr</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
