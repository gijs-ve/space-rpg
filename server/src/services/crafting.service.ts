import { prisma } from '../db/client';
import { scaleDuration } from '../config';
import {
  CraftingRecipe,
  CRAFTING_RECIPES,
  craftingDurationSeconds,
  CityBuilding,
  BuildingId,
} from '@rpg/shared';
import { CraftingSlot } from '@prisma/client';
import { io, playerSockets } from '../index';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Find a specific crafting slot, creating it if it doesn't exist yet. */
export async function getOrCreateSlot(
  cityId: string,
  buildingSlotIndex: number,
  recipeId: string,
): Promise<CraftingSlot> {
  return prisma.craftingSlot.upsert({
    where: {
      cityId_buildingSlotIndex_recipeId: { cityId, buildingSlotIndex, recipeId },
    },
    create: { cityId, buildingSlotIndex, recipeId },
    update: {},
  });
}

/** List all crafting slots for a city (with live job endsAt attached). */
export async function getCraftingSlots(cityId: string) {
  const slots = await prisma.craftingSlot.findMany({
    where: { cityId },
    include: { processingJob: { select: { endsAt: true } } },
  });
  return slots.map((s) => ({
    id:                s.id,
    cityId:            s.cityId,
    buildingSlotIndex: s.buildingSlotIndex,
    recipeId:          s.recipeId,
    inputQueueCount:   s.inputQueueCount,
    outputCount:       s.outputCount,
    processingJobId:   s.processingJobId,
    processingEndsAt:  s.processingJob?.endsAt?.toISOString() ?? null,
  }));
}

// ─── Queue an item for crafting ───────────────────────────────────────────────

export async function addToQueue(
  cityId: string,
  buildingSlotIndex: number,
  recipeId: string,
  itemInstanceIds: string[],
  playerId: string,
): Promise<{ slot: Awaited<ReturnType<typeof getCraftingSlots>>[number]; jobStarted: boolean }> {
  const recipe = CRAFTING_RECIPES[recipeId];
  if (!recipe) throw Object.assign(new Error('Unknown recipe'), { status: 400 });

  // Validate items belong to this player's city and are the right type
  const items = await prisma.itemInstance.findMany({
    where: {
      id:        { in: itemInstanceIds },
      cityId,
      itemDefId: recipe.inputItemId,
    },
  });

  if (items.length !== itemInstanceIds.length) {
    throw Object.assign(
      new Error('Some items are invalid or do not belong to this base'),
      { status: 400 },
    );
  }

  // Enforce one active recipe per building slot
  const conflictingSlot = await prisma.craftingSlot.findFirst({
    where: {
      cityId,
      buildingSlotIndex,
      recipeId:        { not: recipeId },
      OR: [
        { inputQueueCount: { gt: 0 } },
        { processingJobId: { not: null } },
        { outputCount:     { gt: 0 } },
      ],
    },
    include: { processingJob: false },
  });
  if (conflictingSlot) {
    throw Object.assign(
      new Error(
        `This building is already running recipe "${conflictingSlot.recipeId}". ` +
        `Clear its queue and collect all output before switching recipes.`,
      ),
      { status: 409 },
    );
  }

  // Delete the consumed item instances
  await prisma.itemInstance.deleteMany({ where: { id: { in: itemInstanceIds } } });

  // Increment queue
  const slot = await prisma.craftingSlot.upsert({
    where: {
      cityId_buildingSlotIndex_recipeId: { cityId, buildingSlotIndex, recipeId },
    },
    create: { cityId, buildingSlotIndex, recipeId, inputQueueCount: items.length },
    update: { inputQueueCount: { increment: items.length } },
  });

  // Start processing if not already running
  let jobStarted = false;
  if (!slot.processingJobId) {
    await startNextRun(slot, cityId, buildingSlotIndex, recipe, playerId);
    jobStarted = true;
  }

  const refreshed = await getCraftingSlots(cityId);
  return {
    slot: refreshed.find(
      (s) => s.buildingSlotIndex === buildingSlotIndex && s.recipeId === recipeId,
    )!,
    jobStarted,
  };
}

// ─── Start the next processing run ────────────────────────────────────────────

export async function startNextRun(
  slot: CraftingSlot,
  cityId: string,
  buildingSlotIndex: number,
  recipe: CraftingRecipe,
  playerId: string,
): Promise<void> {
  // Check if there is anything in the queue
  const fresh = await prisma.craftingSlot.findUniqueOrThrow({
    where: { cityId_buildingSlotIndex_recipeId: { cityId, buildingSlotIndex, recipeId: recipe.id } },
  });
  if (fresh.inputQueueCount <= 0) return;

  // Determine building level for duration calculation
  const city = await prisma.city.findUniqueOrThrow({ where: { id: cityId } });
  const buildings = city.buildings as unknown as CityBuilding[];
  const building = buildings.find((b) => b.slotIndex === buildingSlotIndex);
  const buildingLevel = building?.level ?? 1;

  const durationS = scaleDuration(craftingDurationSeconds(recipe, buildingLevel));
  const now = new Date();
  const endsAt = new Date(now.getTime() + durationS * 1000);

  const job = await prisma.job.create({
    data: {
      type:     'crafting',
      playerId,
      cityId,
      metadata: { recipeId: recipe.id, buildingSlotIndex },
      startedAt: now,
      endsAt,
    },
  });

  await prisma.craftingSlot.update({
    where: { id: fresh.id },
    data: {
      processingJobId: job.id,
      inputQueueCount: { decrement: 1 },
    },
  });
}

// ─── Collect output ────────────────────────────────────────────────────────────

export async function collectOutput(
  cityId: string,
  buildingSlotIndex: number,
  recipeId: string,
  playerId: string,
): Promise<{ resourceType: string; amount: number; reportId: string }> {
  const recipe = CRAFTING_RECIPES[recipeId];
  if (!recipe) throw Object.assign(new Error('Unknown recipe'), { status: 400 });

  const slot = await prisma.craftingSlot.findUnique({
    where: { cityId_buildingSlotIndex_recipeId: { cityId, buildingSlotIndex, recipeId } },
  });

  if (!slot || slot.outputCount <= 0) {
    throw Object.assign(new Error('No output available to collect'), { status: 400 });
  }

  // Give resources to city + create activity report
  const city = await prisma.city.findUniqueOrThrow({ where: { id: cityId } });
  const currentResources = city.resources as unknown as Record<string, number>;
  const newResources = { ...currentResources };
  const res = recipe.outputResource;
  const storageCap = city.storageCap as unknown as Record<string, number>;
  const cap = storageCap[res] ?? Infinity;
  newResources[res] = Math.min(cap, (newResources[res] ?? 0) + recipe.outputAmount);

  await prisma.city.update({
    where: { id: cityId },
    data:  { resources: newResources },
  });

  const report = await prisma.activityReport.create({
    data: {
      playerId,
      activityType: 'crafting',
      xpAwarded:    0,
      resources:    { [res]: recipe.outputAmount },
      cityId,
    },
  });

  await prisma.craftingSlot.update({
    where: { id: slot.id },
    data:  { outputCount: { decrement: 1 } },
  });

  // Notify client of resource change
  const socketId = playerSockets.get(playerId);
  if (socketId) {
    const updatedCity = await prisma.city.findUniqueOrThrow({ where: { id: cityId } });
    io.to(socketId).emit('base:resourceUpdate' as any, {
      cityId,
      resources: updatedCity.resources,
    });
  }

  return { resourceType: res, amount: recipe.outputAmount, reportId: report.id };
}
