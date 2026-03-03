import { TroopMap } from '../types/game';
import { UNITS, UnitId } from '../constants/units';
import { SkillLevels } from '../types/game';
import { SKILLS } from '../constants/skills';

// ─── Attack / defense totals ──────────────────────────────────────────────────

export interface CombatTotals {
  totalAttack: number;
  totalDefense: number;
}

/**
 * Sum raw attack and defense values for a troop composition.
 */
export function computeTroopTotals(troops: TroopMap): CombatTotals {
  let totalAttack  = 0;
  let totalDefense = 0;

  for (const [unitId, count] of Object.entries(troops) as [UnitId, number][]) {
    const def = UNITS[unitId];
    if (!def || !count) continue;
    totalAttack  += def.stats.attack  * count;
    totalDefense += def.stats.defense * count;
  }

  return { totalAttack, totalDefense };
}

/**
 * Apply hero combat skill bonus to attack value.
 */
export function applyHeroCombatBonus(
  baseAttack: number,
  skillLevels: SkillLevels
): number {
  const combatLevel = skillLevels.combat ?? 0;
  const bonus = combatLevel * (SKILLS.combat.bonusPerLevel['attackBonus'] ?? 0);
  return baseAttack + bonus;
}

// ─── Casualty calculation (simplified) ───────────────────────────────────────
// Formula: casualties = max(0, floor(attackerStrength / defenderStrength * defenderCount * 0.1))
// This is intentionally simple for MVP; can be replaced with a proper battle sim later.

export interface BattleResult {
  attackerWon: boolean;
  attackerCasualties: TroopMap;
  defenderCasualties: TroopMap;
  resourcesPlundered: Record<string, number>;
}

export function simulateBattle(
  attackerTroops: TroopMap,
  defenderTroops: TroopMap,
  defenderWallBonus: number = 0  // % bonus from city wall level
): BattleResult {
  const attacker = computeTroopTotals(attackerTroops);
  const defender = computeTroopTotals(defenderTroops);

  const defenseWithWall = defender.totalDefense * (1 + defenderWallBonus / 100);
  const attackerWon     = attacker.totalAttack > defenseWithWall;

  const attackerLossRatio  = attackerWon
    ? Math.min(0.9, defenseWithWall / attacker.totalAttack * 0.8)
    : 0.95;
  const defenderLossRatio  = attackerWon ? 0.9 : Math.min(0.5, attacker.totalAttack / defenseWithWall * 0.6);

  const attackerCasualties: TroopMap = {};
  for (const [unitId, count] of Object.entries(attackerTroops) as [UnitId, number][]) {
    attackerCasualties[unitId] = Math.floor((count ?? 0) * attackerLossRatio);
  }

  const defenderCasualties: TroopMap = {};
  for (const [unitId, count] of Object.entries(defenderTroops) as [UnitId, number][]) {
    defenderCasualties[unitId] = Math.floor((count ?? 0) * defenderLossRatio);
  }

  return {
    attackerWon,
    attackerCasualties,
    defenderCasualties,
    resourcesPlundered: {}, // populated by server using carry capacity of surviving troops
  };
}
