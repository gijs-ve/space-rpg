import { Job }               from '@prisma/client';
import { prisma }             from '../../db/client';
import { io, playerSockets }  from '../../index';
import {
  TroopMap,
  ContestJobMeta,
  simulateWaveBattle,
  computeExtraDomainCapacity,
  CityBuilding,
} from '@rpg/shared';
import type { DomainContestResultPayload } from '@rpg/shared';
import { mergeWaves, computeSurvivingDefenders, returnTroopsTx } from '../../services/domain.service';

// ─────────────────────────────────────────────────────────────────────────────

export async function resolveContestJob(job: Job): Promise<void> {
  const meta = job.metadata as unknown as ContestJobMeta;
  const { attackerCityId, targetX, targetY, waves } = meta;

  // ── Load attacker city ─────────────────────────────────────────────────────
  const city = await prisma.city.findUnique({ where: { id: attackerCityId } });
  if (!city) {
    console.warn(`[contest resolver] city ${attackerCityId} no longer exists`);
    return;
  }

  // ── Check target tile still has an enemy garrison ──────────────────────────
  const domainTile = await prisma.domainTile.findUnique({
    where:   { x_y: { x: targetX, y: targetY } },
    include: { city: { select: { id: true, playerId: true, name: true } } },
  });

  if (!domainTile || domainTile.cityId === attackerCityId) {
    // Nothing to contest — return original troops
    await returnTroopsTx(attackerCityId, mergeWaves(waves as TroopMap[]));
    emitContestResult(job.playerId, {
      success: false,
      reason:  domainTile ? 'Cannot contest your own garrison' : 'No garrison found on arrival',
      attackerCityId,
      targetX,
      targetY,
      battle:  false,
    });
    return;
  }

  // ── Battle against the garrison ────────────────────────────────────────────
  const defenderGarrison = domainTile.troops as unknown as TroopMap;
  const battleReport     = simulateWaveBattle(waves as TroopMap[], defenderGarrison, 10);
  battleReport.attackerCityName = city.name;
  battleReport.defenderCityName = domainTile.city.name;

  const [attackerReport, defenderReport] = await Promise.all([
    prisma.activityReport.create({
      data: {
        playerId:       job.playerId,
        activityType:   'domain_contest',
        xpAwarded:      0,
        skillXpAwarded: {},
        resources:      {},
        damageTaken:    0,
        cityId:         attackerCityId,
        meta:           battleReport as unknown as object,
      },
    }),
    prisma.activityReport.create({
      data: {
        playerId:       domainTile.city.playerId,
        activityType:   'domain_contest_defence',
        xpAwarded:      0,
        skillXpAwarded: {},
        resources:      {},
        damageTaken:    0,
        cityId:         domainTile.city.id,
        meta:           battleReport as unknown as object,
      },
    }),
  ]);

  const defSock = playerSockets.get(domainTile.city.playerId);
  const survivingDefenderTroops = computeSurvivingDefenders(defenderGarrison, battleReport.totalDefenderCasualties);

  if (battleReport.attackerWon) {
    // ── Check if attacker can auto-claim (adjacent + capacity) ─────────────
    const [attackerDomainTiles, attackerCityData] = await Promise.all([
      prisma.domainTile.findMany({ where: { cityId: attackerCityId } }),
      prisma.city.findUnique({ where: { id: attackerCityId }, select: { buildings: true } }),
    ]);
    const ownCoords = new Set<string>([`${city.x},${city.y}`]);
    for (const dt of attackerDomainTiles) ownCoords.add(`${dt.x},${dt.y}`);
    const isAdjacent =
      ownCoords.has(`${targetX - 1},${targetY}`) ||
      ownCoords.has(`${targetX + 1},${targetY}`) ||
      ownCoords.has(`${targetX},${targetY - 1}`) ||
      ownCoords.has(`${targetX},${targetY + 1}`);
    const extraCapacity = attackerCityData
      ? computeExtraDomainCapacity(attackerCityData.buildings as unknown as CityBuilding[])
      : 0;
    const autoClaim = isAdjacent && attackerDomainTiles.length < extraCapacity;

    const attackerSurvivors = battleReport.survivingAttackerTroops;

    // ── Attacker wins: destroy garrison, optionally auto-claim ───────────────
    await prisma.$transaction(async (tx) => {
      await tx.domainTile.delete({ where: { id: domainTile.id } });

      if (autoClaim) {
        // Claim the tile; surviving attacker troops become the garrison
        await tx.domainTile.create({
          data: {
            x:      targetX,
            y:      targetY,
            cityId: attackerCityId,
            troops: attackerSurvivors as unknown as object,
          },
        });
      } else {
        if (Object.values(attackerSurvivors).some((n) => (n ?? 0) > 0)) {
          await returnTroopsTx(attackerCityId, attackerSurvivors, tx);
        }
      }

      if (Object.values(survivingDefenderTroops).some((n) => (n ?? 0) > 0)) {
        await returnTroopsTx(domainTile.city.id, survivingDefenderTroops, tx);
      }
    });

    emitContestResult(job.playerId, {
      success:     true,
      attackerCityId,
      targetX,
      targetY,
      battle:      true,
      attackerWon: true,
      tileClaimed: autoClaim,
      report:      battleReport as unknown as Record<string, unknown>,
      reportId:    attackerReport.id,
    });

    if (defSock) io.to(defSock).emit('domain:lost', { x: targetX, y: targetY, attackerCityId, reportId: defenderReport.id });
  } else {
    // ── Defender holds: update garrison (reduced), return attacker survivors ──
    await prisma.$transaction(async (tx) => {
      await tx.domainTile.update({
        where: { id: domainTile.id },
        data:  { troops: survivingDefenderTroops },
      });

      const survivors = battleReport.survivingAttackerTroops;
      if (Object.values(survivors).some((n) => (n ?? 0) > 0)) {
        await returnTroopsTx(attackerCityId, survivors, tx);
      }
    });

    emitContestResult(job.playerId, {
      success:     false,
      reason:      'Garrison held',
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emitContestResult(playerId: string, payload: DomainContestResultPayload): void {
  const sock = playerSockets.get(playerId);
  if (sock) io.to(sock).emit('domain:contestResult', payload);
}
