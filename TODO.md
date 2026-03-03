# RPG City Builder — TODO

## Phase 1: Monorepo Setup
- [x] Root package.json (workspaces)
- [x] shared: resources constants
- [x] shared: buildings constants
- [x] shared: units constants
- [x] shared: skills constants
- [x] shared: activities constants
- [x] shared: map constants
- [x] shared: civilizations constants
- [x] shared: core domain types
- [x] shared: API request/response types
- [x] shared: Socket event types
- [x] shared: hero formulas
- [x] shared: construction formulas
- [x] shared: combat formulas

## Phase 2: Database & Auth
- [x] server: Prisma schema (all models)
- [x] server: DB migrations + seed script
- [x] server: register + login routes
- [x] server: JWT middleware

## Phase 3: Core Backend Services
- [x] server: hero routes (GET /hero)
- [x] server: adventure route + job creation
- [x] server: hero energy regen logic
- [x] server: city routes (GET /cities, GET /cities/:id)
- [x] server: resource tick (60s interval)
- [x] server: construction route + job creation
- [x] server: unit training route + job creation
- [x] server: background job runner (5s poll)
- [x] server: job resolvers (adventure, build, train)
- [x] server: Socket.io setup + auth handshake
- [x] server: emit events on job completion

## Phase 4: Map
- [x] server: seeded map generation (100x100)
- [x] server: map storage in DB (MapTile)
- [x] server: map viewport API (GET /map)

## Phase 5: Next.js Frontend Shell
- [x] client: Next.js + Tailwind setup
- [x] client: auth pages (login, register)
- [x] client: JWT storage + auth context
- [x] client: Socket.io client setup

## Phase 6: Hero UI
- [x] client: hero page (level, XP, energy bar)
- [x] client: skills panel
- [x] client: adventure launcher + active timer
- [x] client: adventure complete notification

## Phase 7: City UI
- [x] client: resource bar component
- [x] client: building grid (20 slots)
- [x] client: build/upgrade modal + timer
- [x] client: troops panel + training queue

## Phase 8: Map UI
- [x] client: 20x15 viewport renderer
- [x] client: pan/zoom controls
- [x] client: tile tooltips (type, city name)

## Phase 9: Polish
- [x] client: countdown timer component (reusable)
- [x] client: socket event handlers (all events)
- [x] client: error + loading states
- [x] server: input validation (zod)
- [x] server: error handling middleware
- [ ] End-to-end smoke test (full flow)
