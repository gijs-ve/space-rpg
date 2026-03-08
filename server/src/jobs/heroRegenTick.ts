import { prisma } from '../db/client';
import {
  computeEnergyRegenPerTick,
  computeHealthRegenPerTick,
  REGEN_TICK_INTERVAL_SECONDS,
} from '@rpg/shared';
import type { SkillLevels } from '@rpg/shared';
import { io, playerSockets } from '../index';
import { getHeroItemBonuses } from '../services/hero.service';

const TICK_INTERVAL_MS = REGEN_TICK_INTERVAL_SECONDS * 1000; // 300_000 ms

/**
 * Milliseconds until the next 5-minute clock-aligned tick.
 * Ticks fire at 10:00, 10:05, 10:10, ... (aligned to wall-clock minutes).
 */
function msUntilNextTick(): number {
  const now  = Date.now();
  const next = Math.ceil(now / TICK_INTERVAL_MS) * TICK_INTERVAL_MS;
  // Ensure at least 1 ms delay (avoid firing instantly when exactly on a boundary)
  return Math.max(next - now, 1);
}

/**
 * Start the global hero energy/health regen tick.
 * Fires every 5 minutes, synchronized to wall-clock time (10:00, 10:05, 10:10, …).
 * All heroes receive regen at the same moment.
 */
export function startHeroRegenTick() {
  const delay = msUntilNextTick();
  const nextAt = new Date(Date.now() + delay);
  console.log(`❤️  Hero regen tick scheduled — next at ${nextAt.toISOString()} (in ${Math.round(delay / 1000)}s)`);

  const scheduleNext = () => {
    setTimeout(async () => {
      await runRegenTick();
      // After each tick, schedule the next one at the next 5-min boundary
      scheduleNext();
    }, msUntilNextTick());
  };

  setTimeout(async () => {
    await runRegenTick();
    scheduleNext();
  }, delay);
}

async function runRegenTick() {
  const now = new Date();
  console.log(`❤️  Hero regen tick — ${now.toISOString()}`);

  try {
    const heroes = await prisma.hero.findMany({
      select: {
        id:        true,
        playerId:  true,
        energy:    true,
        maxEnergy: true,
        health:    true,
        maxHealth: true,
        skillLevels: true,
      },
    });

    for (const hero of heroes) {
      try {
        const skillLevels = hero.skillLevels as unknown as SkillLevels;
        const itemBonuses = await getHeroItemBonuses(hero.id);

        const energyRegen = computeEnergyRegenPerTick(skillLevels, itemBonuses);
        const healthRegen = computeHealthRegenPerTick(skillLevels, itemBonuses);

        const newEnergy = Math.min(hero.energy + energyRegen, hero.maxEnergy);
        const newHealth = Math.min(hero.health + healthRegen, hero.maxHealth);

        const energyChanged = newEnergy !== hero.energy;
        const healthChanged = newHealth !== hero.health;

        if (energyChanged || healthChanged) {
          await prisma.hero.update({
            where: { id: hero.id },
            data: {
              ...(energyChanged ? { energy: newEnergy, lastEnergyRegen: now } : {}),
              ...(healthChanged ? { health: newHealth, lastHealthRegen: now } : {}),
            },
          });

          // Notify the owning player if connected
          const socketId = playerSockets.get(hero.playerId);
          if (socketId) {
            io.to(socketId).emit('hero:regen', {
              heroId: hero.id,
              energy: newEnergy,
              health: newHealth,
            });
          }
        }
      } catch (err) {
        console.error(`Hero regen tick failed for hero ${hero.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Hero regen tick error:', err);
  }
}
