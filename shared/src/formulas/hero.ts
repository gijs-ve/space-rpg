import { BASE_MAX_ENERGY, ENERGY_REGEN_INTERVAL_SECONDS, SKILLS, SkillId } from '../constants/skills';
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
 * Maximum energy for a hero, accounting for endurance skill level.
 */
export function computeMaxEnergy(skillLevels: SkillLevels): number {
  const enduranceLevel = skillLevels.endurance ?? 0;
  const bonus = enduranceLevel * (SKILLS.endurance.bonusPerLevel['maxEnergyBonus'] ?? 0);
  return BASE_MAX_ENERGY + bonus;
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

// ─── Skills ───────────────────────────────────────────────────────────────────

/**
 * Derive skill level from cumulative skill XP.
 */
export function skillLevelFromXp(skillId: SkillId, totalXp: number): number {
  const def = SKILLS[skillId];
  let level = 1; // minimum skill level is 1
  let accumulated = 0;
  for (let i = 0; i < def.maxLevel; i++) {
    accumulated += def.xpPerLevel[i];
    if (totalXp >= accumulated) {
      level = i + 1;
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
 * Compute actual adventure duration accounting for tactics skill speed bonus.
 */
export function computeAdventureDuration(
  baseSeconds: number,
  skillLevels: SkillLevels
): number {
  const tacticsLevel = skillLevels.tactics ?? 0;
  const reductionPct = tacticsLevel * (SKILLS.tactics.bonusPerLevel['adventureSpeedBonus'] ?? 0);
  const reduction = Math.min(reductionPct, 50); // cap at 50% reduction
  return Math.floor(baseSeconds * (1 - reduction / 100));
}
