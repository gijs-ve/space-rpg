# RPG City Builder — MVP Design Document

## Game Overview

A multiplayer browser-based strategy game combining hero RPG progression with city-building and army management, inspired by Travian and Grecopolis. Everything meaningful takes time — construction, training, adventures — and the game world persists on the server.

---

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Node.js + Express | REST API + WebSocket (Socket.io) |
| Realtime | Socket.io | Timer events, map updates |
| Database | PostgreSQL + Prisma ORM | Persistent game state |
| Frontend | Next.js (App Router) | React, Tailwind CSS |
| Shared | `/shared` workspace package | Constants, types, formulas |
| Auth | JWT (access + refresh tokens) | Stored in httpOnly cookies |

---

## Monorepo Folder Structure

```
/
├── shared/               # Shared constants, types, game formulas
│   ├── constants/
│   │   ├── buildings.ts
│   │   ├── units.ts
│   │   ├── resources.ts
│   │   ├── skills.ts
│   │   ├── activities.ts
│   │   ├── map.ts
│   │   └── civilizations.ts
│   ├── types/
│   │   ├── game.ts       # Core domain types
│   │   ├── api.ts        # Request/response types
│   │   └── socket.ts     # Socket event types
│   └── formulas/
│       ├── construction.ts
│       ├── combat.ts
│       └── hero.ts
│
├── server/               # Node.js backend
│   ├── src/
│   │   ├── routes/       # Express route handlers
│   │   ├── services/     # Business logic
│   │   ├── jobs/         # Tick-based background jobs (timers)
│   │   ├── socket/       # Socket.io event handlers
│   │   ├── db/           # Prisma client + migrations
│   │   └── middleware/
│   └── package.json
│
├── client/               # Next.js frontend
│   ├── app/
│   │   ├── (auth)/       # Login / register pages
│   │   ├── hero/         # Hero profile, skills, adventures
│   │   ├── city/[id]/    # City view, buildings, troops
│   │   └── map/          # World map
│   ├── components/
│   │   ├── ui/           # Generic atoms (Button, Card, Timer…)
│   │   ├── hero/
│   │   ├── city/
│   │   └── map/
│   └── package.json
│
└── package.json          # Root workspace / scripts
```

---

## Shared Constants Design

All game data lives in `/shared/constants/` so both server (validation, calculations) and client (display, UI) use the exact same definitions.

### Resources (`resources.ts`)

```ts
export const RESOURCE_TYPES = ['food', 'wood', 'stone', 'iron', 'gold'] as const;
export type ResourceType = typeof RESOURCE_TYPES[number];

export type ResourceMap = Record<ResourceType, number>;
export const EMPTY_RESOURCES: ResourceMap = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 };
```

### Buildings (`buildings.ts`)

Each building definition describes every level (up to 10 for MVP) including costs, construction time, and effects.

```ts
export type BuildingId =
  | 'town_hall' | 'farm' | 'lumber_mill' | 'quarry' | 'iron_mine'
  | 'market' | 'barracks' | 'stable' | 'workshop' | 'wall';

export interface BuildingLevel {
  level: number;
  cost: ResourceMap;
  constructionTime: number;  // seconds
  effect: Record<string, number>; // e.g. { foodProduction: 50 }
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  description: string;
  maxLevel: number;
  levels: BuildingLevel[];
  prerequisite?: { buildingId: BuildingId; minLevel: number };
}
```

### Units (`units.ts`)

```ts
export type UnitId = 'swordsman' | 'archer' | 'cavalry' | 'siege_ram';

export interface UnitDef {
  id: UnitId;
  name: string;
  trainingBuilding: BuildingId;
  trainingBuildingLevel: number; // minimum building level required
  trainingTime: number;          // seconds per unit
  cost: ResourceMap;
  upkeep: ResourceMap;           // per hour, per unit
  stats: { attack: number; defense: number; speed: number; carry: number };
}
```

### Skills (`skills.ts`)

```ts
export type SkillId = 'combat' | 'endurance' | 'gathering' | 'leadership' | 'tactics';

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
  maxLevel: number;
  // How much adventure XP is required to reach each level
  xpPerLevel: number[];
  // Bonus applied per level (server uses this for calculations)
  bonusPerLevel: Record<string, number>;
}
```

