import { ItemId } from './items';

// ─────────────────────────────────────────────────────────────────────────────
// Drop Table system
//
// HOW IT WORKS
// ─────────────────────────────────────────────────────────────────────────────
//
// A DropTable is a weighted list of entries.  Each entry can:
//   • yield an item     → set itemId
//   • cascade into a    → set tableId  (nested / rare path)
//     nested table
//   • yield nothing     → set neither  (miss — gives the table its "miss" rate)
//
// An adventure has one or more LootSlots.  Each slot references exactly one
// DropTable.  When the adventure completes the server rolls once per slot;
// each roll produces at most one item.  This means:
//   • 1 slot  → 0 or 1 item
//   • 3 slots → 0, 1, 2 or 3 items (each slot independent)
//
// To add a new table, add its id to DropTableId, define it in DROP_TABLES and
// reference it from an adventure's lootSlots or from another table's entries.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Identifiers ─────────────────────────────────────────────────────────────

export type DropTableId =
  // consumable tables
  | 'consumable_basic'     // low-tier: herbal poultices, war draughts
  | 'consumable_utility'   // mid-tier: maps, tomes, relics
  | 'consumable_combat'    // combat-focused: war draughts + herbal poultices
  // equipment tables
  | 'equip_copper'         // copper weapons
  | 'equip_bronze'         // bronze weapons + light armor
  | 'equip_iron'           // iron weapons + armor
  | 'equip_steel'          // cascades into legendary sub-tables
  // legendary sub-tables (never referenced directly from a slot —
  // only reached by cascading through equip_steel)
  | 'legendary_weapons'    // all steel weapons
  | 'legendary_armor';     // all steel armor

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface DropTableEntry {
  /** Relative weight for this entry (compared to other entries in the same table). Does not need to be a percentage. */
  weight: number;
  /** The item to grant.  Mutually exclusive with tableId.  If neither is set this is a "miss". */
  itemId?: ItemId;
  /** Cascade into a nested table; the nested table is rolled to determine what (if anything) drops.
   *  Mutually exclusive with itemId.  If neither is set this is a "miss". */
  tableId?: DropTableId;
}

/** A named, reusable drop table. */
export interface DropTable {
  id:      DropTableId;
  label:   string;
  entries: DropTableEntry[];
}

/** One loot slot on an adventure.  Each slot rolls independently once the adventure completes. */
export interface LootSlot {
  tableId: DropTableId;
}

