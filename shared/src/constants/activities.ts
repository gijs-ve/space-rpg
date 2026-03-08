import { ResourceRewardRange } from './resources';
import { SkillId } from './skills';
import { ItemId } from './items';
import { LootSlot } from './drop_tables';

// ─────────────────────────────────────────────────────────────────────────────
// Activity types
// ─────────────────────────────────────────────────────────────────────────────

/** General (hero-level gated) adventures */
type GeneralActivityType =
  | 'patrol'
  | 'scavenge_ruins'
  | 'scavenge_ruins_advanced'
  | 'scout_territory'
  | 'scout_territory_advanced'
  | 'storm_outpost'
  | 'grand_campaign';

/** Combat skill-gated adventures */
type CombatActivityType =
  | 'dueling_ring'
  | 'bandit_ambush'
  | 'enemy_raid'
  | 'champions_trial';

/** Endurance skill-gated adventures */
type EnduranceActivityType =
  | 'forced_march'
  | 'desert_crossing'
  | 'mountain_expedition';

/** Observation (Scouting) skill-gated adventures */
type ObservationActivityType =
  | 'track_quarry'
  | 'ancient_library'
  | 'forbidden_ruins';

/** Navigation (Logistics) skill-gated adventures */
type NavigationActivityType =
  | 'supply_run'
  | 'trade_route_survey'
  | 'diplomatic_mission';

/** Tactics skill-gated adventures */
type TacticsActivityType =
  | 'war_games'
  | 'siege_planning'
  | 'guerrilla_campaign';

export type HeroActivityType =
  | GeneralActivityType
  | CombatActivityType
  | EnduranceActivityType
  | ObservationActivityType
  | NavigationActivityType
  | TacticsActivityType;

export type ActivityType =
  | HeroActivityType
  // ── Player vs player combat reports ──────────────────────────────────────────────────────────────
  | 'player_attack'
  | 'player_defence'
  // ── Garrison / domain battle reports ─────────────────────────────────────────────────────────────
  | 'domain_claim'            // attacker who sent the claim march
  | 'domain_claim_defence'    // the defender whose garrison was attacked during a claim
  | 'domain_contest'          // attacker who sent the contest march
  | 'domain_contest_defence'; // the defender whose garrison was attacked during a contest

// ─────────────────────────────────────────────────────────────────────────────
// Activity definition
// ─────────────────────────────────────────────────────────────────────────────

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

/** A consumable item the hero must have in their inventory to start this adventure.
 *  The item is removed from the hero's inventory when the adventure returns. */
export interface ItemRequirement {
  itemId: ItemId;
  /** How many to consume. Defaults to 1. */
  quantity?: number;
}

