import { TILE_DEFS, MAP_WIDTH, MAP_HEIGHT } from '@rpg/shared';
import type { MapTile } from '@rpg/shared';

// ─── Tile colours ─────────────────────────────────────────────────────────────

export const TILE_COLORS: Record<string, string> = {
  barren:      '#8a7560',
  nebula:      '#2d5a27',
  crater:      '#555555',
  ice_deposit: '#5a8e5a',
  derelict:    '#7a5c3a',
  starbase:    '#e09020',
  empty:       '#1a1a2e',
};

// ─── Draw ─────────────────────────────────────────────────────────────────────

/**
 * Render the map onto a 2-D canvas context.
 *
 * @param ctx          - Canvas 2-D rendering context
 * @param canvasW/H    - Canvas pixel dimensions (fixed, independent of zoom)
 * @param tileSize     - Current tile size in pixels (changes with zoom level)
 * @param tileMap      - Lookup map keyed by "x,y"
 * @param ox / oy      - Map-space origin (top-left tile world coordinates)
 * @param hoveredTile  - Tile currently under the pointer (for highlight)
 * @param selectedTile - Tile that was clicked (for amber ring)
 */
export function drawMap(
  ctx:          CanvasRenderingContext2D,
  canvasW:      number,
  canvasH:      number,
  tileSize:     number,
  tileMap:      Map<string, MapTile>,
  ox:           number,
  oy:           number,
  hoveredTile:  MapTile | null,
  selectedTile: MapTile | null,
): void {
  // Extra column/row to fill partial tiles at the canvas edge
  const cols = Math.ceil(canvasW / tileSize) + 1;
  const rows = Math.ceil(canvasH / tileSize) + 1;

  ctx.clearRect(0, 0, canvasW, canvasH);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tx = ox + col;
      const ty = oy + row;
      const px = col * tileSize;
      const py = row * tileSize;

      // Skip tiles that start completely outside the canvas
      if (px >= canvasW || py >= canvasH) continue;

      // ── Void tile (beyond world boundary) ─────────────────────────────────
      if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) {
        ctx.fillStyle = '#0a0c0f';
        ctx.fillRect(px, py, tileSize, tileSize);

        // Subtle crosshatch — skip at very small zoom for perf
        if (tileSize >= 18) {
          ctx.strokeStyle = 'rgba(255,255,255,0.04)';
          ctx.lineWidth   = 0.5;
          ctx.beginPath();
          for (let d = -tileSize; d <= tileSize * 2; d += 8) {
            ctx.moveTo(px + d,           py);
            ctx.lineTo(px + d + tileSize, py + tileSize);
          }
          ctx.stroke();
        }
        continue;
      }

      // ── Normal tile ──────────────────────────────────────────────────────
      const tile = tileMap.get(`${tx},${ty}`);
      const type = tile?.type ?? 'empty';

      // Base fill
      ctx.fillStyle = TILE_COLORS[type] ?? TILE_COLORS.empty;
      ctx.fillRect(px, py, tileSize, tileSize);

      const isHovered  = hoveredTile?.x  === tx && hoveredTile?.y  === ty;
      const isSelected = selectedTile?.x === tx && selectedTile?.y === ty;

      // Hover: lighten overlay
      if (isHovered && !isSelected) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(px, py, tileSize, tileSize);
      }

      // Castle icon — skip at very small zoom (unreadable)
      if (type === 'starbase' && tileSize >= 20) {
        const fontSize = Math.max(10, Math.floor(tileSize * 0.5));
        ctx.font         = `${fontSize}px serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏰', px + tileSize / 2, py + tileSize / 2);
      }

      // Thin grid line — skip at very small zoom
      if (tileSize >= 18) {
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth   = 0.5;
        ctx.strokeRect(px, py, tileSize, tileSize);
      }

      // Selected: amber ring
      if (isSelected) {
        ctx.strokeStyle = 'rgba(251,191,36,0.9)';
        ctx.lineWidth   = 2;
        ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
      }
    }
  }
}
