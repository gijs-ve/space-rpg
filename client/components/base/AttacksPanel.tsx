'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { getSocket } from '@/lib/socket';
import CountdownTimer from '@/components/ui/CountdownTimer';
import type { AttackInfo, AttackStatusResponse } from '@rpg/shared';

export default function AttacksPanel() {
  const { token } = useAuth();
  const [outgoing, setOutgoing] = useState<AttackInfo[]>([]);
  const [incoming, setIncoming] = useState<AttackInfo[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<AttackStatusResponse>('/attack', { token });
      setOutgoing(res.outgoing);
      setIncoming(res.incoming);
    } catch { /* silently ignore */ }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  // Socket-driven refresh
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handle = () => refresh();
    socket.on('attack:incoming',  handle);
    socket.on('attack:cancelled', handle);
    socket.on('attack:complete',  handle);
    socket.on('base:attacked',    handle);
    return () => {
      socket.off('attack:incoming',  handle);
      socket.off('attack:cancelled', handle);
      socket.off('attack:complete',  handle);
      socket.off('base:attacked',    handle);
    };
  }, [refresh]);

  async function cancelAttack(jobId: string) {
    if (!token) return;
    setCancelling(jobId);
    try {
      await apiFetch(`/attack/${jobId}`, { method: 'DELETE', token });
      await refresh();
    } catch (err: any) {
      alert(err.message ?? 'Failed to cancel');
    } finally {
      setCancelling(null);
    }
  }

  if (outgoing.length === 0 && incoming.length === 0) return null;

  return (
    <div className="space-y-3">
      {incoming.length > 0 && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-red-400 font-semibold flex items-center gap-1">
            <span>⚠</span> Incoming Attack{incoming.length > 1 ? 's' : ''}
          </p>
          {incoming.map((a) => (
            <div
              key={a.jobId}
              className="flex items-start justify-between gap-3 text-xs border-t border-red-900/30 pt-2"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="text-red-200 font-semibold truncate">
                  {a.attackerCityName}
                  <span className="text-red-600/70 font-normal"> ({a.attackerUsername})</span>
                  <span className="text-red-500 font-normal mx-1">›</span>
                  {a.targetCityName}
                  <span className="text-red-600/70 font-normal"> ({a.targetUsername})</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[9px] text-red-600 uppercase tracking-widest mb-0.5">Arrives in</p>
                <CountdownTimer
                  endsAt={a.endsAt}
                  className="text-red-300 font-mono tabular-nums"
                  onComplete={refresh}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold flex items-center gap-1">
            <span>⚔</span> Outgoing Attack{outgoing.length > 1 ? 's' : ''}
          </p>
          {outgoing.map((a) => (
            <div
              key={a.jobId}
              className="flex items-start justify-between gap-3 text-xs border-t border-amber-900/30 pt-2"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="text-amber-200 font-semibold truncate">
                  {a.attackerCityName}
                  <span className="text-amber-700/70 font-normal"> ({a.attackerUsername})</span>
                  <span className="text-amber-600 font-normal mx-1">›</span>
                  {a.targetCityName}
                  <span className="text-amber-700/70 font-normal"> ({a.targetUsername})</span>
                </p>
              </div>
              <div className="shrink-0 text-right space-y-1">
                <div>
                  <p className="text-[9px] text-amber-700 uppercase tracking-widest mb-0.5">Arrives in</p>
                  <CountdownTimer
                    endsAt={a.endsAt}
                    className="text-amber-300 font-mono tabular-nums"
                    onComplete={refresh}
                  />
                </div>
                <button
                  onClick={() => cancelAttack(a.jobId)}
                  disabled={cancelling === a.jobId}
                  className="text-[10px] px-2 py-0.5 rounded bg-red-900/50 hover:bg-red-900 text-red-300 border border-red-900/60 transition disabled:opacity-40"
                >
                  {cancelling === a.jobId ? 'Cancelling…' : 'Cancel'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
