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
  AttackJobMeta,
  AttackInfo,
  computeMarchTimeSeconds,
} from '@rpg/shared';
import { io, playerSockets } from '../index';

const router = Router();
router.use(requireAuth);

// ─── Zod helpers ─────────────────────────────────────────────────────────────

const UNIT_IDS = UNIT_LIST.map((u) => u.id) as [UnitId, ...UnitId[]];

/**
 * A wave is a partial record of unitId → count (≥ 0).
 * Unknown keys are stripped by zod; missing keys default to 0.
 */
const TroopMapSchema = z
  .record(z.enum(UNIT_IDS), z.number().int().min(0))
  .default({});

const AttackSchema = z.object({
  attackerCityId: z.string().min(1),
  targetCityId:   z.string().min(1),
  /** Exactly three waves, each a partial troop composition. */
  waves: z.tuple([TroopMapSchema, TroopMapSchema, TroopMapSchema]),
});

// ─── POST /attack ─────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = AttackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { attackerCityId, targetCityId, waves } = parsed.data;
  const playerId = req.player!.playerId;

  try {
    // ── Validate attacker owns attacker city ────────────────────────────────
    const attackerCity = await prisma.city.findFirst({
      where: { id: attackerCityId, playerId },
    });
    if (!attackerCity) {
      res.status(404).json({ success: false, error: 'Attacking base not found' });
      return;
    }

    // ── Validate target exists and belongs to a different player ────────────
    const targetCity = await prisma.city.findFirst({
      where: { id: targetCityId },
    });
    if (!targetCity) {
      res.status(404).json({ success: false, error: 'Target base not found' });
      return;
    }
    if (targetCity.playerId === playerId) {
      res.status(400).json({ success: false, error: 'Cannot attack your own base' });
      return;
    }

    // ── Tally total committed troops across all waves ───────────────────────
    const totalCommitted: Partial<Record<UnitId, number>> = {};
    for (const wave of waves) {
      for (const [uid, cnt] of Object.entries(wave) as [UnitId, number][]) {
        if (!cnt) continue;
        totalCommitted[uid] = (totalCommitted[uid] ?? 0) + cnt;
      }
    }

    const totalTroops = Object.values(totalCommitted).reduce((s, n) => s + (n ?? 0), 0);
    if (totalTroops === 0) {
      res.status(400).json({ success: false, error: 'Must commit at least one troop' });
      return;
    }

    // ── Compute march time ──────────────────────────────────────────────────
    const rawMarchSecs = computeMarchTimeSeconds(
      attackerCity.x, attackerCity.y,
      targetCity.x, targetCity.y,
      waves as TroopMap[],
    );
    const marchTimeSecs = scaleDuration(rawMarchSecs);
    const now    = new Date();
    const endsAt = new Date(now.getTime() + marchTimeSecs * 1000);

    // ── Atomically deduct troops and create job ─────────────────────────────
    const { job } = await prisma.$transaction(async (tx) => {
      const fresh       = await tx.city.findUniqueOrThrow({ where: { id: attackerCityId } });
      const freshTroops = fresh.troops as unknown as TroopMap;

      // Re-validate garrison inside the transaction (prevents double-commit races)
      for (const [uid, committed] of Object.entries(totalCommitted) as [UnitId, number][]) {
        const available = freshTroops[uid] ?? 0;
        if (committed > available) {
          throw Object.assign(
            new Error(`Not enough ${UNITS[uid].name}: have ${available}, sending ${committed}`),
            { status: 400 },
          );
        }
      }

      const newTroops: TroopMap = { ...freshTroops };
      for (const [uid, committed] of Object.entries(totalCommitted) as [UnitId, number][]) {
        newTroops[uid as UnitId] = (newTroops[uid as UnitId] ?? 0) - committed;
      }

      await tx.city.update({ where: { id: attackerCityId }, data: { troops: newTroops } });

      const job = await tx.job.create({
        data: {
          type:      'attack',
          playerId,
          cityId:    attackerCityId,
          metadata:  { attackerCityId, targetCityId, waves },
          startedAt: now,
          endsAt,
        },
      });

      return { job };
    });

    res.status(201).json({
      success: true,
      data: { job, marchTimeSecs },
    });

    // ── Notify defender that an attack is incoming ──────────────────────────
    setImmediate(async () => {
      try {
        const [attackerPlayer, tgtCity] = await Promise.all([
          prisma.player.findUnique({ where: { id: playerId }, select: { username: true } }),
          prisma.city.findUnique({ where: { id: targetCityId }, select: { name: true, playerId: true } }),
        ]);
        if (tgtCity) {
          const defenderSocketId = playerSockets.get(tgtCity.playerId);
          if (defenderSocketId) {
            io.to(defenderSocketId).emit('attack:incoming', {
              jobId:            job.id,
              endsAt:           endsAt.toISOString(),
              attackerUsername: attackerPlayer?.username ?? 'Unknown',
              attackerCityName: attackerCity.name,
              targetCityId,
              targetCityName:   tgtCity.name,
            });
          }
        }
      } catch { /* non-fatal */ }
    });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── GET /attack — list outgoing and incoming attacks ─────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const playerId = req.player!.playerId;
  try {
    const [allAttackJobs, myCities] = await Promise.all([
      prisma.job.findMany({ where: { type: 'attack', completed: false } }),
      prisma.city.findMany({ where: { playerId }, select: { id: true } }),
    ]);

    const myCityIdSet = new Set(myCities.map((c) => c.id));

    const outgoingJobs = allAttackJobs.filter((j) => j.playerId === playerId);
    const incomingJobs = allAttackJobs.filter((j) => {
      const meta = j.metadata as unknown as AttackJobMeta;
      return j.playerId !== playerId && myCityIdSet.has(meta.targetCityId);
    });

    // Collect all city IDs needed for name lookups
    const cityIdSet = new Set<string>();
    for (const j of [...outgoingJobs, ...incomingJobs]) {
      const m = j.metadata as unknown as AttackJobMeta;
      cityIdSet.add(m.attackerCityId);
      cityIdSet.add(m.targetCityId);
    }

    const cities = await prisma.city.findMany({
      where: { id: { in: [...cityIdSet] } },
      select: { id: true, name: true, playerId: true },
    });
    const cityMap = new Map(cities.map((c) => [c.id, c]));

    const playerIds = [...new Set(cities.map((c) => c.playerId))];
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, username: true },
    });
    const playerMap = new Map(players.map((p) => [p.id, p]));

    const toAttackInfo = (j: (typeof allAttackJobs)[number], includeWaves = true): AttackInfo => {
      const meta    = j.metadata as unknown as AttackJobMeta;
      const attCity = cityMap.get(meta.attackerCityId);
      const tgtCity = cityMap.get(meta.targetCityId);
      return {
        jobId:            j.id,
        endsAt:           j.endsAt.toISOString(),
        attackerCityId:   meta.attackerCityId,
        attackerCityName: attCity?.name ?? 'Unknown',
        attackerUsername: attCity ? (playerMap.get(attCity.playerId)?.username ?? 'Unknown') : 'Unknown',
        targetCityId:     meta.targetCityId,
        targetCityName:   tgtCity?.name ?? 'Unknown',
        targetUsername:   tgtCity ? (playerMap.get(tgtCity.playerId)?.username ?? 'Unknown') : 'Unknown',
        ...(includeWaves && { waves: meta.waves }),
      };
    };

    res.json({
      success: true,
      data: {
        outgoing: outgoingJobs.map((j) => toAttackInfo(j, true)),
        incoming: incomingJobs.map((j) => toAttackInfo(j, false)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /attack/:jobId — cancel an outgoing attack ───────────────────────

router.delete('/:jobId', async (req: Request, res: Response): Promise<void> => {
  const { jobId } = req.params;
  const playerId  = req.player!.playerId;
  try {
    const job = await prisma.job.findFirst({
      where: { id: jobId, type: 'attack', completed: false },
    });
    if (!job) {
      res.status(404).json({ success: false, error: 'Attack job not found or already resolved' });
      return;
    }
    if (job.playerId !== playerId) {
      res.status(403).json({ success: false, error: 'Not your attack' });
      return;
    }

    const meta = job.metadata as unknown as AttackJobMeta;

    // Return troops and delete the job atomically
    await prisma.$transaction(async (tx) => {
      const city = await tx.city.findUnique({ where: { id: meta.attackerCityId } });
      if (city) {
        const garrison  = city.troops as unknown as TroopMap;
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

    const payload = { jobId, attackerCityId: meta.attackerCityId, targetCityId: meta.targetCityId };

    // Notify attacker
    const atkSocket = playerSockets.get(playerId);
    if (atkSocket) io.to(atkSocket).emit('attack:cancelled', payload);

    // Notify defender
    const tgtCity = await prisma.city.findUnique({ where: { id: meta.targetCityId }, select: { playerId: true } });
    if (tgtCity) {
      const defSocket = playerSockets.get(tgtCity.playerId);
      if (defSocket) io.to(defSocket).emit('attack:cancelled', payload);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

export default router;
