import type { BuildingId } from './buildings';
import type { ItemId } from './items';
import type { ResourceType } from './resources';

// ─── Recipe definition ────────────────────────────────────────────────────────

export interface CraftingRecipe {
  id:                  string;
  buildingId:          BuildingId;
  inputItemId:         ItemId;
  outputType:          'resource';
  outputResource:      ResourceType;
  outputAmount:        number;
  /** Processing time at building level 1, in seconds */
  baseDurationSeconds: number;
  label:               string;
  description:         string;
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export const CRAFTING_RECIPES: Record<string, CraftingRecipe> = {
  water_extractor_epsomite: {
    id:                  'water_extractor_epsomite',
    buildingId:          'water_extractor',
    inputItemId:         'epsomite',
    outputType:          'resource',
    outputResource:      'water',
    outputAmount:        100,
    baseDurationSeconds: 25 * 60, // 25 minutes
    label:               'Gypsum Crystals → Water',
    description:         'Dissolve gypsum crystals to extract 100 units of water.',
  },

  refinery_irarsite: {
    id:                  'refinery_irarsite',
    buildingId:          'refinery',
    inputItemId:         'irarsite',
    outputType:          'resource',
    outputResource:      'alloys',
    outputAmount:        100,
    baseDurationSeconds: 60 * 60, // 1 hour
    label:               'Iron Ore Seam → Iron',
    description:         'Smelt iron ore into 100 units of wrought iron.',
  },

  refinery_osmiridium: {
    id:                  'refinery_osmiridium',
    buildingId:          'refinery',
    inputItemId:         'osmiridium',
    outputType:          'resource',
    outputResource:      'iridium',
    outputAmount:        10,
    baseDurationSeconds: 60 * 60, // 1 hour
    label:               'Gemstone Cache → Gold',
    description:         'Cut and refine raw gemstones into 10 polished gold.',
  },
};

export const CRAFTING_RECIPE_LIST = Object.values(CRAFTING_RECIPES);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recipes for a given building */
export function recipesForBuilding(buildingId: BuildingId): CraftingRecipe[] {
  return CRAFTING_RECIPE_LIST.filter((r) => r.buildingId === buildingId);
}

/**
 * Actual processing duration after building level speed-up.
 * Each level reduces time by 10% (compounding), floored at 30s.
 */
export function craftingDurationSeconds(recipe: CraftingRecipe, buildingLevel: number): number {
  return Math.max(30, Math.floor(recipe.baseDurationSeconds * Math.pow(0.9, buildingLevel - 1)));
}
