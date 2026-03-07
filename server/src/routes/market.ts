import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import {
  getMarketListings,
  getCityListings,
  placeSellItem,
  placeSellResource,
  placeBuyItem,
  placeBuyResource,
  cancelListing,
} from '../services/market.service';
import { ResourceType, ItemId, RESOURCE_TYPES } from '@rpg/shared';

const router = Router();
router.use(requireAuth);

// ─── Schemas ─────────────────────────────────────────────────────────────────────
const SellItemSchema = z.object({
  cityId:         z.string().min(1),
  itemInstanceId: z.string().min(1),
  priceIridium:   z.number().int().positive(),
});

const SellResourceSchema = z.object({
  cityId:         z.string().min(1),
  resourceType:   z.enum(RESOURCE_TYPES),
  resourceAmount: z.number().int().positive(),
  priceIridium:   z.number().int().positive(),
});

const BuyItemSchema = z.object({
  cityId:       z.string().min(1),
  itemDefId:    z.string().min(1),
  priceIridium: z.number().int().positive(),
});

const BuyResourceSchema = z.object({
  cityId:         z.string().min(1),
  resourceType:   z.enum(RESOURCE_TYPES),
  resourceAmount: z.number().int().positive(),
  priceIridium:   z.number().int().positive(),
});

// ─── GET /market — all active listings ───────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { kind, type, itemDefId, resourceType } = req.query;
    const listings = await getMarketListings({
      kind: kind as any,
      type: type as any,
      itemDefId: itemDefId as string | undefined,
      resourceType: resourceType as string | undefined,
    });
    res.json({ success: true, data: listings });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── GET /market/mine/:cityId — listings owned by a city ─────────────────────
router.get('/mine/:cityId', async (req: Request, res: Response): Promise<void> => {
  try {
    const listings = await getCityListings(req.player!.playerId, req.params.cityId);
    res.json({ success: true, data: listings });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /market/sell/item ───────────────────────────────────────────────────
router.post('/sell/item', async (req: Request, res: Response): Promise<void> => {
  const parsed = SellItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { cityId, itemInstanceId, priceIridium } = parsed.data;
  try {
    const result = await placeSellItem(req.player!.playerId, cityId, itemInstanceId, priceIridium);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /market/sell/resource ───────────────────────────────────────────────
router.post('/sell/resource', async (req: Request, res: Response): Promise<void> => {
  const parsed = SellResourceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { cityId, resourceType, resourceAmount, priceIridium } = parsed.data;
  try {
    const result = await placeSellResource(
      req.player!.playerId, cityId, resourceType as ResourceType, resourceAmount, priceIridium,
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /market/buy/item ────────────────────────────────────────────────────
router.post('/buy/item', async (req: Request, res: Response): Promise<void> => {
  const parsed = BuyItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { cityId, itemDefId, priceIridium } = parsed.data;
  try {
    const result = await placeBuyItem(req.player!.playerId, cityId, itemDefId as ItemId, priceIridium);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /market/buy/resource ────────────────────────────────────────────────
router.post('/buy/resource', async (req: Request, res: Response): Promise<void> => {
  const parsed = BuyResourceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { cityId, resourceType, resourceAmount, priceIridium } = parsed.data;
  try {
    const result = await placeBuyResource(
      req.player!.playerId, cityId, resourceType as ResourceType, resourceAmount, priceIridium,
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /market/:listingId — cancel a listing ────────────────────────────
router.delete('/:listingId', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await cancelListing(req.player!.playerId, req.params.listingId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

export default router;
