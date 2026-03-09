'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  TILE_DEFS,
  MAP_WIDTH,
  MAP_HEIGHT,
  UNITS,
} from '@rpg/shared';
import type { MapTile, ResourceType, TroopMap, GarrisonMarchInfo, GarrisonMarchesResponse } from '@rpg/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { useGameInventory } from '@/context/inventory';
import { drawMap, TILE_COLORS } from './mapDraw';
import ZoomControls from './ZoomControls';
import { ResourceIcon, StatIcon } from '@/components/ui/ResourceIcon';
import CountdownTimer from '@/components/ui/CountdownTimer';
import AttackModal from './AttackModal';
import ClaimModal from './ClaimModal';
import RecallModal from './RecallModal';
import ReinforceModal from './ReinforceModal';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Tile sizes (px) per zoom level, index 0 = farthest out.
 * At 18 px the visible columns == 40 tiles, matching the server max.
 */
const ZOOM_LEVELS   = [18, 22, 28, 36, 52] as const;
const DEFAULT_ZOOM  = 3;  // 36 px per tile — same as the original view
const BORDER_TILES  = 4;  // void-tile buffer shown beyond the world edge
const DRAG_THRESHOLD = 5; // px before a mouse-press becomes a drag



// ─── Types ────────────────────────────────────────────────────────────────────

interface MapResponse {
  tiles: MapTile[];
  viewport: { x: number; y: number; width: number; height: number };
}

interface PopupState {
  tile:    MapTile;
  canvasX: number;
  canvasY: number;
}

interface DragRef {
  active:  boolean;
  startX:  number;
  startY:  number;
  lastX:   number;
  lastY:   number;
  accumPx: { x: number; y: number };
  moved:   number;
}

// ─── Compass ──────────────────────────────────────────────────────────────────

