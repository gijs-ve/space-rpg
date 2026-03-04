'use client';

import React, { useState } from 'react';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { ACTIVITIES, RESOURCE_LABELS, SKILLS } from '@rpg/shared';
import type { Hero, Job, ResourceType } from '@rpg/shared';
import { ResourceIcon } from '@/components/ui/ResourceIcon';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';

interface AdventurePanelProps {
  hero: Hero;
  activeJob: Job | null;
  onStarted: () => void;
  onComplete: () => void;
}

const ACTIVITY_ICONS: Record<string, string> = {
  patrol:            '🛸',
  salvage_field:     '🔧',
  survey_derelict:   '🔭',
  recon_mission:     '🗺️',
  assault_outpost:   '⚔️',
  deep_space_survey: '🌌',
};

function fmtDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function AdventurePanel({ hero, activeJob, onStarted, onComplete }: AdventurePanelProps) {
  const { token } = useAuth();
  const [selected, setSelected] = useState<string>(Object.keys(ACTIVITIES)[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function startAdventure() {
    setError('');
    setLoading(true);
    try {
      await apiFetch('/hero/adventure', {
        method: 'POST',
        body: JSON.stringify({ activityType: selected }),
        token: token ?? undefined,
      });
      onStarted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start adventure');
    } finally {
      setLoading(false);
    }
  }

  if (activeJob) {
    const meta     = activeJob.metadata as { activityType: string };
    const activity = ACTIVITIES[meta.activityType as keyof typeof ACTIVITIES];
    return (
      <div className="bg-gray-800 rounded-xl p-5 h-full flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Adventure</h2>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
          <span className="text-5xl select-none">
            {ACTIVITY_ICONS[meta.activityType] ?? '🚀'}
          </span>
          <p className="text-amber-400 font-semibold text-lg">
            {activity?.name ?? meta.activityType}
          </p>
          <p className="text-gray-400 text-sm">Mission in progress…</p>
          <div className="bg-gray-700 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-widest">Returns in</p>
            <p className="text-amber-300 font-mono text-lg">
              <CountdownTimer endsAt={activeJob.endsAt} onComplete={onComplete} />
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectedActivity = ACTIVITIES[selected as keyof typeof ACTIVITIES];
  const canAffordSelected = hero.energy >= (selectedActivity?.energyCost ?? 0);
  const meetsLevelSelected = hero.level >= (selectedActivity?.heroLevelRequirement ?? 1);

  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        Send on Adventure
      </h2>

      {/* Activity grid */}
      <div className="grid grid-cols-3 gap-2">
        {Object.values(ACTIVITIES).map((act) => {
          const canAfford   = hero.energy >= act.energyCost;
          const meetsLevel  = hero.level  >= act.heroLevelRequirement;
          const isEnabled   = canAfford && meetsLevel;
          const isSelected  = selected === act.id;

          const resList   = Object.entries(act.rewards.resources);
          const skillList = Object.entries(act.rewards.skillXp) as [string, number][];

          return (
            <button
              key={act.id}
              onClick={() => isEnabled && setSelected(act.id)}
              disabled={!isEnabled}
              className={[
                'group relative text-left rounded-lg border px-3 py-2.5 transition-all',
                'flex flex-col gap-1.5',
                isSelected
                  ? 'border-amber-500 bg-amber-900/20'
                  : 'border-gray-700 hover:border-gray-500 bg-gray-900/40',
                !isEnabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {/* ── Name row ── */}
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base leading-none shrink-0">
                    {ACTIVITY_ICONS[act.id] ?? '🚀'}
                  </span>
                  <span className="font-semibold text-white text-xs leading-tight truncate">
                    {act.name}
                  </span>
                </div>
                <span className="text-blue-300 text-[10px] shrink-0 mt-0.5">
                  ⚡{act.energyCost}
                </span>
              </div>

              {/* ── Description ── */}
              <p className="text-gray-500 text-[10px] leading-tight line-clamp-2">
                {act.description}
              </p>

              {/* ── Requirements + duration ── */}
              <div className="flex items-center justify-between mt-auto text-[10px]">
                <span
                  className={meetsLevel ? 'text-teal-500' : 'text-red-500'}
                  title={meetsLevel ? 'Requirement met' : 'Level too low'}
                >
                  Lv.&nbsp;{act.heroLevelRequirement}
                  {!meetsLevel && ' required'}
                </span>
                <span className="text-gray-600">
                  ⏱&nbsp;{fmtDuration(act.durationRange[0])}–{fmtDuration(act.durationRange[1])}
                </span>
              </div>

              {/* ── Rewards hover overlay (floats below card, z-50) ── */}
              {isEnabled && (
                <div
                  className={[
                    'absolute top-full left-0 right-0 z-50 mt-1.5 px-3 py-2.5',
                    'rounded-lg border border-gray-600 bg-gray-900 shadow-xl',
                    'opacity-0 group-hover:opacity-100 pointer-events-none',
                    'transition-opacity duration-150',
                  ].join(' ')}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                    Rewards
                  </p>

                  {/* XP */}
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400 mb-1">
                    <span>✦</span>
                    <span>{act.rewards.xpRange[0]}–{act.rewards.xpRange[1]} XP</span>
                  </div>

                  {/* Resources */}
                  {resList.length > 0 && (
                    <div className="space-y-0.5 mb-1.5">
                      {resList.map(([res, range]) => (
                        <div key={res} className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-400 flex items-center gap-1">
                            <ResourceIcon type={res as ResourceType} size={12} />
                            <span>{RESOURCE_LABELS[res as ResourceType] ?? res}</span>
                          </span>
                          <span className="text-gray-300 tabular-nums">
                            {range[0]}–{range[1]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Skill XP */}
                  {skillList.length > 0 && (
                    <>
                      <div className="border-t border-gray-700 my-1.5" />
                      <div className="space-y-0.5">
                        {skillList.map(([skillId, xp]) => (
                          <div key={skillId} className="flex items-center justify-between text-[10px]">
                            <span className="text-purple-300">
                              {SKILLS[skillId as keyof typeof SKILLS]?.name ?? skillId}
                            </span>
                            <span className="text-purple-400 tabular-nums">+{xp}&nbsp;skill XP</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={startAdventure}
        disabled={loading || !canAffordSelected || !meetsLevelSelected}
        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed
                   text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
      >
        {loading ? 'Sending…' : `Launch — ${selectedActivity?.name ?? '…'}`}
      </button>
    </div>
  );
}
