import { Job }              from '@prisma/client';
import { prisma }            from '../../db/client';
import { io, playerSockets } from '../../index';
import {
  TroopMap,
  UnitId,
  ScoutJobMeta,
  ScoutingReportMeta,
} from '@rpg/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Accuracy formula
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute scout accuracy (0.0–1.0) based on how many scouts were sent vs how
 * many enemies are on the target tile.
 *
 * Formula: accuracy = scoutCount / (scoutCount + totalEnemyCount^0.6)
 *
 * Examples (scouts → enemies → accuracy):
 *   5  → 0  → 1.00  (no garrison; exact data)
 *   1  → 10 → 0.20  (handful of enemies; rough data)
 *   5  → 50 → 0.45  (small garrison; uncertain)
 *   10 → 100 → 0.39 (medium garrison)
 *   5  → 500 → 0.09 (large garrison; very poor accuracy)
 */
function computeScoutAccuracy(scoutCount: number, totalEnemyCount: number): number {
  if (totalEnemyCount === 0) return 1;
  const difficulty = Math.pow(totalEnemyCount, 0.6);
  return scoutCount / (scoutCount + difficulty);
}

// ─────────────────────────────────────────────────────────────────────────────
// Noise function — log-normal distribution via Box-Muller
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply log-normal noise to a reported unit count.
 *
 * At accuracy = 1.0: sigma = 0 → exact count.
 * At accuracy = 0.5: sigma ≈ 1.25 → count off by ×0.08 – ×12 (68% within ×0.28 – ×3.5).
 * At accuracy = 0.01: sigma ≈ 2.47 → count is wildly unreliable.
 *
 * The lognormal distribution is used so that:
 *  - counts are always ≥ 0
 *  - errors are multiplicative (halving / doubling), not additive
 *  - a player cannot back-calculate real numbers from reported values
 */
function applyScoutNoise(realCount: number, accuracy: number): number {
  if (realCount === 0) return 0;
  // sigma grows as accuracy falls: 0 at perfect, ~2.5 at 0% accuracy
  const sigma = 2.5 * (1 - accuracy);
  if (sigma < 0.001) return realCount; // effectively perfect accuracy

  // Box-Muller transform: produces ~N(0,1) from two uniform samples
  const u1 = Math.max(1e-10, Math.random());
  const u2 = Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // Log-normal: realCount * exp(sigma * z)
  return Math.max(0, Math.round(realCount * Math.exp(sigma * z)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main resolver
// ─────────────────────────────────────────────────────────────────────────────

export async function resolveScoutJob(job: Job): Promise<void> {
  const meta = job.metadata as unknown as ScoutJobMeta;
  const { scoutingCityId, scoutCount, targetX, targetY, targetType, targetCityId } = meta;

  // ── Load sending city ──────────────────────────────────────────────────────
  const city = await prisma.city.findUnique({ where: { id: scoutingCityId } });
  if (!city) {
    console.warn(`[scout resolver] origin city ${scoutingCityId} no longer exists — scouts lost`);
    return;
  }

  // ── Read current troops on the target tile ─────────────────────────────────
  let realTroops: TroopMap = {};
  let garrisonDetected = false;

  if (targetType === 'neutral') {
    const ng = await prisma.neutralGarrison.findUnique({ where: { x_y: { x: targetX, y: targetY } } });
    if (ng && !ng.everCleared) {
      realTroops = ng.troops as TroopMap;
    }
  } else if (targetType === 'enemy_city') {
    const enemyCity = targetCityId
      ? await prisma.city.findUnique({ where: { id: targetCityId } })
      : await prisma.city.findUnique({ where: { x_y: { x: targetX, y: targetY } } });
    if (enemyCity) {
      realTroops = enemyCity.troops as TroopMap;
    }
  } else if (targetType === 'enemy_domain') {
    const dt = await prisma.domainTile.findUnique({ where: { x_y: { x: targetX, y: targetY } } });
    if (dt) {
      realTroops = dt.troops as TroopMap;
    }
  }

  // ── Compute accuracy ───────────────────────────────────────────────────────
  const totalEnemyCount = Object.values(realTroops).reduce((s, n) => s + (n ?? 0), 0);
  garrisonDetected      = totalEnemyCount > 0;
  const accuracy        = computeScoutAccuracy(scoutCount, totalEnemyCount);

  // ── Build reported troops (noise applied per unit type) ────────────────────
  const reportedTroops: TroopMap = {};
  for (const [uid, cnt] of Object.entries(realTroops) as [UnitId, number][]) {
    if (!cnt) continue;
    // At very low accuracy, the player does always learn WHICH unit types are
    // present — only the *counts* are distorted.
    reportedTroops[uid] = applyScoutNoise(cnt, accuracy);
  }

  // ── Create scouting ActivityReport ────────────────────────────────────────
  const scoutReport: ScoutingReportMeta = {
    targetX,
    targetY,
    targetType,
    accuracy,
    reportedTroops,
    garrisonDetected,
  };

  await prisma.$transaction(async (tx) => {
    // Return scouts to garrison
    const fresh      = await tx.city.findUniqueOrThrow({ where: { id: scoutingCityId } });
    const garrison   = fresh.troops as unknown as TroopMap;
    const restored: TroopMap = {
      ...garrison,
      scout: (garrison['scout'] ?? 0) + scoutCount,
    };
    await tx.city.update({ where: { id: scoutingCityId }, data: { troops: restored } });

    // Create ActivityReport
    await tx.activityReport.create({
      data: {
        playerId:        job.playerId,
        activityType:    'scouting',
        xpAwarded:       0,
        skillXpAwarded:  {},
        resources:       {},
        damageTaken:     0,
        cityId:          scoutingCityId,
        meta:            scoutReport as unknown as object,
      },
    });
  });

  // ── Notify player ──────────────────────────────────────────────────────────
  const socketId = playerSockets.get(job.playerId);
  if (socketId) {
    // Reuse job:update so the client knows the scout job is done
    const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
    if (updatedJob) {
      io.to(socketId).emit('job:update', { jobs: [updatedJob] });
    }
  }
}
