'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { useGameInventory } from '@/context/inventory';
import { getSocket } from '@/lib/socket';
import { canPlaceClient } from '@/components/inventory/InventoryGrid';
import {
  ACTIVITY_NAMES,
  ACTIVITIES,
  SKILLS,
  ITEMS,
  ITEM_RARITY_COLOR,
  ITEM_CATEGORY_ICON,
  RESOURCE_LABELS,
  HERO_INVENTORY_COLS,
  HERO_INVENTORY_ROWS,
  UNITS,
} from '@rpg/shared';
import { ResourceAmount, ResourceIcon, SkillIcon } from '@/components/ui/ResourceIcon';
import Modal from '@/components/ui/Modal';
import type {
  ActivityReport,
  ItemId,
  ItemInstance,
  ResourceType,
  SkillId,
  FullBattleReport,
  TroopMap,
  UnitId,
  WaveOutcome,
} from '@rpg/shared';

// ─── Time-ago helper ──────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// ─── Client-side inventory fitness check ─────────────────────────────────────
// Simulates placing each unclaimed item one by one (unrotated first, then
// rotated as fallback). Returns true only if every item can fit.

function canAllFitInInventory(
  inventoryItems: ItemInstance[],
  unclaimedItems: ItemInstance[],
): boolean {
  const sim = [...inventoryItems];
  for (const item of unclaimedItems) {
    const def = ITEMS[item.itemDefId as ItemId];
    if (!def) continue; // unknown item — assume fits
    let placed = false;

    // Try upright
    outerUpright:
    for (let y = 0; y < HERO_INVENTORY_ROWS; y++) {
      for (let x = 0; x < HERO_INVENTORY_COLS; x++) {
        if (canPlaceClient(HERO_INVENTORY_COLS, HERO_INVENTORY_ROWS, sim,
          { width: def.width, height: def.height, gridX: x, gridY: y })) {
          sim.push({ ...item, gridX: x, gridY: y, rotated: false, location: 'hero_inventory' });
          placed = true;
          break outerUpright;
        }
      }
    }

    if (!placed) {
      // Try rotated
      outerRotated:
      for (let y = 0; y < HERO_INVENTORY_ROWS; y++) {
        for (let x = 0; x < HERO_INVENTORY_COLS; x++) {
          if (canPlaceClient(HERO_INVENTORY_COLS, HERO_INVENTORY_ROWS, sim,
            { width: def.height, height: def.width, gridX: x, gridY: y })) {
            sim.push({ ...item, gridX: x, gridY: y, rotated: true, location: 'hero_inventory' });
            placed = true;
            break outerRotated;
          }
        }
      }
    }

    if (!placed) return false;
  }
  return true;
}

// ─── Wave detail modal ───────────────────────────────────────────────────────

const WAVE_ROMAN = ['I', 'II', 'III'] as const;

