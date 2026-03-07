import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/client';
import { getHeroWithRegen, getHeroesForPlayer, getHeroItemBonuses } from '../services/hero.service';
import { scaleDuration } from '../config';
import {
  ACTIVITIES,
  ActivityType,
  ACTIVITY_LIST,
  computeAdventureDuration,
  heroUnlockRequiredTotalLevel,
  SkillId,
} from '@rpg/shared';

const router = Router();
router.use(requireAuth);

// ─── GET /hero ────────────────────────────────────────────────────────────────
// Returns all heroes for the player with regen applied, their active adventures,
// and unlock progress for the next hero.
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId  = req.player!.playerId;
    const rawHeroes = await getHeroesForPlayer(playerId);

    const entries = await Promise.all(
      rawHeroes.map(async (raw) => {
        const hero = await getHeroWithRegen(raw.id);
        const activeAdventure = await prisma.job.findFirst({
          where: { heroId: hero.id, type: 'adventure', completed: false },
        });
        let homeCityName: string | null = null;
        if (hero.homeCityId) {
          const city = await prisma.city.findUnique({
            where:  { id: hero.homeCityId },
            select: { name: true },
          });
          homeCityName = city?.name ?? null;
        }
        return { hero, activeAdventure: activeAdventure ?? null, homeCityName };
      }),
    );

    const totalLevel          = entries.reduce((sum, e) => sum + e.hero.level, 0);
    const nextHeroUnlockLevel = heroUnlockRequiredTotalLevel(rawHeroes.length);

    res.json({ success: true, data: { heroes: entries, totalLevel, nextHeroUnlockLevel } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /hero/create ────────────────────────────────────────────────────────
const CreateHeroSchema = z.object({
  name: z.string().min(1).max(32),
});

router.post('/create', async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateHeroSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const playerId = req.player!.playerId;
  const { name } = parsed.data;

  try {
    const existingHeroes = await getHeroesForPlayer(playerId);

    // First hero is always free; subsequent heroes require combined level threshold
    if (existingHeroes.length > 0) {
      const totalLevel    = existingHeroes.reduce((sum, h) => sum + h.level, 0);
      const requiredLevel = heroUnlockRequiredTotalLevel(existingHeroes.length);
      if (totalLevel < requiredLevel) {
        res.status(403).json({
          success: false,
          error:   `Combined hero level must reach ${requiredLevel} to recruit another hero (currently ${totalLevel})`,
        });
        return;
      }
    }

    const hero = await prisma.hero.create({
      data: {
        name,
        playerId,
        skillLevels: { combat: 0, endurance: 0, observation: 0, navigation: 0, tactics: 0 },
        skillXp:     { combat: 0, endurance: 0, observation: 0, navigation: 0, tactics: 0 },
      },
    });

    res.status(201).json({ success: true, data: { hero } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /hero/:heroId/adventure ─────────────────────────────────────────────
const AdventureSchema = z.object({
  activityType: z.enum(
    ACTIVITY_LIST.map((a) => a.id) as [ActivityType, ...ActivityType[]],
  ),
});

router.post('/:heroId/adventure', async (req: Request, res: Response): Promise<void> => {
  const parsed = AdventureSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { activityType } = parsed.data;
  const playerId         = req.player!.playerId;
  const { heroId }       = req.params;

  try {
    // Verify the hero belongs to this player
    const heroCheck = await prisma.hero.findFirst({ where: { id: heroId, playerId } });
    if (!heroCheck) {
      res.status(404).json({ success: false, error: 'Hero not found' });
      return;
    }

    const hero   = await getHeroWithRegen(heroId);
    const actDef = ACTIVITIES[activityType];

    if (hero.level < actDef.heroLevelRequirement) {
      res.status(400).json({
        success: false,
        error: `Hero must be level ${actDef.heroLevelRequirement} for this activity`,
      });
      return;
    }

    if (hero.energy < actDef.energyCost) {
      res.status(400).json({
        success: false,
        error: `Not enough energy (need ${actDef.energyCost}, have ${hero.energy})`,
      });
      return;
    }

    const skillLevels  = hero.skillLevels as unknown as Record<SkillId, number>;
    const itemBonuses  = await getHeroItemBonuses(hero.id);
    const [minDur, maxDur] = actDef.durationRange;
    const baseDuration = minDur + Math.floor(Math.random() * (maxDur - minDur + 1));
    const duration     = scaleDuration(computeAdventureDuration(baseDuration, skillLevels, itemBonuses));

    const now    = new Date();
    const endsAt = new Date(now.getTime() + duration * 1000);

    const { updatedHero, job } = await prisma.$transaction(async (tx) => {
      const freshHero = await tx.hero.findUniqueOrThrow({ where: { id: hero.id } });

      if (freshHero.energy < actDef.energyCost) {
        throw Object.assign(
          new Error(`Not enough energy (need ${actDef.energyCost}, have ${freshHero.energy})`),
          { status: 400 },
        );
      }

      const existingAdventure = await tx.job.findFirst({
        where: { heroId, type: 'adventure', completed: false },
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
          type:      'adventure',
          playerId,
          heroId,
          metadata:  { activityType, heroId },
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
