import { ResourceMap } from '../constants/resources';
import { ResourceType } from '../constants/resources';
import { BuildingId } from '../constants/buildings';
import { UnitId } from '../constants/units';
import { SkillId } from '../constants/skills';
import { ActivityType } from '../constants/activities';
import { TileType } from '../constants/map';
import { CivId } from '../constants/civilizations';
import { ItemId, HeroEquipSlot } from '../constants/items';
import { MarketListingType, MarketListingKind, MarketListingStatus } from '../constants/market';

// ─── Items ────────────────────────────────────────────────────────────────────

export type ItemLocation =
  | 'hero_inventory'
  | 'hero_equipped'
  | 'base_armory'
  | 'base_building_equip'
  | 'activity_report'
  /** Item is escrowed on the Black Market; a voucher occupies the original slot. */
  | 'market_listing';

export interface ItemInstance {
  id:                  string;
  itemDefId:           ItemId;
  rotated:             boolean;
  gridX:               number | null;
  gridY:               number | null;
  heroId:              string | null;
  cityId:              string | null;
  location:            ItemLocation;
  equipSlot:           HeroEquipSlot | null;
  buildingSlotIndex:   number | null;
  buildingEquipSlot:   string | null;  // 'slot_a' | 'slot_b'
  reportId:            string | null;
  /** Set on voucher items (market_bond) to reference the listing they back. */
  marketListingId:     string | null;
  createdAt:           string;
}

// ─── Crafting ─────────────────────────────────────────────────────────────────

export interface CraftingSlotState {
  id:                  string;
  cityId:              string;
  buildingSlotIndex:   number;
  recipeId:            string;
  inputQueueCount:     number;
  outputCount:         number;
  processingJobId:     string | null;
  processingEndsAt:    string | null;
}

// ─── Black Market ────────────────────────────────────────────────────────────────────────

export interface MarketListing {
  id:             string;
  type:           MarketListingType;   // 'sell' | 'buy'
  kind:           MarketListingKind;   // 'item' | 'resource'
  cityId:         string;
  /** For item listings: the ItemId being listed or sought */
  itemDefId:      ItemId | null;
  /** For sell-item listings: the specific instance in escrow */
  itemInstanceId: string | null;
  /** For resource listings */
  resourceType:   ResourceType | null;
  resourceAmount: number | null;
  priceGold:   number;
  status:         MarketListingStatus;
  /** Name of the listing owner's base (denormalised for display) */
  cityName?:      string;
  /** Map coordinates of the listing owner's base */
  cityX?:         number;
  cityY?:         number;
  /** Username of the player who owns the listing's base */
  playerUsername?: string;
  createdAt:      string;
  updatedAt:      string;
}

// ─── Vendors ───────────────────────────────────────────────────────────────────────────

export interface VendorStockEntry {
  id:                     string;
  vendorId:               string;
  itemDefId:              ItemId;
  currentStock:           number;
  maxStock:               number;
  sellPrice:              number;
  buyPrice:               number;
  restockIntervalMinutes: number;
  lastRestockedAt:        string;
}

// ─── Activity Reports ─────────────────────────────────────────────────────────

export interface ActivityReport {
  id:               string;
  playerId:         string;
  activityType:     ActivityType;
  xpAwarded:        number;
  skillXpAwarded:   Partial<Record<SkillId, number>>;
  resources:        Partial<ResourceMap>;
  /** HP damage the hero took during this activity (after defence mitigation). */
  damageTaken:      number;
  completedAt:      string;
  dismissed:        boolean;
  viewed:           boolean;
  resourcesClaimed: boolean;
  items:            ItemInstance[];
  /** Hero who performed the activity (set for adventure reports). */
  heroId:           string | null;
  heroName:         string | null;
  /** Base that is relevant to this report (construction, training, crafting, vendor). */
  cityId:           string | null;
  cityName:         string | null;
  /**
   * Free-form metadata.  Used by PvP combat reports to store FullBattleReport.
   * undefined for older / non-combat reports.
   */
  meta?:            Record<string, unknown>;
}

