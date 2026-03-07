'use client';

import React, { useState } from 'react';
import {
  ITEMS,
  ACTIVITIES,
  ITEM_RARITY_COLOR,
  ITEM_RARITY_BG,
  ITEM_CATEGORY_ICON,
  RESOURCE_LABELS,
} from '@rpg/shared';
import type { ActivityReport, ItemInstance, ItemId, ResourceType, ActivityType } from '@rpg/shared';
import { CELL_SIZE, HeldItem } from './types';

const ITEM_TILE = CELL_SIZE * 1.5; // ~63 px mini tile

interface ActivityReportsProps {
  reports:              ActivityReport[];
  heldItem:             HeldItem | null;
  onPickUpFromReport:   (item: ItemInstance, reportId: string) => void;
  onDismiss:            (reportId: string) => void;
}

export default function ActivityReports({
  reports,
  heldItem,
  onPickUpFromReport,
  onDismiss,
}: ActivityReportsProps) {
  const [confirmDismiss, setConfirmDismiss] = useState<string | null>(null);

  const pending = reports.filter((r) => !r.dismissed);
  if (pending.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-widest text-gray-600 font-semibold">
        Activity Reports
      </p>

      <div className="flex flex-col gap-2">
        {pending.map((report) => {
          const actDef    = ACTIVITIES[report.activityType as ActivityType];
          const resources = report.resources as Record<ResourceType, number> | null ?? {};
          const items     = report.items ?? [];
          const unclaimedItems = items.filter((it) => it.location === 'activity_report');

          const ago = (() => {
            const secs = Math.floor((Date.now() - new Date(report.completedAt).getTime()) / 1000);
            if (secs < 60) return `${secs}s ago`;
            const mins = Math.floor(secs / 60);
            if (mins < 60) return `${mins}m ago`;
            return `${Math.floor(mins / 60)}h ago`;
          })();

          return (
            <div
              key={report.id}
              className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 space-y-2"
            >
              {/* Header row */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-semibold text-white">
                    {actDef?.name ?? report.activityType}
                  </span>
                  <span className="ml-2 text-gray-600 text-xs">{ago}</span>
                  {/* Hero / base context */}
                  <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5">
                    {report.heroName && (
                      <span className="text-[10px] text-indigo-400">
                        ⚔ {report.heroName}
                      </span>
                    )}
                    {report.cityName && (
                      <span className="text-[10px] text-emerald-500">
                        🏰 {report.cityName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dismiss */}
                {confirmDismiss === report.id ? (
                  <div className="flex gap-1 items-center">
                    {unclaimedItems.length > 0 && (
                      <span className="text-red-400 text-xs">Lose {unclaimedItems.length} item{unclaimedItems.length !== 1 ? 's' : ''}?</span>
                    )}
                    <button
                      className="text-xs px-2 py-0.5 rounded bg-red-900/60 hover:bg-red-900 text-red-300 border border-red-900 transition active:scale-95"
                      onClick={() => { setConfirmDismiss(null); onDismiss(report.id); }}
                    >
                      Yes
                    </button>
                    <button
                      className="text-xs px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 transition active:scale-95"
                      onClick={() => setConfirmDismiss(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    className="text-xs text-gray-600 hover:text-gray-400 transition"
                    onClick={() => (unclaimedItems.length > 0 ? setConfirmDismiss(report.id) : onDismiss(report.id))}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Rewards summary */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {report.xpAwarded > 0 && (
                  <span className="text-amber-400 text-xs font-semibold">
                    +{report.xpAwarded.toLocaleString()} XP
                  </span>
                )}
                {Object.entries(resources).map(([resId, amt]) =>
                  (amt as number) > 0 ? (
                    <span key={resId} className="text-gray-300 text-xs">
                      +{(amt as number).toLocaleString()}{' '}
                      {RESOURCE_LABELS[resId as ResourceType] ?? resId}
                    </span>
                  ) : null,
                )}
              </div>

              {/* Item drops */}
              {unclaimedItems.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1.5 font-semibold">
                    Items — click to pick up
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {unclaimedItems.map((item) => {
                      const def        = ITEMS[item.itemDefId as ItemId];
                      if (!def) return null;
                      const rarityCol  = ITEM_RARITY_COLOR[def.rarity];
                      const rarityBg   = ITEM_RARITY_BG[def.rarity];
                      const isHeld     = heldItem?.instance.id === item.id;

                      return (
                        <div
                          key={item.id}
                          style={{
                            width:      ITEM_TILE,
                            height:     ITEM_TILE,
                            background: rarityBg,
                            border:     `1px solid ${isHeld ? '#22c55e' : rarityCol}`,
                            opacity:    isHeld ? 0.4 : 1,
                            cursor:     isHeld ? 'default' : 'pointer',
                          }}
                          className="rounded flex flex-col items-center justify-center gap-0.5 hover:brightness-110 active:scale-95 transition-all select-none"
                          title={`${def.name} — ${def.rarity}`}
                          onClick={() => {
                            if (!isHeld) onPickUpFromReport(item, report.id);
                          }}
                        >
                          <span className="text-lg leading-none">{ITEM_CATEGORY_ICON[def.category]}</span>
                          <span
                            className="text-[8px] font-semibold text-center px-0.5 leading-tight"
                            style={{ color: rarityCol }}
                          >
                            {def.name.split(' ').slice(0, 2).join(' ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {items.length > 0 && unclaimedItems.length === 0 && (
                <p className="text-xs text-gray-600 italic">All items claimed.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