### Activities (`activities.ts`)

Activities cover both hero adventures and general timed actions.

```ts
export type ActivityType = 'adventure_hunt' | 'adventure_explore' | 'adventure_raid';

export interface ActivityDef {
  id: ActivityType;
  name: string;
  description: string;
  durationRange: [number, number]; // [minSeconds, maxSeconds]
  energyCost: number;
  rewards: {
    xpRange: [number, number];
    resourceRange: Partial<ResourceMap>;
    skillXp: Partial<Record<SkillId, number>>;
  };
  levelRequirement: number; // minimum hero level
}
```

### Civilizations (`civilizations.ts`)

```ts
export type CivId = 'default';

export interface CivDef {
  id: CivId;
  name: string;
  description: string;
  bonuses: {
    resourceBonus?: Partial<ResourceMap>;        // % bonus to production
    buildingSpeedBonus?: number;                 // % faster construction
    unitStatBonus?: Partial<Record<UnitId, Partial<UnitStats>>>;
  };
  availableUnits: UnitId[];
  availableBuildings: BuildingId[];
}

// MVP: single civilization
export const CIVILIZATIONS: Record<CivId, CivDef> = {
  default: { id: 'default', name: 'Realm', ... }
};
```

### Map (`map.ts`)

```ts
export type TileType = 'plains' | 'forest' | 'mountain' | 'lake' | 'city' | 'ruins';

export const MAP_WIDTH  = 100;
export const MAP_HEIGHT = 100;

export interface TileDef {
  type: TileType;
  passable: boolean;
  resourceBonus?: Partial<ResourceMap>;  // tiles near forests have wood bonus etc.
  encounterChance?: number;              // for adventures
}
```

---

## Core Game Systems

### 1. Hero System

| Property | Details |
|----------|---------|
| Energy | Max 100. Regenerates 1 point / 6 min. Used to start adventures. |
| Level | 1–50 for MVP. Gained by accumulating XP from adventures. |
| XP | Earned from adventures. Follows quadratic curve per level. |
| Skills | 5 skills, each leveled independently via adventure skill-XP. |
| Inventory | Simple list of reward items (stretch goal post-MVP). |

**Hero progression formula** (in `shared/formulas/hero.ts`):
```
xpRequired(level) = 100 * level^1.5
energyRegenInterval = 360 seconds (6 min)
```

**Adventure flow:**
1. Player selects activity type (hunt / explore / raid).
2. Server validates energy, creates `AdventureJob` with `endsAt = now + duration`.
3. Background job resolves when timer fires → awards XP, skill XP, resources.
4. Client receives socket event `adventure:complete`.

---

### 2. City System

Each player begins with **1 city**. Additional cities can be founded later (post-MVP).

**City properties:**
- Name, coordinates on the world map
- Resources: current amounts + storage cap
- Resource production rates (sum of all building effects)
- Building slots: **20 slots**, any building can go in any slot
- Troop garrison

**Resource tick:**
- Server runs a tick every **60 seconds**.
- Each city's resources increase by `(productionRate / 3600) * 60`.
- Capped at storage maximum.

**Construction flow:**
1. Player selects a slot and a building (or upgrade).
2. Server validates resources & prerequisites.
3. Creates `ConstructionJob` with `endsAt`.
4. On completion: building level incremented, production rates recalculated.
5. Socket event `construction:complete`.

**Only 1 construction job per city at a time** (MVP; can add builder queue later).

---

### 3. Unit System

**Training flow:**
1. Player selects unit type and quantity in barracks/stable/workshop.
2. Cost deducted immediately.
3. `TrainingJob` created: `endsAt = now + (unitTrainingTime * quantity)`.
4. On completion: units added to garrison.
5. Socket event `training:complete`.

**Upkeep:**
- Each unit consumes food per hour.
- Deducted on the resource tick.
- If food goes to 0, units start deserting (post-MVP mechanic; warn player in MVP).

---

### 4. World Map

