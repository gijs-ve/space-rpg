import { ResourceMap } from './resources';
import { UnitId } from './units';
import { BuildingId } from './buildings';
import { UnitStats } from './units';

export type CivId = 'albion' | 'savoy' | 'tadmor';

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
  'great_hall',
  'granary',
  'millpond',
  'quarry',
  'forge',
  'marketplace',
  'barracks',
  'stables',
  'siege_workshop',
  'ramparts',
];

const ALL_UNITS: UnitId[] = [
  'levy_spearman',
  'sergeant',
  'man_at_arms',
  'levy_archer',
  'longbowman',
  'arbalestier',
  'chevaucheur',
  'knight',
  'trebuchet',
];

export const CIVILIZATIONS: Record<CivId, CivDef> = {
  albion: {
    id: 'albion',
    name: 'Kingdom of Albion',
    description:
      'A prosperous northern kingdom built on honour and discipline. Balanced across all disciplines — ' +
      'quick to adapt, hard to break.',
    bonuses: {},
    availableUnits: ALL_UNITS,
    availableBuildings: ALL_BUILDINGS,
  },

  savoy: {
    id: 'savoy',
    name: 'Merchant Republic of Savoy',
    description:
      'Alpine traders turned powerful lords. Masters of stone and iron extraction with ' +
      'a gift for commerce. +15% stone & iron production, +10% construction speed.',
    bonuses: {
      resourceProductionBonus: { ore: 15, iron: 15 },
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
      resourceProductionBonus: { wood: 10 },
      unitStatBonus: {
        man_at_arms: { attack: 7 },
        trebuchet:   { attack: 5 },
      },
    },
    availableUnits: ALL_UNITS,
    availableBuildings: ALL_BUILDINGS,
  },
};

export const CIVILIZATION_LIST = Object.values(CIVILIZATIONS);

/** The civilization assigned to new players until multi-civ selection is added */
export const DEFAULT_CIV_ID: CivId = 'albion';
