import { TILE_DEFS, MAP_WIDTH, MAP_HEIGHT } from '@rpg/shared';
import type { MapTile } from '@rpg/shared';

// ─── Tile colours ─────────────────────────────────────────────────────────────

export const TILE_COLORS: Record<string, string> = {
  barren:      '#8a7560',
  forest:      '#2d5a27',
  rocky_cliffs:      '#555555',
  marshland: '#5a8e5a',
  ancient_ruins:    '#7a5c3a',
  castle:    '#e09020',
  empty:       '#1a1a2e',
};

/** Overlay colour applied to a tile that is part of the current player's domain. */
const OWN_DOMAIN_COLOR  = 'rgba(59,130,246,0.28)';  // blue tint
/** Overlay colour applied to a tile that is part of an enemy domain. */
const ENEMY_DOMAIN_COLOR = 'rgba(239,68,68,0.22)';  // red tint
/** Border colour for own domain tiles */
const OWN_DOMAIN_BORDER  = 'rgba(96,165,250,0.85)';
/** Border colour for enemy domain tiles */
const ENEMY_DOMAIN_BORDER = 'rgba(252,165,165,0.75)';

// ─── Draw ─────────────────────────────────────────────────────────────────────

/**
 * Render the map onto a 2-D canvas context.
 *
 * @param ctx            - Canvas 2-D rendering context
 * @param canvasW/H      - Canvas pixel dimensions (fixed, independent of zoom)
 * @param tileSize       - Current tile size in pixels (changes with zoom level)
 * @param tileMap        - Lookup map keyed by "x,y"
 * @param ox / oy        - Map-space origin (top-left tile world coordinates)
 * @param hoveredTile    - Tile currently under the pointer (for highlight)
 * @param selectedTile   - Tile that was clicked (for amber ring)
 * @param currentUsername - Logged-in player's username (for domain colouring)
 */
export function drawMap(
  ctx:             CanvasRenderingContext2D,
  canvasW:         number,
  canvasH:         number,
  tileSize:        number,
  tileMap:         Map<string, MapTile>,
  ox:              number,
  oy:              number,
  hoveredTile:     MapTile | null,
  selectedTile:    MapTile | null,
  currentUsername?: string | null,
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

      // ── Domain overlay ────────────────────────────────────────────────────
      const isOwnDomain   = !!tile?.domainCityId && tile.domainOwnerUsername === currentUsername;
      const isEnemyDomain = !!tile?.domainCityId && tile.domainOwnerUsername !== currentUsername;

      if (isOwnDomain) {
        ctx.fillStyle = OWN_DOMAIN_COLOR;
        ctx.fillRect(px, py, tileSize, tileSize);
      } else if (isEnemyDomain) {
        ctx.fillStyle = ENEMY_DOMAIN_COLOR;
        ctx.fillRect(px, py, tileSize, tileSize);
      }

      const isHovered  = hoveredTile?.x  === tx && hoveredTile?.y  === ty;
      const isSelected = selectedTile?.x === tx && selectedTile?.y === ty;

      // Hover: lighten overlay
      if (isHovered && !isSelected) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(px, py, tileSize, tileSize);
      }

      // Castle icon — skip at very small zoom (unreadable)
      if (type === 'castle' && tileSize >= 20) {
        const fontSize = Math.max(10, Math.floor(tileSize * 0.5));
        ctx.font         = `${fontSize}px serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏰', px + tileSize / 2, py + tileSize / 2);
      }

      // Domain tile: troop icon at larger zoom
      if (tile?.domainCityId && tileSize >= 22) {
        const fontSize = Math.max(8, Math.floor(tileSize * 0.32));
        ctx.font         = `${fontSize}px serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚔', px + tileSize / 2, py + tileSize / 2);
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

  // ── Domain exterior borders (second pass) ───────────────────────────────────
  // Draw dashed lines only on the exterior edges of each domain group
  // (edges where the neighbouring tile does not belong to the same domain).
  if (tileSize >= 18) {
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tx = ox + col;
        const ty = oy + row;

        const tile = tileMap.get(`${tx},${ty}`);
        if (!tile?.domainCityId) continue;

        const px = col * tileSize;
        const py = row * tileSize;

        const isOwn = tile.domainOwnerUsername === currentUsername;
        ctx.strokeStyle = isOwn ? OWN_DOMAIN_BORDER : ENEMY_DOMAIN_BORDER;

        // For each of the 4 sides, draw a border line only when the adjacent
        // tile is NOT part of the same domain.
        const sides = [
          { dx:  0, dy: -1, x1: px,           y1: py,           x2: px + tileSize, y2: py           }, // top
          { dx:  1, dy:  0, x1: px + tileSize, y1: py,           x2: px + tileSize, y2: py + tileSize }, // right
          { dx:  0, dy:  1, x1: px,           y1: py + tileSize, x2: px + tileSize, y2: py + tileSize }, // bottom
          { dx: -1, dy:  0, x1: px,           y1: py,           x2: px,           y2: py + tileSize }, // left
        ];

        for (const { dx, dy, x1, y1, x2, y2 } of sides) {
          const neighbour = tileMap.get(`${tx + dx},${ty + dy}`);
          if (neighbour?.domainCityId === tile.domainCityId) continue; // same domain — interior edge
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }
}
