import { Job }              from '@prisma/client';
import { prisma }            from '../../db/client';
import { TroopMap, UnitId, ReinforceJobMeta } from '@rpg/shared';

// ─────────────────────────────────────────────────────────────────────────────

export async function resolveReinforceJob(job: Job): Promise<void> {
  const meta = job.metadata as unknown as ReinforceJobMeta;
  const { domainTileId, cityId, troops } = meta;

  // Load the domain tile — it may have been recalled/lost while troops were marching
  const dt = await prisma.domainTile.findUnique({ where: { id: domainTileId } });

  if (!dt || dt.cityId !== cityId) {
    // Tile is gone or changed ownership — return reinforcements to home city
    await returnTroops(cityId, troops as TroopMap);
    console.log(
      `[reinforce resolver] domain tile ${domainTileId} gone — returned troop reinforcements to city ${cityId}`,
    );
    return;
  }

  // Add the reinforcing troops to the tile's garrison
  const currentGarrison = dt.troops as unknown as TroopMap;
  const newGarrison: TroopMap = { ...currentGarrison };
  for (const [uid, cnt] of Object.entries(troops) as [UnitId, number][]) {
    if (cnt) newGarrison[uid] = (newGarrison[uid] ?? 0) + cnt;
  }

  await prisma.domainTile.update({
    where: { id: domainTileId },
    data:  { troops: newGarrison },
  });

  const total = Object.values(troops as TroopMap).reduce((s, n) => s + (n ?? 0), 0);
  console.log(
    `[reinforce resolver] ${total} troops arrived at domain tile (${dt.x},${dt.y}) for city ${cityId}`,
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function returnTroops(cityId: string, troops: TroopMap): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const city = await tx.city.findUnique({ where: { id: cityId } });
    if (!city) return;
    const garrison: TroopMap = { ...(city.troops as unknown as TroopMap) };
    for (const [uid, cnt] of Object.entries(troops) as [UnitId, number][]) {
      if (cnt) garrison[uid] = (garrison[uid] ?? 0) + cnt;
    }
    await tx.city.update({ where: { id: cityId }, data: { troops: garrison } });
  });
}
