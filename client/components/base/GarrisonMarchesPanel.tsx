'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { UNITS } from '@rpg/shared';
import type { GarrisonMarchesResponse, GarrisonMarchInfo, TroopMap, UnitId } from '@rpg/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { getSocket } from '@/lib/socket';
import CountdownTimer from '@/components/ui/CountdownTimer';

interface GarrisonMarchesPanelProps {
  cityId: string;
}

const CATEGORY_ICON: Record<string, string> = {
  infantry: '🗡️',
  ranged:   '🏹',
  cavalry:  '🐴',
  siege:    '🪨',
};

function TroopList({ troops }: { troops: TroopMap }) {
  const entries = (Object.entries(troops) as [UnitId, number][]).filter(([, n]) => (n ?? 0) > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
      {entries.map(([uid, n]) => {
        const def = UNITS[uid];
        return (
          <span key={uid} className="flex items-center gap-1 text-gray-400">
            <span className="text-[10px]">{CATEGORY_ICON[def?.category ?? ''] ?? '⚔'}</span>
            <span>{def?.name ?? uid}</span>
            <span className="tabular-nums text-amber-200">×{n}</span>
          </span>
        );
      })}
    </div>
  );
}

export default function GarrisonMarchesPanel({ cityId }: GarrisonMarchesPanelProps) {
  const { token } = useAuth();
  const [data,       setData]       = useState<GarrisonMarchesResponse | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<GarrisonMarchesResponse>(`/domain/marches?cityId=${cityId}`, { token });
      setData(res);
    } catch { /* silently ignore */ }
  }, [token, cityId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Refresh on domain-related socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handle = () => refresh();
    socket.on('domain:claimResult',        handle);
    socket.on('domain:contestResult',      handle);
    socket.on('domain:recallComplete',     handle);
    socket.on('domain:defended',           handle);
    socket.on('resource:tick',             handle);
    return () => {
      socket.off('domain:claimResult',    handle);
      socket.off('domain:contestResult',  handle);
      socket.off('domain:recallComplete', handle);
      socket.off('domain:defended',       handle);
      socket.off('resource:tick',         handle);
    };
  }, [refresh]);

  const handleCancel = async (march: GarrisonMarchInfo) => {
    if (!token || !march.canCancel) return;
    setCancelling(march.jobId);
    try {
      await apiFetch(`/domain/claim/${march.jobId}`, { method: 'DELETE', token });
      await refresh();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to cancel');
    } finally {
      setCancelling(null);
    }
  };

  if (!data || (data.outgoing.length === 0 && data.returning.length === 0 && data.incoming.length === 0)) return null;

  return (
    <div className="space-y-3">
      {/* Incoming enemy attacks targeting player's tiles */}
      {data.incoming.length > 0 && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-red-400 font-semibold flex items-center gap-1">
            <span>⚠</span> Incoming Attack{data.incoming.length > 1 ? 's' : ''}
          </p>
          {data.incoming.map((m) => (
            <div
              key={m.jobId}
              className="flex items-start justify-between gap-3 text-xs border-t border-red-900/30 pt-2"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="text-red-200 font-semibold">
                  {m.type === 'contest' ? '⚔ Contest' : '🏴 Claim'} on{' '}
                  <Link
                    href={`/map?x=${m.targetX}&y=${m.targetY}`}
                    className="font-mono text-red-400 hover:text-red-200 hover:underline"
                  >({m.targetX}, {m.targetY})</Link>
                </p>
                <p className="text-[10px] text-red-700">from <span className="text-red-400">{m.cityName}</span></p>
                <TroopList troops={m.troops} />
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[9px] text-red-700 uppercase tracking-widest mb-0.5">Arrives in</p>
                <CountdownTimer
                  endsAt={m.endsAt}
                  className="text-red-300 font-mono tabular-nums"
                  onComplete={refresh}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Outgoing marches (claim + reinforce) */}
      {data.outgoing.length > 0 && (
        <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-blue-400 font-semibold flex items-center gap-1">
            <span>🏴</span> Outgoing Garrison{data.outgoing.length > 1 ? 's' : ''}
          </p>
          {data.outgoing.map((m) => (
            <div
              key={m.jobId}
              className="flex items-start justify-between gap-3 text-xs border-t border-blue-900/30 pt-2"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="text-blue-200 font-semibold">
                  {m.type === 'claim' ? '🏴 Claiming' : m.type === 'contest' ? '⚔ Contesting' : '⊕ Reinforcing'}{' '}
                  <Link
                    href={`/map?x=${m.targetX}&y=${m.targetY}`}
                    className="font-mono text-blue-400 hover:text-blue-200 hover:underline"
                  >({m.targetX}, {m.targetY})</Link>
                </p>
                <TroopList troops={m.troops} />
              </div>
              <div className="shrink-0 text-right space-y-1">
                <div>
                  <p className="text-[9px] text-blue-700 uppercase tracking-widest mb-0.5">Arrives in</p>
                  <CountdownTimer
                    endsAt={m.endsAt}
                    className="text-blue-300 font-mono tabular-nums"
                    onComplete={refresh}
                  />
                </div>
                {m.canCancel && (
                  <button
                    onClick={() => handleCancel(m)}
                    disabled={cancelling === m.jobId}
                    className="text-[10px] px-2 py-0.5 rounded bg-red-900/50 hover:bg-red-900 text-red-300 border border-red-900/60 transition disabled:opacity-40"
                  >
                    {cancelling === m.jobId ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Returning marches (recall) */}
      {data.returning.length > 0 && (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold flex items-center gap-1">
            <span>↩</span> Returning Garrison{data.returning.length > 1 ? 's' : ''}
          </p>
          {data.returning.map((m) => (
            <div
              key={m.jobId}
              className="flex items-start justify-between gap-3 text-xs border-t border-amber-900/30 pt-2"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="text-amber-200 font-semibold">
                  ↩ Returning from{' '}
                  <Link
                    href={`/map?x=${m.fromX}&y=${m.fromY}`}
                    className="font-mono text-amber-400 hover:text-amber-200 hover:underline"
                  >({m.fromX}, {m.fromY})</Link>
                </p>
                <TroopList troops={m.troops} />
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[9px] text-amber-700 uppercase tracking-widest mb-0.5">Returns in</p>
                <CountdownTimer
                  endsAt={m.endsAt}
                  className="text-amber-300 font-mono tabular-nums"
                  onComplete={refresh}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
