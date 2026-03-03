import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db/client';
import { DEFAULT_CIV_ID, STARTING_RESOURCES, BASE_STORAGE_CAP, RESOURCE_TYPES } from '@rpg/shared';

const router = Router();
const JWT_SECRET   = process.env.JWT_SECRET   ?? 'dev-secret';
const JWT_EXPIRES  = process.env.JWT_EXPIRES_IN ?? '7d';

// ─── Validation schemas ───────────────────────────────────────────────────────
const RegisterSchema = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  email:    z.string().email(),
  password: z.string().min(8).max(64),
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
});

// ─── POST /auth/register ──────────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { username, email, password } = parsed.data;

  const existing = await prisma.player.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    res.status(409).json({ success: false, error: 'Email or username already taken' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const storageCap = Object.fromEntries(
    RESOURCE_TYPES.map((r) => [r, BASE_STORAGE_CAP])
  );

  // Create player, hero, and starting city in a transaction
  const player = await prisma.$transaction(async (tx) => {
    const p = await tx.player.create({
      data: { username, email, passwordHash },
    });

    await tx.hero.create({
      data: { playerId: p.id },
    });

    // Find a free plains tile for the starting city
    const occupiedTiles = await tx.mapTile.findMany({
      where: { cityId: { not: null } },
      select: { x: true, y: true },
    });
    const occupiedSet = new Set(occupiedTiles.map((t) => `${t.x},${t.y}`));

    let startX = 50;
    let startY = 50;
    // Simple search for a free tile near centre
    outer: for (let r = 0; r < 50; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const cx = 50 + dx;
          const cy = 50 + dy;
          if (!occupiedSet.has(`${cx},${cy}`)) {
            startX = cx;
            startY = cy;
            break outer;
          }
        }
      }
    }

    const city = await tx.city.create({
      data: {
        playerId: p.id,
        name: `${username}'s Starbase`,
        x: startX,
        y: startY,
        civId: DEFAULT_CIV_ID,
        resources: STARTING_RESOURCES,
        storageCap,
        buildings: [],
        troops: {},
      },
    });

    // Mark the map tile as a starbase tile
    await tx.mapTile.upsert({
      where: { x_y: { x: startX, y: startY } },
      update: { type: 'starbase', cityId: city.id },
      create: { x: startX, y: startY, type: 'starbase', cityId: city.id },
    });

    return p;
  });

  const token = jwt.sign(
    { playerId: player.id, email: player.email } as object,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES } as jwt.SignOptions
  );

  res.status(201).json({
    success: true,
    data: {
      token,
      player: { id: player.id, username: player.username, email: player.email },
    },
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password } = parsed.data;

  const player = await prisma.player.findUnique({ where: { email } });
  if (!player) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, player.passwordHash);
  if (!valid) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { playerId: player.id, email: player.email } as object,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES } as jwt.SignOptions
  );

  res.json({
    success: true,
    data: {
      token,
      player: { id: player.id, username: player.username, email: player.email },
    },
  });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────
// JWT is stateless; logout simply tells the client to discard the token.
// For a robust solution add a token blocklist (post-MVP).
router.post('/logout', (_req, res) => {
  res.json({ success: true, data: { message: 'Logged out' } });
});

export default router;
