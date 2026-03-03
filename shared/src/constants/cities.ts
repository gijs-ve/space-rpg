import { ResourceMap } from './resources';

/**
 * The maximum number of starbases a player may own.
 */
export const MAX_BASES = 10;
/** @deprecated Use MAX_BASES */
export const MAX_CITIES = MAX_BASES;

/**
 * Base founding cost for the **second** starbase (existingBaseCount === 1).
 * The first base is always free (given automatically on registration).
 */
export const BASE_FOUNDING_BASE_COST: ResourceMap = {
  rations:  1_000,
  water:    1_500,
  ore:      1_000,
  alloys:     500,
  fuel:       300,
  iridium:    100,
};

/**
 * Each additional base beyond the second costs this much *more* than the
 * previous tier (multiplicative scale per extra base).
 *
 * Formula: cost[n] = base * SCALE ^ (n - 1)   where n = existingBaseCount
 */
export const BASE_FOUNDING_COST_SCALE = 2;

/**
 * Returns the ResourceMap cost to found a new starbase given how many bases
 * the player currently owns.
 *
 * - `existingBaseCount === 0` → **free** (first base; normally created on registration)
 * - `existingBaseCount >= 1`  → `BASE_FOUNDING_BASE_COST × SCALE^(n-1)`
 */
export function getBaseFoundingCost(existingBaseCount: number): ResourceMap {
  if (existingBaseCount <= 0) {
    return { rations: 0, water: 0, ore: 0, alloys: 0, fuel: 0, iridium: 0 };
  }

  const multiplier = Math.pow(BASE_FOUNDING_COST_SCALE, existingBaseCount - 1);

  return {
    rations:  Math.floor(BASE_FOUNDING_BASE_COST.rations  * multiplier),
    water:    Math.floor(BASE_FOUNDING_BASE_COST.water    * multiplier),
    ore:      Math.floor(BASE_FOUNDING_BASE_COST.ore      * multiplier),
    alloys:   Math.floor(BASE_FOUNDING_BASE_COST.alloys   * multiplier),
    fuel:     Math.floor(BASE_FOUNDING_BASE_COST.fuel     * multiplier),
    iridium:  Math.floor(BASE_FOUNDING_BASE_COST.iridium  * multiplier),
  };
}

/** @deprecated Use getBaseFoundingCost */
export const getCityFoundingCost = getBaseFoundingCost;
