import { TroopMap } from '../types/game';
import { UNITS, UnitId, UnitCategory, UnitLabel } from '../constants/units';
import { SkillLevels } from '../types/game';
import { SKILLS } from '../constants/skills';
import { ResourceMap } from '../constants/resources';

// ─── Category counter table ───────────────────────────────────────────────────

/**
 * Which category defeats which.
 * Key = attacker category, value = the category it is strong against.
 *
 *   infantry → cavalry   (spears / pikes halt charges)
 *   cavalry  → ranged    (horse can close distance before archers volley)
 *   ranged   → infantry  (volleys punish slow-moving foot)
 *   siege    → (no category counter — specialised vs fortifications)
 */
export const CATEGORY_COUNTERS: Partial<Record<UnitCategory, UnitCategory>> = {
  infantry: 'cavalry',
  cavalry:  'ranged',
  ranged:   'infantry',
};

/** Multiplier applied to a unit's effective attack when its category counters the defender category. */
export const CATEGORY_COUNTER_BONUS = 1.5;

// ─── Label counter table ──────────────────────────────────────────────────────

/**
 * Which attack labels counter which armour/vulnerability labels.
 *
 *   slashing   → light_armored   (swords & axes shred unprotected flesh)
 *   crushing   → heavy_armored   (warhammers & maces dent and crack plate)
 *   broadhead  → light_armored   (wide-tip arrows punish unarmoured troops)
 *   piercing   → heavy_armored   (bodkin bolts punch through mail and plate)
 *   anti_cavalry → mounted       (pikes and halberds unseat riders)
 */
export const LABEL_COUNTERS: Partial<Record<UnitLabel, UnitLabel>> = {
  slashing:     'light_armored',
  crushing:     'heavy_armored',
  broadhead:    'light_armored',
  piercing:     'heavy_armored',
  anti_cavalry: 'mounted',
};

/** Multiplier applied to a unit's effective attack when one of its labels counters a label on the target unit. */
export const LABEL_COUNTER_BONUS = 1.3;

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

// ─── Matchup helpers ──────────────────────────────────────────────────────────

/**
 * Determine the category of the most common unit in a TroopMap (by unit count).
 * Returns undefined if the map is empty.
 */
export function dominantCategory(troops: TroopMap): UnitCategory | undefined {
  const tally: Partial<Record<UnitCategory, number>> = {};
  for (const [unitId, count] of Object.entries(troops) as [UnitId, number][]) {
    const def = UNITS[unitId];
    if (!def || !count) continue;
    tally[def.category] = (tally[def.category] ?? 0) + count;
  }
  let best: UnitCategory | undefined;
  let bestCount = 0;
  for (const [cat, n] of Object.entries(tally) as [UnitCategory, number][]) {
    if (n > bestCount) { best = cat; bestCount = n; }
  }
  return best;
}

/**
 * Fraction of a troop composition (by unit count) that carries a given label.
 */
export function labelFraction(troops: TroopMap, label: UnitLabel): number {
  let total = 0;
  let matching = 0;
  for (const [unitId, count] of Object.entries(troops) as [UnitId, number][]) {
    const def = UNITS[unitId];
    if (!def || !count) continue;
    total    += count;
    if (def.labels.includes(label)) matching += count;
  }
  return total > 0 ? matching / total : 0;
}

/**
 * Compute the effective attack multiplier for a single attacking unit definition
 * against a given defender composition.
 *
 * Two sources of bonus:
 *   1. Category counter — full CATEGORY_COUNTER_BONUS if attacker's category
 *      counters the defender's dominant category.
 *   2. Label counters   — for each attack label the attacker carries, scale
 *      LABEL_COUNTER_BONUS by the fraction of the defender army that is
 *      vulnerable to that label.
 *
 * Bonus sources are **additive** before being converted to a final multiplier:
 *   multiplier = 1 + Σ(bonuses collected above - 1)
 * i.e., if category gives +50% and a label gives +30% over 100% of defenders,
 * the final multiplier is 1 + 0.5 + 0.3 = 1.8.
 */
