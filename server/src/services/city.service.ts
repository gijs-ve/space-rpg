import { prisma } from '../db/client';
import {
  ResourceMap,
  ResourceType,
  RESOURCE_TYPES,
  CityBuilding,
  BuildingId,
  BUILDINGS,
  BuildingEffect,
  addResourcesWithCap,
} from '@rpg/shared';

// ─── Production rate helpers ──────────────────────────────────────────────────

const EFFECT_TO_RESOURCE: Record<keyof BuildingEffect, ResourceType | null> = {
  rationsProduction:  'rations',
  waterProduction:    'water',
  oreProduction:      'ore',
  alloysProduction:   'alloys',
  fuelProduction:     'fuel',
  iridiumProduction:  'iridium',
  storageCapBonus:       null,
  storageExpansionBonus: null,
  defenseBonus:          null,
  tradeCapacity:         null,
  armoryGridCols:        null,
  armoryGridRows:        null,
  trainingSpeedBonus:    null,
};

/**
 * Sum hourly production rates from all buildings in a city.
 */
export function computeProductionRates(buildings: CityBuilding[]): ResourceMap {
  const rates: ResourceMap = { rations: 0, water: 0, ore: 0, alloys: 0, fuel: 0, iridium: 0 };

  for (const slot of buildings) {
    const def = BUILDINGS[slot.buildingId];
    if (!def) continue;
    const levelDef = def.levels[slot.level - 1];
    if (!levelDef) continue;

    for (const [effectKey, production] of Object.entries(levelDef.effect)) {
      const resource = EFFECT_TO_RESOURCE[effectKey as keyof BuildingEffect];
      if (resource && typeof production === 'number') {
        rates[resource] += production;
      }
    }
  }

  return rates;
}

/**
 * Sum storage cap bonuses from all buildings.
 */
export function computeStorageCap(buildings: CityBuilding[], baseCapPerResource = 1000): ResourceMap {
  let bonus = 0;
  for (const slot of buildings) {
    const def = BUILDINGS[slot.buildingId];
    if (!def) continue;
    const levelDef = def.levels[slot.level - 1];
    if (!levelDef) continue;
    bonus += levelDef.effect.storageCapBonus ?? 0;
  }
  const cap = baseCapPerResource + bonus;
  return Object.fromEntries(RESOURCE_TYPES.map((r) => [r, cap])) as ResourceMap;
}

// ─── Resource tick ────────────────────────────────────────────────────────────

/**
 * Apply one resource tick to the city (called every 60 seconds).
 * Adds (productionRate / 3600 * tickSeconds) resources, capped by storageCap.
 */
export async function applyResourceTick(cityId: string, tickSeconds = 60) {
  const city = await prisma.city.findUniqueOrThrow({ where: { id: cityId } });

  const buildings   = city.buildings   as unknown as CityBuilding[];
  const resources   = city.resources   as unknown as ResourceMap;
  const storageCap  = city.storageCap  as unknown as ResourceMap;

  const rates = computeProductionRates(buildings);

  // income per tick
  const income: ResourceMap = Object.fromEntries(
    RESOURCE_TYPES.map((r) => [r, (rates[r] / 3600) * tickSeconds])
  ) as ResourceMap;

  const newResources = addResourcesWithCap(resources, income, storageCap);

  return prisma.city.update({
    where: { id: cityId },
    data: { resources: newResources },
  });
}

// ─── Get all cities for a player ─────────────────────────────────────────────

export async function getCitiesForPlayer(playerId: string) {
  return prisma.city.findMany({ where: { playerId } });
}

export async function getCityOrThrow(cityId: string, playerId: string) {
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) throw Object.assign(new Error('Base not found'), { status: 404 });
  if (city.playerId !== playerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
  return city;
}
