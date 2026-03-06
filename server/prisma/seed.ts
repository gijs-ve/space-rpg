/**
 * Seed script: generates the 100×100 world map and (optionally) a test player.
 * Run with: npm run db:seed
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Constants inlined to avoid requiring a prior build of @rpg/shared
type TileType = 'barren' | 'nebula' | 'crater' | 'ice_deposit' | 'starbase' | 'derelict';

const MAP_W  = 100;
const MAP_H  = 100;
const SEED   = 42;

const DIST: Array<{ type: TileType; weight: number }> = [
  { type: 'barren',      weight: 0.44 },
  { type: 'nebula',      weight: 0.20 },
  { type: 'crater',      weight: 0.14 },
  { type: 'ice_deposit', weight: 0.12 },
  { type: 'derelict',    weight: 0.06 },
  // 'starbase' tiles are created on-demand when players register
];

/** Seeded pseudo-random number generator (mulberry32) */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickTile(rand: () => number): TileType {
  const r = rand();
  let cumulative = 0;
  for (const { type, weight } of DIST) {
    cumulative += weight;
    if (r < cumulative) return type;
  }
  return 'barren';
}

async function main() {
  const prisma = new PrismaClient();
  const rand   = mulberry32(SEED);

  // ── Seed vendors ─────────────────────────────────────────────────────────
  console.log('🛒  Seeding vendors…');

  const VENDORS = [
    {
      id: 'black_pegasus',
      name: 'Black Pegasus Supplies',
      description: 'Your go-to vendor for field gear and combat consumables.',
      stock: [
        { itemDefId: 'plasma_pistol', maxStock: 10, sellPrice: 80,  buyPrice: 30,  restockIntervalMinutes: 60  },
        { itemDefId: 'medkit',        maxStock: 20, sellPrice: 25,  buyPrice: 8,   restockIntervalMinutes: 30  },
        { itemDefId: 'stim_pack',     maxStock: 15, sellPrice: 40,  buyPrice: 12,  restockIntervalMinutes: 45  },
        { itemDefId: 'combat_vest',   maxStock: 5,  sellPrice: 150, buyPrice: 55,  restockIntervalMinutes: 120 },
        { itemDefId: 'utility_pants', maxStock: 5,  sellPrice: 90,  buyPrice: 30,  restockIntervalMinutes: 120 },
      ],
    },
    {
      id: 'deep_horizon',
      name: 'Deep Horizon Tech',
      description: 'Specialises in advanced components and rare salvage.',
      stock: [
        { itemDefId: 'cpu_chip',   maxStock: 5,  sellPrice: 300, buyPrice: 100, restockIntervalMinutes: 240 },
        { itemDefId: 'nav_module', maxStock: 8,  sellPrice: 180, buyPrice: 60,  restockIntervalMinutes: 180 },
        { itemDefId: 'power_cell', maxStock: 12, sellPrice: 60,  buyPrice: 20,  restockIntervalMinutes: 90  },
        { itemDefId: 'pulse_rifle',maxStock: 6,  sellPrice: 200, buyPrice: 70,  restockIntervalMinutes: 180 },
      ],
    },
    {
      id: 'iron_bastion',
      name: 'Iron Bastion Armory',
      description: 'Heavy armour and specialist weapons. Not cheap.',
      stock: [
        { itemDefId: 'ion_cannon',      maxStock: 3, sellPrice: 500, buyPrice: 180, restockIntervalMinutes: 480 },
        { itemDefId: 'scout_helmet',    maxStock: 8, sellPrice: 70,  buyPrice: 25,  restockIntervalMinutes: 120 },
        { itemDefId: 'tactical_visor',  maxStock: 4, sellPrice: 220, buyPrice: 80,  restockIntervalMinutes: 240 },
        { itemDefId: 'reactive_plate',  maxStock: 3, sellPrice: 350, buyPrice: 120, restockIntervalMinutes: 360 },
        { itemDefId: 'armored_greaves', maxStock: 5, sellPrice: 175, buyPrice: 60,  restockIntervalMinutes: 180 },
      ],
    },
  ];

  for (const v of VENDORS) {
    await prisma.vendor.upsert({
      where: { id: v.id },
      update: { name: v.name, description: v.description },
      create: { id: v.id, name: v.name, description: v.description },
    });
    for (const s of v.stock) {
      await prisma.vendorStock.upsert({
        where: { vendorId_itemDefId: { vendorId: v.id, itemDefId: s.itemDefId } },
        update: {
          maxStock: s.maxStock,
          sellPrice: s.sellPrice,
          buyPrice: s.buyPrice,
          restockIntervalMinutes: s.restockIntervalMinutes,
        },
        create: {
          vendorId: v.id,
          itemDefId: s.itemDefId,
          currentStock: s.maxStock,
          maxStock: s.maxStock,
          sellPrice: s.sellPrice,
          buyPrice: s.buyPrice,
          restockIntervalMinutes: s.restockIntervalMinutes,
        },
      });
    }
  }
  console.log('✅ Vendors seeded.');

  // ── Generate world map ────────────────────────────────────────────────────
  console.log('🗺  Generating world map…');

  // Build tiles in batches of 500 for performance
  const BATCH = 500;
  const allTiles: Array<{ x: number; y: number; type: string }> = [];

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      allTiles.push({ x, y, type: pickTile(rand) });
    }
  }

  // Clear existing non-city tiles
  await prisma.mapTile.deleteMany({ where: { cityId: null } });

  for (let i = 0; i < allTiles.length; i += BATCH) {
    const batch = allTiles.slice(i, i + BATCH);
    await prisma.mapTile.createMany({
      data: batch,
      skipDuplicates: true,
    });
    process.stdout.write(`\r  ${Math.min(i + BATCH, allTiles.length)} / ${allTiles.length} tiles`);
  }

  console.log('\n✅ Map generated.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