export function computeUnitMatchupMultiplier(
  attackerUnitId: UnitId,
  defenderTroops: TroopMap,
): number {
  const aDef = UNITS[attackerUnitId];
  if (!aDef) return 1;

  let bonusSum = 0;

  // 1. Category counter
  const defCat = dominantCategory(defenderTroops);
  if (defCat && CATEGORY_COUNTERS[aDef.category] === defCat) {
    bonusSum += CATEGORY_COUNTER_BONUS - 1;
  }

  // 2. Label counters
  for (const label of aDef.labels) {
    const countered = LABEL_COUNTERS[label];
    if (!countered) continue;
    const frac = labelFraction(defenderTroops, countered);
    if (frac > 0) {
      bonusSum += (LABEL_COUNTER_BONUS - 1) * frac;
    }
  }

  return 1 + bonusSum;
}

/**
 * Compute total **effective** attack for a troop composition against a specific
 * defender army, factoring in all category and label matchup bonuses.
 */
export function computeEffectiveAttack(
  attackerTroops: TroopMap,
  defenderTroops: TroopMap,
): number {
  let total = 0;
  for (const [unitId, count] of Object.entries(attackerTroops) as [UnitId, number][]) {
    const def = UNITS[unitId];
    if (!def || !count) continue;
    const multiplier = computeUnitMatchupMultiplier(unitId, defenderTroops);
    total += def.stats.attack * count * multiplier;
  }
  return total;
}

// ─── Hero combat bonus ────────────────────────────────────────────────────────

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

// ─── Casualty calculation ─────────────────────────────────────────────────────

export interface BattleResult {
  attackerWon:       boolean;
  attackerCasualties: TroopMap;
  defenderCasualties: TroopMap;
  resourcesPlundered: Record<string, number>;
  effectiveAttack:   number;
  effectiveDefense:  number;
  wallBonusValue:    number;
}

/**
 * Simulate a single-wave battle between attacker and defender troop compositions.
 *
 * Uses category and label matchup bonuses on both sides.
 * Defender receives a flat advantage equal to `defenderWallBonus`% on top of
 * their base defense score.
 */
export function simulateBattle(
  attackerTroops: TroopMap,
  defenderTroops: TroopMap,
  defenderWallBonus: number = 0,
): BattleResult {
  const effectiveAttack  = computeEffectiveAttack(attackerTroops, defenderTroops);
  const effectiveDefense = computeEffectiveAttack(defenderTroops, attackerTroops);

  const { totalDefense: rawDefense } = computeTroopTotals(defenderTroops);
  const wallBonus = rawDefense * (defenderWallBonus / 100);

  // Attacker wins if their matchup-adjusted attack exceeds matchup-adjusted
  // defense plus any fortification bonus (defender advantage).
  const defenderScore = effectiveDefense + wallBonus;
  const attackerWon   = effectiveAttack > defenderScore;

  const attackerLossRatio = attackerWon
    ? Math.min(0.9, defenderScore / effectiveAttack * 0.8)
    : 0.95;
  const defenderLossRatio = attackerWon
    ? 0.9
    : Math.min(0.5, effectiveAttack / defenderScore * 0.6);

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
    effectiveAttack,
    effectiveDefense: defenderScore,
    wallBonusValue:   wallBonus,
  };
}

// ─── Wave battle ──────────────────────────────────────────────────────────────

/**
 * Outcome of a single attacker wave against the defender.
 */
export interface WaveOutcome {
  waveIndex:           number;
  attackerWon:         boolean;
  attackerCasualties:  TroopMap;
  defenderCasualties:  TroopMap;
  /** Troops the attacker committed to this wave. */
  attackerTroops:      TroopMap;
  /** Defender troops remaining at the *start* of this wave (before casualties). */
  defenderTroops:      TroopMap;
  /** Attacker's matchup-adjusted effective attack score. */
  effectiveAttack:     number;
  /** Defender's matchup-adjusted effective defense score including wall bonus. */
  effectiveDefense:    number;
  /** Absolute wall-bonus contribution included in effectiveDefense. */
  wallBonusValue:      number;
}

/**
 * Full result of a 3-wave attack resolved by simulateWaveBattle.
 */
export interface FullBattleReport {
  attackerWon:               boolean;
  wavesWon:                  number;
  waveOutcomes:              WaveOutcome[];
  totalAttackerCasualties:   TroopMap;
  totalDefenderCasualties:   TroopMap;
  survivingAttackerTroops:   TroopMap;
  resourcesPlundered:        Partial<ResourceMap>;
  /** Filled in by the resolver, not by this formula. */
  defenderCityName?:         string;
  attackerCityName?:         string;
}

