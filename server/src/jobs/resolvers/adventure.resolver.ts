import { Job, Hero } from '@prisma/client';
import { prisma } from '../../db/client';
import { recalculateHeroProgression } from '../../services/hero.service';
import { io, playerSockets } from '../../index';
import {
  ACTIVITIES,
  ActivityType,
  AdventureJobMeta,
  SkillId,
  SKILLS,
  ResourceMap,
  computeAdventureDuration,
  rollLootTable,
} from '@rpg/shared';
import { ItemLocation } from '@prisma/client';

export async function resolveAdventureJob(job: Job) {
  const meta = job.metadata as unknown as AdventureJobMeta;
  const actDef = ACTIVITIES[meta.activityType as ActivityType];

  const hero = await prisma.hero.findUniqueOrThrow({ where: { playerId: job.playerId } });

  // ── Compute rewards ────────────────────────────────────────────────────────
  const [minXp, maxXp] = actDef.rewards.xpRange;
  const xpGained = minXp + Math.floor(Math.random() * (maxXp - minXp + 1));

  // Gathering skill bonus applied on top of rolled resource amounts
  const skillLevels = hero.skillLevels as unknown as Record<SkillId, number>;
  const gatheringLevel = skillLevels.gathering ?? 0;
  const gatheringBonus = 1 + gatheringLevel * (SKILLS.gathering.bonusPerLevel['gatheringBonus'] ?? 0) / 100;

  // Each entry in rewards.resources is a [min, max] tuple — roll within range
  const rewardedResources: Partial<ResourceMap> = {};
  for (const [rKey, rRange] of Object.entries(actDef.rewards.resources)) {
    if (Array.isArray(rRange) && rRange.length === 2) {
      const [minR, maxR] = rRange as [number, number];
      const rolled = minR + Math.floor(Math.random() * (maxR - minR + 1));
      rewardedResources[rKey as keyof ResourceMap] = Math.floor(rolled * gatheringBonus);
    }
  }

  // Skill XP
  const skillXpGains = actDef.rewards.skillXp;
  const currentSkillXp = hero.skillXp as unknown as Record<SkillId, number>;
  const newSkillXp: Record<SkillId, number> = { ...currentSkillXp };
  for (const [sId, sXp] of Object.entries(skillXpGains)) {
    if (typeof sXp === 'number') {
      newSkillXp[sId as SkillId] = (newSkillXp[sId as SkillId] ?? 0) + sXp;
    }
  }

  // Apply resource rewards to player's first city (adventure rewards go to first city)
  const city = await prisma.city.findFirst({ where: { playerId: job.playerId } });
  if (city) {
    const cityResources = city.resources as unknown as ResourceMap;
    const storageCap    = city.storageCap  as unknown as ResourceMap;
    const updatedResources = { ...cityResources };
    for (const [rKey, rVal] of Object.entries(rewardedResources)) {
      const cap = storageCap[rKey as keyof ResourceMap] ?? Infinity;
      updatedResources[rKey as keyof ResourceMap] = Math.min(
        (updatedResources[rKey as keyof ResourceMap] ?? 0) + (rVal ?? 0),
        cap
      );
    }
    await prisma.city.update({ where: { id: city.id }, data: { resources: updatedResources } });
  }

  // Update hero XP + skill XP
  const updatedHero = await prisma.hero.update({
    where: { id: hero.id },
    data:  { xp: hero.xp + xpGained, skillXp: newSkillXp },
  });

  // Recalculate levels
  await recalculateHeroProgression(hero.id);

  const finalHero = await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } });

  // ── Generate item drops via loot table ────────────────────────────────────
  const droppedItemIds = rollLootTable(actDef.lootTable ?? []);
  let reportId: string | null = null;

  if (droppedItemIds.length > 0 || true) {
    // Always create a report so the player sees XP/resource summary
    const report = await prisma.activityReport.create({
      data: {
        playerId: job.playerId,
        activityType: meta.activityType,
        xpAwarded:   xpGained,
        resources:   rewardedResources,
      },
    });
    reportId = report.id;

    // Create item instances linked to the report
    if (droppedItemIds.length > 0) {
      await prisma.itemInstance.createMany({
        data: droppedItemIds.map((itemId) => ({
          itemDefId: itemId,
          location:  ItemLocation.activity_report,
          reportId:  report.id,
          rotated:   false,
        })),
      });
    }
  }

  // ── Emit socket event ──────────────────────────────────────────────────────
  const socketId = playerSockets.get(job.playerId);
  if (socketId) {
    io.to(socketId).emit('adventure:complete', {
      jobId: job.id,
      hero:  finalHero as any,
      rewards: { xp: xpGained, resources: rewardedResources, skillXp: skillXpGains as any },
    });
  }
}
