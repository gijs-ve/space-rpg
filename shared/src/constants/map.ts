export type TileType = 'barren' | 'nebula' | 'crater' | 'ice_deposit' | 'starbase' | 'derelict';

export type WorldType =
  | 'terrestrial'
  | 'moon'
  | 'exoplanet'
  | 'asteroid_belt'
  | 'gas_giant_orbit'
  | 'ice_world';

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
  resourceBonus?: Partial<Record<'rations' | 'water' | 'ore' | 'alloys' | 'fuel' | 'iridium', number>>;
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
  nebula: {
    type: 'nebula',
    label: 'Enchanted Forest',
    passable: true,
    color: '#2d5a27',
    resourceBonus: { fuel: 10, iridium: 5 },
    encounterChance: 0.18,
  },
  crater: {
    type: 'crater',
    label: 'Rocky Cliffs',
    passable: false,
    color: '#555555',
    resourceBonus: { ore: 20, iridium: 8 },
    encounterChance: 0.1,
  },
  ice_deposit: {
    type: 'ice_deposit',
    label: 'Marshland',
    passable: true,
    color: '#5a8e5a',
    resourceBonus: { water: 20, rations: 5 },
    encounterChance: 0.03,
  },
  starbase: {
    type: 'starbase',
    label: 'Castle',
    passable: true,
    color: '#e09020',
  },
  derelict: {
    type: 'derelict',
    label: 'Ancient Ruins',
    passable: true,
    color: '#7a5c3a',
    resourceBonus: { alloys: 10, iridium: 3 },
    encounterChance: 0.4,
  },
};

export const WORLD_DEFS: Record<WorldType, WorldDef> = {
  terrestrial: {
    type: 'terrestrial',
    label: 'Lowlands',
    description: 'Fertile flatlands with rich farmland and gentle rivers. Ideal for founding a settlement.',
    tileDistribution: { barren: 0.4, ice_deposit: 0.2, crater: 0.15, derelict: 0.06 },
    backgroundColor: '#1a2a1a',
  },
  moon: {
    type: 'moon',
    label: 'Highlands',
    description: 'Rugged moorland and steep hills. Low shelter but rich in stone and ancient ruins.',
    tileDistribution: { barren: 0.5, crater: 0.25, derelict: 0.08 },
    backgroundColor: '#1e1e2e',
  },
  exoplanet: {
    type: 'exoplanet',
    label: 'Darkwood',
    description: 'An ancient, gloomy forest with twisted paths and strange phenomena. High encounter rates.',
    tileDistribution: { barren: 0.3, nebula: 0.25, crater: 0.1, derelict: 0.1 },
    backgroundColor: '#0d1b0a',
  },
  asteroid_belt: {
    type: 'asteroid_belt',
    label: 'Mountain Range',
    description: 'Steep rocky terrain. Dangerous to traverse but rich in stone and gold.',
    tileDistribution: { barren: 0.2, crater: 0.35, derelict: 0.1, nebula: 0.1 },
    backgroundColor: '#2a1a0a',
  },
  gas_giant_orbit: {
    type: 'gas_giant_orbit',
    label: 'River Delta',
    description: 'A wide river mouth with busy trade routes and fertile flood plains. Excellent for wood harvesting.',
    tileDistribution: { nebula: 0.4, barren: 0.25, ice_deposit: 0.1, derelict: 0.08 },
    backgroundColor: '#0a1a2e',
  },
  ice_world: {
    type: 'ice_world',
    label: 'Frozen Wastes',
    description: 'A frozen northern region locked in permafrost. Water reserves are enormous.',
    tileDistribution: { ice_deposit: 0.5, barren: 0.2, crater: 0.1, derelict: 0.05 },
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
  nebula:      0.20,
  crater:      0.14,
  ice_deposit: 0.12,
  derelict:    0.06,
  starbase:    0.04, // placed dynamically when players found bases
};

