import { ResourceMap } from '../constants/resources';
import { BuildingId } from '../constants/buildings';
import { UnitId } from '../constants/units';
import { SkillId } from '../constants/skills';
import { ActivityType } from '../constants/activities';
import { TileType } from '../constants/map';
import { CivId } from '../constants/civilizations';
import { ItemId, HeroEquipSlot } from '../constants/items';

// ─── Items ────────────────────────────────────────────────────────────────────

export type ItemLocation =
  | 'hero_inventory'
  | 'hero_equipped'
  | 'base_armory'
  | 'base_building_equip'
  | 'activity_report';

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
  createdAt:           string;
}

// ─── Activity Reports ─────────────────────────────────────────────────────────

export interface ActivityReport {
  id:               string;
  playerId:         string;
  activityType:     ActivityType;
  xpAwarded:        number;
  skillXpAwarded:   Partial<Record<SkillId, number>>;
  resources:        Partial<ResourceMap>;
  completedAt:      string;
  dismissed:        boolean;
  viewed:           boolean;
  resourcesClaimed: boolean;
  items:            ItemInstance[];
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
  playerId: string;
  level: number;
  xp: number;
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
export type JobType = 'adventure' | 'construction' | 'training';

export interface AdventureJobMeta {
  activityType: ActivityType;
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
  quantity: number;
}

export type JobMeta = AdventureJobMeta | ConstructionJobMeta | TrainingJobMeta;

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

// ─── Map ──────────────────────────────────────────────────────────────────────
export interface MapTile {
  x: number;
  y: number;
  type: TileType;
  baseId?: string;
  baseName?: string;
  ownerUsername?: string;
}

export interface MapViewport {
  x: number;
  y: number;
  width: number;
  height: number;
  tiles: MapTile[];
}
