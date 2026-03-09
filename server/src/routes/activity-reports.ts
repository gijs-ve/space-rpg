import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/client';
import { claimItemFromReport, autoClaimReport, autoClaimOneItem } from '../services/items.service';
import { ResourceMap } from '@rpg/shared';
import { ItemLocation } from '@prisma/client';

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

    // Collect unique hero and city IDs to resolve names in one query each
    const heroIds = [...new Set(reports.map((r) => (r as any).heroId).filter(Boolean))];
    const cityIds = [...new Set(reports.map((r) => (r as any).cityId).filter(Boolean))];

    const [heroes, cities] = await Promise.all([
      heroIds.length
        ? prisma.hero.findMany({ where: { id: { in: heroIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      cityIds.length
        ? prisma.city.findMany({ where: { id: { in: cityIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);

    const heroMap = new Map(heroes.map((h) => [h.id, h.name]));
    const cityMap = new Map(cities.map((c) => [c.id, c.name]));

    const enriched = reports.map((r) => ({
      ...r,
      heroName: (r as any).heroId ? (heroMap.get((r as any).heroId) ?? null) : null,
      cityName: (r as any).cityId ? (cityMap.get((r as any).cityId) ?? null) : null,
    }));

    res.json({ success: true, data: enriched });
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

// ─── POST /activity-reports/:id/view — mark a report as viewed ───────────────
router.post('/:id/view', async (req: Request, res: Response): Promise<void> => {
  try {
    const report = await prisma.activityReport.findUnique({ where: { id: req.params.id } });
    if (!report || report.playerId !== req.player!.playerId) {
      res.status(404).json({ success: false, error: 'Report not found' });
      return;
    }
    await prisma.activityReport.update({ where: { id: report.id }, data: { viewed: true } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /activity-reports/:id/claim-one — auto-place a single item ───────────
router.post('/:id/claim-one', async (req: Request, res: Response): Promise<void> => {
  const { itemInstanceId } = req.body;
  if (!itemInstanceId) {
    res.status(400).json({ success: false, error: 'itemInstanceId required' });
    return;
  }
  try {
    const item = await autoClaimOneItem(req.params.id, req.player!.playerId, itemInstanceId);
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /activity-reports/:id/claim-all — auto-place all items ──────────────
router.post('/:id/claim-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await autoClaimReport(req.params.id, req.player!.playerId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /activity-reports/:id/claim-resources — deposit resources to home city ─
router.post('/:id/claim-resources', async (req: Request, res: Response): Promise<void> => {
  const playerId = req.player!.playerId;
  try {
    const report = await prisma.activityReport.findUnique({ where: { id: req.params.id } });
    if (!report || report.playerId !== playerId) {
      res.status(404).json({ success: false, error: 'Report not found' });
      return;
    }
    if (report.resourcesClaimed) {
      res.status(409).json({ success: false, error: 'Resources already claimed' });
      return;
    }

    // Find any hero belonging to this player that has a home city
    const hero = await prisma.hero.findFirst({
      where:  { playerId, homeCityId: { not: null } },
      select: { homeCityId: true },
    });
    if (!hero?.homeCityId) {
      res.status(400).json({ success: false, error: 'You must found a city before claiming resources' });
      return;
    }

    const city = await prisma.city.findUnique({ where: { id: hero.homeCityId } });
    if (!city || city.playerId !== playerId) {
      res.status(404).json({ success: false, error: 'Home city not found' });
      return;
    }

    const cityResources  = city.resources  as unknown as ResourceMap;
    const storageCap     = city.storageCap as unknown as ResourceMap;
    const reportResources = report.resources as unknown as Partial<ResourceMap>;
    const updatedResources = { ...cityResources };

    for (const [rKey, rVal] of Object.entries(reportResources)) {
      if (typeof rVal !== 'number') continue;
      const cap = storageCap[rKey as keyof ResourceMap] ?? Infinity;
      updatedResources[rKey as keyof ResourceMap] = Math.min(
        (updatedResources[rKey as keyof ResourceMap] ?? 0) + rVal,
        cap,
      );
    }

    await prisma.$transaction([
      prisma.city.update({
        where: { id: city.id },
        data:  { resources: updatedResources },
      }),
      prisma.activityReport.update({
        where: { id: report.id },
        data:  { resourcesClaimed: true },
      }),
    ]);

    res.json({ success: true, data: { resources: updatedResources } });
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

    // Delete only unclaimed items; claimed items keep their reportId as a phantom reference
    await prisma.$transaction([
      prisma.itemInstance.deleteMany({
        where: { reportId: report.id, location: ItemLocation.activity_report },
      }),
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
