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
} from '@rpg/shared';
import type { MapTile } from '@rpg/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { useGameInventory } from '@/context/inventory';
import { drawMap, TILE_COLORS } from './mapDraw';
import ZoomControls from './ZoomControls';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Tile sizes (px) per zoom level, index 0 = farthest out.
 * At 18 px the visible columns == 40 tiles, matching the server max.
 */
const ZOOM_LEVELS   = [18, 22, 28, 36, 52] as const;
const DEFAULT_ZOOM  = 3;  // 36 px per tile — same as the original view
const BORDER_TILES  = 4;  // void-tile buffer shown beyond the world edge
const DRAG_THRESHOLD = 5; // px before a mouse-press becomes a drag

const RESOURCE_ICONS: Record<string, string> = {
  rations: '🥫', water: '💧', ore: '🪨', alloys: '⚙️', fuel: '⚡', iridium: '💎',
};

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
const POPUP_H = 180;

function TilePopup({
  popup,
  canvasW,
  canvasH,
  isOwnBase,
  canFound,
  founding,
  foundingName,
  onFoundingNameChange,
  onVisit,
  onFound,
  onClose,
}: {
  popup:               PopupState;
  canvasW:             number;
  canvasH:             number;
  isOwnBase:           boolean;
  canFound:            boolean;
  founding:            boolean;
  foundingName:        string;
  onFoundingNameChange: (v: string) => void;
  onVisit:             () => void;
  onFound:             () => void;
  onClose:             () => void;
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
        {tile.type === 'starbase' && (
          <div className="space-y-0.5">
            <p className="text-amber-200 font-semibold">{tile.baseName ?? 'Starbase'}</p>
            {tile.ownerUsername && (
              <p className="text-gray-500">
                Owner: <span className="text-gray-300">{tile.ownerUsername}</span>
              </p>
            )}
          </div>
        )}

        {def && (
          <div className="flex items-center gap-1 text-gray-500">
            <span>{def.passable ? '✅' : '🚫'}</span>
            <span>{def.passable ? 'Passable' : 'Impassable'}</span>
          </div>
        )}

        {def?.encounterChance !== undefined && (
          <p className="text-gray-500">
            ⚔ Encounter:{' '}
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
                <span key={res} className="text-green-400">
                  {RESOURCE_ICONS[res] ?? res} +{pct}%
                </span>
              ))}
            </div>
          </div>
        )}

        {isOwnBase && tile.baseId && (
          <button
            onClick={onVisit}
            className="mt-1 w-full bg-amber-700 hover:bg-amber-600 text-amber-100 font-semibold rounded py-1 transition text-xs tracking-wide"
          >
            🚀 Visit Starbase
          </button>
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
      // Refresh tile data so the tile shows as a starbase
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
    drawMap(ctx, canvasW, canvasH, tileSize, tileMapRef.current, ox, oy, hoveredTile, selectedTile);
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
            <span className="font-medium capitalize">{tooltipTile.type.replace('_', ' ')}</span>
            <span className="text-gray-600">at</span>
            <span className="text-gray-400">({tooltipTile.x}, {tooltipTile.y})</span>
            {tooltipTile.baseId && (
              <span className="text-amber-300">
                🚀 {tooltipTile.baseName ?? 'Starbase'}
                {tooltipTile.ownerUsername && (
                  <span className="text-gray-500 ml-1">({tooltipTile.ownerUsername})</span>
                )}
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
              popup.tile.type === 'starbase' &&
              !!popup.tile.ownerUsername &&
              popup.tile.ownerUsername === player?.username
            }
            canFound={
              !heroHomeCityId &&
              popup.tile.type !== 'starbase' &&
              !popup.tile.baseId
            }
            founding={founding}
            foundingName={foundingName}
            onFoundingNameChange={setFoundingName}
            onVisit={() => {
              if (popup.tile.baseId) router.push(`/base/${popup.tile.baseId}`);
            }}
            onFound={handleFound}
            onClose={() => { setSelectedTile(null); setPopup(null); }}
          />
        )}
      </div>
    </div>
  );
}