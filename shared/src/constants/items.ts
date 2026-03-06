// ─── Enums and IDs ───────────────────────────────────────────────────────────

export type ItemRarity   = 'common' | 'uncommon' | 'rare' | 'legendary';
export type ItemCategory = 'weapon' | 'helmet' | 'body' | 'legs' | 'utility' | 'component' | 'material';
export type ItemTag      = 'equippable' | 'pocket' | 'consumable' | 'crafting_input';

/** Equip slots available on a hero */
export type HeroEquipSlot = 'weapon' | 'helmet' | 'body' | 'legs' | 'pocket_1' | 'pocket_2' | 'pocket_3' | 'pocket_4';
/** Generic equip slots on a building (two per building) */
export type BuildingEquipSlot = 'slot_a' | 'slot_b';

export type ItemId =
  // ── Daggers ───────────────────────────────────────────────────────────────
  | 'copper_dagger'
  | 'bronze_dagger'
  | 'iron_dagger'
  | 'steel_dagger'
  // ── Swords ────────────────────────────────────────────────────────────────
  | 'copper_sword'
  | 'bronze_sword'
  | 'iron_sword'
  | 'steel_sword'
  // ── War Hammers ───────────────────────────────────────────────────────────
  | 'copper_warhammer'
  | 'bronze_warhammer'
  | 'iron_warhammer'
  | 'steel_warhammer'
  // ── Bows ──────────────────────────────────────────────────────────────────
  | 'copper_bow'
  | 'bronze_bow'
  | 'iron_bow'
  | 'steel_bow'
  // ── Helmets ───────────────────────────────────────────────────────────────
  | 'copper_helm'
  | 'bronze_helm'
  | 'iron_helm'
  | 'steel_helm'
  // ── Body armour ───────────────────────────────────────────────────────────
  | 'copper_mail'
  | 'bronze_hauberk'
  | 'iron_plate'
  | 'steel_fullplate'
  // ── Greaves ───────────────────────────────────────────────────────────────
  | 'copper_greaves'
  | 'bronze_greaves'
  | 'iron_greaves'
  | 'steel_greaves'
  // ── Consumables & utility ─────────────────────────────────────────────────
  | 'medkit'
  | 'stim_pack'
  | 'cpu_chip'
  | 'nav_module'
  | 'power_cell'
  /** Placeholder item that occupies an inventory slot while the real item is listed on the market. */
  | 'market_voucher'
  // ── Crafting inputs ───────────────────────────────────────────────────────
  /** Raw evaporite mineral — processed in the Water Extractor to yield water. */
  | 'epsomite'
  /** Dense ore seam — processed in the Refinery to yield alloys. */
  | 'irarsite'
  /** Rare iridium-osmium alloy — processed in the Refinery to yield iridium. */
  | 'osmiridium';

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

// ─── Consume effects ──────────────────────────────────────────────────────────

/**
 * Effect applied when a consumable item is used.
 * Extend with more fields as new consumables are added.
 */
export interface ConsumeEffect {
  /** Flat HP restored to the hero (capped at maxHealth). */
  healHealth?: number;
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
  tags:           ItemTag[];
  /**
   * If present, this item can be consumed (right-click → Consume).
   * The item is deleted and the effect is applied to the hero.
   */
  consumeEffect?: ConsumeEffect;
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
  weapon:    '⚔️',
  helmet:    '🪖',
  body:      '🛡️',
  legs:      '🦵',
  utility:   '🧰',
  component: '📜',
  material:  '📦',
};

/** Returns true if the item has the given tag. */
export function itemHasTag(item: ItemDef, tag: ItemTag): boolean {
  return item.tags.includes(tag);
}

/** Returns true if the item has all of the given tags. */
export function itemHasAllTags(item: ItemDef, tags: ItemTag[]): boolean {
  return tags.every(t => item.tags.includes(t));
}

/** Returns true if the item has any of the given tags. */
export function itemHasAnyTag(item: ItemDef, tags: ItemTag[]): boolean {
  return tags.some(t => item.tags.includes(t));
}

