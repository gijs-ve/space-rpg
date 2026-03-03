import { prisma } from '../db/client';
import {
  computeMaxEnergy,
  computeEnergyRegen,
  levelFromXp,
  skillLevelFromXp,
  SkillId,
  SKILL_LIST,
} from '@rpg/shared';

/**
 * Load hero from DB and apply any pending energy regeneration.
 * Returns the up-to-date hero row (already persisted).
 */
export async function getHeroWithRegen(playerId: string) {
  const hero = await prisma.hero.findUnique({ where: { playerId } });
  if (!hero) throw new Error('Hero not found');

  const skillLevels = hero.skillLevels as unknown as Record<SkillId, number>;
  const maxEnergy   = computeMaxEnergy(skillLevels);

  const { newEnergy, newLastRegenTime } = computeEnergyRegen(
    hero.energy,
    maxEnergy,
    hero.lastEnergyRegen,
    new Date()
  );

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
