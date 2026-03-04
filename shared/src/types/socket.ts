import { Hero, City, Job, MapTile } from './game';
import { ResourceMap } from '../constants/resources';
import { UnitId } from '../constants/units';

// ─── Server → Client events ───────────────────────────────────────────────────

export interface AdventureCompletePayload {
  jobId: string;
  hero: Hero;
  rewards: {
    xp: number;
    resources: Partial<ResourceMap>;
    skillXp: Partial<Record<string, number>>;
    /** HP damage the hero took (after defence mitigation). */
    damageTaken: number;
  };
}

export interface ConstructionCompletePayload {
  jobId: string;
  cityId: string;
  city: City;
}

export interface TrainingCompletePayload {
  jobId: string;
  cityId: string;
  unitId: UnitId;
  quantity: number;
  city: City;
}

export interface ResourceTickPayload {
  cityId: string;
  resources: ResourceMap;
}

export interface JobUpdatePayload {
  jobs: Job[];
}

export interface MapTileUpdatePayload {
  tile: MapTile;
}

// ─── Event name map ───────────────────────────────────────────────────────────
export interface ServerToClientEvents {
  'adventure:complete':     (payload: AdventureCompletePayload)     => void;
  'construction:complete':  (payload: ConstructionCompletePayload)  => void;
  'training:complete':      (payload: TrainingCompletePayload)      => void;
  'resource:tick':          (payload: ResourceTickPayload)          => void;
  'job:update':             (payload: JobUpdatePayload)             => void;
  'map:tile_update':        (payload: MapTileUpdatePayload)         => void;
}

// ─── Client → Server events ───────────────────────────────────────────────────
export interface ClientToServerEvents {
  // Currently all game actions go through REST; socket is server→client only.
  // Kept here for future use (e.g., chat, real-time moves).
  'ping': () => void;
}

// ─── Socket auth ──────────────────────────────────────────────────────────────
export interface SocketAuth {
  token: string;
}
