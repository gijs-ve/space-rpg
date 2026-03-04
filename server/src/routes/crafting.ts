import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/client';
import { CRAFTING_RECIPES } from '@rpg/shared';
import {
  getCraftingSlots,
  addToQueue,
  collectOutput,
} from '../services/crafting.service';

const router = Router();
router.use(requireAuth);

// ─── GET /crafting/:cityId ────────────────────────────────────────────────────

router.get('/:cityId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { cityId } = req.params;
    // Ensure city belongs to this player
    const city = await prisma.city.findFirst({
      where: { id: cityId, playerId: req.player!.playerId },
    });
    if (!city) {
      res.status(404).json({ success: false, error: 'Base not found' });
      return;
    }
    const slots = await getCraftingSlots(cityId);
    res.json({ success: true, data: { slots } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /crafting/:cityId/queue ─────────────────────────────────────────────

const QueueSchema = z.object({
  buildingSlotIndex: z.number().int().min(0),
  recipeId:          z.string(),
  itemInstanceIds:   z.array(z.string()).min(1).max(50),
});

router.post('/:cityId/queue', async (req: Request, res: Response): Promise<void> => {
  const parsed = QueueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const { cityId } = req.params;
    const { buildingSlotIndex, recipeId, itemInstanceIds } = parsed.data;
    const playerId = req.player!.playerId;

    // Auth check
    const city = await prisma.city.findFirst({ where: { id: cityId, playerId } });
    if (!city) {
      res.status(404).json({ success: false, error: 'Base not found' });
      return;
    }

    if (!CRAFTING_RECIPES[recipeId]) {
      res.status(400).json({ success: false, error: 'Unknown recipe' });
      return;
    }

    const { slot, jobStarted } = await addToQueue(
      cityId, buildingSlotIndex, recipeId, itemInstanceIds, playerId,
    );

    res.json({ success: true, data: { slot, jobStarted } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /crafting/:cityId/collect ───────────────────────────────────────────

const CollectSchema = z.object({
  buildingSlotIndex: z.number().int().min(0),
  recipeId:          z.string(),
});

router.post('/:cityId/collect', async (req: Request, res: Response): Promise<void> => {
  const parsed = CollectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const { cityId } = req.params;
    const { buildingSlotIndex, recipeId } = parsed.data;
    const playerId = req.player!.playerId;

    const city = await prisma.city.findFirst({ where: { id: cityId, playerId } });
    if (!city) {
      res.status(404).json({ success: false, error: 'Base not found' });
      return;
    }

    const result = await collectOutput(cityId, buildingSlotIndex, recipeId, playerId);
    const slots = await getCraftingSlots(cityId);

    res.json({ success: true, data: { ...result, slots } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

export default router;