export const HERO_EQUIP_SLOT_LABEL: Record<HeroEquipSlot, string> = {
  helmet:   'Helmet',
  body:     'Body',
  legs:     'Legs',
  weapon:   'Weapon',
  pocket_1: 'Pocket',
  pocket_2: 'Pocket',
  pocket_3: 'Pocket',
  pocket_4: 'Pocket',
};

export const HERO_EQUIP_SLOT_ICON: Record<HeroEquipSlot, string> = {
  helmet:   '🪖',
  body:     '🛡️',
  legs:     '🦵',
  weapon:   '⚔️',
  pocket_1: '🎒',
  pocket_2: '🎒',
  pocket_3: '🎒',
  pocket_4: '🎒',
};

/** The four main armour/weapon slots */
export const HERO_EQUIP_SLOTS: HeroEquipSlot[] = ['helmet', 'body', 'legs', 'weapon'];

/** The four pocket slots — passive utility items go here to be active */
export const HERO_POCKET_SLOTS: HeroEquipSlot[] = ['pocket_1', 'pocket_2', 'pocket_3', 'pocket_4'];

// ─── Item definitions ─────────────────────────────────────────────────────────

export const ITEMS: Record<ItemId, ItemDef> = {

  // ── Daggers (1×2, fast, attack-focused) ──────────────────────────────────
  copper_dagger: {
    id: 'copper_dagger',
    name: 'Copper Dagger',
    description: 'A simple copper blade. Light and quick, though it blunts easily in prolonged combat.',
    category: 'weapon', rarity: 'common',
    width: 1, height: 2, rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 4 },
    tags: ['equippable'],
  },

  bronze_dagger: {
    id: 'bronze_dagger',
    name: 'Bronze Dagger',
    description: 'A keen-edged bronze dagger favoured by scouts and opportunists. Excellent balance.',
    category: 'weapon', rarity: 'uncommon',
    width: 1, height: 2, rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 7 },
    tags: ['equippable'],
  },

  iron_dagger: {
    id: 'iron_dagger',
    name: 'Iron Dagger',
    description: 'A sturdy iron dagger with superb handling. Reliable in any engagement.',
    category: 'weapon', rarity: 'rare',
    width: 1, height: 2, rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 11 },
    tags: ['equippable'],
  },

  steel_dagger: {
    id: 'steel_dagger',
    name: 'Steel Dagger',
    description: 'A masterwork steel dagger honed to a lethal edge. Swift, silent, and deadly.',
    category: 'weapon', rarity: 'legendary',
    width: 1, height: 2, rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 18 },
    tags: ['equippable'],
  },

  // ── Swords (1×3, balanced attack) ────────────────────────────────────────
  copper_sword: {
    id: 'copper_sword',
    name: 'Copper Sword',
    description: 'A broad copper blade. Serviceable for basic combat but unsuited to heavy armour.',
    category: 'weapon', rarity: 'common',
    width: 1, height: 3, rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 7 },
    tags: ['equippable'],
  },

  bronze_sword: {
    id: 'bronze_sword',
    name: 'Bronze Sword',
    description: 'A reliable bronze longsword with good reach. Standard weapon for most militiamen.',
    category: 'weapon', rarity: 'uncommon',
    width: 1, height: 3, rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 11 },
    tags: ['equippable'],
  },

  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    description: 'A battle-proven iron sword. Heavy enough to cleave light armour with precision.',
    category: 'weapon', rarity: 'rare',
    width: 1, height: 3, rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 18 },
    tags: ['equippable'],
  },

  steel_sword: {
    id: 'steel_sword',
    name: 'Steel Sword',
    description: 'A perfectly balanced steel sword. Prized by veteran soldiers for its unmatched edge retention.',
    category: 'weapon', rarity: 'legendary',
    width: 1, height: 3, rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 30 },
    tags: ['equippable'],
  },

  // ── War Hammers (2×3, heavy attack + max health) ──────────────────────────
  copper_warhammer: {
    id: 'copper_warhammer',
    name: 'Copper War Hammer',
    description: 'A crude copper-headed maul. Brutish but effective at staggering lightly armoured foes.',
    category: 'weapon', rarity: 'common',
    width: 2, height: 3, rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 10, maxHealthBonus: 5 },
    tags: ['equippable'],
  },

  bronze_warhammer: {
    id: 'bronze_warhammer',
    name: 'Bronze War Hammer',
    description: 'A solid bronze warhammer that can crack shields and buckle plate alike.',
    category: 'weapon', rarity: 'uncommon',
    width: 2, height: 3, rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 16, maxHealthBonus: 8 },
    tags: ['equippable'],
  },

  iron_warhammer: {
    id: 'iron_warhammer',
    name: 'Iron War Hammer',
    description: 'A heavy iron maul that transfers tremendous force on impact. The bane of armoured knights.',
    category: 'weapon', rarity: 'rare',
    width: 2, height: 3, rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 26, maxHealthBonus: 13 },
    tags: ['equippable'],
  },

  steel_warhammer: {
    id: 'steel_warhammer',
    name: 'Steel War Hammer',
    description: 'A devastating steel warhammer reserved for the strongest warriors. Each blow can decide a battle.',
    category: 'weapon', rarity: 'legendary',
    width: 2, height: 3, rotatable: true,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 42, maxHealthBonus: 22 },
    tags: ['equippable'],
  },

  // ── Bows (1×3, attack + gathering bonus) ─────────────────────────────────
  copper_bow: {
    id: 'copper_bow',
    name: 'Copper Bow',
    description: 'A short yew bow with copper-tipped arrows. Decent range and useful for foraging on the road.',
    category: 'weapon', rarity: 'common',
    width: 1, height: 3, rotatable: false,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 5, gatheringBonus: 5 },
    tags: ['equippable'],
  },

  bronze_bow: {
    id: 'bronze_bow',
    name: 'Bronze Bow',
    description: 'A well-crafted longbow with bronze arrowheads. Effective at distance and helpful for hunting.',
    category: 'weapon', rarity: 'uncommon',
    width: 1, height: 3, rotatable: false,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 8, gatheringBonus: 8 },
    tags: ['equippable'],
  },

  iron_bow: {
    id: 'iron_bow',
    name: 'Iron Bow',
    description: 'A reinforced recurve bow with iron broadheads. Penetrates light armour and excels at hunting.',
    category: 'weapon', rarity: 'rare',
    width: 1, height: 3, rotatable: false,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 13, gatheringBonus: 12 },
    tags: ['equippable'],
  },

  steel_bow: {
    id: 'steel_bow',
    name: 'Steel Bow',
    description: 'A master-crafted composite greatbow with steel bodkin arrows. Devastating range and unmatched hunting efficiency.',
    category: 'weapon', rarity: 'legendary',
    width: 1, height: 3, rotatable: false,
    heroEquipSlots: ['weapon'],
    bonuses: { attackBonus: 21, gatheringBonus: 18 },
    tags: ['equippable'],
  },

  // ── Helmets (2×2, defense) ────────────────────────────────────────────────
  copper_helm: {
    id: 'copper_helm',
    name: 'Copper Helm',
    description: 'A beaten copper skullcap. Provides basic head protection for raw recruits.',
    category: 'helmet', rarity: 'common',
    width: 2, height: 2, rotatable: false,
    heroEquipSlots: ['helmet'],
    bonuses: { defenseBonus: 3 },
    tags: ['equippable'],
  },

  bronze_helm: {
    id: 'bronze_helm',
    name: 'Bronze Helm',
    description: 'A solid bronze war helmet with cheek guards. Reliable field protection for experienced soldiers.',
    category: 'helmet', rarity: 'uncommon',
    width: 2, height: 2, rotatable: false,
    heroEquipSlots: ['helmet'],
    bonuses: { defenseBonus: 5 },
    tags: ['equippable'],
  },

  iron_helm: {
    id: 'iron_helm',
    name: 'Iron Great Helm',
    description: 'A full-faced iron great helm offering excellent head and neck protection.',
    category: 'helmet', rarity: 'rare',
    width: 2, height: 2, rotatable: false,
    heroEquipSlots: ['helmet'],
    bonuses: { defenseBonus: 8 },
    tags: ['equippable'],
  },

  steel_helm: {
    id: 'steel_helm',
    name: 'Steel Great Helm',
    description: 'A masterforged steel great helm with reinforced visor. The pinnacle of head protection.',
    category: 'helmet', rarity: 'legendary',
    width: 2, height: 2, rotatable: false,
    heroEquipSlots: ['helmet'],
    bonuses: { defenseBonus: 14 },
    tags: ['equippable'],
  },

  // ── Body armour (2×3, defense + max energy) ───────────────────────────────
  copper_mail: {
    id: 'copper_mail',
    name: 'Copper Mail',
    description: 'Interlocked copper rings forming basic torso protection. Light but offers limited coverage.',
    category: 'body', rarity: 'common',
    width: 2, height: 3, rotatable: false,
    heroEquipSlots: ['body'],
    bonuses: { defenseBonus: 7, maxEnergyBonus: 8 },
    tags: ['equippable'],
  },

  bronze_hauberk: {
    id: 'bronze_hauberk',
    name: 'Bronze Hauberk',
    description: 'A full-length bronze mail shirt. Standard armour for professional soldiers on campaign.',
    category: 'body', rarity: 'uncommon',
    width: 2, height: 3, rotatable: false,
    heroEquipSlots: ['body'],
    bonuses: { defenseBonus: 11, maxEnergyBonus: 13 },
    tags: ['equippable'],
  },

  iron_plate: {
    id: 'iron_plate',
    name: 'Iron Plate',
    description: 'Solid iron plate armour that distributes impact forces effectively. Trusted in heavy combat.',
    category: 'body', rarity: 'rare',
    width: 2, height: 3, rotatable: false,
    heroEquipSlots: ['body'],
    bonuses: { defenseBonus: 18, maxEnergyBonus: 20 },
    tags: ['equippable'],
  },

  steel_fullplate: {
    id: 'steel_fullplate',
    name: 'Steel Full Plate',
    description: 'Masterforged steel plate covering the entire torso. The finest body armour a warrior can own.',
    category: 'body', rarity: 'legendary',
    width: 2, height: 3, rotatable: false,
    heroEquipSlots: ['body'],
    bonuses: { defenseBonus: 30, maxEnergyBonus: 33 },
    tags: ['equippable'],
  },

  // ── Greaves (2×2, defense + adventure speed) ──────────────────────────────
  copper_greaves: {
    id: 'copper_greaves',
    name: 'Copper Greaves',
    description: 'Simple copper leg guards. Light enough to keep a good pace on the road.',
    category: 'legs', rarity: 'common',
    width: 2, height: 2, rotatable: false,
    heroEquipSlots: ['legs'],
    bonuses: { defenseBonus: 4, adventureSpeedBonus: 3 },
    tags: ['equippable'],
  },

  bronze_greaves: {
    id: 'bronze_greaves',
    name: 'Bronze Greaves',
    description: 'Riveted bronze leg armour offering decent protection without sacrificing mobility.',
    category: 'legs', rarity: 'uncommon',
    width: 2, height: 2, rotatable: false,
    heroEquipSlots: ['legs'],
    bonuses: { defenseBonus: 7, adventureSpeedBonus: 5 },
    tags: ['equippable'],
  },

  iron_greaves: {
    id: 'iron_greaves',
    name: 'Iron Greaves',
    description: 'Articulated iron leg armour providing solid protection while maintaining flexibility.',
    category: 'legs', rarity: 'rare',
    width: 2, height: 2, rotatable: false,
    heroEquipSlots: ['legs'],
    bonuses: { defenseBonus: 11, adventureSpeedBonus: 8 },
    tags: ['equippable'],
  },

  steel_greaves: {
    id: 'steel_greaves',
    name: 'Steel Greaves',
    description: 'Perfectly fitted steel greaves with sliding lames. Maximum protection with minimal movement penalty.',
    category: 'legs', rarity: 'legendary',
    width: 2, height: 2, rotatable: false,
    heroEquipSlots: ['legs'],
    bonuses: { defenseBonus: 18, adventureSpeedBonus: 12 },
    tags: ['equippable'],
  },

  // ── Utility ───────────────────────────────────────────────────────────────
  medkit: {
    id: 'medkit',
    name: 'Herbal Poultice',
    description: 'Field-prepared herbal remedy wrapped in linen. Consume to restore 5 HP.',
    category: 'utility',
    rarity: 'common',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: [],
    bonuses: {},
    consumeEffect: { healHealth: 5 },
    tags: ['consumable'],
  },

  stim_pack: {
    id: 'stim_pack',
    name: 'War Draught',
    description: 'An alchemical tonic that sharpens the senses and steadies the hand in battle.',
    category: 'utility',
    rarity: 'uncommon',
    width: 1, height: 2,
    rotatable: true,
    heroEquipSlots: [],
    bonuses: {},
    tags: ['consumable'],
  },

  // ── Components ────────────────────────────────────────────────────────────
  cpu_chip: {
    id: 'cpu_chip',
    name: "Scholar's Tome",
    description: 'A learned manuscript on strategy and engineering. Speeds up hero travel and base construction. Must be kept in a pocket slot to be active.',
    category: 'component',
    rarity: 'rare',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: ['pocket_1', 'pocket_2', 'pocket_3', 'pocket_4'],
    // Hero: faster missions. Base: faster construction + faster training.
    bonuses: { adventureSpeedBonus: 10, constructionSpeedBonus: 10, trainingSpeedBonus: 5 },
    tags: ['equippable', 'pocket'],
  },

  nav_module: {
    id: 'nav_module',
    name: "Surveyor's Map",
    description: 'A detailed land survey map that optimises route planning and construction logistics. Must be kept in a pocket slot to be active.',
    category: 'component',
    rarity: 'uncommon',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: ['pocket_1', 'pocket_2', 'pocket_3', 'pocket_4'],
    // Hero: faster missions. Base: faster construction.
    bonuses: { adventureSpeedBonus: 5, constructionSpeedBonus: 5 },
    tags: ['equippable', 'pocket'],
  },

  power_cell: {
    id: 'power_cell',
    name: 'Holy Relic',
    description: 'A blessed artefact that strengthens the bearer\'s resolve and inspires the workforce. Boosts hero max energy and base resource production. Must be kept in a pocket slot to be active.',
    category: 'component',
    rarity: 'common',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: ['pocket_1', 'pocket_2', 'pocket_3', 'pocket_4'],
    // Hero: more max energy. Base: small production boost.
    bonuses: { maxEnergyBonus: 5, productionBonus: 3 },
    tags: ['equippable', 'pocket'],
  },

  // ── Market Voucher ────────────────────────────────────────────────────────
  market_voucher: {
    id: 'market_voucher',
    name: 'Market Bond',
    description: 'A deed of ownership for an item listed on the market. Cannot be transferred to another settlement.',
    category: 'utility',
    rarity: 'common',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: [],
    bonuses: {},
    tags: [],
  },

  // ── Crafting inputs ───────────────────────────────────────────────────────
  epsomite: {
    id: 'epsomite',
    name: 'Gypsum Crystals',
    description: 'Pale crystalline mineral rich in hydrated magnesium. Processed by a Millpond to yield pure water.',
    category: 'material',
    rarity: 'common',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: [],
    bonuses: {},
    tags: ['crafting_input'],
  },

  irarsite: {
    id: 'irarsite',
    name: 'Iron Ore Seam',
    description: 'A dense deposit of iron-bearing ore. Smelted in a Forge to produce wrought iron.',
    category: 'material',
    rarity: 'rare',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: [],
    bonuses: {},
    tags: ['crafting_input'],
  },

  osmiridium: {
    id: 'osmiridium',
    name: 'Gemstone Cache',
    description: 'A cache of uncut precious stones of exceptional rarity. Refined in a Forge to produce polished gems.',
    category: 'material',
    rarity: 'rare',
    width: 1, height: 1,
    rotatable: false,
    heroEquipSlots: [],
    bonuses: {},
    tags: ['crafting_input'],
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
