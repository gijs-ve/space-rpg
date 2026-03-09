'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';

// Only renders in development builds
if (process.env.NODE_ENV === 'production') {
  // Module should not be imported in production, but guard anyway
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeroEntry {
  hero: {
    id:    string;
    level: number;
    xp:    number;
    name:  string;
  };
}

// ─── Inner overlay (always mounts but conditionally shows) ───────────────────

function CheatOverlayInner() {
  const { token } = useAuth();

  const [open,    setOpen]    = useState(false);
  const [heroes,  setHeroes]  = useState<HeroEntry[]>([]);
  const [status,  setStatus]  = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null); // tracks which button is loading
  const overlayRef = useRef<HTMLDivElement>(null);

  // Toggle on "m" key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      // Don't intercept when typing in inputs
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'm' || e.key === 'M') setOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Fetch hero list whenever the overlay opens
  useEffect(() => {
    if (!open || !token) return;
    apiFetch<{ heroes: HeroEntry[] }>('/hero', { token })
      .then((r) => setHeroes(r.heroes))
      .catch(() => setHeroes([]));
  }, [open, token]);

  // Auto-clear status message
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 3000);
    return () => clearTimeout(t);
  }, [status]);

  const showStatus = (msg: string) => setStatus(msg);

  const addResources = useCallback(async () => {
    if (!token) return;
    setLoading('resources');
    try {
      const r = await apiFetch<{ message: string }>('/cheat/resources', {
        method: 'POST',
        token,
      });
      showStatus(`✓ ${r.message}`);
    } catch (e: any) {
      showStatus(`✗ ${e.message}`);
    } finally {
      setLoading(null);
    }
  }, [token]);

  const levelUpHero = useCallback(async (heroId: string) => {
    if (!token) return;
    setLoading(heroId);
    try {
      const r = await apiFetch<{ oldLevel: number; newLevel: number }>('/cheat/hero-level', {
        method: 'POST',
        token,
        body:   JSON.stringify({ heroId }),
      });
      showStatus(`✓ Hero levelled up: ${r.oldLevel} → ${r.newLevel}`);
      // Refresh hero list
      const updated = await apiFetch<{ heroes: HeroEntry[] }>('/hero', { token });
      setHeroes(updated.heroes);
    } catch (e: any) {
      showStatus(`✗ ${e.message}`);
    } finally {
      setLoading(null);
    }
  }, [token]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed bottom-8 right-8 z-[9999] w-72 rounded-lg border border-yellow-600/60 bg-gray-950/95 shadow-2xl text-sm text-gray-200 select-none"
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-800/40 bg-yellow-950/30 rounded-t-lg">
        <span className="text-yellow-400 font-bold tracking-widest uppercase text-[11px]">
          🛠 Cheat Panel <span className="text-yellow-700 font-normal">(dev)</span>
        </span>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-600 hover:text-gray-300 text-lg leading-none px-1"
        >
          ×
        </button>
      </div>

      <div className="p-3 space-y-3">

        {/* Resources */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1.5">Resources</p>
          <button
            onClick={addResources}
            disabled={loading === 'resources'}
            className="w-full rounded px-3 py-1.5 bg-green-900/60 hover:bg-green-800/70 border border-green-700/50 text-green-300 font-semibold text-xs transition disabled:opacity-50"
          >
            {loading === 'resources' ? '…' : '+10,000 all resources (all cities)'}
          </button>
        </div>

        {/* Heroes */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1.5">Heroes</p>
          {heroes.length === 0 ? (
            <p className="text-gray-700 text-xs italic">No heroes found</p>
          ) : (
            <div className="space-y-1.5">
              {heroes.map(({ hero }) => (
                <div key={hero.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-gray-400">
                    {hero.name}
                    <span className="ml-1 text-amber-500 tabular-nums">Lv {hero.level}</span>
                  </span>
                  <button
                    onClick={() => levelUpHero(hero.id)}
                    disabled={loading === hero.id}
                    className="shrink-0 rounded px-2 py-1 bg-amber-900/60 hover:bg-amber-800/70 border border-amber-700/50 text-amber-300 font-semibold text-[11px] transition disabled:opacity-50"
                  >
                    {loading === hero.id ? '…' : '▲ +1 Level'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status feedback */}
        {status && (
          <p className={`text-xs px-2 py-1 rounded border ${
            status.startsWith('✓')
              ? 'text-green-400 bg-green-950/40 border-green-800/40'
              : 'text-red-400 bg-red-950/40 border-red-800/40'
          }`}>
            {status}
          </p>
        )}

        <p className="text-[9px] text-gray-700 text-right">Press M to close</p>
      </div>
    </div>
  );
}

// ─── Portal wrapper ───────────────────────────────────────────────────────────

export default function CheatOverlay() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<CheatOverlayInner />, document.body);
}
