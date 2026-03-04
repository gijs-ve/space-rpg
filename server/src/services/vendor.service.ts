import { prisma } from '../db/client';
import { ItemLocation } from '@prisma/client';
import { VENDORS, ITEMS, ItemId } from '@rpg/shared';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function assertCityOwner(playerId: string, cityId: string) {
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) throw Object.assign(new Error('Base not found'), { status: 404 });
  if (city.playerId !== playerId)
    throw Object.assign(new Error('Unauthorized'), { status: 403 });
  return city;
}

// ─── Restock ticker ───────────────────────────────────────────────────────────

/**
 * Apply restock to a single VendorStock row if the interval has elapsed.
 * Mutates the DB row and returns the updated record.
 */
async function applyRestock(stockId: string) {
  const row = await prisma.vendorStock.findUnique({ where: { id: stockId } });
  if (!row) return null;

  const now = new Date();
  const elapsed = (now.getTime() - row.lastRestockedAt.getTime()) / 60_000; // minutes
  const periods = Math.floor(elapsed / row.restockIntervalMinutes);
  if (periods <= 0) return row;

  const newStock = Math.min(row.maxStock, row.currentStock + periods * row.maxStock);
  const newLastRestockedAt = new Date(
    row.lastRestockedAt.getTime() + periods * row.restockIntervalMinutes * 60_000,
  );

  return prisma.vendorStock.update({
    where: { id: stockId },
    data: { currentStock: newStock, lastRestockedAt: newLastRestockedAt },
  });
}

// ─── Seed / upsert vendors ────────────────────────────────────────────────────

/**
 * Sync the VENDORS constant into the DB (create-or-update).
 * Called once from seed.ts and also safe to call at server start.
 */
