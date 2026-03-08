import { prisma } from '../db/client';
import {
  computeMaxEnergy,
  computeMaxHealth,
  levelFromXp,
  skillLevelFromXp,
  SkillId,
  SKILL_LIST,
  ENERGY_HEALTH_PER_LEVEL,
  sumHeroItemBonuses,
  ItemBonus,
} from '@rpg/shared';
import { ItemLocation } from '@prisma/client';

/**
 * Load and sum item bonuses from all items in the hero's inventory/equipment.
 * These bonuses apply to hero stats (max energy, adventure speed, etc.).
 */
export async function getHeroItemBonuses(heroId: string): Promise<Required<ItemBonus>> {
  const items = await prisma.itemInstance.findMany({
    where: {
      heroId,
      location: { in: [ItemLocation.hero_inventory, ItemLocation.hero_equipped] },
    },
    select: { itemDefId: true, location: true },
  });
  return sumHeroItemBonuses(items);
}

/**
 * Load all heroes for a player (ordered by creation date).
 */
export async function getHeroesForPlayer(playerId: string) {
  return prisma.hero.findMany({
    where:   { playerId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Load hero from DB by its ID and ensure maxEnergy / maxHealth are up to date
 * with the hero's current level. Regen is applied by the global heroRegenTick job.
 * Returns the up-to-date hero row (already persisted if anything changed).
 */
export async function getHeroWithRegen(heroId: string) {
  const hero = await prisma.hero.findUnique({ where: { id: heroId } });
  if (!hero) throw new Error('Hero not found');

  const skillXpMap  = hero.skillXp     as unknown as Record<SkillId, number>;
  const skillLevels = hero.skillLevels as unknown as Record<SkillId, number>;

  // Self-heal: recalculate skill levels in case the formula was previously wrong.
  const newSkillLevels = { ...skillLevels };
  let skillsChanged = false;
  for (const skillDef of SKILL_LIST) {
    const correct = skillLevelFromXp(skillDef.id, skillXpMap[skillDef.id] ?? 0);
    if (correct !== skillLevels[skillDef.id]) {
      newSkillLevels[skillDef.id] = correct;
      skillsChanged = true;
    }
  }

  // Max energy / max health are purely level-based.
  const maxEnergy = computeMaxEnergy(hero.level);
  const maxHealth = computeMaxHealth(hero.level);

  const maxEnergyChanged = maxEnergy !== hero.maxEnergy;
  const maxHealthChanged = maxHealth !== (hero.maxHealth ?? 100);

  if (skillsChanged || maxEnergyChanged || maxHealthChanged) {
    return prisma.hero.update({
      where: { id: hero.id },
      data: {
        skillLevels: newSkillLevels,
        maxEnergy,
        maxHealth,
        // Clamp current values if max decreased (shouldn't happen in practice)
        energy: Math.min(hero.energy, maxEnergy),
        health: Math.min(hero.health, maxHealth),
      },
    });
  }

  return { ...hero, skillLevels: newSkillLevels, maxEnergy, maxHealth };
}

/**
 * Recalculate hero level and all skill levels from raw XP values.
 * When hero level increases, current energy and health grow by ENERGY_HEALTH_PER_LEVEL per level gained.
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
    const newSkillLevel = skillLevelFromXp(skillDef.id, skillXp[skillDef.id] ?? 0);
    if (newSkillLevel !== skillLevels[skillDef.id]) {
      newSkillLevels[skillDef.id] = newSkillLevel;
      changed = true;
    }
  }

  const maxEnergy = computeMaxEnergy(newLevel);
  const maxHealth = computeMaxHealth(newLevel);

  if (changed) {
    // When level increases, grant +ENERGY_HEALTH_PER_LEVEL energy and health per level gained.
    const levelsGained = Math.max(0, newLevel - hero.level);
    const energyBonus  = levelsGained * ENERGY_HEALTH_PER_LEVEL;
    const healthBonus  = levelsGained * ENERGY_HEALTH_PER_LEVEL;

    const newEnergy = Math.min(hero.energy + energyBonus, maxEnergy);
    const newHealth = Math.min(hero.health + healthBonus, maxHealth);

    return prisma.hero.update({
      where: { id: heroId },
      data: {
        level:       newLevel,
        skillLevels: newSkillLevels,
        maxEnergy,
        maxHealth,
        energy:      newEnergy,
        health:      newHealth,
      },
    });
  }

  return hero;
}
