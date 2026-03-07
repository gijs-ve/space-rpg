import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getVendors, buyFromVendor, sellToVendor, sellBulkToVendor } from '../services/vendor.service';
import { ItemId } from '@rpg/shared';

const router = Router();
router.use(requireAuth);

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
  const { cityId, vendorId, itemDefId, quantity = 1 } = req.body;
  if (!cityId || !vendorId || !itemDefId) {
    res.status(400).json({ success: false, error: 'cityId, vendorId, itemDefId required' });
    return;
  }
  try {
    const result = await buyFromVendor(
      req.player!.playerId,
      cityId,
      vendorId,
      itemDefId as ItemId,
      Number(quantity),
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /vendors/sell — sell an item back to a vendor ──────────────────────
router.post('/sell', async (req: Request, res: Response): Promise<void> => {
  const { cityId, vendorId, itemInstanceId } = req.body;
  if (!cityId || !vendorId || !itemInstanceId) {
    res.status(400).json({ success: false, error: 'cityId, vendorId, itemInstanceId required' });
    return;
  }
  try {
    const result = await sellToVendor(
      req.player!.playerId,
      cityId,
      vendorId,
      itemInstanceId,
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /vendors/sell-bulk — sell multiple items in one go ──────────────────
router.post('/sell-bulk', async (req: Request, res: Response): Promise<void> => {
  const { cityId, vendorId, itemInstanceIds } = req.body;
  if (!cityId || !vendorId || !Array.isArray(itemInstanceIds) || itemInstanceIds.length === 0) {
    res.status(400).json({ success: false, error: 'cityId, vendorId, itemInstanceIds[] required' });
    return;
  }
  try {
    const result = await sellBulkToVendor(
      req.player!.playerId,
      cityId,
      vendorId,
      itemInstanceIds,
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

export default router;
