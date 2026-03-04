import { prisma } from '../db/client';
import {
  ITEMS,
  ItemId,
  BUILDINGS,
  HeroEquipSlot,
  HERO_INVENTORY_COLS,
  HERO_INVENTORY_ROWS,
  sumHeroItemBonuses,
  computeMaxEnergy,
  computeMaxHealth,
} from '@rpg/shared';
import type { SkillLevels } from '@rpg/shared';
import { ItemLocation, Prisma } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type SlimItem = {
  id: string;
  itemDefId: string;
  gridX: number | null;
  gridY: number | null;
  rotated: boolean;
};

// ─── Dimension helper ─────────────────────────────────────────────────────────

function dims(itemDefId: string, rotated: boolean): { w: number; h: number } {
  const def = ITEMS[itemDefId as ItemId];
  if (!def) return { w: 1, h: 1 };
  return rotated && def.rotatable
    ? { w: def.height, h: def.width }
    : { w: def.width, h: def.height };
}

// ─── Grid placement check ─────────────────────────────────────────────────────

export function checkPlacement(
  gridCols: number,
  gridRows: number,
  existingItems: SlimItem[],
  newItem: { id?: string; itemDefId: string; gridX: number; gridY: number; rotated: boolean },
): { valid: boolean; reason?: string } {
  const { w, h } = dims(newItem.itemDefId, newItem.rotated);

  if (
    newItem.gridX < 0 ||
    newItem.gridY < 0 ||
    newItem.gridX + w > gridCols ||
    newItem.gridY + h > gridRows
  ) {
    return { valid: false, reason: 'Out of grid bounds' };
  }

  for (const ex of existingItems) {
    if (ex.gridX === null || ex.gridY === null) continue;
    if (newItem.id && ex.id === newItem.id) continue; // skip self when moving

    const { w: ew, h: eh } = dims(ex.itemDefId, ex.rotated);
    const ax = newItem.gridX, ay = newItem.gridY;
    const bx = ex.gridX,     by = ex.gridY;

    if (!(ax + w <= bx || bx + ew <= ax || ay + h <= by || by + eh <= ay)) {
      return { valid: false, reason: 'Space occupied' };
    }
  }
  return { valid: true };
}

// ─── Armory grid size ─────────────────────────────────────────────────────────

/** Returns one entry per armory building in build order (0-based armoryIndex). */
export async function getArmoryGridSizes(
  cityId: string,
): Promise<{ armoryIndex: number; cols: number; rows: number }[]> {
  const city = await prisma.city.findUnique({
    where: { id: cityId },
    select: { buildings: true },
  });
  if (!city) return [];

  const buildings = city.buildings as unknown as Array<{
    buildingId: string;
    level: number;
  }>;

  const result: { armoryIndex: number; cols: number; rows: number }[] = [];
  let armoryIndex = 0;
  for (const b of buildings) {
    if (b.buildingId === 'armory') {
      const levelDef = BUILDINGS.armory.levels[b.level - 1];
      result.push({
        armoryIndex,
        cols: levelDef?.effect.armoryGridCols ?? 6,
        rows: levelDef?.effect.armoryGridRows ?? 6,
      });
      armoryIndex++;
    }
  }
  return result;
}

/** Convenience overload — returns the grid of one specific armory (0 = first). */
export async function getArmoryGridSize(
  cityId: string,
  armoryIndex = 0,
): Promise<{ cols: number; rows: number }> {
  const sizes = await getArmoryGridSizes(cityId);
  return sizes[armoryIndex] ?? { cols: 0, rows: 0 };
}

/**
 * Prisma where-clause that selects base_armory items belonging to `armoryIndex`.
 * Items with buildingSlotIndex = null are treated as armory 0 (migration safety).
 */
