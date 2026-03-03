import { Hero, City, Job, MapViewport } from './game';
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

// ─── City ─────────────────────────────────────────────────────────────────────
export type GetCitiesResponse = City[];

/** Shape returned by GET /cities */
export interface CitiesResponse {
  cities: City[];
}

export type GetCityResponse = City & { activeJobs: Job[] };

/** Shape returned by GET /cities/:id */
export interface CityDetailResponse {
  city: City & { productionRates: ResourceMap };
  activeJobs: Job[];
}

export interface StartConstructionRequest {
  slotIndex: number;
  buildingId: BuildingId;
}

export interface StartConstructionResponse {
  job: Job;
  city: City;
}

export interface StartTrainingRequest {
  unitId: UnitId;
  quantity: number;
}

export interface StartTrainingResponse {
  job: Job;
  city: City;
}

// ─── City founding ────────────────────────────────────────────────────────────
export interface FoundCityRequest {
  /** Display name for the new city */
  name: string;
}

export interface FoundCityResponse {
  city: City;
  /** Cost that was deducted from the founding city's resource pool */
  costPaid: ResourceMap;
}

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