export async function syncVendors() {
  for (const vendorDef of Object.values(VENDORS)) {
    await prisma.vendor.upsert({
      where: { id: vendorDef.id },
      create: { id: vendorDef.id, name: vendorDef.name, description: vendorDef.description },
      update: { name: vendorDef.name, description: vendorDef.description },
    });

    for (const stockDef of vendorDef.stock) {
      const existing = await prisma.vendorStock.findFirst({
        where: { vendorId: vendorDef.id, itemDefId: stockDef.itemDefId },
      });

      if (existing) {
        await prisma.vendorStock.update({
          where: { id: existing.id },
          data: {
            maxStock: stockDef.maxStock,
            sellPrice: stockDef.sellPrice,
            buyPrice: stockDef.buyPrice,
            restockIntervalMinutes: stockDef.restockIntervalMinutes,
            // Don't reset currentStock or lastRestockedAt on re-sync
          },
        });
      } else {
        await prisma.vendorStock.create({
          data: {
            vendorId: vendorDef.id,
            itemDefId: stockDef.itemDefId,
            currentStock: stockDef.maxStock, // start fully stocked
            maxStock: stockDef.maxStock,
            sellPrice: stockDef.sellPrice,
            buyPrice: stockDef.buyPrice,
            restockIntervalMinutes: stockDef.restockIntervalMinutes,
            lastRestockedAt: new Date(),
          },
        });
      }
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Return all vendors with their current (potentially restocked) stock. */
export async function getVendors() {
  // Apply restock for all stock rows first
  const allStock = await prisma.vendorStock.findMany();
  await Promise.all(allStock.map((s) => applyRestock(s.id)));

  const vendors = await prisma.vendor.findMany({
    include: { stock: { orderBy: { itemDefId: 'asc' } } },
    orderBy: { id: 'asc' },
  });

  return vendors.map((v) => ({
    id: v.id,
    name: v.name,
    description: v.description,
    stock: v.stock.map((s) => ({
      id: s.id,
      vendorId: s.vendorId,
      itemDefId: s.itemDefId,
      currentStock: s.currentStock,
      maxStock: s.maxStock,
      sellPrice: s.sellPrice,
      buyPrice: s.buyPrice,
      restockIntervalMinutes: s.restockIntervalMinutes,
      lastRestockedAt: s.lastRestockedAt.toISOString(),
    })),
  }));
}

/**
 * Player buys one or more items from a vendor.
 * Items are delivered via activity report (players collect from there).
 * Iridium is deducted from the given city.
 */
export async function buyFromVendor(
  playerId: string,
  cityId: string,
  vendorId: string,
  itemDefId: ItemId,
  quantity: number,
) {
  if (!Number.isInteger(quantity) || quantity <= 0)
    throw Object.assign(new Error('Quantity must be a positive integer'), { status: 400 });

  const city = await assertCityOwner(playerId, cityId);
  const resources = city.resources as Record<string, number>;

  // Apply restock before checking stock
  const stockRow = await prisma.vendorStock.findFirst({
    where: { vendorId, itemDefId },
  });
  if (!stockRow)
    throw Object.assign(new Error('Vendor does not carry that item'), { status: 404 });

  const updated = await applyRestock(stockRow.id);
  if (!updated)
    throw Object.assign(new Error('Stock error'), { status: 500 });

  if (updated.currentStock < quantity)
    throw Object.assign(new Error('Not enough stock'), { status: 400 });

  const totalCost = updated.sellPrice * quantity;
  if ((resources.iridium ?? 0) < totalCost)
    throw Object.assign(new Error('Insufficient iridium'), { status: 400 });

  const itemDef = ITEMS[itemDefId];
  if (!itemDef)
    throw Object.assign(new Error('Unknown item type'), { status: 400 });

  // Deduct iridium and stock atomically
  await Promise.all([
    prisma.city.update({
      where: { id: cityId },
      data: { resources: { ...resources, iridium: resources.iridium - totalCost } },
    }),
    prisma.vendorStock.update({
      where: { id: stockRow.id },
      data: { currentStock: updated.currentStock - quantity },
    }),
  ]);

  // Create an activity report with the purchased items
  const report = await prisma.activityReport.create({
    data: {
      playerId,
      activityType: 'vendor_purchase',
      xpAwarded: 0,
      skillXpAwarded: {},
      resources: {},
      dismissed: false,
      viewed: false,
      resourcesClaimed: false,
    },
  });

  for (let i = 0; i < quantity; i++) {
    await prisma.itemInstance.create({
      data: {
        itemDefId,
        rotated: false,
        location: ItemLocation.activity_report,
        reportId: report.id,
      },
    });
  }

  return { reportId: report.id, spent: totalCost };
}

/**
 * Player sells an item back to a vendor.
 * The vendor must carry that item type (and it must not already be at max stock).
 * Iridium is added to the city's resource pool via an activity report.
 */
export async function sellToVendor(
  playerId: string,
  cityId: string,
  vendorId: string,
  itemInstanceId: string,
) {
  await assertCityOwner(playerId, cityId);

  const item = await prisma.itemInstance.findUnique({ where: { id: itemInstanceId } });
  if (!item) throw Object.assign(new Error('Item not found'), { status: 404 });

  const hero = await prisma.hero.findUnique({ where: { playerId }, select: { id: true } });

  const ownedByCity =
    item.cityId === cityId &&
    (item.location === ItemLocation.base_armory ||
      item.location === ItemLocation.base_building_equip);
  const ownedByHero =
    hero &&
    item.heroId === hero.id &&
    (item.location === ItemLocation.hero_inventory ||
      item.location === ItemLocation.hero_equipped);

  if (!ownedByCity && !ownedByHero)
    throw Object.assign(new Error('Item not accessible from this base'), { status: 403 });

  if (item.itemDefId === 'market_voucher')
    throw Object.assign(new Error('Cannot sell a voucher'), { status: 400 });

  // Vendor must carry this item type
  const stockRow = await prisma.vendorStock.findFirst({
    where: { vendorId, itemDefId: item.itemDefId },
  });
  if (!stockRow)
    throw Object.assign(new Error('Vendor does not buy that item'), { status: 404 });

  await applyRestock(stockRow.id);

  // Delete the item and increase vendor stock (cap at max)
  await Promise.all([
    prisma.itemInstance.delete({ where: { id: item.id } }),
    prisma.vendorStock.update({
      where: { id: stockRow.id },
      data: { currentStock: { increment: 1 } },
    }),
  ]);

  // Iridium payout to seller via activity report
  const report = await prisma.activityReport.create({
    data: {
      playerId,
      activityType: 'vendor_sale',
      xpAwarded: 0,
      skillXpAwarded: {},
      resources: { iridium: stockRow.buyPrice },
      dismissed: false,
      viewed: false,
      resourcesClaimed: false,
    },
  });

  return { earned: stockRow.buyPrice, reportId: report.id };
}
