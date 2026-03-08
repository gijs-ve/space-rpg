'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { getSocket } from '@/lib/socket';
import ProgressBar from '@/components/ui/ProgressBar';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { StatIcon, SkillIcon } from '@/components/ui/ResourceIcon';
import AdventurePanel from '@/components/hero/AdventurePanel';
import InventoryGrid from '@/components/inventory/InventoryGrid';
import EquipmentSlots from '@/components/inventory/EquipmentSlots';
import ItemInspectModal from '@/components/inventory/ItemInspectModal';
import MoveToBaseModal from '@/components/inventory/MoveToBaseModal';
import HeldItemHUD from '@/components/inventory/HeldItemHUD';
import { useSetHeroHeader } from '@/context/header';
import { useGameInventory } from '@/context/inventory';
import {
  xpRequiredForLevel,
  REGEN_TICK_INTERVAL_SECONDS,
  ENERGY_HEALTH_PER_LEVEL,
  BASE_ENERGY_REGEN,
  BASE_HEALTH_REGEN,
  ITEMS,
  HERO_INVENTORY_COLS,
  HERO_INVENTORY_ROWS,
  computeHeroStats,
  sumHeroItemBonuses,
  SKILLS,
  BASE_MAX_ENERGY,
  BASE_MAX_HEALTH,
} from '@rpg/shared';
import type {
  HeroEquipSlot,
  ItemId,
  ItemInstance,
  Hero,
  Job,
  SkillId,
} from '@rpg/shared';

// Multi-hero response from GET /hero
interface HeroEntry {
  hero:            Hero;
  activeAdventure: Job | null;
  homeCityName:    string | null;
}
interface MultiHeroData {
  heroes:              HeroEntry[];
  totalLevel:          number;
  nextHeroUnlockLevel: number;
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HeroPage() {
  const { token } = useAuth();

  // ── Hero data ──────────────────────────────────────────────────────────────
  const [data,  setData]  = useState<MultiHeroData | null>(null);
  const [error, setError] = useState('');
  const [selectedHeroId,  setSelectedHeroId]  = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createHeroName,  setCreateHeroName]  = useState('');
  const [createHeroError, setCreateHeroError] = useState('');
  const [creating,        setCreating]        = useState(false);

  // ── Shared inventory context ────────────────────────────────────────────────
  const {
    heldItem, setHeldItem, heroItems, fetchHeroItems, notifyReportRefresh,
    heroHomeCityId, heroHomeCityName, baseItems, armoryGridSizes, refreshHeroMeta,
  } = useGameInventory();

  const [inspectItem,     setInspectItem]     = useState<ItemInstance | null>(null);
  const [moveToBaseItem,  setMoveToBaseItem]  = useState<ItemInstance | null>(null);
  /** Optimistic grid-position overrides while an API call is in flight */
  const [itemPatch, setItemPatch] = useState<Record<string, Partial<ItemInstance>> | null>(null);

  // ── Derive selected hero (must come before any useMemo that references hero) ──
  const selectedEntry = data?.heroes.find((e) => e.hero.id === selectedHeroId) ?? data?.heroes[0] ?? null;
  const hero = selectedEntry?.hero ?? null;

  // ── Fetchers ───────────────────────────────────────────────────────────────

