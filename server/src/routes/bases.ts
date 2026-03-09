import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/client';
import { scaleDuration } from '../config';
import {
  getCitiesForPlayer,
  getCityOrThrow,
  computeProductionRates,
  computeStorageCap,
  getBaseItemBonuses,
  computeDomainResourceBonusPct,
} from '../services/base.service';
import {
  BUILDINGS,
  BuildingId,
  BUILDING_LIST,
  CityBuilding,
  ResourceMap,
  ResourceType,
  RESOURCE_TYPES,
  UNITS,
  UnitId,
  UNIT_LIST,
  canAfford,
  subtractResources,
  addResourcesWithCap,
  computeConstructionTime,
  computeTrainingTime,
  computeTotalBuildingCost,
  meetsPrerequisite,
  storageExpansionResourceSlots,
  CITY_BUILDING_SLOTS,
  STARTING_RESOURCES,
  BASE_STORAGE_CAP,
  DEFAULT_CIV_ID,
  MAP_WIDTH,
  MAP_HEIGHT,
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
    const itemBonuses = await getBaseItemBonuses(city.id);
    const baseRates = computeProductionRates(buildings);         // raw building output
    const itemBoostedRates = computeProductionRates(buildings, itemBonuses); // after item %

    // Apply domain tile resource bonuses (same logic as the resource tick)
    const domainBonusPct = await computeDomainResourceBonusPct(city.id);
    const productionRates: ResourceMap = { ...itemBoostedRates };
    for (const r of RESOURCE_TYPES) {
      const pct = domainBonusPct[r] ?? 0;
      if (pct > 0) productionRates[r] = Math.floor(itemBoostedRates[r] * (1 + pct / 100));
    }

    // Build per-resource breakdown for the UI tooltip
    const itemBonusPct = Math.min(itemBonuses.productionBonus ?? 0, 50);
    const productionBreakdown: Record<string, unknown> = {};
    for (const r of RESOURCE_TYPES) {
      if (productionRates[r] > 0 || baseRates[r] > 0) {
        productionBreakdown[r] = {
          buildings:      baseRates[r],
          itemBonusPct,
          domainBonusPct: domainBonusPct[r] ?? 0,
          total:          productionRates[r],
        };
      }
    }

    const activeJobs = await prisma.job.findMany({
      where: { cityId: city.id, completed: false },
    });
    res.json({ success: true, data: { city: { ...city, productionRates, productionBreakdown }, activeJobs } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /bases/found — found the player's first (home) city ───────────────────
const FoundSchema = z.object({
  x:    z.number().int().min(0).max(MAP_WIDTH  - 1),
  y:    z.number().int().min(0).max(MAP_HEIGHT - 1),
  name: z.string().min(1).max(40).optional(),
});

router.post('/found', async (req: Request, res: Response): Promise<void> => {
  const parsed = FoundSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { x, y, name } = parsed.data;
  const playerId = req.player!.playerId;

  try {
    // Load hero — must not already have a home city (pick first hero without one)
    const hero = await prisma.hero.findFirst({ where: { playerId }, select: { id: true, homeCityId: true } });
    if (!hero) {
      res.status(404).json({ success: false, error: 'Hero not found' });
      return;
    }
    if (hero.homeCityId) {
      res.status(409).json({ success: false, error: 'You already have a home city' });
      return;
    }

    // Check tile is not already occupied by another city
    const occupiedTile = await prisma.mapTile.findUnique({
      where:  { x_y: { x, y } },
      select: { cityId: true },
    });
    if (occupiedTile?.cityId) {
      res.status(409).json({ success: false, error: 'Tile is already occupied' });
      return;
    }

    const player = await prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      select: { username: true },
    });

    const storageCap = Object.fromEntries(
      RESOURCE_TYPES.map((r) => [r, BASE_STORAGE_CAP])
    );

    const { city } = await prisma.$transaction(async (tx) => {
      const city = await tx.city.create({
        data: {
          playerId,
          name:      name ?? `${player.username}'s Settlement`,
          x,
          y,
          civId:     DEFAULT_CIV_ID,
          resources: STARTING_RESOURCES,
          storageCap,
          buildings: [{ slotIndex: 0, buildingId: 'great_hall', level: 1 }],
          troops:    {},
        },
      });

      await tx.mapTile.upsert({
        where:  { x_y: { x, y } },
        update: { type: 'castle', cityId: city.id },
        create: { x, y, type: 'castle', cityId: city.id },
      });

      await tx.hero.update({
        where: { id: hero.id },
        data:  { homeCityId: city.id },
      });

      return { city };
    });

    res.status(201).json({ success: true, data: { city } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── POST /bases/:id/build ───────────────────────────────────────────────────────
const BuildSchema = z.object({
  slotIndex:        z.number().int().min(0).max(CITY_BUILDING_SLOTS - 1),
  buildingId:       z.enum(BUILDING_LIST.map((b) => b.id) as [BuildingId, ...BuildingId[]]),
  storageResources: z.array(z.enum(RESOURCE_TYPES as unknown as [ResourceType, ...ResourceType[]])).optional(),
});

router.post('/:id/build', async (req: Request, res: Response): Promise<void> => {
  const parsed = BuildSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { slotIndex, buildingId, storageResources } = parsed.data;
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

    // Check maxPerBase limit (only for new builds, not upgrades)
    if (!existing && def.maxPerBase !== undefined) {
      const existingCount = buildings.filter((b) => b.buildingId === buildingId).length;
      if (existingCount >= def.maxPerBase) {
        res.status(400).json({ success: false, error: `Only ${def.maxPerBase} ${def.name} allowed per base` });
        return;
      }
    }

    if (targetLevel > def.maxLevel) {
      res.status(400).json({ success: false, error: 'Building already at max level' });
      return;
    }

    // Validate storageResources for storage_expansion
    if (buildingId === 'storage_expansion') {
      const expectedSlots = storageExpansionResourceSlots(targetLevel);
      const provided = storageResources ?? [];
      if (provided.length !== expectedSlots) {
        res.status(400).json({ success: false, error: `storage_expansion at level ${targetLevel} requires exactly ${expectedSlots} resource(s)` });
        return;
      }
      if (new Set(provided).size !== provided.length) {
        res.status(400).json({ success: false, error: 'Duplicate resources in storage selection' });
        return;
      }
      // Ensure existing resources are preserved (can\'t change them)
      const existingResources = ((existing?.meta as Record<string, unknown> | undefined)?.selectedResources as string[] | undefined) ?? [];
      for (const r of existingResources) {
        if (!provided.includes(r as ResourceType)) {
          res.status(400).json({ success: false, error: `Cannot remove already-assigned resource: ${r}` });
          return;
        }
      }
    } else if (storageResources) {
      res.status(400).json({ success: false, error: 'storageResources is only valid for storage_expansion' });
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

    // Compute duration: base construction time reduced by civ bonus, then by armory item bonus.
    const rawConstructionTime  = computeConstructionTime(buildingId, targetLevel, city.civId as any);
    const baseItemBonuses      = await getBaseItemBonuses(city.id);
    const constructionBoostPct = Math.min(baseItemBonuses.constructionSpeedBonus ?? 0, 50);
    const adjConstructionTime  = constructionBoostPct > 0
      ? Math.max(1, Math.floor(rawConstructionTime * (1 - constructionBoostPct / 100)))
      : rawConstructionTime;
    const duration = scaleDuration(adjConstructionTime);
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
          metadata: { slotIndex, buildingId, targetLevel, ...(storageResources && { storageResources }) },
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

// ─── POST /bases/:id/refund-building ──────────────────────────────────────────
const RefundSchema = z.object({
  slotIndex: z.number().int().min(0).max(CITY_BUILDING_SLOTS - 1),
});

router.post('/:id/refund-building', async (req: Request, res: Response): Promise<void> => {
  const parsed = RefundSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { slotIndex } = parsed.data;
  const playerId = req.player!.playerId;

  try {
    const city      = await getCityOrThrow(req.params.id, playerId);
    const buildings = city.buildings as unknown as CityBuilding[];

    const building = buildings.find((b) => b.slotIndex === slotIndex);
    if (!building) {
      res.status(404).json({ success: false, error: 'No building at that slot' });
      return;
    }

    // Block refund if this slot is currently being constructed/upgraded
    const activeJob = await prisma.job.findFirst({
      where: { cityId: city.id, type: 'construction', completed: false },
    });
    if (activeJob) {
      const meta = activeJob.metadata as { slotIndex?: number };
      if (meta.slotIndex === slotIndex) {
        res.status(409).json({ success: false, error: 'Cannot refund a building currently under construction' });
        return;
      }
    }

    // 80% refund of total cost spent across all levels
    const totalCost = computeTotalBuildingCost(building.buildingId, building.level);
    const refund: ResourceMap = Object.fromEntries(
      Object.entries(totalCost).map(([r, v]) => [r, Math.floor((v as number) * 0.8)])
    ) as ResourceMap;

    const newBuildings = buildings.filter((b) => b.slotIndex !== slotIndex);

    const updatedCity = await prisma.$transaction(async (tx) => {
      const freshCity     = await tx.city.findUniqueOrThrow({ where: { id: city.id } });
      const freshRes      = freshCity.resources  as unknown as ResourceMap;
      const freshCap      = freshCity.storageCap as unknown as ResourceMap;
      const newResources  = addResourcesWithCap(freshRes, refund, freshCap);
      const newStorageCap = computeStorageCap(newBuildings);
      return tx.city.update({
        where: { id: city.id },
        data:  { buildings: newBuildings as any, resources: newResources, storageCap: newStorageCap as any },
      });
    });

    res.json({ success: true, data: { refund, city: updatedCity } });
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

    // Total cost for all units
    const totalCost: ResourceMap = Object.fromEntries(
      Object.entries(unitDef.cost).map(([k, v]) => [k, (v as number) * quantity])
    ) as ResourceMap;

    // Effective single-unit training time (building level + armory item bonuses)
    const baseItemBonuses  = await getBaseItemBonuses(city.id);
    const trainingBoostPct = Math.min(baseItemBonuses.trainingSpeedBonus ?? 0, 50);
    const singleUnitSecs   = computeTrainingTime(unitId, trainingBuilding.level, trainingBoostPct);
    const singleDuration   = scaleDuration(singleUnitSecs);

    // Find the end of the current training queue so new jobs are appended
    const lastQueuedJob = await prisma.job.findFirst({
      where:   { cityId: city.id, type: 'training', completed: false },
      orderBy: { endsAt: 'desc' },
    });

    const now      = new Date();
    const queueTail = lastQueuedJob ? lastQueuedJob.endsAt : now;

    // Build one job record per unit, staggered sequentially
    const jobsData = Array.from({ length: quantity }, (_, i) => ({
      type:     'training' as const,
      playerId,
      cityId:   city.id,
      metadata: { unitId, quantity: 1, durationSecs: singleDuration } as object,
      startedAt: new Date(queueTail.getTime() +  i      * singleDuration * 1000),
      endsAt:    new Date(queueTail.getTime() + (i + 1) * singleDuration * 1000),
    }));

    // Deduct total resources up-front, then insert all jobs atomically
    const { updatedCity, jobs } = await prisma.$transaction(async (tx) => {
      const freshCity      = await tx.city.findUniqueOrThrow({ where: { id: city.id } });
      const freshResources = freshCity.resources as unknown as ResourceMap;

      if (!canAfford(freshResources, totalCost)) {
        throw Object.assign(new Error('Not enough resources'), { status: 400 });
      }

      const newResources = subtractResources(freshResources, totalCost);
      const updatedCity  = await tx.city.update({
        where: { id: city.id },
        data:  { resources: newResources },
      });
      const jobs = await Promise.all(jobsData.map((d) => tx.job.create({ data: d })));
      return { updatedCity, jobs };
    });

    res.status(201).json({ success: true, data: { jobs, city: updatedCity } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /bases/:id/train-job/:jobId — cancel a queued training unit ─────
router.delete('/:id/train-job/:jobId', async (req: Request, res: Response): Promise<void> => {
  const playerId = req.player!.playerId;
  try {
    const city = await getCityOrThrow(req.params.id, playerId);
    const job  = await prisma.job.findUnique({ where: { id: req.params.jobId } });

    if (!job || job.cityId !== city.id || job.type !== 'training' || job.completed) {
      res.status(404).json({ success: false, error: 'Training job not found' });
      return;
    }

    const meta     = job.metadata as { unitId: UnitId; quantity: number; durationSecs: number };
    const unitDef  = UNITS[meta.unitId];
    const durationMs = meta.durationSecs * 1000;

    // All subsequent training jobs in the queue need their times shifted back
    const laterJobs = await prisma.job.findMany({
      where: {
        cityId:    city.id,
        type:      'training',
        completed: false,
        endsAt:    { gt: job.endsAt },
      },
    });

    const updatedCity = await prisma.$transaction(async (tx) => {
      // Remove the cancelled job
      await tx.job.delete({ where: { id: job.id } });

      // Slide later jobs back by the cancelled unit's duration
      for (const lj of laterJobs) {
        await tx.job.update({
          where: { id: lj.id },
          data: {
            startedAt: new Date(lj.startedAt.getTime() - durationMs),
            endsAt:    new Date(lj.endsAt.getTime()    - durationMs),
          },
        });
      }

      // Refund the unit's resource cost (capped at storage)
      const freshCity = await tx.city.findUniqueOrThrow({ where: { id: city.id } });
      const freshRes  = freshCity.resources  as unknown as ResourceMap;
      const freshCap  = freshCity.storageCap as unknown as ResourceMap;
      const refunded  = addResourcesWithCap(freshRes, unitDef.cost, freshCap);
      return tx.city.update({ where: { id: city.id }, data: { resources: refunded } });
    });

    res.json({ success: true, data: { city: updatedCity } });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ success: false, error: err.message });
  }
});

export default router;
