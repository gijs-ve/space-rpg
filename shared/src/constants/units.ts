import { ResourceMap, EMPTY_RESOURCES } from './resources';
import { BuildingId } from './buildings';

// ─── Unit IDs ─────────────────────────────────────────────────────────────────

export type UnitId =
  // Infantry
  | 'levy_spearman'
  | 'sergeant'
  | 'man_at_arms'
  // Ranged
  | 'levy_archer'
  | 'longbowman'
  | 'arbalestier'
  // Cavalry
  | 'chevaucheur'
  | 'knight'
  // Siege
  | 'trebuchet'
  // ── Neutral enemies (not trainable by players) ────────────────────────────
  | 'bandit'
  | 'deserter'
  | 'raider'
  | 'ruin_guardian';

// ─── Categories ───────────────────────────────────────────────────────────────

/**
 * Broad tactical category of a unit.
 * - infantry : foot soldiers; strong vs cavalry
 * - ranged   : missile troops; strong vs infantry
 * - cavalry  : mounted warriors; strong vs ranged
 * - siege    : slow engines; specialised vs fortifications
 */
export type UnitCategory = 'infantry' | 'ranged' | 'cavalry' | 'siege';

// ─── Labels ───────────────────────────────────────────────────────────────────

/**
 * Fine-grained tactical labels placed on a unit.
 *
 * Armour descriptors (what the unit IS):
 *   light_armored  — padded/leather; vulnerable to slashing & broadhead attacks
 *   heavy_armored  — mail/plate;     vulnerable to crushing & piercing attacks
 *
 * Mobility:
 *   mounted        — fights on horseback; vulnerable to anti_cavalry and infantry
 *
 * Tactical specialisations:
 *   anti_cavalry   — trained to receive cavalry charges (pikes, halberds)
 *   vulnerable     — particularly fragile unit (e.g. siege crews, levy conscripts)
 *
 * Melee attack styles (what the unit does offensively):
 *   slashing       — swords / axes; bonus damage vs light_armored
 *   crushing       — warhammers / maces; bonus damage vs heavy_armored
 *
 * Ranged attack styles:
 *   broadhead      — wide-tip arrows; bonus damage vs light_armored
 *   piercing       — bodkin bolts / crossbow; bonus damage vs heavy_armored
 */
export type UnitLabel =
  | 'light_armored'
  | 'heavy_armored'
  | 'mounted'
  | 'anti_cavalry'
  | 'vulnerable'
  | 'slashing'
  | 'crushing'
  | 'broadhead'
  | 'piercing';

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
  category: UnitCategory;
  /** Tactical labels — used by the combat matchup system. */
  labels: UnitLabel[];
  /** Undefined for neutral enemies. */
  trainingBuilding?: BuildingId;
  /** Undefined for neutral enemies. */
  trainingBuildingLevel?: number;
  /** Undefined for neutral enemies. */
  trainingTime?: number;
  /** Undefined for neutral enemies. */
  cost?: ResourceMap;
  /** Undefined for neutral enemies. */
  upkeep?: ResourceMap;
  stats: UnitStats;
  /** True for neutral enemy units — never shown in player training UI. */
  neutral?: true;
}

// ─── Unit definitions ─────────────────────────────────────────────────────────

