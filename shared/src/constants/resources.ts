export const RESOURCE_TYPES = ['rations', 'water', 'ore', 'alloys', 'fuel', 'iridium'] as const;
export type ResourceType = typeof RESOURCE_TYPES[number];

export type ResourceMap = Record<ResourceType, number>;

/**
 * A reward range for a single resource: [min, max].
 * Used in activity reward definitions so balance is easy to tweak.
 */
export type ResourceRewardRange = Partial<Record<ResourceType, [number, number]>>;

export const EMPTY_RESOURCES: ResourceMap = {
  rations:  0,
  water:    0,
  ore:      0,
  alloys:   0,
  fuel:     0,
  iridium:  0,
};

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  rations:  'Rations',
  water:    'Water',
  ore:      'Ore',
  alloys:   'Alloys',
  fuel:     'Deuterium',
  iridium:  'Iridium',
};

export const RESOURCE_ICONS: Record<ResourceType, string> = {
  rations:  '🥫',
  water:    '💧',
  ore:      '🪨',
  alloys:   '⚙️',
  fuel:     '⚡',
  iridium:  '💎',
};

/** Default storage cap per resource before any storage upgrades */
export const BASE_STORAGE_CAP = 1000;

/** Starting resources for a brand-new starbase */
export const STARTING_RESOURCES: ResourceMap = {
  rations:  500,
  water:    500,
  ore:      300,
  alloys:   100,
  fuel:     100,
  iridium:   20,
};