export interface ActivityDef {
  id: HeroActivityType;
  name: string;
  description: string;
  /** Duration range in seconds [min, max] */
  durationRange: [number, number];
  energyCost: number;
  rewards: ActivityRewards;
  /** Minimum hero level required. */
  heroLevelRequirement: number;
  /**
   * Skill levels the hero must have to unlock this adventure.
   * Adventures locked behind skill levels are grouped in that skill's tab.
   */
  skillRequirements?: Partial<Record<SkillId, number>>;
  /**
   * Items that are consumed from the hero's inventory (not equipment slots)
   * when the adventure completes.  The server validates presence before start.
   */
  itemRequirements?: ItemRequirement[];
  /**
   * One or more loot slots.  Each slot rolls independently against a named drop table.
   * See shared/src/constants/drop_tables.ts to add or edit tables.
   */
  lootSlots: LootSlot[];
  /**
   * Raw (pre-mitigation) health damage the hero can take from this activity [min, max].
   * Actual damage on the server is a random roll in this range,
   * then reduced by the hero's defence stat.
   * The client uses this range + the hero's current defence to display
   * the personalised min/max damage preview.
   */
  baseDamageRange: [number, number];
  /**
   * Which UI tab this adventure belongs to.
   * 'general' → the Expeditions tab (hero-level gated); a SkillId → that skill's tab.
   */
  skillTab: SkillId | 'general';
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERAL (Expeditions) — hero-level gated
// ─────────────────────────────────────────────────────────────────────────────
const GENERAL_ACTIVITIES: Record<GeneralActivityType, ActivityDef> = {
  patrol: {
    id: 'patrol',
    name: 'Patrol Roads',
    description: 'A quick sweep of nearby roads and fields. Safe but low yield.',
    durationRange: [120, 140],    // 2–5 min
    energyCost: 10,
    heroLevelRequirement: 1,
    skillTab: 'general',
    baseDamageRange: [0, 8],
    lootSlots: [
      { tableId: 'consumable_basic' },
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
    durationRange: [300, 360],    // 5–6 min
    energyCost: 15,
    heroLevelRequirement: 2,
    skillTab: 'general',
    baseDamageRange: [3, 15],
    lootSlots: [
      { tableId: 'consumable_basic' },
      { tableId: 'equip_copper' },
    ],
    rewards: {
      xpRange: [40, 80],
      resources: {
        water:  [25, 55],
        iron: [10, 30],
      },
      skillXp: { observation: 12, endurance: 5 },
    },
  },

  scout_territory: {
    id: 'scout_territory',
    name: 'Scout Territory',
    description: 'Long-range scouting run to chart neighbouring regions. Returns wood and intelligence.',
    durationRange: [300, 360],    // 5–6 min
    energyCost: 15,
    heroLevelRequirement: 2,
    skillTab: 'general',
    baseDamageRange: [3, 15],
    lootSlots: [
      { tableId: 'consumable_basic' },
      { tableId: 'equip_copper' },
    ],
    rewards: {
      xpRange: [40, 80],
      resources: {
        water:  [25, 55],
        wood: [10, 30],
      },
      skillXp: { navigation: 12, endurance: 5 },
    },
  },

  scavenge_ruins_advanced: {
    id: 'scavenge_ruins_advanced',
    name: 'Scavenge Roman Ruins',
    description: 'Venture deep into an abandoned fortification for rare components and artefacts.',
    durationRange: [720, 1200],   // 12–20 min
    energyCost: 25,
    heroLevelRequirement: 4,
    skillTab: 'general',
    baseDamageRange: [8, 25],
    lootSlots: [
      { tableId: 'consumable_utility' },
      { tableId: 'equip_bronze' },
    ],
    rewards: {
      xpRange: [80, 160],
      resources: {
        ore:  [20, 45],
        iron: [15, 35],
        gold: [2, 8],
      },
      skillXp: { observation: 15, tactics: 10 },
    },
  },

  scout_territory_advanced: {
    id: 'scout_territory_advanced',
    name: 'Scout Territory',
    description: 'Long-range scouting run to chart neighbouring regions. Returns wood and intelligence.',
    durationRange: [720, 1200],   // 12–20 min
    energyCost: 25,
    heroLevelRequirement: 4,
    skillTab: 'general',
    baseDamageRange: [8, 25],
    lootSlots: [
      { tableId: 'consumable_utility' },
      { tableId: 'equip_bronze' },
    ],
    rewards: {
      xpRange: [80, 160],
      resources: {
        ore:  [20, 45],
        iron: [15, 35],
        gold: [2, 8],
      },
      skillXp: { observation: 15, tactics: 10 },
    },
  },

  storm_outpost: {
    id: 'storm_outpost',
    name: 'Storm Outpost',
    description: 'Attack a hostile outpost. High risk, but rich in wood and gold.',
    durationRange: [1800, 3600],  // 30–60 min
    energyCost: 50,
    heroLevelRequirement: 5,
    skillTab: 'general',
    baseDamageRange: [25, 55],
    lootSlots: [
      { tableId: 'consumable_combat' },
      { tableId: 'equip_iron' },
    ],
    rewards: {
      xpRange: [250, 500],
      resources: {
        wood: [30, 70],
        iron: [20, 50],
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
    skillTab: 'general',
    baseDamageRange: [20, 45],
    lootSlots: [
      { tableId: 'consumable_utility' },
      { tableId: 'equip_iron' },
      { tableId: 'equip_steel' },
    ],
    rewards: {
      xpRange: [500, 1000],
      resources: {
        ore:  [40, 90],
        iron: [20, 60],
        wood: [20, 50],
        gold: [10, 30],
      },
      skillXp: { observation: 30, tactics: 25, navigation: 15 },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT skill-gated adventures
// ─────────────────────────────────────────────────────────────────────────────
const COMBAT_ACTIVITIES: Record<CombatActivityType, ActivityDef> = {
  dueling_ring: {
    id: 'dueling_ring',
    name: 'Dueling Ring',
    description: 'Spar in a supervised ring against skilled opponents. Great for honing blade work.',
    durationRange: [300, 600],   // 5–10 min
    energyCost: 20,
    heroLevelRequirement: 1,
    skillRequirements: { combat: 3 },
    skillTab: 'combat',
    baseDamageRange: [8, 28],
    lootSlots: [
      { tableId: 'consumable_combat' },
    ],
    rewards: {
      xpRange: [80, 150],
      resources: { rations: [3, 8] },
      skillXp: { combat: 40, endurance: 10 },
    },
  },

  bandit_ambush: {
    id: 'bandit_ambush',
    name: 'Bandit Ambush',
    description: 'Hunt down a bandit group harassing the trade roads. Dangerous but profitable.',
    durationRange: [1200, 2400], // 20–40 min
    energyCost: 35,
    heroLevelRequirement: 3,
    skillRequirements: { combat: 5 },
    skillTab: 'combat',
    baseDamageRange: [18, 42],
    lootSlots: [
      { tableId: 'consumable_combat' },
      { tableId: 'equip_copper' },
    ],
    rewards: {
      xpRange: [160, 290],
      resources: {
        gold:    [2, 6],
        rations: [5, 12],
      },
      skillXp: { combat: 70, endurance: 20 },
    },
  },

  enemy_raid: {
    id: 'enemy_raid',
    name: 'Enemy Raid',
    description: 'Repel a major enemy incursion. Steel your nerves — the fighting is fierce.',
    durationRange: [2700, 5400], // 45–90 min
    energyCost: 50,
    heroLevelRequirement: 5,
    skillRequirements: { combat: 8 },
    skillTab: 'combat',
    baseDamageRange: [28, 58],
    lootSlots: [
      { tableId: 'consumable_combat' },
      { tableId: 'equip_iron' },
    ],
    rewards: {
      xpRange: [300, 600],
      resources: {
        gold: [4, 10],
        ore:  [8, 18],
      },
      skillXp: { combat: 120, endurance: 30 },
    },
  },

  champions_trial: {
    id: 'champions_trial',
    name: "Champion's Trial",
    description: 'Face an elite warrior in a legendary duel. You will need a War Draught to survive the punishment.',
    durationRange: [1800, 3600], // 30–60 min
    energyCost: 45,
    heroLevelRequirement: 5,
    skillRequirements: { combat: 12 },
    itemRequirements: [{ itemId: 'war_draught', quantity: 1 }],
    skillTab: 'combat',
    baseDamageRange: [38, 75],
    lootSlots: [
      { tableId: 'consumable_combat' },
      { tableId: 'equip_iron' },
    ],
    rewards: {
      xpRange: [500, 950],
      resources: { gold: [8, 18] },
      skillXp: { combat: 200, tactics: 50 },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ENDURANCE skill-gated adventures
// ─────────────────────────────────────────────────────────────────────────────
const ENDURANCE_ACTIVITIES: Record<EnduranceActivityType, ActivityDef> = {
  forced_march: {
    id: 'forced_march',
    name: 'Forced March',
    description: 'Push through gruelling terrain at speed for days on end. Tests every muscle.',
    durationRange: [1800, 3600], // 30–60 min
    energyCost: 30,
    heroLevelRequirement: 1,
    skillRequirements: { endurance: 3 },
    skillTab: 'endurance',
    baseDamageRange: [5, 18],
    lootSlots: [
      { tableId: 'consumable_basic' },
    ],
    rewards: {
      xpRange: [80, 155],
      resources: {
        rations: [8, 18],
        water:   [6, 14],
      },
      skillXp: { endurance: 50, navigation: 10 },
    },
  },

  desert_crossing: {
    id: 'desert_crossing',
    name: 'Desert Crossing',
    description: 'Cross an unforgiving desert expanse. An Herbal Poultice is essential against heat exhaustion.',
    durationRange: [3600, 7200], // 60–120 min
    energyCost: 45,
    heroLevelRequirement: 3,
    skillRequirements: { endurance: 5 },
    itemRequirements: [{ itemId: 'herbal_poultice', quantity: 1 }],
    skillTab: 'endurance',
    baseDamageRange: [12, 32],
    lootSlots: [
      { tableId: 'consumable_basic' },
      { tableId: 'consumable_utility' },
    ],
    rewards: {
      xpRange: [190, 340],
      resources: {
        ore:     [10, 22],
        rations: [6, 14],
      },
      skillXp: { endurance: 90, observation: 20 },
    },
  },

  mountain_expedition: {
    id: 'mountain_expedition',
    name: 'Mountain Expedition',
    description: 'Scale treacherous peaks and valleys to reach isolated mineral deposits.',
    durationRange: [7200, 14400], // 120–240 min
    energyCost: 65,
    heroLevelRequirement: 5,
    skillRequirements: { endurance: 8 },
    skillTab: 'endurance',
    baseDamageRange: [18, 42],
    lootSlots: [
      { tableId: 'consumable_basic' },
      { tableId: 'equip_bronze' },
    ],
    rewards: {
      xpRange: [430, 790],
      resources: {
        ore:  [12, 28],
        wood: [8, 20],
        gold: [2, 6],
      },
      skillXp: { endurance: 150, navigation: 40, observation: 30 },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// OBSERVATION (Scouting) skill-gated adventures
// ─────────────────────────────────────────────────────────────────────────────
const OBSERVATION_ACTIVITIES: Record<ObservationActivityType, ActivityDef> = {
  track_quarry: {
    id: 'track_quarry',
    name: 'Track Quarry',
    description: 'Follow fresh tracks through the wilderness to locate hidden resource caches.',
    durationRange: [900, 1800],  // 15–30 min
    energyCost: 20,
    heroLevelRequirement: 1,
    skillRequirements: { observation: 3 },
    skillTab: 'observation',
    baseDamageRange: [3, 14],
    lootSlots: [
      { tableId: 'consumable_utility' },
      { tableId: 'consumable_basic' },
    ],
    rewards: {
      xpRange: [60, 115],
      resources: {
        water: [6, 14],
        wood:  [5, 12],
      },
      skillXp: { observation: 45, tactics: 10 },
    },
  },

  ancient_library: {
    id: 'ancient_library',
    name: 'Ancient Library',
    description: "Decipher a recovered library's manuscripts. A Scholar's Tome is required to interpret the scripts.",
    durationRange: [1800, 3600], // 30–60 min
    energyCost: 25,
    heroLevelRequirement: 2,
    skillRequirements: { observation: 5 },
    itemRequirements: [{ itemId: 'scholars_tome', quantity: 1 }],
    skillTab: 'observation',
    baseDamageRange: [0, 8],
    lootSlots: [
      { tableId: 'consumable_utility' },
      { tableId: 'consumable_utility' },
    ],
    rewards: {
      xpRange: [160, 300],
      resources: { gold: [1, 4] },
      skillXp: { observation: 100, navigation: 30 },
    },
  },

  forbidden_ruins: {
    id: 'forbidden_ruins',
    name: 'Forbidden Ruins',
    description: 'Infiltrate heavily guarded ruins said to conceal ancient riches and powerful relics.',
    durationRange: [3600, 7200], // 60–120 min
    energyCost: 45,
    heroLevelRequirement: 4,
    skillRequirements: { observation: 8 },
    skillTab: 'observation',
    baseDamageRange: [15, 38],
    lootSlots: [
      { tableId: 'consumable_utility' },
      { tableId: 'equip_bronze' },
    ],
    rewards: {
      xpRange: [320, 580],
      resources: {
        ore:  [8, 18],
        iron: [5, 12],
        gold: [2, 6],
      },
      skillXp: { observation: 160, tactics: 40 },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION (Logistics) skill-gated adventures
// ─────────────────────────────────────────────────────────────────────────────
const NAVIGATION_ACTIVITIES: Record<NavigationActivityType, ActivityDef> = {
  supply_run: {
    id: 'supply_run',
    name: 'Supply Run',
    description: 'Organise and execute a bulk supply run for the army. Efficient logistics builds the reputation.',
    durationRange: [1200, 2400], // 20–40 min
    energyCost: 25,
    heroLevelRequirement: 1,
    skillRequirements: { navigation: 3 },
    skillTab: 'navigation',
    baseDamageRange: [3, 12],
    lootSlots: [
      { tableId: 'consumable_basic' },
    ],
    rewards: {
      xpRange: [70, 135],
      resources: {
        rations: [10, 22],
        water:   [8, 16],
        wood:    [5, 10],
      },
      skillXp: { navigation: 45, endurance: 15 },
    },
  },

  trade_route_survey: {
    id: 'trade_route_survey',
    name: 'Trade Route Survey',
    description: "Chart new trade routes through hostile territory. Bring a Surveyor's Map to speed up the work.",
    durationRange: [2700, 5400], // 45–90 min
    energyCost: 38,
    heroLevelRequirement: 3,
    skillRequirements: { navigation: 5 },
    itemRequirements: [{ itemId: 'surveyors_map', quantity: 1 }],
    skillTab: 'navigation',
    baseDamageRange: [5, 18],
    lootSlots: [
      { tableId: 'consumable_utility' },
      { tableId: 'consumable_basic' },
    ],
    rewards: {
      xpRange: [210, 400],
      resources: {
        gold: [3, 8],
        wood: [8, 18],
      },
      skillXp: { navigation: 100, observation: 30, tactics: 20 },
    },
  },

  diplomatic_mission: {
    id: 'diplomatic_mission',
    name: 'Diplomatic Mission',
    description: 'Navigate intricate political negotiations to secure trade agreements and alliances.',
    durationRange: [5400, 10800], // 90–180 min
    energyCost: 55,
    heroLevelRequirement: 5,
    skillRequirements: { navigation: 8 },
    skillTab: 'navigation',
    baseDamageRange: [0, 14],
    lootSlots: [
      { tableId: 'consumable_utility' },
      { tableId: 'consumable_utility' },
    ],
    rewards: {
      xpRange: [430, 760],
      resources: { gold: [6, 16] },
      skillXp: { navigation: 160, tactics: 60 },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TACTICS skill-gated adventures
// ─────────────────────────────────────────────────────────────────────────────
const TACTICS_ACTIVITIES: Record<TacticsActivityType, ActivityDef> = {
  war_games: {
    id: 'war_games',
    name: 'War Games',
    description: 'Run a week-long tactical exercise to sharpen strategic instincts.',
    durationRange: [1200, 2400], // 20–40 min
    energyCost: 25,
    heroLevelRequirement: 1,
    skillRequirements: { tactics: 3 },
    skillTab: 'tactics',
    baseDamageRange: [5, 18],
    lootSlots: [
      { tableId: 'consumable_basic' },
    ],
    rewards: {
      xpRange: [70, 135],
      resources: { rations: [4, 10] },
      skillXp: { tactics: 45, combat: 15 },
    },
  },

  siege_planning: {
    id: 'siege_planning',
    name: 'Siege Planning',
    description: 'Develop a siege strategy and rehearse it with your commanders.',
    durationRange: [2700, 5400], // 45–90 min
    energyCost: 38,
    heroLevelRequirement: 3,
    skillRequirements: { tactics: 5 },
    skillTab: 'tactics',
    baseDamageRange: [5, 15],
    lootSlots: [
      { tableId: 'consumable_utility' },
      { tableId: 'equip_copper' },
    ],
    rewards: {
      xpRange: [210, 390],
      resources: {
        wood: [6, 14],
        ore:  [5, 12],
        iron: [3, 8],
      },
      skillXp: { tactics: 100, navigation: 40 },
    },
  },

  guerrilla_campaign: {
    id: 'guerrilla_campaign',
    name: 'Guerrilla Campaign',
    description: 'Execute a swift lightning raid deep into enemy lines. A War Draught will help you endure the pace.',
    durationRange: [3600, 7200], // 60–120 min
    energyCost: 55,
    heroLevelRequirement: 5,
    skillRequirements: { tactics: 8 },
    itemRequirements: [{ itemId: 'war_draught', quantity: 1 }],
    skillTab: 'tactics',
    baseDamageRange: [28, 62],
    lootSlots: [
      { tableId: 'consumable_combat' },
      { tableId: 'equip_iron' },
    ],
    rewards: {
      xpRange: [430, 740],
      resources: {
        wood: [10, 22],
        gold: [4, 10],
        iron: [6, 14],
      },
      skillXp: { tactics: 160, combat: 80 },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Combined lookup map
// ─────────────────────────────────────────────────────────────────────────────
export const ACTIVITIES: Record<HeroActivityType, ActivityDef> = {
  ...GENERAL_ACTIVITIES,
  ...COMBAT_ACTIVITIES,
  ...ENDURANCE_ACTIVITIES,
  ...OBSERVATION_ACTIVITIES,
  ...NAVIGATION_ACTIVITIES,
  ...TACTICS_ACTIVITIES,
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
  player_attack:           'Battle Report',
  player_defence:          'Defence Report',
  // ── garrison / domain battle reports ─────────────────────────────────────
  domain_claim:            'Garrison Battle',
  domain_claim_defence:    'Garrison Defended',
  domain_contest:          'Contest Battle',
  domain_contest_defence:  'Garrison Defended',
};
