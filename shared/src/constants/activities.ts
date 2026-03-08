import { ResourceRewardRange } from './resources';
import { SkillId } from './skills';
import { LootTable } from './items';

export type HeroActivityType =
  | 'patrol'
  | 'scavenge_ruins'
  | 'explore_ruins'
  | 'scout_territory'
  | 'storm_outpost'
  | 'grand_campaign';

export type ActivityType =
  | HeroActivityType
  // ── Player vs player combat reports ──────────────────────────────────────────────────────────────
  | 'player_attack'
  | 'player_defence';

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
export const ACTIVITIES: Record<HeroActivityType, ActivityDef> = {
  patrol: {
    id: 'patrol',
    name: 'Patrol Roads',
    description: 'A quick sweep of nearby roads and fields. Safe but low yield.',
    durationRange: [120, 300],    // 2–5 min
    energyCost: 10,
    heroLevelRequirement: 1,
    baseDamageRange: [0, 8],
    lootTable: [
      { itemId: 'herbal_poultice',        chance: 0.35 },
      { itemId: 'holy_relic',    chance: 0.20 },
      { itemId: 'copper_dagger', chance: 0.08 },
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

  scavenge_ruins: {
    id: 'scavenge_ruins',
    name: 'Scavenge Ruins',
    description: 'Pick through old ruins for usable materials. Quick and moderately rewarding.',
    durationRange: [300, 600],    // 5–10 min
    energyCost: 15,
    heroLevelRequirement: 2,
    baseDamageRange: [3, 15],
    lootTable: [
      { itemId: 'herbal_poultice',          chance: 0.25 },
      { itemId: 'holy_relic',      chance: 0.30 },
      { itemId: 'surveyors_map',      chance: 0.12 },
      { itemId: 'copper_greaves',  chance: 0.06 },
    ],
    rewards: {
      xpRange: [40, 80],
      resources: {
        ore:    [25, 55],
        iron: [10, 30],
      },
      skillXp: { observation: 12, endurance: 5 },
    },
  },

  explore_ruins: {
    id: 'explore_ruins',
    name: 'Explore Ruins',
    description: 'Venture deep into an abandoned fortification for rare components and artefacts.',
    durationRange: [600, 1200],   // 10–20 min
    energyCost: 25,
    heroLevelRequirement: 3,
    baseDamageRange: [8, 25],
    lootTable: [
      { itemId: 'bronze_helm',     chance: 0.12 },
      { itemId: 'bronze_hauberk',  chance: 0.08 },
      { itemId: 'scholars_tome',        chance: 0.06 },
      { itemId: 'surveyors_map',      chance: 0.15 },
      { itemId: 'war_draught',       chance: 0.20 },
    ],
    rewards: {
      xpRange: [80, 160],
      resources: {
        ore:     [20, 45],
        iron:  [15, 35],
        gold: [2, 8],
      },
      skillXp: { observation: 15, tactics: 10 },
    },
  },

  scout_territory: {
    id: 'scout_territory',
    name: 'Scout Territory',
    description: 'Long-range scouting run to chart neighbouring regions. Returns wood and intelligence.',
    durationRange: [900, 1800],   // 15–30 min
    energyCost: 35,
    heroLevelRequirement: 4,
    baseDamageRange: [15, 35],
    lootTable: [
      { itemId: 'iron_sword',   chance: 0.10 },
      { itemId: 'iron_bow',     chance: 0.10 },
      { itemId: 'surveyors_map',   chance: 0.20 },
      { itemId: 'scholars_tome',     chance: 0.08 },
    ],
    rewards: {
      xpRange: [120, 220],
      resources: {
        wood:    [20, 45],
        gold: [1, 5],
      },
      skillXp: { tactics: 20, endurance: 10 },
    },
  },

  storm_outpost: {
    id: 'storm_outpost',
    name: 'Storm Outpost',
    description: 'Attack a hostile outpost. High risk, but rich in wood and gold.',
    durationRange: [1800, 3600],  // 30–60 min
    energyCost: 50,
    heroLevelRequirement: 5,
    baseDamageRange: [25, 55],
    lootTable: [
      { itemId: 'iron_plate',      chance: 0.12 },
      { itemId: 'iron_greaves',    chance: 0.12 },
      { itemId: 'iron_warhammer',  chance: 0.15 },
      { itemId: 'scholars_tome',        chance: 0.10 },
      { itemId: 'war_draught',       chance: 0.25 },
    ],
    rewards: {
      xpRange: [250, 500],
      resources: {
        wood:    [30, 70],
        iron:  [20, 50],
        gold: [5, 15],
      },
      skillXp: { combat: 40, navigation: 20, tactics: 20 },
    },
  },

  grand_campaign: {
    id: 'grand_campaign',
    name: 'Grand Campaign',
    description: 'A long expedition deep into contested lands. Exceptional gem yields.',
    durationRange: [3600, 7200],  // 60–120 min
    energyCost: 70,
    heroLevelRequirement: 7,
    baseDamageRange: [20, 45],
    lootTable: [
      { itemId: 'steel_sword',     chance: 0.08 },
      { itemId: 'steel_helm',      chance: 0.12 },
      { itemId: 'steel_fullplate', chance: 0.12 },
      { itemId: 'steel_greaves',   chance: 0.12 },
      { itemId: 'scholars_tome',        chance: 0.18 },
    ],
    rewards: {
      xpRange: [500, 1000],
      resources: {
        ore:     [40, 90],
        iron:  [20, 60],
        wood:    [20, 50],
        gold: [10, 30],
      },
      skillXp: { observation: 30, tactics: 25, navigation: 15 },
    },
  },
};

export const ACTIVITY_LIST = Object.values(ACTIVITIES) as ActivityDef[];

/**
 * Human-readable name for any activityType string (game activities + market
 * system events created by market.service.ts).
 */
export const ACTIVITY_NAMES: Record<string, string> = {
  // ── game activities ────────────────────────────────────────────────────────
  ...Object.fromEntries(Object.values(ACTIVITIES).map((a) => [a.id, a.name])),
  // ── market system events ───────────────────────────────────────────────────
  market_purchase:  'Market Purchase',
  market_sale:      'Market Sale',
  market_refund:    'Market Refund',
  market_cancelled: 'Listing Cancelled',
  // ── pvp combat reports ────────────────────────────────────────────────────
  player_attack:  'Battle Report',
  player_defence: 'Defence Report',
};
