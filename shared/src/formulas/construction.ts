import { BUILDINGS, BuildingId } from '../constants/buildings';
import { CivId } from '../constants/civilizations';
import { CIVILIZATIONS } from '../constants/civilizations';

// ─── Construction time ────────────────────────────────────────────────────────

/**
 * Actual construction time (seconds) for upgrading a building to `targetLevel`,
 * accounting for civilization speed bonuses.
 */
export function computeConstructionTime(
  buildingId: BuildingId,
  targetLevel: number,
  civId: CivId = 'default'
): number {
  const def = BUILDINGS[buildingId];
  if (!def) throw new Error(`Unknown building: ${buildingId}`);

  const levelDef = def.levels[targetLevel - 1];
  if (!levelDef) throw new Error(`Building ${buildingId} has no level ${targetLevel}`);

  const civ = CIVILIZATIONS[civId];
  const speedBonus = civ?.bonuses?.buildingSpeedBonus ?? 0; // fraction e.g. 0.1 = 10% faster
  const reduction = Math.min(speedBonus, 0.5); // cap at 50%

  return Math.max(1, Math.floor(levelDef.constructionTime * (1 - reduction)));
}

/**
 * Whether a city's current buildings satisfy the prerequisite for building X at level Y.
 */
export function meetsPrerequisite(
  buildingId: BuildingId,
  existingBuildingLevels: Partial<Record<BuildingId, number>>
): boolean {
  const def = BUILDINGS[buildingId];
  if (!def?.prerequisite) return true;

  const { buildingId: reqId, minLevel } = def.prerequisite;
  return (existingBuildingLevels[reqId] ?? 0) >= minLevel;
}

// ─── Resource sufficiency ─────────────────────────────────────────────────────

import { ResourceMap } from '../constants/resources';

/**
 * Returns true if `available` has enough of every resource in `cost`.
 */
export function canAfford(available: ResourceMap, cost: ResourceMap): boolean {
  return (Object.keys(cost) as (keyof ResourceMap)[]).every(
    (key) => (available[key] ?? 0) >= cost[key]
  );
}

/**
 * Subtract `cost` from `available`. Does NOT check affordability.
 * Values are floored at 0 to prevent negative balances.
 */
export function subtractResources(available: ResourceMap, cost: ResourceMap): ResourceMap {
  const result = { ...available };
  (Object.keys(cost) as (keyof ResourceMap)[]).forEach((key) => {
    result[key] = Math.max(0, (result[key] ?? 0) - cost[key]);
  });
  return result;
}

/**
 * Add `income` to `current`, capped by `cap`.
 */
export function addResourcesWithCap(
  current: ResourceMap,
  income: ResourceMap,
  cap: ResourceMap
): ResourceMap {
  const result = { ...current };
  (Object.keys(income) as (keyof ResourceMap)[]).forEach((key) => {
    result[key] = Math.min((result[key] ?? 0) + income[key], cap[key] ?? Infinity);
  });
  return result;
}
