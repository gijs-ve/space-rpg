import { Router, Request, Response } from 'express';
import { z }                          from 'zod';
import { requireAuth }                from '../middleware/auth';
import { prisma }                     from '../db/client';
import { scaleDuration }              from '../config';
import {
  UNITS,
  UNIT_LIST,
  UnitId,
  TroopMap,
  ClaimJobMeta,
  RecallJobMeta,
  ReinforceJobMeta,
  ContestJobMeta,
  ScoutJobMeta,
  computeMarchTimeSeconds,
} from '@rpg/shared';

const router = Router();
router.use(requireAuth);

// ─── Zod helpers ─────────────────────────────────────────────────────────────

const UNIT_IDS = UNIT_LIST.map((u) => u.id) as [UnitId, ...UnitId[]];

const TroopMapSchema = z
  .record(z.enum(UNIT_IDS), z.number().int().min(0))
  .default({});

// ─── GET /domain — list domain tiles for a city ───────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const cityId   = req.query.cityId as string | undefined;
  const playerId = req.player!.playerId;

  if (!cityId) {
    res.status(400).json({ success: false, error: 'cityId query param required' });
    return;
  }

  try {
    // Verify ownership
    const city = await prisma.city.findFirst({ where: { id: cityId, playerId } });
    if (!city) {
      res.status(404).json({ success: false, error: 'Base not found' });
      return;
    }

    const domainTiles = await prisma.domainTile.findMany({ where: { cityId } });

    res.json({ success: true, data: { domainTiles } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /domain/claim — send troops to claim a tile ────────────────────────

const ClaimSchema = z.object({
  cityId:  z.string().min(1),
  targetX: z.number().int(),
  targetY: z.number().int(),
  waves:   z.tuple([TroopMapSchema, TroopMapSchema, TroopMapSchema]),
});

router.post('/claim', async (req: Request, res: Response): Promise<void> => {
  const parsed = ClaimSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { cityId, targetX, targetY, waves } = parsed.data;
  const playerId = req.player!.playerId;

  // Verify at least one troop is committed across all waves
  const total = waves.reduce((s, w) => s + Object.values(w).reduce((ws, n) => ws + (n ?? 0), 0), 0);
  if (total === 0) {
    res.status(400).json({ success: false, error: 'Must commit at least one troop' });
    return;
  }

  try {
    // ── Validate ownership ────────────────────────────────────────────────────
    const city = await prisma.city.findFirst({ where: { id: cityId, playerId } });
    if (!city) {
      res.status(404).json({ success: false, error: 'Base not found' });
      return;
    }

    // ── Cannot target own city tile ───────────────────────────────────────────
    if (city.x === targetX && city.y === targetY) {
      res.status(400).json({ success: false, error: 'Cannot claim your own city tile' });
      return;
    }

    // ── Tile must be adjacent (not diagonal) ──────────────────────────────────
    const domainTiles = await prisma.domainTile.findMany({ where: { cityId } });
    // Build set of all own domain positions (including city tile)
    const ownDomainCoords = new Set<string>([`${city.x},${city.y}`]);
    for (const dt of domainTiles) ownDomainCoords.add(`${dt.x},${dt.y}`);

    const isAdjacentToOwnDomain =
      ownDomainCoords.has(`${targetX - 1},${targetY}`) ||
      ownDomainCoords.has(`${targetX + 1},${targetY}`) ||
      ownDomainCoords.has(`${targetX},${targetY - 1}`) ||
      ownDomainCoords.has(`${targetX},${targetY + 1}`);

    if (!isAdjacentToOwnDomain) {
      res.status(400).json({ success: false, error: 'Target tile must be adjacent (not diagonal) to your domain' });
      return;
    }

    // ── Tile must not already be claimed by another city ──────────────────────
    const existingDomain = await prisma.domainTile.findUnique({
      where: { x_y: { x: targetX, y: targetY } },
    });
    if (existingDomain) {
      res.status(400).json({ success: false, error: 'Tile is already part of a domain' });
      return;
    }

    // ── Tile must not be a city ───────────────────────────────────────────────
    const tileHasCity = await prisma.city.findUnique({ where: { x_y: { x: targetX, y: targetY } } });
    if (tileHasCity) {
      res.status(400).json({ success: false, error: 'Cannot claim a tile occupied by a city' });
      return;
    }

    // ── Deduct troops and create claim job ────────────────────────────────────
    const marchTimeSecs = scaleDuration(
      computeMarchTimeSeconds(city.x, city.y, targetX, targetY, waves as TroopMap[]),
    );
    const now    = new Date();
    const endsAt = new Date(now.getTime() + marchTimeSecs * 1000);

    const { job } = await prisma.$transaction(async (tx) => {
      const fresh       = await tx.city.findUniqueOrThrow({ where: { id: cityId } });
      const freshTroops = fresh.troops as unknown as TroopMap;

      // Validate that each unit has enough troops to cover all waves combined
      const totalPerUnit: Partial<Record<UnitId, number>> = {};
      for (const wave of waves) {
        for (const [uid, cnt] of Object.entries(wave) as [UnitId, number][]) {
          if (cnt) totalPerUnit[uid as UnitId] = (totalPerUnit[uid as UnitId] ?? 0) + cnt;
        }
      }
      for (const [uid, cnt] of Object.entries(totalPerUnit) as [UnitId, number][]) {
        if (!cnt) continue;
        const available = freshTroops[uid] ?? 0;
        if (cnt > available) {
          throw Object.assign(
            new Error(`Not enough ${UNITS[uid].name}: have ${available}, sending ${cnt}`),
            { status: 400 },
          );
        }
      }

      const newTroops: TroopMap = { ...freshTroops };
      for (const [uid, cnt] of Object.entries(totalPerUnit) as [UnitId, number][]) {
        newTroops[uid as UnitId] = (newTroops[uid as UnitId] ?? 0) - (cnt ?? 0);
      }

      await tx.city.update({ where: { id: cityId }, data: { troops: newTroops } });

      const meta: ClaimJobMeta = {
        attackerCityId: cityId,
        targetX,
        targetY,
        waves: waves as [TroopMap, TroopMap, TroopMap],
      };

      const job = await tx.job.create({
        data: {
          type:      'claim',
          playerId,
          cityId,
          metadata:  meta as unknown as object,
          startedAt: now,
          endsAt,
        },
      });

      return { job };
    });

    res.status(201).json({ success: true, data: { job, marchTimeSecs } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /domain/claim/:jobId — cancel an in-flight claim march ────────────

router.delete('/claim/:jobId', async (req: Request, res: Response): Promise<void> => {
  const { jobId } = req.params;
  const playerId  = req.player!.playerId;

  try {
    const job = await prisma.job.findFirst({
      where: { id: jobId, type: 'claim', completed: false },
    });
    if (!job) {
      res.status(404).json({ success: false, error: 'Claim job not found or already resolved' });
      return;
    }
    if (job.playerId !== playerId) {
      res.status(403).json({ success: false, error: 'Not your claim' });
      return;
    }

    const meta = job.metadata as unknown as ClaimJobMeta;

    await prisma.$transaction(async (tx) => {
      const city = await tx.city.findUnique({ where: { id: meta.attackerCityId } });
      if (city) {
        const garrison = city.troops as unknown as TroopMap;
        const restored: TroopMap = { ...garrison };
        for (const wave of meta.waves) {
          for (const [uid, cnt] of Object.entries(wave) as [UnitId, number][]) {
            if (cnt) restored[uid as UnitId] = (restored[uid as UnitId] ?? 0) + cnt;
          }
        }
        await tx.city.update({ where: { id: meta.attackerCityId }, data: { troops: restored } });
      }
      await tx.job.delete({ where: { id: jobId } });
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /domain/recall — recall some or all troops from a domain tile ────────

const RecallSchema = z.object({
  domainTileId: z.string().min(1),
  /** Optional subset of troops to send home. Omit to recall everything. */
  troops: TroopMapSchema.optional(),
});

router.post('/recall', async (req: Request, res: Response): Promise<void> => {
  const parsed = RecallSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { domainTileId, troops: requestedTroops } = parsed.data;
  const playerId = req.player!.playerId;

  try {
    // ── Load the domain tile + verify ownership ───────────────────────────────
    const dt = await prisma.domainTile.findUnique({ where: { id: domainTileId } });
    if (!dt) {
      res.status(404).json({ success: false, error: 'Domain tile not found' });
      return;
    }

    const city = await prisma.city.findFirst({ where: { id: dt.cityId, playerId } });
    if (!city) {
      res.status(403).json({ success: false, error: 'Not your domain tile' });
      return;
    }

    const garrison = dt.troops as unknown as TroopMap;

    // Determine which troops are actually being recalled
    const recallingTroops: TroopMap = {};
    if (requestedTroops && Object.keys(requestedTroops).length > 0) {
      // Partial recall — validate against actual garrison
      for (const [uid, cnt] of Object.entries(requestedTroops) as [UnitId, number][]) {
        if (!cnt) continue;
        const available = garrison[uid] ?? 0;
        if (cnt > available) {
          res.status(400).json({
            success: false,
            error: `Not enough ${UNITS[uid].name} garrisoned: have ${available}, recalling ${cnt}`,
          });
          return;
        }
        recallingTroops[uid] = cnt;
      }
    } else {
      // Recall all
      for (const [uid, cnt] of Object.entries(garrison) as [UnitId, number][]) {
        if (cnt) recallingTroops[uid as UnitId] = cnt;
      }
    }

    const totalRecalling = Object.values(recallingTroops).reduce((s, n) => s + (n ?? 0), 0);
    if (totalRecalling === 0) {
      res.status(400).json({ success: false, error: 'No troops selected to recall' });
      return;
    }

    // Remaining troops on the tile after this recall
    const remainingTroops: TroopMap = { ...garrison };
    for (const [uid, cnt] of Object.entries(recallingTroops) as [UnitId, number][]) {
      remainingTroops[uid as UnitId] = (remainingTroops[uid as UnitId] ?? 0) - (cnt ?? 0);
    }
    const totalRemaining = Object.values(remainingTroops).reduce((s, n) => s + (n ?? 0), 0);

    // Compute march-back time (based on troops being recalled)
    const marchTimeSecs = scaleDuration(
      computeMarchTimeSeconds(dt.x, dt.y, city.x, city.y, [recallingTroops]),
    );
    const now    = new Date();
    const endsAt = new Date(now.getTime() + marchTimeSecs * 1000);

    const meta: RecallJobMeta = {
      domainTileId: dt.id,
      cityId:       city.id,
      troops:       recallingTroops,
      fromX:        dt.x,
      fromY:        dt.y,
    };

    // Atomically: update or delete domain tile + create recall job
    const { job } = await prisma.$transaction(async (tx) => {
      if (totalRemaining === 0) {
        // All troops recalled — abandon the tile
        await tx.domainTile.delete({ where: { id: domainTileId } });
      } else {
        // Partial recall — keep tile with remaining garrison
        await tx.domainTile.update({
          where: { id: domainTileId },
          data:  { troops: remainingTroops },
        });
      }

      const job = await tx.job.create({
        data: {
          type:      'recall',
          playerId,
          cityId:    city.id,
          metadata:  meta as unknown as object,
          startedAt: now,
          endsAt,
        },
      });

      return { job };
    });

    res.status(201).json({ success: true, data: { job, marchTimeSecs, troopsReturning: totalRecalling } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /domain/reinforce — send more troops to an existing domain tile ─────

const ReinforceSchema = z.object({
  domainTileId: z.string().min(1),
  troops:       TroopMapSchema,
});

router.post('/reinforce', async (req: Request, res: Response): Promise<void> => {
  const parsed = ReinforceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { domainTileId, troops } = parsed.data;
  const playerId = req.player!.playerId;

  const total = Object.values(troops).reduce((s, n) => s + (n ?? 0), 0);
  if (total === 0) {
    res.status(400).json({ success: false, error: 'Must send at least one troop' });
    return;
  }

  try {
    const dt = await prisma.domainTile.findUnique({ where: { id: domainTileId } });
    if (!dt) {
      res.status(404).json({ success: false, error: 'Domain tile not found' });
      return;
    }

    const city = await prisma.city.findFirst({ where: { id: dt.cityId, playerId } });
    if (!city) {
      res.status(403).json({ success: false, error: 'Not your domain tile' });
      return;
    }

    const marchTimeSecs = scaleDuration(
      computeMarchTimeSeconds(city.x, city.y, dt.x, dt.y, [troops as TroopMap]),
    );
    const now    = new Date();
    const endsAt = new Date(now.getTime() + marchTimeSecs * 1000);

    const { job } = await prisma.$transaction(async (tx) => {
      const fresh       = await tx.city.findUniqueOrThrow({ where: { id: city.id } });
      const freshTroops = fresh.troops as unknown as TroopMap;

      for (const [uid, cnt] of Object.entries(troops) as [UnitId, number][]) {
        if (!cnt) continue;
        const available = freshTroops[uid] ?? 0;
        if (cnt > available) {
          throw Object.assign(
            new Error(`Not enough ${UNITS[uid].name}: have ${available}, sending ${cnt}`),
            { status: 400 },
          );
        }
      }

      const newTroops: TroopMap = { ...freshTroops };
      for (const [uid, cnt] of Object.entries(troops) as [UnitId, number][]) {
        newTroops[uid as UnitId] = (newTroops[uid as UnitId] ?? 0) - (cnt ?? 0);
      }
      await tx.city.update({ where: { id: city.id }, data: { troops: newTroops } });

      const meta: ReinforceJobMeta = {
        domainTileId: dt.id,
        cityId:       city.id,
        troops:       troops as TroopMap,
        targetX:      dt.x,
        targetY:      dt.y,
      };

      const job = await tx.job.create({
        data: {
          type:      'reinforce',
          playerId,
          cityId:    city.id,
          metadata:  meta as unknown as object,
          startedAt: now,
          endsAt,
        },
      });

      return { job };
    });

    res.status(201).json({ success: true, data: { job, marchTimeSecs } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /domain/contest — attack an enemy garrison without claiming the tile ────
// No adjacency check; winning destroys the garrison but the tile becomes
// unclaimed rather than transferring to the attacker.

const ContestSchema = z.object({
  cityId:  z.string().min(1),
  targetX: z.number().int(),
  targetY: z.number().int(),
  waves:   z.tuple([TroopMapSchema, TroopMapSchema, TroopMapSchema]),
});

router.post('/contest', async (req: Request, res: Response): Promise<void> => {
  const parsed = ContestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { cityId, targetX, targetY, waves } = parsed.data;
  const playerId = req.player!.playerId;

  const total = waves.reduce((s, w) => s + Object.values(w).reduce((ws, n) => ws + (n ?? 0), 0), 0);
  if (total === 0) {
    res.status(400).json({ success: false, error: 'Must send at least one troop' });
    return;
  }

  try {
    // ── Validate ownership of the sending city ─────────────────────────────
    const city = await prisma.city.findFirst({ where: { id: cityId, playerId } });
    if (!city) {
      res.status(404).json({ success: false, error: 'Base not found' });
      return;
    }

    // ── Must be an enemy garrison (not own, not empty) ───────────────────────
    const target = await prisma.domainTile.findUnique({
      where:   { x_y: { x: targetX, y: targetY } },
      include: { city: { select: { playerId: true } } },
    });
    if (!target) {
      res.status(400).json({ success: false, error: 'No garrison on that tile to contest' });
      return;
    }
    if (target.city.playerId === playerId) {
      res.status(400).json({ success: false, error: 'Cannot contest your own garrison' });
      return;
    }

    // ── Deduct troops and create contest job ───────────────────────────────
    const marchTimeSecs = scaleDuration(
      computeMarchTimeSeconds(city.x, city.y, targetX, targetY, waves as TroopMap[]),
    );
    const now    = new Date();
    const endsAt = new Date(now.getTime() + marchTimeSecs * 1000);

    const { job } = await prisma.$transaction(async (tx) => {
      const fresh       = await tx.city.findUniqueOrThrow({ where: { id: cityId } });
      const freshTroops = fresh.troops as unknown as TroopMap;

      // Aggregate all waves for validation / deduction
      const totalPerUnit: Partial<Record<UnitId, number>> = {};
      for (const wave of waves) {
        for (const [uid, cnt] of Object.entries(wave) as [UnitId, number][]) {
          if (cnt) totalPerUnit[uid as UnitId] = (totalPerUnit[uid as UnitId] ?? 0) + cnt;
        }
      }
      for (const [uid, cnt] of Object.entries(totalPerUnit) as [UnitId, number][]) {
        if (!cnt) continue;
        const available = freshTroops[uid] ?? 0;
        if (cnt > available) {
          throw Object.assign(
            new Error(`Not enough ${UNITS[uid].name}: have ${available}, sending ${cnt}`),
            { status: 400 },
          );
        }
      }

      const newTroops: TroopMap = { ...freshTroops };
      for (const [uid, cnt] of Object.entries(totalPerUnit) as [UnitId, number][]) {
        newTroops[uid as UnitId] = (newTroops[uid as UnitId] ?? 0) - (cnt ?? 0);
      }
      await tx.city.update({ where: { id: cityId }, data: { troops: newTroops } });

      const meta: ContestJobMeta = {
        attackerCityId: cityId,
        targetX,
        targetY,
        waves: waves as [TroopMap, TroopMap, TroopMap],
      };

      const job = await tx.job.create({
        data: {
          type:      'contest',
          playerId,
          cityId,
          metadata:  meta as unknown as object,
          startedAt: now,
          endsAt,
        },
      });

      return { job };
    });

    res.status(201).json({ success: true, data: { job, marchTimeSecs } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});
// ─── POST /domain/scout — send scouts to gather intelligence on a tile ────────────────

const ScoutSchema = z.object({
  cityId:     z.string().min(1),
  targetX:    z.number().int(),
  targetY:    z.number().int(),
  scoutCount: z.number().int().min(1),
});

router.post('/scout', async (req: Request, res: Response): Promise<void> => {
  const parsed = ScoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { cityId, targetX, targetY, scoutCount } = parsed.data;
  const playerId = req.player!.playerId;

  try {
    // ── Validate city ownership ─────────────────────────────────────
    const city = await prisma.city.findFirst({ where: { id: cityId, playerId } });
    if (!city) {
      res.status(404).json({ success: false, error: 'Base not found' });
      return;
    }

    // ── Determine target type ──────────────────────────────────────
    const [targetEnemyCity, targetDomainTile, targetNeutral] = await Promise.all([
      prisma.city.findUnique({ where: { x_y: { x: targetX, y: targetY } } }),
      prisma.domainTile.findUnique({
        where:   { x_y: { x: targetX, y: targetY } },
        include: { city: { select: { id: true, playerId: true } } },
      }),
      prisma.neutralGarrison.findUnique({
        where: { x_y: { x: targetX, y: targetY } },
      }),
    ]);

    let targetType: ScoutJobMeta['targetType'];
    let targetCityId: string | undefined;

    if (targetEnemyCity) {
      if (targetEnemyCity.playerId === playerId) {
        res.status(400).json({ success: false, error: 'Cannot scout your own base' });
        return;
      }
      targetType   = 'enemy_city';
      targetCityId = targetEnemyCity.id;
    } else if (targetDomainTile) {
      if (targetDomainTile.city.playerId === playerId) {
        res.status(400).json({ success: false, error: 'Cannot scout your own garrison' });
        return;
      }
      targetType   = 'enemy_domain';
      targetCityId = targetDomainTile.city.id;
    } else if (targetNeutral && !targetNeutral.everCleared) {
      const hasUnits = Object.values(targetNeutral.troops as Record<string, number>).some((n) => (n ?? 0) > 0);
      if (!hasUnits) {
        res.status(400).json({ success: false, error: 'No garrison to scout on that tile' });
        return;
      }
      targetType = 'neutral';
    } else {
      res.status(400).json({ success: false, error: 'Nothing to scout on that tile' });
      return;
    }

    // ── Deduct scouts and create job ──────────────────────────────────
    const marchTimeSecs = scaleDuration(
      computeMarchTimeSeconds(city.x, city.y, targetX, targetY, [{ scout: scoutCount }]),
    );
    const now    = new Date();
    const endsAt = new Date(now.getTime() + marchTimeSecs * 1000);

    const { job } = await prisma.$transaction(async (tx) => {
      const fresh      = await tx.city.findUniqueOrThrow({ where: { id: cityId } });
      const freshTroops = fresh.troops as unknown as TroopMap;
      const available   = freshTroops['scout'] ?? 0;
      if (scoutCount > available) {
        throw Object.assign(
          new Error(`Not enough scouts: have ${available}, sending ${scoutCount}`),
          { status: 400 },
        );
      }
      const newTroops: TroopMap = { ...freshTroops, scout: available - scoutCount };
      await tx.city.update({ where: { id: cityId }, data: { troops: newTroops } });

      const meta: ScoutJobMeta = { scoutingCityId: cityId, scoutCount, targetX, targetY, targetType, targetCityId };
      const job = await tx.job.create({
        data: {
          type:      'scout',
          playerId,
          cityId,
          metadata:  meta as unknown as object,
          startedAt: now,
          endsAt,
        },
      });
      return { job };
    });

    res.status(201).json({ success: true, data: { job, marchTimeSecs } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});
// ─── GET /domain/marches — list in-flight garrison marches for the player ─────

router.get('/marches', async (req: Request, res: Response): Promise<void> => {
  const playerId = req.player!.playerId;
  const cityId   = req.query.cityId as string | undefined;

  try {
    // Fetch all non-completed garrison jobs for this player
    const [jobs, allCities] = await Promise.all([
      prisma.job.findMany({
        where: {
          playerId,
          completed: false,
          type: { in: ['claim', 'reinforce', 'recall', 'contest', 'scout'] },
          ...(cityId ? { cityId } : {}),
        },
        orderBy: { endsAt: 'asc' },
      }),
      prisma.city.findMany({
        where: { playerId },
        select: { id: true, name: true },
      }),
    ]);

    const cityNameMap = new Map(allCities.map((c) => [c.id, c.name]));

    // ── Incoming enemy marches targeting the player's domain tiles ─────────────
    const playerDomainTiles = await prisma.domainTile.findMany({
      where:  { cityId: { in: allCities.map((c) => c.id) } },
      select: { x: true, y: true },
    });
    const ownedCoords = new Set(playerDomainTiles.map((t) => `${t.x},${t.y}`));

    const allEnemyJobs = ownedCoords.size > 0
      ? await prisma.job.findMany({
          where:   { completed: false, type: { in: ['claim', 'contest'] }, NOT: { playerId } },
          orderBy: { endsAt: 'asc' },
        })
      : [];

    const incomingJobs = allEnemyJobs.filter((j) => {
      const meta = j.metadata as any;
      return ownedCoords.has(`${meta.targetX},${meta.targetY}`);
    });

    // Batch-fetch attacker city names
    const attackerCityIds = [...new Set(incomingJobs.map((j) => j.cityId).filter(Boolean) as string[])];
    const attackerCities  = attackerCityIds.length > 0
      ? await prisma.city.findMany({ where: { id: { in: attackerCityIds } }, select: { id: true, name: true } })
      : [];
    const attackerCityNameMap = new Map(attackerCities.map((c) => [c.id, c.name]));

    /** Merge all waves into a single TroopMap total for display purposes. */
    function mergeWaves(waves: TroopMap[]): TroopMap {
      const out: TroopMap = {};
      for (const wave of waves) {
        for (const [uid, cnt] of Object.entries(wave) as [UnitId, number][]) {
          if (cnt) out[uid as UnitId] = (out[uid as UnitId] ?? 0) + cnt;
        }
      }
      return out;
    }

    const incoming = incomingJobs.map((j) => {
      const meta = j.metadata as unknown as (ClaimJobMeta | ContestJobMeta);
      return {
        jobId:     j.id,
        type:      j.type as 'claim' | 'contest',
        endsAt:    j.endsAt.toISOString(),
        // troops deliberately omitted — defender should not see enemy unit composition
        cityId:    meta.attackerCityId,
        cityName:  attackerCityNameMap.get(j.cityId ?? '') ?? 'Unknown',
        targetX:   meta.targetX,
        targetY:   meta.targetY,
        canCancel: false,
      };
    });

    const outgoing = jobs
      .filter((j) => j.type === 'claim' || j.type === 'reinforce' || j.type === 'contest' || j.type === 'scout')
      .map((j) => {
        if (j.type === 'reinforce') {
          const meta = j.metadata as unknown as ReinforceJobMeta;
          return {
            jobId:     j.id,
            type:      'reinforce' as const,
            endsAt:    j.endsAt.toISOString(),
            troops:    meta.troops as TroopMap,
            cityId:    meta.cityId,
            cityName:  cityNameMap.get(meta.cityId) ?? 'Unknown',
            targetX:   meta.targetX,
            targetY:   meta.targetY,
            canCancel: false,
          };
        }
        if (j.type === 'scout') {
          const meta = j.metadata as unknown as ScoutJobMeta;
          return {
            jobId:     j.id,
            type:      'scout' as const,
            endsAt:    j.endsAt.toISOString(),
            troops:    { scout: meta.scoutCount } as TroopMap,
            cityId:    meta.scoutingCityId,
            cityName:  cityNameMap.get(meta.scoutingCityId) ?? 'Unknown',
            targetX:   meta.targetX,
            targetY:   meta.targetY,
            canCancel: false,
          };
        }
        // claim or contest — both have waves
        const meta = j.metadata as unknown as (ClaimJobMeta | ContestJobMeta);
        const cId  = meta.attackerCityId;
        return {
          jobId:     j.id,
          type:      j.type as 'claim' | 'contest',
          endsAt:    j.endsAt.toISOString(),
          troops:    mergeWaves(meta.waves as TroopMap[]),
          cityId:    cId,
          cityName:  cityNameMap.get(cId) ?? 'Unknown',
          targetX:   meta.targetX,
          targetY:   meta.targetY,
          canCancel: j.type === 'claim',
        };
      });

    const returning = jobs
      .filter((j) => j.type === 'recall')
      .map((j) => {
        const meta = j.metadata as unknown as RecallJobMeta;
        return {
          jobId:     j.id,
          type:      'recall' as const,
          endsAt:    j.endsAt.toISOString(),
          troops:    meta.troops as TroopMap,
          cityId:    meta.cityId,
          cityName:  cityNameMap.get(meta.cityId) ?? 'Unknown',
          fromX:     meta.fromX,
          fromY:     meta.fromY,
          canCancel: false,
        };
      });

    res.json({ success: true, data: { outgoing, returning, incoming } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
