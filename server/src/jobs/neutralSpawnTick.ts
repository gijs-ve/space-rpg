import { prisma }                from '../db/client';
import {
  NEUTRAL_SPAWN_DEFS,
  pickRandomVariant,
  rollGarrisonTroops,
  rollGarrisonCaps,
  TileType,
  TroopMap,
  UnitId,
} from '@rpg/shared';

const TICK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seed the initial NeutralGarrison entries for every spawnable neutral tile.
 * Called once when there are zero rows in the table.
 */
async function seedInitialGarrisons(): Promise<void> {
  const spawnableTileTypes = Object.keys(NEUTRAL_SPAWN_DEFS) as TileType[];

  // Find all map tiles that have a spawn def and no player city on them
  const tiles = await prisma.mapTile.findMany({
    where: {
      type:   { in: spawnableTileTypes },
      cityId: null,
    },
    select: { x: true, y: true, type: true },
  });

  if (tiles.length === 0) return;

  const rows = tiles.map((tile) => {
    const def     = NEUTRAL_SPAWN_DEFS[tile.type as TileType]!;
    const variant = pickRandomVariant(def);
    const troops  = rollGarrisonTroops(variant);
    const caps    = rollGarrisonCaps(variant);
    return {
      x:      tile.x,
      y:      tile.y,
      troops: troops as object,
      caps:   caps   as object,
    };
  });

  await prisma.neutralGarrison.createMany({ data: rows, skipDuplicates: true });
  console.log(`[neutralSpawnTick] Seeded ${rows.length} neutral garrisons`);
}

/**
 * Look up the perSpawn value for a unit on a given tile type.
 * Scans all variants — perSpawn is intentionally consistent per unit type
 * so the first occurrence always returns the right value.
 */
function getPerSpawn(tileType: TileType, uid: UnitId): number {
  const def = NEUTRAL_SPAWN_DEFS[tileType];
  if (!def) return 1;
  for (const variant of def.variants) {
    const entry = variant.units[uid];
    if (entry) return entry.perSpawn;
  }
  return 1;
}

/**
 * Grow all non-cleared garrisons toward their per-tile caps (stored in DB).
 */
async function growGarrisons(): Promise<void> {
  const garrisons = await prisma.neutralGarrison.findMany({
    where: { everCleared: false },
    select: { x: true, y: true, troops: true, caps: true },
  });

  if (garrisons.length === 0) return;

  const tiles = await prisma.mapTile.findMany({
    where: { OR: garrisons.map((g) => ({ x: g.x, y: g.y })) },
    select: { x: true, y: true, type: true },
  });

  const tileTypeMap = new Map<string, TileType>();
  for (const t of tiles) tileTypeMap.set(`${t.x},${t.y}`, t.type as TileType);

  const updates: Promise<unknown>[] = [];

  for (const garrison of garrisons) {
    const key      = `${garrison.x},${garrison.y}`;
    const tileType = tileTypeMap.get(key);
    if (!tileType) continue;

    const current = garrison.troops  as TroopMap;
    const caps    = garrison.caps    as TroopMap;
    const next: TroopMap = { ...current };
    let changed = false;

    for (const [uid, cap] of Object.entries(caps) as [UnitId, number][]) {
      if (cap == null) continue;
      const cur      = current[uid] ?? 0;
      const perSpawn = getPerSpawn(tileType, uid);
      if (cur < cap) {
        next[uid] = Math.min(cap, cur + perSpawn);
        changed = true;
      }
    }

    if (changed) {
      updates.push(
        prisma.neutralGarrison.update({
          where: { x_y: { x: garrison.x, y: garrison.y } },
          data:  { troops: next as object },
        }),
      );
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
    console.log(`[neutralSpawnTick] Grew ${updates.length} garrisons`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function runTick(): Promise<void> {
  try {
    const count = await prisma.neutralGarrison.count();
    if (count === 0) {
      await seedInitialGarrisons();
    } else {
      await growGarrisons();
    }
  } catch (err) {
    console.error('[neutralSpawnTick] Error:', err);
  }
}

export function startNeutralSpawnTick(): void {
  console.log('[neutralSpawnTick] Starting (interval: 10 min)');
  void runTick(); // run immediately on startup
  setInterval(() => void runTick(), TICK_INTERVAL_MS);
}