// ─────────────────────────────────────────────────────────────────────────────
// DROP TABLE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export const DROP_TABLES: Record<DropTableId, DropTable> = {

  // ── Consumable: basic ──────────────────────────────────────────────────────
  // Suitable for low-level / low-risk adventures.
  // ~45% miss, ~35% herbal poultice, ~20% war draught.
  consumable_basic: {
    id: 'consumable_basic',
    label: 'Basic Consumables',
    entries: [
      { weight: 45 },                                    // miss
      { weight: 35, itemId: 'herbal_poultice' },
      { weight: 20, itemId: 'war_draught' },
    ],
  },

  // ── Consumable: utility ───────────────────────────────────────────────────
  // Mid-tier utility items that feed into other adventures.
  // ~30% miss, ~35% surveyor's map, ~20% scholar's tome, ~15% holy relic.
  consumable_utility: {
    id: 'consumable_utility',
    label: 'Utility Items',
    entries: [
      { weight: 30 },                                    // miss
      { weight: 35, itemId: 'surveyors_map' },
      { weight: 20, itemId: 'scholars_tome' },
      { weight: 15, itemId: 'holy_relic' },
    ],
  },

  // ── Consumable: combat ────────────────────────────────────────────────────
  // War-focused consumables.  Low miss rate — you usually get something.
  // ~20% miss, ~50% war draught, ~30% herbal poultice.
  consumable_combat: {
    id: 'consumable_combat',
    label: 'Combat Consumables',
    entries: [
      { weight: 20 },                                    // miss
      { weight: 50, itemId: 'war_draught' },
      { weight: 30, itemId: 'herbal_poultice' },
    ],
  },

  // ── Equipment: copper ─────────────────────────────────────────────────────
  // Low-tier gear.  High miss rate; when it hits, random copper weapon.
  // ~55% miss, remainder split across copper weapons.
  equip_copper: {
    id: 'equip_copper',
    label: 'Copper Equipment',
    entries: [
      { weight: 55 },                                    // miss
      { weight: 14, itemId: 'copper_dagger' },
      { weight: 12, itemId: 'copper_sword' },
      { weight: 10, itemId: 'copper_warhammer' },
      { weight:  9, itemId: 'copper_bow' },
    ],
  },

  // ── Equipment: bronze ─────────────────────────────────────────────────────
  // Mid-tier gear.  ~60% miss; weapons more common than armour.
  equip_bronze: {
    id: 'equip_bronze',
    label: 'Bronze Equipment',
    entries: [
      { weight: 60 },                                    // miss
      { weight: 14, itemId: 'bronze_sword' },
      { weight: 12, itemId: 'bronze_warhammer' },
      { weight:  8, itemId: 'bronze_bow' },
      { weight:  4, itemId: 'bronze_helm' },
      { weight:  2, itemId: 'bronze_hauberk' },
    ],
  },

  // ── Equipment: iron ───────────────────────────────────────────────────────
  // Upper-mid gear.  ~65% miss; weapons more common than heavy armour.
  equip_iron: {
    id: 'equip_iron',
    label: 'Iron Equipment',
    entries: [
      { weight: 65 },                                    // miss
      { weight: 12, itemId: 'iron_sword' },
      { weight: 10, itemId: 'iron_warhammer' },
      { weight:  6, itemId: 'iron_bow' },
      { weight:  4, itemId: 'iron_helm' },
      { weight:  3, itemId: 'iron_plate' },
    ],
  },

  // ── Equipment: steel (cascades into legendary sub-tables) ─────────────────
  // ~80% miss.  When it hits (20%) it cascades into a legendary sub-table —
  // you never get steel directly from this entry; you must cascade through.
  // Effective chances:  steel weapon ≈ 14% × sub-table weights,
  //                     steel armour ≈  6% × sub-table weights.
  equip_steel: {
    id: 'equip_steel',
    label: 'Steel Equipment (Legendary)',
    entries: [
      { weight: 80 },                                    // miss
      { weight: 14, tableId: 'legendary_weapons' },
      { weight:  6, tableId: 'legendary_armor' },
    ],
  },

  // ── Legendary: weapons (no miss — reached only via cascade) ───────────────
  legendary_weapons: {
    id: 'legendary_weapons',
    label: 'Legendary Weapons',
    entries: [
      { weight: 30, itemId: 'steel_sword' },
      { weight: 28, itemId: 'steel_warhammer' },
      { weight: 25, itemId: 'steel_bow' },
      { weight: 17, itemId: 'steel_dagger' },
    ],
  },

  // ── Legendary: armour (no miss — reached only via cascade) ────────────────
  legendary_armor: {
    id: 'legendary_armor',
    label: 'Legendary Armour',
    entries: [
      { weight: 37, itemId: 'steel_fullplate' },
      { weight: 35, itemId: 'steel_helm' },
      { weight: 28, itemId: 'steel_greaves' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Rolling functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roll a single named drop table.
 * Returns the ItemId that dropped, or null if the roll hit a miss entry.
 * Recursively resolves nested table entries.
 */
export function rollDropTable(tableId: DropTableId): ItemId | null {
  const table = DROP_TABLES[tableId];
  const totalWeight = table.entries.reduce((sum, e) => sum + e.weight, 0);

  let remaining = Math.random() * totalWeight;
  for (const entry of table.entries) {
    remaining -= entry.weight;
    if (remaining <= 0) {
      if (entry.itemId)  return entry.itemId;
      if (entry.tableId) return rollDropTable(entry.tableId);  // cascade
      return null; // miss
    }
  }
  return null; // fallback (shouldn't be reached)
}

/**
 * Roll all loot slots for a completed adventure.
 * Returns an array of ItemIds that dropped (may be empty).
 */
export function rollLootSlots(slots: LootSlot[]): ItemId[] {
  const drops: ItemId[] = [];
  for (const slot of slots) {
    const result = rollDropTable(slot.tableId);
    if (result !== null) drops.push(result);
  }
  return drops;
}