// ─── Player / Auth ────────────────────────────────────────────────────────────
export interface Player {
  id: string;
  username: string;
  email: string;
  createdAt: string; // ISO date string
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
export type SkillLevels = Record<SkillId, number>;
export type SkillXp    = Record<SkillId, number>;

export interface Hero {
  id: string;
  playerId: string;  name: string;  level: number;
  xp: number;
  health: number;
  maxHealth: number;
  lastHealthRegen: string; // ISO date string
  energy: number;
  maxEnergy: number;
  lastEnergyRegen: string; // ISO date string
  skillLevels: SkillLevels;
  skillXp: SkillXp;
  homeCityId: string | null;
}

// ─── Buildings ────────────────────────────────────────────────────────────────
export interface BaseBuilding {
  slotIndex:  number;   // 0–19
  buildingId: BuildingId;
  level:      number;
  /** Optional per-instance state (e.g. selectedResources for storage_expansion) */
  meta?:      Record<string, unknown>;
}
/** @deprecated Use BaseBuilding */
export type CityBuilding = BaseBuilding;

// ─── Troops ───────────────────────────────────────────────────────────────────
export type TroopMap = Partial<Record<UnitId, number>>;

// ─── Base (formerly City) ────────────────────────────────────────────────────
export interface Base {
  id: string;
  playerId: string;
  name: string;
  x: number;
  y: number;
  /** Which world this base resides on (undefined = default starting world) */
  worldId?: string;
  civId: CivId;
  resources: ResourceMap;
  storageCap: ResourceMap;
  buildings: BaseBuilding[];  // up to CITY_BUILDING_SLOTS entries
  troops: TroopMap;
  createdAt: string;
}
/** @deprecated Use Base */
export type City = Base;

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export type JobType = 'adventure' | 'construction' | 'training' | 'attack' | 'claim' | 'recall' | 'reinforce' | 'contest';

export interface AdventureJobMeta {
  activityType: import('../constants/activities').HeroActivityType;
  /** ID of the hero performing the adventure */
  heroId: string;
}

export interface ConstructionJobMeta {
  slotIndex:        number;
  buildingId:       BuildingId;
  targetLevel:      number;
  /** Full list of selected resources for storage_expansion (existing + new) */
  storageResources?: string[];
}

export interface TrainingJobMeta {
  unitId: UnitId;
  /** Always 1 — each job trains exactly one unit in the sequential queue. */
  quantity: number;
  /** Effective training duration in seconds (stored for cancel/reschedule). */
  durationSecs: number;
}

export interface CraftingJobMeta {
  recipeId:          string;
  buildingSlotIndex: number;
}

/**
 * Metadata for a 3-wave player-vs-player attack job.
 * Troops are deducted from the attacker's garrison when the job is created;
 * survivors are returned when the job resolves.
 */
export interface AttackJobMeta {
  attackerCityId: string;
  targetCityId:   string;
  /** Three sequential wave compositions. Each is a TroopMap subset. */
  waves:          TroopMap[];
}

/**
 * Metadata for a troop march to claim a domain tile.
 * All troops (from all waves combined) are sent together; waves[] just preserves
 * the original grouping for potential future battle logic.
 */
export interface ClaimJobMeta {
  /** City sending the troops. */
  attackerCityId: string;
  /** Target tile coordinates. */
  targetX: number;
  targetY: number;
  /**
   * Three attack waves (same structure as city attacks).
   * Wave 0 = 1st Strike, Wave 1 = Defender Counter, Wave 2 = Final Push.
   * All troops across all waves are deducted from the garrison on job creation.
   */
  waves: [TroopMap, TroopMap, TroopMap];
}

/**
 * Metadata for troops marching back from a domain tile to their home city.
 */
export interface RecallJobMeta {
  /** ID of the domain tile being abandoned. */
  domainTileId: string;
  /** City that owns the domain tile (troops will return here). */
  cityId: string;
  /** Troops marching back. */
  troops: TroopMap;
  /** Original tile position (for march-time computation). */
  fromX: number;
  fromY: number;
}

/**
 * Metadata for a reinforcement march to an existing domain tile.
 */
export interface ReinforceJobMeta {
  /** Domain tile being reinforced. */
  domainTileId: string;
  /** City sending the troops (troops deducted on creation, returned to tile on arrival). */
  cityId: string;
  /** Troops being sent. */
  troops: TroopMap;
  /** Target tile coordinates (for march-time computation). */
  targetX: number;
  targetY: number;
}

export interface ContestJobMeta {
  /** City sending the attacking troops. */
  attackerCityId: string;
  /** Target tile coordinates. */
  targetX: number;
  targetY: number;
  /**
   * Three attack waves (same structure as city attacks).
   * Wave 0 = 1st Strike, Wave 1 = Defender Counter, Wave 2 = Final Push.
   * All troops across all waves are deducted from the garrison on job creation.
   */
  waves: [TroopMap, TroopMap, TroopMap];
}

export type JobMeta = AdventureJobMeta | ConstructionJobMeta | TrainingJobMeta | CraftingJobMeta | AttackJobMeta | ClaimJobMeta | RecallJobMeta | ReinforceJobMeta | ContestJobMeta;

/**
 * A single pending (in-flight) attack — returned by GET /attack.
 */
export interface AttackInfo {
  jobId:             string;
  endsAt:            string;
  attackerCityId:    string;
  attackerCityName:  string;
  attackerUsername:  string;
  targetCityId:      string;
  targetCityName:    string;
  targetUsername:    string;
  waves:             TroopMap[];
}

export interface AttackStatusResponse {
  outgoing: AttackInfo[];
  incoming: AttackInfo[];
}

export interface Job {
  id: string;
  type: JobType;
  playerId: string;
  cityId?: string;
  metadata: JobMeta;
  startedAt: string;
  endsAt: string;
  completed: boolean;
}

// ─── Domain ───────────────────────────────────────────────────────────────────

/**
 * A tile that belongs to a base's domain (not the city tile itself).
 * Troops are stationed here; if garrison drops to 0 the tile is lost.
 */
export interface DomainTile {
  id:        string;
  cityId:    string;
  x:         number;
  y:         number;
  troops:    TroopMap;
  createdAt: string;
  updatedAt: string;
}

// ─── Map ──────────────────────────────────────────────────────────────────────
export interface MapTile {
  x: number;
  y: number;
  type: TileType;
  baseId?: string;
  baseName?: string;
  ownerUsername?: string;
  /** Set when this tile is part of a domain (not a city tile itself). */
  domainCityId?: string;
  /** Owner username for the domain controller (for colouring on the map). */
  domainOwnerUsername?: string;
  /** Name of the base that controls this domain tile. */
  domainCityName?: string;
  /** Neutral enemy garrison present on this tile (absent when tile is cleared or has no spawn def). */
  neutralGarrison?: TroopMap;
}

export interface MapViewport {
  x: number;
  y: number;
  width: number;
  height: number;
  tiles: MapTile[];
}
// ─── Garrison marches ─────────────────────────────────────────────────────────

/**
 * A single in-flight garrison movement (claim, reinforce, or recall march).
 * Returned by GET /domain/marches.
 */
export interface GarrisonMarchInfo {
  jobId:     string;
  type:      'claim' | 'reinforce' | 'recall' | 'contest';
  endsAt:    string;
  troops:    TroopMap;
  cityId:    string;
  cityName:  string;
  /** Target tile coordinates — present for claim and reinforce. */
  targetX?: number;
  targetY?: number;
  /** Source tile coordinates — present for recall. */
  fromX?: number;
  fromY?: number;
  /** Whether the player can cancel this march (only claim marches before arrival). */
  canCancel: boolean;
}

export interface GarrisonMarchesResponse {
  /** Claim, contest and reinforce marches heading away from the city. */
  outgoing: GarrisonMarchInfo[];
  /** Recall marches heading back to the city. */
  returning: GarrisonMarchInfo[];
  /** Enemy claim/contest marches heading towards the player's own tiles. */
  incoming: GarrisonMarchInfo[];
}