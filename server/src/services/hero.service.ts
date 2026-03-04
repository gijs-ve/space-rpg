import { prisma } from '../db/client';
import {
  computeMaxEnergy,
  levelFromXp,
  skillLevelFromXp,
  SkillId,
  SKILL_LIST,
  BASE_MAX_ENERGY,
  ENERGY_REGEN_INTERVAL_SECONDS,
} from '@rpg/shared';
import { TIMER_DIVISOR } from '../config';

/**
 * Load hero from DB and apply any pending energy regeneration.
 * Returns the up-to-date hero row (already persisted).
 */
export async function getHeroWithRegen(playerId: string) {
  const hero = await prisma.hero.findUnique({ where: { playerId } });
  if (!hero) throw new Error('Hero not found');

  const skillLevels = hero.skillLevels as unknown as Record<SkillId, number>;
  const maxEnergy   = computeMaxEnergy(skillLevels);

  // Compute regen with the effective interval (DIV 10 in staging).
  const effectiveInterval = ENERGY_REGEN_INTERVAL_SECONDS / TIMER_DIVISOR;
  const now              = new Date();
  const elapsedSeconds   = (now.getTime() - hero.lastEnergyRegen.getTime()) / 1000;
  const pointsToAdd      = Math.min(
    Math.floor(elapsedSeconds / effectiveInterval),
    maxEnergy - hero.energy,
  );
  const newEnergy        = hero.energy + pointsToAdd;
  const usedSeconds      = pointsToAdd * effectiveInterval;
  const newLastRegenTime = new Date(hero.lastEnergyRegen.getTime() + usedSeconds * 1000);

  // Update only if something changed
  if (newEnergy !== hero.energy || newLastRegenTime.getTime() !== hero.lastEnergyRegen.getTime()) {
    return prisma.hero.update({
      where: { id: hero.id },
      data: {
        energy:          newEnergy,
        maxEnergy,
        lastEnergyRegen: newLastRegenTime,
      },
    });
  }

  return { ...hero, maxEnergy };
}

/**
 * Recalculate hero level and all skill levels from raw XP values.
 * Call this after awarding XP from adventures.
 */
export async function recalculateHeroProgression(heroId: string) {
  const hero = await prisma.hero.findUniqueOrThrow({ where: { id: heroId } });

  const newLevel      = levelFromXp(hero.xp);
  const skillXp       = hero.skillXp    as unknown as Record<SkillId, number>;
  const skillLevels   = hero.skillLevels as unknown as Record<SkillId, number>;

  let changed = newLevel !== hero.level;

  const newSkillLevels = { ...skillLevels };
  for (const skillDef of SKILL_LIST) {
    const newLevel = skillLevelFromXp(skillDef.id, skillXp[skillDef.id] ?? 0);
    if (newLevel !== skillLevels[skillDef.id]) {
      newSkillLevels[skillDef.id] = newLevel;
      changed = true;
    }
  }

  const maxEnergy = computeMaxEnergy(newSkillLevels);

  if (changed) {
    return prisma.hero.update({
      where: { id: heroId },
      data: {
        level:       newLevel,
        skillLevels: newSkillLevels,
        maxEnergy,
      },
    });
  }

  return hero;
}
