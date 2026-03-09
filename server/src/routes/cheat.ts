/**
 * Cheat routes — only mounted when NODE_ENV !== 'production'.
 * These routes bypass normal game constraints for development convenience.
 */
import { Router }      from 'express';
import { prisma }      from '../db/client';
import { requireAuth } from '../middleware/auth';
import { RESOURCE_TYPES, xpRequiredForLevel } from '@rpg/shared';

const router = Router();

// ─── Add resources ────────────────────────────────────────────────────────────
// POST /cheat/resources
// Adds 10,000 of every resource to all of the player's cities.

router.post('/resources', requireAuth, async (req, res) => {
  const { playerId } = req.player!;

  const cities = await prisma.city.findMany({
    where:  { playerId },
    select: { id: true, resources: true },
  });

  if (cities.length === 0) {
    res.json({ success: true, data: { message: 'No cities found' } });
    return;
  }

  await Promise.all(
    cities.map((city) => {
      const current = city.resources as Record<string, number>;
      const updated: Record<string, number> = { ...current };
      for (const r of RESOURCE_TYPES) {
        updated[r] = (updated[r] ?? 0) + 10_000;
      }
      return prisma.city.update({
        where: { id: city.id },
        data:  { resources: updated },
      });
    }),
  );

  res.json({ success: true, data: { message: `+10k to all resources for ${cities.length} city/cities` } });
});

// ─── Hero level up ────────────────────────────────────────────────────────────
// POST /cheat/hero-level
// Body: { heroId: string }
// Sets the hero's XP to exactly xpRequiredForLevel(currentLevel + 1),
// which causes `levelFromXp` to resolve to currentLevel+1.

router.post('/hero-level', requireAuth, async (req, res) => {
  const { playerId } = req.player!;
  const { heroId }   = req.body as { heroId: string };

  if (!heroId) {
    res.status(400).json({ success: false, error: 'heroId is required' });
    return;
  }

  const hero = await prisma.hero.findFirst({
    where:  { id: heroId, playerId },
    select: { id: true, level: true, xp: true },
  });

  if (!hero) {
    res.status(404).json({ success: false, error: 'Hero not found for this player' });
    return;
  }
  const newXp    = xpRequiredForLevel(hero.level + 1);
  const newLevel = hero.level + 1;

  await prisma.hero.update({
    where: { id: hero.id },
    data:  { level: newLevel, xp: newXp },
  });

  res.json({
    success: true,
    data: {
      heroId: hero.id,
      oldLevel: hero.level,
      newLevel,
      newXp,
    },
  });
});

export default router;
