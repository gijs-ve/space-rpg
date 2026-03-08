export type SkillId = 'combat' | 'endurance' | 'observation' | 'navigation' | 'tactics';

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
  maxLevel: number;
  /** Skill-XP required to go from level N-1 → N (index 0 = level 1) */
  xpPerLevel: number[];
  /** Effect applied at each skill level. Keys match server-side bonus names. */
  bonusPerLevel: Record<string, number>;
}

/** Skill XP curve: 100 * level^1.8 */
function skillXpCurve(maxLevel: number): number[] {
  return Array.from({ length: maxLevel }, (_, i) =>
    Math.floor(100 * Math.pow(i + 1, 1.8))
  );
}

export const SKILLS: Record<SkillId, SkillDef> = {
  combat: {
    id: 'combat',
    name: 'Combat',
    description: 'Improves hero attack strength in adventures and battles.',
    maxLevel: 20,
    xpPerLevel: skillXpCurve(20),
    bonusPerLevel: { attackBonus: 5 }, // +5 attack per level
  },

  endurance: {
    id: 'endurance',
    name: 'Endurance',
    description: 'Increases hero energy regeneration by 1 per level.',
    maxLevel: 20,
    xpPerLevel: skillXpCurve(20),
    bonusPerLevel: { energyRegenBonus: 1 }, // +1 energy regen per tick per level
  },

  observation: {
    id: 'observation',
    name: 'Scouting',
    description: 'Increases resource rewards from missions by 1% per level.',
    maxLevel: 20,
    xpPerLevel: skillXpCurve(20),
    bonusPerLevel: { gatheringBonus: 1 }, // +1% resource rewards per level
  },

  navigation: {
    id: 'navigation',
    name: 'Logistics',
    description: 'Reduces troop upkeep and increases garrison capacity through strategic supply management.',
    maxLevel: 20,
    xpPerLevel: skillXpCurve(20),
    bonusPerLevel: { upkeepReduction: 1 }, // -1% upkeep per level
  },

  tactics: {
    id: 'tactics',
    name: 'Tactics',
    description: 'Reduces hero travel and mission time by 2% per level (max 50%).',
    maxLevel: 20,
    xpPerLevel: skillXpCurve(20),
    bonusPerLevel: { adventureSpeedBonus: 2 }, // -2% duration per level
  },
};

export const SKILL_LIST = Object.values(SKILLS);

/** Maximum hero energy at level 1 (before level bonuses) */
export const BASE_MAX_ENERGY = 100;

/** Maximum hero health at level 1 (before level bonuses) */
export const BASE_MAX_HEALTH = 100;

/** Additional max energy and max health gained per hero level */
export const ENERGY_HEALTH_PER_LEVEL = 5;

/** Global hero regen tick interval in seconds (every 5 min, synced to clock) */
export const REGEN_TICK_INTERVAL_SECONDS = 600; // 10 minutes

/** Base energy regenerated per regen tick (before skill/item bonuses) */
export const BASE_ENERGY_REGEN = 5;

/** Base health regenerated per regen tick (before item bonuses) */
export const BASE_HEALTH_REGEN = 5;
