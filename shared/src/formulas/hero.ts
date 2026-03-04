import { BASE_MAX_ENERGY, BASE_MAX_HEALTH, ENERGY_REGEN_INTERVAL_SECONDS, HEALTH_REGEN_INTERVAL_SECONDS, SKILLS, SkillId } from '../constants/skills';
import { ItemBonus } from '../constants/items';
import { SkillLevels, SkillXp } from '../types/game';

// ─── Hero level ───────────────────────────────────────────────────────────────

/**
 * Total XP required to reach `level` from level 1.
 * Uses a quadratic curve: sum of 100 * n^1.5 for n = 1..level-1
 */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let n = 1; n < level; n++) {
    total += Math.floor(100 * Math.pow(n, 1.5));
  }
  return total;
}

/**
 * XP needed to go from current level to next level.
 */
export function xpToNextLevel(currentLevel: number): number {
  return xpRequiredForLevel(currentLevel + 1) - xpRequiredForLevel(currentLevel);
}

/**
 * Derive hero level from cumulative XP.
 */
export function levelFromXp(totalXp: number): number {
  let level = 1;
  while (xpRequiredForLevel(level + 1) <= totalXp) {
    level++;
  }
  return level;
}

// ─── Energy ───────────────────────────────────────────────────────────────────

/**
 * Maximum energy for a hero, accounting for endurance skill level and
 * any item bonuses from carried/equipped items.
 *
 * @param skillLevels - Hero's current skill levels.
 * @param itemBonuses - Summed bonuses from items in hero_inventory/hero_equipped.
 */
export function computeMaxEnergy(skillLevels: SkillLevels, itemBonuses: ItemBonus = {}): number {
  const enduranceLevel = skillLevels.endurance ?? 0;
  const skillBonus = enduranceLevel * (SKILLS.endurance.bonusPerLevel['maxEnergyBonus'] ?? 0);
  const itemBonus  = itemBonuses.maxEnergyBonus ?? 0;
  return BASE_MAX_ENERGY + skillBonus + itemBonus;
}

/**
 * How much energy has regenerated since `lastRegenTime`.
 * Returns { newEnergy, newLastRegenTime }.
 */
export function computeEnergyRegen(
  currentEnergy: number,
  maxEnergy: number,
  lastRegenTime: Date,
  now: Date = new Date()
): { newEnergy: number; newLastRegenTime: Date } {
  const elapsedSeconds = (now.getTime() - lastRegenTime.getTime()) / 1000;
  const pointsToAdd = Math.floor(elapsedSeconds / ENERGY_REGEN_INTERVAL_SECONDS);

  if (pointsToAdd === 0) {
    return { newEnergy: currentEnergy, newLastRegenTime: lastRegenTime };
  }

  const newEnergy = Math.min(currentEnergy + pointsToAdd, maxEnergy);
  const usedSeconds = pointsToAdd * ENERGY_REGEN_INTERVAL_SECONDS;
  const newLastRegenTime = new Date(lastRegenTime.getTime() + usedSeconds * 1000);

  return { newEnergy, newLastRegenTime };
}

/**
 * Maximum health for a hero, accounting for any item bonuses.
 * Skills do not currently affect max health (reserved for future expansion).
 */
export function computeMaxHealth(skillLevels: SkillLevels, itemBonuses: ItemBonus = {}): number {
  const itemBonus = itemBonuses.maxHealthBonus ?? 0;
  return BASE_MAX_HEALTH + itemBonus;
}

/**
 * How much health has regenerated since `lastRegenTime`.
 * Returns { newHealth, newLastRegenTime }.
 */
export function computeHealthRegen(
  currentHealth: number,
  maxHealth: number,
  lastRegenTime: Date,
  now: Date = new Date()
): { newHealth: number; newLastRegenTime: Date } {
  const elapsedSeconds = (now.getTime() - lastRegenTime.getTime()) / 1000;
  const pointsToAdd   = Math.floor(elapsedSeconds / HEALTH_REGEN_INTERVAL_SECONDS);

  if (pointsToAdd === 0) {
    return { newHealth: currentHealth, newLastRegenTime: lastRegenTime };
  }

  const newHealth        = Math.min(currentHealth + pointsToAdd, maxHealth);
  const usedSeconds      = pointsToAdd * HEALTH_REGEN_INTERVAL_SECONDS;
  const newLastRegenTime = new Date(lastRegenTime.getTime() + usedSeconds * 1000);

  return { newHealth, newLastRegenTime };
}

