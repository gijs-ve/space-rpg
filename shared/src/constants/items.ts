// ─── Enums and IDs ───────────────────────────────────────────────────────────

export type ItemRarity   = 'common' | 'uncommon' | 'rare' | 'legendary';
export type ItemCategory = 'weapon' | 'helmet' | 'body' | 'legs' | 'utility' | 'component';

/** Equip slots available on a hero */
export type HeroEquipSlot = 'weapon' | 'helmet' | 'body' | 'legs';
/** Generic equip slots on a building (two per building) */
export type BuildingEquipSlot = 'slot_a' | 'slot_b';

export type ItemId =
  | 'plasma_pistol'
  | 'pulse_rifle'
  | 'ion_cannon'
  | 'scout_helmet'
  | 'tactical_visor'
  | 'combat_vest'
  | 'reactive_plate'
  | 'utility_pants'
  | 'armored_greaves'
  | 'medkit'
  | 'stim_pack'
  | 'cpu_chip'
  | 'nav_module'
  | 'power_cell'
  /** Placeholder item that occupies an inventory slot while the real item is listed on the market. */
  | 'market_voucher';

// ─── Item bonuses ─────────────────────────────────────────────────────────────

/**
 * Bonuses an item can provide.
 *
 * Hero bonuses   — active when item is in hero_inventory or hero_equipped.
 * Base bonuses   — active when item is in base_armory or base_building_equip.
 * Some keys are meaningful in both contexts (e.g. defenseBonus).
 *
 * To add a new bonus type in the future, add it here and implement it in
 * the relevant formulas (shared/src/formulas/items.ts → sumItemBonuses) and
 * server services (hero.service.ts, base.service.ts, routes/bases.ts).
 */
export interface ItemBonus {
  // ── Hero bonuses ───────────────────────────────────────────────────────
  attackBonus?:          number; // flat attack increase
  defenseBonus?:         number; // flat defense increase
  maxEnergyBonus?:       number; // flat max-energy increase (hero)
  maxHealthBonus?:       number; // flat max-health increase (hero)
  gatheringBonus?:       number; // % resource reward increase (adventures)
  adventureSpeedBonus?:  number; // % adventure/travel duration reduction

  // ── Base bonuses ──────────────────────────────────────────────────────
  /** % boost to all base resource production rates */
  productionBonus?:       number;
  /** % boost to base storage capacity across all resources */
  storageBonus?:          number;
  /** % reduction in construction/upgrade time at this base */
  constructionSpeedBonus?: number;
  /** % reduction in troop training time at this base */
  trainingSpeedBonus?:    number;
}

// ─── Item definition ──────────────────────────────────────────────────────────

export interface ItemDef {
  id:             ItemId;
  name:           string;
  description:    string;
  category:       ItemCategory;
  rarity:         ItemRarity;
  /** Width in inventory grid columns */
  width:          number;
  /** Height in inventory grid rows */
  height:         number;
  /** Whether the player can rotate this item (swaps w/h) */
  rotatable:      boolean;
  /** Which hero equip slots accept this item (empty = not equippable) */
  heroEquipSlots: HeroEquipSlot[];
  bonuses:        ItemBonus;
}

// ─── Hero inventory grid ──────────────────────────────────────────────────────

export const HERO_INVENTORY_COLS = 4;
export const HERO_INVENTORY_ROWS = 6;

/** Number of equip slots each building has */
export const BUILDING_EQUIP_SLOTS = 2;

// ─── Rarity styling ───────────────────────────────────────────────────────────

export const ITEM_RARITY_COLOR: Record<ItemRarity, string> = {
  common:    '#9ca3af',
  uncommon:  '#22c55e',
  rare:      '#3b82f6',
  legendary: '#f59e0b',
};

export const ITEM_RARITY_BG: Record<ItemRarity, string> = {
  common:    'rgba(156,163,175,0.15)',
  uncommon:  'rgba(34,197,94,0.12)',
  rare:      'rgba(59,130,246,0.15)',
  legendary: 'rgba(245,158,11,0.18)',
};

// ─── Category icons ───────────────────────────────────────────────────────────

export const ITEM_CATEGORY_ICON: Record<ItemCategory, string> = {
  weapon:    '🔫',
  helmet:    '⛑️',
  body:      '🦺',
  legs:      '👖',
  utility:   '🧰',
  component: '🔩',
};

