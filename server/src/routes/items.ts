import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/client';
import {
  getPlayerItems,
  moveItemToInventory,
  moveItemToBaseAuto,
  moveItemToHeroAuto,
  rotateItem,
  equipItemToHero,
  unequipItem,
  equipItemToBuilding,
  discardItem,
  consumeItem,
} from '../services/items.service';

const router = Router();
router.use(requireAuth);

// ─── GET /items — all items for the authenticated player ─────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await getPlayerItems(req.player!.playerId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /items/move — move item to hero inventory or base armory ────────────
router.post('/move', async (req: Request, res: Response): Promise<void> => {
  const { itemId, targetLocation, gridX, gridY, rotated = false, armoryIndex = 0 } = req.body;

  if (!itemId || !targetLocation || gridX === undefined || gridY === undefined) {
    res.status(400).json({ success: false, error: 'Missing required fields' });
    return;
  }

  if (!['hero_inventory', 'base_armory'].includes(targetLocation)) {
    res.status(400).json({ success: false, error: 'Invalid targetLocation' });
    return;
  }

  try {
    const item = await moveItemToInventory(
      itemId,
      req.player!.playerId,
      targetLocation,
      Number(gridX),
      Number(gridY),
      Boolean(rotated),
      Number(armoryIndex),
    );
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /items/rotate — rotate item in place ────────────────────────────────
router.post('/rotate', async (req: Request, res: Response): Promise<void> => {
  const { itemId } = req.body;
  if (!itemId) {
    res.status(400).json({ success: false, error: 'itemId required' });
    return;
  }

  try {
    const item = await rotateItem(itemId, req.player!.playerId);
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /items/equip — equip to hero slot ───────────────────────────────────
router.post('/equip', async (req: Request, res: Response): Promise<void> => {
  const { itemId, equipSlot } = req.body;
  if (!itemId || !equipSlot) {
    res.status(400).json({ success: false, error: 'itemId and equipSlot required' });
    return;
  }

  // Block equipment changes while the hero is on an adventure
  const onAdventure = await prisma.job.findFirst({
    where: { playerId: req.player!.playerId, type: 'adventure', completed: false },
  });
  if (onAdventure) {
    res.status(409).json({ success: false, error: 'Cannot change equipment while hero is on adventure' });
    return;
  }

  try {
    const item = await equipItemToHero(itemId, req.player!.playerId, equipSlot);
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /items/unequip — unequip to hero inventory ─────────────────────────
router.post('/unequip', async (req: Request, res: Response): Promise<void> => {
  const { itemId, gridX, gridY } = req.body;
  if (!itemId) {
    res.status(400).json({ success: false, error: 'itemId required' });
    return;
  }

  // Block equipment changes while the hero is on an adventure
  const onAdventure = await prisma.job.findFirst({
    where: { playerId: req.player!.playerId, type: 'adventure', completed: false },
  });
  if (onAdventure) {
    res.status(409).json({ success: false, error: 'Cannot change equipment while hero is on adventure' });
    return;
  }

  try {
    const item = await unequipItem(
      itemId,
      req.player!.playerId,
      gridX !== undefined ? Number(gridX) : undefined,
      gridY !== undefined ? Number(gridY) : undefined,
    );
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /items/equip-building — equip to building slot ─────────────────────
router.post('/equip-building', async (req: Request, res: Response): Promise<void> => {
  const { itemId, buildingSlotIndex, buildingEquipSlot } = req.body;
  if (!itemId || buildingSlotIndex === undefined || !buildingEquipSlot) {
    res
      .status(400)
      .json({ success: false, error: 'itemId, buildingSlotIndex, buildingEquipSlot required' });
    return;
  }

  try {
    const item = await equipItemToBuilding(
      itemId,
      req.player!.playerId,
      Number(buildingSlotIndex),
      buildingEquipSlot,
    );
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /items/move-to-hero — auto-place item in hero inventory ────────────
router.post('/move-to-hero', async (req: Request, res: Response): Promise<void> => {
  const { itemId } = req.body;
  if (!itemId) {
    res.status(400).json({ success: false, error: 'itemId required' });
    return;
  }

  try {
    const item = await moveItemToHeroAuto(itemId, req.player!.playerId);
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /items/move-to-base — auto-place item in base armory ──────────────
router.post('/move-to-base', async (req: Request, res: Response): Promise<void> => {
  const { itemId, armoryIndex } = req.body;
  if (!itemId) {
    res.status(400).json({ success: false, error: 'itemId required' });
    return;
  }

  try {
    const item = await moveItemToBaseAuto(
      itemId,
      req.player!.playerId,
      armoryIndex !== undefined ? Number(armoryIndex) : undefined,
    );
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /items/:id — discard item ────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await discardItem(req.params.id, req.player!.playerId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});
// ─── POST /items/:id/consume — consume a consumable item ─────────────────────────────
router.post('/:id/consume', async (req: Request, res: Response): Promise<void> => {
  try {
    const hero = await consumeItem(req.params.id, req.player!.playerId);
    res.json({ success: true, data: { hero } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});
export default router;
