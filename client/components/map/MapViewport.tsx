'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  TILE_DEFS,
  VIEWPORT_WIDTH,
  VIEWPORT_HEIGHT,
  MAP_WIDTH,
  MAP_HEIGHT,
} from '@rpg/shared';
import type { MapTile } from '@rpg/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';

// ─── Constants ────────────────────────────────────────────────────────────────

const TILE_SIZE      = 36;   // px per tile
const CANVAS_W       = VIEWPORT_WIDTH  * TILE_SIZE;
const CANVAS_H       = VIEWPORT_HEIGHT * TILE_SIZE;
const DRAG_THRESHOLD = 5;    // px before a press becomes a drag
const BORDER_TILES   = 4;   // void buffer tiles shown beyond the map edge

const TILE_COLORS: Record<string, string> = {
  plains:   '#7aad5a',
  forest:   '#3a7a3a',
  mountain: '#888888',
  lake:     '#4a90d9',
  ruins:    '#c9a96e',
  city:     '#e09020',
  empty:    '#444444',
};

const RESOURCE_ICONS: Record<string, string> = {
  food: '🌾', wood: '🪵', stone: '🪨', iron: '⚙️', gold: '🪙',
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
  isOwnCity,
  onVisit,
  onClose,
}: {
  popup:     PopupState;
  isOwnCity: boolean;
  onVisit:   () => void;
  onClose:   () => void;
}) {
  const { tile, canvasX, canvasY } = popup;
  const def  = TILE_DEFS[tile.type as keyof typeof TILE_DEFS];
  const left = canvasX + POPUP_W + 12 > CANVAS_W ? canvasX - POPUP_W - 4 : canvasX + 12;
  const top  = canvasY + POPUP_H + 12 > CANVAS_H ? canvasY - POPUP_H - 4 : canvasY + 12;

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
        {tile.type === 'city' && (
          <div className="space-y-0.5">
            <p className="text-amber-200 font-semibold">{tile.cityName ?? 'City'}</p>
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

        {isOwnCity && tile.cityId && (
          <button
            onClick={onVisit}
            className="mt-1 w-full bg-amber-700 hover:bg-amber-600 text-amber-100 font-semibold rounded py-1 transition text-xs tracking-wide"
          >
            🏰 Visit City
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Canvas draw ──────────────────────────────────────────────────────────────

function drawMap(
  ctx:          CanvasRenderingContext2D,
  tileMap:      Map<string, MapTile>,
  ox:           number,
  oy:           number,
  hoveredTile:  MapTile | null,
  selectedTile: MapTile | null,
) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  for (let row = 0; row < VIEWPORT_HEIGHT; row++) {
    for (let col = 0; col < VIEWPORT_WIDTH; col++) {
      const tx   = ox + col;
      const ty   = oy + row;
      const px   = col * TILE_SIZE;
      const py   = row * TILE_SIZE;

      // ── Void tile (beyond map boundary) ─────────────────────────────────
      const isVoid = tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT;
      if (isVoid) {
        ctx.fillStyle = '#0a0c0f';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        // Subtle crosshatch so it reads as "no man's land"
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth   = 0.5;
        ctx.beginPath();
        for (let d = -TILE_SIZE; d <= TILE_SIZE * 2; d += 8) {
          ctx.moveTo(px + d, py);
          ctx.lineTo(px + d + TILE_SIZE, py + TILE_SIZE);
        }
        ctx.stroke();
        continue;
      }

      // ── Normal tile ──────────────────────────────────────────────────────
      const tile = tileMap.get(`${tx},${ty}`);
      const type = tile?.type ?? 'empty';

      // Base fill
      ctx.fillStyle = TILE_COLORS[type] ?? TILE_COLORS.empty;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      const isHovered  = hoveredTile?.x  === tx && hoveredTile?.y  === ty;
      const isSelected = selectedTile?.x === tx && selectedTile?.y === ty;

      // Hover: lighten overlay
      if (isHovered && !isSelected) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }

      // City icon
      if (type === 'city') {
        ctx.font         = '16px serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏰', px + TILE_SIZE / 2, py + TILE_SIZE / 2);
      }

      // Thin grid line
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

      // Selected: amber ring
      if (isSelected) {
        ctx.strokeStyle = 'rgba(251,191,36,0.9)';
        ctx.lineWidth   = 2;
        ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      }
    }
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MapViewport({
  initialX = 0,
  initialY = 0,
}: {
  initialX?: number;
  initialY?: number;
}) {
  const { token, player } = useAuth();
  const router = useRouter();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [ox, setOx] = useState(initialX);
  const [oy, setOy] = useState(initialY);

  // Refs so drag handlers always read latest offset without stale closures
  const oxRef = useRef(ox);
  const oyRef = useRef(oy);
  useEffect(() => { oxRef.current = ox; }, [ox]);
  useEffect(() => { oyRef.current = oy; }, [oy]);

  const [tiles,        setTiles]        = useState<MapTile[]>([]);
  const [hoveredTile,  setHoveredTile]  = useState<MapTile | null>(null);
  const [selectedTile, setSelectedTile] = useState<MapTile | null>(null);
  const [popup,        setPopup]        = useState<PopupState | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [isDragging,   setIsDragging]   = useState(false);

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
    setLoading(true);
    try {
      const res = await apiFetch<MapResponse>(
        `/map?x=${x}&y=${y}&w=${VIEWPORT_WIDTH}&h=${VIEWPORT_HEIGHT}`,
        { token: token ?? undefined },
      );
      setTiles(res.tiles);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchTiles(ox, oy); }, [ox, oy, fetchTiles]);

  // ── Pan (compass + keyboard) ──────────────────────────────────────────────

  const pan = useCallback((dx: number, dy: number) => {
    setOx((x) => Math.max(-BORDER_TILES, Math.min(MAP_WIDTH  - VIEWPORT_WIDTH  + BORDER_TILES, x + dx)));
    setOy((y) => Math.max(-BORDER_TILES, Math.min(MAP_HEIGHT - VIEWPORT_HEIGHT + BORDER_TILES, y + dy)));
    setSelectedTile(null);
    setPopup(null);
  }, []);

  // ── Keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     { setSelectedTile(null); setPopup(null); return; }
      if (e.key === 'ArrowLeft')  pan(-5, 0);
      if (e.key === 'ArrowRight') pan(5,  0);
      if (e.key === 'ArrowUp')    pan(0, -5);
      if (e.key === 'ArrowDown')  pan(0,  5);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pan]);

  // ── Canvas redraw ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawMap(ctx, tileMapRef.current, ox, oy, hoveredTile, selectedTile);
  }, [tiles, ox, oy, hoveredTile, selectedTile]);

  // ── Hit test ──────────────────────────────────────────────────────────────

  const canvasToTile = useCallback(
    (canvasX: number, canvasY: number): MapTile | null => {
      const col = Math.floor(canvasX / TILE_SIZE);
      const row = Math.floor(canvasY / TILE_SIZE);
      if (col < 0 || col >= VIEWPORT_WIDTH || row < 0 || row >= VIEWPORT_HEIGHT) return null;
      const tx = oxRef.current + col;
      const ty = oyRef.current + row;
      // Void tiles beyond map boundary are not interactive
      if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return null;
      return tileMapRef.current.get(`${tx},${ty}`) ?? null;
    },
    [],
  );

  // ── Pointer events ────────────────────────────────────────────────────────

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
        Math.hypot(
          e.clientX - dragRef.current.startX,
          e.clientY - dragRef.current.startY,
        ),
      );

      if (dragRef.current.moved > DRAG_THRESHOLD) {
        setIsDragging(true);
        setHoveredTile(null);
      }

      dragRef.current.accumPx.x += dx;
      dragRef.current.accumPx.y += dy;

      // Drag right (positive dx) → pan map left (subtract from ox)
      const tilesX = Math.trunc(dragRef.current.accumPx.x / TILE_SIZE);
      const tilesY = Math.trunc(dragRef.current.accumPx.y / TILE_SIZE);

      if (tilesX !== 0 || tilesY !== 0) {
        dragRef.current.accumPx.x -= tilesX * TILE_SIZE;
        dragRef.current.accumPx.y -= tilesY * TILE_SIZE;

        setOx((x) => {
          const nx = Math.max(-BORDER_TILES, Math.min(MAP_WIDTH  - VIEWPORT_WIDTH  + BORDER_TILES, x - tilesX));
          oxRef.current = nx;
          return nx;
        });
        setOy((y) => {
          const ny = Math.max(-BORDER_TILES, Math.min(MAP_HEIGHT - VIEWPORT_HEIGHT + BORDER_TILES, y - tilesY));
          oyRef.current = ny;
          return ny;
        });
        setSelectedTile(null);
        setPopup(null);
      }
    } else {
      setHoveredTile(canvasToTile(localX, localY));
    }
  }, [canvasToTile]);

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

  const tooltipTile = hoveredTile ?? selectedTile;

  return (
    <div className="select-none">
      {/* Canvas wrapper */}
      <div
        className="relative rounded-xl overflow-hidden border border-gray-700/60"
        style={{ width: CANVAS_W, height: CANVAS_H }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: 'block', cursor: isDragging ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
        />

        {/* Coords + loading */}
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

        <Compass onPan={pan} />

        {popup && (
          <TilePopup
            popup={popup}
            isOwnCity={
              popup.tile.type === 'city' &&
              !!popup.tile.ownerUsername &&
              popup.tile.ownerUsername === player?.username
            }
            onVisit={() => {
              if (popup.tile.cityId) router.push(`/city/${popup.tile.cityId}`);
            }}
            onClose={() => { setSelectedTile(null); setPopup(null); }}
          />
        )}
      </div>

      {/* Bottom tooltip */}
      {tooltipTile && (
        <div className="mt-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-300 inline-flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: TILE_COLORS[tooltipTile.type] ?? TILE_COLORS.empty }}
          />
          <span className="font-medium capitalize">{tooltipTile.type}</span>
          <span className="text-gray-600">at</span>
          <span className="text-gray-400">({tooltipTile.x}, {tooltipTile.y})</span>
          {tooltipTile.cityId && (
            <span className="text-amber-300">
              🏰 {tooltipTile.cityName ?? 'City'}
              {tooltipTile.ownerUsername && (
                <span className="text-gray-500 ml-1">({tooltipTile.ownerUsername})</span>
              )}
            </span>
          )}
          {selectedTile?.x === tooltipTile.x && selectedTile?.y === tooltipTile.y && (
            <span className="text-amber-700/60 text-xs ml-1">● selected</span>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(TILE_COLORS)
          .filter(([k]) => k !== 'empty')
          .map(([type, color]) => (
            <span key={type} className="flex items-center gap-1 text-xs text-gray-400">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {type}
            </span>
          ))}
      </div>
    </div>
  );
}
