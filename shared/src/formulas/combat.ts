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

// ─── Hero adventure damage ────────────────────────────────────────────────────

/**
 * Mitigation factor applied to raw adventure damage.
 *
 * Formula: factor = 100 / (100 + defense + attack * ATTACK_MITIGATION_RATIO)
 *
 * Defence is the primary damage-reduction stat. Attack also contributes, but
 * at a lower weight (ATTACK_MITIGATION_RATIO = 0.3) — representing the hero's
 * ability to reduce incoming hits through combat awareness and aggression.
 *
 * Examples with attack=10 (base), defense=5 (base):
 *   → effective = 5 + 10*0.3 = 8  →  100/108 ≈ 92.6% damage taken
 * With full reactive_plate (def+15) + pulse_rifle (atk+12), skill combat 5:
 *   attack ≈ 10+12+5*5=47, defense ≈ 5+15=20
 *   → effective = 20 + 47*0.3 = 34.1  →  100/134 ≈ 74.6% damage taken
 */
export const ATTACK_MITIGATION_RATIO = 0.3;

export function adventureMitigationFactor(defense: number, attack: number): number {
  const effective = Math.max(0, defense) + Math.max(0, attack) * ATTACK_MITIGATION_RATIO;
  return 100 / (100 + effective);
}

/** @deprecated Use adventureMitigationFactor instead */
export function defenseMitigationFactor(defense: number): number {
  return adventureMitigationFactor(defense, 0);
}

/**
 * Calculate the actual HP damage taken from a single adventure encounter.
 *
 * @param rawDamage - Random roll in the activity's baseDamageRange.
 * @param defense   - Hero's effective defence (base 5 + item bonuses).
 * @param attack    - Hero's effective attack (base 10 + skill + item bonuses).
 * @returns Integer HP lost (≥ 0).
 */
export function computeAdventureDamage(rawDamage: number, defense: number, attack: number = 0): number {
  return Math.floor(rawDamage * adventureMitigationFactor(defense, attack));
}

/**
 * Determine the personalised [minDamage, maxDamage] a hero will take from an
 * activity given their current defence and attack stats. Safe to call on the
 * client with stats derived from skills + equipped items.
 *
 * @param baseDamageRange - The activity's raw [min, max] threat range.
 * @param defense         - Hero's effective defence.
 * @param attack          - Hero's effective attack.
 * @returns [minDamage, maxDamage] after mitigation (both ≥ 0).
 */
export function computeDamageRange(
  baseDamageRange: [number, number],
  defense: number,
  attack: number = 0,
): [number, number] {
  const factor = adventureMitigationFactor(defense, attack);
  return [
    Math.floor(baseDamageRange[0] * factor),
    Math.floor(baseDamageRange[1] * factor),
  ];
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
