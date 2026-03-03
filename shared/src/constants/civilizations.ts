import { ResourceMap } from './resources';
import { UnitId } from './units';
import { BuildingId } from './buildings';
import { UnitStats } from './units';

export type CivId = 'default';

export interface CivBonuses {
  /** Flat % bonus to resource production rates */
  resourceProductionBonus?: Partial<ResourceMap>;
  /** % speed bonus to construction (0.1 = 10% faster) */
  buildingSpeedBonus?: number;
  /** Per-unit stat overrides for this civ */
  unitStatBonus?: Partial<Record<UnitId, Partial<UnitStats>>>;
}

export interface CivDef {
  id: CivId;
  name: string;
  description: string;
  bonuses: CivBonuses;
  availableUnits: UnitId[];
  availableBuildings: BuildingId[];
}

export const CIVILIZATIONS: Record<CivId, CivDef> = {
  default: {
    id: 'default',
    name: 'The Realm',
    description:
      'A balanced civilization with no special weaknesses or strengths. ' +
      'The foundation from which all futures are built.',
    bonuses: {},
    availableUnits: ['swordsman', 'archer', 'cavalry', 'siege_ram'],
    availableBuildings: [
      'town_hall',
      'farm',
      'lumber_mill',
      'quarry',
      'iron_mine',
      'market',
      'barracks',
      'stable',
      'workshop',
      'wall',
    ],
  },
};

export const CIVILIZATION_LIST = Object.values(CIVILIZATIONS);

/** The civilization assigned to new players until multi-civ support is added */
export const DEFAULT_CIV_ID: CivId = 'default';
