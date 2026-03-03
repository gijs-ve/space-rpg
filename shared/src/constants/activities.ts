import { ResourceRewardRange } from './resources';
import { SkillId } from './skills';

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
    rewards: {
      xpRange: [40, 80],
      resources: {
        ore:    [25, 55],
        alloys: [10, 30],
      },
      skillXp: { gathering: 12, endurance: 5 },
    },
  },

  survey_derelict: {
    id: 'survey_derelict',
    name: 'Survey Derelict',
    description: 'Explore an abandoned wreck for advanced components and rare finds.',
    durationRange: [600, 1200],   // 10–20 min
    energyCost: 25,
    heroLevelRequirement: 3,
    rewards: {
      xpRange: [80, 160],
      resources: {
        ore:     [20, 45],
        alloys:  [15, 35],
        iridium: [2, 8],
      },
      skillXp: { gathering: 15, tactics: 10 },
    },
  },

  recon_mission: {
    id: 'recon_mission',
    name: 'Recon Mission',
    description: 'Deep-space scouting run to chart new sectors. Returns fuel signatures.',
    durationRange: [900, 1800],   // 15–30 min
    energyCost: 35,
    heroLevelRequirement: 4,
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
    rewards: {
      xpRange: [250, 500],
      resources: {
        fuel:    [30, 70],
        alloys:  [20, 50],
        iridium: [5, 15],
      },
      skillXp: { combat: 40, leadership: 20, tactics: 20 },
    },
  },

  deep_space_survey: {
    id: 'deep_space_survey',
    name: 'Deep Space Survey',
    description: 'A long-haul expedition into uncharted territory. Exceptional iridium yields.',
    durationRange: [3600, 7200],  // 60–120 min
    energyCost: 70,
    heroLevelRequirement: 7,
    rewards: {
      xpRange: [500, 1000],
      resources: {
        ore:     [40, 90],
        alloys:  [20, 60],
        fuel:    [20, 50],
        iridium: [10, 30],
      },
      skillXp: { gathering: 30, tactics: 25, leadership: 15 },
    },
  },
};

export const ACTIVITY_LIST = Object.values(ACTIVITIES);
