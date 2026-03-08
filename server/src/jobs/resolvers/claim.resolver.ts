import { Job }               from '@prisma/client';
import { prisma }             from '../../db/client';
import { io, playerSockets }  from '../../index';
import {
  TroopMap,
  CityBuilding,
  ClaimJobMeta,
  computeExtraDomainCapacity,
  simulateWaveBattle,
} from '@rpg/shared';
import type { DomainClaimResultPayload } from '@rpg/shared';
import { mergeWaves, computeSurvivingDefenders, returnTroopsTx } from '../../services/domain.service';

// ─────────────────────────────────────────────────────────────────────────────

export async function resolveClaimJob(job: Job): Promise<void> {
  const meta = job.metadata as unknown as ClaimJobMeta;
  const { attackerCityId, targetX, targetY, waves } = meta;

  // ── Load attacker city ─────────────────────────────────────────────────────
  const city = await prisma.city.findUnique({ where: { id: attackerCityId } });
  if (!city) {
    console.warn(`[claim resolver] city ${attackerCityId} no longer exists`);
    return;
  }

  // ── Re-validate adjacency and capacity (state may have changed in transit) ─
  const domainTiles = await prisma.domainTile.findMany({ where: { cityId: attackerCityId } });
  const ownCoords   = new Set<string>([`${city.x},${city.y}`]);
  for (const dt of domainTiles) ownCoords.add(`${dt.x},${dt.y}`);

  const isAdjacent =
    ownCoords.has(`${targetX - 1},${targetY}`) ||
    ownCoords.has(`${targetX + 1},${targetY}`) ||
    ownCoords.has(`${targetX},${targetY - 1}`) ||
    ownCoords.has(`${targetX},${targetY + 1}`);

  const buildings     = city.buildings as unknown as CityBuilding[];
  const extraCapacity = computeExtraDomainCapacity(buildings);
  const hasCapacity   = domainTiles.length < extraCapacity;

  // Return troops if claim is no longer valid
  if (!isAdjacent || !hasCapacity) {
    await returnTroopsTx(attackerCityId, mergeWaves(waves as TroopMap[]));
    emitClaimResult(job.playerId, {
      success: false,
      reason: !hasCapacity ? 'Domain full' : 'No longer adjacent',
      attackerCityId,
      targetX,
      targetY,
    });
    return;
  }

  // ── Check for conflict at arrival ──────────────────────────────────────────
  // Case A: another city has appeared here (shouldn't happen, but be safe)
  const cityOnTile = await prisma.city.findUnique({
    where: { x_y: { x: targetX, y: targetY } },
    select: { id: true, playerId: true, troops: true, name: true },
  });
  if (cityOnTile) {
    await returnTroopsTx(attackerCityId, mergeWaves(waves as TroopMap[]));
    emitClaimResult(job.playerId, {
      success: false,
      reason: 'Tile now has a city',
      attackerCityId,
      targetX,
      targetY,
    });
    return;
  }

  // Case B: another player's domain tile appeared here while marching
  const existingDomain = await prisma.domainTile.findUnique({
    where: { x_y: { x: targetX, y: targetY } },
    include: { city: { select: { playerId: true, name: true } } },
  });

  if (existingDomain && existingDomain.cityId !== attackerCityId) {
    // Fight against the garrison on this tile
    const defenderGarrison = existingDomain.troops as unknown as TroopMap;
    const battleReport     = simulateWaveBattle(waves as TroopMap[], defenderGarrison, 10);
    battleReport.attackerCityName = city.name;
    battleReport.defenderCityName = existingDomain.city.name;

    const [attackerReport, defenderReport] = await Promise.all([
      prisma.activityReport.create({
        data: {
          playerId:      job.playerId,
          activityType:  'domain_claim',
          xpAwarded:     0,
          skillXpAwarded: {},
          resources:     {},
          damageTaken:   0,
          cityId:        attackerCityId,
          meta:          battleReport as unknown as object,
        },
      }),
      prisma.activityReport.create({
        data: {
          playerId:      existingDomain.city.playerId,
          activityType:  'domain_claim_defence',
          xpAwarded:     0,
          skillXpAwarded: {},
          resources:     {},
          damageTaken:   0,
          cityId:        existingDomain.cityId,
          meta:          battleReport as unknown as object,
        },
      }),
    ]);

    const defSock = playerSockets.get(existingDomain.city.playerId);

    if (battleReport.attackerWon) {
      // Attacker wins: take the tile; return any surviving defender troops to their city
      const survivingDefenderTroops = computeSurvivingDefenders(defenderGarrison, battleReport.totalDefenderCasualties);
      await prisma.$transaction(async (tx) => {
        await tx.domainTile.delete({ where: { id: existingDomain.id } });
        await tx.domainTile.create({
          data: {
            cityId: attackerCityId,
            x:      targetX,
            y:      targetY,
            troops: battleReport.survivingAttackerTroops,
          },
        });
        if (Object.values(survivingDefenderTroops).some((n) => (n ?? 0) > 0)) {
          await returnTroopsTx(existingDomain.cityId, survivingDefenderTroops, tx);
        }
      });

      emitClaimResult(job.playerId, {
        success:     true,
        attackerCityId,
        targetX,
        targetY,
        battle:      true,
        attackerWon: true,
        report:      battleReport as unknown as Record<string, unknown>,
        reportId:    attackerReport.id,
      });

      if (defSock) io.to(defSock).emit('domain:lost', { x: targetX, y: targetY, attackerCityId, reportId: defenderReport.id });
    } else {
      // Defender holds — return surviving attacker troops
      const survivingDefenderTroops = computeSurvivingDefenders(defenderGarrison, battleReport.totalDefenderCasualties);
      const survivors               = battleReport.survivingAttackerTroops;
      await prisma.$transaction(async (tx) => {
        await tx.domainTile.update({
          where: { id: existingDomain.id },
          data:  { troops: survivingDefenderTroops },
        });
        if (Object.values(survivors).some((n) => (n ?? 0) > 0)) {
          await returnTroopsTx(attackerCityId, survivors, tx);
        }
      });

      emitClaimResult(job.playerId, {
        success:     false,
        reason:      'Tile defended',
        attackerCityId,
        targetX,
        targetY,
        battle:      true,
        attackerWon: false,
        report:      battleReport as unknown as Record<string, unknown>,
        reportId:    attackerReport.id,
      });

      if (defSock) io.to(defSock).emit('domain:defended', { x: targetX, y: targetY, attackerCityId, reportId: defenderReport.id });
    }
    return;
  }

  // ── Uncontested claim ──────────────────────────────────────────────────────
  await prisma.domainTile.create({
    data: {
      cityId: attackerCityId,
      x:      targetX,
      y:      targetY,
      troops: mergeWaves(waves as TroopMap[]),
    },
  });

  emitClaimResult(job.playerId, {
    success: true,
    attackerCityId,
    targetX,
    targetY,
    battle:  false,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emitClaimResult(playerId: string, payload: DomainClaimResultPayload): void {
  const sock = playerSockets.get(playerId);
  if (sock) io.to(sock).emit('domain:claimResult', payload);
}
