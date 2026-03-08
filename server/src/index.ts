import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents } from '@rpg/shared';

import authRouter          from './routes/auth';
import heroRouter          from './routes/hero';
import basesRouter         from './routes/bases';
import mapRouter           from './routes/map';
import attackRouter        from './routes/attack';
import domainRouter        from './routes/domain';
import itemsRouter         from './routes/items';
import activityReportsRouter from './routes/activity-reports';
import marketRouter        from './routes/market';
import vendorsRouter       from './routes/vendors';
import craftingRouter      from './routes/crafting';
import { startJobRunner }     from './jobs/runner';
import { startResourceTick }  from './jobs/resourceTick';
import { startHeroRegenTick } from './jobs/heroRegenTick';
import { syncVendors }        from './services/vendor.service';

const app  = express();
const http = createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
export const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(http, {
  cors: {
    origin: process.env.CLIENT_URL ?? 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Map playerId → socket id for targeted emissions
export const playerSockets = new Map<string, string>();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error('Missing token'));

  try {
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret') as { playerId: string };
    (socket as any).playerId = payload.playerId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const playerId = (socket as any).playerId as string;
  playerSockets.set(playerId, socket.id);

  socket.on('ping', () => { /* keep-alive */ });

  socket.on('disconnect', () => {
    playerSockets.delete(playerId);
  });
});

// ─── Express middleware ───────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL ?? 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth',             authRouter);
app.use('/hero',             heroRouter);
app.use('/bases',            basesRouter);
app.use('/map',              mapRouter);
app.use('/attack',           attackRouter);
app.use('/domain',           domainRouter);
app.use('/items',            itemsRouter);
app.use('/activity-reports', activityReportsRouter);
app.use('/market',           marketRouter);
app.use('/vendors',          vendorsRouter);
app.use('/crafting',         craftingRouter);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '5000', 10);
http.listen(PORT, async () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  await syncVendors();
  startJobRunner();
  startResourceTick();
  startHeroRegenTick();
});
