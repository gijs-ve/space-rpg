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
  | 'armory'
  | 'storage_expansion'
  | 'item_vault';

export interface BuildingEffect {
  rationsProduction?:      number;
  waterProduction?:        number;
  oreProduction?:          number;
  alloysProduction?:       number;
  fuelProduction?:         number;
  iridiumProduction?:      number;
  storageCapBonus?:        number;
  /** Per-resource storage bonus for storage_expansion (applied only to selectedResources in building meta) */
  storageExpansionBonus?:  number;
  defenseBonus?:           number;
  tradeCapacity?:          number;
  /** Item storage grid dimensions for the Armory / Item Vault buildings */
  armoryGridCols?:         number;
  armoryGridRows?:         number;
  /** % reduction to training time for units trained in this building (per level) */
  trainingSpeedBonus?:     number;
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
  /** Maximum copies of this building allowed per base (undefined = unlimited) */
  maxPerBase?: number;
  levels: BuildingLevel[];
  prerequisite?: { buildingId: BuildingId; minLevel: number };
  /** Whether this building has a crafting interface */
  canCraft?: boolean;
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
    name: 'Great Hall',
    description: 'The administrative heart of your settlement. Required for most upgrades.',
    icon: '🏰',
    maxLevel: 10,
    maxPerBase: 1,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ ore: 200, alloys: 200, fuel: 50, iridium: 10 }, i + 1),
      constructionTime: 120 * Math.pow(1.5, i),
      effect: { storageCapBonus: (i + 1) * 200 },
    })),
  },

  hydroponics_bay: {
    id: 'hydroponics_bay',
    name: 'Granary',
    description: 'Cultivates crops and stores food to feed your people and troops.',
    icon: '🌾',
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
    name: 'Millpond',
    description: 'Draws and channels water from nearby springs and streams.',
    icon: '💧',
    maxLevel: 10,
    canCraft: true,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ rations: 60, ore: 60 }, i + 1),
      constructionTime: 60 * Math.pow(1.4, i),
      effect: { waterProduction: 50 * (i + 1) },
    })),
  },

  mining_rig: {
    id: 'mining_rig',
    name: 'Quarry',
    description: 'Cuts into hillsides and riverbeds to extract raw stone.',
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
    name: 'Forge',
    description: 'Smelts raw stone into wrought iron and extracts precious gold.',
    icon: '🔥',
    maxLevel: 10,
    canCraft: true,
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ rations: 80, ore: 60, alloys: 40 }, i + 1),
      constructionTime: 90 * Math.pow(1.4, i),
      effect: { alloysProduction: 40 * (i + 1), iridiumProduction: 2 * (i + 1) },
    })),
  },

  trade_hub: {
    id: 'trade_hub',
    name: 'Marketplace',
    description: 'Generates wood income through regional trade and commerce.',
    icon: '⚖️',
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
    name: 'Barracks',
    description: 'Trains infantry and ground-assault troops.',
    icon: '🪖',
    maxLevel: 10,
    prerequisite: { buildingId: 'command_center', minLevel: 1 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ alloys: 150, ore: 100, fuel: 30 }, i + 1),
      constructionTime: 120 * Math.pow(1.5, i),
      // Each level above 1 grants 8% faster training, capped at 50%
      effect: { trainingSpeedBonus: Math.min(50, i * 8) },
    })),
  },

  hangar: {
    id: 'hangar',
    name: 'Stables',
    description: 'Houses and deploys cavalry and mounted warriors.',
    icon: '🐴',
    maxLevel: 10,
    prerequisite: { buildingId: 'recruitment_bay', minLevel: 3 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ alloys: 200, ore: 100, fuel: 60 }, i + 1),
      constructionTime: 150 * Math.pow(1.5, i),
      effect: { trainingSpeedBonus: Math.min(50, i * 8) },
    })),
  },

  engineering_bay: {
    id: 'engineering_bay',
    name: 'Siege Workshop',
    description: 'Constructs trebuchets, battering rams and other siege engines.',
    icon: '⚒️',
    maxLevel: 10,
    prerequisite: { buildingId: 'recruitment_bay', minLevel: 5 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ alloys: 300, ore: 200, iridium: 10 }, i + 1),
      constructionTime: 200 * Math.pow(1.5, i),
      effect: { trainingSpeedBonus: Math.min(50, i * 8) },
    })),
  },

  defense_grid: {
    id: 'defense_grid',
    name: 'Ramparts',
    description: 'Stone walls, battlements, and watchtowers that protect your settlement.',
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
    name: 'Armoury',
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

  storage_expansion: {
    id: 'storage_expansion',
    name: 'Storehouse',
    description: 'Expands storage capacity for chosen resources. Each level adds +500 cap per assigned resource. New resource slots open every 2 levels.',
    icon: '🗃️',
    maxLevel: 10,
    maxPerBase: 3,
    prerequisite: { buildingId: 'command_center', minLevel: 1 },
    levels: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ ore: 100, alloys: 80 }, i + 1),
      constructionTime: 90 * Math.pow(1.4, i),
      effect: { storageExpansionBonus: 500 * (i + 1) },
    })),
  },

  item_vault: {
    id: 'item_vault',
    name: 'Treasury',
    description: 'A high-capacity vault for storing valuables and equipment beyond what the armoury holds.',
    icon: '💰',
    maxLevel: 5,
    prerequisite: { buildingId: 'command_center', minLevel: 2 },
    levels: Array.from({ length: 5 }, (_, i) => ({
      level: i + 1,
      cost: scaledCost({ alloys: 180, ore: 120, iridium: 8 }, i + 1),
      constructionTime: 150 * Math.pow(1.5, i),
      effect: {
        armoryGridCols: 6 + (i + 1) * 2,  // lv1=8 … lv5=16
        armoryGridRows: 6 + (i + 1) * 2,
      },
    })),
  },
};

export const BUILDING_LIST = Object.values(BUILDINGS);

/** Number of resource slots available for a storage_expansion at a given level.
 *  Starts at 1, gains +1 every 2 levels: lv1=1, lv2=1, lv3=2, lv4=2, lv5=3 … */
export function storageExpansionResourceSlots(level: number): number {
  return Math.ceil(level / 2);
}

/** Number of building slots per settlement */
export const CITY_BUILDING_SLOTS = 20;

/** Armory grid size for a given building level */
export function armoryGridSize(level: number): { cols: number; rows: number } {
  return { cols: 4 + level * 2, rows: 4 + level * 2 };
}
