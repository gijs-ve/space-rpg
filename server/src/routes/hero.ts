import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/client';
import { getHeroWithRegen } from '../services/hero.service';
import { scaleDuration } from '../config';
import {
  ACTIVITIES,
  ActivityType,
  ACTIVITY_LIST,
  computeAdventureDuration,
  SkillId,
} from '@rpg/shared';

const router = Router();
router.use(requireAuth);

// ─── GET /hero ────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const hero = await getHeroWithRegen(req.player!.playerId);
    const activeAdventure = await prisma.job.findFirst({
      where: { playerId: req.player!.playerId, type: 'adventure', completed: false },
    });
    let homeCityName: string | null = null;
    if (hero.homeCityId) {
      const city = await prisma.city.findUnique({
        where:  { id: hero.homeCityId },
        select: { name: true },
      });
      homeCityName = city?.name ?? null;
    }
    res.json({ success: true, data: { hero, activeAdventure: activeAdventure ?? null, homeCityName } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /hero/adventure ─────────────────────────────────────────────────────
const AdventureSchema = z.object({
  activityType: z.enum(
    ACTIVITY_LIST.map((a) => a.id) as [ActivityType, ...ActivityType[]]
  ),
});

router.post('/adventure', async (req: Request, res: Response): Promise<void> => {
  const parsed = AdventureSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { activityType } = parsed.data;
  const playerId = req.player!.playerId;

  try {
    const hero = await getHeroWithRegen(playerId);
    const actDef = ACTIVITIES[activityType];

    // Check level requirement
    if (hero.level < actDef.heroLevelRequirement) {
      res.status(400).json({
        success: false,
        error: `Hero must be level ${actDef.heroLevelRequirement} for this activity`,
      });
      return;
    }

    // Check energy
    if (hero.energy < actDef.energyCost) {
      res.status(400).json({
        success: false,
        error: `Not enough energy (need ${actDef.energyCost}, have ${hero.energy})`,
      });
      return;
    }

    // Compute duration with tactics skill bonus (no DB needed, do before tx).
    const skillLevels = hero.skillLevels as unknown as Record<SkillId, number>;
    const [minDur, maxDur] = actDef.durationRange;
    const baseDuration = minDur + Math.floor(Math.random() * (maxDur - minDur + 1));
    const duration = scaleDuration(computeAdventureDuration(baseDuration, skillLevels));

    const now    = new Date();
    const endsAt = new Date(now.getTime() + duration * 1000);

    // Re-read hero energy AND check for an active adventure inside the
    // transaction so both checks and the deduction are atomic — prevents
    // double-spend or duplicate adventures from concurrent requests.
    const { updatedHero, job } = await prisma.$transaction(async (tx) => {
      const freshHero = await tx.hero.findUniqueOrThrow({ where: { id: hero.id } });

      if (freshHero.energy < actDef.energyCost) {
        throw Object.assign(
          new Error(`Not enough energy (need ${actDef.energyCost}, have ${freshHero.energy})`),
          { status: 400 },
        );
      }

      const existingAdventure = await tx.job.findFirst({
        where: { playerId, type: 'adventure', completed: false },
      });
      if (existingAdventure) {
        throw Object.assign(new Error('Adventure already in progress'), { status: 409 });
      }

      const updatedHero = await tx.hero.update({
        where: { id: freshHero.id },
        data:  { energy: freshHero.energy - actDef.energyCost },
      });
      const job = await tx.job.create({
        data: {
          type:     'adventure',
          playerId,
          metadata: { activityType },
          startedAt: now,
          endsAt,
        },
      });
      return { updatedHero, job };
    });

    res.status(201).json({ success: true, data: { job, hero: updatedHero } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

export default router;
