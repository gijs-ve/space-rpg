import { Job } from '@prisma/client';
import { prisma } from '../../db/client';
import { io, playerSockets } from '../../index';
import { CRAFTING_RECIPES, CraftingJobMeta } from '@rpg/shared';
import { startNextRun } from '../../services/crafting.service';

export async function resolveCraftingJob(job: Job) {
  const meta = job.metadata as unknown as CraftingJobMeta;
  const { recipeId, buildingSlotIndex } = meta;
  if (!job.cityId) return;

  const recipe = CRAFTING_RECIPES[recipeId];
  if (!recipe) {
    console.error(`resolveCraftingJob: unknown recipe ${recipeId}`);
    return;
  }

  // Find the slot
  const slot = await prisma.craftingSlot.findUnique({
    where: {
      cityId_buildingSlotIndex_recipeId: {
        cityId: job.cityId,
        buildingSlotIndex,
        recipeId,
      },
    },
  });

  if (!slot) {
    console.error(`resolveCraftingJob: slot not found for job ${job.id}`);
    return;
  }

  // Increment output and clear the processing job reference
  await prisma.craftingSlot.update({
    where: { id: slot.id },
    data:  { outputCount: { increment: 1 }, processingJobId: null },
  });

  // Auto-advance: if there's more in the queue, start the next run
  const refreshed = await prisma.craftingSlot.findUniqueOrThrow({ where: { id: slot.id } });
  if (refreshed.inputQueueCount > 0) {
    await startNextRun(refreshed, job.cityId, buildingSlotIndex, recipe, job.playerId);
  }

  // Emit socket event so the client can update the crafting panel
  const socketId = playerSockets.get(job.playerId);
  if (socketId) {
    const updatedSlots = await prisma.craftingSlot.findMany({
      where: { cityId: job.cityId },
      include: { processingJob: { select: { endsAt: true } } },
    });
    const slots = updatedSlots.map((s) => ({
      id:                s.id,
      cityId:            s.cityId,
      buildingSlotIndex: s.buildingSlotIndex,
      recipeId:          s.recipeId,
      inputQueueCount:   s.inputQueueCount,
      outputCount:       s.outputCount,
      processingJobId:   s.processingJobId,
      processingEndsAt:  s.processingJob?.endsAt?.toISOString() ?? null,
    }));
    io.to(socketId).emit('crafting:update' as any, { cityId: job.cityId, slots });
  }
}