/**
 * Compute march travel time in seconds.
 *
 * The march speed is limited by the slowest unit in any of the waves.
 * A minimum of 60 seconds is always enforced.
 *
 * @param fromX / fromY  - Origin tile coordinates
 * @param toX   / toY    - Destination tile coordinates
 * @param waves          - Three wave TroopMap arrays
 */
export function computeMarchTimeSeconds(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  waves: TroopMap[],
): number {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  let slowestSpeed = Infinity;
  for (const wave of waves) {
    for (const [unitId, count] of Object.entries(wave) as [UnitId, number][]) {
      if (!count) continue;
      const def = UNITS[unitId];
      if (def && def.stats.speed < slowestSpeed) slowestSpeed = def.stats.speed;
    }
  }
  if (!isFinite(slowestSpeed) || slowestSpeed <= 0) slowestSpeed = 6;
  return Math.max(60, Math.ceil((distance / slowestSpeed) * 3600));
}

/**
 * Resolve a 3-wave sequential battle.
 *
 * Each wave fights the defender's *remaining* troops after previous waves'
 * casualties have been removed.  The attacker wins the battle overall if
 * at least 2 of the 3 waves win their individual engagement.
 *
 * `defenderWallBonus` is a % bonus added to the raw defender score,
 * representing fortification advantage (default 10%, upgradeable via
 * the Ramparts building).
 */
export function simulateWaveBattle(
  waves: TroopMap[],
  defenderTroops: TroopMap,
  defenderWallBonus: number = 10,
): FullBattleReport {
  const remainingDefenders: TroopMap = { ...defenderTroops };
  const waveOutcomes: WaveOutcome[] = [];
  let wavesWon = 0;

  for (let i = 0; i < waves.length; i++) {
    const wave             = waves[i];
    const defenderSnapshot = { ...remainingDefenders }; // capture state before this wave's casualties
    const result           = simulateBattle(wave, remainingDefenders, defenderWallBonus);

    // Apply defender casualties (carry over to next wave)
    for (const [uid, cas] of Object.entries(result.defenderCasualties) as [UnitId, number][]) {
      remainingDefenders[uid] = Math.max(0, (remainingDefenders[uid] ?? 0) - (cas ?? 0));
    }

    waveOutcomes.push({
      waveIndex:          i,
      attackerWon:        result.attackerWon,
      attackerCasualties: result.attackerCasualties,
      defenderCasualties: result.defenderCasualties,
      attackerTroops:     { ...wave },
      defenderTroops:     defenderSnapshot,
      effectiveAttack:    result.effectiveAttack,
      effectiveDefense:   result.effectiveDefense,
      wallBonusValue:     result.wallBonusValue,
    });

    if (result.attackerWon) wavesWon++;
  }

  // Aggregate attacker casualties and survivors
  const totalAttackerCasualties: TroopMap = {};
  const survivingAttackerTroops: TroopMap = {};

  for (let i = 0; i < waves.length; i++) {
    const wave   = waves[i];
    const casMap = waveOutcomes[i].attackerCasualties;
    for (const [uid, count] of Object.entries(wave) as [UnitId, number][]) {
      const dead = casMap[uid] ?? 0;
      totalAttackerCasualties[uid] = (totalAttackerCasualties[uid] ?? 0) + dead;
      survivingAttackerTroops[uid] = (survivingAttackerTroops[uid] ?? 0) + (count - dead);
    }
  }

  // Aggregate defender casualties across all waves
  const totalDefenderCasualties: TroopMap = {};
  for (const outcome of waveOutcomes) {
    for (const [uid, count] of Object.entries(outcome.defenderCasualties) as [UnitId, number][]) {
      totalDefenderCasualties[uid] = (totalDefenderCasualties[uid] ?? 0) + (count ?? 0);
    }
  }

  return {
    attackerWon: wavesWon >= 2,
    wavesWon,
    waveOutcomes,
    totalAttackerCasualties,
    totalDefenderCasualties,
    survivingAttackerTroops,
    resourcesPlundered: {},
  };
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
 * With full iron_plate (def+18) + iron_sword (atk+18), skill combat 5:
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
