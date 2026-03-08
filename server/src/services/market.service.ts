import { prisma } from '../db/client';
import { ItemLocation } from '@prisma/client';
import {
  BLACK_MARKET_TAX_RATE,
  ITEMS,
  ItemId,
  ResourceType,
} from '@rpg/shared';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function taxedPayout(price: number): number {
  return Math.floor(price * (1 - BLACK_MARKET_TAX_RATE));
}

/** Ensure the requesting player owns (or is associated with) the given city. */
async function assertCityOwner(playerId: string, cityId: string) {
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) throw Object.assign(new Error('Base not found'), { status: 404 });
  if (city.playerId !== playerId)
    throw Object.assign(new Error('Unauthorized'), { status: 403 });
  return city;
}

/** Create an activity-report entry for a single gold payout to a city's player. */
async function createGoldReport(
  playerId: string,
  gold: number,
  label: string,
  cityId?: string,
) {
  return prisma.activityReport.create({
    data: {
      playerId,
      activityType: label,
      xpAwarded: 0,
      skillXpAwarded: {},
      resources: { gold },
      dismissed: false,
      viewed: false,
      resourcesClaimed: false,
      cityId: cityId ?? null,
    },
  });
}

/** Create an activity-report entry for a resource payout (non-gold resource). */
async function createResourceReport(
  playerId: string,
  resourceType: string,
  amount: number,
  label: string,
  cityId?: string,
) {
  return prisma.activityReport.create({
    data: {
      playerId,
      activityType: label,
      xpAwarded: 0,
      skillXpAwarded: {},
      resources: { [resourceType]: amount },
      dismissed: false,
      viewed: false,
      resourcesClaimed: false,
      cityId: cityId ?? null,
    },
  });
}

// ─── Matching ─────────────────────────────────────────────────────────────────

/**
 * After a new listing is placed, check for an opposing match and immediately
 * settle if found. Returns true if a match occurred.
 */
async function tryMatch(newListingId: string): Promise<boolean> {
  const listing = await prisma.marketListing.findUnique({
    where: { id: newListingId },
    include: { city: { select: { playerId: true, name: true } } },
  });
  if (!listing || listing.status !== 'active') return false;

  if (listing.kind === 'item') {
    return listing.type === 'sell'
      ? tryMatchSellItem(listing as any)
      : tryMatchBuyItem(listing as any);
  } else {
    return listing.type === 'sell'
      ? tryMatchSellResource(listing as any)
      : tryMatchBuyResource(listing as any);
  }
}

// ─── Item matching ────────────────────────────────────────────────────────────

async function tryMatchSellItem(sellListing: any): Promise<boolean> {
  // Find highest active buy offer ≥ sellListing.priceGold for the same itemDefId
  const buyOffer = await prisma.marketListing.findFirst({
    where: {
      kind: 'item',
      type: 'buy',
      status: 'active',
      itemDefId: sellListing.itemDefId,
      priceGold: { gte: sellListing.priceGold },
      cityId: { not: sellListing.cityId }, // don't match with yourself
    },
    orderBy: [{ priceGold: 'desc' }, { createdAt: 'asc' }],
    include: { city: { select: { playerId: true } } },
  });
  if (!buyOffer) return false;

  // Match at the BUY offer's price (the standing listing sets the price)
  await settleItemTrade(sellListing, buyOffer, buyOffer.priceGold);
  return true;
}

async function tryMatchBuyItem(buyListing: any): Promise<boolean> {
  // Find cheapest active sell offer ≤ buyListing.priceGold for the same itemDefId
  const sellOffer = await prisma.marketListing.findFirst({
    where: {
      kind: 'item',
      type: 'sell',
      status: 'active',
      itemDefId: buyListing.itemDefId,
      priceGold: { lte: buyListing.priceGold },
      cityId: { not: buyListing.cityId },
    },
    orderBy: [{ priceGold: 'asc' }, { createdAt: 'asc' }],
    include: { city: { select: { playerId: true } } },
  });
  if (!sellOffer) return false;

  // Match at the SELL offer's price
  await settleItemTrade(sellOffer, buyListing, sellOffer.priceGold);
  return true;
}

