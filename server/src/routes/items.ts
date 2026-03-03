import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getPlayerItems,
  moveItemToInventory,
  rotateItem,
  equipItemToHero,
  unequipItem,
  equipItemToBuilding,
  discardItem,
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
  const { itemId, targetLocation, gridX, gridY, rotated = false } = req.body;

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
  if (!itemId || gridX === undefined || gridY === undefined) {
    res.status(400).json({ success: false, error: 'itemId, gridX, gridY required' });
    return;
  }

  try {
    const item = await unequipItem(
      itemId,
      req.player!.playerId,
      Number(gridX),
      Number(gridY),
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

// ─── DELETE /items/:id — discard item ────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await discardItem(req.params.id, req.player!.playerId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

export default router;
