import { prisma } from '../db/client';
import { applyResourceTick } from '../services/city.service';
import { io, playerSockets } from '../index';

const TICK_INTERVAL_MS  = 60_000; // 60 seconds
const TICK_SECONDS      = 60;

export function startResourceTick() {
  console.log('💰 Resource tick started (every 60s)');

  setInterval(async () => {
    try {
      const cities = await prisma.city.findMany({ select: { id: true, playerId: true } });

      for (const city of cities) {
        try {
          const updated = await applyResourceTick(city.id, TICK_SECONDS);

          // Notify the owning player if connected
          const socketId = playerSockets.get(city.playerId);
          if (socketId) {
            io.to(socketId).emit('resource:tick', {
              cityId:    city.id,
              resources: updated.resources as any,
            });
          }
        } catch (err) {
          console.error(`Resource tick failed for city ${city.id}:`, err);
        }
      }
    } catch (err) {
      console.error('Resource tick error:', err);
    }
  }, TICK_INTERVAL_MS);
}
