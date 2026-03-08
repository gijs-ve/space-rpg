export const RESOURCE_TYPES = ['rations', 'water', 'wood', 'ore', 'iron', 'gold'] as const;
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
  wood:     0,
  ore:      0,
  iron:     0,
  gold:     0,
};

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  rations:  'Food',
  water:    'Water',
  wood:     'Wood',
  ore:      'Stone',
  iron:     'Iron',
  gold:     'Gold',
};

export const RESOURCE_ICONS: Record<ResourceType, string> = {
  rations:  '🌾',
  water:    '💧',
  wood:     '🪵',
  ore:      '🪨',
  iron:     '⚔️',
  gold:     '�',
};

/** Default storage cap per resource before any storage upgrades */
export const BASE_STORAGE_CAP = 1000;

/** Starting resources for a brand-new settlement */
export const STARTING_RESOURCES: ResourceMap = {
  rations:  500,
  water:    500,
  wood:     100,
  ore:      300,
  iron:     100,
  gold:      20,
};
