import { ResourceMap } from './resources';
import { UnitId } from './units';
import { BuildingId } from './buildings';
import { UnitStats } from './units';

export type CivId = 'terran' | 'saffari' | 'tadmor';

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

const ALL_BUILDINGS: BuildingId[] = [
  'command_center',
  'hydroponics_bay',
  'water_extractor',
  'mining_rig',
  'refinery',
  'trade_hub',
  'recruitment_bay',
  'hangar',
  'engineering_bay',
  'defense_grid',
];

const ALL_UNITS: UnitId[] = ['marine', 'marksman', 'scout_bike', 'heavy_mech'];

export const CIVILIZATIONS: Record<CivId, CivDef> = {
  terran: {
    id: 'terran',
    name: 'Terran Alliance',
    description:
      "Earth's unified space force. Balanced across all disciplines — " +
      'quick to adapt, hard to break.',
    bonuses: {},
    availableUnits: ALL_UNITS,
    availableBuildings: ALL_BUILDINGS,
  },

  saffari: {
    id: 'saffari',
    name: 'Saffari Collective',
    description:
      'Descendants of the Saffar system colonists. Masters of resource extraction ' +
      'and long-haul trade. +15% ore & alloys production, +10% construction speed.',
    bonuses: {
      resourceProductionBonus: { ore: 15, alloys: 15 },
      buildingSpeedBonus: 0.1,
    },
    availableUnits: ALL_UNITS,
    availableBuildings: ALL_BUILDINGS,
  },

  tadmor: {
    id: 'tadmor',
    name: 'Tadmor Empire',
    description:
      'Forged in the harsh orbit of the Tadmor binary system. Aggressive expansionists ' +
      'with superior heavy units. +20% marine & heavy mech attack, +10% fuel production.',
    bonuses: {
      resourceProductionBonus: { fuel: 10 },
      unitStatBonus: {
        marine:     { attack: 7 },
        heavy_mech: { attack: 5 },
      },
    },
    availableUnits: ALL_UNITS,
    availableBuildings: ALL_BUILDINGS,
  },
};

export const CIVILIZATION_LIST = Object.values(CIVILIZATIONS);

/** The civilization assigned to new players until multi-civ selection is added */
export const DEFAULT_CIV_ID: CivId = 'terran';
