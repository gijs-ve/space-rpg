'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Hero } from '@rpg/shared';
import type { ResourceMap } from '@rpg/shared';

// ─── Payload shapes ───────────────────────────────────────────────────────────

export interface HeroHeaderData {
  hero: Hero;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
}

export interface BaseHeaderData {
  baseName: string;
  resources: ResourceMap;
  production: ResourceMap;
  storageCap: ResourceMap;
}

export type HeaderData =
  | { kind: 'hero'; data: HeroHeaderData }
  | { kind: 'base'; data: BaseHeaderData }
  | null;

// ─── Context ──────────────────────────────────────────────────────────────────

interface HeaderContextValue {
  header: HeaderData;
  setHeader: (h: HeaderData) => void;
}

const HeaderContext = createContext<HeaderContextValue>({
  header: null,
  setHeader: () => {},
});

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [header, setHeader] = useState<HeaderData>(null);
  return (
    <HeaderContext.Provider value={{ header, setHeader }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeaderData(): HeaderData {
  return useContext(HeaderContext).header;
}

// ─── Page-level hooks ─────────────────────────────────────────────────────────

/**
 * Call in the hero page to push data to the header.
 * Clears automatically on unmount.
 */
export function useSetHeroHeader(data: HeroHeaderData | null) {
  const { setHeader } = useContext(HeaderContext);
  // Use a JSON key so the effect only re-runs when actual values change
  const key = data ? JSON.stringify([data.hero.level, data.hero.xp, data.hero.energy]) : null;
  useEffect(() => {
    if (data) setHeader({ kind: 'hero', data });
    return () => setHeader(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * Call in base pages to push resource data to the header.
 * Clears automatically on unmount.
 */
export function useSetBaseHeader(data: BaseHeaderData | null) {
  const { setHeader } = useContext(HeaderContext);
  const key = data ? JSON.stringify(data.resources) : null;
  useEffect(() => {
    if (data) setHeader({ kind: 'base', data });
    return () => setHeader(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
