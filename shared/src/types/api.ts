import { Hero, Base, Job, MapViewport, MarketListing, VendorStockEntry } from './game';
import { ActivityType } from '../constants/activities';
import { BuildingId } from '../constants/buildings';
import { UnitId } from '../constants/units';
import { ResourceMap, ResourceType } from '../constants/resources';
import { ItemId } from '../constants/items';

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
/** Single hero entry within HeroResponse */
export interface HeroEntry {
  hero:             Hero;
  activeAdventure:  Job | null;
  homeCityName:     string | null;
}

/** Shape returned by GET /hero */
export interface HeroResponse {
  heroes:               HeroEntry[];
  /** Sum of all hero levels */
  totalLevel:           number;
  /** Total level required before the player may recruit the next hero */
  nextHeroUnlockLevel:  number;
}

export interface CreateHeroRequest {
  name: string;
}

export interface CreateHeroResponse {
  hero: Hero;
}

export interface StartAdventureRequest {
  activityType: ActivityType;
}

export interface StartAdventureResponse {
  job: Job;
  hero: Hero;
}

// ─── Base (castle) ─────────────────────────────────────────────────────────────────────
export type GetBasesResponse = Base[];
/** @deprecated Use GetBasesResponse */
export type GetCitiesResponse = GetBasesResponse;

/** Shape returned by GET /bases */
export interface BasesResponse {
  cities: Base[];
}
/** @deprecated Use BasesResponse */

/** Per-resource breakdown of what contributes to the production rate. */
export interface ResourceProductionBreakdown {
  /** Raw building output (units/hr). */
  buildings:      number;
  /** Additive % boost from armory items (e.g. 20 = +20%). */
  itemBonusPct:   number;
  /** Additive % boost from owned domain tiles (e.g. 15 = +15%). */
  domainBonusPct: number;
  /** Final rate after all bonuses (units/hr). */
  total:          number;
}

export type ProductionBreakdown = Partial<Record<import('../constants/resources').ResourceType, ResourceProductionBreakdown>>;
export type CitiesResponse = BasesResponse;

export type GetBaseResponse = Base & { activeJobs: Job[] };
/** @deprecated Use GetBaseResponse */
export type GetCityResponse = GetBaseResponse;

/** Shape returned by GET /bases/:id */
export interface BaseDetailResponse {
  city: Base & { productionRates: ResourceMap; productionBreakdown: ProductionBreakdown };
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
  /** Display name for the new castle */
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
// ─── Black Market ─────────────────────────────────────────────────────────────────────

export type GetMarketListingsResponse = MarketListing[];

/** Place a sell offer for an item by instanceId */
export interface PlaceSellItemRequest {
  itemInstanceId: string;
  priceGold:   number;
}

/** Place a sell offer for an amount of a resource type */
export interface PlaceSellResourceRequest {
  resourceType:   ResourceType;
  resourceAmount: number;
  priceGold:   number;
}

/** Place a buy offer — gold is escrowed from the city */
export interface PlaceBuyItemRequest {
  itemDefId:    ItemId;
  priceGold: number;
}

export interface PlaceBuyResourceRequest {
  resourceType:   ResourceType;
  resourceAmount: number;
  priceGold:   number;
}

export interface PlaceListingResponse {
  listing:   MarketListing;
  /** Present when the order matched immediately (sell at buy price or vice versa) */
  matched?:  boolean;
}

// ─── Vendors ───────────────────────────────────────────────────────────────────────────

export interface VendorWithStock {
  id:          string;
  name:        string;
  description: string;
  stock:       VendorStockEntry[];
}

export type GetVendorsResponse = VendorWithStock[];

export interface BuyFromVendorRequest {
  vendorId:  string;
  itemDefId: ItemId;
  quantity:  number;
}

export interface BuyFromVendorResponse {
  /** Items added to the activity report */
  reportId: string;
  spent:    number;
}

export interface SellToVendorRequest {
  vendorId:      string;
  itemInstanceId: string;
}

export interface SellToVendorResponse {
  earned: number;
}