import { ITEMS, ItemBonus, ItemId } from '../constants/items';

/**
 * Hero item locations — used for DB queries to fetch all potentially-active hero items.
 * Bonus eligibility is determined per-item by sumHeroItemBonuses below.
 */
export const HERO_ITEM_LOCATIONS = ['hero_inventory', 'hero_equipped'] as const;

/**
 * Base item locations — bonuses from items here apply to the base.
 */
export const BASE_ITEM_LOCATIONS = ['base_armory', 'base_building_equip'] as const;

/**
 * Aggregate ItemBonus values from a list of item instances.
 *
 * Optionally pass `locations` to only count items whose `location` is in that
 * list (e.g. pass HERO_ITEM_LOCATIONS to get only hero-active bonuses).
 * If `locations` is omitted every item in the list is included.
 *
 * This is the single source of truth for bonus aggregation — all server paths
 * (hero service, base service, routes) should call this function rather than
 * summing bonuses manually.
 *
 * To add a new bonus type in the future:
 *  1. Add the field to ItemBonus in constants/items.ts.
 *  2. Add it to the `zero` object below.
 *  3. Implement its effect in the relevant server service / route.
 */
export function sumItemBonuses(
  items: { itemDefId: string; location: string }[],
  locations?: readonly string[]
): Required<ItemBonus> {
  const filtered = locations
    ? items.filter((i) => (locations as readonly string[]).includes(i.location))
    : items;

  // Start from zero for every known bonus key so callers can always do
  //   bonuses.someBonus ?? 0  without worrying about undefined.
  const result: Required<ItemBonus> = {
    attackBonus:           0,
    defenseBonus:          0,
    maxEnergyBonus:        0,
    maxHealthBonus:        0,
    gatheringBonus:        0,
    adventureSpeedBonus:   0,
    productionBonus:       0,
    storageBonus:          0,
    constructionSpeedBonus: 0,
    trainingSpeedBonus:    0,
  };

  for (const item of filtered) {
    const def = ITEMS[item.itemDefId as ItemId];
    if (!def) continue;
    for (const [key, value] of Object.entries(def.bonuses)) {
      if (typeof value === 'number' && key in result) {
        (result as Record<string, number>)[key] += value;
      }
    }
  }

  return result;
}

/**
 * Aggregate hero item bonuses.
 *
 * All items — including pocket-slot pasive items — are only active when they
 * are in `hero_equipped`.  Items sitting in the hero's inventory (not slotted)
 * do NOT provide any bonus.
 *
 * Use this for all hero stat calculations.
 */
export function sumHeroItemBonuses(
  items: { itemDefId: string; location: string }[],
): Required<ItemBonus> {
  const equipped = items.filter((i) => i.location === 'hero_equipped');
  return sumItemBonuses(equipped);
}
