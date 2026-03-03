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
  EMPTY_RESOURCES,
  computeAdventureDuration,
} from '@rpg/shared';

export async function resolveAdventureJob(job: Job) {
  const meta = job.metadata as unknown as AdventureJobMeta;
  const actDef = ACTIVITIES[meta.activityType as ActivityType];

  const hero = await prisma.hero.findUniqueOrThrow({ where: { playerId: job.playerId } });

  // ── Compute rewards ────────────────────────────────────────────────────────
  const [minXp, maxXp] = actDef.rewards.xpRange;
  const xpGained = minXp + Math.floor(Math.random() * (maxXp - minXp + 1));

  // Gathering skill bonus on resources
  const skillLevels = hero.skillLevels as unknown as Record<SkillId, number>;
  const gatheringLevel  = skillLevels.gathering ?? 0;
  const gatheringBonus  = 1 + gatheringLevel * (SKILLS.gathering.bonusPerLevel['gatheringBonus'] ?? 0) / 100;

  const rewardedResources: Partial<ResourceMap> = {};
  for (const [rKey, rBaseVal] of Object.entries(actDef.rewards.resources)) {
    if (typeof rBaseVal === 'number') {
      rewardedResources[rKey as keyof ResourceMap] = Math.floor(rBaseVal * gatheringBonus);
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
