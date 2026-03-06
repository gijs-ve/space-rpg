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
    name: 'Kingdom of Albion',
    description:
      'A prosperous northern kingdom built on honour and discipline. Balanced across all disciplines — ' +
      'quick to adapt, hard to break.',
    bonuses: {},
    availableUnits: ALL_UNITS,
    availableBuildings: ALL_BUILDINGS,
  },

  saffari: {
    id: 'saffari',
    name: 'Merchant Republic of Savoy',
    description:
      'Alpine traders turned powerful lords. Masters of stone and iron extraction with ' +
      'a gift for commerce. +15% stone & iron production, +10% construction speed.',
    bonuses: {
      resourceProductionBonus: { ore: 15, alloys: 15 },
      buildingSpeedBonus: 0.1,
    },
    availableUnits: ALL_UNITS,
    availableBuildings: ALL_BUILDINGS,
  },

  tadmor: {
    id: 'tadmor',
    name: 'Sultanate of Tadmor',
    description:
      'Forged in the harsh desert heat of the Tadmor basin. Aggressive expansionists ' +
      'with superior heavy troops. +20% man-at-arms & trebuchet attack, +10% wood production.',
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