// ─── Computed hero stats (skills + items combined) ───────────────────────────────

/**
 * All effective hero stats derived from skill levels and item bonuses.
 * This is the canonical source for displaying totals in the hero UI.
 *
 * To add a new derived stat in the future:
 *  1. Add the field here and compute it.
 *  2. Display it in the hero stats card.
 */
export interface ComputedHeroStats {
  /** Effective attack power (combat skill + items) */
  attack: number;
  /** Effective defense (items only for now) */
  defense: number;
  /** Effective max energy (endurance skill + items) */
  maxEnergy: number;
  /** Effective max health (items only for now) */
  maxHealth: number;
  /** Total gathering bonus in % (gathering skill + items) */
  gatheringBonus: number;
  /** Total adventure/travel speed reduction in % (tactics skill + items, capped 50) */
  adventureSpeedReduction: number;
}

export function computeHeroStats(
  skillLevels: SkillLevels,
  itemBonuses: ItemBonus = {}
): ComputedHeroStats {
  const combatLevel      = skillLevels.combat      ?? 0;
  const observationLevel = skillLevels.observation ?? 0;
  const tacticsLevel     = skillLevels.tactics     ?? 0;

  const attack  = 10
    + combatLevel * (SKILLS.combat.bonusPerLevel['attackBonus'] ?? 0)
    + (itemBonuses.attackBonus ?? 0);

  const defense = 5 + (itemBonuses.defenseBonus ?? 0);

  const maxEnergy = computeMaxEnergy(skillLevels, itemBonuses);
  const maxHealth = computeMaxHealth(skillLevels, itemBonuses);

  const gatheringBonus =
    observationLevel * (SKILLS.observation.bonusPerLevel['gatheringBonus'] ?? 0)
    + (itemBonuses.gatheringBonus ?? 0);

  const adventureSpeedReduction = Math.min(
    tacticsLevel * (SKILLS.tactics.bonusPerLevel['adventureSpeedBonus'] ?? 0)
    + (itemBonuses.adventureSpeedBonus ?? 0),
    50
  );

  return { attack, defense, maxEnergy, maxHealth, gatheringBonus, adventureSpeedReduction };
}
export function skillLevelFromXp(skillId: SkillId, totalXp: number): number {
  const def = SKILLS[skillId];
  let level = 1; // minimum skill level is 1
  let accumulated = 0;
  // xpPerLevel[i] is the XP cost to go from level i+1 → i+2.
  // There are maxLevel-1 transitions (1→2, 2→3, …, (maxLevel-1)→maxLevel).
  for (let i = 0; i < def.maxLevel - 1; i++) {
    accumulated += def.xpPerLevel[i];
    if (totalXp >= accumulated) {
      level = i + 2; // crossed threshold i means reached level i+2
    } else {
      break;
    }
  }
  return level;
}

/**
 * XP needed to reach the next skill level.
 */
export function skillXpToNextLevel(skillId: SkillId, currentLevel: number): number {
  const def = SKILLS[skillId];
  if (currentLevel >= def.maxLevel) return 0;
  return def.xpPerLevel[currentLevel]; // xpPerLevel[i] = cost to reach level i+1
}

// ─── Adventure duration ───────────────────────────────────────────────────────

/**
 * Compute actual adventure/travel duration accounting for tactics skill and
 * any item speed bonuses from carried/equipped items.
 *
 * Total reduction is capped at 50%.
 *
 * @param baseSeconds - Base duration in seconds before any bonuses.
 * @param skillLevels - Hero's current skill levels.
 * @param itemBonuses - Summed bonuses from items in hero_inventory/hero_equipped.
 */
export function computeAdventureDuration(
  baseSeconds: number,
  skillLevels: SkillLevels,
  itemBonuses: ItemBonus = {}
): number {
  const tacticsLevel     = skillLevels.tactics ?? 0;
  const skillReductionPct = tacticsLevel * (SKILLS.tactics.bonusPerLevel['adventureSpeedBonus'] ?? 0);
  const itemReductionPct  = itemBonuses.adventureSpeedBonus ?? 0;
  const totalPct  = skillReductionPct + itemReductionPct;
  const reduction = Math.min(totalPct, 50); // cap at 50% total reduction
  return Math.floor(baseSeconds * (1 - reduction / 100));
}
