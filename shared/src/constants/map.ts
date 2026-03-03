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
    label: 'Barren Surface',
    passable: true,
    color: '#8a7560',
    resourceBonus: { ore: 5 },
    encounterChance: 0.04,
  },
  nebula: {
    type: 'nebula',
    label: 'Nebula Cloud',
    passable: true,
    color: '#5a3a7a',
    resourceBonus: { fuel: 10, iridium: 5 },
    encounterChance: 0.18,
  },
  crater: {
    type: 'crater',
    label: 'Impact Crater',
    passable: false,
    color: '#555555',
    resourceBonus: { ore: 20, iridium: 8 },
    encounterChance: 0.1,
  },
  ice_deposit: {
    type: 'ice_deposit',
    label: 'Ice Deposit',
    passable: true,
    color: '#a8d8ea',
    resourceBonus: { water: 20, rations: 5 },
    encounterChance: 0.03,
  },
  starbase: {
    type: 'starbase',
    label: 'Starbase',
    passable: true,
    color: '#e09020',
  },
  derelict: {
    type: 'derelict',
    label: 'Derelict Wreckage',
    passable: true,
    color: '#7a5c3a',
    resourceBonus: { alloys: 10, iridium: 3 },
    encounterChance: 0.4,
  },
};

export const WORLD_DEFS: Record<WorldType, WorldDef> = {
  terrestrial: {
    type: 'terrestrial',
    label: 'Terrestrial Planet',
    description: 'An Earth-like rocky world with breathable patches. Good for colonisation.',
    tileDistribution: { barren: 0.4, ice_deposit: 0.2, crater: 0.15, derelict: 0.06 },
    backgroundColor: '#1a2a3a',
  },
  moon: {
    type: 'moon',
    label: 'Moon',
    description: 'A natural satellite with low gravity and rich crater deposits.',
    tileDistribution: { barren: 0.5, crater: 0.25, derelict: 0.08 },
    backgroundColor: '#1e1e2e',
  },
  exoplanet: {
    type: 'exoplanet',
    label: 'Exoplanet',
    description: 'An alien world with strange atmospheric phenomena. High encounter rates.',
    tileDistribution: { barren: 0.3, nebula: 0.25, crater: 0.1, derelict: 0.1 },
    backgroundColor: '#0d1b2a',
  },
  asteroid_belt: {
    type: 'asteroid_belt',
    label: 'Asteroid Belt',
    description: 'Dense rock field. Dangerous to navigate but rich in ore and iridium.',
    tileDistribution: { barren: 0.2, crater: 0.35, derelict: 0.1, nebula: 0.1 },
    backgroundColor: '#2a1a0a',
  },
  gas_giant_orbit: {
    type: 'gas_giant_orbit',
    label: 'Gas Giant Orbit',
    description: 'Orbital sectors around a massive giant. Excellent fuel harvesting.',
    tileDistribution: { nebula: 0.4, barren: 0.25, ice_deposit: 0.1, derelict: 0.08 },
    backgroundColor: '#1a0d2e',
  },
  ice_world: {
    type: 'ice_world',
    label: 'Ice World',
    description: 'A frozen outer world encased in ice. Water reserves are enormous.',
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

