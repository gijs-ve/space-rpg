import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/client';
import {
  getCitiesForPlayer,
  getCityOrThrow,
  computeProductionRates,
  computeStorageCap,
} from '../services/base.service';
import {
  BUILDINGS,
  BuildingId,
  BUILDING_LIST,
  CityBuilding,
  ResourceMap,
  UNITS,
  UnitId,
  UNIT_LIST,
  canAfford,
  subtractResources,
  computeConstructionTime,
  meetsPrerequisite,
  CITY_BUILDING_SLOTS,
} from '@rpg/shared';

const router = Router();
router.use(requireAuth);

// ─── GET /bases ──────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const cities = await getCitiesForPlayer(req.player!.playerId);
    res.json({ success: true, data: { cities } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /bases/:id ──────────────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const city = await getCityOrThrow(req.params.id, req.player!.playerId);
    const buildings = city.buildings as unknown as CityBuilding[];
    const productionRates = computeProductionRates(buildings);
    const activeJobs = await prisma.job.findMany({
      where: { cityId: city.id, completed: false },
    });
    res.json({ success: true, data: { city: { ...city, productionRates }, activeJobs } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /bases/:id/build ───────────────────────────────────────────────────────
const BuildSchema = z.object({
  slotIndex:  z.number().int().min(0).max(CITY_BUILDING_SLOTS - 1),
  buildingId: z.enum(BUILDING_LIST.map((b) => b.id) as [BuildingId, ...BuildingId[]]),
});

router.post('/:id/build', async (req: Request, res: Response): Promise<void> => {
  const parsed = BuildSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { slotIndex, buildingId } = parsed.data;
  const playerId = req.player!.playerId;

  try {
    const city = await getCityOrThrow(req.params.id, playerId);
    const buildings = city.buildings as unknown as CityBuilding[];
    const resources = city.resources as unknown as ResourceMap;

    // Check no active construction
    const activeConstruction = await prisma.job.findFirst({
      where: { cityId: city.id, type: 'construction', completed: false },
    });
    if (activeConstruction) {
      res.status(409).json({ success: false, error: 'Construction already in progress' });
      return;
    }

    // Determine current building in slot (if any)
    const existing = buildings.find((b) => b.slotIndex === slotIndex);
    if (existing && existing.buildingId !== buildingId) {
      res.status(400).json({ success: false, error: 'Slot already occupied by a different building' });
      return;
    }

    const currentLevel = existing?.level ?? 0;
    const targetLevel  = currentLevel + 1;
    const def          = BUILDINGS[buildingId];

    if (targetLevel > def.maxLevel) {
      res.status(400).json({ success: false, error: 'Building already at max level' });
      return;
    }

    // Check prerequisite
    const existingLevels = Object.fromEntries(
      buildings.map((b) => [b.buildingId, b.level])
    ) as Partial<Record<BuildingId, number>>;
    if (!meetsPrerequisite(buildingId, existingLevels)) {
      const pre = def.prerequisite!;
      res.status(400).json({
        success: false,
        error: `Requires ${BUILDINGS[pre.buildingId].name} level ${pre.minLevel}`,
      });
      return;
    }

    const levelDef = def.levels[targetLevel - 1];

    // Compute duration before entering the transaction (no DB needed).
    const duration = computeConstructionTime(buildingId, targetLevel, city.civId as any);
    const now      = new Date();
    const endsAt   = new Date(now.getTime() + duration * 1000);

    // Re-read resources inside the transaction so the affordability check and
    // the deduction are atomic — prevents double-spend from concurrent requests.
    const { updatedCity, job } = await prisma.$transaction(async (tx) => {
      const freshCity      = await tx.city.findUniqueOrThrow({ where: { id: city.id } });
      const freshResources = freshCity.resources as unknown as ResourceMap;

      if (!canAfford(freshResources, levelDef.cost)) {
        throw Object.assign(new Error('Not enough resources'), { status: 400 });
      }

      const newResources = subtractResources(freshResources, levelDef.cost);

      const updatedCity = await tx.city.update({
        where: { id: city.id },
        data:  { resources: newResources },
      });
      const job = await tx.job.create({
        data: {
          type:     'construction',
          playerId,
          cityId:   city.id,
          metadata: { slotIndex, buildingId, targetLevel },
          startedAt: now,
          endsAt,
        },
      });
      return { updatedCity, job };
    });

    res.status(201).json({ success: true, data: { job, city: updatedCity } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /bases/:id/train ───────────────────────────────────────────────────────
const TrainSchema = z.object({
  unitId:   z.enum(UNIT_LIST.map((u) => u.id) as [UnitId, ...UnitId[]]),
  quantity: z.number().int().min(1).max(500),
});

router.post('/:id/train', async (req: Request, res: Response): Promise<void> => {
  const parsed = TrainSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { unitId, quantity } = parsed.data;
  const playerId = req.player!.playerId;

  try {
    const city      = await getCityOrThrow(req.params.id, playerId);
    const buildings = city.buildings as unknown as CityBuilding[];
    const resources = city.resources as unknown as ResourceMap;
    const unitDef   = UNITS[unitId];

    // Check training building exists at required level
    const trainingBuilding = buildings.find(
      (b) => b.buildingId === unitDef.trainingBuilding && b.level >= unitDef.trainingBuildingLevel
    );
    if (!trainingBuilding) {
      res.status(400).json({
        success: false,
        error: `Requires ${BUILDINGS[unitDef.trainingBuilding].name} level ${unitDef.trainingBuildingLevel}`,
      });
      return;
    }

    // Calculate total cost
    const totalCost: ResourceMap = Object.fromEntries(
      Object.entries(unitDef.cost).map(([k, v]) => [k, v * quantity])
    ) as ResourceMap;

    const duration = unitDef.trainingTime * quantity;
    const now      = new Date();
    const endsAt   = new Date(now.getTime() + duration * 1000);

    // Re-read resources inside the transaction so the affordability check and
    // the deduction are atomic — prevents double-spend from concurrent requests.
    const { updatedCity, job } = await prisma.$transaction(async (tx) => {
      const freshCity      = await tx.city.findUniqueOrThrow({ where: { id: city.id } });
      const freshResources = freshCity.resources as unknown as ResourceMap;

      if (!canAfford(freshResources, totalCost)) {
        throw Object.assign(new Error('Not enough resources'), { status: 400 });
      }

      const newResources = subtractResources(freshResources, totalCost);

      const updatedCity = await tx.city.update({
        where: { id: city.id },
        data:  { resources: newResources },
      });
      const job = await tx.job.create({
        data: {
          type:     'training',
          playerId,
          cityId:   city.id,
          metadata: { unitId, quantity },
          startedAt: now,
          endsAt,
        },
      });
      return { updatedCity, job };
    });

    res.status(201).json({ success: true, data: { job, city: updatedCity } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

export default router;