  const fetchHero = useCallback(async () => {
    try {
      const res = await apiFetch<MultiHeroData>('/hero', { token: token ?? undefined });
      setData(res);
      // Auto-select first hero if none selected or selection is stale
      setSelectedHeroId((prev) => {
        const ids = res.heroes.map((e) => e.hero.id);
        if (prev && ids.includes(prev)) return prev;
        return ids[0] ?? null;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load hero');
    }
  }, [token]);

  // ── Initial load + socket ──────────────────────────────────────────────────

  useEffect(() => {
    fetchHero();
  }, [fetchHero]);

  // Refresh both hero data and context adventure state on completion
  const handleAdventureComplete = useCallback(() => {
    fetchHero();
    refreshHeroMeta();
  }, [fetchHero, refreshHeroMeta]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('adventure:complete', handleAdventureComplete);
    return () => { socket.off('adventure:complete', handleAdventureComplete); };
  }, [handleAdventureComplete]);

  // ── Keyboard: R = rotate held (Escape is handled globally in context) ──────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && heldItem) {
        const def = ITEMS[heldItem.instance.itemDefId as ItemId];
        // Square items cannot be rotated
        if (def && def.width === def.height) return;
        setHeldItem({
          ...heldItem,
          rotated:         !heldItem.rotated,
          effectiveWidth:  heldItem.effectiveHeight,
          effectiveHeight: heldItem.effectiveWidth,
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [heldItem]);

  // ── Derived inventory slices ───────────────────────────────────────────────

  const equippedItems = useMemo(() => {
    const map: Partial<Record<HeroEquipSlot, ItemInstance>> = {};
    heroItems
      .filter((i) => i.location === 'hero_equipped' && i.equipSlot && i.heroId === hero?.id)
      .forEach((i) => { map[i.equipSlot!] = i; });
    return map;
  }, [heroItems, hero?.id]);

  const inventoryItems = useMemo(
    () => heroItems.filter((i) => i.location === 'hero_inventory' && i.heroId === hero?.id),
    [heroItems, hero?.id],
  );

  const clientItemBonuses = useMemo(
    () => sumHeroItemBonuses(heroItems.filter((i) => i.heroId === hero?.id)),
    [heroItems, hero?.id],
  );

  /** Apply any in-flight optimistic position overrides */
  const displayInventoryItems = useMemo(() => {
    if (!itemPatch) return inventoryItems;
    return inventoryItems.map((i) => {
      const patch = itemPatch[i.id];
      return patch ? { ...i, ...patch } : i;
    });
  }, [inventoryItems, itemPatch]);

  const heroStats = useMemo(
    () => (hero ? computeHeroStats(hero.skillLevels, clientItemBonuses, hero.level) : null),
    [hero, clientItemBonuses],
  );

  // ── Pick up from equipment slot (start dragging) ──────────────────────────

  const pickUpFromEquipped = useCallback((item: ItemInstance) => {
    const def = ITEMS[item.itemDefId as ItemId];
    if (!def) return;
    setHeldItem({
      instance:        item,
      effectiveWidth:  def.width,
      effectiveHeight: def.height,
      rotated:         false,
      source:          'hero_equipped',
    });
  }, []);

  // ── Held-item helpers ──────────────────────────────────────────────────────

  const pickUpFromInventory = useCallback((item: ItemInstance) => {
    const def = ITEMS[item.itemDefId as ItemId];
    if (!def) return;
    const w = item.rotated ? def.height : def.width;
    const h = item.rotated ? def.width  : def.height;
    setHeldItem({
      instance:        item,
      effectiveWidth:  w,
      effectiveHeight: h,
      rotated:         item.rotated,
      source:          'hero_inventory',
    });
  }, []);

  // ── Drop: place held item into hero inventory grid ─────────────────────────

  const handleDrop = useCallback(async (gridX: number, gridY: number) => {
    if (!heldItem) return;
    const { instance, rotated, source, reportId } = heldItem;
    setHeldItem(null);
    // Optimistic: instantly show item at new position while waiting for server
    setItemPatch({ [instance.id]: { gridX, gridY, rotated, location: 'hero_inventory' } });
    try {
      if (source === 'activity_report' && reportId) {
        await apiFetch(`/activity-reports/${reportId}/claim`, {
          method: 'POST',
          token:  token ?? undefined,
          body:   JSON.stringify({ itemId: instance.id, gridX, gridY, rotated }),
        });
        notifyReportRefresh();
      } else if (source === 'hero_equipped') {
        // Dragging from equipment slot to a specific inventory cell
        await apiFetch('/items/unequip', {
          method: 'POST',
          token:  token ?? undefined,
          body:   JSON.stringify({ itemId: instance.id, gridX, gridY }),
        });
      } else {
        await apiFetch('/items/move', {
          method: 'POST',
          token:  token ?? undefined,
          body:   JSON.stringify({ itemId: instance.id, targetLocation: 'hero_inventory', gridX, gridY, rotated }),
        });
      }
      await fetchHeroItems();
    } catch {
      setHeldItem(heldItem);
    } finally {
      setItemPatch(null);
    }
  }, [heldItem, token, fetchHeroItems, notifyReportRefresh]);

  // ── Equip (held → slot click) ──────────────────────────────────────────────

  const handleEquip = useCallback(async (item: ItemInstance, slot: HeroEquipSlot) => {
    setHeldItem(null);
    setInspectItem(null);
    try {
      await apiFetch('/items/equip', {
        method: 'POST',
        token:  token ?? undefined,
        body:   JSON.stringify({ itemId: item.id, equipSlot: slot }),
      });
      await fetchHeroItems();
    } catch { /* ignore */ }
  }, [token, fetchHeroItems]);

  // ── Unequip (click occupied slot) ─────────────────────────────────────────

  const handleUnequip = useCallback(async (item: ItemInstance) => {
    try {
      await apiFetch('/items/unequip', {
        method: 'POST',
        token:  token ?? undefined,
        body:   JSON.stringify({ itemId: item.id }),
      });
      await fetchHeroItems();
    } catch { /* ignore */ }
  }, [token, fetchHeroItems]);

  // ── Discard ────────────────────────────────────────────────────────────────

  const handleDiscard = useCallback(async (item: ItemInstance) => {
    try {
      await apiFetch(`/items/${item.id}`, {
        method: 'DELETE',
        token:  token ?? undefined,
      });
      await fetchHeroItems();
    } catch { /* ignore */ }
  }, [token, fetchHeroItems]);
  // ── Move to base ──────────────────────────────────────────────────────

  const handleMoveToBase = useCallback(async (item: ItemInstance) => {
    // Show the base storage picker modal
    setMoveToBaseItem(item);
  }, []);

  const confirmMoveToBase = useCallback(async (armoryIndex: number) => {
    if (!moveToBaseItem) return;
    await apiFetch('/items/move-to-base', {
      method: 'POST',
      token:  token ?? undefined,
      body:   JSON.stringify({ itemId: moveToBaseItem.id, armoryIndex }),
    });
    await fetchHeroItems();
  }, [moveToBaseItem, token, fetchHeroItems]);

  // ── Consume (herbal_poultice etc.) ──────────────────────────────────────────────

  const handleConsume = useCallback(async (item: ItemInstance) => {
    try {
      await apiFetch(`/items/${item.id}/consume`, {
        method: 'POST',
        token:  token ?? undefined,
      });
      // Refresh both item list and hero stats (health changed)
      await Promise.all([fetchHeroItems(), fetchHero()]);
    } catch { /* ignore */ }
  }, [token, fetchHeroItems, fetchHero]);

  // ── Create hero ────────────────────────────────────────────────────────────
  const handleCreateHero = useCallback(async () => {
    if (!createHeroName.trim()) return;
    setCreating(true);
    setCreateHeroError('');
    try {
      await apiFetch('/hero/create', {
        method: 'POST',
        token:  token ?? undefined,
        body:   JSON.stringify({ name: createHeroName.trim() }),
      });
      setShowCreateModal(false);
      setCreateHeroName('');
      await fetchHero();
    } catch (e: unknown) {
      setCreateHeroError(e instanceof Error ? e.message : 'Failed to create hero');
    } finally {
      setCreating(false);
    }
  }, [createHeroName, token, fetchHero]);

  // ── Header ─────────────────────────────────────────────────────────────────

  const level = hero?.level ?? 1;
  const xpForCurrentLevel = hero ? xpRequiredForLevel(level)     : 0;
  const xpForNextLevel    = hero ? xpRequiredForLevel(level + 1) : 100;
  useSetHeroHeader(hero ? { hero, xpForCurrentLevel, xpForNextLevel } : null);

  if (error) return <p className="text-red-400">{error}</p>;

  // Brand-new player: no heroes yet — show forced creation modal
  if (data && data.heroes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-300 text-lg font-semibold">Welcome, Commander!</p>
        <p className="text-gray-400 text-sm">Name your first hero to begin.</p>
        <div className="flex gap-2">
          <input
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            placeholder="Hero name…"
            value={createHeroName}
            onChange={(e) => setCreateHeroName(e.target.value)}
            maxLength={32}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateHero(); }}
          />
          <button
            onClick={handleCreateHero}
            disabled={creating || !createHeroName.trim()}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            {creating ? 'Creating…' : 'Begin'}
          </button>
        </div>
        {createHeroError && <p className="text-red-400 text-sm">{createHeroError}</p>}
      </div>
    );
  }

  if (!data || !hero) return <p className="text-gray-400 animate-pulse">Loading hero…</p>;

  const activeHeroHomeCityId   = selectedEntry?.hero.homeCityId ?? null;
  const activeHeroHomeCityName = selectedEntry?.homeCityName ?? heroHomeCityName;
  const activeAdventure        = selectedEntry?.activeAdventure ?? null;
  const maxEnergy    = heroStats?.maxEnergy ?? hero.maxEnergy;
  const isFull       = hero.energy >= maxEnergy;
  // Next regen: next wall-clock-aligned 5-minute mark (10:00, 10:05, 10:10, …)
  const regenIntervalMs = REGEN_TICK_INTERVAL_SECONDS * 1000;
  const nextRegen    = new Date(Math.ceil(Date.now() / regenIntervalMs) * regenIntervalMs);
  const maxHealth    = heroStats?.maxHealth ?? (hero.maxHealth ?? 100);
  const currentHealth = hero.health ?? 0;
  const isHealthFull = currentHealth >= maxHealth;
  const nextHealthRegen = nextRegen; // same global tick for health and energy

  return (
    <div
      className="w-full space-y-4"
      onClick={() => { if (heldItem) setHeldItem(null); }}
      style={{ cursor: heldItem ? 'crosshair' : 'default' }}
    >
      {/* ── Hero selector bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {data.heroes.map((entry) => (
          <button
            key={entry.hero.id}
            onClick={(e) => { e.stopPropagation(); setSelectedHeroId(entry.hero.id); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
              entry.hero.id === selectedHeroId
                ? 'bg-amber-600 border-amber-500 text-white'
                : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {entry.hero.name}
            <span className="ml-1.5 text-xs opacity-70">Lv {entry.hero.level}</span>
            {entry.activeAdventure && <span className="ml-1.5 text-xs text-amber-300">⚔</span>}
          </button>
        ))}

        {/* Unlock / create button */}
        {(() => {
          const canCreate = data.totalLevel >= data.nextHeroUnlockLevel;
          return (
            <button
              onClick={(e) => { e.stopPropagation(); if (canCreate) setShowCreateModal(true); }}
              title={canCreate ? 'Recruit a new hero' : `Need combined level ${data.nextHeroUnlockLevel} (currently ${data.totalLevel})`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                canCreate
                  ? 'bg-teal-700 border-teal-600 text-white hover:bg-teal-600 cursor-pointer'
                  : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              + Recruit Hero
              {!canCreate && (
                <span className="ml-1.5 text-[10px] opacity-60">(need Lv {data.nextHeroUnlockLevel})</span>
              )}
            </button>
          );
        })()}
      </div>

      {/* ── Create hero modal ─────────────────────────────────────────────── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-80 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-lg">Recruit New Hero</h3>
            <input
              autoFocus
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              placeholder="Hero name…"
              value={createHeroName}
              onChange={(e) => setCreateHeroName(e.target.value)}
              maxLength={32}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateHero(); }}
            />
            {createHeroError && <p className="text-red-400 text-sm">{createHeroError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCreateModal(false); setCreateHeroName(''); setCreateHeroError(''); }}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white transition"
              >Cancel</button>
              <button
                onClick={handleCreateHero}
                disabled={creating || !createHeroName.trim()}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition"
              >
                {creating ? 'Recruiting…' : 'Recruit'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Top row: stats | inventory | adventure ───────────────────────── */}
      <div className="grid grid-cols-[260px_auto_1fr] gap-4 items-start">

        {/* ── Col 1: hero stats card ──────────────────────────────────────── */}
        <div className="bg-gray-800 rounded-xl p-5 space-y-5">
          {/* Avatar + rank */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-700 border-2 border-amber-700/50 flex items-center justify-center text-3xl select-none shrink-0">
              🚀
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Commander</p>
              <p className="text-amber-400 font-bold text-xl leading-tight">{hero.name}</p>
              <p className="text-gray-500 text-xs">Level {level}</p>
            </div>
          </div>

          {/* Health */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-red-400 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1">
                <StatIcon type="maxHealth" size={13} /> Health
              </span>
              <span className="text-gray-400 tabular-nums">{hero.health} / {maxHealth}</span>
            </div>
            <ProgressBar value={currentHealth} max={maxHealth} colorClass="bg-red-500" />
            {!isHealthFull && (
              <p className="text-[10px] text-gray-600 mt-1.5">
                Next regen in <CountdownTimer endsAt={nextHealthRegen} onComplete={fetchHero} />
              </p>
            )}
          </div>

          {/* Energy */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-blue-300 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1">
                <StatIcon type="maxEnergy" size={13} /> Energy
              </span>
              <span className="text-gray-400 tabular-nums">{hero.energy} / {maxEnergy}</span>
            </div>
            <ProgressBar value={hero.energy} max={maxEnergy} colorClass="bg-blue-500" />
            {!isFull && (
              <p className="text-[10px] text-gray-600 mt-1.5">
                Next regen in <CountdownTimer endsAt={nextRegen} onComplete={fetchHero} />
              </p>
            )}
          </div>

          {/* XP */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span className="uppercase tracking-wider text-[10px]">Experience</span>
              <span className="tabular-nums">
                {hero.xp - xpForCurrentLevel} / {xpForNextLevel - xpForCurrentLevel}
              </span>
            </div>
            <ProgressBar
              value={hero.xp - xpForCurrentLevel}
              max={xpForNextLevel - xpForCurrentLevel}
              colorClass="bg-amber-500"
            />
          </div>

          {/* Skills */}
          <div className="space-y-1.5 pt-2 border-t border-gray-700/50">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Skills</p>
            <div className="space-y-1.5">
              {Object.values(SKILLS).map((skill) => {
                const totalXp   = (hero.skillXp?.[skill.id as SkillId] ?? 0) as number;
                const lvl       = Math.max(1, (hero.skillLevels?.[skill.id as SkillId] ?? 1) as number);
                const xpAtLvl   = skill.xpPerLevel.slice(0, lvl - 1).reduce((s: number, v: number) => s + v, 0);
                const xpForNext = (skill.xpPerLevel[lvl - 1] ?? 1) as number;
                const pct = xpForNext > 0 ? Math.min(100, ((totalXp - xpAtLvl) / xpForNext) * 100) : 0;
                const currentXp  = totalXp - xpAtLvl;
                const remaining  = xpForNext - currentXp;
                return (
                  <div key={skill.id} className="group relative flex items-center gap-2">
                    <SkillIcon skill={skill.id as SkillId} size={13} showTooltip={false} />
                    <span className="text-[10px] text-gray-400 truncate w-16 shrink-0">{skill.name}</span>
                    <span className="text-[10px] text-amber-400 tabular-nums w-4 shrink-0 text-right">{lvl}</span>
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    {/* XP breakdown tooltip */}
                    <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50">
                      <div className="bg-gray-900 border border-gray-600/80 rounded-lg px-2.5 py-2 shadow-xl text-[10px] whitespace-nowrap space-y-1 min-w-[140px]">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500 mb-1">{skill.name}</p>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">Current XP</span>
                          <span className="text-gray-300 tabular-nums">{currentXp}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">XP for next</span>
                          <span className="text-gray-300 tabular-nums">{xpForNext}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">Remaining</span>
                          <span className="text-amber-400 tabular-nums">{remaining}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Computed stats */}
          {heroStats && (() => {
            const sl = hero.skillLevels;
            const ib = clientItemBonuses;
            const level = hero.level ?? 1;
            const skillAttack   = (sl.combat    ?? 0) * (SKILLS.combat.bonusPerLevel['attackBonus']         ?? 0);
            const skillEnergy   = (sl.endurance ?? 0) * (SKILLS.endurance.bonusPerLevel['energyRegenBonus'] ?? 0);
            const skillGather   = (sl.observation ?? 0) * (SKILLS.observation.bonusPerLevel['gatheringBonus'] ?? 0);
            const skillSpeed    = (sl.tactics   ?? 0) * (SKILLS.tactics.bonusPerLevel['adventureSpeedBonus'] ?? 0);

            const statRows: {
              statType: Parameters<typeof StatIcon>[0]['type']; label: string; value: string;
              base: string; fromSkill: string | null; fromItems: string | null; fromLevel?: string | null;
            }[] = [
              {
                statType: 'attack', label: 'Attack', value: String(heroStats.attack),
                base: '10',
                fromSkill: skillAttack  ? `+${skillAttack}`  : null,
                fromItems: ib.attackBonus ? `+${ib.attackBonus}` : null,
              },
              {
                statType: 'defense', label: 'Defense', value: String(heroStats.defense),
                base: '5',
                fromSkill: null,
                fromItems: ib.defenseBonus ? `+${ib.defenseBonus}` : null,
              },
              {
                statType: 'gathering', label: 'Gathering', value: `+${heroStats.gatheringBonus}%`,
                base: '0%',
                fromSkill: skillGather ? `+${skillGather}%` : null,
                fromItems: ib.gatheringBonus ? `+${ib.gatheringBonus}%` : null,
              },
              {
                statType: 'maxEnergy', label: 'Energy Regen', value: `+${heroStats.energyRegenPerTick}`,
                base: String(BASE_ENERGY_REGEN),
                fromSkill: skillEnergy ? `+${skillEnergy}` : null,
                fromItems: ib.energyRegenBonus ? `+${ib.energyRegenBonus}` : null,
              },
              {
                statType: 'maxHealth', label: 'Health Regen', value: `+${heroStats.healthRegenPerTick}`,
                base: String(BASE_HEALTH_REGEN),
                fromSkill: null,
                fromItems: ib.healthRegenBonus ? `+${ib.healthRegenBonus}` : null,
              },
              {
                statType: 'speed', label: 'Adventure Speed', value: `-${heroStats.adventureSpeedReduction}%`,
                base: '0%',
                fromSkill: skillSpeed ? `-${skillSpeed}%` : null,
                fromItems: ib.adventureSpeedBonus ? `-${ib.adventureSpeedBonus}%` : null,
              },
            ];

            return (
              <div className="space-y-1.5 pt-2 border-t border-gray-700/50">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Stats</p>
                <div className="grid grid-cols-1 gap-y-1">
                  {statRows.map(({ statType, label, value, base, fromSkill, fromItems, fromLevel }) => (
                    <div key={label} className="group relative flex items-center gap-1.5 min-w-0 cursor-default">
                      <StatIcon type={statType} size={14} showTooltip={false} />
                      <span className="text-[10px] text-gray-500 truncate">{label}</span>
                      <span className="text-[10px] text-gray-200 tabular-nums ml-auto">{value}</span>
                      {/* Breakdown tooltip — floats to the right of the row */}
                      <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50">
                        <div className="bg-gray-900 border border-gray-600/80 rounded-lg px-2.5 py-2 shadow-xl text-[10px] whitespace-nowrap space-y-1 min-w-[120px]">
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Base</span>
                            <span className="text-gray-300 tabular-nums">{base}</span>
                          </div>
                          {fromLevel && (
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Level</span>
                              <span className="text-amber-400 tabular-nums">{fromLevel}</span>
                            </div>
                          )}
                          {fromSkill && (
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Skills</span>
                              <span className="text-green-400 tabular-nums">{fromSkill}</span>
                            </div>
                          )}
                          {fromItems && (
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Items</span>
                              <span className="text-amber-400 tabular-nums">{fromItems}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Home base */}
          {activeHeroHomeCityId && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Home Base</p>
              <Link
                href={`/base/${activeHeroHomeCityId}`}
                className="text-teal-400 hover:text-teal-300 font-medium text-sm transition"
              >
                🏠 {activeHeroHomeCityName ?? 'Settlement'}
              </Link>
            </div>
          )}
        </div>

        {/* ── Col 2: equipment slots + hero inventory ─────────────────────── */}
        <div
          className="flex flex-col gap-3 bg-gray-800 rounded-xl p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <EquipmentSlots
            equippedItems={equippedItems}
            heldItem={heldItem}
            onEquip={handleEquip}
            onPickupEquipped={pickUpFromEquipped}
            onUnequip={handleUnequip}
            disabled={!!activeAdventure}
          />

          <InventoryGrid
            cols={HERO_INVENTORY_COLS}
            rows={HERO_INVENTORY_ROWS}
            items={displayInventoryItems}
            heldItem={heldItem}
            onPickUp={activeAdventure ? () => {} : pickUpFromInventory}
            onDrop={handleDrop}
            onInspect={(item) => setInspectItem(item)}
            onConsume={activeAdventure ? undefined : handleConsume}
            onDiscard={activeAdventure ? undefined : handleDiscard}
            onMoveToBase={activeAdventure ? undefined : (activeHeroHomeCityId ? handleMoveToBase : undefined)}
            label="Inventory"
            accent="rgba(255,255,255,0.06)"
            disabled={!!activeAdventure}
          />

          <HeldItemHUD heldItem={heldItem} />
        </div>

        {/* ── Col 3: adventure panel ──────────────────────────────────────── */}
        <AdventurePanel
          hero={hero}
          activeJob={activeAdventure ?? null}
          onStarted={() => { fetchHero(); refreshHeroMeta(); }}
          onComplete={() => { fetchHero(); refreshHeroMeta(); }}
          heroStats={heroStats}
        />
      </div>



      {/* ── Item inspect modal (right-click → Examine) ───────────────────────── */}
      {inspectItem && (
        <ItemInspectModal
          item={inspectItem}
          onClose={() => setInspectItem(null)}
          onDiscard={activeAdventure ? undefined : handleDiscard}
          onEquip={
            !activeAdventure && (ITEMS[inspectItem.itemDefId as ItemId]?.heroEquipSlots?.length ?? 0) > 0
              ? (item, slot) => { handleEquip(item, slot); setInspectItem(null); }
              : undefined
          }
          onConsume={
            !activeAdventure &&
            ITEMS[inspectItem.itemDefId as ItemId]?.consumeEffect &&
            (inspectItem.location === 'hero_inventory' || inspectItem.location === 'hero_equipped')
              ? (item) => { handleConsume(item); setInspectItem(null); }
              : undefined
          }
        />
      )}

      {/* ── Move to base modal (right-click → Move to base) ────────────────── */}
      {moveToBaseItem && (
        <MoveToBaseModal
          item={moveToBaseItem}
          baseName={activeHeroHomeCityName ?? 'Home Base'}
          armoryGridSizes={armoryGridSizes}
          baseArmoryItems={baseItems.filter((i) => i.location === 'base_armory')}
          onClose={() => setMoveToBaseItem(null)}
          onConfirm={confirmMoveToBase}
        />
      )}
    </div>
  );
}