function armoryWhere(cityId: string, armoryIndex: number): Prisma.ItemInstanceWhereInput {
  if (armoryIndex === 0) {
    return {
      cityId,
      location: ItemLocation.base_armory,
      OR: [{ buildingSlotIndex: 0 }, { buildingSlotIndex: null }],
    };
  }
  return {
    cityId,
    location: ItemLocation.base_armory,
    buildingSlotIndex: armoryIndex,
  };
}

// ─── Ownership check ──────────────────────────────────────────────────────────

async function getItemOwned(itemId: string, playerId: string) {
  const hero = await prisma.hero.findUnique({
    where: { playerId },
    select: { id: true },
  });
  if (!hero) throw Object.assign(new Error('Hero not found'), { status: 404 });

  const item = await prisma.itemInstance.findUnique({ where: { id: itemId } });
  if (!item) throw Object.assign(new Error('Item not found'), { status: 404 });

  const city = await prisma.city.findFirst({
    where: { playerId },
    select: { id: true },
  });

  // Verify ownership
  if (item.heroId !== hero.id && item.cityId !== city?.id) {
    // Activity-report items: report must belong to player
    if (item.location === 'activity_report' && item.reportId) {
      const report = await prisma.activityReport.findUnique({
        where: { id: item.reportId },
      });
      if (report?.playerId !== playerId) {
        throw Object.assign(new Error('Unauthorized'), { status: 403 });
      }
    } else {
      throw Object.assign(new Error('Unauthorized'), { status: 403 });
    }
  }

  return { item, heroId: hero.id, cityId: city?.id ?? null };
}

// ─── Operations ───────────────────────────────────────────────────────────────

/** Move an item to hero inventory or base armory.
 *  `armoryIndex` (0-based among armory buildings) is only used for base_armory. */
export async function moveItemToInventory(
  itemId: string,
  playerId: string,
  targetLocation: 'hero_inventory' | 'base_armory',
  gridX: number,
  gridY: number,
  rotated: boolean,
  armoryIndex = 0,
) {
  const { item, heroId, cityId } = await getItemOwned(itemId, playerId);

  let gridCols: number;
  let gridRows: number;
  let targetHeroId: string | null = null;
  let targetCityId: string | null = null;

  if (targetLocation === 'hero_inventory') {
    gridCols = HERO_INVENTORY_COLS;
    gridRows = HERO_INVENTORY_ROWS;
    targetHeroId = heroId;
  } else {
    if (!cityId) throw Object.assign(new Error('No base found'), { status: 400 });
    const sizes = await getArmoryGridSizes(cityId);
    const armoryGrid = sizes[armoryIndex];
    if (!armoryGrid) {
      throw Object.assign(new Error('Armory not found'), { status: 400 });
    }
    gridCols = armoryGrid.cols;
    gridRows = armoryGrid.rows;
    targetCityId = cityId;
  }

  const existing = await prisma.itemInstance.findMany({
    where:
      targetLocation === 'hero_inventory'
        ? { heroId: targetHeroId, location: ItemLocation.hero_inventory }
        : armoryWhere(targetCityId!, armoryIndex),
  });

  const check = checkPlacement(gridCols, gridRows, existing, {
    id: itemId,
    itemDefId: item.itemDefId,
    gridX,
    gridY,
    rotated,
  });
  if (!check.valid) {
    throw Object.assign(new Error(check.reason ?? 'Invalid placement'), {
      status: 400,
    });
  }

  return prisma.itemInstance.update({
    where: { id: itemId },
    data: {
      location: targetLocation as ItemLocation,
      gridX,
      gridY,
      rotated,
      heroId: targetHeroId ?? (targetLocation === 'hero_inventory' ? heroId : null),
      cityId: targetCityId ?? (targetLocation === 'base_armory' ? cityId : null),
      equipSlot: null,
      buildingSlotIndex: targetLocation === 'base_armory' ? armoryIndex : null,
      buildingEquipSlot: null,
      reportId: null,
    },
  });
}

