import { Router, Request, Response } from 'express';
import { z } from 'zod';
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

// ─── Schemas ──────────────────────────────────────────────────────────────────
const ItemIdSchema = z.object({ itemId: z.string().min(1) });

const MoveSchema = z.object({
  itemId:         z.string().min(1),
  targetLocation: z.enum(['hero_inventory', 'base_armory']),
  gridX:          z.number().int(),
  gridY:          z.number().int(),
  rotated:        z.boolean().default(false),
  armoryIndex:    z.number().int().min(0).default(0),
});

const EquipSchema = z.object({
  itemId:    z.string().min(1),
  equipSlot: z.string().min(1),
});

const UnequipSchema = z.object({
  itemId: z.string().min(1),
  gridX:  z.number().int().optional(),
  gridY:  z.number().int().optional(),
});

const EquipBuildingSchema = z.object({
  itemId:            z.string().min(1),
  buildingSlotIndex: z.number().int().min(0),
  buildingEquipSlot: z.string().min(1),
});

const MoveToBaseSchema = z.object({
  itemId:      z.string().min(1),
  armoryIndex: z.number().int().min(0).optional(),
});

// ─── GET /items — all items for the authenticated player ─────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await getPlayerItems(req.player!.playerId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /items/move — move item to hero inventory or base armory ─────────────
router.post('/move', async (req: Request, res: Response): Promise<void> => {
  const parsed = MoveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { itemId, targetLocation, gridX, gridY, rotated, armoryIndex } = parsed.data;
  try {
    const item = await moveItemToInventory(
      itemId, req.player!.playerId, targetLocation, gridX, gridY, rotated, armoryIndex,
    );
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /items/rotate — rotate item in place ────────────────────────────────
router.post('/rotate', async (req: Request, res: Response): Promise<void> => {
  const parsed = ItemIdSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const item = await rotateItem(parsed.data.itemId, req.player!.playerId);
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /items/equip — equip to hero slot ───────────────────────────────────
router.post('/equip', async (req: Request, res: Response): Promise<void> => {
  const parsed = EquipSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { itemId, equipSlot } = parsed.data;

  // Block equipment changes while this specific hero is on an adventure
  const itemRecord = await prisma.itemInstance.findUnique({ where: { id: itemId }, select: { heroId: true } });
  const onAdventure = itemRecord?.heroId
    ? await prisma.job.findFirst({ where: { heroId: itemRecord.heroId, type: 'adventure', completed: false } })
    : null;
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
  const parsed = UnequipSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { itemId, gridX, gridY } = parsed.data;

  // Block equipment changes while this specific hero is on an adventure
  const itemRecord = await prisma.itemInstance.findUnique({ where: { id: itemId }, select: { heroId: true } });
  const onAdventureUnequip = itemRecord?.heroId
    ? await prisma.job.findFirst({ where: { heroId: itemRecord.heroId, type: 'adventure', completed: false } })
    : null;
  if (onAdventureUnequip) {
    res.status(409).json({ success: false, error: 'Cannot change equipment while hero is on adventure' });
    return;
  }

  try {
    const item = await unequipItem(itemId, req.player!.playerId, gridX, gridY);
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /items/equip-building — equip to building slot ─────────────────────
router.post('/equip-building', async (req: Request, res: Response): Promise<void> => {
  const parsed = EquipBuildingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { itemId, buildingSlotIndex, buildingEquipSlot } = parsed.data;
  try {
    const item = await equipItemToBuilding(itemId, req.player!.playerId, buildingSlotIndex, buildingEquipSlot);
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /items/move-to-hero — auto-place item in hero inventory ─────────────
router.post('/move-to-hero', async (req: Request, res: Response): Promise<void> => {
  const parsed = ItemIdSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const item = await moveItemToHeroAuto(parsed.data.itemId, req.player!.playerId);
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /items/move-to-base — auto-place item in base armory ───────────────
router.post('/move-to-base', async (req: Request, res: Response): Promise<void> => {
  const parsed = MoveToBaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { itemId, armoryIndex } = parsed.data;
  try {
    const item = await moveItemToBaseAuto(itemId, req.player!.playerId, armoryIndex);
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

// ─── POST /items/:id/consume — consume a consumable item ─────────────────────
router.post('/:id/consume', async (req: Request, res: Response): Promise<void> => {
  try {
    const hero = await consumeItem(req.params.id, req.player!.playerId);
    res.json({ success: true, data: { hero } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

export default router;
