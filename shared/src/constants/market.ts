// ─── Black Market ─────────────────────────────────────────────────────────────

/** Fraction of the sale price taken as tax by the black market (5%). */
export const BLACK_MARKET_TAX_RATE = 0.05;

/** Computed net payout: seller receives this fraction of the sale price. */
export const BLACK_MARKET_SELLER_FRACTION = 1 - BLACK_MARKET_TAX_RATE;

export type MarketListingType = 'sell' | 'buy';
export type MarketListingKind = 'item' | 'resource';
export type MarketListingStatus = 'active' | 'completed' | 'cancelled';
