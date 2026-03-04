import { Router, Request, Response } from 'express';
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
import { ResourceType, ItemId } from '@rpg/shared';

const router = Router();
router.use(requireAuth);

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
  const { cityId, itemInstanceId, priceIridium } = req.body;
  if (!cityId || !itemInstanceId || priceIridium === undefined) {
    res.status(400).json({ success: false, error: 'cityId, itemInstanceId, priceIridium required' });
    return;
  }
  try {
    const result = await placeSellItem(
      req.player!.playerId,
      cityId,
      itemInstanceId,
      Number(priceIridium),
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /market/sell/resource ───────────────────────────────────────────────
router.post('/sell/resource', async (req: Request, res: Response): Promise<void> => {
  const { cityId, resourceType, resourceAmount, priceIridium } = req.body;
  if (!cityId || !resourceType || resourceAmount === undefined || priceIridium === undefined) {
    res.status(400).json({ success: false, error: 'cityId, resourceType, resourceAmount, priceIridium required' });
    return;
  }
  try {
    const result = await placeSellResource(
      req.player!.playerId,
      cityId,
      resourceType as ResourceType,
      Number(resourceAmount),
      Number(priceIridium),
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /market/buy/item ────────────────────────────────────────────────────
router.post('/buy/item', async (req: Request, res: Response): Promise<void> => {
  const { cityId, itemDefId, priceIridium } = req.body;
  if (!cityId || !itemDefId || priceIridium === undefined) {
    res.status(400).json({ success: false, error: 'cityId, itemDefId, priceIridium required' });
    return;
  }
  try {
    const result = await placeBuyItem(
      req.player!.playerId,
      cityId,
      itemDefId as ItemId,
      Number(priceIridium),
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /market/buy/resource ────────────────────────────────────────────────
router.post('/buy/resource', async (req: Request, res: Response): Promise<void> => {
  const { cityId, resourceType, resourceAmount, priceIridium } = req.body;
  if (!cityId || !resourceType || resourceAmount === undefined || priceIridium === undefined) {
    res.status(400).json({ success: false, error: 'cityId, resourceType, resourceAmount, priceIridium required' });
    return;
  }
  try {
    const result = await placeBuyResource(
      req.player!.playerId,
      cityId,
      resourceType as ResourceType,
      Number(resourceAmount),
      Number(priceIridium),
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
