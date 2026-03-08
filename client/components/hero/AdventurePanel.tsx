'use client';

import React, { useState } from 'react';
import CountdownTimer from '@/components/ui/CountdownTimer';
import {
  ACTIVITIES,
  ACTIVITY_LIST,
  RESOURCE_LABELS,
  SKILLS,
  computeDamageRange,
} from '@rpg/shared';
import type { Hero, Job, ResourceType, ComputedHeroStats, SkillId } from '@rpg/shared';
import { ResourceIcon, SkillIcon } from '@/components/ui/ResourceIcon';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { useGameInventory } from '@/context/inventory';

interface AdventurePanelProps {
  hero: Hero;
  activeJob: Job | null;
  onStarted: () => void;
  onComplete: () => void;
  /** Computed hero stats (attack, defence, etc.) including item bonuses. */
  heroStats: ComputedHeroStats | null;
}

const ACTIVITY_ICONS: Record<string, string> = {
  // General
  patrol:              '🛸',
  scavenge_ruins:      '🔧',
  explore_ruins:       '🔭',
  scout_territory:     '🗺️',
  storm_outpost:       '⚔️',
  grand_campaign:      '🌌',
  // Combat
  dueling_ring:        '🥊',
  bandit_ambush:       '🗡️',
  enemy_raid:          '🔥',
  champions_trial:     '🏆',
  // Endurance
  forced_march:        '👣',
  desert_crossing:     '🌵',
  mountain_expedition: '🏔️',
  // Observation
  track_quarry:        '🦶',
  ancient_library:     '📚',
  forbidden_ruins:     '🏚️',
  // Navigation
  supply_run:          '📦',
  trade_route_survey:  '📜',
  diplomatic_mission:  '🤝',
  // Tactics
  war_games:           '♟️',
  siege_planning:      '🏰',
  guerrilla_campaign:  '🎯',
};

type TabId = SkillId | 'general';

const TABS: { id: TabId; label: string }[] = [
  { id: 'general',     label: 'Expeditions' },
  { id: 'combat',      label: SKILLS.combat.name },
  { id: 'endurance',   label: SKILLS.endurance.name },
  { id: 'observation', label: SKILLS.observation.name },
  { id: 'navigation',  label: SKILLS.navigation.name },
  { id: 'tactics',     label: SKILLS.tactics.name },
];

function fmtDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function AdventurePanel({ hero, activeJob, onStarted, onComplete, heroStats }: AdventurePanelProps) {
  const { token } = useAuth();
  const { heroItems } = useGameInventory();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [selected, setSelected] = useState<string>('patrol');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Items in hero's inventory (not equipped) for this hero
  const heroInventoryItems = heroItems.filter(
    (item) => item.heroId === hero.id && item.location === 'hero_inventory',
  );
  const inventoryCounts = heroInventoryItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.itemDefId] = (acc[item.itemDefId] ?? 0) + 1;
    return acc;
  }, {});

  const skillLevels = (hero.skillLevels ?? {}) as Record<SkillId, number>;

  function meetsSkillReqs(act: typeof ACTIVITY_LIST[number]): boolean {
    if (!act.skillRequirements) return true;
    return Object.entries(act.skillRequirements).every(
      ([sid, req]) => (skillLevels[sid as SkillId] ?? 0) >= (req ?? 0),
    );
  }

  function meetsItemReqs(act: typeof ACTIVITY_LIST[number]): boolean {
    if (!act.itemRequirements?.length) return true;
    return act.itemRequirements.every(
      (req) => (inventoryCounts[req.itemId] ?? 0) >= (req.quantity ?? 1),
    );
  }

  async function startAdventure() {
    setError('');
    setLoading(true);
    try {
      await apiFetch(`/hero/${hero.id}/adventure`, {
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

  // ── Active adventure display ──────────────────────────────────────────────
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

  // ── Tab-filtered activity list ────────────────────────────────────────────
  const tabActivities = ACTIVITY_LIST.filter((a) => a.skillTab === activeTab);

  const selectedActivity  = ACTIVITIES[selected as keyof typeof ACTIVITIES];
  const canAffordSelected = hero.energy >= (selectedActivity?.energyCost ?? 0);
  const meetsLvlSelected  = hero.level  >= (selectedActivity?.heroLevelRequirement ?? 1);
  const meetsSkillSel     = selectedActivity ? meetsSkillReqs(selectedActivity) : true;
  const meetsItemSel      = selectedActivity ? meetsItemReqs(selectedActivity) : true;
  const canLaunch         = canAffordSelected && meetsLvlSelected && meetsSkillSel && meetsItemSel;

  // If the selected activity is no longer on the visible tab, deselect
  const selectedOnThisTab = tabActivities.some((a) => a.id === selected);

  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        Send on Adventure
      </h2>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1">
        {TABS.map((tab) => {
          const unlocked = ACTIVITY_LIST.filter(
            (a) => a.skillTab === tab.id && hero.level >= a.heroLevelRequirement && meetsSkillReqs(a),
          ).length;
          const total = ACTIVITY_LIST.filter((a) => a.skillTab === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'px-2.5 py-1 rounded-md text-[11px] font-medium transition border',
                activeTab === tab.id
                  ? 'bg-amber-700 border-amber-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600 hover:text-gray-200',
              ].join(' ')}
            >
              {tab.label}
              <span className={`ml-1 text-[9px] ${unlocked === total ? 'text-teal-400' : 'text-gray-500'}`}>
                {unlocked}/{total}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Activity grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {tabActivities.map((act) => {
          const canAfford   = hero.energy >= act.energyCost;
          const meetsLevel  = hero.level  >= act.heroLevelRequirement;
          const meetsSkills = meetsSkillReqs(act);
          const meetsItems  = meetsItemReqs(act);
          const isEnabled   = canAfford && meetsLevel && meetsSkills && meetsItems;
          const isSelected  = selected === act.id && selectedOnThisTab;

          const resList    = Object.entries(act.rewards.resources);
          const skillList  = Object.entries(act.rewards.skillXp) as [SkillId, number][];
          const skillReqs  = Object.entries(act.skillRequirements ?? {}) as [SkillId, number][];

          const imageSrc = `/images/adventures/${act.id}.png`;

          return (
            <button
              key={act.id}
              onClick={() => setSelected(act.id)}
              disabled={!isEnabled}
              className={[
                'group relative text-left rounded-lg border transition-all',
                'flex flex-col aspect-square',
                isSelected && isEnabled
                  ? 'border-amber-500 bg-amber-900/20'
                  : isEnabled
                    ? 'border-gray-700 hover:border-gray-500 bg-gray-900/40'
                    : 'border-gray-700 bg-gray-900/40',
                !isEnabled ? 'cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {/* ── Card content — dims when locked, overflow clipped here so tooltip can escape ── */}
              <div className={['flex flex-col flex-1 overflow-hidden rounded-[7px]', !isEnabled ? 'opacity-45' : ''].join(' ')}>

                {/* ── Title bar ── */}
                <div className="px-2 pt-1.5 pb-1 bg-gray-950 shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0 mb-1">
                    <span className="text-xs leading-none shrink-0">
                      {ACTIVITY_ICONS[act.id] ?? '🚀'}
                    </span>
                    <span className="font-semibold text-white text-[10px] leading-tight truncate">
                      {act.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-gray-500">⏱ {fmtDuration(act.durationRange[0])}–{fmtDuration(act.durationRange[1])}</span>
                    <span className="text-blue-400">⚡{act.energyCost}</span>
                  </div>
                </div>

                {/* ── Image (fills remaining height) with requirements overlaid at bottom ── */}
                <div className="relative flex-1 bg-gray-900/60">
                  <img
                    src={imageSrc}
                    alt={act.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                  {/* Placeholder behind the image */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-3xl opacity-20">{ACTIVITY_ICONS[act.id] ?? '🚀'}</span>
                  </div>
                </div>
              </div>

              {/* ── Hover overlay ── */}
              <div
                className={[
                  'absolute top-full left-0 right-0 z-50 mt-1.5 px-3 py-2.5',
                  'rounded-lg border border-gray-600 bg-gray-900 shadow-xl',
                  'opacity-0 group-hover:opacity-100 pointer-events-none',
                  'transition-opacity duration-150',
                ].join(' ')}
              >
                {/* Description */}
                <p className="text-gray-400 text-[10px] leading-snug mb-1.5">
                  {act.description}
                </p>

                {/* Requirements */}
                {(act.heroLevelRequirement > 1 || skillReqs.length > 0 || (act.itemRequirements ?? []).length > 0) && (
                  <>
                    <div className="border-t border-gray-700 my-1.5" />
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                      Requirements
                    </p>
                    <div className="space-y-0.5 mb-0.5">
                      {act.heroLevelRequirement > 1 && (
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={meetsLevel ? 'text-teal-400' : 'text-red-400'}>Hero level</span>
                          <span className={`tabular-nums ${meetsLevel ? 'text-teal-300' : 'text-red-300'}`}>Lv.&nbsp;{act.heroLevelRequirement}</span>
                        </div>
                      )}
                      {skillReqs.map(([sid, reqLvl]) => {
                        const heroLvl = skillLevels[sid] ?? 0;
                        const met     = heroLvl >= reqLvl;
                        return (
                          <div key={sid} className="flex items-center justify-between text-[10px]">
                            <span className={`flex items-center gap-1 ${met ? 'text-teal-400' : 'text-red-400'}`}>
                              <SkillIcon skill={sid} size={11} showTooltip={false} />
                              {SKILLS[sid]?.name ?? sid}
                            </span>
                            <span className={`tabular-nums ${met ? 'text-teal-300' : 'text-red-300'}`}>
                              Lv.&nbsp;{reqLvl}{!met && ` (${heroLvl}/${reqLvl})`}
                            </span>
                          </div>
                        );
                      })}
                      {(act.itemRequirements ?? []).map((req) => {
                        const have = inventoryCounts[req.itemId] ?? 0;
                        const need = req.quantity ?? 1;
                        const met  = have >= need;
                        return (
                          <div key={req.itemId} className="flex items-center justify-between text-[10px]">
                            <span className={`flex items-center gap-1 ${met ? 'text-teal-400' : 'text-red-400'}`}>
                              🎒&nbsp;{req.itemId.replace(/_/g, '\u00a0')}
                            </span>
                            <span className={`tabular-nums ${met ? 'text-teal-300' : 'text-red-300'}`}>
                              {need}×{!met && ` (have ${have})`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Rewards */}
                <div className="border-t border-gray-700 my-1.5" />
                <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Rewards
                </p>

                {/* Hero XP */}
                <div className="flex items-center justify-between text-[10px] mb-0.5">
                  <span className="text-amber-300">Hero</span>
                  <span className="text-amber-400 tabular-nums">+{act.rewards.xpRange[0]}–{act.rewards.xpRange[1]}&nbsp;XP</span>
                </div>

                {/* Skill XP */}
                {skillList.length > 0 && (
                  <div className="space-y-0.5 mb-0.5">
                    {skillList.map(([skillId, xp]) => (
                      <div key={skillId} className="flex items-center justify-between text-[10px]">
                        <span className="text-purple-300 flex items-center gap-1">
                          <SkillIcon skill={skillId} size={11} showTooltip={false} />
                          {SKILLS[skillId]?.name ?? skillId}
                        </span>
                        <span className="text-purple-400 tabular-nums">+{xp}&nbsp;XP</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Resources */}
                {resList.length > 0 && (
                  <div className="space-y-0.5 mt-0.5">
                    {resList.map(([res, range]) => (
                      <div key={res} className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-400 flex items-center gap-1">
                          <ResourceIcon type={res as ResourceType} size={12} />
                          <span>{RESOURCE_LABELS[res as ResourceType] ?? res}</span>
                        </span>
                        <span className="text-gray-300 tabular-nums">
                          {(range as [number, number])[0]}–{(range as [number, number])[1]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Item consumed notice */}
                {(act.itemRequirements ?? []).length > 0 && (
                  <>
                    <div className="border-t border-gray-700 my-1.5" />
                    {(act.itemRequirements ?? []).map((req) => (
                      <div key={req.itemId} className="flex items-center gap-1 text-[10px] text-orange-400">
                        <span>🔥</span>
                        <span>Consumes {req.quantity ?? 1}×&nbsp;{req.itemId.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </>
                )}

                {/* Damage */}
                {(() => {
                  const defense = heroStats?.defense ?? 5;
                  const attack  = heroStats?.attack  ?? 10;
                  const pctTaken = Math.round(100 * 100 / (100 + defense + attack * 0.3));
                  const [rawMin, rawMax] = act.baseDamageRange;
                  const [dmgMin, dmgMax] = computeDamageRange(act.baseDamageRange, defense, attack);
                  const rawStr     = rawMin === rawMax ? `${rawMin}` : `${rawMin}–${rawMax}`;
                  const reducedStr = dmgMin === dmgMax ? `${dmgMin}` : `${dmgMin}–${dmgMax}`;
                  return (
                    <>
                      <div className="border-t border-gray-700 my-1.5" />
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500 mb-1">
                        Damage taken
                      </p>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-500">Raw</span>
                        <span className="text-gray-400 tabular-nums">{rawStr} HP</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] mt-0.5">
                        <span className="text-gray-500">−&nbsp;{100 - pctTaken}% reduction</span>
                        <span className="text-gray-600 tabular-nums text-[9px]">
                          DEF&nbsp;{defense} · ATK&nbsp;{attack}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] mt-0.5 font-medium">
                        <span className="text-red-400">= Taken</span>
                        <span className={
                          dmgMax === 0 ? 'text-green-400' : dmgMax <= 10 ? 'text-yellow-400' : 'text-red-400'
                        }>
                          {reducedStr} HP
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </button>
          );
        })}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={startAdventure}
        disabled={loading || !canLaunch || !selectedOnThisTab}
        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed
                   text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
      >
        {loading
          ? 'Sending…'
          : !selectedOnThisTab
            ? 'Select a mission'
            : `Launch — ${selectedActivity?.name ?? '…'}`}
      </button>
    </div>
  );
}

