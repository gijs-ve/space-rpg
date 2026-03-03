import { ResourceMap, EMPTY_RESOURCES } from './resources';

export type BuildingId =
  | 'town_hall'
  | 'farm'
  | 'lumber_mill'
  | 'quarry'
  | 'iron_mine'
  | 'market'
  | 'barracks'
  | 'stable'
  | 'workshop'
  | 'wall';

export interface BuildingEffect {
  foodProduction?: number;
  woodProduction?: number;
  stoneProduction?: number;
  ironProduction?: number;
  goldProduction?: number;
  storageCapBonus?: number;  // flat bonus to all resource caps
  defenseBonus?: number;     // % bonus to city defense
  tradeCapacity?: number;    // max trade routes
}

export interface BuildingLevel {
  level: number;
  cost: ResourceMap;
  constructionTime: number; // seconds
  effect: BuildingEffect;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
  levels: BuildingLevel[];
  prerequisite?: { buildingId: BuildingId; minLevel: number };
}

// ─── Helper to generate leveled costs ────────────────────────────────────────
function scaledCost(base: Partial<ResourceMap>, level: number): ResourceMap {
  const factor = Math.pow(1.4, level - 1);
  return {
    ...EMPTY_RESOURCES,
    ...Object.fromEntries(
      Object.entries(base).map(([k, v]) => [k, Math.floor((v as number) * factor)])
    ),
  };
}

// ─── Building definitions ─────────────────────────────────────────────────────
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  town_hall: {
    id: 'town_hall',
    name: 'Town Hall',
    description: 'The administrative center of your city. Required for most upgrades.',
    icon: '🏛',
    maxLevel: 10,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ wood: 200, stone: 200, iron: 100, gold: 100 }, i + 1),
      constructionTime: 120 * Math.pow(1.5, i),
      effect: { storageCapBonus: (i + 1) * 200 },
    })),
  },

  farm: {
    id: 'farm',
    name: 'Farm',
    description: 'Produces food to sustain your population and troops.',
    icon: '🌾',
    maxLevel: 10,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ wood: 80, stone: 40 }, i + 1),
      constructionTime: 60 * Math.pow(1.4, i),
      effect: { foodProduction: 50 * (i + 1) },
    })),
  },

  lumber_mill: {
    id: 'lumber_mill',
    name: 'Lumber Mill',
    description: 'Chops down trees to produce wood.',
    icon: '🪵',
    maxLevel: 10,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ food: 60, stone: 60 }, i + 1),
      constructionTime: 60 * Math.pow(1.4, i),
      effect: { woodProduction: 50 * (i + 1) },
    })),
  },

  quarry: {
    id: 'quarry',
    name: 'Quarry',
    description: 'Mines stone from the earth.',
    icon: '⛏',
    maxLevel: 10,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ food: 60, wood: 80 }, i + 1),
      constructionTime: 60 * Math.pow(1.4, i),
      effect: { stoneProduction: 50 * (i + 1) },
    })),
  },

  iron_mine: {
    id: 'iron_mine',
    name: 'Iron Mine',
    description: 'Extracts iron ore, essential for weapons and armor.',
    icon: '⚙',
    maxLevel: 10,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ food: 80, wood: 60, stone: 60 }, i + 1),
      constructionTime: 90 * Math.pow(1.4, i),
      effect: { ironProduction: 40 * (i + 1) },
    })),
  },

  market: {
    id: 'market',
    name: 'Market',
    description: 'Generates gold income and enables trade (post-MVP).',
    icon: '🏪',
    maxLevel: 10,
    prerequisite: { buildingId: 'town_hall', minLevel: 2 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ wood: 120, stone: 80, gold: 50 }, i + 1),
      constructionTime: 90 * Math.pow(1.5, i),
      effect: { goldProduction: 30 * (i + 1), tradeCapacity: i + 1 },
    })),
  },

  barracks: {
    id: 'barracks',
    name: 'Barracks',
    description: 'Trains infantry units.',
    icon: '⚔',
    maxLevel: 10,
    prerequisite: { buildingId: 'town_hall', minLevel: 1 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ wood: 150, stone: 100, iron: 50 }, i + 1),
      constructionTime: 120 * Math.pow(1.5, i),
      effect: {},
    })),
  },

  stable: {
    id: 'stable',
    name: 'Stable',
    description: 'Trains cavalry units.',
    icon: '🐴',
    maxLevel: 10,
    prerequisite: { buildingId: 'barracks', minLevel: 3 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ wood: 200, stone: 100, iron: 80 }, i + 1),
      constructionTime: 150 * Math.pow(1.5, i),
      effect: {},
    })),
  },

  workshop: {
    id: 'workshop',
    name: 'Workshop',
    description: 'Constructs siege weapons.',
    icon: '🔨',
    maxLevel: 10,
    prerequisite: { buildingId: 'barracks', minLevel: 5 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ wood: 300, stone: 200, iron: 150 }, i + 1),
      constructionTime: 200 * Math.pow(1.5, i),
      effect: {},
    })),
  },

  wall: {
    id: 'wall',
    name: 'City Wall',
    description: 'Fortifies your city, increasing defensive strength.',
    icon: '🧱',
    maxLevel: 10,
    prerequisite: { buildingId: 'town_hall', minLevel: 3 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ stone: 300, iron: 100 }, i + 1),
      constructionTime: 180 * Math.pow(1.5, i),
      effect: { defenseBonus: 10 * (i + 1) },
    })),
  },
};

export const BUILDING_LIST = Object.values(BUILDINGS);

/** Number of building slots per city */
export const CITY_BUILDING_SLOTS = 20;