/** Rotate an item in place */
export async function rotateItem(itemId: string, playerId: string) {
  const { item, heroId, cityId } = await getItemOwned(itemId, playerId);

  const def = ITEMS[item.itemDefId as ItemId];
  if (!def?.rotatable) {
    throw Object.assign(new Error('Item cannot be rotated'), { status: 400 });
  }
  if (item.gridX === null || item.gridY === null) {
    throw Object.assign(new Error('Item has no grid position'), { status: 400 });
  }

  const newRotated = !item.rotated;

  let gridCols = HERO_INVENTORY_COLS;
  let gridRows = HERO_INVENTORY_ROWS;

  if (item.location === ItemLocation.base_armory && item.cityId) {
    const armIdx = item.buildingSlotIndex ?? 0;
    const sizes = await getArmoryGridSizes(item.cityId);
    const size = sizes[armIdx] ?? { cols: 0, rows: 0 };
    gridCols = size.cols;
    gridRows = size.rows;
  }

  const existing = await prisma.itemInstance.findMany({
    where:
      item.location === ItemLocation.hero_inventory
        ? { heroId: item.heroId!, location: ItemLocation.hero_inventory }
        : armoryWhere(item.cityId!, item.buildingSlotIndex ?? 0),
  });

  const check = checkPlacement(gridCols, gridRows, existing, {
    id: itemId,
    itemDefId: item.itemDefId,
    gridX: item.gridX,
    gridY: item.gridY,
    rotated: newRotated,
  });
  if (!check.valid) {
    throw Object.assign(new Error('Cannot rotate here: ' + check.reason), {
      status: 400,
    });
  }

  return prisma.itemInstance.update({
    where: { id: itemId },
    data: { rotated: newRotated },
  });
}

/** Equip an item to a hero equip slot (swaps displaced item to inventory) */
export async function equipItemToHero(
  itemId: string,
  playerId: string,
  equipSlot: string,
) {
  const { item, heroId } = await getItemOwned(itemId, playerId);
  const def = ITEMS[item.itemDefId as ItemId];

  if (!def) throw Object.assign(new Error('Unknown item'), { status: 400 });
  if (!def.heroEquipSlots.includes(equipSlot as HeroEquipSlot)) {
    throw Object.assign(
      new Error(`Item cannot be equipped in ${equipSlot} slot`),
      { status: 400 },
    );
  }

  // Displace any existing item in that slot to inventory
  const displaced = await prisma.itemInstance.findFirst({
    where: { heroId, location: ItemLocation.hero_equipped, equipSlot },
  });

  if (displaced && displaced.id !== itemId) {
    const inventoryItems = await prisma.itemInstance.findMany({
      where: { heroId, location: ItemLocation.hero_inventory },
    });

    let placed = false;
    outer: for (let gy = 0; gy < HERO_INVENTORY_ROWS; gy++) {
      for (let gx = 0; gx < HERO_INVENTORY_COLS; gx++) {
        const check = checkPlacement(
          HERO_INVENTORY_COLS,
          HERO_INVENTORY_ROWS,
          inventoryItems,
          { id: displaced.id, itemDefId: displaced.itemDefId, gridX: gx, gridY: gy, rotated: false },
        );
        if (check.valid) {
          await prisma.itemInstance.update({
            where: { id: displaced.id },
            data: {
              location: ItemLocation.hero_inventory,
              gridX: gx,
              gridY: gy,
              equipSlot: null,
            },
          });
          placed = true;
          break outer;
        }
      }
    }
    if (!placed) {
      throw Object.assign(new Error('No inventory space to displace equipped item'), {
        status: 400,
      });
    }
  }

  return prisma.itemInstance.update({
    where: { id: itemId },
    data: {
      location: ItemLocation.hero_equipped,
      heroId,
      gridX: null,
      gridY: null,
      equipSlot,
      buildingSlotIndex: null,
      buildingEquipSlot: null,
      reportId: null,
    },
  });
}

