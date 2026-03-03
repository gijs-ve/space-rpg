import { Hero, Base, Job, MapViewport } from './game';
import { ActivityType } from '../constants/activities';
import { BuildingId } from '../constants/buildings';
import { UnitId } from '../constants/units';
import { ResourceMap } from '../constants/resources';

// ─── Generic wrapper ──────────────────────────────────────────────────────────
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  player: {
    id: string;
    username: string;
    email: string;
  };
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
export type GetHeroResponse = Hero;

/** Shape returned by GET /hero */
export interface HeroResponse {
  hero: Hero;
  activeAdventure: Job | null;
}

export interface StartAdventureRequest {
  activityType: ActivityType;
}

export interface StartAdventureResponse {
  job: Job;
  hero: Hero;
}

// ─── Base (starbase) ─────────────────────────────────────────────────────────────────────
export type GetBasesResponse = Base[];
/** @deprecated Use GetBasesResponse */
export type GetCitiesResponse = GetBasesResponse;

/** Shape returned by GET /bases */
export interface BasesResponse {
  cities: Base[];
}
/** @deprecated Use BasesResponse */
export type CitiesResponse = BasesResponse;

export type GetBaseResponse = Base & { activeJobs: Job[] };
/** @deprecated Use GetBaseResponse */
export type GetCityResponse = GetBaseResponse;

/** Shape returned by GET /bases/:id */
export interface BaseDetailResponse {
  city: Base & { productionRates: ResourceMap };
  activeJobs: Job[];
}
/** @deprecated Use BaseDetailResponse */
export type CityDetailResponse = BaseDetailResponse;

export interface StartConstructionRequest {
  slotIndex: number;
  buildingId: BuildingId;
}

export interface StartConstructionResponse {
  job: Job;
  city: Base;
}

export interface StartTrainingRequest {
  unitId: UnitId;
  quantity: number;
}

export interface StartTrainingResponse {
  job: Job;
  city: Base;
}

// ─── Base founding ──────────────────────────────────────────────────────────────────
export interface FoundBaseRequest {
  /** Display name for the new starbase */
  name: string;
}
/** @deprecated Use FoundBaseRequest */
export type FoundCityRequest = FoundBaseRequest;

export interface FoundBaseResponse {
  city: Base;
  /** Cost that was deducted from the founding base's resource pool */
  costPaid: ResourceMap;
}
/** @deprecated Use FoundBaseResponse */
export type FoundCityResponse = FoundBaseResponse;

// ─── Map ──────────────────────────────────────────────────────────────────────
export interface GetMapQuery {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export type GetMapResponse = MapViewport;

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export type GetJobsResponse = Job[];
