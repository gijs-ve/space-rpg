import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents } from '@rpg/shared';

import authRouter   from './routes/auth';
import heroRouter   from './routes/hero';
import citiesRouter from './routes/cities';
import mapRouter    from './routes/map';
import { startJobRunner }     from './jobs/runner';
import { startResourceTick }  from './jobs/resourceTick';

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
app.use('/auth',   authRouter);
app.use('/hero',   heroRouter);
app.use('/cities', citiesRouter);
app.use('/map',    mapRouter);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '5000', 10);
http.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  startJobRunner();
  startResourceTick();
});
