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
export interface AttackCompletePayload {
  jobId:          string;
  attackerCityId: string;
  targetCityId:   string;
  attackerWon:    boolean;
  attackerReportId: string;
}

export interface BaseAttackedPayload {
  targetCityId:    string;
  defenceReportId: string;
}

export interface AttackIncomingPayload {
  jobId:            string;
  endsAt:           string;   // ISO — lets the client show a countdown
  attackerUsername: string;
  attackerCityName: string;
  targetCityId:     string;
  targetCityName:   string;
}

export interface AttackCancelledPayload {
  jobId:         string;
  attackerCityId: string;
  targetCityId:   string;
}

export interface HeroRegenPayload {
  heroId: string;
  energy: number;
  health: number;
}

export interface DomainClaimResultPayload {
  success:        boolean;
  reason?:        string;
  attackerCityId: string;
  targetX:        number;
  targetY:        number;
  battle?:        boolean;
  attackerWon?:   boolean;
  report?:        Record<string, unknown>;
  /** Persisted ActivityReport ID for the attacker (only present when a battle was fought). */
  reportId?:      string;
}

export interface DomainContestResultPayload {
  success:        boolean;
  reason?:        string;
  attackerCityId: string;
  targetX:        number;
  targetY:        number;
  /** Whether a battle was fought. */
  battle:         boolean;
  attackerWon?:   boolean;
  /** True when the attacker won and the tile was immediately claimed (adjacent + capacity). */
  tileClaimed?:   boolean;
  report?:        Record<string, unknown>;
  /** Persisted ActivityReport ID for the attacker (only present when a battle was fought). */
  reportId?:      string;
}

export interface DomainLostPayload {
  x:              number;
  y:              number;
  attackerCityId: string;
  /** ActivityReport ID for the losing defender. Present when a battle report was created. */
  reportId?:      string;
}

/** Fired to the domain owner whose garrison *held off* an attack. */
export interface DomainDefendedPayload {
  x:              number;
  y:              number;
  attackerCityId: string;
  /** ActivityReport ID for the defending player. */
  reportId:       string;
}

export interface DomainRecallCompletePayload {
  jobId:   string;
  cityId:  string;
  troops:  Record<string, number>;
}

export interface ServerToClientEvents {
  'adventure:complete':     (payload: AdventureCompletePayload)     => void;
  'construction:complete':  (payload: ConstructionCompletePayload)  => void;
  'training:complete':      (payload: TrainingCompletePayload)      => void;
  'resource:tick':          (payload: ResourceTickPayload)          => void;
  'job:update':             (payload: JobUpdatePayload)             => void;
  'map:tile_update':        (payload: MapTileUpdatePayload)         => void;
  'attack:complete':        (payload: AttackCompletePayload)        => void;
  'base:attacked':          (payload: BaseAttackedPayload)          => void;
  'attack:incoming':        (payload: AttackIncomingPayload)        => void;
  'attack:cancelled':       (payload: AttackCancelledPayload)       => void;
  'hero:regen':             (payload: HeroRegenPayload)             => void;
  'domain:claimResult':     (payload: DomainClaimResultPayload)     => void;
  'domain:contestResult':   (payload: DomainContestResultPayload)   => void;
  'domain:lost':            (payload: DomainLostPayload)            => void;
  'domain:defended':        (payload: DomainDefendedPayload)        => void;
  'domain:recallComplete':  (payload: DomainRecallCompletePayload)  => void;
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