/** Unequip a hero item back to inventory. gridX/gridY are optional — if omitted the first free slot is used. */
export async function unequipItem(
  itemId: string,
  playerId: string,
  gridX?: number,
  gridY?: number,
) {
  const { item, heroId } = await getItemOwned(itemId, playerId);
  if (item.location !== ItemLocation.hero_equipped) {
    throw Object.assign(new Error('Item is not equipped'), { status: 400 });
  }

  const inventoryItems = await prisma.itemInstance.findMany({
    where: { heroId, location: ItemLocation.hero_inventory },
  });

  let tx = gridX;
  let ty = gridY;
  if (tx === undefined || ty === undefined) {
    const auto = findFirstFreeSlot(
      HERO_INVENTORY_COLS, HERO_INVENTORY_ROWS, inventoryItems, item.itemDefId, item.rotated ?? false,
    );
    if (!auto) throw Object.assign(new Error('No inventory space available'), { status: 400 });
    tx = auto.gridX;
    ty = auto.gridY;
  }

  const check = checkPlacement(HERO_INVENTORY_COLS, HERO_INVENTORY_ROWS, inventoryItems, {
    id: itemId,
    itemDefId: item.itemDefId,
    gridX: tx,
    gridY: ty,
    rotated: item.rotated,
  });
  if (!check.valid) {
    throw Object.assign(new Error(check.reason ?? 'Invalid placement'), {
      status: 400,
    });
  }

  return prisma.$transaction(async (trx) => {
    // 1. Move the item back to inventory
    const updatedItem = await trx.itemInstance.update({
      where: { id: itemId },
      data: {
        location: ItemLocation.hero_inventory,
        gridX: tx,
        gridY: ty,
        equipSlot: null,
      },
    });

    // 2. After the move, re-derive the hero's max energy/health without this item's bonus.
    //    Equippable items only apply when in hero_equipped, so moving it to hero_inventory
    //    removes its bonus — which may drop the cap below the hero's current value.
    const hero = await trx.hero.findUniqueOrThrow({
      where: { id: heroId },
      select: { energy: true, health: true, skillLevels: true },
    });

    const remainingItems = await trx.itemInstance.findMany({
      where: {
        heroId,
        location: { in: [ItemLocation.hero_equipped, ItemLocation.hero_inventory] },
      },
      select: { itemDefId: true, location: true },
    });

    const bonuses      = sumHeroItemBonuses(remainingItems);
    const skillLevels  = hero.skillLevels as unknown as SkillLevels;
    const newMaxEnergy = computeMaxEnergy(skillLevels, bonuses);
    const newMaxHealth = computeMaxHealth(skillLevels, bonuses);

    const clampedEnergy = Math.min(hero.energy, newMaxEnergy);
    const clampedHealth = Math.min(hero.health, newMaxHealth);

    if (clampedEnergy !== hero.energy || clampedHealth !== hero.health) {
      await trx.hero.update({
        where: { id: heroId },
        data: {
          ...(clampedEnergy !== hero.energy ? { energy: clampedEnergy } : {}),
          ...(clampedHealth !== hero.health ? { health: clampedHealth } : {}),
        },
      });
    }

    return updatedItem;
  });
}

/** Equip an item to a building's generic slot */
export async function equipItemToBuilding(
  itemId: string,
  playerId: string,
  buildingSlotIndex: number,
  buildingEquipSlot: string,
) {
  const { item, cityId } = await getItemOwned(itemId, playerId);
  if (!cityId) throw Object.assign(new Error('No base found'), { status: 400 });

  const existing = await prisma.itemInstance.findFirst({
    where: {
      cityId,
      location: ItemLocation.base_building_equip,
      buildingSlotIndex,
      buildingEquipSlot,
    },
  });
  if (existing && existing.id !== itemId) {
    throw Object.assign(new Error('Building slot already occupied'), { status: 400 });
  }

  return prisma.itemInstance.update({
    where: { id: itemId },
    data: {
      location: ItemLocation.base_building_equip,
      cityId,
      heroId: null,
      gridX: null,
      gridY: null,
      equipSlot: null,
      buildingSlotIndex,
      buildingEquipSlot,
      reportId: null,
    },
  });
}

