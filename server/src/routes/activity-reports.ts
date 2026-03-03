import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/client';
import { claimItemFromReport } from '../services/items.service';

const router = Router();
router.use(requireAuth);

// ─── GET /activity-reports — list undismissed reports ────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const reports = await prisma.activityReport.findMany({
      where: { playerId: req.player!.playerId, dismissed: false },
      include: { items: true },
      orderBy: { completedAt: 'desc' },
    });
    res.json({ success: true, data: reports });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /activity-reports/:id/claim ─────────────────────────────────────────
// Claim a single item from a report into hero inventory
router.post('/:id/claim', async (req: Request, res: Response): Promise<void> => {
  const { itemId, gridX, gridY, rotated = false } = req.body;

  if (!itemId || gridX === undefined || gridY === undefined) {
    res.status(400).json({ success: false, error: 'itemId, gridX, gridY required' });
    return;
  }

  try {
    const item = await claimItemFromReport(
      itemId,
      req.params.id,
      req.player!.playerId,
      Number(gridX),
      Number(gridY),
      Boolean(rotated),
    );
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /activity-reports/:id/dismiss — dismiss a report ───────────────────
// Any unclaimed items in this report are permanently discarded
router.post('/:id/dismiss', async (req: Request, res: Response): Promise<void> => {
  try {
    const report = await prisma.activityReport.findUnique({
      where: { id: req.params.id },
    });

    if (!report || report.playerId !== req.player!.playerId) {
      res.status(404).json({ success: false, error: 'Report not found' });
      return;
    }

    // Delete unclaimed items then dismiss the report
    await prisma.$transaction([
      prisma.itemInstance.deleteMany({ where: { reportId: report.id } }),
      prisma.activityReport.update({
        where: { id: report.id },
        data: { dismissed: true },
      }),
    ]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
