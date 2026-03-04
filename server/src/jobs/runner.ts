import { prisma } from '../db/client';
import { resolveAdventureJob }    from './resolvers/adventure.resolver';
import { resolveConstructionJob } from './resolvers/construction.resolver';
import { resolveTrainingJob }     from './resolvers/training.resolver';
import { resolveCraftingJob }     from './resolvers/crafting.resolver';

const POLL_INTERVAL_MS = 5_000; // 5 seconds

export function startJobRunner() {
  console.log('⚙️  Job runner started (poll every 5s)');

  setInterval(async () => {
    try {
      const dueJobs = await prisma.job.findMany({
        where: { completed: false, endsAt: { lte: new Date() } },
        orderBy: { endsAt: 'asc' },
        take: 50, // process at most 50 jobs per tick to avoid overload
      });

      if (dueJobs.length === 0) return;

      // Mark all as completed first to avoid double-processing
      await prisma.job.updateMany({
        where: { id: { in: dueJobs.map((j) => j.id) } },
        data:  { completed: true },
      });

      for (const job of dueJobs) {
        try {
          if (job.type === 'adventure')    await resolveAdventureJob(job);
          if (job.type === 'construction') await resolveConstructionJob(job);
          if (job.type === 'training')     await resolveTrainingJob(job);
          if (job.type === 'crafting')     await resolveCraftingJob(job);
        } catch (err) {
          console.error(`Error resolving job ${job.id} (${job.type}):`, err);
        }
      }
    } catch (err) {
      console.error('Job runner error:', err);
    }
  }, POLL_INTERVAL_MS);
}
