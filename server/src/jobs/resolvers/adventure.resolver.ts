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
  computeAdventureDamage,
  rollLootTable,
  sumHeroItemBonuses,
  HEALTH_REGEN_INTERVAL_SECONDS,
} from '@rpg/shared';
import { ItemLocation } from '@prisma/client';
import { TIMER_DIVISOR } from '../../config';

export async function resolveAdventureJob(job: Job) {
  const meta   = job.metadata as unknown as AdventureJobMeta;
  const actDef = ACTIVITIES[meta.activityType as ActivityType];

  // Prefer the heroId stored on the job row (added in multi-hero migration).
  // Fall back to meta.heroId, and finally to a playerId lookup for
  // pre-migration adventure jobs that have neither.
  const heroId = (job as any).heroId ?? meta.heroId ?? null;
  const hero = heroId
    ? await prisma.hero.findUniqueOrThrow({ where: { id: heroId } })
    : await prisma.hero.findFirstOrThrow({ where: { playerId: job.playerId } });

  // ── Compute rewards ────────────────────────────────────────────────────────
  const [minXp, maxXp] = actDef.rewards.xpRange;
  const xpGained = minXp + Math.floor(Math.random() * (maxXp - minXp + 1));

  // Load bonuses from items the hero is currently carrying / wearing.
  const heroItems = await prisma.itemInstance.findMany({
    where: {
      heroId: hero.id,
      location: { in: [ItemLocation.hero_inventory, ItemLocation.hero_equipped] },
    },
    select: { itemDefId: true, location: true },
  });
  const itemBonuses = sumHeroItemBonuses(heroItems);

  // Hero skill levels — used for both damage and reward calculations.
  const skillLevels = hero.skillLevels as unknown as Record<SkillId, number>;

  // ── Compute damage taken ────────────────────────────────────────────────────
  // Defence + attack both mitigate damage (attack at 30% the weight of defence).
  const effectiveDefense = 5 + (itemBonuses.defenseBonus ?? 0);
  const effectiveAttack  = 10
    + (skillLevels.combat ?? 0) * 5   // matches SKILLS.combat.bonusPerLevel.attackBonus
    + (itemBonuses.attackBonus ?? 0);
  const [rawDamageMin, rawDamageMax] = actDef.baseDamageRange;
  const rawDamage = rawDamageMin + Math.floor(Math.random() * (rawDamageMax - rawDamageMin + 1));
  const damageTaken = computeAdventureDamage(rawDamage, effectiveDefense, effectiveAttack);

  // Gathering bonus = skill contribution + item contribution (both in %).
  const gatheringLevel    = skillLevels.observation ?? 0;
  const skillGatheringPct = gatheringLevel * (SKILLS.observation.bonusPerLevel['gatheringBonus'] ?? 0);
  const itemGatheringPct  = itemBonuses.gatheringBonus ?? 0;
  const gatheringBonus    = 1 + (skillGatheringPct + itemGatheringPct) / 100;

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

  // ── Apply accumulated health regen + damage ────────────────────────────────
  // The resolver must advance lastHealthRegen so that getHeroWithRegen (called on
  // the next GET /hero) doesn't retroactively "undo" the damage by crediting all
  // the regen ticks that accumulated while the adventure was running.
  const healthInterval = HEALTH_REGEN_INTERVAL_SECONDS / TIMER_DIVISOR;
  const now            = new Date();
  const lastRegen      = hero.lastHealthRegen ?? now;
  const healthElapsed  = (now.getTime() - lastRegen.getTime()) / 1000;
  const regenPoints    = Math.min(
    Math.floor(healthElapsed / healthInterval),
    (hero.maxHealth ?? 100) - hero.health,
  );
  const usedRegenSeconds   = regenPoints * healthInterval;
  const newLastHealthRegen = new Date(lastRegen.getTime() + usedRegenSeconds * 1000);
  const healthAfterRegen   = Math.min(hero.health + regenPoints, hero.maxHealth ?? 100);
  const newHealth          = Math.max(0, healthAfterRegen - damageTaken);

  const updatedHero = await prisma.hero.update({
    where: { id: hero.id },
    data:  { xp: hero.xp + xpGained, skillXp: newSkillXp, health: newHealth, lastHealthRegen: newLastHealthRegen },
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
        playerId:      job.playerId,
        activityType:  meta.activityType,
        xpAwarded:     xpGained,
        skillXpAwarded: skillXpGains as any,
        resources:     rewardedResources,
        damageTaken,
        heroId:        hero.id,
        cityId:        job.cityId ?? null,
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
      rewards: { xp: xpGained, resources: rewardedResources, skillXp: skillXpGains as any, damageTaken },
    });
  }
}