function Compass({ onPan }: { onPan: (dx: number, dy: number) => void }) {
  const cls =
    'flex items-center justify-center w-7 h-7 rounded ' +
    'bg-black/50 hover:bg-black/70 active:scale-95 ' +
    'text-amber-400/80 hover:text-amber-300 text-xs font-bold ' +
    'border border-amber-900/40 transition select-none';
  return (
    <div
      className="absolute bottom-3 right-3 z-20 grid grid-cols-3 gap-0.5"
      style={{ width: 88 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span />
      <button className={cls} onClick={() => onPan(0, -3)}>▲</button>
      <span />
      <button className={cls} onClick={() => onPan(-3, 0)}>◀</button>
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-black/40 border border-amber-900/30">
        <span className="text-amber-800/60 text-[9px] font-black">N</span>
      </div>
      <button className={cls} onClick={() => onPan(3, 0)}>▶</button>
      <span />
      <button className={cls} onClick={() => onPan(0, 3)}>▼</button>
      <span />
    </div>
  );
}

// ─── Tile popup ───────────────────────────────────────────────────────────────

const POPUP_W = 220;
const POPUP_H = 260;

function TilePopup({
  popup,
  canvasW,
  canvasH,
  isOwnBase,
  isEnemyBase,
  isOwnDomain,
  isEnemyDomain,
  canFound,
  founding,
  foundingName,
  garrison,
  marchesToTile,
  marchesToCity,
  onFoundingNameChange,
  onVisit,
  onAttack,
  onClaim,
  onRecall,
  onReinforce,
  onFound,
  onClose,
  onNavigateToCityId,
}: {
  popup:               PopupState;
  canvasW:             number;
  canvasH:             number;
  isOwnBase:           boolean;
  isEnemyBase:         boolean;
  isOwnDomain:         boolean;
  isEnemyDomain:       boolean;
  canFound:            boolean;
  founding:            boolean;
  foundingName:        string;
  garrison:            TroopMap | null;
  marchesToTile:       GarrisonMarchInfo[];
  marchesToCity:       GarrisonMarchInfo[];
  onFoundingNameChange:  (v: string) => void;
  onVisit:               () => void;
  onAttack:              () => void;
  onClaim:               () => void;
  onRecall:              () => void;
  onReinforce:           () => void;
  onFound:               () => void;
  onClose:               () => void;
  onNavigateToCityId:    (cityId: string) => void;
}) {
  const { tile, canvasX, canvasY } = popup;
  const def  = TILE_DEFS[tile.type as keyof typeof TILE_DEFS];
  const left = canvasX + POPUP_W + 12 > canvasW ? canvasX - POPUP_W - 4 : canvasX + 12;
  const top  = canvasY + POPUP_H + 12 > canvasH ? canvasY - POPUP_H - 4 : canvasY + 12;

  return (
    <div
      style={{ position: 'absolute', left, top, width: POPUP_W, zIndex: 50 }}
      className="bg-gray-900/95 border border-amber-800/60 rounded-lg shadow-2xl text-xs text-gray-300 overflow-hidden"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/60 bg-gray-800/60">
        <span className="font-bold capitalize text-amber-300 tracking-wide">
          {def?.label ?? tile.type}
        </span>
        <span className="text-gray-600 text-[10px]">({tile.x}, {tile.y})</span>
        <button
          onClick={onClose}
          className="ml-2 text-gray-600 hover:text-gray-300 transition leading-none text-sm"
        >✕</button>
      </div>

      <div className="px-3 py-2 space-y-2">
        {tile.type === 'castle' && (
          <div className="space-y-0.5">
            <p className="text-amber-200 font-semibold">{tile.baseName ?? 'Castle'}</p>
            {tile.ownerUsername && (
              <p className="text-gray-500">
                Owner: <span className="text-gray-300">{tile.ownerUsername}</span>
              </p>
            )}
          </div>
        )}

        {tile.domainCityId && (
          <p className="text-gray-500">
            Territory of:{' '}
            <button
              onClick={() => onNavigateToCityId(tile.domainCityId!)}
              className={`underline underline-offset-2 hover:opacity-80 transition cursor-pointer ${
                isOwnDomain ? 'text-blue-300' : 'text-red-300'
              }`}
            >
              {tile.domainCityName ?? tile.domainOwnerUsername ?? 'Unknown'}
            </button>
          </p>
        )}

        {def && (
          <div className="flex items-center gap-1 text-gray-500">
            <span>{def.passable ? '✅' : '🚫'}</span>
            <span>{def.passable ? 'Passable' : 'Impassable'}</span>
          </div>
        )}

        {def?.encounterChance !== undefined && (
          <p className="text-gray-500 flex items-center gap-1">
            <StatIcon type="attack" size={12} placement="below" />
            Encounter:{' '}
            <span className="text-gray-300">
              {(def.encounterChance * 100).toFixed(0)}%
            </span>
          </p>
        )}

        {def?.resourceBonus && Object.keys(def.resourceBonus).length > 0 && (
          <div>
            <p className="text-gray-600 uppercase tracking-widest text-[9px] mb-1">
              Resource bonus
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {Object.entries(def.resourceBonus).map(([res, pct]) => (
                <span key={res} className="text-green-400 flex items-center gap-1">
                  <ResourceIcon type={res as ResourceType} size={13} placement="below" />
                  +{pct}%
                </span>
              ))}
            </div>
          </div>
        )}

        {isOwnBase && tile.baseId && (
          <>
            {/* Garrisons returning to this castle (recall marches) */}
            {marchesToCity.length > 0 && (
              <div className="mt-1 space-y-1">
                <p className="text-[9px] uppercase tracking-widest text-amber-600">Returning garrisons</p>
                {marchesToCity.map((m) => (
                  <div key={m.jobId} className="space-y-0.5 border-t border-amber-900/30 pt-1 first:border-0 first:pt-0">
                    <div className="flex items-center justify-between gap-2 text-gray-400">
                      <span>↩ from ({m.fromX}, {m.fromY})</span>
                      <CountdownTimer endsAt={m.endsAt} className="text-amber-300 font-mono tabular-nums" />
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      {m.troops && (Object.entries(m.troops) as [string, number][]).filter(([, n]) => (n ?? 0) > 0).map(([uid, n]) => (
                        <span key={uid} className="text-[10px] text-gray-500">
                          {UNITS[uid as keyof typeof UNITS]?.name ?? uid} <span className="text-amber-200 tabular-nums">{n}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={onVisit}
              className="mt-1 w-full bg-amber-700 hover:bg-amber-600 text-amber-100 font-semibold rounded py-1 transition text-xs tracking-wide"
            >
              🏰 Visit Castle
            </button>
          </>
        )}

        {isEnemyBase && tile.baseId && (
          <button
            onClick={onAttack}
            className="mt-1 w-full bg-red-800 hover:bg-red-700 text-red-100 font-semibold rounded py-1 transition text-xs tracking-wide"
          >
            ⚔ Attack
          </button>
        )}

        {/* Own domain tile: garrison breakdown + recall */}
        {isOwnDomain && (
          <div className="space-y-1">
            {garrison && Object.keys(garrison).length > 0 ? (
              <div>
                <p className="text-gray-600 uppercase tracking-widest text-[9px] mb-1">Garrison</p>
                <div className="space-y-0.5">
                  {(Object.entries(garrison) as [string, number][]).filter(([, n]) => n > 0).map(([uid, n]) => (
                    <div key={uid} className="flex justify-between text-gray-300">
                      <span>{UNITS[uid as keyof typeof UNITS]?.name ?? uid}</span>
                      <span className="tabular-nums text-amber-200">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : garrison !== null ? (
              <p className="text-gray-600 text-[10px] italic">No troops garrisoned</p>
            ) : null}
            <button
              onClick={onRecall}
              className="mt-1 w-full bg-amber-800 hover:bg-amber-700 text-amber-100 font-semibold rounded py-1 transition text-xs tracking-wide"
            >
              ↩ Recall Garrison
            </button>
            <button
              onClick={onReinforce}
              className="mt-0.5 w-full bg-green-800 hover:bg-green-700 text-green-100 font-semibold rounded py-1 transition text-xs tracking-wide"
            >
              ⊕ Reinforce
            </button>
            {/* Incoming marches heading to this tile */}
            {marchesToTile.length > 0 && (
              <div className="mt-1 space-y-1 border-t border-gray-700/50 pt-1">
                <p className="text-[9px] uppercase tracking-widest text-blue-500">En route to this tile</p>
                {marchesToTile.map((m) => (
                  <div key={m.jobId} className="space-y-0.5 border-t border-blue-900/30 pt-1 first:border-0 first:pt-0">
                    <div className="flex items-center justify-between gap-2 text-gray-400">
                      <span>{m.type === 'claim' ? '🏴 Claim' : m.type === 'contest' ? '⚔ Contest' : '⊕ Reinforce'}</span>
                      <CountdownTimer endsAt={m.endsAt} className="text-blue-300 font-mono tabular-nums" />
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      {m.troops && (Object.entries(m.troops) as [string, number][]).filter(([, n]) => (n ?? 0) > 0).map(([uid, n]) => (
                        <span key={uid} className="text-[10px] text-gray-500">
                          {UNITS[uid as keyof typeof UNITS]?.name ?? uid} <span className="text-blue-200 tabular-nums">{n}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Enemy domain tile: contest/attack */}
        {isEnemyDomain && !isEnemyBase && (
          <button
            onClick={onClaim}
            className="mt-1 w-full bg-red-800 hover:bg-red-700 text-red-100 font-semibold rounded py-1 transition text-xs tracking-wide"
          >
            ⚔ Contest Territory
          </button>
        )}

        {/* Unclaimed tile: attack/claim territory (show when player has a base) */}
        {!isOwnBase && !isEnemyBase && !isOwnDomain && !isEnemyDomain && !canFound && !!popup.tile && (
          <>
            {/* Neutral garrison indicator */}
            {popup.tile.neutralGarrisonPresent && (
              <div className="mt-1 border border-red-900/40 rounded px-2 py-1 bg-red-950/30">
                <p className="text-[9px] uppercase tracking-widest text-red-500 mb-0.5">Neutral Garrison</p>
                <p className="text-[10px] text-gray-500 italic">Unknown composition — send scouts to reveal</p>
              </div>
            )}
            <button
              onClick={onClaim}
              className="mt-1 w-full bg-red-800 hover:bg-red-700 text-red-100 font-semibold rounded py-1 transition text-xs tracking-wide"
            >
              ⚔ Attack Territory
            </button>
          </>
        )}

        {canFound && (
          <div className="space-y-1.5 mt-1">
            <input
              type="text"
              value={foundingName}
              onChange={(e) => onFoundingNameChange(e.target.value)}
              placeholder="Base name (optional)"
              maxLength={40}
              disabled={founding}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-teal-600 disabled:opacity-50"
            />
            <button
              onClick={onFound}
              disabled={founding}
              className="w-full bg-teal-800 hover:bg-teal-700 disabled:opacity-50 text-teal-100 font-semibold rounded py-1 transition text-xs tracking-wide"
            >
              {founding ? 'Founding…' : '🏗 Found base here'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
// (canvas drawing logic lives in ./mapDraw.ts)

export default function MapViewport({
  initialX = 0,
  initialY = 0,
}: {
  initialX?: number;
  initialY?: number;
}) {
  const { token, player } = useAuth();
  const router = useRouter();
  const { heroHomeCityId, refreshHeroMeta } = useGameInventory();

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);

  // ── Dynamic canvas size (tracks container via ResizeObserver) ────────────────────
  const [canvasW, setCanvasW] = useState(720);
  const [canvasH, setCanvasH] = useState(480);
  const canvasDimsRef = useRef({ w: 720, h: 480 });
  useEffect(() => { canvasDimsRef.current = { w: canvasW, h: canvasH }; }, [canvasW, canvasH]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width < 1 || height < 1) return;
      setCanvasW(Math.floor(width));
      setCanvasH(Math.floor(height));
    });
    ro.observe(el);
    const { width, height } = el.getBoundingClientRect();
    if (width > 1 && height > 1) {
      setCanvasW(Math.floor(width));
      setCanvasH(Math.floor(height));
    }
    return () => ro.disconnect();
  }, []);

  // ── Zoom ─────────────────────────────────────────────────────────────────
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM);
  const zoomIdxRef = useRef(zoomIdx);
  useEffect(() => { zoomIdxRef.current = zoomIdx; }, [zoomIdx]);

  const tileSize = ZOOM_LEVELS[zoomIdx];

  // ── Viewport origin ───────────────────────────────────────────────────────
  const [ox, setOx] = useState(initialX);
  const [oy, setOy] = useState(initialY);

  // Refs so drag handlers always read the latest offset without stale closures
  const oxRef = useRef(ox);
  const oyRef = useRef(oy);
  useEffect(() => { oxRef.current = ox; }, [ox]);
  useEffect(() => { oyRef.current = oy; }, [oy]);

  // ── Map data ──────────────────────────────────────────────────────────────
  const [tiles,        setTiles]        = useState<MapTile[]>([]);
  const [hoveredTile,  setHoveredTile]  = useState<MapTile | null>(null);
  const [selectedTile, setSelectedTile] = useState<MapTile | null>(null);
  const [popup,        setPopup]        = useState<PopupState | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [isDragging,   setIsDragging]   = useState(false);
  const [founding,      setFounding]      = useState(false);
  const [foundingName,   setFoundingName]  = useState('');
  const [attackTile,     setAttackTile]    = useState<MapTile | null>(null);
  const [claimTile,      setClaimTile]     = useState<MapTile | null>(null);
  const [recallTile,     setRecallTile]    = useState<MapTile | null>(null);
  const [reinforceTile,  setReinforceTile] = useState<MapTile | null>(null);
  const [domainGarrison, setDomainGarrison] = useState<TroopMap | null>(null);
  const [popupMarches,   setPopupMarches]   = useState<GarrisonMarchesResponse | null>(null);

  // ── Fetch garrison troops when an own domain tile popup opens ─────────────
  useEffect(() => {
    if (!popup?.tile.domainCityId || popup.tile.domainOwnerUsername !== player?.username || !token) {
      setDomainGarrison(null);
      return;
    }
    let cancelled = false;
    apiFetch<{ domainTiles: Array<{ x: number; y: number; troops: TroopMap }> }>(
      `/domain?cityId=${popup.tile.domainCityId}`,
      { token },
    ).then((res) => {
      if (cancelled) return;
      const match = res.domainTiles.find((t) => t.x === popup.tile.x && t.y === popup.tile.y);
      setDomainGarrison(match?.troops ?? {});
    }).catch(() => {
      if (!cancelled) setDomainGarrison({});
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup?.tile.domainCityId, popup?.tile.x, popup?.tile.y, popup?.tile.domainOwnerUsername]);

  // ── Fetch garrison marches when an own domain tile or own castle popup opens ──
  const marchCityId = useMemo(() => {
    if (!popup || !player) return null;
    // Own domain tile
    if (popup.tile.domainCityId && popup.tile.domainOwnerUsername === player.username)
      return popup.tile.domainCityId;
    // Own castle
    if (popup.tile.type === 'castle' && popup.tile.ownerUsername === player.username && popup.tile.baseId)
      return popup.tile.baseId;
    return null;
  }, [popup, player]);

  useEffect(() => {
    if (!marchCityId || !token) { setPopupMarches(null); return; }
    let cancelled = false;
    apiFetch<GarrisonMarchesResponse>(`/domain/marches?cityId=${marchCityId}`, { token })
      .then((res) => { if (!cancelled) setPopupMarches(res); })
      .catch(() => { if (!cancelled) setPopupMarches(null); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marchCityId]);

  const tileMapRef = useRef<Map<string, MapTile>>(new Map());
  useEffect(() => {
    tileMapRef.current = new Map(tiles.map((t) => [`${t.x},${t.y}`, t]));
  }, [tiles]);

  const dragRef = useRef<DragRef>({
    active:  false,
    startX:  0,
    startY:  0,
    lastX:   0,
    lastY:   0,
    accumPx: { x: 0, y: 0 },
    moved:   0,
  });

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchTiles = useCallback(async (x: number, y: number) => {
    const ts          = ZOOM_LEVELS[zoomIdxRef.current];
    const { w: cw, h: ch } = canvasDimsRef.current;
    const w  = Math.min(Math.ceil(cw / ts) + 1, MAP_WIDTH);
    const h  = Math.min(Math.ceil(ch / ts) + 1, MAP_HEIGHT);
    setLoading(true);
    try {
      const res = await apiFetch<MapResponse>(
        `/map?x=${x}&y=${y}&w=${w}&h=${h}`,
        { token: token ?? undefined },
      );
      setTiles(res.tiles);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, zoomIdx, canvasW, canvasH]); // re-run when zoom or canvas size changes

  useEffect(() => { fetchTiles(ox, oy); }, [ox, oy, fetchTiles]);

  // ── City founding ─────────────────────────────────────────────────────────

  const handleFound = useCallback(async () => {
    if (!popup || !token) return;
    setFounding(true);
    try {
      const name = foundingName.trim() || undefined;
      await apiFetch('/bases/found', {
        method: 'POST',
        token,
        body: JSON.stringify({ x: popup.tile.x, y: popup.tile.y, ...(name && { name }) }),
      });
      await refreshHeroMeta();
      // Refresh tile data so the tile shows as a castle
      fetchTiles(ox, oy);
      setSelectedTile(null);
      setPopup(null);
      setFoundingName('');
    } catch (err: any) {
      alert(err?.message ?? 'Failed to found base');
    } finally {
      setFounding(false);
    }
  }, [popup, token, foundingName, refreshHeroMeta, fetchTiles, ox, oy]);

  // ── Clamp helpers ─────────────────────────────────────────────────────────

  const clampOx = useCallback((x: number, vW: number) =>
    Math.max(-BORDER_TILES, Math.min(MAP_WIDTH  - vW + BORDER_TILES, x)), []);
  const clampOy = useCallback((y: number, vH: number) =>
    Math.max(-BORDER_TILES, Math.min(MAP_HEIGHT - vH + BORDER_TILES, y)), []);

  // ── Pan ───────────────────────────────────────────────────────────────────

  const pan = useCallback((dx: number, dy: number) => {
    const ts          = ZOOM_LEVELS[zoomIdxRef.current];
    const { w: cw, h: ch } = canvasDimsRef.current;
    const vW = Math.min(Math.ceil(cw / ts) + 1, MAP_WIDTH);
    const vH = Math.min(Math.ceil(ch / ts) + 1, MAP_HEIGHT);
    setOx((x) => { const nx = clampOx(x + dx, vW); oxRef.current = nx; return nx; });
    setOy((y) => { const ny = clampOy(y + dy, vH); oyRef.current = ny; return ny; });
    setSelectedTile(null);
    setPopup(null);
  }, [clampOx, clampOy]);

  // ── Keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     { setSelectedTile(null); setPopup(null); return; }
      if (e.key === 'ArrowLeft')  pan(-5, 0);
      if (e.key === 'ArrowRight') pan( 5, 0);
      if (e.key === 'ArrowUp')    pan( 0, -5);
      if (e.key === 'ArrowDown')  pan( 0,  5);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pan]);

  // ── Scroll-to-zoom (non-passive wheel listener on canvas) ────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) setZoomIdx((z) => Math.min(z + 1, ZOOM_LEVELS.length - 1));
      else              setZoomIdx((z) => Math.max(z - 1, 0));
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  // ── Canvas redraw ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawMap(ctx, canvasW, canvasH, tileSize, tileMapRef.current, ox, oy, hoveredTile, selectedTile, player?.username);
  }, [tiles, ox, oy, canvasW, canvasH, tileSize, hoveredTile, selectedTile]);

  // ── Hit-test: canvas pixel → MapTile ─────────────────────────────────────

  // The canvas is CSS-stretched to fill the container, so we must scale CSS
  // pixels to canvas pixels before computing the tile column.
  const canvasToTile = useCallback(
    (cssX: number, cssY: number): MapTile | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect   = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      const ts     = ZOOM_LEVELS[zoomIdxRef.current];
      const col    = Math.floor(cssX * scaleX / ts);
      const row    = Math.floor(cssY * scaleY / ts);
      const tx     = oxRef.current + col;
      const ty     = oyRef.current + row;
      if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return null;
      return tileMapRef.current.get(`${tx},${ty}`) ?? null;
    },
    [],
  );

  // ── Pointer handlers ──────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = {
      active:  true,
      startX:  e.clientX,
      startY:  e.clientY,
      lastX:   e.clientX,
      lastY:   e.clientY,
      accumPx: { x: 0, y: 0 },
      moved:   0,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect   = canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      dragRef.current.moved = Math.max(
        dragRef.current.moved,
        Math.hypot(e.clientX - dragRef.current.startX, e.clientY - dragRef.current.startY),
      );

      if (dragRef.current.moved > DRAG_THRESHOLD) {
        setIsDragging(true);
        setHoveredTile(null);
      }

      dragRef.current.accumPx.x += dx;
      dragRef.current.accumPx.y += dy;

      // Drag right (positive dx) → pan map left (ox decreases)
      // Account for CSS→canvas pixel scaling
      const ts     = ZOOM_LEVELS[zoomIdxRef.current];
      const rect2  = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect2.width;
      const scaleY = canvas.height / rect2.height;
      const tilesX = Math.trunc(dragRef.current.accumPx.x * scaleX / ts);
      const tilesY = Math.trunc(dragRef.current.accumPx.y * scaleY / ts);

      if (tilesX !== 0 || tilesY !== 0) {
        dragRef.current.accumPx.x -= tilesX * ts / scaleX;
        dragRef.current.accumPx.y -= tilesY * ts / scaleY;

        const { w: cw, h: ch } = canvasDimsRef.current;
        const vW = Math.min(Math.ceil(cw / ts) + 1, MAP_WIDTH);
        const vH = Math.min(Math.ceil(ch / ts) + 1, MAP_HEIGHT);

        setOx((x) => { const nx = clampOx(x - tilesX, vW); oxRef.current = nx; return nx; });
        setOy((y) => { const ny = clampOy(y - tilesY, vH); oyRef.current = ny; return ny; });
        setSelectedTile(null);
        setPopup(null);
      }
    } else {
      setHoveredTile(canvasToTile(localX, localY));
    }
  }, [canvasToTile, clampOx, clampOy]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    canvasRef.current?.releasePointerCapture(e.pointerId);
    const wasDrag = dragRef.current.moved > DRAG_THRESHOLD;
    dragRef.current.active = false;
    setIsDragging(false);

    if (!wasDrag) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect   = canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const tile   = canvasToTile(localX, localY);

      if (!tile) {
        setSelectedTile(null);
        setPopup(null);
        return;
      }
      if (selectedTile?.x === tile.x && selectedTile?.y === tile.y) {
        setSelectedTile(null);
        setPopup(null);
      } else {
        setSelectedTile(tile);
        setPopup({ tile, canvasX: localX, canvasY: localY });
      }
    }
  }, [canvasToTile, selectedTile]);

  const onPointerLeave = useCallback(() => {
    dragRef.current.active = false;
    setIsDragging(false);
    setHoveredTile(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  const tooltipTile = hoveredTile ?? selectedTile;
  const visW = useMemo(() => Math.min(Math.ceil(canvasW / tileSize) + 1, MAP_WIDTH), [canvasW, tileSize]);
  const visH = useMemo(() => Math.min(Math.ceil(canvasH / tileSize) + 1, MAP_HEIGHT), [canvasH, tileSize]);

  return (
    <div className="w-full h-full select-none">
      {/* Canvas area — fills all available space */}
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
        />

        {/* New-player banner: no city yet */}
        {!heroHomeCityId && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-teal-900/90 border border-teal-700/60 rounded-lg px-4 py-2 text-xs text-teal-200 text-center pointer-events-none shadow-lg">
            Click any tile to found your starting base
          </div>
        )}

        {/* Coordinates + loading indicator */}
        <div className="absolute top-2 left-3 z-10 flex items-center gap-2 pointer-events-none">
          <span className="text-[10px] text-white/30 font-mono tracking-widest">
            {ox},{oy}
          </span>
          {loading && (
            <span className="text-[10px] text-amber-400/60 animate-pulse tracking-widest">
              loading…
            </span>
          )}
        </div>

        <ZoomControls
          zoomIdx={zoomIdx}
          maxIdx={ZOOM_LEVELS.length - 1}
          onZoomIn={() => setZoomIdx((z) => Math.min(z + 1, ZOOM_LEVELS.length - 1))}
          onZoomOut={() => setZoomIdx((z) => Math.max(z - 1, 0))}
        />

        <Compass onPan={pan} />

        {/* Bottom overlay strip: legend + zoom hint */}
        <div
          className="absolute bottom-0 left-0 right-0 z-20 px-3 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(10,9,7,0.88) 60%, transparent)' }}
        >
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(TILE_COLORS)
              .filter(([k]) => k !== 'empty')
              .map(([type, color]) => (
                <span key={type} className="flex items-center gap-1 text-[10px] text-gray-400">
                  <span
                    className="inline-block w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  {type.replace('_', ' ')}
                </span>
              ))}
          </div>
          <span className="ml-auto text-[10px] text-gray-700 tracking-wide">
            scroll to zoom · {visW}×{visH}
          </span>
        </div>

        {/* Tile info tooltip */}
        {tooltipTile && (
          <div className="absolute bottom-9 left-3 z-30 bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 inline-flex items-center gap-2 pointer-events-none">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: TILE_COLORS[tooltipTile.type] ?? TILE_COLORS.empty }}
            />
            <span className="font-medium capitalize">{TILE_DEFS[tooltipTile.type as keyof typeof TILE_DEFS]?.label ?? tooltipTile.type.replace('_', ' ')}</span>
            <span className="text-gray-600">at</span>
            <span className="text-gray-400">({tooltipTile.x}, {tooltipTile.y})</span>
            {tooltipTile.baseId && (
              <span className="text-amber-300">
                🏰 {tooltipTile.baseName ?? 'Castle'}
                {tooltipTile.ownerUsername && (
                  <span className="text-gray-500 ml-1">({tooltipTile.ownerUsername})</span>
                )}
              </span>
            )}
            {tooltipTile.domainCityId && (
              <span className={tooltipTile.domainOwnerUsername === player?.username ? 'text-blue-300' : 'text-red-300'}>
                ⚑ {tooltipTile.domainCityName ?? tooltipTile.domainOwnerUsername ?? 'Domain'}
              </span>
            )}
            {selectedTile?.x === tooltipTile.x && selectedTile?.y === tooltipTile.y && (
              <span className="text-amber-700/60 text-[10px] ml-1">● selected</span>
            )}
          </div>
        )}

        {popup && (
          <TilePopup
            popup={popup}
            canvasW={canvasW}
            canvasH={canvasH}
            isOwnBase={
              popup.tile.type === 'castle' &&
              !!popup.tile.ownerUsername &&
              popup.tile.ownerUsername === player?.username
            }
            isEnemyBase={
              popup.tile.type === 'castle' &&
              !!popup.tile.ownerUsername &&
              popup.tile.ownerUsername !== player?.username
            }
            isOwnDomain={
              !!popup.tile.domainCityId &&
              popup.tile.domainOwnerUsername === player?.username
            }
            isEnemyDomain={
              !!popup.tile.domainCityId &&
              popup.tile.domainOwnerUsername !== player?.username
            }
            canFound={
              !heroHomeCityId &&
              popup.tile.type !== 'castle' &&
              !popup.tile.baseId
            }
            founding={founding}
            foundingName={foundingName}
            garrison={domainGarrison}
            marchesToTile={popupMarches?.outgoing.filter(
              (m) => m.targetX === popup.tile.x && m.targetY === popup.tile.y,
            ) ?? []}
            marchesToCity={popupMarches?.returning ?? []}
            onFoundingNameChange={setFoundingName}
            onVisit={() => {
              if (popup.tile.baseId) router.push(`/base/${popup.tile.baseId}`);
            }}
            onAttack={() => {
              setAttackTile(popup.tile);
              setSelectedTile(null);
              setPopup(null);
            }}
            onClaim={() => {
              setClaimTile(popup.tile);
              setSelectedTile(null);
              setPopup(null);
            }}
            onRecall={() => {
              setRecallTile(popup.tile);
              setSelectedTile(null);
              setPopup(null);
            }}
            onReinforce={() => {
              setReinforceTile(popup.tile);
              setSelectedTile(null);
              setPopup(null);
            }}
            onFound={handleFound}
            onClose={() => { setSelectedTile(null); setPopup(null); }}
            onNavigateToCityId={(cityId) => {
              // Find the castle tile that belongs to this city
              const castleTile = Array.from(tileMapRef.current.values()).find(
                (t) => t.baseId === cityId,
              );
              if (!castleTile) return;
              const ts = ZOOM_LEVELS[zoomIdxRef.current];
              const { w: cw, h: ch } = canvasDimsRef.current;
              const vW = Math.min(Math.ceil(cw / ts) + 1, MAP_WIDTH);
              const vH = Math.min(Math.ceil(ch / ts) + 1, MAP_HEIGHT);
              const newOx = clampOx(castleTile.x - Math.floor(vW / 2), vW);
              const newOy = clampOy(castleTile.y - Math.floor(vH / 2), vH);
              setOx(newOx); oxRef.current = newOx;
              setOy(newOy); oyRef.current = newOy;
              setSelectedTile(castleTile);
              setPopup(null);
            }}
          />
        )}

        {/* Attack modal */}
        {attackTile && (
          <AttackModal
            targetTile={attackTile}
            onClose={() => setAttackTile(null)}
            onSuccess={() => {
              setAttackTile(null);
              fetchTiles(ox, oy);
            }}
          />
        )}

        {/* Claim territory modal */}
        {claimTile && (
          <ClaimModal
            targetTile={claimTile}
            onClose={() => setClaimTile(null)}
            onSuccess={() => {
              setClaimTile(null);
              fetchTiles(ox, oy);
            }}
          />
        )}

        {/* Recall garrison modal */}
        {recallTile && (
          <RecallModal
            tile={recallTile}
            onClose={() => setRecallTile(null)}
            onSuccess={() => {
              setRecallTile(null);
              fetchTiles(ox, oy);
            }}
          />
        )}

        {/* Reinforce garrison modal */}
        {reinforceTile && (
          <ReinforceModal
            tile={reinforceTile}
            onClose={() => setReinforceTile(null)}
            onSuccess={() => {
              setReinforceTile(null);
              fetchTiles(ox, oy);
            }}
          />
        )}
      </div>
    </div>
  );
}