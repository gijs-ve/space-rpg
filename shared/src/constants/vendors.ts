import { ItemId } from './items';

// ─── Vendor stock entry ───────────────────────────────────────────────────────

export interface VendorStockDef {
  itemDefId:              ItemId;
  /** Max and restock quantity */
  maxStock:               number;
  /** Price the vendor sells the item at (player buys) — in iridium */
  sellPrice:              number;
  /** Price the vendor buys the item for (player sells back) — in iridium */
  buyPrice:               number;
  /** How many minutes until the stock is fully restocked */
  restockIntervalMinutes: number;
}

// ─── Vendor definition ────────────────────────────────────────────────────────

export interface VendorDef {
  id:          string;
  name:        string;
  description: string;
  stock:       VendorStockDef[];
}

// ─── Vendor catalogue ─────────────────────────────────────────────────────────

export const VENDORS: Record<string, VendorDef> = {
  black_pegasus: {
    id:          'black_pegasus',
    name:        'Black Pegasus Supplies',
    description: 'Your go-to vendor for field gear and combat consumables.',
    stock: [
      { itemDefId: 'plasma_pistol',  maxStock: 10, sellPrice: 80,  buyPrice: 30,  restockIntervalMinutes: 60  },
      { itemDefId: 'medkit',         maxStock: 20, sellPrice: 25,  buyPrice: 8,   restockIntervalMinutes: 30  },
      { itemDefId: 'stim_pack',      maxStock: 15, sellPrice: 40,  buyPrice: 12,  restockIntervalMinutes: 45  },
      { itemDefId: 'combat_vest',    maxStock: 5,  sellPrice: 150, buyPrice: 55,  restockIntervalMinutes: 120 },
      { itemDefId: 'utility_pants',  maxStock: 5,  sellPrice: 90,  buyPrice: 30,  restockIntervalMinutes: 120 },
    ],
  },

  deep_horizon: {
    id:          'deep_horizon',
    name:        'Deep Horizon Tech',
    description: 'Specialises in advanced components and rare salvage.',
    stock: [
      { itemDefId: 'cpu_chip',       maxStock: 5,  sellPrice: 300, buyPrice: 100, restockIntervalMinutes: 240 },
      { itemDefId: 'nav_module',     maxStock: 8,  sellPrice: 180, buyPrice: 60,  restockIntervalMinutes: 180 },
      { itemDefId: 'power_cell',     maxStock: 12, sellPrice: 60,  buyPrice: 20,  restockIntervalMinutes: 90  },
      { itemDefId: 'pulse_rifle',    maxStock: 6,  sellPrice: 200, buyPrice: 70,  restockIntervalMinutes: 180 },
    ],
  },

  iron_bastion: {
    id:          'iron_bastion',
    name:        'Iron Bastion Armory',
    description: 'Heavy armour and specialist weapons. Not cheap.',
    stock: [
      { itemDefId: 'ion_cannon',       maxStock: 3,  sellPrice: 500, buyPrice: 180, restockIntervalMinutes: 480 },
      { itemDefId: 'scout_helmet',     maxStock: 8,  sellPrice: 70,  buyPrice: 25,  restockIntervalMinutes: 120 },
      { itemDefId: 'tactical_visor',   maxStock: 4,  sellPrice: 220, buyPrice: 80,  restockIntervalMinutes: 240 },
      { itemDefId: 'reactive_plate',   maxStock: 3,  sellPrice: 350, buyPrice: 120, restockIntervalMinutes: 360 },
      { itemDefId: 'armored_greaves',  maxStock: 5,  sellPrice: 175, buyPrice: 60,  restockIntervalMinutes: 180 },
    ],
  },
};

export const VENDOR_LIST = Object.values(VENDORS);
