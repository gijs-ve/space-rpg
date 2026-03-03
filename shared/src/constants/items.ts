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
  | 'power_cell';

// ─── Item bonuses ─────────────────────────────────────────────────────────────

export interface ItemBonus {
  attackBonus?:          number; // flat attack increase
  defenseBonus?:         number; // flat defense increase
  maxEnergyBonus?:       number; // flat max-energy increase
  gatheringBonus?:       number; // % resource reward increase
  adventureSpeedBonus?:  number; // % adventure duration reduction
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
    description: 'Advanced processing unit. Speeds up any system it is installed in.',
    category: 'component',
    rarity: 'rare',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: [],
    bonuses: { adventureSpeedBonus: 10 },
  },

  nav_module: {
    id: 'nav_module',
    name: 'Nav Module',
    description: 'Navigation computer that optimises route calculations.',
    category: 'component',
    rarity: 'uncommon',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: [],
    bonuses: { adventureSpeedBonus: 5 },
  },

  power_cell: {
    id: 'power_cell',
    name: 'Power Cell',
    description: 'High-capacity energy storage unit. Boosts max energy when carried.',
    category: 'component',
    rarity: 'common',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: [],
    bonuses: { maxEnergyBonus: 5 },
  },
};

export const ITEM_LIST = Object.values(ITEMS);

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