export const HERO_EQUIP_SLOT_LABEL: Record<HeroEquipSlot, string> = {
  helmet: 'Helmet',
  body:   'Body',
  legs:   'Legs',
  weapon: 'Weapon',
};

export const HERO_EQUIP_SLOT_ICON: Record<HeroEquipSlot, string> = {
  helmet: '⛑️',
  body:   '🦺',
  legs:   '👖',
  weapon: '🔫',
};

export const HERO_EQUIP_SLOTS: HeroEquipSlot[] = ['helmet', 'body', 'legs', 'weapon'];

// ─── Item definitions ─────────────────────────────────────────────────────────

export const ITEMS: Record<ItemId, ItemDef> = {

  // ── Weapons ──────────────────────────────────────────────────────────────
  plasma_pistol: {
    id: 'plasma_pistol',
    name: 'Plasma Pistol',
    description: 'A compact sidearm that fires superheated plasma bolts. Standard issue for scouts.',
    category: 'weapon',
    rarity: 'common',
    width: 1, height: 2,
    rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 5 },
  },

  pulse_rifle: {
    id: 'pulse_rifle',
    name: 'Pulse Rifle',
    description: 'Military-grade pulse weapon. Reliable in hostile environments.',
    category: 'weapon',
    rarity: 'uncommon',
    width: 1, height: 3,
    rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 12 },
  },

  ion_cannon: {
    id: 'ion_cannon',
    name: 'Ion Cannon',
    description: 'Heavy anti-armor weapon with devastating stopping power.',
    category: 'weapon',
    rarity: 'rare',
    width: 2, height: 4,
    rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 25 },
  },

  // ── Helmets ───────────────────────────────────────────────────────────────
  scout_helmet: {
    id: 'scout_helmet',
    name: 'Scout Helmet',
    description: 'Lightweight helmet with basic HUD integration.',
    category: 'helmet',
    rarity: 'common',
    width: 2, height: 2,
    rotatable: false,
    heroEquipSlots: ['helmet'],
    bonuses: { defenseBonus: 3 },
  },

  tactical_visor: {
    id: 'tactical_visor',
    name: 'Tactical Visor',
    description: 'Advanced targeting visor with night vision and threat detection.',
    category: 'helmet',
    rarity: 'uncommon',
    width: 2, height: 2,
    rotatable: false,
    heroEquipSlots: ['helmet'],
    bonuses: { defenseBonus: 5, adventureSpeedBonus: 5 },
  },

  // ── Body armor ────────────────────────────────────────────────────────────
  combat_vest: {
    id: 'combat_vest',
    name: 'Combat Vest',
    description: 'Standard ballistic protection for field operatives.',
    category: 'body',
    rarity: 'common',
    width: 2, height: 3,
    rotatable: false,
    heroEquipSlots: ['body'],
    bonuses: { defenseBonus: 8, maxEnergyBonus: 10 },
  },

  reactive_plate: {
    id: 'reactive_plate',
    name: 'Reactive Plate',
    description: 'Active-response armor that hardens on impact.',
    category: 'body',
    rarity: 'uncommon',
    width: 2, height: 3,
    rotatable: false,
    heroEquipSlots: ['body'],
    bonuses: { defenseBonus: 15, maxEnergyBonus: 20 },
  },

  // ── Leg armor ─────────────────────────────────────────────────────────────
  utility_pants: {
    id: 'utility_pants',
    name: 'Utility Pants',
    description: 'Multi-pocket cargo pants favored by scouts and explorers.',
    category: 'legs',
    rarity: 'common',
    width: 2, height: 2,
    rotatable: false,
    heroEquipSlots: ['legs'],
    bonuses: { gatheringBonus: 5 },
  },

  armored_greaves: {
    id: 'armored_greaves',
    name: 'Armored Greaves',
    description: 'Heavy leg armor with integrated servo-assist.',
    category: 'legs',
    rarity: 'uncommon',
    width: 2, height: 2,
    rotatable: false,
    heroEquipSlots: ['legs'],
    bonuses: { defenseBonus: 10, maxEnergyBonus: 15 },
  },

  // ── Utility ───────────────────────────────────────────────────────────────
  medkit: {
    id: 'medkit',
    name: 'Medkit',
    description: 'Emergency medical supplies. Can be used to restore hero energy.',
    category: 'utility',
    rarity: 'common',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: [],
    bonuses: {},
  },

  stim_pack: {
    id: 'stim_pack',
    name: 'Stim Pack',
    description: 'Combat stimulant that boosts performance for a short window.',
    category: 'utility',
    rarity: 'uncommon',
    width: 1, height: 2,
    rotatable: true,
    heroEquipSlots: [],
    bonuses: {},
  },

  // ── Components ────────────────────────────────────────────────────────────
  cpu_chip: {
    id: 'cpu_chip',
    name: 'CPU Chip',
    description: 'Advanced processing unit. Speeds up hero navigation and base construction when carried.',
    category: 'component',
    rarity: 'rare',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: [],
    // Hero: faster adventures. Base: faster construction + faster training.
    bonuses: { adventureSpeedBonus: 10, constructionSpeedBonus: 10, trainingSpeedBonus: 5 },
  },

  nav_module: {
    id: 'nav_module',
    name: 'Nav Module',
    description: 'Navigation computer that optimises route calculations. Accelerates hero travel and base build planning.',
    category: 'component',
    rarity: 'uncommon',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: [],
    // Hero: faster adventures. Base: faster construction.
    bonuses: { adventureSpeedBonus: 5, constructionSpeedBonus: 5 },
  },

  power_cell: {
    id: 'power_cell',
    name: 'Power Cell',
    description: 'High-capacity energy storage unit. Boosts hero max energy and base resource production when carried.',
    category: 'component',
    rarity: 'common',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: [],
    // Hero: more max energy. Base: small production boost.
    bonuses: { maxEnergyBonus: 5, productionBonus: 3 },
  },

  // ── Market Voucher ────────────────────────────────────────────────────────
  market_voucher: {
    id: 'market_voucher',
    name: 'Market Voucher',
    description: 'A proof of ownership for an item listed on the Black Market. Cannot be transferred to another base.',
    category: 'utility',
    rarity: 'common',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: [],
    bonuses: {},
  },
};

