/**
 * Shared helpers for garrison / domain resolvers (claim, contest, and any
 * future variants).  Extracted here so the logic is not duplicated between
 * claim.resolver.ts and contest.resolver.ts.
 */

import { prisma } from '../db/client';
import type { TroopMap, UnitId } from '@rpg/shared';

// ─── Troop helpers ────────────────────────────────────────────────────────────

/** Merge all waves into a single combined TroopMap (for garrison storage / returns). */
export function mergeWaves(waves: TroopMap[]): TroopMap {
  const out: TroopMap = {};
  for (const w of waves) {
    for (const [uid, cnt] of Object.entries(w) as [UnitId, number][]) {
      if (cnt) out[uid as UnitId] = (out[uid as UnitId] ?? 0) + cnt;
    }
  }
  return out;
}

/**
 * Subtract a casualty map from an initial garrison to produce surviving defenders.
 * Clamps each unit to ≥ 0.
 */
export function computeSurvivingDefenders(
  initial:    TroopMap,
  casualties: TroopMap,
): TroopMap {
  const out: TroopMap = { ...initial };
  for (const [uid, cas] of Object.entries(casualties) as [UnitId, number][]) {
    out[uid as UnitId] = Math.max(0, (out[uid as UnitId] ?? 0) - (cas ?? 0));
  }
  return out;
}

/**
 * Return troops into a city's garrison.
 * Can be called inside or outside a Prisma transaction by passing the optional `tx`.
 */
export async function returnTroopsTx(
  cityId:    string,
  survivors: TroopMap,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<void> {
  const db   = tx ?? prisma;
  const city = await db.city.findUnique({ where: { id: cityId } });
  if (!city) return;
  const garrison = city.troops as unknown as TroopMap;
  const restored: TroopMap = { ...garrison };
  for (const [uid, cnt] of Object.entries(survivors) as [UnitId, number][]) {
    if (cnt) restored[uid as UnitId] = (restored[uid as UnitId] ?? 0) + cnt;
  }
  await db.city.update({ where: { id: cityId }, data: { troops: restored } });
}
