import { ResourceMap, EMPTY_RESOURCES } from './resources';
import { BuildingId } from './buildings';

export type UnitId = 'swordsman' | 'archer' | 'cavalry' | 'siege_ram';

export interface UnitStats {
  attack: number;
  defense: number;
  speed: number;   // tiles per hour on the world map
  carry: number;   // resource carry capacity
}

export interface UnitDef {
  id: UnitId;
  name: string;
  description: string;
  trainingBuilding: BuildingId;
  trainingBuildingLevel: number; // minimum building level required
  trainingTime: number;          // seconds per single unit
  cost: ResourceMap;
  upkeep: ResourceMap;           // per hour, per unit
  stats: UnitStats;
}

export const UNITS: Record<UnitId, UnitDef> = {
  swordsman: {
    id: 'swordsman',
    name: 'Swordsman',
    description: 'Reliable heavy infantry. The backbone of any army.',
    trainingBuilding: 'barracks',
    trainingBuildingLevel: 1,
    trainingTime: 90,
    cost: { ...EMPTY_RESOURCES, wood: 10, iron: 30, gold: 5 },
    upkeep: { ...EMPTY_RESOURCES, food: 2 },
    stats: { attack: 35, defense: 40, speed: 6, carry: 50 },
  },

  archer: {
    id: 'archer',
    name: 'Archer',
    description: 'Ranged unit. Effective against lightly armored enemies.',
    trainingBuilding: 'barracks',
    trainingBuildingLevel: 2,
    trainingTime: 75,
    cost: { ...EMPTY_RESOURCES, wood: 30, iron: 10, gold: 5 },
    upkeep: { ...EMPTY_RESOURCES, food: 2 },
    stats: { attack: 40, defense: 20, speed: 7, carry: 40 },
  },

  cavalry: {
    id: 'cavalry',
    name: 'Cavalry',
    description: 'Fast mounted warriors. Excellent for raiding and pursuit.',
    trainingBuilding: 'stable',
    trainingBuildingLevel: 1,
    trainingTime: 180,
    cost: { ...EMPTY_RESOURCES, wood: 20, iron: 40, food: 40, gold: 20 },
    upkeep: { ...EMPTY_RESOURCES, food: 5 },
    stats: { attack: 60, defense: 30, speed: 14, carry: 100 },
  },

  siege_ram: {
    id: 'siege_ram',
    name: 'Siege Ram',
    description: 'Slow but devastating against city walls and fortifications.',
    trainingBuilding: 'workshop',
    trainingBuildingLevel: 1,
    trainingTime: 480,
    cost: { ...EMPTY_RESOURCES, wood: 150, iron: 80, stone: 60, gold: 30 },
    upkeep: { ...EMPTY_RESOURCES, food: 8, wood: 2 },
    stats: { attack: 10, defense: 10, speed: 3, carry: 0 },
  },
};

export const UNIT_LIST = Object.values(UNITS);