function WaveDetailModal({
  wave,
  isAttacker,
  onClose,
}: {
  wave: WaveOutcome;
  isAttacker: boolean;
  onClose: () => void;
}) {
  const viewerWon = isAttacker ? wave.attackerWon : !wave.attackerWon;
  const waveLabel = WAVE_ROMAN[wave.waveIndex] ?? String(wave.waveIndex + 1);
  const isCA = wave.isCounterAttack ?? false;

  const attackerTroopList = (Object.entries(wave.attackerTroops ?? {}) as [UnitId, number][]).filter(([, n]) => (n ?? 0) > 0);
  const defenderTroopList = (Object.entries(wave.defenderTroops ?? {}) as [UnitId, number][]).filter(([, n]) => (n ?? 0) > 0);
  const attackerCas       = (Object.entries(wave.attackerCasualties ?? {}) as [UnitId, number][]).filter(([, n]) => (n ?? 0) > 0);
  const defenderCas       = (Object.entries(wave.defenderCasualties ?? {}) as [UnitId, number][]).filter(([, n]) => (n ?? 0) > 0);

  // In a counter-attack wave the formula roles are swapped:
  //   effectiveAttack  = the DEFENDER's attack score (they were formula attacker)
  //   effectiveDefense = the ATTACKER's defense score (they were formula defender)
  // In a normal wave it's the obvious way around.
  const effAtk      = Math.round(wave.effectiveAttack  ?? 0);
  const effDef      = Math.round(wave.effectiveDefense ?? 0);
  const wall        = Math.round(wave.wallBonusValue   ?? 0);
  const effDefBase  = Math.round((wave.effectiveDefense ?? 0) - (wave.wallBonusValue ?? 0));

  // Labels depend on who was the aggressor in this wave.
  const atkScoreLabel = isCA
    ? (isAttacker ? 'Defender counter-attack' : 'Your counter-attack')
    : (isAttacker ? 'Your effective attack'   : 'Attacker effective attack');
  const defScoreLabel = isCA
    ? (isAttacker ? 'Your defense'           : 'Defender defense')
    : (isAttacker ? 'Defender defense'       : 'Your defense');

  // Outcome explanation line
  let outcomeLine: string;
  if (isCA) {
    if (wave.attackerWon) {
      // Attacker repelled the counter-attack
      outcomeLine = `Counter-attack repelled \u2014 defense (${effDef.toLocaleString()}) \u2265 attack (${effAtk.toLocaleString()})`;
    } else {
      // Defender's counter-attack broke through
      outcomeLine = `Counter-attack succeeded \u2014 attack (${effAtk.toLocaleString()}) > defense (${effDef.toLocaleString()})`;
    }
  } else {
    if (wave.attackerWon) {
      outcomeLine = `Attacker wins \u2014 attack (${effAtk.toLocaleString()}) > defense (${effDef.toLocaleString()})`;
    } else {
      outcomeLine = `Defender wins \u2014 defense (${effDef.toLocaleString()}) \u2265 attack (${effAtk.toLocaleString()})`;
    }
  }

  return (
    <Modal
      title={`Wave ${waveLabel}${isCA ? ' — Counter-attack' : ''} — ${viewerWon ? 'Won' : 'Lost'}`}
      onClose={onClose}
      className="max-w-sm"
    >
      {/* Result banner */}
      <div className={`text-center py-1 mb-4 rounded text-xs font-bold ${
        viewerWon
          ? 'bg-green-900/40 text-green-300 border border-green-800/50'
          : 'bg-red-900/40 text-red-300 border border-red-900/50'
      }`}>
        {isCA
          ? (viewerWon
            ? (isAttacker ? '\u2757 Counter-attack Repelled' : '\u2694 Counter-attack Succeeded')
            : (isAttacker ? '\u2694 Counter-attack Broke Through' : '\u2757 Counter-attack Repelled'))
          : (viewerWon ? '\u2694 Wave Won' : '\ud83d\udc80 Wave Lost')
        }
      </div>

      {/* Troops fielded */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1.5 font-semibold">
            {isAttacker ? 'Your troops' : 'Attacker troops'}
          </p>
          {attackerTroopList.length === 0
            ? <p className="text-[10px] text-gray-600 italic">None</p>
            : attackerTroopList.map(([uid, n]) => (
              <p key={uid} className="text-[10px] text-gray-300">
                {n}× {UNITS[uid]?.name ?? uid}
              </p>
            ))}
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1.5 font-semibold">
            {isAttacker ? 'Defender troops' : 'Your troops'}
          </p>
          {defenderTroopList.length === 0
            ? <p className="text-[10px] text-gray-600 italic">None</p>
            : defenderTroopList.map(([uid, n]) => (
              <p key={uid} className="text-[10px] text-gray-300">
                {n}× {UNITS[uid]?.name ?? uid}
              </p>
            ))}
        </div>
      </div>

      {/* Combat scores */}
      <div className="mb-4 rounded bg-gray-900/60 border border-gray-800/60 p-2.5 space-y-2">
        <p className="text-[9px] uppercase tracking-widest text-gray-500 font-semibold">
          Combat scores{isCA && <span className="ml-1 text-orange-500/80 normal-case">(counter-attack)</span>}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">{atkScoreLabel}</span>
          <span className="text-[11px] font-bold text-amber-300">{effAtk.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">{defScoreLabel}</span>
          <span className="text-[11px] font-bold text-sky-300">{effDef.toLocaleString()}</span>
        </div>
        {wall > 0 && (
          <p className="text-[10px] text-gray-600">
            (base {effDefBase.toLocaleString()} + {wall.toLocaleString()} wall bonus)
          </p>
        )}
        <div className={`text-[10px] font-semibold pt-1 border-t border-gray-800/60 ${
          wave.attackerWon ? 'text-green-400' : 'text-red-400'
        }`}>
          {outcomeLine}
        </div>
      </div>

      {/* Wave casualties */}
      <div>
        <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1.5 font-semibold">Casualties this wave</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] text-gray-600 mb-1">{isAttacker ? 'Your losses' : 'Attacker losses'}</p>
            {attackerCas.length === 0
              ? <p className="text-[10px] text-gray-600 italic">None</p>
              : attackerCas.map(([uid, n]) => (
                <p key={uid} className="text-[10px] text-red-400">
                  {'−'}{n} {UNITS[uid]?.name ?? uid}
                </p>
              ))}
          </div>
          <div>
            <p className="text-[9px] text-gray-600 mb-1">{isAttacker ? 'Defender losses' : 'Your losses'}</p>
            {defenderCas.length === 0
              ? <p className="text-[10px] text-gray-600 italic">None</p>
              : defenderCas.map(([uid, n]) => (
                <p key={uid} className="text-[10px] text-amber-400">
                  {'−'}{n} {UNITS[uid]?.name ?? uid}
                </p>
              ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Battle report detail (PvP) ─────────────────────────────────────────────

function BattleReportSection({
  meta,
  isAttacker,
}: {
  meta: FullBattleReport;
  isAttacker: boolean;
}) {
  const [selectedWave, setSelectedWave] = useState<WaveOutcome | null>(null);
  const won = isAttacker ? meta.attackerWon : !meta.attackerWon;

  const troopCas = (casualties: TroopMap) =>
    (Object.entries(casualties ?? {}) as [UnitId, number][])
      .filter(([, n]) => (n ?? 0) > 0);

  const attackerCas = troopCas(meta.totalAttackerCasualties ?? {});
  const defenderCas = troopCas(meta.totalDefenderCasualties ?? {});
  const plunder = (Object.entries(meta.resourcesPlundered ?? {}) as [ResourceType, number][])
    .filter(([, n]) => (n ?? 0) > 0);

  return (
    <div className="space-y-3">
      {/* Result banner */}
      <div className={`text-center py-1.5 px-3 rounded font-bold text-sm tracking-wide ${
        won
          ? 'bg-green-900/40 text-green-300 border border-green-800/60'
          : 'bg-red-900/40 text-red-300 border border-red-900/60'
      }`}>
        {won ? '⚔ VICTORY' : '💀 DEFEAT'} — {meta.wavesWon}/3 waves won
      </div>

      {/* Cities */}
      {(meta.attackerCityName || meta.defenderCityName) && (
        <p className="text-[10px] text-gray-600 text-center">
          {meta.attackerCityName ?? '?'}
          <span className="mx-1 text-gray-700">›</span>
          {meta.defenderCityName ?? '?'}
        </p>
      )}

      {/* Wave outcomes */}
      {(meta.waveOutcomes ?? []).length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1 font-semibold">
            Waves <span className="normal-case font-normal text-gray-700">(click for details)</span>
          </p>
          <div className="flex gap-1">
            {meta.waveOutcomes.map((w) => {
              const waveWon = isAttacker ? w.attackerWon : !w.attackerWon;
              const isCA    = w.isCounterAttack ?? false;
              return (
                <button
                  key={w.waveIndex}
                  onClick={() => setSelectedWave(w)}
                  className={`flex-1 text-center rounded py-1 text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80 ${
                    waveWon
                      ? 'bg-green-900/30 text-green-400 border border-green-800/40'
                      : 'bg-red-900/20 text-red-400 border border-red-900/30'
                  }`}
                >
                  <div className="text-[9px] text-gray-600 mb-0.5">
                    {WAVE_ROMAN[w.waveIndex] ?? w.waveIndex + 1}
                    {isCA && <span className="ml-0.5 text-orange-600" title="Counter-attack">↩</span>}
                  </div>
                  {waveWon ? '\u2713' : '\u2717'}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedWave && (
        <WaveDetailModal
          wave={selectedWave}
          isAttacker={isAttacker}
          onClose={() => setSelectedWave(null)}
        />
      )}

      {/* Casualties */}
      {(attackerCas.length > 0 || defenderCas.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1 font-semibold">
              {isAttacker ? 'Your losses' : 'Attacker losses'}
            </p>
            {attackerCas.length === 0
              ? <p className="text-[10px] text-gray-600 italic">None</p>
              : attackerCas.map(([uid, n]) => (
                <p key={uid} className="text-[10px] text-red-400">
                  {'−'}{n} {UNITS[uid]?.name ?? uid}
                </p>
              ))}
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1 font-semibold">
              {isAttacker ? 'Enemy losses' : 'Your losses'}
            </p>
            {defenderCas.length === 0
              ? <p className="text-[10px] text-gray-600 italic">None</p>
              : defenderCas.map(([uid, n]) => (
                <p key={uid} className="text-[10px] text-amber-400">
                  {'−'}{n} {UNITS[uid]?.name ?? uid}
                </p>
              ))}
          </div>
        </div>
      )}

      {/* Plunder */}
      {plunder.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1 font-semibold">
            {isAttacker ? 'Resources plundered' : 'Resources lost'}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
            {plunder.map(([res, amt]) => (
              <span key={res} className="inline-flex items-center gap-1">
                <ResourceIcon type={res} size={13} />
                <span className={`text-[11px] font-semibold tabular-nums ${
                  isAttacker ? 'text-green-400' : 'text-red-400'
                }`}>
                  {amt.toLocaleString()}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expanded report body ─────────────────────────────────────────────────────

function ReportDetail({
  report,
  token,
  onDismiss,
  onClaimed,
  onDeposited,
  animate,
}: {
  report:     ActivityReport;
  token:      string;
  onDismiss:  () => void;
  onClaimed:  () => void;
  onDeposited: () => void;
  animate:    boolean;
}) {
  const { heroItems, fetchHeroItems, heroHomeCityId, heroHomeCityName, heroesOnAdventure } = useGameInventory();
  const [claiming,           setClaiming]           = useState(false);
  const [claimed,            setClaimed]            = useState(false);
  const [depositing,         setDepositing]         = useState(false);
  const [deposited,          setDeposited]          = useState(report.resourcesClaimed);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);

  const resources      = (report.resources ?? {}) as Record<ResourceType, number>;
  const hasResources   = Object.values(resources).some((v) => (v as number) > 0);
  const unclaimedItems = report.items.filter((it) => it.location === 'activity_report');

  // Is the hero who owns this report currently on an active adventure?
  const isHeroOnAdventure = !!(report.heroId && heroesOnAdventure.includes(report.heroId));

  // True when this is a hero adventure (not PvP, not construction/training etc.)
  const isAdventureReport =
    !!ACTIVITIES[report.activityType as keyof typeof ACTIVITIES] &&
    report.activityType !== 'player_attack' &&
    report.activityType !== 'player_defence';

  // Current hero inventory items (for the fitness simulation)
  const inventoryItems = useMemo(
    () => heroItems.filter((i) => i.location === 'hero_inventory'),
    [heroItems],
  );

  const canAutoPickUp = useMemo(
    () => !claimed && !isHeroOnAdventure && unclaimedItems.length > 0 && canAllFitInInventory(inventoryItems, unclaimedItems),
    [claimed, isHeroOnAdventure, unclaimedItems, inventoryItems],
  );

  // Staggered pop-in helper — each call increments the delay slot
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _animIdx = 0;
  const pop = (): React.CSSProperties =>
    animate
      ? { opacity: 0, animation: 'pop-in 0.28s ease forwards', animationDelay: `${_animIdx++ * 75}ms` }
      : {};

  const handleAutoPickUp = async () => {
    if (!unclaimedItems.length) return;
    setClaiming(true);
    try {
      await apiFetch(`/activity-reports/${report.id}/claim-all`, {
        method: 'POST',
        token,
        body: JSON.stringify({}),
      });
      await fetchHeroItems();
      setClaimed(true);
      onClaimed();
    } catch { /* ignore */ }
    setClaiming(false);
  };

  const handleDismiss = async () => {
    setShowDismissConfirm(false);
    try {
      await apiFetch(`/activity-reports/${report.id}/dismiss`, {
        method: 'POST',
        token,
        body: JSON.stringify({}),
      });
      onDismiss();
    } catch { /* ignore */ }
  };

  const handleDepositResources = async () => {
    if (!heroHomeCityId) return;
    setDepositing(true);
    try {
      await apiFetch(`/activity-reports/${report.id}/claim-resources`, {
        method: 'POST',
        token,
        body: JSON.stringify({}),
      });
      setDeposited(true);
      onDeposited();
    } catch { /* ignore */ }
    setDepositing(false);
  };

  // ── Dismiss button / confirm ─────────────────────────────────────────────
  const hasUnclaimedContent = unclaimedItems.length > 0 || (hasResources && !deposited);

  const dismissButton = showDismissConfirm ? (
    <div className="w-full rounded border border-red-900/60 bg-red-950/40 px-2 py-1.5 space-y-1.5 mt-1">
      <p className="text-[10px] text-red-300 font-semibold">Dismiss this report?</p>
      {unclaimedItems.length > 0 && (
        <p className="text-[10px] text-red-400">
          ⚠ {unclaimedItems.length} unclaimed item{unclaimedItems.length !== 1 ? 's' : ''} will be lost
        </p>
      )}
      {hasResources && !deposited && (
        <p className="text-[10px] text-amber-400">
          ⚠ Resources not yet deposited will be lost
        </p>
      )}
      <div className="flex gap-1.5 pt-0.5">
        <button
          className="flex-1 text-[10px] py-0.5 rounded bg-red-900/60 hover:bg-red-900 text-red-300 border border-red-900 transition active:scale-95"
          onClick={handleDismiss}
        >
          Yes, dismiss
        </button>
        <button
          className="flex-1 text-[10px] py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 transition active:scale-95"
          onClick={() => setShowDismissConfirm(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button
      className="text-[10px] py-1 px-3 rounded bg-gray-800 hover:bg-gray-700 text-gray-500 border border-gray-800 transition active:scale-95"
      onClick={() => {
        if (hasUnclaimedContent) {
          setShowDismissConfirm(true);
        } else {
          handleDismiss();
        }
      }}
    >
      Dismiss
    </button>
  );

  // ── Item grid (shared between adventure and non-adventure layouts) ────────
  const itemGrid = report.items.length > 0 ? (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {report.items.map((item) => {
          const def       = ITEMS[item.itemDefId as ItemId];
          if (!def) return null;
          const isClaimed = item.location !== 'activity_report';
          return (
            <div
              key={item.id}
              title={isClaimed ? `${def.name} (claimed)` : isHeroOnAdventure ? `${def.name} — hero on adventure` : def.name}
              className="flex items-center justify-center rounded text-base select-none"
              style={{
                width:      34,
                height:     34,
                background: isClaimed ? '#1a1a1a' : 'rgba(255,255,255,0.05)',
                border:     `1px solid ${isClaimed ? '#333' : ITEM_RARITY_COLOR[def.rarity]}`,
                opacity:    isClaimed ? 0.35 : isHeroOnAdventure ? 0.5 : 1,
              }}
            >
              {ITEM_CATEGORY_ICON[def.category]}
            </div>
          );
        })}
      </div>

      {/* Pick-up action */}
      {isHeroOnAdventure && unclaimedItems.length > 0 && (
        <p className="text-[9px] text-amber-600/80 leading-tight">
          ⚔ Hero is on an adventure — items available on return
        </p>
      )}
      {!isHeroOnAdventure && unclaimedItems.length > 0 && !claimed && (
        canAutoPickUp ? (
          <button
            disabled={claiming}
            className="text-[10px] py-0.5 px-2 rounded bg-blue-900/50 hover:bg-blue-900/80 text-blue-300 border border-blue-900/60 transition active:scale-95 disabled:opacity-50"
            onClick={handleAutoPickUp}
          >
            {claiming ? '…' : '⬇ Pick up'}
          </button>
        ) : (
          <span className="text-[10px] text-gray-600 italic" title="Not enough space in inventory">
            Inventory full
          </span>
        )
      )}
      {(unclaimedItems.length === 0 && !claimed) && (
        <p className="text-[10px] text-teal-600 italic">All items claimed.</p>
      )}
      {claimed && (
        <span className="text-[10px] text-teal-500">✓ Picked up</span>
      )}
    </div>
  ) : null;

  // ── Actions row — dismiss only, right-aligned ───────────────────────────
  const actionsRow = showDismissConfirm ? dismissButton : (
    <div className="flex justify-end pt-1">
      {dismissButton}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Adventure report — redesigned layout ───────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  if (isAdventureReport) {
    const skillXpEntries = Object.entries(report.skillXpAwarded ?? {}).filter(([, v]) => (v as number) > 0);

    return (
      <div className="pt-2 pb-1 space-y-2 border-t border-gray-800 mt-1">
        {/* Damage taken */}
        {(report.damageTaken ?? 0) > 0 && (
          <p className="text-red-400 text-xs font-semibold" style={pop()}>
            💔 −{report.damageTaken} HP
          </p>
        )}

        {/* ── Experience card ── */}
        <div className="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2.5" style={pop()}>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
            Experience
          </p>
          {report.xpAwarded > 0 && (
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-amber-300">Hero</span>
              <span className="text-amber-400 tabular-nums">+{report.xpAwarded.toLocaleString()} XP</span>
            </div>
          )}
          {skillXpEntries.map(([skillId, xp]) => (
            <div key={skillId} className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-purple-300 flex items-center gap-1">
                <SkillIcon skill={skillId as SkillId} size={11} showTooltip={false} />
                {SKILLS[skillId as SkillId]?.name ?? skillId}
              </span>
              <span className="text-purple-400 tabular-nums">+{(xp as number).toLocaleString()} XP</span>
            </div>
          ))}
          {report.xpAwarded === 0 && skillXpEntries.length === 0 && (
            <p className="text-[10px] text-gray-600 italic">No experience gained.</p>
          )}
        </div>

        {/* ── Resources card (only when resources were obtained) ── */}
        {hasResources && (
          <div className="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2.5" style={pop()}>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
              Resources
            </p>
            <div className="space-y-0.5 mb-2">
              {Object.entries(resources)
                .filter(([, v]) => (v as number) > 0)
                .map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400 flex items-center gap-1">
                      <ResourceIcon type={key as ResourceType} size={12} />
                      {RESOURCE_LABELS[key as ResourceType] ?? key}
                    </span>
                    <span className="text-gray-300 tabular-nums">+{(val as number).toLocaleString()}</span>
                  </div>
                ))}
            </div>
            {deposited ? (
              <span className="text-[10px] text-teal-500">✓ Deposited to {heroHomeCityName ?? 'base'}</span>
            ) : heroHomeCityId ? (
              <button
                disabled={depositing}
                className="text-[10px] py-0.5 px-2 rounded bg-blue-900/50 hover:bg-blue-900/80 text-blue-300 border border-blue-900/60 transition active:scale-95 disabled:opacity-50"
                onClick={handleDepositResources}
              >
                {depositing ? '…' : `⬆ Deposit to ${heroHomeCityName ?? 'base'}`}
              </button>
            ) : (
              <span className="text-[10px] text-gray-600 italic">Found a base to claim resources</span>
            )}
          </div>
        )}

        {/* ── Items card (only when items were obtained) ── */}
        {report.items.length > 0 && (
          <div className="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2.5" style={pop()}>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
              Items
            </p>
            {itemGrid}
          </div>
        )}

        {/* Actions */}
        {actionsRow}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Non-adventure report — existing layout ──────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="pt-2 pb-1 space-y-2 border-t border-gray-800 mt-1">
      {/* XP */}
      {report.xpAwarded > 0 && (
        <p className="text-amber-400 text-xs font-semibold" style={pop()}>
          +{report.xpAwarded.toLocaleString()} XP
        </p>
      )}

      {/* Damage taken */}
      {(report.damageTaken ?? 0) > 0 && (
        <p className="text-red-400 text-xs font-semibold" style={pop()}>
          💔 −{report.damageTaken} HP
        </p>
      )}

      {/* Battle report (PvP + garrison) */}
      {(report.activityType === 'player_attack'         ||
        report.activityType === 'player_defence'        ||
        report.activityType === 'domain_claim'          ||
        report.activityType === 'domain_claim_defence'  ||
        report.activityType === 'domain_contest'        ||
        report.activityType === 'domain_contest_defence') &&
        report.meta && (
          <div style={pop()}>
            <BattleReportSection
              meta={report.meta as unknown as FullBattleReport}
              isAttacker={
                report.activityType === 'player_attack' ||
                report.activityType === 'domain_claim'  ||
                report.activityType === 'domain_contest'
              }
            />
          </div>
        )}

      {/* Skill XP */}
      {Object.entries(report.skillXpAwarded ?? {})
        .filter(([, v]) => (v as number) > 0)
        .map(([skillId, xp]) => (
          <div key={skillId} className="flex items-center gap-1 text-sky-400 text-[11px]" style={pop()}>
            <SkillIcon skill={skillId as SkillId} size={14} />
            <span>+{(xp as number).toLocaleString()} XP</span>
          </div>
        ))}

      {/* Resources (skip for PvP — shown inside BattleReportSection to avoid duplication) */}
      {report.activityType !== 'player_attack' && report.activityType !== 'player_defence' &&
        Object.entries(resources)
          .filter(([, v]) => (v as number) > 0)
          .map(([key, val]) => (
            <p key={key} className="text-gray-300 text-[11px]" style={pop()}>
              <ResourceAmount type={key as ResourceType} amount={val as number} size={12} signed />
            </p>
          ))}

      {/* Resource deposit action (skip for PvP — resources are auto-transferred on resolution) */}
      {report.activityType !== 'player_attack' && report.activityType !== 'player_defence' && hasResources && (
        <div className="flex items-center gap-1.5" style={pop()}>
          {deposited ? (
            <span className="text-[10px] text-teal-500">✓ Deposited to {heroHomeCityName ?? 'base'}</span>
          ) : heroHomeCityId ? (
            <button
              disabled={depositing}
              className="text-[10px] py-0.5 px-2 rounded bg-blue-900/50 hover:bg-blue-900/80 text-blue-300 border border-blue-900/60 transition active:scale-95 disabled:opacity-50"
              onClick={handleDepositResources}
            >
              {depositing ? '…' : `⬆ Deposit to ${heroHomeCityName ?? 'base'}`}
            </button>
          ) : (
            <span className="text-[10px] text-gray-600 italic">Found a base to claim resources</span>
          )}
        </div>
      )}

      {/* Items */}
      {report.items.length > 0 && (
        <div style={pop()}>
          <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1 font-semibold">
            Items
          </p>
          {itemGrid}
        </div>
      )}

      {/* No rewards at all */}
      {report.xpAwarded === 0 &&
        Object.values(resources).every((v) => !v) &&
        report.items.length === 0 && (
          <p className="text-gray-600 text-[11px] italic">No rewards.</p>
        )}

      {/* Actions */}
      {actionsRow}
    </div>
  );
}
// ─── Report row (compact feed item) ─────────────────────────────────────────

function ReportRow({
  report,
  onOpen,
}: {
  report: ActivityReport;
  onOpen: () => void;
}) {
  const actName        = ACTIVITY_NAMES[report.activityType] ?? report.activityType;
  const unclaimedCount = report.items.filter((i) => i.location === 'activity_report').length;
  const hasResources   = !report.resourcesClaimed &&
    Object.values((report.resources ?? {}) as Record<string, number>).some((v) => v > 0);

  return (
    <button
      className={[
        'w-full text-left rounded border bg-gray-900/40 shrink-0 px-2 py-1.5',
        'flex items-start gap-1.5 hover:bg-gray-800/40 transition active:scale-[0.99]',
        unclaimedCount > 0 || hasResources ? 'border-teal-800/60' : 'border-gray-800',
      ].join(' ')}
      onClick={onOpen}
    >
      {/* Unread dot */}
      <span
        className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full"
        style={{ background: report.viewed ? 'transparent' : '#f59e0b' }}
      />

      <div className="flex-1 min-w-0">
        <p className={`text-[11px] leading-tight truncate ${report.viewed ? 'text-gray-400' : 'text-white font-semibold'}`}>
          {actName}
        </p>
        {(report.heroName || report.cityName) && (
          <p className="text-[9px] flex flex-wrap gap-x-2 mt-0.5">
            {report.heroName && (
              <span className="text-indigo-400">⚔ {report.heroName}</span>
            )}
            {report.cityName && (
              <span className="text-emerald-600">🏰 {report.cityName}</span>
            )}
          </p>
        )}
        <p className="text-[9px] text-gray-700 mt-0.5 flex items-center gap-1.5 flex-wrap">
          {timeAgo(report.completedAt)}
          {unclaimedCount > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-teal-900/60 border border-teal-700/50 text-teal-300 font-semibold leading-none">
              📦 {unclaimedCount} item{unclaimedCount !== 1 ? 's' : ''}
            </span>
          )}
          {hasResources && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-900/50 border border-amber-700/50 text-amber-300 font-semibold leading-none">
              ⚡ resources
            </span>
          )}
        </p>
      </div>

      {/* Open hint */}
      <span className="text-gray-700 text-[10px] mt-0.5 shrink-0">›</span>
    </button>
  );
}

// ─── ReportsPanel ─────────────────────────────────────────────────────────────

export default function ReportsPanel() {
  const { token } = useAuth();
  const { reportRefreshSignal } = useGameInventory();
  const [reports,      setReports]      = useState<ActivityReport[]>([]);
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<ActivityReport[]>('/activity-reports', { token });
      setReports(data);
    } catch { /* non-fatal */ }
  }, [token]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // Re-fetch whenever a manual drag-to-inventory claim happens
  useEffect(() => {
    if (reportRefreshSignal > 0) fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportRefreshSignal]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('adventure:complete',    fetchReports);
    socket.on('attack:complete',        fetchReports);
    socket.on('base:attacked',          fetchReports);
    socket.on('domain:claimResult',     fetchReports);
    socket.on('domain:contestResult',   fetchReports);
    socket.on('domain:defended',        fetchReports);
    return () => {
      socket.off('adventure:complete',  fetchReports);
      socket.off('attack:complete',     fetchReports);
      socket.off('base:attacked',       fetchReports);
      socket.off('domain:claimResult',  fetchReports);
      socket.off('domain:contestResult', fetchReports);
      socket.off('domain:defended',     fetchReports);
    };
  }, [fetchReports]);

  const removeReport = useCallback((id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    setOpenReportId(null);
  }, []);

  const openReport = useCallback((report: ActivityReport) => {
    setOpenReportId(report.id);
    // Mark as viewed
    if (!report.viewed && token) {
      apiFetch(`/activity-reports/${report.id}/view`, {
        method: 'POST',
        token,
        body: JSON.stringify({}),
      })
        .then(() => setReports((prev) =>
          prev.map((r) => r.id === report.id ? { ...r, viewed: true } : r),
        ))
        .catch(() => {});
    }
  }, [token]);

  const unreadCount = reports.filter((r) => !r.viewed).length;

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-2">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <p
          className="uppercase tracking-[0.18em] text-[10px] font-semibold"
          style={{ color: 'var(--hud-border)' }}
        >
          Reports
        </p>
        {unreadCount > 0 && (
          <span className="text-[9px] font-bold text-amber-400 bg-amber-900/40 border border-amber-800/60 rounded-full px-1.5 py-0.5 leading-none">
            {unreadCount}
          </span>
        )}
      </div>

      {reports.length === 0 ? (
        <p className="text-gray-700 italic text-[11px]">No reports.</p>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-y-auto min-h-0 flex-1">
          {reports.slice(0, 30).map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              onOpen={() => openReport(r)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {openReportId && (() => {
        const report = reports.find((r) => r.id === openReportId);
        if (!report) return null;
        const actName = ACTIVITY_NAMES[report.activityType] ?? report.activityType;
        const subtitle = [report.heroName, report.cityName].filter(Boolean).join(' · ');
        return (
          <Modal
            title={subtitle ? `${actName} — ${subtitle}` : actName}
            onClose={() => setOpenReportId(null)}
          >
            <ReportDetail
              report={report}
              token={token ?? ''}
              onDismiss={() => removeReport(report.id)}
              onClaimed={fetchReports}
              onDeposited={() =>
                setReports((prev) =>
                  prev.map((r) => r.id === report.id ? { ...r, resourcesClaimed: true } : r),
                )
              }
              animate={!report.viewed}
            />
          </Modal>
        );
      })()}
    </div>
  );
}
