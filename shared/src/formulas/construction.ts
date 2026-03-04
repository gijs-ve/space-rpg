import { BUILDINGS, BuildingId } from '../constants/buildings';
import { CivId } from '../constants/civilizations';
import { CIVILIZATIONS } from '../constants/civilizations';
import { ResourceMap, EMPTY_RESOURCES } from '../constants/resources';
import { UNITS, UnitId } from '../constants/units';

// ─── Construction time ────────────────────────────────────────────────────────

/**
 * Actual construction time (seconds) for upgrading a building to `targetLevel`,
 * accounting for civilization speed bonuses.
 */
export function computeConstructionTime(
  buildingId: BuildingId,
  targetLevel: number,
  civId: CivId = 'terran'
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

/**
 * Total resource cost spent to bring a building from level 0 → currentLevel.
 * Used for refund calculations.
 */
export function computeTotalBuildingCost(buildingId: BuildingId, currentLevel: number): ResourceMap {
  const def = BUILDINGS[buildingId];
  if (!def) return { ...EMPTY_RESOURCES };
  const total: Record<string, number> = { ...EMPTY_RESOURCES };
  for (let i = 0; i < currentLevel; i++) {
    const ld = def.levels[i];
    if (!ld) break;
    for (const [r, v] of Object.entries(ld.cost)) {
      total[r] = (total[r] ?? 0) + (v as number);
    }
  }
  return total as ResourceMap;
}

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

// ─── Training time ────────────────────────────────────────────────────────────

/**
 * Effective training time (seconds) for a single unit, accounting for:
 *  - building level speed bonus (per `trainingSpeedBonus` in BuildingEffect)
 *  - armory item training speed bonus (%)
 *
 * Both bonuses are summed and capped at 50%.
 */
export function computeTrainingTime(
  unitId: UnitId,
  buildingLevel: number,
  itemTrainingBoostPct: number = 0
): number {
  const unitDef = UNITS[unitId];
  if (!unitDef) throw new Error(`Unknown unit: ${unitId}`);

  const buildingDef = BUILDINGS[unitDef.trainingBuilding];
  const levelDef    = buildingDef?.levels[buildingLevel - 1];
  const buildingSpeedBonus = levelDef?.effect?.trainingSpeedBonus ?? 0;

  const totalBoostPct = Math.min(50, buildingSpeedBonus + itemTrainingBoostPct);
  return Math.max(1, Math.floor(unitDef.trainingTime * (1 - totalBoostPct / 100)));
}
