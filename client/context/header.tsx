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
  header:       HeaderData;
  setHeader:    (h: HeaderData) => void;
  fullBleed:    boolean;
  setFullBleed: (v: boolean) => void;
}

const HeaderContext = createContext<HeaderContextValue>({
  header: null,
  setHeader: () => {},
  fullBleed: false,
  setFullBleed: () => {},
});

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [header,    setHeader]    = useState<HeaderData>(null);
  const [fullBleed, setFullBleed] = useState(false);
  return (
    <HeaderContext.Provider value={{ header, setHeader, fullBleed, setFullBleed }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeaderData(): HeaderData {
  return useContext(HeaderContext).header;
}

export function useFullBleed(): boolean {
  return useContext(HeaderContext).fullBleed;
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

/**
 * Call in pages that should expand to fill the viewport without the default
 * p-6 padding (e.g. the map page). Automatically reverts on unmount.
 */
export function useSetFullBleed() {
  const { setFullBleed } = useContext(HeaderContext);
  useEffect(() => {
    setFullBleed(true);
    return () => setFullBleed(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
