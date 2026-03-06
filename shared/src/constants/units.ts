import { ResourceMap, EMPTY_RESOURCES } from './resources';
import { BuildingId } from './buildings';

export type UnitId = 'marine' | 'marksman' | 'scout_bike' | 'heavy_mech';

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
  marine: {
    id: 'marine',
    name: 'Man-at-Arms',
    description: 'Dependable heavy infantry clad in chainmail. The backbone of any ground force.',
    trainingBuilding: 'recruitment_bay',
    trainingBuildingLevel: 1,
    trainingTime: 90,
    cost: { ...EMPTY_RESOURCES, alloys: 30, fuel: 5 },
    upkeep: { ...EMPTY_RESOURCES, rations: 2 },
    stats: { attack: 35, defense: 40, speed: 6, carry: 50 },
  },

  marksman: {
    id: 'marksman',
    name: 'Longbowman',
    description: 'Skilled archer bearing a powerful yew bow. Effective against lightly armoured targets.',
    trainingBuilding: 'recruitment_bay',
    trainingBuildingLevel: 2,
    trainingTime: 75,
    cost: { ...EMPTY_RESOURCES, alloys: 20, ore: 10, fuel: 5 },
    upkeep: { ...EMPTY_RESOURCES, rations: 2 },
    stats: { attack: 40, defense: 20, speed: 7, carry: 40 },
  },

  scout_bike: {
    id: 'scout_bike',
    name: 'Cavalry',
    description: 'Swift mounted warrior. Excellent for raiding and rapid strikes.',
    trainingBuilding: 'hangar',
    trainingBuildingLevel: 1,
    trainingTime: 180,
    cost: { ...EMPTY_RESOURCES, alloys: 40, fuel: 20, rations: 10 },
    upkeep: { ...EMPTY_RESOURCES, rations: 3, fuel: 2 },
    stats: { attack: 60, defense: 30, speed: 14, carry: 100 },
  },

  heavy_mech: {
    id: 'heavy_mech',
    name: 'Trebuchet',
    description: 'Slow, devastating siege engine. Ideal for breaching castle fortifications.',
    trainingBuilding: 'engineering_bay',
    trainingBuildingLevel: 1,
    trainingTime: 480,
    cost: { ...EMPTY_RESOURCES, alloys: 150, ore: 80, iridium: 10, fuel: 30 },
    upkeep: { ...EMPTY_RESOURCES, rations: 5, fuel: 4 },
    stats: { attack: 10, defense: 10, speed: 3, carry: 0 },
  },
};

export const UNIT_LIST = Object.values(UNITS);
