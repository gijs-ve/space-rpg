export type TileType = 'barren' | 'forest' | 'rocky_cliffs' | 'marshland' | 'castle' | 'ancient_ruins';

export type WorldType =
  | 'lowlands'
  | 'highlands'
  | 'darkwood'
  | 'mountains'
  | 'river_delta'
  | 'frozen_wastes';

export const MAP_WIDTH  = 100;
export const MAP_HEIGHT = 100;

export interface TileDef {
  type: TileType;
  label: string;
  /** Whether units can move through this tile */
  passable: boolean;
  /** Hex color for map rendering */
  color: string;
  /** Bonus to adjacent base resource production (%) */
  resourceBonus?: Partial<Record<'rations' | 'water' | 'ore' | 'iron' | 'wood' | 'gold', number>>;
  /** 0–1 chance that an adventure encounter spawns here */
  encounterChance?: number;
}

export interface WorldDef {
  type: WorldType;
  label: string;
  description: string;
  /** Tile types that can appear on this world */
  tileDistribution: Partial<Record<TileType, number>>;
  /** Background color used for the map viewport */
  backgroundColor: string;
}

export const TILE_DEFS: Record<TileType, TileDef> = {
  barren: {
    type: 'barren',
    label: 'Open Fields',
    passable: true,
    color: '#8a7560',
    resourceBonus: { ore: 5 },
    encounterChance: 0.04,
  },
  forest: {
    type: 'forest',
    label: 'Enchanted Forest',
    passable: true,
    color: '#2d5a27',
    resourceBonus: { wood: 10, gold: 5 },
    encounterChance: 0.18,
  },
  rocky_cliffs: {
    type: 'rocky_cliffs',
    label: 'Rocky Cliffs',
    passable: false,
    color: '#555555',
    resourceBonus: { ore: 20, gold: 8 },
    encounterChance: 0.1,
  },
  marshland: {
    type: 'marshland',
    label: 'Marshland',
    passable: true,
    color: '#5a8e5a',
    resourceBonus: { water: 20, rations: 5 },
    encounterChance: 0.03,
  },
  castle: {
    type: 'castle',
    label: 'Castle',
    passable: true,
    color: '#e09020',
  },
  ancient_ruins: {
    type: 'ancient_ruins',
    label: 'Ancient Ruins',
    passable: true,
    color: '#7a5c3a',
    resourceBonus: { iron: 10, gold: 3 },
    encounterChance: 0.4,
  },
};

export const WORLD_DEFS: Record<WorldType, WorldDef> = {
  lowlands: {
    type: 'lowlands',
    label: 'Lowlands',
    description: 'Fertile flatlands with rich farmland and gentle rivers. Ideal for founding a settlement.',
    tileDistribution: { barren: 0.4, marshland: 0.2, rocky_cliffs: 0.15, ancient_ruins: 0.06 },
    backgroundColor: '#1a2a1a',
  },
  highlands: {
    type: 'highlands',
    label: 'Highlands',
    description: 'Rugged moorland and steep hills. Low shelter but rich in stone and ancient ruins.',
    tileDistribution: { barren: 0.5, rocky_cliffs: 0.25, ancient_ruins: 0.08 },
    backgroundColor: '#1e1e2e',
  },
  darkwood: {
    type: 'darkwood',
    label: 'Darkwood',
    description: 'An ancient, gloomy forest with twisted paths and strange phenomena. High encounter rates.',
    tileDistribution: { barren: 0.3, forest: 0.25, rocky_cliffs: 0.1, ancient_ruins: 0.1 },
    backgroundColor: '#0d1b0a',
  },
  mountains: {
    type: 'mountains',
    label: 'Mountain Range',
    description: 'Steep rocky terrain. Dangerous to traverse but rich in stone and gold.',
    tileDistribution: { barren: 0.2, rocky_cliffs: 0.35, ancient_ruins: 0.1, forest: 0.1 },
    backgroundColor: '#2a1a0a',
  },
  river_delta: {
    type: 'river_delta',
    label: 'River Delta',
    description: 'A wide river mouth with busy trade routes and fertile flood plains. Excellent for wood harvesting.',
    tileDistribution: { forest: 0.4, barren: 0.25, marshland: 0.1, ancient_ruins: 0.08 },
    backgroundColor: '#0a1a2e',
  },
  frozen_wastes: {
    type: 'frozen_wastes',
    label: 'Frozen Wastes',
    description: 'A frozen northern region locked in permafrost. Water reserves are enormous.',
    tileDistribution: { marshland: 0.5, barren: 0.2, rocky_cliffs: 0.1, ancient_ruins: 0.05 },
    backgroundColor: '#0a1a2a',
  },
};

/** Client viewport dimensions (in tiles) */
export const VIEWPORT_WIDTH  = 20;
export const VIEWPORT_HEIGHT = 15;

/** Map generation seed (change to regenerate the world) */
export const MAP_SEED = 42;

/** Approximate percentage of each tile type on the default starting world */
export const TILE_DISTRIBUTION: Record<TileType, number> = {
  barren:      0.44,
  forest:      0.20,
  rocky_cliffs:      0.14,
  marshland: 0.12,
  ancient_ruins:    0.06,
  castle:    0.04, // placed dynamically when players found bases
};

