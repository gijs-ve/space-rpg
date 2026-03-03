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
  const w = Math.min(parseInt((req.query.w as string) ?? String(VIEWPORT_WIDTH),  10), 40);
  const h = Math.min(parseInt((req.query.h as string) ?? String(VIEWPORT_HEIGHT), 10), 40);

  // Clamp to map boundaries
  const clampedX = Math.min(x, MAP_WIDTH  - 1);
  const clampedY = Math.min(y, MAP_HEIGHT - 1);
  const endX     = Math.min(clampedX + w, MAP_WIDTH);
  const endY     = Math.min(clampedY + h, MAP_HEIGHT);

  try {
    const tiles = await prisma.mapTile.findMany({
      where: {
        x: { gte: clampedX, lt: endX },
        y: { gte: clampedY, lt: endY },
      },
      include: {
        city: {
          select: { name: true, player: { select: { username: true } } },
        },
      },
    });

    const tilesFormatted = tiles.map((t) => ({
      x:             t.x,
      y:             t.y,
      type:          t.type,
      cityId:        t.cityId ?? undefined,
      cityName:      t.city?.name,
      ownerUsername: t.city?.player?.username,
    }));

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
