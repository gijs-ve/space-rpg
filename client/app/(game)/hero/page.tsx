'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { getSocket } from '@/lib/socket';
import ProgressBar from '@/components/ui/ProgressBar';
import CountdownTimer from '@/components/ui/CountdownTimer';
import AdventurePanel from '@/components/hero/AdventurePanel';
import SkillsPanel from '@/components/hero/SkillsPanel';
import InventoryGrid from '@/components/inventory/InventoryGrid';
import EquipmentSlots from '@/components/inventory/EquipmentSlots';
import ItemInspectModal from '@/components/inventory/ItemInspectModal';
import MoveToBaseModal from '@/components/inventory/MoveToBaseModal';
import HeldItemHUD from '@/components/inventory/HeldItemHUD';
import { useSetHeroHeader } from '@/context/header';
import { useGameInventory } from '@/context/inventory';
import {
  xpRequiredForLevel,
  ENERGY_REGEN_INTERVAL_SECONDS,
  HEALTH_REGEN_INTERVAL_SECONDS,
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
  HeroResponse,
  HeroEquipSlot,
  ItemId,
  ItemInstance,
} from '@rpg/shared';


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HeroPage() {
  const { token } = useAuth();

  // ── Hero data ──────────────────────────────────────────────────────────────
  const [data,  setData]  = useState<HeroResponse | null>(null);
  const [error, setError] = useState('');

  // ── Shared inventory context ────────────────────────────────────────────────
  const {
    heldItem, setHeldItem, heroItems, fetchHeroItems, notifyReportRefresh,
    heroHomeCityId, heroHomeCityName, baseItems, armoryGridSizes,
  } = useGameInventory();

  const [inspectItem,     setInspectItem]     = useState<ItemInstance | null>(null);
  const [moveToBaseItem,  setMoveToBaseItem]  = useState<ItemInstance | null>(null);
  /** Optimistic grid-position overrides while an API call is in flight */
  const [itemPatch, setItemPatch] = useState<Record<string, Partial<ItemInstance>> | null>(null);

  // ── Fetchers ───────────────────────────────────────────────────────────────

  const fetchHero = useCallback(async () => {
    try {
      const res = await apiFetch<HeroResponse>('/hero', { token: token ?? undefined });
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load hero');
    }
  }, [token]);

  // ── Initial load + socket ──────────────────────────────────────────────────

  useEffect(() => {
    fetchHero();
  }, [fetchHero]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('adventure:complete', fetchHero);
    return () => { socket.off('adventure:complete', fetchHero); };
  }, [fetchHero]);

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
      .filter((i) => i.location === 'hero_equipped' && i.equipSlot)
      .forEach((i) => { map[i.equipSlot!] = i; });
    return map;
  }, [heroItems]);

  const inventoryItems = useMemo(
    () => heroItems.filter((i) => i.location === 'hero_inventory'),
    [heroItems],
  );

  /** Apply any in-flight optimistic position overrides */
  const displayInventoryItems = useMemo(() => {
    if (!itemPatch) return inventoryItems;
    return inventoryItems.map((i) => {
      const patch = itemPatch[i.id];
      return patch ? { ...i, ...patch } : i;
    });
  }, [inventoryItems, itemPatch]);

  const clientItemBonuses = useMemo(
    () => sumHeroItemBonuses(heroItems),
    [heroItems],
  );
  const heroStats = useMemo(
    () => (data?.hero ? computeHeroStats(data.hero.skillLevels, clientItemBonuses) : null),
    [data, clientItemBonuses],
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
  // ── Header ─────────────────────────────────────────────────────────────────

  const hero = data?.hero ?? null;
  const level = hero?.level ?? 1;
  const xpForCurrentLevel = hero ? xpRequiredForLevel(level)     : 0;
  const xpForNextLevel    = hero ? xpRequiredForLevel(level + 1) : 100;
  useSetHeroHeader(hero ? { hero, xpForCurrentLevel, xpForNextLevel } : null);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data || !hero) return <p className="text-gray-400 animate-pulse">Loading hero…</p>;

  const { activeAdventure } = data;
  const maxEnergy    = heroStats?.maxEnergy ?? hero.maxEnergy;
  const isFull       = hero.energy >= maxEnergy;
  const nextRegen    = new Date(
    new Date(hero.lastEnergyRegen).getTime() + ENERGY_REGEN_INTERVAL_SECONDS * 1000,
  );
  const maxHealth    = heroStats?.maxHealth ?? (hero.maxHealth ?? 100);
  const currentHealth = hero.health ?? 0;
  const isHealthFull = currentHealth >= maxHealth;
  const nextHealthRegen = hero.lastHealthRegen
    ? new Date(new Date(hero.lastHealthRegen).getTime() + HEALTH_REGEN_INTERVAL_SECONDS * 1000)
    : null;

  return (
    <div
      className="w-full space-y-4"
      /* Clicking outside any interactive element cancels hold */
      onClick={() => { if (heldItem) setHeldItem(null); }}
      style={{ cursor: heldItem ? 'crosshair' : 'default' }}
    >
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
              <p className="text-amber-400 font-bold text-xl leading-tight">Level {level}</p>
            </div>
          </div>

          {/* Health */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-red-400 font-medium uppercase tracking-wider text-[10px]">
                ❤️ Health
              </span>
              <span className="text-gray-400 tabular-nums">{hero.health} / {maxHealth}</span>
            </div>
            <ProgressBar value={currentHealth} max={maxHealth} colorClass="bg-red-500" />
            {!isHealthFull && nextHealthRegen && (
              <p className="text-[10px] text-gray-600 mt-1.5">
                Next +1 in <CountdownTimer endsAt={nextHealthRegen} onComplete={fetchHero} />
              </p>
            )}
          </div>

          {/* Energy */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-blue-300 font-medium uppercase tracking-wider text-[10px]">
                ⚡ Energy
              </span>
              <span className="text-gray-400 tabular-nums">{hero.energy} / {maxEnergy}</span>
            </div>
            <ProgressBar value={hero.energy} max={maxEnergy} colorClass="bg-blue-500" />
            {!isFull && (
              <p className="text-[10px] text-gray-600 mt-1.5">
                Next +1 in <CountdownTimer endsAt={nextRegen} onComplete={fetchHero} />
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

          {/* Computed stats */}
          {heroStats && (() => {
            const sl = hero.skillLevels;
            const ib = clientItemBonuses;
            const skillAttack   = (sl.combat    ?? 0) * (SKILLS.combat.bonusPerLevel['attackBonus']         ?? 0);
            const skillEnergy   = (sl.endurance ?? 0) * (SKILLS.endurance.bonusPerLevel['maxEnergyBonus']   ?? 0);
            const skillGather   = (sl.gathering ?? 0) * (SKILLS.gathering.bonusPerLevel['gatheringBonus']   ?? 0);
            const skillSpeed    = (sl.tactics   ?? 0) * (SKILLS.tactics.bonusPerLevel['adventureSpeedBonus'] ?? 0);

            const statRows: {
              icon: string; label: string; value: string;
              base: string; fromSkill: string | null; fromItems: string | null;
            }[] = [
              {
                icon: '⚔️', label: 'Attack', value: String(heroStats.attack),
                base: '10',
                fromSkill: skillAttack  ? `+${skillAttack}`  : null,
                fromItems: ib.attackBonus ? `+${ib.attackBonus}` : null,
              },
              {
                icon: '🛡', label: 'Defense', value: String(heroStats.defense),
                base: '5',
                fromSkill: null,
                fromItems: ib.defenseBonus ? `+${ib.defenseBonus}` : null,
              },
              {
                icon: '⚡', label: 'Max Energy', value: String(heroStats.maxEnergy),
                base: String(BASE_MAX_ENERGY),
                fromSkill: skillEnergy ? `+${skillEnergy}` : null,
                fromItems: ib.maxEnergyBonus ? `+${ib.maxEnergyBonus}` : null,
              },
              {
                icon: '❤️', label: 'Max Health', value: String(heroStats.maxHealth),
                base: String(BASE_MAX_HEALTH),
                fromSkill: null,
                fromItems: ib.maxHealthBonus ? `+${ib.maxHealthBonus}` : null,
              },
              {
                icon: '🌿', label: 'Gathering', value: `+${heroStats.gatheringBonus}%`,
                base: '0%',
                fromSkill: skillGather ? `+${skillGather}%` : null,
                fromItems: ib.gatheringBonus ? `+${ib.gatheringBonus}%` : null,
              },
              {
                icon: '💨', label: 'Adv. Speed', value: `-${heroStats.adventureSpeedReduction}%`,
                base: '0%',
                fromSkill: skillSpeed ? `-${skillSpeed}%` : null,
                fromItems: ib.adventureSpeedBonus ? `-${ib.adventureSpeedBonus}%` : null,
              },
            ];

            return (
              <div className="space-y-1.5 pt-2 border-t border-gray-700/50">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Stats</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {statRows.map(({ icon, label, value, base, fromSkill, fromItems }) => (
                    <div key={label} className="group relative flex items-center gap-1.5 min-w-0 cursor-default">
                      <span className="text-xs shrink-0">{icon}</span>
                      <span className="text-[10px] text-gray-500 truncate">{label}</span>
                      <span className="text-[10px] text-gray-200 tabular-nums ml-auto">{value}</span>
                      {/* Breakdown tooltip — floats to the right of the row */}
                      <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50">
                        <div className="bg-gray-900 border border-gray-600/80 rounded-lg px-2.5 py-2 shadow-xl text-[10px] whitespace-nowrap space-y-1 min-w-[120px]">
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Base</span>
                            <span className="text-gray-300 tabular-nums">{base}</span>
                          </div>
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
          {heroHomeCityId && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Home Base</p>
              <Link
                href={`/base/${heroHomeCityId}`}
                className="text-teal-400 hover:text-teal-300 font-medium text-sm transition"
              >
                🏠 {heroHomeCityName ?? 'Starbase'}
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
          />

          <InventoryGrid
            cols={HERO_INVENTORY_COLS}
            rows={HERO_INVENTORY_ROWS}
            items={displayInventoryItems}
            heldItem={heldItem}
            onPickUp={pickUpFromInventory}
            onDrop={handleDrop}
            onInspect={(item) => setInspectItem(item)}
            onDiscard={handleDiscard}
            onMoveToBase={heroHomeCityId ? handleMoveToBase : undefined}
            label="Inventory"
            accent="rgba(255,255,255,0.06)"
          />

          <HeldItemHUD heldItem={heldItem} />
        </div>

        {/* ── Col 3: adventure panel ──────────────────────────────────────── */}
        <AdventurePanel
          hero={hero}
          activeJob={activeAdventure ?? null}
          onStarted={fetchHero}
          onComplete={fetchHero}
        />
      </div>

      {/* ── Skills row ───────────────────────────────────────────────────── */}
      <SkillsPanel hero={hero} />


      {/* ── Item inspect modal (right-click → Examine) ───────────────────────── */}
      {inspectItem && (
        <ItemInspectModal
          item={inspectItem}
          onClose={() => setInspectItem(null)}
          onDiscard={handleDiscard}
          onEquip={
            (ITEMS[inspectItem.itemDefId as ItemId]?.heroEquipSlots?.length ?? 0) > 0
              ? (item, slot) => { handleEquip(item, slot); setInspectItem(null); }
              : undefined
          }
        />
      )}

      {/* ── Move to base modal (right-click → Move to base) ────────────────── */}
      {moveToBaseItem && (
        <MoveToBaseModal
          item={moveToBaseItem}
          baseName={heroHomeCityName ?? 'Home Base'}
          armoryGridSizes={armoryGridSizes}
          baseArmoryItems={baseItems.filter((i) => i.location === 'base_armory')}
          onClose={() => setMoveToBaseItem(null)}
          onConfirm={confirmMoveToBase}
        />
      )}
    </div>
  );
}
