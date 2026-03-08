'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UNIT_LIST, TILE_DEFS, computeMarchTimeSeconds, computeExtraDomainCapacity } from '@rpg/shared';
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

const WAVE_STYLE = [
  { border: 'border-blue-700/60',   active: 'bg-blue-950/60',   label: 'text-blue-300'   },
  { border: 'border-orange-700/60', active: 'bg-orange-950/50', label: 'text-orange-300' },
  { border: 'border-amber-700/60',  active: 'bg-amber-950/40',  label: 'text-amber-300'  },
] as const;

const WAVE_LABELS = ['1st Strike', '⚔ Counter', 'Final Push'] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClaimModalProps {
  targetTile: MapTile;
  onClose:    () => void;
  onSuccess:  () => void;
}

interface DomainStatus {
  domainTiles:   DomainTile[];
  extraCapacity: number;
  used:          number;
  isAdjacent:    boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClaimModal({ targetTile, onClose, onSuccess }: ClaimModalProps) {
  const { token } = useAuth();

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

  // ── Fetch domain status for selected base ────────────────────────────────
  useEffect(() => {
    if (!selectedBaseId || !token) return;
    apiFetch<{ domainTiles: DomainTile[] }>(`/domain?cityId=${selectedBaseId}`, { token })
      .then(({ domainTiles }) => {
        const base = bases.find((b) => b.id === selectedBaseId);
        if (!base) return;

        const extraCapacity = computeExtraDomainCapacity(base.buildings as CityBuilding[]);
        const ownCoords     = new Set<string>([`${base.x},${base.y}`]);
        for (const dt of domainTiles) ownCoords.add(`${dt.x},${dt.y}`);

        const isAdjacent =
          ownCoords.has(`${targetTile.x - 1},${targetTile.y}`) ||
          ownCoords.has(`${targetTile.x + 1},${targetTile.y}`) ||
          ownCoords.has(`${targetTile.x},${targetTile.y - 1}`) ||
          ownCoords.has(`${targetTile.x},${targetTile.y + 1}`);

        setDomainStatus({ domainTiles, extraCapacity, used: domainTiles.length, isAdjacent });
      })
      .catch(() => {});
  }, [selectedBaseId, token, bases, targetTile]);

  const selectedBase = useMemo(
    () => bases.find((b) => b.id === selectedBaseId) ?? null,
    [bases, selectedBaseId],
  );
  const garrison = (selectedBase?.troops ?? {}) as TroopMap;

  // ── Wave state helpers ────────────────────────────────────────────────────

  /** Per-unit total committed across all 3 waves. */
  const totalCommitted = useMemo(() => {
    const out: Partial<Record<UnitId, number>> = {};
    for (const wave of waves) {
      for (const [uid, cnt] of Object.entries(wave) as [UnitId, number][]) {
        if (cnt) out[uid as UnitId] = (out[uid as UnitId] ?? 0) + cnt;
      }
    }
    return out;
  }, [waves]);

  /** Max each unit can be assigned in the active wave (garrison minus other waves). */
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
    const clamped = Math.max(0, Math.min(value, maxForWave));
    setWaves((prev) => {
      const next = [...prev] as [TroopMap, TroopMap, TroopMap];
      next[waveIdx] = { ...next[waveIdx], [uid]: clamped };
      return next;
    });
  }

  // ── March time estimate ───────────────────────────────────────────────────
  const marchSecs = useMemo(() => {
    if (!selectedBase) return null;
    const anyTroops = waves.some((w) => Object.values(w).some((n) => (n ?? 0) > 0));
    if (!anyTroops) return null;
    return computeMarchTimeSeconds(
      selectedBase.x, selectedBase.y,
      targetTile.x,   targetTile.y,
      waves,
    );
  }, [selectedBase, waves, targetTile]);

  const totalTroops = Object.values(totalCommitted).reduce((s, n) => s + (n ?? 0), 0);

  // Contest mode: enemy garrison exists but tile is not adjacent to our domain
  const isContestMode = !!targetTile.domainCityId && domainStatus !== null && !domainStatus.isAdjacent;

