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
    name:        'The Black Pegasus Inn',
    description: 'A renowned roadside inn that doubles as a trader\'s post for field gear and combat supplies.',
    stock: [
      { itemDefId: 'copper_dagger',  maxStock: 12, sellPrice: 60,  buyPrice: 20,  restockIntervalMinutes: 60  },
      { itemDefId: 'copper_sword',   maxStock: 10, sellPrice: 80,  buyPrice: 28,  restockIntervalMinutes: 60  },
      { itemDefId: 'copper_bow',     maxStock: 10, sellPrice: 70,  buyPrice: 24,  restockIntervalMinutes: 60  },
      { itemDefId: 'copper_mail',    maxStock: 6,  sellPrice: 90,  buyPrice: 30,  restockIntervalMinutes: 90  },
      { itemDefId: 'copper_greaves', maxStock: 6,  sellPrice: 70,  buyPrice: 24,  restockIntervalMinutes: 90  },
      { itemDefId: 'medkit',         maxStock: 20, sellPrice: 25,  buyPrice: 8,   restockIntervalMinutes: 30  },
      { itemDefId: 'stim_pack',      maxStock: 15, sellPrice: 40,  buyPrice: 12,  restockIntervalMinutes: 45  },
    ],
  },

  deep_horizon: {
    id:          'deep_horizon',
    name:        'The Wandering Scholar',
    description: 'A learned merchant dealing in rare manuscripts, curious artefacts, and advanced equipment.',
    stock: [
      { itemDefId: 'cpu_chip',        maxStock: 5,  sellPrice: 300, buyPrice: 100, restockIntervalMinutes: 240 },
      { itemDefId: 'nav_module',       maxStock: 8,  sellPrice: 180, buyPrice: 60,  restockIntervalMinutes: 180 },
      { itemDefId: 'power_cell',       maxStock: 12, sellPrice: 60,  buyPrice: 20,  restockIntervalMinutes: 90  },
      { itemDefId: 'bronze_sword',     maxStock: 6,  sellPrice: 200, buyPrice: 70,  restockIntervalMinutes: 180 },
      { itemDefId: 'bronze_bow',       maxStock: 6,  sellPrice: 180, buyPrice: 62,  restockIntervalMinutes: 180 },
      { itemDefId: 'bronze_hauberk',   maxStock: 4,  sellPrice: 240, buyPrice: 84,  restockIntervalMinutes: 240 },
    ],
  },

  iron_bastion: {
    id:          'iron_bastion',
    name:        'Iron Bastion Armoury',
    description: 'A master blacksmith\'s workshop dealing in heavy armour and specialist weapons. Prices reflect quality.',
    stock: [
      { itemDefId: 'iron_sword',      maxStock: 4,  sellPrice: 420, buyPrice: 148, restockIntervalMinutes: 360 },
      { itemDefId: 'iron_warhammer',  maxStock: 3,  sellPrice: 480, buyPrice: 168, restockIntervalMinutes: 480 },
      { itemDefId: 'iron_helm',       maxStock: 5,  sellPrice: 260, buyPrice: 90,  restockIntervalMinutes: 240 },
      { itemDefId: 'iron_plate',      maxStock: 3,  sellPrice: 520, buyPrice: 182, restockIntervalMinutes: 480 },
      { itemDefId: 'iron_greaves',    maxStock: 5,  sellPrice: 320, buyPrice: 112, restockIntervalMinutes: 300 },
      { itemDefId: 'steel_sword',     maxStock: 2,  sellPrice: 800, buyPrice: 280, restockIntervalMinutes: 720 },
      { itemDefId: 'steel_fullplate', maxStock: 1,  sellPrice: 950, buyPrice: 330, restockIntervalMinutes: 720 },
    ],
  },
};

export const VENDOR_LIST = Object.values(VENDORS);
