import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/client';
import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, MAP_WIDTH, MAP_HEIGHT } from '@rpg/shared';

const router = Router();
router.use(requireAuth);

// ─── GET /map?x=&y=&w=&h= ─────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const x = Math.max(0, parseInt((req.query.x as string) ?? '0', 10));
  const y = Math.max(0, parseInt((req.query.y as string) ?? '0', 10));
  const w = Math.min(parseInt((req.query.w as string) ?? String(VIEWPORT_WIDTH),  10), MAP_WIDTH);
  const h = Math.min(parseInt((req.query.h as string) ?? String(VIEWPORT_HEIGHT), 10), MAP_HEIGHT);

  // Clamp to map boundaries
  const clampedX = Math.min(x, MAP_WIDTH  - 1);
  const clampedY = Math.min(y, MAP_HEIGHT - 1);
  const endX     = Math.min(clampedX + w, MAP_WIDTH);
  const endY     = Math.min(clampedY + h, MAP_HEIGHT);

  try {
    const [tiles, domainTiles, neutralGarrisons] = await Promise.all([
      prisma.mapTile.findMany({
        where: {
          x: { gte: clampedX, lt: endX },
          y: { gte: clampedY, lt: endY },
        },
        include: {
          city: {
            select: { name: true, player: { select: { username: true } } },
          },
        },
      }),
      // Fetch domain tiles in viewport (non-city tiles only)
      prisma.domainTile.findMany({
        where: {
          x: { gte: clampedX, lt: endX },
          y: { gte: clampedY, lt: endY },
        },
        include: {
          city: {
            select: { id: true, name: true, player: { select: { username: true } } },
          },
        },
      }),
      // Fetch neutral garrisons in viewport (active, non-cleared)
      prisma.neutralGarrison.findMany({
        where: {
          x: { gte: clampedX, lt: endX },
          y: { gte: clampedY, lt: endY },
          everCleared: false,
        },
      }),
    ]);

    // Build a quick lookup for domain tiles
    const domainMap = new Map<string, typeof domainTiles[number]>();
    for (const dt of domainTiles) domainMap.set(`${dt.x},${dt.y}`, dt);

    // Build a quick lookup for neutral garrisons (only those with troops)
    const neutralMap = new Map<string, typeof neutralGarrisons[number]>();
    for (const ng of neutralGarrisons) {
      const hasUnits = Object.values(ng.troops as Record<string, number>).some((n) => (n ?? 0) > 0);
      if (hasUnits) neutralMap.set(`${ng.x},${ng.y}`, ng);
    }

    const tilesFormatted = tiles.map((t) => {
      const domain = domainMap.get(`${t.x},${t.y}`);
      return {
        x:                    t.x,
        y:                    t.y,
        type:                 t.type,
        baseId:               t.cityId ?? undefined,
        baseName:             t.city?.name,
        ownerUsername:        t.city?.player?.username,
        domainCityId:         domain?.cityId,
        domainOwnerUsername:  domain?.city?.player?.username,
        domainCityName:       domain?.city?.name,
        neutralGarrison:      neutralMap.get(`${t.x},${t.y}`)?.troops ?? undefined,
      };
    });

    res.json({
      success: true,
      data: {
        x: clampedX,
        y: clampedY,
        width:  endX - clampedX,
        height: endY - clampedY,
        tiles:  tilesFormatted,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
