'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UNIT_LIST, TILE_DEFS, computeMarchTimeSeconds, UNITS } from '@rpg/shared';
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

interface ReinforceModalProps {
  tile:      MapTile;   // own domain tile being reinforced
  onClose:   () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReinforceModal({ tile, onClose, onSuccess }: ReinforceModalProps) {
  const { token } = useAuth();

  const [domainTile,     setDomainTile]     = useState<DomainTile | null>(null);
  const [bases,          setBases]          = useState<Base[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [troops,         setTroops]         = useState<TroopMap>({});
  const [fetching,       setFetching]       = useState(true);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');

  // ── Fetch domain tile + all bases ────────────────────────────────────────
  useEffect(() => {
    if (!token || !tile.domainCityId) return;

    const fetchData = async () => {
      try {
        const [domainRes, basesRes] = await Promise.all([
          apiFetch<{ domainTiles: DomainTile[] }>(`/domain?cityId=${tile.domainCityId}`, { token }),
          apiFetch<{ cities: Base[] }>('/bases', { token }),
        ]);
        const dt = domainRes.domainTiles.find((d) => d.x === tile.x && d.y === tile.y) ?? null;
        setDomainTile(dt);
        setBases(basesRes.cities);
        // Default to the owning base
        const ownerBase = basesRes.cities.find((b) => b.id === tile.domainCityId);
        setSelectedBaseId(ownerBase?.id ?? basesRes.cities[0]?.id ?? null);
      } catch {
        setError('Failed to load data');
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [token, tile]);

  const selectedBase = useMemo(
    () => bases.find((b) => b.id === selectedBaseId) ?? null,
    [bases, selectedBaseId],
  );

  const cityGarrison  = (selectedBase?.troops ?? {}) as TroopMap;
  const tileGarrison  = (domainTile?.troops  ?? {}) as TroopMap;
  const totalSending  = Object.values(troops).reduce((s, n) => s + (n ?? 0), 0);
  const tileDef       = TILE_DEFS[tile.type as keyof typeof TILE_DEFS];

  const marchSecs = useMemo(() => {
    if (!selectedBase || totalSending === 0) return null;
    return computeMarchTimeSeconds(
      selectedBase.x, selectedBase.y,
      tile.x, tile.y,
      [troops],
    );
  }, [selectedBase, troops, tile, totalSending]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleReinforce = async () => {
    if (!domainTile || !token) return;
    if (totalSending === 0) { setError('Add at least one troop to send.'); return; }
    setLoading(true);
    setError('');
    try {
      await apiFetch('/domain/reinforce', {
        method: 'POST',
        token,
        body: JSON.stringify({
          domainTileId: domainTile.id,
          troops,
        }),
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send reinforcements');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 border border-amber-800/60 rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60">
          <h2 className="text-sm font-bold text-amber-300 tracking-wide">
            ⚔ Reinforce Garrison — ({tile.x}, {tile.y})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none transition"
          >✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Tile info */}
          {tileDef && (
            <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 px-3 py-2 text-xs text-gray-400 space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: tileDef.color }}
                />
                <span className="font-semibold text-gray-200">{tileDef.label}</span>
              </div>
              {tileDef.resourceBonus && Object.keys(tileDef.resourceBonus).length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-green-400">
                  {Object.entries(tileDef.resourceBonus).map(([res, pct]) => (
                    <span key={res}>+{pct}% {res}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {fetching ? (
            <p className="text-xs text-gray-500 animate-pulse">Loading…</p>
          ) : (
            <>
              {/* Current garrison at tile */}
              <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 px-3 py-2 text-xs space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Current garrison at tile</p>
                {Object.entries(tileGarrison).filter(([, n]) => (n ?? 0) > 0).length === 0 ? (
                  <p className="text-gray-600 italic">No troops garrisoned</p>
                ) : (
                  <div className="space-y-0.5">
                    {(Object.entries(tileGarrison) as [string, number][]).filter(([, n]) => n > 0).map(([uid, n]) => (
                      <div key={uid} className="flex justify-between text-gray-300">
                        <span className="flex items-center gap-1.5">
                          <span>{CATEGORY_ICON[UNITS[uid as UnitId]?.category ?? ''] ?? '⚔'}</span>
                          {UNITS[uid as UnitId]?.name ?? uid}
                        </span>
                        <span className="tabular-nums text-amber-200">{n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Base selector — only show if player has multiple bases */}
              {bases.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-gray-500">Sending from</label>
                  <select
                    value={selectedBaseId ?? ''}
                    onChange={(e) => { setSelectedBaseId(e.target.value); setTroops({}); }}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-amber-600"
                  >
                    {bases.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.x},{b.y})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Troop selector */}
              {selectedBase && (
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-gray-500">Reinforcements to send</label>
                  {UNIT_LIST.filter((u) => (cityGarrison[u.id] ?? 0) > 0).length === 0 ? (
                    <p className="text-xs text-gray-600">No troops available in this base.</p>
                  ) : (
                    <div className="space-y-1">
                      {UNIT_LIST.filter((u) => (cityGarrison[u.id] ?? 0) > 0).map((u) => {
                        const available = cityGarrison[u.id] ?? 0;
                        const sending   = troops[u.id] ?? 0;
                        return (
                          <div key={u.id} className="flex items-center gap-2 text-xs">
                            <span className="w-4 text-center shrink-0">
                              {CATEGORY_ICON[u.category] ?? '⚔'}
                            </span>
                            <span className="flex-1 text-gray-300">{u.name}</span>
                            <span className="text-gray-600 w-10 text-right">{available}</span>
                            <input
                              type="number"
                              min={0}
                              max={available}
                              value={sending}
                              onChange={(e) => {
                                const v = Math.max(0, Math.min(available, parseInt(e.target.value, 10) || 0));
                                setTroops((prev) => ({ ...prev, [u.id]: v }));
                              }}
                              className="w-16 bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-right text-gray-200 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* March time */}
              {marchSecs !== null && (
                <p className="text-xs text-gray-500">
                  March time: <span className="text-gray-300 font-mono">{formatDuration(Math.round(marchSecs))}</span>
                </p>
              )}

              {error && <p className="text-xs text-red-400">{error}</p>}
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded py-1.5 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleReinforce}
              disabled={loading || fetching || totalSending === 0}
              className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-100 rounded py-1.5 text-xs font-semibold transition"
            >
              {loading ? 'Sending…' : `Send ${totalSending > 0 ? `(${totalSending}) ` : ''}Reinforcements`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
