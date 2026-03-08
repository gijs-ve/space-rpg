import { ResourceMap } from './resources';

/**
 * The maximum number of settlements a player may own.
 */
export const MAX_BASES = 10;
/** @deprecated Use MAX_BASES */
export const MAX_CITIES = MAX_BASES;

/**
 * Base founding cost for the **second** settlement (existingBaseCount === 1).
 * The first settlement is always free (given automatically on registration).
 */
export const BASE_FOUNDING_BASE_COST: ResourceMap = {
  rations:  1_000,
  water:    1_500,
  ore:      1_000,
  iron:     500,
  wood:       300,
  gold:    100,
};

/**
 * Each additional base beyond the second costs this much *more* than the
 * previous tier (multiplicative scale per extra base).
 *
 * Formula: cost[n] = base * SCALE ^ (n - 1)   where n = existingBaseCount
 */
export const BASE_FOUNDING_COST_SCALE = 2;

/**
 * Returns the ResourceMap cost to found a new settlement given how many settlements
 * the player currently owns.
 *
 * - `existingBaseCount === 0` → **free** (first settlement; normally created on registration)
 * - `existingBaseCount >= 1`  → `BASE_FOUNDING_BASE_COST × SCALE^(n-1)`
 */
export function getBaseFoundingCost(existingBaseCount: number): ResourceMap {
  if (existingBaseCount <= 0) {
    return { rations: 0, water: 0, ore: 0, iron: 0, wood: 0, gold: 0 };
  }

  const multiplier = Math.pow(BASE_FOUNDING_COST_SCALE, existingBaseCount - 1);

  return {
    rations:  Math.floor(BASE_FOUNDING_BASE_COST.rations  * multiplier),
    water:    Math.floor(BASE_FOUNDING_BASE_COST.water    * multiplier),
    ore:      Math.floor(BASE_FOUNDING_BASE_COST.ore      * multiplier),
    iron:   Math.floor(BASE_FOUNDING_BASE_COST.iron   * multiplier),
    wood:   Math.floor(BASE_FOUNDING_BASE_COST.wood   * multiplier),
    gold:  Math.floor(BASE_FOUNDING_BASE_COST.gold  * multiplier),
  };
}

/** @deprecated Use getBaseFoundingCost */
export const getCityFoundingCost = getBaseFoundingCost;
