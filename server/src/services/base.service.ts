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
  ItemBonus,
  sumItemBonuses,
  BASE_ITEM_LOCATIONS,
} from '@rpg/shared';
import { ItemLocation } from '@prisma/client';

/**
 * Load and sum item bonuses from all items stored in the base armory/building equip slots.
 * These bonuses affect production rates, storage cap, construction time, and training time.
 */
export async function getBaseItemBonuses(cityId: string): Promise<Required<ItemBonus>> {
  const items = await prisma.itemInstance.findMany({
    where: {
      cityId,
      location: { in: [ItemLocation.base_armory, ItemLocation.base_building_equip] },
    },
    select: { itemDefId: true, location: true },
  });
  return sumItemBonuses(items, BASE_ITEM_LOCATIONS);
}

// ─── Production rate helpers ──────────────────────────────────────────────────

const EFFECT_TO_RESOURCE: Record<keyof BuildingEffect, ResourceType | null> = {
  rationsProduction:     'rations',
  waterProduction:       'water',
  oreProduction:         'ore',
  ironProduction:      'iron',
  woodProduction:        'wood',
  goldProduction:     'gold',
  storageCapBonus:       null,
  storageExpansionBonus: null,
  defenseBonus:          null,
  tradeCapacity:         null,
  armoryGridCols:        null,
  armoryGridRows:        null,
  trainingSpeedBonus:    null,
};

/**
 * Sum hourly production rates from all buildings, optionally boosted by armory item bonuses.
 *
 * @param itemBonuses - Summed bonuses from base armory items (getBaseItemBonuses).
 *                      When provided, productionBonus (%) is applied to all rates.
 */
export function computeProductionRates(
  buildings: CityBuilding[],
  itemBonuses: ItemBonus = {}
): ResourceMap {
  const rates: ResourceMap = { rations: 0, water: 0, ore: 0, iron: 0, wood: 0, gold: 0 };

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

  // Apply production boost from armory items (% multiplier, capped at 50%).
  const productionBoostPct = Math.min(itemBonuses.productionBonus ?? 0, 50);
  if (productionBoostPct > 0) {
    const multiplier = 1 + productionBoostPct / 100;
    for (const r of RESOURCE_TYPES) {
      rates[r] = Math.floor(rates[r] * multiplier);
    }
  }

  return rates;
}

/**
 * Sum storage cap bonuses from all buildings, handling per-resource storage_expansion buildings.
 */
export function computeStorageCap(buildings: CityBuilding[], baseCapPerResource = 1000): ResourceMap {
  // Start with per-resource caps
  const caps = Object.fromEntries(RESOURCE_TYPES.map((r) => [r, baseCapPerResource])) as ResourceMap;

  for (const slot of buildings) {
    const def = BUILDINGS[slot.buildingId];
    if (!def) continue;
    const levelDef = def.levels[slot.level - 1];
    if (!levelDef) continue;

    // Flat bonus applied to every resource
    if (levelDef.effect.storageCapBonus) {
      for (const r of RESOURCE_TYPES) {
        caps[r] += levelDef.effect.storageCapBonus;
      }
    }

    // Per-resource bonus (storage_expansion): only applies to selectedResources in building meta
    if (levelDef.effect.storageExpansionBonus) {
      const selected = ((slot.meta as Record<string, unknown> | undefined)?.selectedResources as string[] | undefined) ?? [];
      for (const r of selected) {
        if (RESOURCE_TYPES.includes(r as ResourceType)) {
          caps[r as ResourceType] += levelDef.effect.storageExpansionBonus;
        }
      }
    }
  }

  return caps;
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

  // Load armory item bonuses for this tick.
  const itemBonuses = await getBaseItemBonuses(cityId);
  const rates = computeProductionRates(buildings, itemBonuses);

  // Compute effective storage cap, boosted by item storageBonus (capped at +50%).
  const storageBoostPct = Math.min(itemBonuses.storageBonus ?? 0, 50);
  const effectiveCap = storageBoostPct > 0
    ? Object.fromEntries(
        RESOURCE_TYPES.map((r) => [r, Math.floor(storageCap[r] * (1 + storageBoostPct / 100))])
      ) as ResourceMap
    : storageCap;

  // income per tick
  const income: ResourceMap = Object.fromEntries(
    RESOURCE_TYPES.map((r) => [r, (rates[r] / 3600) * tickSeconds])
  ) as ResourceMap;

  const newResources = addResourcesWithCap(resources, income, effectiveCap);

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
