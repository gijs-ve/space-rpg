/**
 * Seed script: generates the 100×100 world map and (optionally) a test player.
 * Run with: npm run db:seed
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Constants inlined to avoid requiring a prior build of @rpg/shared
type TileType = 'plains' | 'forest' | 'mountain' | 'lake' | 'city' | 'ruins';

const MAP_W  = 100;
const MAP_H  = 100;
const SEED   = 42;

const DIST: Array<{ type: TileType; weight: number }> = [
  { type: 'plains',   weight: 0.45 },
  { type: 'forest',   weight: 0.25 },
  { type: 'mountain', weight: 0.12 },
  { type: 'lake',     weight: 0.08 },
  { type: 'ruins',    weight: 0.06 },
  // 'city' tiles are created on-demand when players register
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
  return 'plains';
}

async function main() {
  const prisma = new PrismaClient();
  const rand   = mulberry32(SEED);

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
