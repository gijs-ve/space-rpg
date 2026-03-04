import { prisma } from '../db/client';
import {
  ITEMS,
  ItemId,
  BUILDINGS,
  HeroEquipSlot,
  HERO_INVENTORY_COLS,
  HERO_INVENTORY_ROWS,
} from '@rpg/shared';
import { ItemLocation } from '@prisma/client';

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

export async function getArmoryGridSize(
  cityId: string,
): Promise<{ cols: number; rows: number }> {
  const city = await prisma.city.findUnique({
    where: { id: cityId },
    select: { buildings: true },
  });
  if (!city) return { cols: 0, rows: 0 };

  const buildings = city.buildings as unknown as Array<{
    buildingId: string;
    level: number;
  }>;
  const armory = buildings.find((b) => b.buildingId === 'armory');
  if (!armory) return { cols: 0, rows: 0 };

  const levelDef = BUILDINGS.armory.levels[armory.level - 1];
  return {
    cols: levelDef?.effect.armoryGridCols ?? 6,
    rows: levelDef?.effect.armoryGridRows ?? 6,
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

/** Move an item to hero inventory or base armory */
export async function moveItemToInventory(
  itemId: string,
  playerId: string,
  targetLocation: 'hero_inventory' | 'base_armory',
  gridX: number,
  gridY: number,
  rotated: boolean,
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
    const size = await getArmoryGridSize(cityId);
    if (size.cols === 0) {
      throw Object.assign(new Error('Build an Armory first'), { status: 400 });
    }
    gridCols = size.cols;
    gridRows = size.rows;
    targetCityId = cityId;
  }

  const existing = await prisma.itemInstance.findMany({
    where:
      targetLocation === 'hero_inventory'
        ? { heroId: targetHeroId, location: ItemLocation.hero_inventory }
        : { cityId: targetCityId, location: ItemLocation.base_armory },
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
      buildingSlotIndex: null,
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
    const size = await getArmoryGridSize(item.cityId);
    gridCols = size.cols;
    gridRows = size.rows;
  }

  const existing = await prisma.itemInstance.findMany({
    where:
      item.location === ItemLocation.hero_inventory
        ? { heroId: item.heroId!, location: ItemLocation.hero_inventory }
        : { cityId: item.cityId!, location: ItemLocation.base_armory },
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

/** Unequip a hero item back to inventory at a specific grid position */
export async function unequipItem(
  itemId: string,
  playerId: string,
  gridX: number,
  gridY: number,
) {
  const { item, heroId } = await getItemOwned(itemId, playerId);
  if (item.location !== ItemLocation.hero_equipped) {
    throw Object.assign(new Error('Item is not equipped'), { status: 400 });
  }

  const inventoryItems = await prisma.itemInstance.findMany({
    where: { heroId, location: ItemLocation.hero_inventory },
  });

  const check = checkPlacement(HERO_INVENTORY_COLS, HERO_INVENTORY_ROWS, inventoryItems, {
    id: itemId,
    itemDefId: item.itemDefId,
    gridX,
    gridY,
    rotated: item.rotated,
  });
  if (!check.valid) {
    throw Object.assign(new Error(check.reason ?? 'Invalid placement'), {
      status: 400,
    });
  }

  return prisma.itemInstance.update({
    where: { id: itemId },
    data: {
      location: ItemLocation.hero_inventory,
      gridX,
      gridY,
      equipSlot: null,
    },
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

  const armoryGridSize = city ? await getArmoryGridSize(city.id) : { cols: 0, rows: 0 };

  return { heroItems, baseItems, armoryGridSize };
}
