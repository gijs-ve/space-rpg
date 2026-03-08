import { Job }              from '@prisma/client';
import { prisma }            from '../../db/client';
import { io, playerSockets } from '../../index';
import { TroopMap, UnitId, RecallJobMeta } from '@rpg/shared';

// ─────────────────────────────────────────────────────────────────────────────

export async function resolveRecallJob(job: Job): Promise<void> {
  const meta = job.metadata as unknown as RecallJobMeta;
  const { cityId, troops } = meta;

  // ── Return troops to city ──────────────────────────────────────────────────
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) {
    console.warn(`[recall resolver] city ${cityId} no longer exists`);
    return;
  }

  const garrison  = city.troops as unknown as TroopMap;
  const restored: TroopMap = { ...garrison };
  for (const [uid, cnt] of Object.entries(troops) as [UnitId, number][]) {
    if (cnt) restored[uid as UnitId] = (restored[uid as UnitId] ?? 0) + cnt;
  }

  await prisma.city.update({ where: { id: cityId }, data: { troops: restored } });

  // ── Notify client ──────────────────────────────────────────────────────────
  const sock = playerSockets.get(job.playerId);
  if (sock) {
    io.to(sock).emit('domain:recallComplete', {
      jobId:    job.id,
      cityId,
      troops,
    });
  }
}