/** Claim an item from an activity report into hero inventory */
export async function claimItemFromReport(
  itemId: string,
  reportId: string,
  playerId: string,
  gridX: number,
  gridY: number,
  rotated: boolean,
) {
  const hero = await prisma.hero.findUnique({
    where: { playerId },
    select: { id: true },
  });
  if (!hero) throw Object.assign(new Error('Hero not found'), { status: 404 });

  const report = await prisma.activityReport.findUnique({ where: { id: reportId } });
  if (!report || report.playerId !== playerId) {
    throw Object.assign(new Error('Report not found'), { status: 404 });
  }

  const item = await prisma.itemInstance.findUnique({ where: { id: itemId } });
  if (!item || item.reportId !== reportId || item.location !== ItemLocation.activity_report) {
    throw Object.assign(new Error('Item not found in this report'), { status: 400 });
  }

  const inventoryItems = await prisma.itemInstance.findMany({
    where: { heroId: hero.id, location: ItemLocation.hero_inventory },
  });

  const check = checkPlacement(HERO_INVENTORY_COLS, HERO_INVENTORY_ROWS, inventoryItems, {
    itemDefId: item.itemDefId,
    gridX,
    gridY,
    rotated,
  });
  if (!check.valid) {
    throw Object.assign(
      new Error(check.reason ?? 'Not enough space in hero inventory'),
      { status: 400 },
    );
  }

  return prisma.itemInstance.update({
    where: { id: itemId },
    data: {
      location: ItemLocation.hero_inventory,
      heroId: hero.id,
      gridX,
      gridY,
      rotated,
      reportId: null,
    },
  });
}

// ─── Auto-claim ───────────────────────────────────────────────────────────────

/** Scan the hero inventory grid for the first (x,y) that fits the given item. */
function findFirstFreeSlot(
  cols: number,
  rows: number,
  existingItems: SlimItem[],
  itemDefId: string,
  rotated: boolean,
): { gridX: number; gridY: number } | null {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const { valid } = checkPlacement(cols, rows, existingItems, {
        itemDefId,
        gridX: x,
        gridY: y,
        rotated,
      });
      if (valid) return { gridX: x, gridY: y };
    }
  }
  return null;
}

/**
 * Claim all unclaimed items in a report into the hero inventory.
 * Items that don't fit are left in the report (not an error).
 * Returns list of claimed item ids.
 */
export async function autoClaimReport(reportId: string, playerId: string) {
  const hero = await prisma.hero.findUnique({
    where: { playerId },
    select: { id: true },
  });
  if (!hero) throw Object.assign(new Error('Hero not found'), { status: 404 });

  const report = await prisma.activityReport.findUnique({ where: { id: reportId } });
  if (!report || report.playerId !== playerId) {
    throw Object.assign(new Error('Report not found'), { status: 404 });
  }

  const unclaimed = await prisma.itemInstance.findMany({
    where: { reportId, location: ItemLocation.activity_report },
  });

  const claimed: string[] = [];

  for (const item of unclaimed) {
    // Re-fetch current inventory (grows as we claim items)
    const inventoryItems = await prisma.itemInstance.findMany({
      where: { heroId: hero.id, location: ItemLocation.hero_inventory },
    });

    const slot = findFirstFreeSlot(
      HERO_INVENTORY_COLS,
      HERO_INVENTORY_ROWS,
      inventoryItems,
      item.itemDefId,
      false, // place unrotated first
    );
    if (!slot) continue; // no space — skip

    await prisma.itemInstance.update({
      where: { id: item.id },
      data: {
        location: ItemLocation.hero_inventory,
        heroId:   hero.id,
        gridX:    slot.gridX,
        gridY:    slot.gridY,
        rotated:  false,
        reportId: null,
      },
    });
    claimed.push(item.id);
  }

  return { claimed, skipped: unclaimed.length - claimed.length };
}

