import { prisma } from '../db/client';
import {
  computeMaxEnergy,
  computeMaxHealth,
  levelFromXp,
  skillLevelFromXp,
  SkillId,
  SKILL_LIST,
  BASE_MAX_ENERGY,
  ENERGY_REGEN_INTERVAL_SECONDS,
  HEALTH_REGEN_INTERVAL_SECONDS,
  sumHeroItemBonuses,
  ItemBonus,
} from '@rpg/shared';
import { ItemLocation } from '@prisma/client';
import { TIMER_DIVISOR } from '../config';

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
 * Load hero from DB by its ID and apply any pending energy/health regeneration.
 * Returns the up-to-date hero row (already persisted).
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

  const itemBonuses = await getHeroItemBonuses(hero.id);
  const maxEnergy   = computeMaxEnergy(newSkillLevels, itemBonuses);

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

  // Health regen (guard against null/undefined for heroes created before the field was added)
  const maxHealth              = computeMaxHealth(newSkillLevels, itemBonuses);
  const currentHealth          = hero.health          ?? 100;
  const lastHealthRegenDate    = hero.lastHealthRegen  ?? now;
  const healthInterval         = HEALTH_REGEN_INTERVAL_SECONDS / TIMER_DIVISOR;
  const healthElapsed          = (now.getTime() - lastHealthRegenDate.getTime()) / 1000;
  const healthPointsToAdd      = Math.min(
    Math.floor(healthElapsed / healthInterval),
    maxHealth - currentHealth,
  );
  const newHealth              = currentHealth + healthPointsToAdd;
  const usedHealthSeconds      = healthPointsToAdd * healthInterval;
  const newLastHealthRegenTime = new Date(lastHealthRegenDate.getTime() + usedHealthSeconds * 1000);

  // Update only if something changed
  const energyChanged    = newEnergy !== hero.energy || newLastRegenTime.getTime() !== hero.lastEnergyRegen.getTime();
  const healthChanged    = newHealth !== currentHealth || newLastHealthRegenTime.getTime() !== lastHealthRegenDate.getTime();
  const maxEnergyChanged = maxEnergy !== hero.maxEnergy;
  const maxHealthChanged = maxHealth !== (hero.maxHealth ?? 100);
  if (energyChanged || healthChanged || skillsChanged || maxEnergyChanged || maxHealthChanged) {
    return prisma.hero.update({
      where: { id: hero.id },
      data: {
        skillLevels:     newSkillLevels,
        health:          newHealth,
        maxHealth,
        lastHealthRegen: newLastHealthRegenTime,
        energy:          newEnergy,
        maxEnergy,
        lastEnergyRegen: newLastRegenTime,
      },
    });
  }

  // Return the hero with freshly-computed maxEnergy / maxHealth even when no DB write was needed.
  return { ...hero, skillLevels: newSkillLevels, energy: newEnergy, maxEnergy, health: currentHealth, maxHealth, lastHealthRegen: lastHealthRegenDate, lastEnergyRegen: newLastRegenTime };
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

  const itemBonuses = await getHeroItemBonuses(heroId);
  const maxEnergy   = computeMaxEnergy(newSkillLevels, itemBonuses);
  const maxHealth   = computeMaxHealth(newSkillLevels, itemBonuses);

  if (changed) {
    return prisma.hero.update({
      where: { id: heroId },
      data: {
        level:       newLevel,
        skillLevels: newSkillLevels,
        maxEnergy,
        maxHealth,
      },
    });
  }

  return hero;
}
