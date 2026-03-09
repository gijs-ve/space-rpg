import { Job }               from '@prisma/client';
import { prisma }             from '../../db/client';
import { io, playerSockets }  from '../../index';
import {
  TroopMap,
  UnitId,
  UnitStats,
  CityBuilding,
  ClaimJobMeta,
  computeExtraDomainCapacity,
  simulateWaveBattle,
  CIVILIZATIONS,
  CivId,
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

  // ── Resolve attacker civ stat bonuses ─────────────────────────────────────
  const attackerStatBonuses = CIVILIZATIONS[city.civId as CivId]?.bonuses?.unitStatBonus as Partial<Record<UnitId, Partial<UnitStats>>> | undefined;

  // ── Re-validate adjacency and capacity (state may have changed in transit) ─
  const domainTiles = await prisma.domainTile.findMany({ where: { cityId: attackerCityId } });
  const ownCoords   = new Set<string>([`${city.x},${city.y}`]);
  for (const dt of domainTiles) ownCoords.add(`${dt.x},${dt.y}`);

  const isAdjacent =
    ownCoords.has(`${targetX - 1},${targetY}`) ||
    ownCoords.has(`${targetX + 1},${targetY}`) ||
    ownCoords.has(`${targetX},${targetY - 1}`) ||
    ownCoords.has(`${targetX},${targetY + 1}`);

  // ── Fight neutral garrison before anything else ────────────────────────────
  let effectiveWaves: TroopMap[] = waves as TroopMap[];

  const neutralGarrison = await prisma.neutralGarrison.findUnique({
    where: { x_y: { x: targetX, y: targetY } },
  });

  if (neutralGarrison && !neutralGarrison.everCleared) {
    const neutralTroops = neutralGarrison.troops as TroopMap;
    const hasNeutrals   = Object.values(neutralTroops).some((n) => (n ?? 0) > 0);

    if (hasNeutrals) {
      const neutralBattle = simulateWaveBattle(effectiveWaves, neutralTroops, 0, attackerStatBonuses);
      neutralBattle.attackerCityName = city.name;
      neutralBattle.defenderCityName = 'Neutral Forces';

      const survivingNeutralTroops = computeSurvivingDefenders(neutralTroops, neutralBattle.totalDefenderCasualties);
      const allNeutralsCleared     = Object.values(survivingNeutralTroops).every((n) => (n ?? 0) === 0);

      // Persist garrison state (survivors / cleared flag)
      await prisma.neutralGarrison.update({
        where: { x_y: { x: targetX, y: targetY } },
        data: {
          troops:      survivingNeutralTroops as object,
          everCleared: allNeutralsCleared,
        },
      });

      // Save activity report for the attacker
      const neutralReport = await prisma.activityReport.create({
        data: {
          playerId:       job.playerId,
          activityType:   'domain_claim',
          xpAwarded:      0,
          skillXpAwarded: {},
          resources:      {},
          damageTaken:    0,
          cityId:         attackerCityId,
          meta:           neutralBattle as unknown as object,
        },
      });

      if (!neutralBattle.attackerWon) {
        // Player loses to neutral garrison — troops return
        const survivors = neutralBattle.survivingAttackerTroops;
        if (Object.values(survivors).some((n) => (n ?? 0) > 0)) {
          await returnTroopsTx(attackerCityId, survivors);
        }
        emitClaimResult(job.playerId, {
          success:     false,
          reason:      'Defeated by neutral garrison',
          attackerCityId,
          targetX,
          targetY,
          battle:      true,
          attackerWon: false,
          report:      neutralBattle as unknown as Record<string, unknown>,
          reportId:    neutralReport.id,
        });
        return;
      }

      // Player won the neutral fight — surviving waves continue march
      effectiveWaves = [neutralBattle.survivingAttackerTroops, {}, {}];
    }
  }

  // Return troops if no longer adjacent (state may have changed in transit)
  // Neutral garrison is already cleared at this point (if it existed), so that's fine.
  if (!isAdjacent) {
    await returnTroopsTx(attackerCityId, mergeWaves(effectiveWaves));
    emitClaimResult(job.playerId, {
      success: false,
      reason:  'No longer adjacent',
      attackerCityId,
      targetX,
      targetY,
    });
    return;
  }

  // Check capacity here (after adjacency) — if full, troops march but return without claiming
  const buildings     = city.buildings as unknown as CityBuilding[];
  const extraCapacity = computeExtraDomainCapacity(buildings);
  const hasCapacity   = domainTiles.length < extraCapacity;

  // ── Check for conflict at arrival ──────────────────────────────────────────
  // Case A: another city has appeared here (shouldn't happen, but be safe)
  const cityOnTile = await prisma.city.findUnique({
    where: { x_y: { x: targetX, y: targetY } },
    select: { id: true, playerId: true, troops: true, name: true },
  });
  if (cityOnTile) {
    await returnTroopsTx(attackerCityId, mergeWaves(effectiveWaves));
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
    const battleReport     = simulateWaveBattle(effectiveWaves, defenderGarrison, 10, attackerStatBonuses);
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
      // Attacker wins: destroy garrison. Claim tile only if capacity allows, else leave it neutral.
      const survivingDefenderTroops = computeSurvivingDefenders(defenderGarrison, battleReport.totalDefenderCasualties);
      await prisma.$transaction(async (tx) => {
        await tx.domainTile.delete({ where: { id: existingDomain.id } });
        if (hasCapacity) {
          await tx.domainTile.create({
            data: {
              cityId: attackerCityId,
              x:      targetX,
              y:      targetY,
              troops: battleReport.survivingAttackerTroops,
            },
          });
        } else {
          // Domain full — surviving attacker troops march home
          if (Object.values(battleReport.survivingAttackerTroops).some((n) => (n ?? 0) > 0)) {
            await returnTroopsTx(attackerCityId, battleReport.survivingAttackerTroops, tx);
          }
        }
        if (Object.values(survivingDefenderTroops).some((n) => (n ?? 0) > 0)) {
          await returnTroopsTx(existingDomain.cityId, survivingDefenderTroops, tx);
        }
      });

      emitClaimResult(job.playerId, {
        success:     hasCapacity,
        reason:      hasCapacity ? undefined : 'Domain full — tile left neutral',
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

  // ── Uncontested arrival ─────────────────────────────────────────────────
  if (!hasCapacity) {
    // Domain full — march completes but no tile is created; troops return home
    await returnTroopsTx(attackerCityId, mergeWaves(effectiveWaves));
    emitClaimResult(job.playerId, {
      success: false,
      reason:  'Domain full — tile not claimed',
      attackerCityId,
      targetX,
      targetY,
    });
    return;
  }

  await prisma.domainTile.create({
    data: {
      cityId: attackerCityId,
      x:      targetX,
      y:      targetY,
      troops: mergeWaves(effectiveWaves),
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