  // ── Tile info ─────────────────────────────────────────────────────────────
  const tileDef = TILE_DEFS[targetTile.type as keyof typeof TILE_DEFS];

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleClaim = async () => {
    if (!selectedBaseId || !token) return;
    if (totalTroops === 0) { setError('Assign at least one troop to a wave.'); return; }
    setLoading(true);
    setError('');
    try {
      if (isContestMode) {
        await apiFetch('/domain/contest', {
          method: 'POST',
          token,
          body: JSON.stringify({
            cityId:  selectedBaseId,
            targetX: targetTile.x,
            targetY: targetTile.y,
            waves,
          }),
        });
      } else {
        await apiFetch('/domain/claim', {
          method: 'POST',
          token,
          body: JSON.stringify({
            cityId:  selectedBaseId,
            targetX: targetTile.x,
            targetY: targetTile.y,
            waves,
          }),
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send troops');
    } finally {
      setLoading(false);
    }
  };

  const canClaim = isContestMode
    ? totalTroops > 0
    : (domainStatus?.isAdjacent ?? false) &&
      (domainStatus ? domainStatus.used < domainStatus.extraCapacity : false) &&
      totalTroops > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-blue-800/60 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${
          isContestMode
            ? 'bg-orange-950/60 border-orange-800/40'
            : 'bg-blue-950/60 border-blue-800/40'
        }`}>
          <div>
            <p className={`font-bold text-sm tracking-wide ${isContestMode ? 'text-orange-300' : 'text-blue-300'}`}>
              {isContestMode ? '⚔ CONTEST' : '🏴 CLAIM'}
            </p>
            <p className="text-gray-300 text-xs">
              ({targetTile.x}, {targetTile.y})
              {tileDef && <span className="text-gray-500 ml-2">· {tileDef.label}</span>}
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
          {/* ── Tile resource bonus ── */}
          {tileDef?.resourceBonus && Object.keys(tileDef.resourceBonus).length > 0 && (
            <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 px-3 py-2 text-xs flex flex-wrap gap-x-3 gap-y-0.5 text-green-400">
              {Object.entries(tileDef.resourceBonus).map(([res, pct]) => (
                <span key={res}>+{pct}% {res}</span>
              ))}
              <span className="text-gray-500 ml-1">bonus while held</span>
            </div>
          )}

          {/* ── Enemy domain warning ── */}
          {targetTile.domainCityId && (
            isContestMode ? (
              <div className="rounded-lg bg-orange-900/30 border border-orange-700/40 px-3 py-2 text-xs text-orange-300 space-y-1">
                <p>⚔ <strong>Contest (non-adjacent)</strong>: your troops fight the garrison across 3 waves.</p>
                <p className="text-orange-400/80">Wave 2 is a defender counter-attack. If you win, the garrison is destroyed and the tile becomes unclaimed.</p>
              </div>
            ) : (
              <div className="rounded-lg bg-red-900/30 border border-red-700/40 px-3 py-2 text-xs text-red-300">
                ⚠ This tile belongs to <strong>{targetTile.domainOwnerUsername ?? 'another player'}</strong>.
                {' '}Your troops will fight the garrison in 3 waves (wave 2 = defender counter-attack).
              </div>
            )
          )}

          {/* ── Source base selector ── */}
          {loadingBases ? (
            <p className="text-xs text-gray-600 text-center animate-pulse">Loading garrison…</p>
          ) : bases.length === 0 ? (
            <p className="text-xs text-red-400">You have no bases.</p>
          ) : bases.length > 1 ? (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">
                Send from
              </label>
              <select
                value={selectedBaseId ?? ''}
                onChange={(e) => {
                  setSelectedBaseId(e.target.value);
                  setWaves([{}, {}, {}]);
                  setActiveWave(0);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-600"
              >
                {bases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.x},{b.y})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* ── Domain capacity (hidden in contest mode) ── */}
          {domainStatus && !isContestMode && (
            <div className={`rounded-lg border px-3 py-2 text-xs space-y-1 ${
              domainStatus.isAdjacent && domainStatus.used < domainStatus.extraCapacity
                ? 'bg-blue-900/20 border-blue-700/40 text-blue-300'
                : 'bg-red-900/20 border-red-700/40 text-red-300'
            }`}>
              <div className="flex items-center justify-between">
                <span>Domain slots</span>
                <span className="font-mono">{domainStatus.used} / {domainStatus.extraCapacity}</span>
              </div>
              {!domainStatus.isAdjacent && (
                <p className="text-yellow-400">⚠ Tile not adjacent to your domain.</p>
              )}
              {domainStatus.isAdjacent && domainStatus.used >= domainStatus.extraCapacity && (
                <p>Domain full — upgrade buildings to expand capacity.</p>
              )}
            </div>
          )}

          {/* ── Wave tabs ── */}
          <div>
            <div className="flex gap-1 mb-3">
              {([0, 1, 2] as const).map((i) => {
                const wCount = Object.values(waves[i]).reduce((s, n) => s + (n ?? 0), 0);
                const s = WAVE_STYLE[i];
                return (
                  <button
                    key={i}
                    onClick={() => setActiveWave(i)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold border transition
                      ${
                        activeWave === i
                          ? `${s.border} ${s.active} ${s.label}`
                          : 'border-gray-700 bg-gray-800/40 text-gray-500 hover:border-gray-600'
                      }`}
                  >
                    {WAVE_LABELS[i]}
                    {wCount > 0 && (
                      <span className="ml-1 text-[10px] opacity-75">({wCount})</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Wave 2 hint */}
            {activeWave === 1 && (
              <p className="text-xs text-orange-400/80 mb-2">
                ⚔ In wave 2 the defender counter-attacks. Place your strongest troops here to absorb the hit.
              </p>
            )}

            {/* ── Unit rows for active wave ── */}
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
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-white font-mono tabular-nums text-xs">
                        {inThisWave}
                      </span>
                      <button
                        disabled={disabled || inThisWave >= maxForWave}
                        onClick={() => setCount(activeWave, u.id, inThisWave + 1)}
                        className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-25 text-gray-200 font-bold transition"
                      >
                        +
                      </button>
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
              onClick={handleClaim}
              disabled={loading || !canClaim}
              className={`flex-1 font-bold py-2.5 rounded-xl transition text-sm tracking-wide
                disabled:bg-gray-800 disabled:text-gray-600
                ${isContestMode
                  ? 'bg-orange-800 hover:bg-orange-700 text-orange-100'
                  : 'bg-blue-800 hover:bg-blue-700 text-blue-100'
                }`}
            >
              {loading
                ? 'Sending…'
                : totalTroops === 0
                ? 'Assign troops to waves first'
                : isContestMode
                ? `⚔ Contest — ${totalTroops} troops`
                : `🏴 Claim — ${totalTroops} troops`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
