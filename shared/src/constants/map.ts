export type TileType = 'plains' | 'forest' | 'mountain' | 'lake' | 'city' | 'ruins';

export const MAP_WIDTH  = 100;
export const MAP_HEIGHT = 100;

export interface TileDef {
  type: TileType;
  label: string;
  /** Whether units can move through this tile */
  passable: boolean;
  /** Hex color for map rendering */
  color: string;
  /** Bonus to adjacent city resource production (%) */
  resourceBonus?: Partial<Record<'food' | 'wood' | 'stone' | 'iron' | 'gold', number>>;
  /** 0–1 chance that an adventure encounter spawns here */
  encounterChance?: number;
}

export const TILE_DEFS: Record<TileType, TileDef> = {
  plains: {
    type: 'plains',
    label: 'Plains',
    passable: true,
    color: '#a8d5a2',
    resourceBonus: { food: 10 },
    encounterChance: 0.05,
  },
  forest: {
    type: 'forest',
    label: 'Forest',
    passable: true,
    color: '#3a7d44',
    resourceBonus: { wood: 15, food: 5 },
    encounterChance: 0.15,
  },
  mountain: {
    type: 'mountain',
    label: 'Mountain',
    passable: false,
    color: '#8b8b8b',
    resourceBonus: { stone: 20, iron: 10 },
    encounterChance: 0.1,
  },
  lake: {
    type: 'lake',
    label: 'Lake',
    passable: false,
    color: '#4a8fc1',
    resourceBonus: { food: 15 },
  },
  city: {
    type: 'city',
    label: 'City',
    passable: true,
    color: '#f5c842',
  },
  ruins: {
    type: 'ruins',
    label: 'Ancient Ruins',
    passable: true,
    color: '#c9a96e',
    encounterChance: 0.4,
  },
};

/** Client viewport dimensions (in tiles) */
export const VIEWPORT_WIDTH  = 20;
export const VIEWPORT_HEIGHT = 15;

/** Map generation seed (change to regenerate the world) */
export const MAP_SEED = 42;

/** Approximate percentage of each tile type on the map */
export const TILE_DISTRIBUTION: Record<TileType, number> = {
  plains:   0.45,
  forest:   0.25,
  mountain: 0.12,
  lake:     0.08,
  ruins:    0.06,
  city:     0.04, // placed dynamically when players found cities
};
