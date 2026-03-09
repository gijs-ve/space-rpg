import React from 'react';
import { RESOURCE_TYPES, RESOURCE_LABELS } from '@rpg/shared';
import type { ResourceMap, ProductionBreakdown } from '@rpg/shared';
import { ResourceIcon } from '@/components/ui/ResourceIcon';

interface ResourceBarProps {
  resources:            ResourceMap;
  production:           ResourceMap;
  storageCap:           ResourceMap;
  productionBreakdown?: ProductionBreakdown;
}

export default function ResourceBar({ resources, production, storageCap, productionBreakdown }: ResourceBarProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Resources</h2>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {RESOURCE_TYPES.map((key) => {
          const amount = resources[key] ?? 0;
          const prod   = production[key] ?? 0;
          const cap    = storageCap[key] ?? 1000;
          const pct    = cap > 0 ? Math.min(100, (amount / cap) * 100) : 0;
          const bd     = productionBreakdown?.[key];
          const hasBonus = bd && (bd.itemBonusPct > 0 || bd.domainBonusPct > 0);
          return (
            <div key={key} className="relative group bg-gray-700 rounded-lg p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <ResourceIcon type={key} size={20} />
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
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs tabular-nums">
                  {prod > 0 ? `+${prod.toFixed(1)}` : prod < 0 ? prod.toFixed(1) : '0'}/hr
                </span>
                {hasBonus && (
                  <span className="text-[9px] text-blue-500 cursor-default" title="Hover for breakdown">ℹ</span>
                )}
              </div>

              {/* Production breakdown tooltip */}
              {bd && prod > 0 && (
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                                hidden group-hover:flex flex-col gap-1
                                w-48 bg-gray-900 border border-gray-700 rounded-lg p-2.5 shadow-xl text-xs">
                  <p className="text-gray-400 font-semibold uppercase tracking-widest text-[9px] mb-0.5">Rate breakdown</p>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400">Buildings</span>
                    <span className="text-amber-200 tabular-nums">+{bd.buildings.toFixed(0)}/hr</span>
                  </div>
                  {bd.itemBonusPct > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400">Item bonus</span>
                      <span className="text-blue-300 tabular-nums">+{bd.itemBonusPct}%</span>
                    </div>
                  )}
                  {bd.domainBonusPct > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400">Domain tiles</span>
                      <span className="text-green-300 tabular-nums">+{bd.domainBonusPct}%</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2 border-t border-gray-700 pt-1 mt-0.5 font-medium">
                    <span className="text-white">Total</span>
                    <span className="text-amber-400 tabular-nums">+{bd.total.toFixed(0)}/hr</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