export const UNITS: Record<UnitId, UnitDef> = {

  // ── Infantry ──────────────────────────────────────────────────────────────

  levy_spearman: {
    id: 'levy_spearman',
    name: 'Levy Spearman',
    description: 'Conscripted peasant armed with a long spear and wicker shield. Cheap to muster and surprisingly effective at halting cavalry charges.',
    category: 'infantry',
    labels: ['light_armored', 'anti_cavalry', 'vulnerable'],
    trainingBuilding: 'barracks',
    trainingBuildingLevel: 1,
    trainingTime: 60,
    cost: { ...EMPTY_RESOURCES, ore: 15, wood: 10 },
    upkeep: { ...EMPTY_RESOURCES, rations: 1 },
    stats: { attack: 20, defense: 15, speed: 6, carry: 30 },
  },

  sergeant: {
    id: 'sergeant',
    name: 'Serjeant',
    description: 'Professional foot soldier bearing a broadsword and kite shield. The reliable workhorse of any medieval host.',
    category: 'infantry',
    labels: ['light_armored', 'slashing'],
    trainingBuilding: 'barracks',
    trainingBuildingLevel: 1,
    trainingTime: 90,
    cost: { ...EMPTY_RESOURCES, iron: 30, ore: 10, wood: 5 },
    upkeep: { ...EMPTY_RESOURCES, rations: 2 },
    stats: { attack: 35, defense: 28, speed: 6, carry: 50 },
  },

  man_at_arms: {
    id: 'man_at_arms',
    name: 'Man-at-Arms',
    description: 'Elite professional warrior encased in plate armour, wielding a war-hammer or battle axe. Costly, but nearly unstoppable in close combat.',
    category: 'infantry',
    labels: ['heavy_armored', 'crushing'],
    trainingBuilding: 'barracks',
    trainingBuildingLevel: 2,
    trainingTime: 150,
    cost: { ...EMPTY_RESOURCES, iron: 60, ore: 20 },
    upkeep: { ...EMPTY_RESOURCES, rations: 3 },
    stats: { attack: 50, defense: 55, speed: 5, carry: 60 },
  },

  // ── Ranged ────────────────────────────────────────────────────────────────

  levy_archer: {
    id: 'levy_archer',
    name: 'Levy Archer',
    description: 'Conscripted bowman with a simple hunting bow and a quiver of broadhead shafts. Fragile but cheap; devastating in mass volleys.',
    category: 'ranged',
    labels: ['light_armored', 'broadhead', 'vulnerable'],
    trainingBuilding: 'barracks',
    trainingBuildingLevel: 1,
    trainingTime: 60,
    cost: { ...EMPTY_RESOURCES, wood: 15, ore: 5 },
    upkeep: { ...EMPTY_RESOURCES, rations: 1 },
    stats: { attack: 22, defense: 10, speed: 7, carry: 25 },
  },

  longbowman: {
    id: 'longbowman',
    name: 'Longbowman',
    description: 'Skilled English archer bearing a powerful yew longbow. Sustained volleys of broadhead arrows shred lightly-armoured formations.',
    category: 'ranged',
    labels: ['light_armored', 'broadhead'],
    trainingBuilding: 'barracks',
    trainingBuildingLevel: 2,
    trainingTime: 90,
    cost: { ...EMPTY_RESOURCES, iron: 20, wood: 20, ore: 10 },
    upkeep: { ...EMPTY_RESOURCES, rations: 2 },
    stats: { attack: 40, defense: 20, speed: 7, carry: 40 },
  },

  arbalestier: {
    id: 'arbalestier',
    name: 'Arbalestier',
    description: 'Armoured crossbowman whose steel-prod arbalest drives hardened quarrels through mail and plate. The bane of heavily-armoured knights.',
    category: 'ranged',
    labels: ['heavy_armored', 'piercing'],
    trainingBuilding: 'barracks',
    trainingBuildingLevel: 3,
    trainingTime: 120,
    cost: { ...EMPTY_RESOURCES, iron: 50, ore: 20, wood: 10 },
    upkeep: { ...EMPTY_RESOURCES, rations: 2, iron: 1 },
    stats: { attack: 55, defense: 35, speed: 6, carry: 35 },
  },

  // ── Cavalry ───────────────────────────────────────────────────────────────

  chevaucheur: {
    id: 'chevaucheur',
    name: 'Chevaucheur',
    description: 'Swift light horseman ideally suited to raiding and flanking manoeuvres. Overwhelms missile troops before they can loose a second volley.',
    category: 'cavalry',
    labels: ['light_armored', 'mounted', 'slashing'],
    trainingBuilding: 'stables',
    trainingBuildingLevel: 1,
    trainingTime: 180,
    cost: { ...EMPTY_RESOURCES, iron: 35, rations: 15, wood: 10 },
    upkeep: { ...EMPTY_RESOURCES, rations: 3, wood: 1 },
    stats: { attack: 55, defense: 28, speed: 14, carry: 80 },
  },

  knight: {
    id: 'knight',
    name: 'Chevalier',
    description: 'The pinnacle of medieval mounted warfare. A Chevalier in full plate aboard a destrier crushes infantry beneath iron hooves.',
    category: 'cavalry',
    labels: ['heavy_armored', 'mounted', 'crushing'],
    trainingBuilding: 'stables',
    trainingBuildingLevel: 2,
    trainingTime: 360,
    cost: { ...EMPTY_RESOURCES, iron: 120, ore: 30, rations: 20, gold: 5 },
    upkeep: { ...EMPTY_RESOURCES, rations: 5, wood: 2 },
    stats: { attack: 80, defense: 70, speed: 12, carry: 100 },
  },

  // ── Siege ─────────────────────────────────────────────────────────────────

  trebuchet: {
    id: 'trebuchet',
    name: 'Trébuchet',
    description: 'Massive counterweight siege engine. Agonisingly slow and fragile in the open, yet its heavy stone shot can collapse towers and breach the thickest walls.',
    category: 'siege',
    labels: ['vulnerable'],
    trainingBuilding: 'siege_workshop',
    trainingBuildingLevel: 1,
    trainingTime: 480,
    cost: { ...EMPTY_RESOURCES, wood: 100, ore: 80, iron: 40 },
    upkeep: { ...EMPTY_RESOURCES, rations: 3, wood: 2 },
    stats: { attack: 120, defense: 8, speed: 3, carry: 0 },
  },

  // ── Neutral enemies (not trainable by players) ─────────────────────────────

  bandit: {
    id: 'bandit',
    name: 'Bandit',
    description: 'Desperate outlaw scraping a living from ambush and robbery. Poorly armed but numerous, they swarm the open plains.',
    category: 'infantry',
    labels: ['light_armored', 'vulnerable', 'slashing'],
    stats: { attack: 18, defense: 12, speed: 5, carry: 0 },
    neutral: true,
  },

  deserter: {
    id: 'deserter',
    name: 'Deserter',
    description: 'Hardened veteran who abandoned their lord’s banner. Retains battlefield training, making them far more dangerous than common rabble.',
    category: 'infantry',
    labels: ['light_armored', 'slashing'],
    stats: { attack: 30, defense: 22, speed: 5, carry: 0 },
    neutral: true,
  },

  raider: {
    id: 'raider',
    name: 'Raider',
    description: 'Swift mounted marauder who preys on weakly-guarded settlements. Strikes fast and withdraws before a defence can form.',
    category: 'cavalry',
    labels: ['light_armored', 'mounted', 'slashing'],
    stats: { attack: 40, defense: 18, speed: 10, carry: 0 },
    neutral: true,
  },

  ruin_guardian: {
    id: 'ruin_guardian',
    name: 'Ruin Guardian',
    description: 'Ancient sentinel bound to the ruins it inhabits. Encased in corroded plate, it fights with relentless crushing blows and yields ground only when destroyed.',
    category: 'infantry',
    labels: ['heavy_armored', 'crushing'],
    stats: { attack: 55, defense: 48, speed: 4, carry: 0 },
    neutral: true,
  },
};

/** All player-trainable units (excludes neutral enemies). */
export const UNIT_LIST = Object.values(UNITS).filter((u) => !u.neutral);

/** All neutral enemy units. */
export const NEUTRAL_UNIT_LIST = Object.values(UNITS).filter((u) => u.neutral === true);
