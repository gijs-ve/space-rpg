export const RESOURCE_TYPES = ['food', 'wood', 'stone', 'iron', 'gold'] as const;
export type ResourceType = typeof RESOURCE_TYPES[number];

export type ResourceMap = Record<ResourceType, number>;

export const EMPTY_RESOURCES: ResourceMap = {
  food: 0,
  wood: 0,
  stone: 0,
  iron: 0,
  gold: 0,
};

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  food:  'Food',
  wood:  'Wood',
  stone: 'Stone',
  iron:  'Iron',
  gold:  'Gold',
};

/** Default storage cap per resource before any warehouse upgrades */
export const BASE_STORAGE_CAP = 1000;

/** Starting resources for a brand-new city */
export const STARTING_RESOURCES: ResourceMap = {
  food:  500,
  wood:  500,
  stone: 300,
  iron:  100,
  gold:  200,
};
