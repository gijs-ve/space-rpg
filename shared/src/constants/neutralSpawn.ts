import { TileType } from './map';
import { UnitId } from './units';
import { TroopMap } from '../types/game';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Per-unit spawn parameters within one variant. */
export interface NeutralUnitSpawnEntry {
  /** Min initial troop count (randomised at seed time). */
  baseMin:  number;
  /** Max initial troop count (randomised at seed time). */
  baseMax:  number;
  /** Min garrison cap (randomised at seed time, stored in DB). */
  capMin:   number;
  /** Max garrison cap (randomised at seed time, stored in DB). */
  capMax:   number;
  /** Troops added per 10-minute spawn tick (fixed, not randomised). */
  perSpawn: number;
}

/**
 * One possible composition for a tile's neutral garrison.
 * Multiple variants per tile type produce variety across the map.
 */
export interface NeutralSpawnVariant {
  /** Human-readable label — useful for debugging and future tooling. */
  label:  string;
  /**
   * Relative selection weight.
   * Higher = more likely to be chosen when seeding this tile type.
   * Common: 3, Uncommon: 2, Rare: 1
   */
  weight: number;
  /** Unit types present in this variant. */
  units:  Partial<Record<UnitId, NeutralUnitSpawnEntry>>;
}

/** All variants available for a given tile type. */
export interface NeutralSpawnDef {
  variants: NeutralSpawnVariant[];
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Inclusive integer random in [min, max]. */
function randInt(min: number, max: number, rand: () => number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** Pick a random variant using weighted selection. */
export function pickRandomVariant(
  def:  NeutralSpawnDef,
  rand: () => number = Math.random,
): NeutralSpawnVariant {
  const totalWeight = def.variants.reduce((sum, v) => sum + v.weight, 0);
  let r = rand() * totalWeight;
  for (const variant of def.variants) {
    r -= variant.weight;
    if (r <= 0) return variant;
  }
  return def.variants[def.variants.length - 1];
}

/** Roll randomised starting troop counts from a variant. */
export function rollGarrisonTroops(
  variant: NeutralSpawnVariant,
  rand:    () => number = Math.random,
): TroopMap {
  const troops: TroopMap = {};
  for (const [uid, entry] of Object.entries(variant.units) as [UnitId, NeutralUnitSpawnEntry][]) {
    if (!entry) continue;
    troops[uid] = randInt(entry.baseMin, entry.baseMax, rand);
  }
  return troops;
}

/** Roll randomised per-tile caps from a variant (persisted in DB so the tick can use them). */
export function rollGarrisonCaps(
  variant: NeutralSpawnVariant,
  rand:    () => number = Math.random,
): TroopMap {
  const caps: TroopMap = {};
  for (const [uid, entry] of Object.entries(variant.units) as [UnitId, NeutralUnitSpawnEntry][]) {
    if (!entry) continue;
    caps[uid] = randInt(entry.capMin, entry.capMax, rand);
  }
  return caps;
}

// ─── Spawn definitions ────────────────────────────────────────────────────────
//
// Design guidelines:
//   • Each tile type has 2-5 variants.
//   • Weight 3 = common, 2 = uncommon, 1 = rare.
//   • capMin is always clearly above baseMax.
//   • perSpawn is fixed per entry — balance it here, not in the DB.
//   • Tile affinity is loose: a forest can rarely have ruins guardians,
//     but they won't appear on plain barren tiles.

export const NEUTRAL_SPAWN_DEFS: Partial<Record<TileType, NeutralSpawnDef>> = {

  // ── Barren ──────────────────────────────────────────────────────────────────
  barren: {
    variants: [
      {
        label:  'Bandit Camp',
        weight: 4,
        units: {
          bandit: { baseMin: 5, baseMax: 15, capMin: 20, capMax: 40, perSpawn: 2 },
        },
      },
      {
        label:  'Deserter Hideout',
        weight: 2,
        units: {
          deserter: { baseMin: 3, baseMax: 8, capMin: 10, capMax: 22, perSpawn: 1 },
        },
      },
      {
        label:  'Mixed Outlaws',
        weight: 2,
        units: {
          bandit:   { baseMin: 4, baseMax: 10, capMin: 15, capMax: 28, perSpawn: 2 },
          deserter: { baseMin: 2, baseMax:  5, capMin:  6, capMax: 14, perSpawn: 1 },
        },
      },
      {
        label:  'Raider Warband',
        weight: 1,
        units: {
          raider: { baseMin: 2, baseMax: 6, capMin: 8, capMax: 18, perSpawn: 1 },
        },
      },
    ],
  },

  // ── Forest ──────────────────────────────────────────────────────────────────
  forest: {
    variants: [
      {
        label:  'Bandit Hideout',
        weight: 3,
        units: {
          bandit: { baseMin: 4, baseMax: 14, capMin: 15, capMax: 32, perSpawn: 2 },
        },
      },
      {
        label:  'Raider Camp',
        weight: 2,
        units: {
          raider: { baseMin: 3, baseMax: 8, capMin: 10, capMax: 20, perSpawn: 1 },
        },
      },
      {
        label:  'Bandit & Raider Ambush',
        weight: 3,
        units: {
          bandit: { baseMin: 4, baseMax: 10, capMin: 12, capMax: 24, perSpawn: 2 },
          raider: { baseMin: 2, baseMax:  6, capMin:  6, capMax: 14, perSpawn: 1 },
        },
      },
      {
        label:  'Forest Shrine — Ancient Guardians',
        weight: 1,
        units: {
          ruin_guardian: { baseMin: 1, baseMax: 3, capMin: 4, capMax:  8, perSpawn: 1 },
          bandit:        { baseMin: 3, baseMax: 7, capMin: 8, capMax: 18, perSpawn: 2 },
        },
      },
    ],
  },

  // ── Rocky Cliffs ────────────────────────────────────────────────────────────
  rocky_cliffs: {
    variants: [
      {
        label:  'Deserter Stronghold',
        weight: 3,
        units: {
          deserter: { baseMin: 5, baseMax: 12, capMin: 14, capMax: 28, perSpawn: 1 },
        },
      },
      {
        label:  'Mountain Raiders',
        weight: 2,
        units: {
          raider: { baseMin: 4, baseMax: 10, capMin: 12, capMax: 24, perSpawn: 1 },
        },
      },
      {
        label:  'Raider Lookout',
        weight: 2,
        units: {
          raider:   { baseMin: 3, baseMax: 8, capMin: 10, capMax: 22, perSpawn: 1 },
          deserter: { baseMin: 2, baseMax: 5, capMin:  6, capMax: 14, perSpawn: 1 },
        },
      },
      {
        label:  'Cliff Guardians',
        weight: 1,
        units: {
          ruin_guardian: { baseMin: 2, baseMax:  5, capMin:  6, capMax: 14, perSpawn: 1 },
          deserter:      { baseMin: 3, baseMax:  7, capMin: 10, capMax: 20, perSpawn: 1 },
        },
      },
    ],
  },

  // ── Marshland ───────────────────────────────────────────────────────────────
  marshland: {
    variants: [
      {
        label:  'Swamp Bandits',
        weight: 3,
        units: {
          bandit: { baseMin: 4, baseMax: 12, capMin: 14, capMax: 28, perSpawn: 2 },
        },
      },
      {
        label:  'Deserter Bog',
        weight: 2,
        units: {
          deserter: { baseMin: 3, baseMax: 9, capMin: 10, capMax: 22, perSpawn: 1 },
        },
      },
      {
        label:  'Mixed Marsh Outlaws',
        weight: 3,
        units: {
          bandit:   { baseMin: 4, baseMax: 10, capMin: 12, capMax: 22, perSpawn: 2 },
          deserter: { baseMin: 2, baseMax:  6, capMin:  6, capMax: 14, perSpawn: 1 },
        },
      },
      {
        label:  'Marsh Raiders',
        weight: 1,
        units: {
          raider: { baseMin: 2, baseMax: 5, capMin:  6, capMax: 14, perSpawn: 1 },
          bandit: { baseMin: 3, baseMax: 7, capMin: 10, capMax: 20, perSpawn: 2 },
        },
      },
    ],
  },

  // ── Ancient Ruins ────────────────────────────────────────────────────────────
  ancient_ruins: {
    variants: [
      {
        label:  'Ruin Guardians',
        weight: 3,
        units: {
          ruin_guardian: { baseMin: 4, baseMax: 9, capMin: 10, capMax: 20, perSpawn: 1 },
        },
      },
      {
        label:  'Deserter Occupation',
        weight: 2,
        units: {
          deserter:      { baseMin: 5, baseMax: 12, capMin: 14, capMax: 26, perSpawn: 1 },
          ruin_guardian: { baseMin: 2, baseMax:  5, capMin:  6, capMax: 12, perSpawn: 1 },
        },
      },
      {
        label:  'Raider Stronghold',
        weight: 1,
        units: {
          raider:        { baseMin: 3, baseMax: 7, capMin:  8, capMax: 18, perSpawn: 1 },
          ruin_guardian: { baseMin: 3, baseMax: 6, capMin:  8, capMax: 16, perSpawn: 1 },
        },
      },
      {
        label:  'Abandoned Camp',
        weight: 2,
        units: {
          bandit:   { baseMin: 4, baseMax: 10, capMin: 12, capMax: 22, perSpawn: 2 },
          deserter: { baseMin: 3, baseMax:  8, capMin:  8, capMax: 18, perSpawn: 1 },
        },
      },
      {
        label:  'Forsaken Horde',
        weight: 1,
        units: {
          bandit:        { baseMin: 6, baseMax: 14, capMin: 18, capMax: 32, perSpawn: 2 },
          raider:        { baseMin: 2, baseMax:  5, capMin:  6, capMax: 12, perSpawn: 1 },
          ruin_guardian: { baseMin: 2, baseMax:  4, capMin:  5, capMax: 10, perSpawn: 1 },
        },
      },
    ],
  },

};

