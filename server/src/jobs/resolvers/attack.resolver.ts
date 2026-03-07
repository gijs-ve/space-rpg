import { Job }                    from '@prisma/client';
import { prisma }                 from '../../db/client';
import { io, playerSockets }      from '../../index';
import {
  TroopMap,
  UnitId,
  UNITS,
  BUILDINGS,
  CityBuilding,
  ResourceMap,
  ResourceType,
  AttackJobMeta,
  simulateWaveBattle,
  subtractResources,
  addResourcesWithCap,
} from '@rpg/shared';
import { computeStorageCap } from '../../services/base.service';

// ─────────────────────────────────────────────────────────────────────────────

export async function resolveAttackJob(job: Job): Promise<void> {
  const meta = job.metadata as unknown as AttackJobMeta;
  const { attackerCityId, targetCityId, waves } = meta;

  // ── Load both cities ───────────────────────────────────────────────────────
  const [attackerCity, targetCity] = await Promise.all([
    prisma.city.findUnique({ where: { id: attackerCityId } }),
    prisma.city.findUnique({ where: { id: targetCityId } }),
  ]);

  // Guard: cities may have been deleted since the attack was dispatched
  if (!attackerCity || !targetCity) {
    console.warn(`[attack resolver] city missing — attackerCity=${!!attackerCity} targetCity=${!!targetCity}`);
    // Return surviving troops to attacker if possible
    if (attackerCity) {
      const garrison = attackerCity.troops as unknown as TroopMap;
      const restored: TroopMap = { ...garrison };
      for (const wave of waves as TroopMap[]) {
        for (const [uid, cnt] of Object.entries(wave) as [UnitId, number][]) {
          restored[uid] = (restored[uid] ?? 0) + (cnt ?? 0);
        }
      }
      await prisma.city.update({ where: { id: attackerCityId }, data: { troops: restored } });
    }
    return;
  }

  // ── Compute wall bonus ─────────────────────────────────────────────────────
  const targetBuildings = targetCity.buildings as unknown as CityBuilding[];
  let wallBonus = 10; // default 10% defender advantage
  const defenseGridSlot = targetBuildings.find((b) => b.buildingId === 'defense_grid');
  if (defenseGridSlot) {
    const levelDef = BUILDINGS['defense_grid'].levels[defenseGridSlot.level - 1];
    wallBonus += levelDef?.effect.defenseBonus ?? 0;
  }

  // ── Run battle ────────────────────────────────────────────────────────────
  const defenderTroops   = targetCity.troops as unknown as TroopMap;
  const battleReport     = simulateWaveBattle(waves as TroopMap[], defenderTroops, wallBonus);

  // Add city names for human-readable reports
  battleReport.attackerCityName  = attackerCity.name;
  battleReport.defenderCityName  = targetCity.name;

  // ── Compute plunder ───────────────────────────────────────────────────────
  let resourcesPlundered: Partial<ResourceMap> = {};
  if (battleReport.attackerWon) {
    const totalCarry = Object.entries(battleReport.survivingAttackerTroops).reduce(
      (sum, [uid, cnt]) => sum + (UNITS[uid as UnitId]?.stats.carry ?? 0) * (cnt ?? 0),
      0,
    );
    const defResources   = targetCity.resources as unknown as ResourceMap;
    const totalResources = (Object.values(defResources) as number[]).reduce((a, b) => a + b, 0);
    const ratio          = totalResources > 0 ? Math.min(1, totalCarry / totalResources) : 0;

    for (const [key, val] of Object.entries(defResources) as [ResourceType, number][]) {
      const stolen = Math.floor(val * ratio);
      if (stolen > 0) resourcesPlundered[key] = stolen;
    }
  }
  battleReport.resourcesPlundered = resourcesPlundered;

  // ── Apply changes atomically ──────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    // Update defender garrison
    const newDefenderTroops: TroopMap = { ...defenderTroops };
    for (const [uid, cas] of Object.entries(battleReport.totalDefenderCasualties) as [UnitId, number][]) {
      newDefenderTroops[uid] = Math.max(0, (newDefenderTroops[uid] ?? 0) - (cas ?? 0));
    }

    let newTargetResources = targetCity.resources as unknown as ResourceMap;
    if (Object.keys(resourcesPlundered).length > 0) {
      // Fill missing resource keys so subtractResources doesn't choke
      const fullPlunder = Object.fromEntries(
        Object.entries(resourcesPlundered).map(([k, v]) => [k, v ?? 0])
      ) as ResourceMap;
      newTargetResources = subtractResources(newTargetResources, fullPlunder);
    }

    await tx.city.update({
      where: { id: targetCityId },
      data:  { troops: newDefenderTroops, resources: newTargetResources },
    });

    // Return surviving attacker troops + plunder
    const freshAttacker       = await tx.city.findUniqueOrThrow({ where: { id: attackerCityId } });
    const currentGarrison     = freshAttacker.troops as unknown as TroopMap;
    const newAttackerTroops: TroopMap = { ...currentGarrison };
    for (const [uid, cnt] of Object.entries(battleReport.survivingAttackerTroops) as [UnitId, number][]) {
      newAttackerTroops[uid] = (newAttackerTroops[uid] ?? 0) + (cnt ?? 0);
    }

    const currentResources   = freshAttacker.resources as unknown as ResourceMap;
    const attackerBuildings   = freshAttacker.buildings as unknown as CityBuilding[];
    const storageCap          = computeStorageCap(attackerBuildings);
    const plunderAsFullMap    = Object.fromEntries(
      Object.entries(resourcesPlundered).map(([k, v]) => [k, v ?? 0])
    ) as ResourceMap;
    const newAttackerResources = addResourcesWithCap(currentResources, plunderAsFullMap, storageCap);

    await tx.city.update({
      where: { id: attackerCityId },
      data:  { troops: newAttackerTroops, resources: newAttackerResources },
    });
  });

  // ── Create activity reports for both players ──────────────────────────────
  const plunderForReport = Object.fromEntries(
    Object.entries(resourcesPlundered).filter(([, v]) => (v ?? 0) > 0)
  ) as Partial<ResourceMap>;

  const [attackerReport, defenderReport] = await Promise.all([
    prisma.activityReport.create({
      data: {
        playerId:        job.playerId,
        activityType:    'player_attack',
        xpAwarded:       0,
        skillXpAwarded:  {},
        resources:       plunderForReport,
        damageTaken:     0,
        cityId:          attackerCityId,
        meta:            battleReport as unknown as object,
      },
    }),
    prisma.activityReport.create({
      data: {
        playerId:        targetCity.playerId,
        activityType:    'player_defence',
        xpAwarded:       0,
        skillXpAwarded:  {},
        resources:       {},
        damageTaken:     0,
        cityId:          targetCityId,
        meta:            battleReport as unknown as object,
      },
    }),
  ]);

  // ── Emit socket events ─────────────────────────────────────────────────────
  const attackerSocketId = playerSockets.get(job.playerId);
  if (attackerSocketId) {
    io.to(attackerSocketId).emit('attack:complete', {
      jobId:            job.id,
      attackerCityId,
      targetCityId,
      attackerWon:      battleReport.attackerWon,
      attackerReportId: attackerReport.id,
    });
  }

  const defenderSocketId = playerSockets.get(targetCity.playerId);
  if (defenderSocketId) {
    io.to(defenderSocketId).emit('base:attacked', {
      targetCityId,
      defenceReportId: defenderReport.id,
    });
  }
}
