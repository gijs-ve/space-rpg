import { Job } from '@prisma/client';
import { prisma } from '../../db/client';
import { io, playerSockets } from '../../index';
import { TrainingJobMeta, TroopMap, UnitId } from '@rpg/shared';

export async function resolveTrainingJob(job: Job) {
  const meta = job.metadata as unknown as TrainingJobMeta;
  if (!job.cityId) return;

  const city   = await prisma.city.findUniqueOrThrow({ where: { id: job.cityId } });
  const troops = city.troops as unknown as TroopMap;

  const currentCount = troops[meta.unitId as UnitId] ?? 0;
  const newTroops: TroopMap = {
    ...troops,
    [meta.unitId]: currentCount + meta.quantity,
  };

  const updatedCity = await prisma.city.update({
    where: { id: city.id },
    data:  { troops: newTroops },
  });

  const socketId = playerSockets.get(job.playerId);
  if (socketId) {
    io.to(socketId).emit('training:complete', {
      jobId:    job.id,
      cityId:   city.id,
      unitId:   meta.unitId as UnitId,
      quantity: meta.quantity,
      city:     updatedCity as any,
    });
  }
}
