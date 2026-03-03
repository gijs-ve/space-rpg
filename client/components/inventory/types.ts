import type { ItemInstance } from '@rpg/shared';

/** State for an item currently being "held" (about to be placed) */
export interface HeldItem {
  instance:        ItemInstance;
  effectiveWidth:  number;   // width accounting for current rotation
  effectiveHeight: number;
  rotated:         boolean;
  /** Where the item came from */
  source: 'hero_inventory' | 'hero_equipped' | 'base_armory' | 'activity_report';
  reportId?: string; // set when source === 'activity_report'
}

export const CELL_SIZE = 42; // px per inventory cell
