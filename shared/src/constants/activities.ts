import { ResourceRewardRange } from './resources';
import { SkillId } from './skills';
import { LootTable } from './items';

export type ActivityType =
  | 'patrol'
  | 'salvage_field'
  | 'survey_derelict'
  | 'recon_mission'
  | 'assault_outpost'
  | 'deep_space_survey';

export interface ActivityRewards {
  xpRange: [number, number];
  /**
   * Per-resource reward range [min, max].
   * The server rolls a random value in this range for each resource.
   * Tweak these to balance the economy without touching resolver logic.
   */
  resources: ResourceRewardRange;
  skillXp: Partial<Record<SkillId, number>>;
}

export interface ActivityDef {
  id: ActivityType;
  name: string;
  description: string;
  /** Duration range in seconds [min, max] */
  durationRange: [number, number];
  energyCost: number;
  rewards: ActivityRewards;
  heroLevelRequirement: number;
  /** Items that can drop when this activity completes */
  lootTable: LootTable;
  /**
   * Raw (pre-mitigation) health damage the hero can take from this activity [min, max].
   * Actual damage on the server is a random roll in this range,
   * then reduced by the hero's defence stat.
   * The client uses this range + the hero's current defence to display
   * the personalised min/max damage preview.
   */
  baseDamageRange: [number, number];
}

// ─────────────────────────────────────────────────────────────────────────────
// REWARD RANGES
// Each resource entry is [min, max]. Change these to rebalance drop rates.
// ─────────────────────────────────────────────────────────────────────────────
export const ACTIVITIES: Record<ActivityType, ActivityDef> = {
  patrol: {
    id: 'patrol',
    name: 'Patrol Sector',
    description: 'A quick sweep of nearby space lanes. Safe but low yield.',
    durationRange: [120, 300],    // 2–5 min
    energyCost: 10,
    heroLevelRequirement: 1,
    baseDamageRange: [0, 8],
    lootTable: [
      { itemId: 'medkit',       chance: 0.35 },
      { itemId: 'power_cell',   chance: 0.20 },
      { itemId: 'plasma_pistol',chance: 0.08 },
    ],
    rewards: {
      xpRange: [20, 50],
      resources: {
        rations: [20, 40],
        water:   [10, 20],
      },
      skillXp: { combat: 8, endurance: 5 },
    },
  },

  salvage_field: {
    id: 'salvage_field',
    name: 'Salvage Field',
    description: 'Scavenge a debris field for usable materials. Quick and moderately rewarding.',
    durationRange: [300, 600],    // 5–10 min
    energyCost: 15,
    heroLevelRequirement: 2,
    baseDamageRange: [3, 15],
    lootTable: [
      { itemId: 'medkit',        chance: 0.25 },
      { itemId: 'power_cell',    chance: 0.30 },
      { itemId: 'nav_module',    chance: 0.12 },
      { itemId: 'utility_pants', chance: 0.06 },
    ],
    rewards: {
      xpRange: [40, 80],
      resources: {
        ore:    [25, 55],
        alloys: [10, 30],
      },
      skillXp: { observation: 12, endurance: 5 },
    },
  },

  survey_derelict: {
    id: 'survey_derelict',
    name: 'Survey Derelict',
    description: 'Explore an abandoned wreck for advanced components and rare finds.',
    durationRange: [600, 1200],   // 10–20 min
    energyCost: 25,
    heroLevelRequirement: 3,
    baseDamageRange: [8, 25],
    lootTable: [
      { itemId: 'scout_helmet',   chance: 0.12 },
      { itemId: 'combat_vest',    chance: 0.08 },
      { itemId: 'cpu_chip',       chance: 0.06 },
      { itemId: 'nav_module',     chance: 0.15 },
      { itemId: 'stim_pack',      chance: 0.20 },
    ],
    rewards: {
      xpRange: [80, 160],
      resources: {
        ore:     [20, 45],
        alloys:  [15, 35],
        iridium: [2, 8],
      },
      skillXp: { observation: 15, tactics: 10 },
    },
  },

  recon_mission: {
    id: 'recon_mission',
    name: 'Recon Mission',
    description: 'Deep-space scouting run to chart new sectors. Returns fuel signatures.',
    durationRange: [900, 1800],   // 15–30 min
    energyCost: 35,
    heroLevelRequirement: 4,
    baseDamageRange: [15, 35],
    lootTable: [
      { itemId: 'tactical_visor', chance: 0.10 },
      { itemId: 'pulse_rifle',    chance: 0.10 },
      { itemId: 'nav_module',     chance: 0.20 },
      { itemId: 'cpu_chip',       chance: 0.08 },
    ],
    rewards: {
      xpRange: [120, 220],
      resources: {
        fuel:    [20, 45],
        iridium: [1, 5],
      },
      skillXp: { tactics: 20, endurance: 10 },
    },
  },

  assault_outpost: {
    id: 'assault_outpost',
    name: 'Assault Outpost',
    description: 'Storm a hostile outpost. High risk, but rich in fuel and iridium.',
    durationRange: [1800, 3600],  // 30–60 min
    energyCost: 50,
    heroLevelRequirement: 5,
    baseDamageRange: [25, 55],
    lootTable: [
      { itemId: 'reactive_plate',  chance: 0.12 },
      { itemId: 'armored_greaves', chance: 0.12 },
      { itemId: 'pulse_rifle',     chance: 0.15 },
      { itemId: 'cpu_chip',        chance: 0.10 },
      { itemId: 'stim_pack',       chance: 0.25 },
    ],
    rewards: {
      xpRange: [250, 500],
      resources: {
        fuel:    [30, 70],
        alloys:  [20, 50],
        iridium: [5, 15],
      },
      skillXp: { combat: 40, navigation: 20, tactics: 20 },
    },
  },

  deep_space_survey: {
    id: 'deep_space_survey',
    name: 'Deep Space Survey',
    description: 'A long-haul expedition into uncharted territory. Exceptional iridium yields.',
    durationRange: [3600, 7200],  // 60–120 min
    energyCost: 70,
    heroLevelRequirement: 7,
    baseDamageRange: [20, 45],
    lootTable: [
      { itemId: 'ion_cannon',      chance: 0.08 },
      { itemId: 'tactical_visor',  chance: 0.12 },
      { itemId: 'reactive_plate',  chance: 0.12 },
      { itemId: 'armored_greaves', chance: 0.12 },
      { itemId: 'cpu_chip',        chance: 0.18 },
    ],
    rewards: {
      xpRange: [500, 1000],
      resources: {
        ore:     [40, 90],
        alloys:  [20, 60],
        fuel:    [20, 50],
        iridium: [10, 30],
      },
      skillXp: { observation: 30, tactics: 25, navigation: 15 },
    },
  },
};

export const ACTIVITY_LIST = Object.values(ACTIVITIES);
