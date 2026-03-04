import { Job } from '@prisma/client';
import { prisma } from '../../db/client';
import { io, playerSockets } from '../../index';
import { ConstructionJobMeta, CityBuilding, BuildingId } from '@rpg/shared';
import { computeStorageCap } from '../../services/base.service';

export async function resolveConstructionJob(job: Job) {
  const meta = job.metadata as unknown as ConstructionJobMeta;
  if (!job.cityId) return;

  const city = await prisma.city.findUniqueOrThrow({ where: { id: job.cityId } });
  const buildings = city.buildings as unknown as CityBuilding[];

  // Update or insert the building at the given slot
  const existingIdx = buildings.findIndex((b) => b.slotIndex === meta.slotIndex);
  const newBuilding: CityBuilding = {
    slotIndex:  meta.slotIndex,
    buildingId: meta.buildingId as BuildingId,
    level:      meta.targetLevel,
    // Carry over per-instance meta (e.g. selectedResources for storage_expansion)
    ...(meta.storageResources?.length
      ? { meta: { selectedResources: meta.storageResources } }
      : existingIdx >= 0 && (buildings[existingIdx] as any).meta
        ? { meta: (buildings[existingIdx] as any).meta }
        : {}),
  };

  if (existingIdx >= 0) {
    buildings[existingIdx] = newBuilding;
  } else {
    buildings.push(newBuilding);
  }

  // Recompute storage cap based on new buildings
  const newStorageCap = computeStorageCap(buildings);

  const updatedCity = await prisma.city.update({
    where: { id: city.id },
    data:  { buildings: buildings as any, storageCap: newStorageCap as any },
  });

  const socketId = playerSockets.get(job.playerId);
  if (socketId) {
    io.to(socketId).emit('construction:complete', {
      jobId:  job.id,
      cityId: city.id,
      city:   updatedCity as any,
    });
  }
}