/**
 * Settle a matched item trade.
 * - sellListing holds the item instance in escrow (market_listing)
 * - buyListing holds escrowed gold in the buyer's city resources
 * - matchPrice is the agreed price (the standing/older listing's price)
 */
async function settleItemTrade(
  sellListing: any,
  buyListing: any,
  matchPrice: number,
) {
  const buyerCity = await prisma.city.findUnique({
    where: { id: buyListing.cityId },
    select: { id: true, playerId: true, resources: true },
  });
  const sellerCity = await prisma.city.findUnique({
    where: { id: sellListing.cityId },
    select: { id: true, playerId: true, resources: true },
  });
  if (!buyerCity || !sellerCity) return;

  const payout = taxedPayout(matchPrice);
  const buyPrice = buyListing.priceGold as number;
  const refund = buyPrice - matchPrice; // ≥ 0 when buyer offered more

  // Find and transfer the escrowed item to buyer's activity report
  const item = await prisma.itemInstance.findUnique({
    where: { id: sellListing.itemInstanceId },
  });

  // Delete seller's voucher (market_bond item linked to the sell listing)
  await prisma.itemInstance.deleteMany({
    where: { marketListingId: sellListing.id },
  });

  // Move item to an activity_report for the buyer
  const buyerReport = await prisma.activityReport.create({
    data: {
      playerId: buyerCity.playerId,
      activityType: 'market_purchase',
      xpAwarded: 0,
      skillXpAwarded: {},
      resources: {},
      dismissed: false,
      viewed: false,
      resourcesClaimed: false,
      cityId: buyerCity.id,
    },
  });

  if (item) {
    await prisma.itemInstance.update({
      where: { id: item.id },
      data: {
        location: ItemLocation.activity_report,
        heroId: null,
        cityId: null,
        gridX: null,
        gridY: null,
        equipSlot: null,
        buildingSlotIndex: null,
        buildingEquipSlot: null,
        marketListingId: null,
        reportId: buyerReport.id,
      },
    });
  }

  // Refund excess gold to buyer (goes into activity report resources)
  if (refund > 0) {
    await createGoldReport(buyerCity.playerId, refund, 'market_refund', buyerCity.id);
  }

  // Payout gold to seller via activity report
  await createGoldReport(sellerCity.playerId, payout, 'market_sale', sellerCity.id);

  // Mark both listings completed
  await prisma.marketListing.updateMany({
    where: { id: { in: [sellListing.id, buyListing.id] } },
    data: { status: 'completed' },
  });
}

// ─── Resource matching ────────────────────────────────────────────────────────

async function tryMatchSellResource(sellListing: any): Promise<boolean> {
  const buyOffer = await prisma.marketListing.findFirst({
    where: {
      kind: 'resource',
      type: 'buy',
      status: 'active',
      resourceType: sellListing.resourceType,
      resourceAmount: sellListing.resourceAmount,
      priceGold: { gte: sellListing.priceGold },
      cityId: { not: sellListing.cityId },
    },
    orderBy: [{ priceGold: 'desc' }, { createdAt: 'asc' }],
  });
  if (!buyOffer) return false;

  await settleResourceTrade(sellListing, buyOffer, buyOffer.priceGold);
  return true;
}

async function tryMatchBuyResource(buyListing: any): Promise<boolean> {
  const sellOffer = await prisma.marketListing.findFirst({
    where: {
      kind: 'resource',
      type: 'sell',
      status: 'active',
      resourceType: buyListing.resourceType,
      resourceAmount: buyListing.resourceAmount,
      priceGold: { lte: buyListing.priceGold },
      cityId: { not: buyListing.cityId },
    },
    orderBy: [{ priceGold: 'asc' }, { createdAt: 'asc' }],
  });
  if (!sellOffer) return false;

  await settleResourceTrade(sellOffer, buyListing, sellOffer.priceGold);
  return true;
}

