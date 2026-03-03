import { ResourceMap, EMPTY_RESOURCES } from './resources';
import { SkillId } from './skills';

export type ActivityType = 'adventure_hunt' | 'adventure_explore' | 'adventure_raid';

export interface ActivityRewards {
  xpRange: [number, number];
  resources: Partial<ResourceMap>;
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

export const ACTIVITIES: Record<ActivityType, ActivityDef> = {
  adventure_hunt: {
    id: 'adventure_hunt',
    name: 'Hunt',
    description: 'Track and slay wildlife in the surrounding forests. Quick and safe.',
    durationRange: [120, 300],   // 2–5 min
    energyCost: 10,
    heroLevelRequirement: 1,
    rewards: {
      xpRange: [20, 50],
      resources: { food: 30, wood: 10 },
      skillXp: { combat: 10, endurance: 5 },
    },
  },

  adventure_explore: {
    id: 'adventure_explore',
    name: 'Explore Ruins',
    description: 'Venture into ancient ruins for greater rewards, but longer trips.',
    durationRange: [600, 1200],  // 10–20 min
    energyCost: 25,
    heroLevelRequirement: 3,
    rewards: {
      xpRange: [80, 160],
      resources: { stone: 20, iron: 20, gold: 15 },
      skillXp: { gathering: 15, tactics: 10 },
    },
  },

  adventure_raid: {
    id: 'adventure_raid',
    name: 'Raid Bandits',
    description: 'Attack a bandit encampment. High risk, high reward.',
    durationRange: [1800, 3600], // 30–60 min
    energyCost: 50,
    heroLevelRequirement: 5,
    rewards: {
      xpRange: [250, 500],
      resources: { gold: 80, iron: 40, food: 20 },
      skillXp: { combat: 40, leadership: 20, tactics: 20 },
    },
  },
};

export const ACTIVITY_LIST = Object.values(ACTIVITIES);
