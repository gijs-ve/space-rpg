'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UNIT_LIST, TILE_DEFS, computeMarchTimeSeconds } from '@rpg/shared';
import type { MapTile, TroopMap, UnitId, Base, DomainTile } from '@rpg/shared';
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface RecallModalProps {
  tile:      MapTile;
  onClose:   () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecallModal({ tile, onClose, onSuccess }: RecallModalProps) {
  const { token } = useAuth();

  const [domainTile, setDomainTile] = useState<DomainTile | null>(null);
  const [base,       setBase]       = useState<Base | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [fetching,   setFetching]   = useState(true);
  const [error,      setError]      = useState('');

  // troops selected for recall, keyed by unit id
  const [selected, setSelected] = useState<Partial<Record<UnitId, number>>>({});

  // ── Fetch the specific domain tile + base info ────────────────────────────
  useEffect(() => {
    if (!token || !tile.domainCityId) return;

    const fetchData = async () => {
      try {
        const [domainRes, basesRes] = await Promise.all([
          apiFetch<{ domainTiles: DomainTile[] }>(`/domain?cityId=${tile.domainCityId}`, { token }),
          apiFetch<{ cities: Base[] }>('/bases', { token }),
        ]);
        const dt   = domainRes.domainTiles.find((d) => d.x === tile.x && d.y === tile.y) ?? null;
        const base = basesRes.cities.find((b) => b.id === tile.domainCityId) ?? null;
        setDomainTile(dt);
        setBase(base);
      } catch {
        setError('Failed to load domain tile info');
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [token, tile]);

  const garrison    = (domainTile?.troops ?? {}) as TroopMap;
  const garrisonUnits = UNIT_LIST.filter((u) => (garrison[u.id] ?? 0) > 0);
  const totalGarrison = Object.values(garrison).reduce((s, n) => s + (n ?? 0), 0);
  const tileDef       = TILE_DEFS[tile.type as keyof typeof TILE_DEFS];

  // Total troops selected for recall
  const totalSelected = Object.values(selected).reduce((s, n) => s + (n ?? 0), 0);
  const isRecallingAll = totalSelected >= totalGarrison && totalGarrison > 0;

  // March time based on selected troops (fall back to full garrison if nothing chosen)
  const effectiveTroops: TroopMap = totalSelected > 0
    ? (selected as TroopMap)
    : garrison;

  const marchSecs = useMemo(() => {
    if (!base || !domainTile) return null;
    return computeMarchTimeSeconds(tile.x, tile.y, base.x, base.y, [effectiveTroops]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, domainTile, tile, totalSelected]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setUnit = (id: UnitId, raw: string) => {
    const max = garrison[id] ?? 0;
    const val = Math.min(Math.max(0, parseInt(raw, 10) || 0), max);
    setSelected((prev) => ({ ...prev, [id]: val }));
  };

  const selectAll = () => {
    const all: Partial<Record<UnitId, number>> = {};
    for (const u of garrisonUnits) all[u.id] = garrison[u.id] ?? 0;
    setSelected(all);
  };

  const clearAll = () => setSelected({});

  // ── Submit recall ─────────────────────────────────────────────────────────
  const handleRecall = async () => {
    if (!domainTile || !token) return;
    setLoading(true);
    setError('');
    try {
      // If nothing explicitly selected, recall everything
      const body: { domainTileId: string; troops?: TroopMap } = {
        domainTileId: domainTile.id,
      };
      if (totalSelected > 0 && !isRecallingAll) {
        body.troops = selected as TroopMap;
      }
      await apiFetch('/domain/recall', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to recall troops');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 border border-amber-800/60 rounded-xl shadow-2xl w-full max-w-sm flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60">
          <h2 className="text-sm font-bold text-amber-300 tracking-wide">
            ↩ Recall Garrison — ({tile.x}, {tile.y})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none transition"
          >✕</button>
        </div>

        <div className="p-4 space-y-4">
          {fetching ? (
            <p className="text-xs text-gray-500 animate-pulse text-center py-4">Loading…</p>
          ) : (
            <>
              {/* Tile info */}
              {tileDef && (
                <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 px-3 py-2 text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: tileDef.color }}
                    />
                    <span className="text-gray-200 font-semibold">{tileDef.label}</span>
                  </div>
                  {tileDef.resourceBonus && Object.keys(tileDef.resourceBonus).length > 0 && (
                    <div className="flex flex-wrap gap-x-3 mt-1 text-green-400">
                      {Object.entries(tileDef.resourceBonus).map(([res, pct]) => (
                        <span key={res}>+{pct}% {res}</span>
                      ))}
                      <span className="text-red-400 ml-1">← lost if fully abandoned</span>
                    </div>
                  )}
                </div>
              )}

              {/* Garrison picker */}
              {!domainTile ? (
                <p className="text-xs text-red-400">Domain tile data not found.</p>
              ) : totalGarrison === 0 ? (
                <p className="text-xs text-gray-600">No troops stationed here.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">
                      Garrison ({totalGarrison} troops)
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={selectAll}
                        className="text-[10px] text-blue-400 hover:text-blue-200 px-1.5 py-0.5 rounded border border-blue-800/50 hover:border-blue-600/60 transition"
                      >All</button>
                      {totalSelected > 0 && (
                        <button
                          onClick={clearAll}
                          className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded border border-gray-700 hover:border-gray-500 transition"
                        >Clear</button>
                      )}
                    </div>
                  </div>

                  {garrisonUnits.map((u) => {
                    const max     = garrison[u.id] ?? 0;
                    const current = selected[u.id] ?? 0;
                    return (
                      <div key={u.id} className="flex items-center gap-2 text-xs">
                        <span className="w-4 text-center shrink-0 text-base leading-none">
                          {CATEGORY_ICON[u.category] ?? '⚔'}
                        </span>
                        <span className="flex-1 text-gray-300">{u.name}</span>
                        <span className="text-gray-600 tabular-nums w-10 text-right">/ {max}</span>
                        <input
                          type="number"
                          min={0}
                          max={max}
                          value={current === 0 ? '' : current}
                          placeholder="0"
                          onChange={(e) => setUnit(u.id, e.target.value)}
                          className="w-16 text-right bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-gray-200 focus:outline-none focus:border-amber-600 tabular-nums"
                        />
                      </div>
                    );
                  })}

                  {totalSelected > 0 && (
                    <p className="text-[10px] text-gray-500 text-right">
                      Recalling{' '}
                      <span className="text-amber-300 font-mono">{totalSelected}</span>
                      {' '}/ {totalGarrison} troops
                    </p>
                  )}
                </div>
              )}

              {/* Warning */}
              {totalGarrison > 0 && (
                <div className={`rounded-lg px-3 py-2 text-xs border ${
                  isRecallingAll || totalSelected === 0
                    ? 'bg-yellow-900/20 border-yellow-700/40 text-yellow-300'
                    : 'bg-gray-800/40 border-gray-700/40 text-gray-400'
                }`}>
                  {isRecallingAll || totalSelected === 0
                    ? '⚠ Recalling all troops will immediately abandon this territory tile.'
                    : `↩ ${totalSelected} troop${totalSelected !== 1 ? 's' : ''} will return; ${totalGarrison - totalSelected} remain garrisoned.`}
                </div>
              )}

              {/* March time */}
              {marchSecs !== null && (
                <p className="text-xs text-gray-500">
                  Return march: <span className="text-gray-300 font-mono">{formatDuration(Math.round(marchSecs))}</span>
                  {base && <span className="text-gray-600"> → {base.name}</span>}
                  {totalSelected === 0 && totalGarrison > 0 && (
                    <span className="text-gray-600"> (select troops to adjust)</span>
                  )}
                </p>
              )}

              {error && <p className="text-xs text-red-400">{error}</p>}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded py-1.5 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecall}
                  disabled={loading || !domainTile || totalGarrison === 0}
                  className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-100 rounded py-1.5 text-xs font-semibold transition"
                >
                  {loading
                    ? 'Recalling…'
                    : totalSelected > 0
                      ? `Recall ${totalSelected} Troop${totalSelected !== 1 ? 's' : ''}`
                      : 'Recall All Troops'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

