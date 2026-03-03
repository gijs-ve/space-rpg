import { ResourceMap, EMPTY_RESOURCES } from './resources';

export type BuildingId =
  | 'command_center'
  | 'hydroponics_bay'
  | 'water_extractor'
  | 'mining_rig'
  | 'refinery'
  | 'trade_hub'
  | 'recruitment_bay'
  | 'hangar'
  | 'engineering_bay'
  | 'defense_grid'
  | 'armory';

export interface BuildingEffect {
  rationsProduction?:  number;
  waterProduction?:    number;
  oreProduction?:      number;
  alloysProduction?:   number;
  fuelProduction?:     number;
  iridiumProduction?:  number;
  storageCapBonus?:    number;
  defenseBonus?:       number;
  tradeCapacity?:      number;
  /** Item storage grid dimensions for the Armory building */
  armoryGridCols?:     number;
  armoryGridRows?:     number;
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
  command_center: {
    id: 'command_center',
    name: 'Command Center',
    description: 'The administrative hub of your starbase. Required for most upgrades.',
    icon: '🛸',
    maxLevel: 10,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ ore: 200, alloys: 200, fuel: 50, iridium: 10 }, i + 1),
      constructionTime: 120 * Math.pow(1.5, i),
      effect: { storageCapBonus: (i + 1) * 200 },
    })),
  },

  hydroponics_bay: {
    id: 'hydroponics_bay',
    name: 'Hydroponics Bay',
    description: 'Grows nutrient packs to sustain your crew and troops.',
    icon: '🌿',
    maxLevel: 10,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ ore: 80, water: 40 }, i + 1),
      constructionTime: 60 * Math.pow(1.4, i),
      effect: { rationsProduction: 50 * (i + 1) },
    })),
  },

  water_extractor: {
    id: 'water_extractor',
    name: 'Water Extractor',
    description: 'Harvests subsurface ice and atmospheric moisture.',
    icon: '💧',
    maxLevel: 10,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ rations: 60, ore: 60 }, i + 1),
      constructionTime: 60 * Math.pow(1.4, i),
      effect: { waterProduction: 50 * (i + 1) },
    })),
  },

  mining_rig: {
    id: 'mining_rig',
    name: 'Mining Rig',
    description: 'Drills into the planetary crust to extract raw ore.',
    icon: '⛏️',
    maxLevel: 10,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ rations: 60, alloys: 80 }, i + 1),
      constructionTime: 60 * Math.pow(1.4, i),
      effect: { oreProduction: 50 * (i + 1) },
    })),
  },

  refinery: {
    id: 'refinery',
    name: 'Refinery',
    description: 'Processes raw ore into structural alloys and trace iridium.',
    icon: '🏭',
    maxLevel: 10,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ rations: 80, ore: 60, alloys: 40 }, i + 1),
      constructionTime: 90 * Math.pow(1.4, i),
      effect: { alloysProduction: 40 * (i + 1), iridiumProduction: 2 * (i + 1) },
    })),
  },

  trade_hub: {
    id: 'trade_hub',
    name: 'Trade Hub',
    description: 'Generates Deuterium income through interstellar commerce.',
    icon: '🚀',
    maxLevel: 10,
    prerequisite: { buildingId: 'command_center', minLevel: 2 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ alloys: 120, ore: 80, fuel: 30 }, i + 1),
      constructionTime: 90 * Math.pow(1.5, i),
      effect: { fuelProduction: 25 * (i + 1), tradeCapacity: i + 1 },
    })),
  },

  recruitment_bay: {
    id: 'recruitment_bay',
    name: 'Recruitment Bay',
    description: 'Trains infantry and ground-assault units.',
    icon: '🪖',
    maxLevel: 10,
    prerequisite: { buildingId: 'command_center', minLevel: 1 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ alloys: 150, ore: 100, fuel: 30 }, i + 1),
      constructionTime: 120 * Math.pow(1.5, i),
      effect: {},
    })),
  },

  hangar: {
    id: 'hangar',
    name: 'Hangar',
    description: 'Houses and deploys fast scout craft and light assault ships.',
    icon: '🛩️',
    maxLevel: 10,
    prerequisite: { buildingId: 'recruitment_bay', minLevel: 3 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ alloys: 200, ore: 100, fuel: 60 }, i + 1),
      constructionTime: 150 * Math.pow(1.5, i),
      effect: {},
    })),
  },

  engineering_bay: {
    id: 'engineering_bay',
    name: 'Engineering Bay',
    description: 'Constructs heavy mechs and siege platforms.',
    icon: '🔧',
    maxLevel: 10,
    prerequisite: { buildingId: 'recruitment_bay', minLevel: 5 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ alloys: 300, ore: 200, iridium: 10 }, i + 1),
      constructionTime: 200 * Math.pow(1.5, i),
      effect: {},
    })),
  },

  defense_grid: {
    id: 'defense_grid',
    name: 'Defense Grid',
    description: 'Orbital cannons and shield emitters that protect your starbase.',
    icon: '🛡️',
    maxLevel: 10,
    prerequisite: { buildingId: 'command_center', minLevel: 3 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ alloys: 300, iridium: 15 }, i + 1),
      constructionTime: 180 * Math.pow(1.5, i),
      effect: { defenseBonus: 10 * (i + 1) },
    })),
  },

  armory: {
    id: 'armory',
    name: 'Armory',
    description: 'Secure vault for storing equipment and items. Upgrading expands the storage grid.',
    icon: '🗄️',
    maxLevel: 5,
    prerequisite: { buildingId: 'command_center', minLevel: 1 },
    levels: Array.from({ length: 5 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ alloys: 150, ore: 100, iridium: 5 }, i + 1),
      constructionTime: 120 * Math.pow(1.5, i),
      effect: {
        armoryGridCols: 4 + (i + 1) * 2,  // lv1=6, lv2=8, lv3=10, lv4=12, lv5=14
        armoryGridRows: 4 + (i + 1) * 2,
      },
    })),
  },
};

export const BUILDING_LIST = Object.values(BUILDINGS);

/** Number of building slots per starbase */
export const CITY_BUILDING_SLOTS = 20;

/** Armory grid size for a given building level */
export function armoryGridSize(level: number): { cols: number; rows: number } {
  return { cols: 4 + level * 2, rows: 4 + level * 2 };
}
