'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UNIT_LIST, computeMarchTimeSeconds } from '@rpg/shared';
import type { MapTile, TroopMap, UnitId, Base } from '@rpg/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60 > 0 ? ` ${secs % 60}s` : ''}`.trim();
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
  { border: 'border-red-700/60',    active: 'bg-red-950/60',   label: 'text-red-300'    },
  { border: 'border-orange-700/60', active: 'bg-orange-950/50',label: 'text-orange-300' },
  { border: 'border-amber-700/60',  active: 'bg-amber-950/40', label: 'text-amber-300'  },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface AttackModalProps {
  targetTile: MapTile;
  onClose:    () => void;
  onSuccess:  () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AttackModal({ targetTile, onClose, onSuccess }: AttackModalProps) {
  const { token } = useAuth();

  const [bases,          setBases]          = useState<Base[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [waves, setWaves] = useState<[TroopMap, TroopMap, TroopMap]>([{}, {}, {}]);
  const [activeWave,     setActiveWave]     = useState(0);
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

  const selectedBase = useMemo(
    () => bases.find((b) => b.id === selectedBaseId) ?? null,
    [bases, selectedBaseId],
  );
  const garrison = (selectedBase?.troops ?? {}) as TroopMap;

  // ── Total committed per unit across all waves ─────────────────────────────
  const totalCommitted = useMemo(() => {
    const totals: Partial<Record<UnitId, number>> = {};
    for (const wave of waves) {
      for (const [uid, cnt] of Object.entries(wave) as [UnitId, number][]) {
        totals[uid] = (totals[uid] ?? 0) + (cnt ?? 0);
      }
    }
    return totals;
  }, [waves]);

  // ── Max available for active wave (garrison minus other-wave commitments) ─
  const availableForWave = useMemo(() => {
    const avail: Partial<Record<UnitId, number>> = {};
    for (const u of UNIT_LIST) {
      const otherWaves = (totalCommitted[u.id] ?? 0) - (waves[activeWave][u.id] ?? 0);
      avail[u.id] = Math.max(0, (garrison[u.id] ?? 0) - otherWaves);
    }
    return avail;
  }, [garrison, waves, activeWave, totalCommitted]);

  // ── March time estimate ───────────────────────────────────────────────────
  const marchSecs = useMemo(() => {
    if (!selectedBase) return null;
    const anyTroops = Object.values(totalCommitted).some((n) => (n ?? 0) > 0);
    if (!anyTroops) return null;
    return computeMarchTimeSeconds(
      selectedBase.x, selectedBase.y,
      targetTile.x, targetTile.y,
      waves,
    );
  }, [selectedBase, totalCommitted, waves, targetTile]);

  const distance = selectedBase
    ? Math.hypot(targetTile.x - selectedBase.x, targetTile.y - selectedBase.y).toFixed(1)
    : null;

  const totalTroops = Object.values(totalCommitted).reduce((s, n) => s + (n ?? 0), 0);

  // ── Wave editing helpers ──────────────────────────────────────────────────
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

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleLaunch() {
    if (!selectedBaseId || totalTroops === 0 || !targetTile.baseId) return;
    setError('');
    setLoading(true);
    try {
      await apiFetch('/attack', {
        method: 'POST',
        token:  token ?? undefined,
        body:   JSON.stringify({
          attackerCityId: selectedBaseId,
          targetCityId:   targetTile.baseId,
          waves,
        }),
      });
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Attack failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-red-800/60 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 bg-red-950/60 border-b border-red-800/40">
          <div>
            <p className="text-red-300 font-bold text-sm tracking-wide">⚔ ATTACK</p>
            <p className="text-gray-300 text-xs">
              {targetTile.baseName ?? 'Enemy Base'}
              {targetTile.ownerUsername && (
                <span className="text-gray-500"> — {targetTile.ownerUsername}</span>
              )}
              {distance && <span className="text-gray-600 ml-2">· {distance} tiles</span>}
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
          {/* ── Source base selector ── */}
          {loadingBases ? (
            <p className="text-xs text-gray-600 text-center animate-pulse">Loading garrison…</p>
          ) : bases.length > 1 ? (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">
                Attack from
              </label>
              <select
                value={selectedBaseId ?? ''}
                onChange={(e) => setSelectedBaseId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-amber-600"
              >
                {bases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

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
                    Wave {i + 1}
                    {wCount > 0 && (
                      <span className="ml-1 text-[10px] opacity-75">({wCount})</span>
                    )}
                  </button>
                );
              })}
            </div>

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
                Estimated march:{' '}
                <span className="text-amber-300 font-medium">{formatDuration(marchSecs)}</span>
                <span className="text-gray-600 ml-1">(slowest unit sets pace)</span>
              </p>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={handleLaunch}
            disabled={loading || totalTroops === 0 || !selectedBaseId || !targetTile.baseId}
            className="w-full bg-red-800 hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600
              text-red-100 font-bold py-2.5 rounded-xl transition text-sm tracking-wide"
          >
            {loading
              ? 'Dispatching…'
              : totalTroops === 0
              ? 'Assign troops to waves first'
              : `⚔ Launch Attack — ${totalTroops} troops`}
          </button>
        </div>
      </div>
    </div>
  );
}
