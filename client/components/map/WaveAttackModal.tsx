'use client';

/**
 * WaveAttackModal — unified modal for all three "send troops" actions:
 *   mode="attack"  → attack an enemy city         (red theme)
 *   mode="contest" → attack an enemy domain tile   (red theme)
 *   mode="claim"   → claim a neutral domain tile   (blue theme)
 *
 * AttackModal and ClaimModal are thin wrappers that set the mode and forward
 * all props here.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  UNIT_LIST,
  TILE_DEFS,
  computeMarchTimeSeconds,
  computeExtraDomainCapacity,
} from '@rpg/shared';
import type { MapTile, TroopMap, UnitId, Base, DomainTile, CityBuilding } from '@rpg/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m${secs % 60 > 0 ? ` ${secs % 60}s` : ''}`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const CATEGORY_ICON: Record<string, string> = {
  infantry: '🗡️',
  ranged:   '🏹',
  cavalry:  '🐴',
  siege:    '🪨',
};

// ─── Wave styling — consistent across all modes ───────────────────────────────

const WAVE_STYLE = [
  { border: 'border-red-700/60',    active: 'bg-red-950/60',    label: 'text-red-300'    },
  { border: 'border-orange-700/60', active: 'bg-orange-950/50', label: 'text-orange-300' },
  { border: 'border-amber-700/60',  active: 'bg-amber-950/40',  label: 'text-amber-300'  },
] as const;

const WAVE_LABELS = ['Wave 1', '⚔ Counter', 'Wave 3'] as const;

// ─── Per-mode theme ───────────────────────────────────────────────────────────

type Mode = 'attack' | 'contest' | 'claim';

const THEME: Record<Mode, {
  modalBorder:  string;
  headerBg:     string;
  headerBorder: string;
  accentText:   string;
  label:        string;
  btnBg:        string;
  selectFocus:  string;
}> = {
  attack: {
    modalBorder:  'border-red-800/60',
    headerBg:     'bg-red-950/60',
    headerBorder: 'border-red-800/40',
    accentText:   'text-red-300',
    label:        '⚔ ATTACK',
    btnBg:        'bg-red-800 hover:bg-red-700 text-red-100',
    selectFocus:  'focus:border-red-600',
  },
  contest: {
    modalBorder:  'border-red-800/60',
    headerBg:     'bg-red-950/60',
    headerBorder: 'border-red-800/40',
    accentText:   'text-red-300',
    label:        '⚔ CONTEST',
    btnBg:        'bg-red-800 hover:bg-red-700 text-red-100',
    selectFocus:  'focus:border-red-600',
  },
  claim: {
    modalBorder:  'border-blue-800/60',
    headerBg:     'bg-blue-950/60',
    headerBorder: 'border-blue-800/40',
    accentText:   'text-blue-300',
    label:        '🏴 CLAIM',
    btnBg:        'bg-blue-800 hover:bg-blue-700 text-blue-100',
    selectFocus:  'focus:border-blue-600',
  },
};

// ─── Props & domain status ───────────────────────────────────────────────────

interface DomainStatus {
  isAdjacent:    boolean;
  used:          number;
  extraCapacity: number;
}

export interface WaveAttackModalProps {
  mode:      Mode;
  targetTile: MapTile;
  onClose:   () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WaveAttackModal({
  mode,
  targetTile,
  onClose,
  onSuccess,
}: WaveAttackModalProps) {
  const { token } = useAuth();
  const theme     = THEME[mode];
  const isDomain  = mode === 'contest' || mode === 'claim';

  const [bases,          setBases]          = useState<Base[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [waves,          setWaves]          = useState<[TroopMap, TroopMap, TroopMap]>([{}, {}, {}]);
  const [activeWave,     setActiveWave]     = useState(0);
  const [domainStatus,   setDomainStatus]   = useState<DomainStatus | null>(null);
  const [loadingBases,   setLoadingBases]   = useState(true);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');

  // ── Fetch player bases ────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch<{ cities: Base[] }>('/bases', { token: token ?? undefined })
      .then(({ cities }) => {
        setBases(cities);
        if (cities.length > 0) setSelectedBaseId(cities[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingBases(false));
  }, [token]);

  // ── Fetch adjacency / capacity status (claim + contest modes) ─────────────
  useEffect(() => {
    if (!['claim', 'contest'].includes(mode) || !selectedBaseId || !token) return;
    apiFetch<{ domainTiles: DomainTile[] }>(`/domain?cityId=${selectedBaseId}`, { token })
      .then(({ domainTiles }) => {
        const base = bases.find((b) => b.id === selectedBaseId);
        if (!base) return;
        const extraCapacity = computeExtraDomainCapacity(base.buildings as CityBuilding[]);
        const ownCoords = new Set<string>([`${base.x},${base.y}`]);
        for (const dt of domainTiles) ownCoords.add(`${dt.x},${dt.y}`);
        const isAdjacent =
          ownCoords.has(`${targetTile.x - 1},${targetTile.y}`) ||
          ownCoords.has(`${targetTile.x + 1},${targetTile.y}`) ||
          ownCoords.has(`${targetTile.x},${targetTile.y - 1}`) ||
          ownCoords.has(`${targetTile.x},${targetTile.y + 1}`);
        setDomainStatus({ isAdjacent, used: domainTiles.length, extraCapacity });
      })
      .catch(() => {});
  }, [mode, selectedBaseId, token, bases, targetTile]);

  const selectedBase = useMemo(
    () => bases.find((b) => b.id === selectedBaseId) ?? null,
    [bases, selectedBaseId],
  );
  const garrison = (selectedBase?.troops ?? {}) as TroopMap;

  // ── Wave helpers ──────────────────────────────────────────────────────────
  const totalCommitted = useMemo(() => {
    const out: Partial<Record<UnitId, number>> = {};
    for (const wave of waves)
      for (const [uid, cnt] of Object.entries(wave) as [UnitId, number][])
        if (cnt) out[uid] = (out[uid] ?? 0) + cnt;
    return out;
  }, [waves]);

  const availableForWave = useMemo(() => {
    const avail: Partial<Record<UnitId, number>> = {};
    for (const u of UNIT_LIST) {
      const otherWaves = (totalCommitted[u.id] ?? 0) - (waves[activeWave][u.id] ?? 0);
      avail[u.id] = Math.max(0, (garrison[u.id] ?? 0) - otherWaves);
    }
    return avail;
  }, [garrison, waves, activeWave, totalCommitted]);

  function setCount(waveIdx: number, uid: UnitId, value: number) {
    const maxForWave = Math.max(
      0,
      (garrison[uid] ?? 0) - ((totalCommitted[uid] ?? 0) - (waves[waveIdx][uid] ?? 0)),
    );
    setWaves((prev) => {
      const next = [...prev] as [TroopMap, TroopMap, TroopMap];
      next[waveIdx] = { ...next[waveIdx], [uid]: Math.max(0, Math.min(value, maxForWave)) };
      return next;
    });
  }

  // ── March time ────────────────────────────────────────────────────────────
  const marchSecs = useMemo(() => {
    if (!selectedBase) return null;
    if (!waves.some((w) => Object.values(w).some((n) => (n ?? 0) > 0))) return null;
    return computeMarchTimeSeconds(
      selectedBase.x, selectedBase.y,
      targetTile.x,   targetTile.y,
      waves,
    );
  }, [selectedBase, waves, targetTile]);

  const distance = selectedBase
    ? Math.hypot(targetTile.x - selectedBase.x, targetTile.y - selectedBase.y).toFixed(1)
    : null;

  const totalTroops = Object.values(totalCommitted).reduce((s, n) => s + (n ?? 0), 0);

  // ── canSubmit ─────────────────────────────────────────────────────────────
  const canSubmit = useMemo(() => {
    if (totalTroops === 0 || !selectedBaseId) return false;
    if (mode === 'attack')  return !!targetTile.baseId;
    if (mode === 'contest') return true;
    // claim: always allowed — troops march regardless of adjacency; server handles gracefully
    return true;
  }, [mode, totalTroops, selectedBaseId, targetTile.baseId, domainStatus]);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!selectedBaseId || !canSubmit || !token) return;
    setError('');
    setLoading(true);
    try {
      if (mode === 'attack') {
        await apiFetch('/attack', {
          method: 'POST',
          token,
          body: JSON.stringify({
            attackerCityId: selectedBaseId,
            targetCityId:   targetTile.baseId,
            waves,
          }),
        });
      } else if (mode === 'contest') {
        await apiFetch('/domain/contest', {
          method: 'POST',
          token,
          body: JSON.stringify({ cityId: selectedBaseId, targetX: targetTile.x, targetY: targetTile.y, waves }),
        });
      } else {
        await apiFetch('/domain/claim', {
          method: 'POST',
          token,
          body: JSON.stringify({ cityId: selectedBaseId, targetX: targetTile.x, targetY: targetTile.y, waves }),
        });
      }
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send troops');
    } finally {
      setLoading(false);
    }
  }

  const tileDef = isDomain ? TILE_DEFS[targetTile.type as keyof typeof TILE_DEFS] : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-gray-900 border ${theme.modalBorder} rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className={`flex items-center justify-between px-5 py-3 ${theme.headerBg} border-b ${theme.headerBorder}`}>
          <div>
            <p className={`font-bold text-sm tracking-wide ${theme.accentText}`}>
              {theme.label}
            </p>
            <p className="text-gray-300 text-xs">
              {mode === 'attack' ? (
                <>
                  {targetTile.baseName ?? 'Enemy Base'}
                  {targetTile.ownerUsername && (
                    <span className="text-gray-500"> — {targetTile.ownerUsername}</span>
                  )}
                  {distance && (
                    <span className="text-gray-600 ml-2">· {distance} tiles</span>
                  )}
                </>
              ) : (
                <>
                  ({targetTile.x}, {targetTile.y})
                  {tileDef && <span className="text-gray-500 ml-2">· {tileDef.label}</span>}
                  {targetTile.domainOwnerUsername && mode === 'contest' && (
                    <span className="text-gray-500 ml-2">— {targetTile.domainOwnerUsername}</span>
                  )}
                  {distance && (
                    <span className="text-gray-600 ml-2">· {distance} tiles</span>
                  )}
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-300 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* ── Resource bonus (domain only) ── */}
          {tileDef?.resourceBonus && Object.keys(tileDef.resourceBonus).length > 0 && (
            <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 px-3 py-2 text-xs flex flex-wrap gap-x-3 gap-y-0.5 text-green-400">
              {Object.entries(tileDef.resourceBonus).map(([res, pct]) => (
                <span key={res}>+{pct}% {res}</span>
              ))}
              <span className="text-gray-500 ml-1">bonus while held</span>
            </div>
          )}

          {/* ── Contest notice ── */}
          {mode === 'contest' && (
            <div className={`rounded-lg border px-3 py-2 text-xs space-y-1 ${
              domainStatus?.isAdjacent && domainStatus.used < domainStatus.extraCapacity
                ? 'bg-red-900/20 border-red-700/40 text-red-300'
                : 'bg-red-900/20 border-red-700/40 text-red-300'
            }`}>
              <p>⚔ <strong>Contesting enemy territory</strong>: your troops fight the garrison across 3 waves.</p>
              {domainStatus && (
                domainStatus.isAdjacent && domainStatus.used < domainStatus.extraCapacity ? (
                  <p className="text-green-400/80">🏴 Adjacent to your domain — this tile will be occupied after victory.</p>
                ) : domainStatus.isAdjacent ? (
                  <p className="text-amber-400/70">⚠ Domain full — the garrison will be destroyed but the tile won't be claimed.</p>
                ) : (
                  <p className="text-red-400/70">This tile is too far from your domain to capture — you can destroy the garrison.</p>
                )
              )}
            </div>
          )}

          {/* ── Domain status (claim mode only) ── */}
          {mode === 'claim' && domainStatus && (
            <div className={`rounded-lg border px-3 py-2 text-xs space-y-1 ${
              !domainStatus.isAdjacent
                ? 'bg-red-900/20 border-red-700/40 text-red-300'
                : domainStatus.used >= domainStatus.extraCapacity
                ? 'bg-amber-900/20 border-amber-700/40 text-amber-300'
                : 'bg-blue-900/20 border-blue-700/40 text-blue-300'
            }`}>
              {!domainStatus.isAdjacent ? (
                <p>⚔ Tile is out of domain range — troops will march but cannot capture this territory.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span>Domain slots</span>
                    <span className="font-mono">{domainStatus.used} / {domainStatus.extraCapacity}</span>
                  </div>
                  {domainStatus.used >= domainStatus.extraCapacity && (
                    <p>⚠ Domain full — troops will march but the tile won't be claimed. Upgrade buildings to expand capacity.</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Source base selector ── */}
          {loadingBases ? (
            <p className="text-xs text-gray-600 text-center animate-pulse">Loading garrison…</p>
          ) : bases.length === 0 ? (
            <p className="text-xs text-red-400">You have no bases.</p>
          ) : bases.length > 1 ? (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">
                {mode === 'attack' ? 'Attack from' : 'Send from'}
              </label>
              <select
                value={selectedBaseId ?? ''}
                onChange={(e) => {
                  setSelectedBaseId(e.target.value);
                  setWaves([{}, {}, {}]);
                  setActiveWave(0);
                }}
                className={`w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none ${theme.selectFocus}`}
              >
                {bases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.x}, {b.y})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* ── Wave tabs ── */}
          <div>
            <div className="flex gap-1 mb-2">
              {([0, 1, 2] as const).map((i) => {
                const count = Object.values(waves[i]).reduce((s, n) => s + (n ?? 0), 0);
                const s = WAVE_STYLE[i];
                return (
                  <button
                    key={i}
                    onClick={() => setActiveWave(i)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold border transition
                      ${activeWave === i
                        ? `${s.border} ${s.active} ${s.label}`
                        : 'border-gray-700 bg-gray-800/40 text-gray-500 hover:border-gray-600'
                      }`}
                  >
                    {WAVE_LABELS[i]}
                    {count > 0 && (
                      <span className="ml-1 text-[10px] opacity-75">({count})</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Wave 2 hint */}
            {activeWave === 1 && (
              <p className="text-xs text-orange-400/80 mb-2">
                ⚔ In wave 2 the defender counter-attacks. Place your strongest troops here.
              </p>
            )}

            {/* ── Unit rows ── */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {UNIT_LIST.map((u) => {
                const inGarrison = garrison[u.id] ?? 0;
                const inThisWave = waves[activeWave][u.id] ?? 0;
                const maxForWave = availableForWave[u.id] ?? 0;
                const disabled   = inGarrison === 0;

                return (
                  <div
                    key={u.id}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs
                      ${disabled ? 'bg-gray-800/20 opacity-40' : 'bg-gray-800/60'}`}
                  >
                    <span className="text-sm shrink-0">{CATEGORY_ICON[u.category]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 font-medium truncate">{u.name}</p>
                      <p className="text-gray-600 text-[10px]">
                        Garrison: {inGarrison}
                        {(totalCommitted[u.id] ?? 0) > 0 && (
                          <span> · Committed: {totalCommitted[u.id]}</span>
                        )}
                        {u.category === 'siege' && (
                          <span className="text-amber-700"> · Slows march</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        disabled={disabled || inThisWave === 0}
                        onClick={() => setCount(activeWave, u.id, inThisWave - 1)}
                        className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-25 text-gray-200 font-bold transition"
                      >−</button>
                      <span className="w-8 text-center text-white font-mono tabular-nums text-xs">
                        {inThisWave}
                      </span>
                      <button
                        disabled={disabled || inThisWave >= maxForWave}
                        onClick={() => setCount(activeWave, u.id, inThisWave + 1)}
                        className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-25 text-gray-200 font-bold transition"
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Summary bar ── */}
          <div className="bg-gray-800/50 rounded-lg px-3 py-2 text-xs space-y-1">
            <div className="flex items-center gap-4 text-gray-400">
              <span>Waves:</span>
              {([0, 1, 2] as const).map((i) => {
                const c = Object.values(waves[i]).reduce((s, n) => s + (n ?? 0), 0);
                return (
                  <span key={i} className={WAVE_STYLE[i].label}>
                    W{i + 1}: {c}
                  </span>
                );
              })}
            </div>
            {marchSecs !== null && (
              <p className="text-gray-500">
                March:{' '}
                <span className="text-amber-300 font-medium">{formatDuration(Math.round(marchSecs))}</span>
                <span className="text-gray-600 ml-1">(slowest unit sets pace)</span>
              </p>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          {/* ── Actions ── */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl py-2 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !canSubmit}
              className={`flex-1 font-bold py-2.5 rounded-xl transition text-sm tracking-wide
                disabled:bg-gray-800 disabled:text-gray-600 ${theme.btnBg}`}
            >
              {loading
                ? 'Dispatching…'
                : totalTroops === 0
                ? 'Assign troops first'
                : mode === 'attack'
                ? `⚔ Launch Attack — ${totalTroops} troops`
                : mode === 'contest'
                ? `⚔ Contest — ${totalTroops} troops`
                : `🏴 Claim — ${totalTroops} troops`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