export const ITEM_LIST = Object.values(ITEMS);

// ─── Bonus categorisation ─────────────────────────────────────────────────────

/** Bonuses that are active when the item is in the hero's inventory or equipment. */
export const HERO_BONUS_KEYS: (keyof ItemBonus)[] = [
  'attackBonus',
  'defenseBonus',
  'maxEnergyBonus',
  'maxHealthBonus',
  'gatheringBonus',
  'adventureSpeedBonus',
];

/** Bonuses that are active when the item is stored in the base armory / building equip slot. */
export const BASE_BONUS_KEYS: (keyof ItemBonus)[] = [
  'productionBonus',
  'storageBonus',
  'constructionSpeedBonus',
  'trainingSpeedBonus',
];

/** Bonus keys whose value is a percentage (shown as +N%). All others are flat values. */
export const PCT_BONUS_KEYS: (keyof ItemBonus)[] = [
  'gatheringBonus',
  'adventureSpeedBonus',
  'productionBonus',
  'storageBonus',
  'constructionSpeedBonus',
  'trainingSpeedBonus',
];

/** Human-readable label for a bonus key, e.g. 'adventureSpeedBonus' → 'adventure speed' */
export function bonusLabel(key: keyof ItemBonus): string {
  return key.replace(/Bonus$/, '').replace(/([A-Z])/g, ' $1').trim().toLowerCase();
}

/** Format a bonus entry for display, e.g. +10% adventure speed or +5 attack */
export function formatBonus(key: keyof ItemBonus, value: number): string {
  const pct = (PCT_BONUS_KEYS as string[]).includes(key);
  return `+${value}${pct ? '%' : ''} ${bonusLabel(key)}`;
}

// ─── Loot table ───────────────────────────────────────────────────────────────

export interface LootEntry {
  itemId: ItemId;
  /** 0–1 probability of each item.  Multiple items can drop per run. */
  chance: number;
}

export type LootTable = LootEntry[];

/** Roll a loot table and return the itemIds that dropped */
export function rollLootTable(table: LootTable): ItemId[] {
  const drops: ItemId[] = [];
  for (const entry of table) {
    if (Math.random() < entry.chance) drops.push(entry.itemId);
  }
  return drops;
}