- Grid: 100×100 tiles.
- Generated once at server startup (seeded random, deterministic).
- Tiles: plains, forest, mountain, lake, ruins, city.
- Cities are placed on plains tiles when founded.
- Ruins tiles spawn adventure encounters.
- Client renders a **viewport** of 20×15 tiles with pan/zoom.

---

### 5. Timer System

All timed actions share a common pattern:

```ts
interface Job {
  id: string;
  type: 'adventure' | 'construction' | 'training';
  playerId: string;
  cityId?: string;
  metadata: Record<string, unknown>;
  startedAt: Date;
  endsAt: Date;
  completed: boolean;
}
```

**Server side:**
- Jobs stored in DB.
- A background runner (`setInterval`, every 5 seconds) queries `jobs WHERE endsAt <= now AND completed = false`.
- Resolves each job, emits socket event to the owning player.

**Client side:**
- Receives job list on login and via socket updates.
- Displays countdown timers computed from `endsAt - Date.now()`.

---

## Database Schema (Prisma — high level)

```
Player         id, email, passwordHash, createdAt
Hero           id, playerId, level, xp, energy, lastEnergyRegen, skills (JSON)
City           id, playerId, name, x, y, resources (JSON), buildings (JSON)
Job            id, type, playerId, cityId, metadata (JSON), startedAt, endsAt, completed
MapTile        x, y, type, cityId (nullable)
```

---

## API Routes (MVP)

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login, receive JWT |
| POST | `/auth/logout` | Invalidate token |

### Hero
| Method | Path | Description |
|--------|------|-------------|
| GET | `/hero` | Get own hero |
| POST | `/hero/adventure` | Start adventure |

### City
| Method | Path | Description |
|--------|------|-------------|
| GET | `/cities` | List own cities |
| GET | `/cities/:id` | City detail (resources, buildings, jobs) |
| POST | `/cities/:id/build` | Start construction |
| POST | `/cities/:id/train` | Start training |

### Map
| Method | Path | Description |
|--------|------|-------------|
| GET | `/map?x=&y=&w=&h=` | Tile viewport |

---

## Socket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `adventure:complete` | server→client | `{ heroUpdate, rewards }` |
| `construction:complete` | server→client | `{ cityId, buildingSlot }` |
| `training:complete` | server→client | `{ cityId, unitId, quantity }` |
| `resource:tick` | server→client | `{ cityId, resources }` |
| `job:update` | server→client | Updated job list |

---

## MVP Scope — What's In / Out

### In Scope (MVP)
- [x] Player account creation + JWT auth
- [x] Hero: level, XP, energy, 5 skills, 3 adventure types
- [x] 1 city per player with 20 building slots
- [x] 5 resources: food, wood, stone, iron, gold
- [x] 10 building types, up to level 5 (expandable to 10)
- [x] 4 unit types
- [x] Timer system for all activities
- [x] 100×100 world map with 6 tile types
- [x] Viewport map rendering in browser
- [x] Socket.io real-time updates
- [x] 1 civilization (default)

### Out of Scope (Post-MVP)
- [ ] Multiple cities per player
- [ ] Multiple civilizations
- [ ] PvP combat / army movement
- [ ] Hero inventory / items
- [ ] Market / trading between players
- [ ] Alliance / clan system
- [ ] Notifications / email
- [ ] Mobile-responsive polish
- [ ] Leaderboards

---

## Implementation Order

1. **Phase 1 — Foundation**
   - Monorepo setup (npm workspaces)
   - `/shared` package with all constants and types
   - Database schema + Prisma setup
   - Auth (register, login, JWT middleware)

2. **Phase 2 — Core Backend**
   - Hero routes + adventure job system
   - City routes + resource tick
   - Building construction jobs
   - Unit training jobs
   - Background job runner + Socket.io emission

3. **Phase 3 — Frontend Shell**
   - Next.js app with auth flow
   - Hero page (energy bar, skill list, start adventure, active job timer)
   - City page (resource bar, building grid, construction queue)
   - Troops panel

4. **Phase 4 — Map**
   - Map generation + storage
   - Map API endpoint
   - Canvas/CSS grid viewport in client

5. **Phase 5 — Polish & Integration**
   - End-to-end timer displays
   - Socket.io client integration
   - Basic error handling and loading states