async function settleResourceTrade(
  sellListing: any,
  buyListing: any,
  matchPrice: number,
) {
  const buyerCity = await prisma.city.findUnique({
    where: { id: buyListing.cityId },
    select: { id: true, playerId: true },
  });
  const sellerCity = await prisma.city.findUnique({
    where: { id: sellListing.cityId },
    select: { id: true, playerId: true },
  });
  if (!buyerCity || !sellerCity) return;

  const payout = taxedPayout(matchPrice);
  const refund = (buyListing.priceGold as number) - matchPrice;

  // Buyer receives the resources via activity report
  await createResourceReport(
    buyerCity.playerId,
    sellListing.resourceType,
    sellListing.resourceAmount,
    'market_purchase',
    buyerCity.id,
  );

  // Refund excess gold to buyer
  if (refund > 0) {
    await createGoldReport(buyerCity.playerId, refund, 'market_refund', buyerCity.id);
  }

  // Payout gold to seller
  await createGoldReport(sellerCity.playerId, payout, 'market_sale', sellerCity.id);

  await prisma.marketListing.updateMany({
    where: { id: { in: [sellListing.id, buyListing.id] } },
    data: { status: 'completed' },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** List all active market listings, optionally filtered. */
export async function getMarketListings(filter?: {
  kind?: 'item' | 'resource';
  type?: 'sell' | 'buy';
  itemDefId?: string;
  resourceType?: string;
}) {
  const listings = await prisma.marketListing.findMany({
    where: {
      status: 'active',
      ...(filter?.kind ? { kind: filter.kind } : {}),
      ...(filter?.type ? { type: filter.type } : {}),
      ...(filter?.itemDefId ? { itemDefId: filter.itemDefId } : {}),
      ...(filter?.resourceType ? { resourceType: filter.resourceType } : {}),
    },
    include: { city: { select: { name: true, x: true, y: true, player: { select: { username: true } } } } },
    orderBy: [{ priceGold: 'asc' }, { createdAt: 'asc' }],
  });

  return listings.map((l) => ({
    ...l,
    cityName: l.city.name,
    cityX: l.city.x,
    cityY: l.city.y,
    playerUsername: l.city.player.username,
    city: undefined,
  }));
}

/**
 * Place a sell listing for an item.
 * The item must be in the player's hero inventory or base armory.
 * The item is moved to 'market_listing' and a voucher is created in its slot.
 */
export async function placeSellItem(
  playerId: string,
  cityId: string,
  itemInstanceId: string,
  priceGold: number,
) {
  if (!Number.isInteger(priceGold) || priceGold <= 0)
    throw Object.assign(new Error('Price must be a positive integer'), { status: 400 });

  await assertCityOwner(playerId, cityId);

  const item = await prisma.itemInstance.findUnique({ where: { id: itemInstanceId } });
  if (!item) throw Object.assign(new Error('Item not found'), { status: 404 });

  // For item ownership: check if item's heroId belongs to this player
  const heroForItem = item.heroId
    ? await prisma.hero.findFirst({ where: { id: item.heroId, playerId }, select: { id: true } })
    : null;

  // Item must be in the player's city armory or their hero's inventory
  const ownedByCity = item.cityId === cityId &&
    (item.location === ItemLocation.base_armory || item.location === ItemLocation.base_building_equip);
  const ownedByHero = heroForItem !== null &&
    (item.location === ItemLocation.hero_inventory || item.location === ItemLocation.hero_equipped);

  if (!ownedByCity && !ownedByHero)
    throw Object.assign(new Error('Item not accessible from this base'), { status: 403 });

  if (item.itemDefId === 'market_bond')
    throw Object.assign(new Error('Cannot list a voucher on the market'), { status: 400 });

  const itemDef = ITEMS[item.itemDefId as ItemId];

  // Create the market listing
  const listing = await prisma.marketListing.create({
    data: {
      type: 'sell',
      kind: 'item',
      status: 'active',
      cityId,
      itemDefId: item.itemDefId,
      itemInstanceId: item.id,
      priceGold,
    },
  });

  // Create a voucher that occupies the original slot
  await prisma.itemInstance.create({
    data: {
      itemDefId: 'market_bond',
      rotated: false,
      gridX: item.gridX,
      gridY: item.gridY,
      heroId: item.heroId,
      cityId: item.cityId,
      location: item.location,
      equipSlot: item.equipSlot,
      buildingSlotIndex: item.buildingSlotIndex,
      buildingEquipSlot: item.buildingEquipSlot,
      marketListingId: listing.id,
    },
  });

  // Move the real item to market_listing escrow
  await prisma.itemInstance.update({
    where: { id: item.id },
    data: {
      location: ItemLocation.market_listing,
      gridX: null,
      gridY: null,
      heroId: null,
      cityId,
      equipSlot: null,
      buildingSlotIndex: null,
      buildingEquipSlot: null,
    },
  });

  // Check for immediate match
  const matched = await tryMatch(listing.id);

  const updatedListing = await prisma.marketListing.findUnique({
    where: { id: listing.id },
    include: { city: { select: { name: true } } },
  });

  return { listing: { ...updatedListing, cityName: updatedListing?.city.name }, matched };
}

/**
 * Place a sell listing for a base resource.
 * The resource amount is deducted from the city immediately (escrowed).
 */
export async function placeSellResource(
  playerId: string,
  cityId: string,
  resourceType: ResourceType,
  resourceAmount: number,
  priceGold: number,
) {
  if (!Number.isInteger(priceGold) || priceGold <= 0)
    throw Object.assign(new Error('Price must be a positive integer'), { status: 400 });
  if (!Number.isInteger(resourceAmount) || resourceAmount <= 0)
    throw Object.assign(new Error('Amount must be a positive integer'), { status: 400 });

  const city = await assertCityOwner(playerId, cityId);
  const resources = city.resources as Record<string, number>;

  if ((resources[resourceType] ?? 0) < resourceAmount)
    throw Object.assign(new Error('Insufficient resources'), { status: 400 });

  // Deduct resources (escrow)
  await prisma.city.update({
    where: { id: cityId },
    data: {
      resources: { ...resources, [resourceType]: resources[resourceType] - resourceAmount },
    },
  });

  const listing = await prisma.marketListing.create({
    data: {
      type: 'sell',
      kind: 'resource',
      status: 'active',
      cityId,
      resourceType,
      resourceAmount,
      priceGold,
    },
  });

  const matched = await tryMatch(listing.id);

  const updatedListing = await prisma.marketListing.findUnique({
    where: { id: listing.id },
    include: { city: { select: { name: true } } },
  });

  return { listing: { ...updatedListing, cityName: updatedListing?.city.name }, matched };
}

/**
 * Place a buy offer for an item type.
 * Gold is escrowed from the city immediately.
 */
export async function placeBuyItem(
  playerId: string,
  cityId: string,
  itemDefId: ItemId,
  priceGold: number,
) {
  if (!Number.isInteger(priceGold) || priceGold <= 0)
    throw Object.assign(new Error('Price must be a positive integer'), { status: 400 });
  if (!ITEMS[itemDefId])
    throw Object.assign(new Error('Unknown item type'), { status: 400 });

  const city = await assertCityOwner(playerId, cityId);
  const resources = city.resources as Record<string, number>;

  if ((resources.gold ?? 0) < priceGold)
    throw Object.assign(new Error('Insufficient gold'), { status: 400 });

  // Escrow gold
  await prisma.city.update({
    where: { id: cityId },
    data: { resources: { ...resources, gold: resources.gold - priceGold } },
  });

  const listing = await prisma.marketListing.create({
    data: {
      type: 'buy',
      kind: 'item',
      status: 'active',
      cityId,
      itemDefId,
      priceGold,
    },
  });

  const matched = await tryMatch(listing.id);

  const updatedListing = await prisma.marketListing.findUnique({
    where: { id: listing.id },
    include: { city: { select: { name: true } } },
  });

  return { listing: { ...updatedListing, cityName: updatedListing?.city.name }, matched };
}

/**
 * Place a buy offer for a resource amount.
 * Gold is escrowed from the city immediately.
 */
export async function placeBuyResource(
  playerId: string,
  cityId: string,
  resourceType: ResourceType,
  resourceAmount: number,
  priceGold: number,
) {
  if (!Number.isInteger(priceGold) || priceGold <= 0)
    throw Object.assign(new Error('Price must be a positive integer'), { status: 400 });
  if (!Number.isInteger(resourceAmount) || resourceAmount <= 0)
    throw Object.assign(new Error('Amount must be a positive integer'), { status: 400 });

  const city = await assertCityOwner(playerId, cityId);
  const resources = city.resources as Record<string, number>;

  if ((resources.gold ?? 0) < priceGold)
    throw Object.assign(new Error('Insufficient gold'), { status: 400 });

  await prisma.city.update({
    where: { id: cityId },
    data: { resources: { ...resources, gold: resources.gold - priceGold } },
  });

  const listing = await prisma.marketListing.create({
    data: {
      type: 'buy',
      kind: 'resource',
      status: 'active',
      cityId,
      resourceType,
      resourceAmount,
      priceGold,
    },
  });

  const matched = await tryMatch(listing.id);

  const updatedListing = await prisma.marketListing.findUnique({
    where: { id: listing.id },
    include: { city: { select: { name: true } } },
  });

  return { listing: { ...updatedListing, cityName: updatedListing?.city.name }, matched };
}

/**
 * Cancel an active listing owned by playerId.
 * Returns escrowed resources/items to the owner.
 */
export async function cancelListing(playerId: string, listingId: string) {
  const listing = await prisma.marketListing.findUnique({
    where: { id: listingId },
    include: { city: true, voucherItems: true },
  });
  if (!listing) throw Object.assign(new Error('Listing not found'), { status: 404 });
  if (listing.city.playerId !== playerId)
    throw Object.assign(new Error('Unauthorized'), { status: 403 });
  if (listing.status !== 'active')
    throw Object.assign(new Error('Listing is no longer active'), { status: 400 });

  const resources = listing.city.resources as Record<string, number>;

  if (listing.kind === 'item' && listing.type === 'sell') {
    // Return item to an activity_report (player can claim it from there)
    const escrowed = await prisma.itemInstance.findUnique({
      where: { id: listing.itemInstanceId! },
    });

    // Delete voucher(s)
    await prisma.itemInstance.deleteMany({
      where: { marketListingId: listing.id },
    });

    if (escrowed) {
      const report = await prisma.activityReport.create({
        data: {
          playerId,
          activityType: 'market_cancelled',
          xpAwarded: 0,
          skillXpAwarded: {},
          resources: {},
          dismissed: false,
          viewed: false,
          resourcesClaimed: false,
          cityId: listing.cityId,
        },
      });
      await prisma.itemInstance.update({
        where: { id: escrowed.id },
        data: {
          location: ItemLocation.activity_report,
          heroId: null,
          cityId: null,
          gridX: null,
          gridY: null,
          equipSlot: null,
          buildingSlotIndex: null,
          buildingEquipSlot: null,
          marketListingId: null,
          reportId: report.id,
        },
      });
    }
  } else if (listing.kind === 'resource' && listing.type === 'sell') {
    // Return escrowed resources to city
    await prisma.city.update({
      where: { id: listing.cityId },
      data: {
        resources: {
          ...resources,
          [listing.resourceType!]:
            (resources[listing.resourceType!] ?? 0) + listing.resourceAmount!,
        },
      },
    });
  } else {
    // buy offer — return escrowed gold to city
    await prisma.city.update({
      where: { id: listing.cityId },
      data: {
        resources: {
          ...resources,
          gold: (resources.gold ?? 0) + listing.priceGold,
        },
      },
    });
  }

  await prisma.marketListing.update({
    where: { id: listingId },
    data: { status: 'cancelled' },
  });

  return { success: true };
}

/** Listings owned by a specific city (for My Listings panel). */
export async function getCityListings(playerId: string, cityId: string) {
  await assertCityOwner(playerId, cityId);

  const listings = await prisma.marketListing.findMany({
    where: { cityId, status: 'active' },
    include: { city: { select: { name: true, x: true, y: true, player: { select: { username: true } } } } },
    orderBy: { createdAt: 'desc' },
  });

  return listings.map((l) => ({
    ...l,
    cityName: l.city.name,
    cityX: l.city.x,
    cityY: l.city.y,
    playerUsername: l.city.player.username,
    city: undefined,
  }));
}
