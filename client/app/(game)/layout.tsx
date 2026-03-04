'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth';
import { HeaderProvider, useHeaderData, useFullBleed } from '@/context/header';
import { GameInventoryProvider, useGameInventory } from '@/context/inventory';
import DeltaValue from '@/components/ui/DeltaValue';
import ReportsPanel from '@/components/ui/ReportsPanel';
import { RESOURCE_TYPES, RESOURCE_ICONS } from '@rpg/shared';

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/hero',    icon: '🧙', label: 'Hero'    },
  { href: '/base',    icon: '🚀', label: 'Base'    },
  { href: '/map',     icon: '🗺', label: 'Map'     },
  { href: '/market',  icon: '📈', label: 'Market'  },
  { href: '/vendors', icon: '🏪', label: 'Vendors' },
];

function NavButton({ href, icon, label, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      title={label}
      className={[
        'group flex flex-col items-center justify-center w-12 h-12 rounded transition-all select-none',
        active
          ? 'bg-amber-900/60 text-amber-300 border border-amber-700/70'
          : 'text-gray-500 hover:text-amber-400 hover:bg-gray-800/60 border border-transparent',
      ].join(' ')}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[9px] uppercase tracking-widest mt-0.5 font-semibold">{label}</span>
    </Link>
  );
}

/** Decorative corner bracket */
function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = 'absolute w-4 h-4 border-amber-800/60';
  const corners: Record<string, string> = {
    tl: 'top-0 left-0 border-t-2 border-l-2',
    tr: 'top-0 right-0 border-t-2 border-r-2',
    bl: 'bottom-0 left-0 border-b-2 border-l-2',
    br: 'bottom-0 right-0 border-b-2 border-r-2',
  };
  return <span className={`${base} ${corners[pos]}`} />;
}

// ─── Dynamic header centre ────────────────────────────────────────────────────

function HeaderCenter() {
  const header = useHeaderData();

  if (header?.kind === 'base') {
    const { resources } = header.data;
    return (
      <div className="flex items-center gap-3 text-[11px] select-none">
        {RESOURCE_TYPES.map((r) => (
          <span key={r} className="flex items-center gap-1">
            <span>{RESOURCE_ICONS[r]}</span>
            <DeltaValue
              value={Math.floor(resources[r])}
              className="text-gray-300 tabular-nums"
            />
          </span>
        ))}
      </div>
    );
  }

  if (header?.kind === 'hero') {
    const { hero, xpForCurrentLevel, xpForNextLevel } = header.data;
    const xpInLevel = hero.xp - xpForCurrentLevel;
    const xpNeeded  = xpForNextLevel - xpForCurrentLevel;
    const xpPct     = xpNeeded > 0 ? Math.min(100, (xpInLevel / xpNeeded) * 100) : 0;
    return (
      <div className="flex items-center gap-5 select-none">
        <span className="text-amber-400 text-xs font-bold tracking-wide">
          LVL&nbsp;<DeltaValue value={hero.level} />
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 text-[10px] uppercase tracking-wider">XP</span>
          <div className="w-28 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <DeltaValue value={hero.xp} className="text-gray-500 text-[10px] tabular-nums" />
        </div>
        <span className="flex items-center gap-1 text-blue-300 text-xs">
          ⚡&nbsp;<DeltaValue value={hero.energy} className="tabular-nums" />
          <span className="text-gray-600">/{hero.maxEnergy}</span>
        </span>
      </div>
    );
  }

  return (
    <span className="text-gray-700 text-[11px] tracking-[0.3em] uppercase select-none">
      Star Frontier
    </span>
  );
}

// ─── Inner layout (reads from header context) ─────────────────────────────────