/** Delete an item permanently */
export async function discardItem(itemId: string, playerId: string) {
  // Ownership validation
  await getItemOwned(itemId, playerId);
  await prisma.itemInstance.delete({ where: { id: itemId } });
  return { success: true };
}

/** Move an item to the player's hero inventory, auto-finding the first free slot.
 *  Tries unrotated placement first, then rotated. */
export async function moveItemToHeroAuto(itemId: string, playerId: string) {
  const { item, heroId } = await getItemOwned(itemId, playerId);

  const existing = await prisma.itemInstance.findMany({
    where: { heroId, location: ItemLocation.hero_inventory },
  });

  let slot = findFirstFreeSlot(HERO_INVENTORY_COLS, HERO_INVENTORY_ROWS, existing, item.itemDefId, false);
  let rotated = false;
  if (!slot) {
    slot = findFirstFreeSlot(HERO_INVENTORY_COLS, HERO_INVENTORY_ROWS, existing, item.itemDefId, true);
    rotated = true;
  }
  if (!slot) {
    throw Object.assign(new Error('No space in hero inventory'), { status: 400 });
  }

  return moveItemToInventory(itemId, playerId, 'hero_inventory', slot.gridX, slot.gridY, rotated);
}

/** Move an item to the player's base armory, auto-finding the first free slot.
 *  If `targetArmoryIndex` is specified, only that armory is tried.
 *  Otherwise iterates all armories in order. */
export async function moveItemToBaseAuto(
  itemId: string,
  playerId: string,
  targetArmoryIndex?: number,
) {
  const { item, cityId } = await getItemOwned(itemId, playerId);
  if (!cityId) throw Object.assign(new Error('No base found'), { status: 400 });

  const allSizes = await getArmoryGridSizes(cityId);
  if (allSizes.length === 0) {
    throw Object.assign(new Error('Build an Armory first to store items'), { status: 400 });
  }

  const armorySizes = targetArmoryIndex !== undefined
    ? allSizes.filter((a) => a.armoryIndex === targetArmoryIndex)
    : allSizes;

  if (armorySizes.length === 0) {
    throw Object.assign(new Error('Armory not found'), { status: 400 });
  }

  for (const { armoryIndex, cols, rows } of armorySizes) {
    const existing = await prisma.itemInstance.findMany({
      where: armoryWhere(cityId, armoryIndex),
    });

    let slot = findFirstFreeSlot(cols, rows, existing, item.itemDefId, false);
    let rotated = false;
    if (!slot) {
      slot = findFirstFreeSlot(cols, rows, existing, item.itemDefId, true);
      rotated = true;
    }
    if (slot) {
      return moveItemToInventory(
        itemId, playerId, 'base_armory', slot.gridX, slot.gridY, rotated, armoryIndex,
      );
    }
  }

  throw Object.assign(new Error('No space in base armory'), { status: 400 });
}

/** Fetch all items belonging to a player (hero + base) */
export async function getPlayerItems(playerId: string) {
  const hero = await prisma.hero.findUnique({
    where: { playerId },
    select: { id: true },
  });
  const city = await prisma.city.findFirst({
    where: { playerId },
    select: { id: true },
  });

  const heroItems = hero
    ? await prisma.itemInstance.findMany({
        where: { heroId: hero.id },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  const baseItems = city
    ? await prisma.itemInstance.findMany({
        where: { cityId: city.id },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  const armoryGridSizes = city ? await getArmoryGridSizes(city.id) : [];

  return { heroItems, baseItems, armoryGridSizes };
}
