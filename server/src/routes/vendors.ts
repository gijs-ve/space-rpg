import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { getVendors, buyFromVendor, sellToVendor, sellBulkToVendor } from '../services/vendor.service';
import { ItemId } from '@rpg/shared';

const router = Router();
router.use(requireAuth);

// ─── Schemas ─────────────────────────────────────────────────────────────────────
const BuySchema = z.object({
  cityId:    z.string().min(1),
  vendorId:  z.string().min(1),
  itemDefId: z.string().min(1),
  quantity:  z.number().int().min(1).max(100).default(1),
});

const SellSchema = z.object({
  cityId:         z.string().min(1),
  vendorId:       z.string().min(1),
  itemInstanceId: z.string().min(1),
});

const SellBulkSchema = z.object({
  cityId:          z.string().min(1),
  vendorId:        z.string().min(1),
  itemInstanceIds: z.array(z.string().min(1)).min(1).max(50),
});

// ─── GET /vendors — list all vendors with stock ───────────────────────────────
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const vendors = await getVendors();
    res.json({ success: true, data: vendors });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /vendors/buy — buy item(s) from a vendor ───────────────────────────
router.post('/buy', async (req: Request, res: Response): Promise<void> => {
  const parsed = BuySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { cityId, vendorId, itemDefId, quantity } = parsed.data;
  try {
    const result = await buyFromVendor(req.player!.playerId, cityId, vendorId, itemDefId as ItemId, quantity);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /vendors/sell — sell an item back to a vendor ──────────────────────
router.post('/sell', async (req: Request, res: Response): Promise<void> => {
  const parsed = SellSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { cityId, vendorId, itemInstanceId } = parsed.data;
  try {
    const result = await sellToVendor(req.player!.playerId, cityId, vendorId, itemInstanceId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /vendors/sell-bulk — sell multiple items in one go ──────────────────
router.post('/sell-bulk', async (req: Request, res: Response): Promise<void> => {
  const parsed = SellBulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { cityId, vendorId, itemInstanceIds } = parsed.data;
  try {
    const result = await sellBulkToVendor(req.player!.playerId, cityId, vendorId, itemInstanceIds);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

export default router;