function GameLayoutInner({ children }: { children: React.ReactNode }) {
  const { token, player, isLoaded, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const fullBleed = useFullBleed();
  const { heldItem } = useGameInventory();

  useEffect(() => {
    if (isLoaded && !token) {
      router.replace('/login');
    }
  }, [isLoaded, token, router]);

  if (!isLoaded || !token) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <p className="text-amber-700/60 animate-pulse tracking-widest uppercase text-sm">
          Marshalling forces…
        </p>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-col"
      style={{ background: 'var(--hud-bg)', cursor: heldItem ? 'crosshair' : 'default' }}
    >
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header
        className="shrink-0 h-11 flex items-center justify-between px-4 border-b"
        style={{ background: 'rgba(10,9,7,0.97)', borderColor: 'var(--hud-border)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 min-w-32">
          <span className="text-amber-500 text-base">🚀</span>
          <span
            className="text-amber-400 font-bold tracking-[0.25em] uppercase text-xs"
            style={{ textShadow: '0 0 12px rgba(200,147,58,0.4)' }}
          >
            Star Frontier
          </span>
        </div>

        {/* Centre – dynamic header content */}
        <div className="flex-1 flex justify-center overflow-visible">
          <HeaderCenter />
        </div>

        {/* Player + logout */}
        <div className="flex items-center gap-4 min-w-32 justify-end">
          <span className="text-xs text-amber-300/70 tracking-wider uppercase">
            {player?.username}
          </span>
          <button
            onClick={logout}
            className="text-[11px] text-gray-600 hover:text-red-400 transition uppercase tracking-widest"
          >
            Leave
          </button>
        </div>
      </header>

      {/* ── MIDDLE BAND: left nav + viewport + right panel ──────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT NAV */}
        <nav
          className="shrink-0 w-16 flex flex-col items-center py-4 gap-3 border-r"
          style={{ background: 'rgba(10,9,7,0.95)', borderColor: 'var(--hud-border)' }}
        >
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.href}
              {...item}
              active={pathname === item.href || pathname.startsWith(item.href + '/')}
            />
          ))}

          {/* Spacer + logout at bottom */}
          <div className="flex-1" />
          <button
            onClick={logout}
            title="Logout"
            className="flex flex-col items-center justify-center w-12 h-12 rounded text-gray-700 hover:text-red-500 hover:bg-gray-800/40 transition border border-transparent"
          >
            <span className="text-xl leading-none">🚪</span>
            <span className="text-[9px] uppercase tracking-widest mt-0.5">Exit</span>
          </button>
        </nav>

        {/* MAIN VIEWPORT */}
        <main
          className={`flex-1 min-w-0 relative ${fullBleed ? 'overflow-hidden' : 'overflow-auto view-scroll'}`}
          style={{ background: 'rgba(11,10,8,0.85)' }}
        >
          {/* Corner braces for that HUD feel */}
          <div className="pointer-events-none absolute inset-0 z-10">
            <Corner pos="tl" />
            <Corner pos="tr" />
            <Corner pos="bl" />
            <Corner pos="br" />
          </div>
          <div className={fullBleed ? 'h-full' : 'p-6'}>{children}</div>
        </main>

        {/* RIGHT PANEL */}
        <aside
          className="shrink-0 w-44 flex flex-col border-l py-4 px-3 text-[11px] min-h-0 overflow-hidden"
          style={{ background: 'rgba(10,9,7,0.95)', borderColor: 'var(--hud-border)' }}
        >
          <ReportsPanel />
        </aside>
      </div>

      {/* ── BOTTOM BAR ──────────────────────────────────────────────────── */}
      <footer
        className="shrink-0 h-7 flex items-center justify-between px-4 border-t text-[10px] text-gray-700 select-none"
        style={{ background: 'rgba(10,9,7,0.97)', borderColor: 'var(--hud-border)' }}
      >
        <span className="tracking-widest uppercase">
          {NAV_ITEMS.find(n => pathname.startsWith(n.href))?.label ?? 'Base'}
        </span>
        <span className="tracking-widest">
          {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </footer>
    </div>
  );
}

// ─── Root layout wraps everything in the header context provider ───────────────

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <HeaderProvider>
      <GameInventoryProvider>
        <GameLayoutInner>{children}</GameLayoutInner>
      </GameInventoryProvider>
    </HeaderProvider>
  );
}
