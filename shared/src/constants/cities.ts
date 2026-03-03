import { ResourceMap } from './resources';

/**
 * The maximum number of cities a player may own.
 */
export const MAX_CITIES = 10;

/**
 * Base founding cost for the **second** city (existingCityCount === 1).
 * The first city is always free (given automatically on registration).
 */
export const CITY_FOUNDING_BASE_COST: ResourceMap = {
  food:  1_000,
  wood:  1_500,
  stone: 1_000,
  iron:    500,
  gold:    800,
};

/**
 * Each additional city beyond the second costs this much *more* than the
 * previous tier (additive multiplier applied per extra city).
 *
 * Formula: cost[n] = base * SCALE ^ (n - 1)   where n = existingCityCount
 *
 * Examples (rounded):
 *   1 existing city  → ×1.0  → base cost
 *   2 existing cities → ×2.0  → 2× base
 *   3 existing cities → ×4.0  → 4× base
 *   4 existing cities → ×8.0  → 8× base
 */
export const CITY_FOUNDING_COST_SCALE = 2;

/**
 * Returns the ResourceMap cost to found a new city given how many cities the
 * player currently owns.
 *
 * - `existingCityCount === 0` → **free** (first city; normally created on
 *   registration, but kept consistent here)
 * - `existingCityCount >= 1`  → `CITY_FOUNDING_BASE_COST × SCALE^(n-1)`
 *
 * All values are floored to whole numbers.
 */
export function getCityFoundingCost(existingCityCount: number): ResourceMap {
  if (existingCityCount <= 0) {
    return { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 };
  }

  const multiplier = Math.pow(CITY_FOUNDING_COST_SCALE, existingCityCount - 1);

  return {
    food:  Math.floor(CITY_FOUNDING_BASE_COST.food  * multiplier),
    wood:  Math.floor(CITY_FOUNDING_BASE_COST.wood  * multiplier),
    stone: Math.floor(CITY_FOUNDING_BASE_COST.stone * multiplier),
    iron:  Math.floor(CITY_FOUNDING_BASE_COST.iron  * multiplier),
    gold:  Math.floor(CITY_FOUNDING_BASE_COST.gold  * multiplier),
  };
}
