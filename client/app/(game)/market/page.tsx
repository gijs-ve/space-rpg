'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { useGameInventory } from '@/context/inventory';
import {
  ITEMS,
  RESOURCE_TYPES,
  RESOURCE_LABELS,
  RESOURCE_ICONS,
  ITEM_RARITY_COLOR,
  ITEM_CATEGORY_ICON,
  BLACK_MARKET_TAX_RATE,
} from '@rpg/shared';
import { ResourceIcon } from '@/components/ui/ResourceIcon';
import type {
  MarketListing,
  ItemInstance,
  ResourceType,
  ItemId,
} from '@rpg/shared';
import { ItemDefTooltip, ItemCatalogModal } from '@/components/ui/ItemTooltip';

// ─── Types ────────────────────────────────────────────────────────────────────

type ListingTab = 'browse' | 'sell_item' | 'sell_resource' | 'buy_item' | 'buy_resource' | 'mine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatListing(l: MarketListing) {
  if (l.kind === 'item') {
    const def = ITEMS[l.itemDefId as ItemId];
    return { label: def?.name ?? l.itemDefId, sub: def ? `${def.category} · ${def.rarity}` : '', color: def ? ITEM_RARITY_COLOR[def.rarity] : '#9ca3af' };
  }
  return {
    label: `${RESOURCE_LABELS[l.resourceType as ResourceType]} ×${l.resourceAmount}`,
    sub: RESOURCE_ICONS[l.resourceType as ResourceType] ?? '',
    color: '#60a5fa',
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ListingsTable({
  listings,
  ownCityId,
  onCancel,
  onBuy,
}: {
  listings: MarketListing[];
  ownCityId: string | null;
  onCancel: (id: string) => void;
  onBuy?: (l: MarketListing) => void;
}) {
  if (listings.length === 0)
    return <p className="text-gray-600 text-xs text-center py-8">No listings found.</p>;

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="text-gray-500 uppercase tracking-wider text-[10px] border-b border-gray-700">
          <th className="text-left py-2 px-3">Type</th>
          <th className="text-left py-2 px-3">Item / Resource</th>
          <th className="text-right py-2 px-3">💎 Price</th>
          <th className="text-left py-2 px-3">Base</th>
          <th className="text-left py-2 px-3">Player</th>
          <th className="text-right py-2 px-3"></th>
        </tr>
      </thead>
      <tbody>
        {listings.map((l) => {
          const { label, sub, color } = formatListing(l);
          const isOwn = l.cityId === ownCityId;
          const mapHref =
            l.cityX !== undefined && l.cityY !== undefined
              ? `/map?x=${l.cityX}&y=${l.cityY}`
              : null;
          return (
            <tr
              key={l.id}
              className="border-b border-gray-900 hover:bg-gray-900/40 transition-colors"
            >
              <td className="py-2 px-3">
                <span
                  className={[
                    'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
                    l.type === 'sell'
                      ? 'bg-red-900/40 text-red-400'
                      : 'bg-green-900/40 text-green-400',
                  ].join(' ')}
                >
                  {l.type}
                </span>
              </td>
              <td className="py-2 px-3">
                {l.kind === 'item' && ITEMS[l.itemDefId as ItemId] ? (
                  <ItemDefTooltip def={ITEMS[l.itemDefId as ItemId]!} placement="below" className="inline-block">
                    <span style={{ color }} className="cursor-help">{label}</span>
                  </ItemDefTooltip>
                ) : (
                  <span className="inline-flex items-center gap-1.5" style={{ color }}>
                    {l.resourceType && <ResourceIcon type={l.resourceType as ResourceType} size={14} />}
                    {label}
                  </span>
                )}
              </td>
              <td className="py-2 px-3 text-right text-amber-300 tabular-nums font-mono">
                {l.priceIridium}
              </td>
              <td className="py-2 px-3">
                {mapHref ? (
                  <Link
                    href={mapHref}
                    className="text-amber-400/80 hover:text-amber-300 hover:underline transition"
                    title={`View on map (${l.cityX}, ${l.cityY})`}
                  >
                    {l.cityName ?? l.cityId.slice(0, 8)}
                  </Link>
                ) : (
                  <span className="text-gray-500">{l.cityName ?? l.cityId.slice(0, 8)}</span>
                )}
              </td>
              <td className="py-2 px-3 text-gray-400">
                {l.playerUsername ?? '—'}
              </td>
              <td className="py-2 px-3 text-right">
                {isOwn ? (
                  <button
                    onClick={() => onCancel(l.id)}
                    className="text-[10px] text-red-500 hover:text-red-300 uppercase tracking-wider px-2 py-1 border border-red-900/50 rounded hover:bg-red-900/20 transition"
                  >
                    Cancel
                  </button>
                ) : onBuy && l.type === 'sell' ? (
                  <button
                    onClick={() => onBuy(l)}
                    className="text-[10px] text-green-400 hover:text-green-200 uppercase tracking-wider px-2 py-1 border border-green-900/50 rounded hover:bg-green-900/20 transition"
                  >
                    Buy
                  </button>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketPage() {
  const { token } = useAuth();
  const { heroHomeCityId, heroItems, baseItems, fetchHeroItems, notifyReportRefresh } =
    useGameInventory();

  const [tab, setTab]           = useState<ListingTab>('browse');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [myListings, setMyListings] = useState<MarketListing[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  // ── Form state ────────────────────────────────────────────────────────────
  const [sellItemId,       setSellItemId]       = useState('');
  const [sellItemPrice,    setSellItemPrice]     = useState('');
  const [sellResType,      setSellResType]       = useState<ResourceType>('ore');
  const [sellResAmount,    setSellResAmount]     = useState('');
  const [sellResPrice,     setSellResPrice]      = useState('');
  const [buyItemDefId,     setBuyItemDefId]      = useState<ItemId | ''>('');
  const [buyItemPrice,     setBuyItemPrice]      = useState('');
  const [showCatalog,      setShowCatalog]       = useState(false);
  const [buyResType,       setBuyResType]        = useState<ResourceType>('ore');
  const [buyResAmount,     setBuyResAmount]      = useState('');
  const [buyResPrice,      setBuyResPrice]       = useState('');

  // ── Fetchers ───────────────────────────────────────────────────────────────

  const fetchListings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<MarketListing[]>('/market', { token });
      setListings(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchMyListings = useCallback(async () => {
    if (!token || !heroHomeCityId) return;
    try {
      const data = await apiFetch<MarketListing[]>(`/market/mine/${heroHomeCityId}`, { token });
      setMyListings(data);
    } catch { /* silent */ }
  }, [token, heroHomeCityId]);

  useEffect(() => { fetchListings(); }, [fetchListings]);
  useEffect(() => { if (tab === 'mine') fetchMyListings(); }, [tab, fetchMyListings]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function flash(msg: string, isError = false) {
    if (isError) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleCancel = async (listingId: string) => {
    try {
      await apiFetch(`/market/${listingId}`, { method: 'DELETE', token: token! });
      flash('Listing cancelled');
      fetchListings();
      fetchMyListings();
      fetchHeroItems();
      notifyReportRefresh();
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  // Quick buy: place a matching buy offer at exactly the sell price
  const handleQuickBuy = async (l: MarketListing) => {
    if (!heroHomeCityId) { flash('No base found', true); return; }
    try {
      if (l.kind === 'item') {
        await apiFetch('/market/buy/item', {
          method: 'POST',
          token: token!,
          body: JSON.stringify({ cityId: heroHomeCityId, itemDefId: l.itemDefId, priceIridium: l.priceIridium }),
        });
      } else {
        await apiFetch('/market/buy/resource', {
          method: 'POST',
          token: token!,
          body: JSON.stringify({
            cityId: heroHomeCityId,
            resourceType: l.resourceType,
            resourceAmount: l.resourceAmount,
            priceIridium: l.priceIridium,
          }),
        });
      }
      flash('Order placed — check your activity reports');
      fetchListings();
      fetchHeroItems();
      notifyReportRefresh();
    } catch (e: any) {
      flash(e.message, true);
    }
  };

  const handleSellItem = async () => {
    if (!heroHomeCityId || !sellItemId || !sellItemPrice) { flash('Fill all fields', true); return; }
    try {
      await apiFetch('/market/sell/item', {
        method: 'POST', token: token!,
        body: JSON.stringify({ cityId: heroHomeCityId, itemInstanceId: sellItemId, priceIridium: parseInt(sellItemPrice) }),
      });
      flash('Item listed on the market');
      setSellItemId(''); setSellItemPrice('');
      fetchListings(); fetchMyListings(); fetchHeroItems();
    } catch (e: any) { flash(e.message, true); }
  };

  const handleSellResource = async () => {
    if (!heroHomeCityId || !sellResAmount || !sellResPrice) { flash('Fill all fields', true); return; }
    try {
      await apiFetch('/market/sell/resource', {
        method: 'POST', token: token!,
        body: JSON.stringify({ cityId: heroHomeCityId, resourceType: sellResType, resourceAmount: parseInt(sellResAmount), priceIridium: parseInt(sellResPrice) }),
      });
      flash('Resource listed on the market');
      setSellResAmount(''); setSellResPrice('');
      fetchListings(); fetchMyListings();
    } catch (e: any) { flash(e.message, true); }
  };

  const handleBuyItem = async () => {
    if (!heroHomeCityId || !buyItemDefId || !buyItemPrice) { flash('Fill all fields', true); return; }
    try {
      await apiFetch('/market/buy/item', {
        method: 'POST', token: token!,
        body: JSON.stringify({ cityId: heroHomeCityId, itemDefId: buyItemDefId, priceIridium: parseInt(buyItemPrice) }),
      });
      flash('Buy offer placed — check activity reports if matched');
      setBuyItemDefId(''); setBuyItemPrice('');
      fetchListings(); fetchMyListings();
    } catch (e: any) { flash(e.message, true); }
  };

  const handleBuyResource = async () => {
    if (!heroHomeCityId || !buyResAmount || !buyResPrice) { flash('Fill all fields', true); return; }
    try {
      await apiFetch('/market/buy/resource', {
        method: 'POST', token: token!,
        body: JSON.stringify({ cityId: heroHomeCityId, resourceType: buyResType, resourceAmount: parseInt(buyResAmount), priceIridium: parseInt(buyResPrice) }),
      });
      flash('Buy offer placed');
      setBuyResAmount(''); setBuyResPrice('');
      fetchListings(); fetchMyListings();
    } catch (e: any) { flash(e.message, true); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  // Items the player can list — hero inventory / base armory, never equipped
  const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

  const listableItems = [...heroItems, ...baseItems]
    .filter(
      (it) =>
        it.itemDefId !== 'market_voucher' &&
        it.location !== 'market_listing' &&
        it.location !== 'activity_report' &&
        it.location !== 'hero_equipped',
    )
    .sort((a, b) => {
      const defA = ITEMS[a.itemDefId as ItemId];
      const defB = ITEMS[b.itemDefId as ItemId];
      const rankA = defA ? (RARITY_RANK[defA.rarity] ?? 99) : 99;
      const rankB = defB ? (RARITY_RANK[defB.rarity] ?? 99) : 99;
      if (rankA !== rankB) return rankA - rankB;
      return (defA?.name ?? a.itemDefId).localeCompare(defB?.name ?? b.itemDefId);
    });

  const uniqueItemDefs = Object.values(ITEMS).filter((d) => d.id !== 'market_voucher');

  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS: { id: ListingTab; label: string }[] = [
    { id: 'browse',       label: '📋 Browse' },
    { id: 'sell_item',    label: '⬆ Sell Item' },
    { id: 'sell_resource',label: '⬆ Sell Resources' },
    { id: 'buy_item',     label: '⬇ Buy Item' },
    { id: 'buy_resource', label: '⬇ Buy Resources' },
    { id: 'mine',         label: '🗂 My Listings' },
  ];

  const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-amber-600';
  const btnCls   = 'px-4 py-2 rounded text-xs font-semibold uppercase tracking-wider transition';
  const primBtn  = `${btnCls} bg-amber-700 hover:bg-amber-600 text-amber-100`;

  return (
    <div className="w-full space-y-5">
      {showCatalog && (
        <ItemCatalogModal
          selected={buyItemDefId}
          onSelect={(id) => { setBuyItemDefId(id); setShowCatalog(false); }}
          onClose={() => setShowCatalog(false)}
        />
      )}
      {/* ── Header card ── */}
      <div className="bg-gray-800 rounded-xl p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">📈 Black Market</h1>
          <p className="text-gray-500 text-xs mt-1">
            Tax: {(BLACK_MARKET_TAX_RATE * 100).toFixed(0)}% on all sales · Integers only · Gold escrowed on buy offers
          </p>
        </div>
        <button
          onClick={fetchListings}
          className="text-xs text-gray-500 hover:text-amber-400 uppercase tracking-wider transition"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Flash messages ── */}
      {error   && <div className="px-4 py-2 bg-red-900/30 border border-red-800/50 rounded-xl text-red-400 text-xs">{error}</div>}
      {success && <div className="px-4 py-2 bg-green-900/30 border border-green-800/50 rounded-xl text-green-400 text-xs">{success}</div>}

      {/* ── Tab bar ── */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-xl flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
              tab === t.id
                ? 'bg-gray-700 text-white shadow'
                : 'text-gray-500 hover:text-gray-300',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        {/* BROWSE */}
        {tab === 'browse' && (
          <div className="overflow-x-auto">
            {loading ? (
              <p className="text-gray-600 text-xs text-center py-8">Loading…</p>
            ) : (
              <ListingsTable
                listings={listings}
                ownCityId={heroHomeCityId}
                onCancel={handleCancel}
                onBuy={handleQuickBuy}
              />
            )}
          </div>
        )}

        {/* MY LISTINGS */}
        {tab === 'mine' && (
          <div className="overflow-x-auto">
            <ListingsTable
              listings={myListings}
              ownCityId={heroHomeCityId}
              onCancel={handleCancel}
            />
          </div>
        )}

        {/* SELL ITEM */}
        {tab === 'sell_item' && (
          <div className="p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wide">
              List an Item for Sale
            </h2>
            <p className="text-[11px] text-gray-600 mb-4">
              Click an item to select it, then set a price and confirm.
            </p>

            {/* ── Item picker grid ── */}
            {listableItems.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-6">No items available to list.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-5">
                {listableItems.map((it) => {
                  const def = ITEMS[it.itemDefId as ItemId];
                  const color = def ? ITEM_RARITY_COLOR[def.rarity] : '#9ca3af';
                  const isSelected = sellItemId === it.id;
                  const card = (
                    <button
                      onClick={() => setSellItemId(isSelected ? '' : it.id)}
                      className={[
                        'flex flex-col gap-1 p-2.5 rounded-xl border text-left transition w-full',
                        isSelected
                          ? 'border-amber-500 bg-amber-900/25 ring-1 ring-amber-600/40'
                          : 'border-gray-700 bg-gray-900/40 hover:border-gray-600 hover:bg-gray-900/60',
                      ].join(' ')}
                    >
                      <span className="font-semibold text-xs leading-tight" style={{ color }}>
                        {def?.name ?? it.itemDefId}
                      </span>
                      <span className="text-[10px] text-gray-500 capitalize">
                        {it.location === 'hero_inventory' ? 'Hero' : 'Base'}
                      </span>
                    </button>
                  );
                  return def ? (
                    <ItemDefTooltip key={it.id} def={def}>{card}</ItemDefTooltip>
                  ) : (
                    <React.Fragment key={it.id}>{card}</React.Fragment>
                  );
                })}
              </div>
            )}

            {/* ── Price + confirm ── */}
            <div className="max-w-xs space-y-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1 uppercase tracking-wide">
                  Price (� Gold)
                </label>
                <input
                  type="number" min="1" step="1"
                  className={inputCls}
                  value={sellItemPrice}
                  onChange={(e) => setSellItemPrice(e.target.value)}
                  placeholder="e.g. 100"
                />
              </div>
              {sellItemPrice && (
                <p className="text-[11px] text-gray-500">
                  You receive:{' '}
                  <span className="text-amber-400">
                    {Math.floor(parseInt(sellItemPrice || '0') * (1 - BLACK_MARKET_TAX_RATE))} 💎
                  </span>{' '}
                  after {(BLACK_MARKET_TAX_RATE * 100).toFixed(0)}% tax
                </p>
              )}
              <button
                onClick={handleSellItem}
                disabled={!sellItemId || !sellItemPrice}
                className={primBtn + ' disabled:opacity-40 disabled:cursor-not-allowed'}
              >
                Place Sell Offer
              </button>
            </div>
          </div>
        )}

        {/* SELL RESOURCE */}
        {tab === 'sell_resource' && (
          <div className="p-6 max-w-md">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
              List Resources for Sale
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1 uppercase tracking-wide">Resource</label>
                <select className={inputCls} value={sellResType} onChange={(e) => setSellResType(e.target.value as ResourceType)}>
                  {RESOURCE_TYPES.filter((r) => r !== 'iridium').map((r) => (
                    <option key={r} value={r}>{RESOURCE_ICONS[r]} {RESOURCE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1 uppercase tracking-wide">Amount</label>
                <input type="number" min="1" step="1" className={inputCls} value={sellResAmount} onChange={(e) => setSellResAmount(e.target.value)} placeholder="e.g. 200" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1 uppercase tracking-wide">Price (� Gold)</label>
                <input type="number" min="1" step="1" className={inputCls} value={sellResPrice} onChange={(e) => setSellResPrice(e.target.value)} placeholder="e.g. 50" />
              </div>
              {sellResPrice && (
                <p className="text-[11px] text-gray-500">
                  You receive: <span className="text-amber-400">{Math.floor(parseInt(sellResPrice || '0') * (1 - BLACK_MARKET_TAX_RATE))} �</span> after tax
                </p>
              )}
              <button onClick={handleSellResource} className={primBtn}>Place Sell Offer</button>
            </div>
          </div>
        )}

        {/* BUY ITEM */}
        {tab === 'buy_item' && (
          <div className="p-6 max-w-md">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
              Place a Buy Offer for an Item
            </h2>
            <p className="text-[11px] text-gray-600 mb-4">
              Gold are escrowed. If a matching sell offer exists at or below your price, it matches immediately.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1 uppercase tracking-wide">Item Type</label>
                <button
                  type="button"
                  onClick={() => setShowCatalog(true)}
                  className={[inputCls, 'flex items-center gap-2 text-left cursor-pointer'].join(' ')}
                >
                  {buyItemDefId ? (
                    <>
                      <span>{ITEM_CATEGORY_ICON[ITEMS[buyItemDefId as ItemId].category]}</span>
                      <span style={{ color: ITEM_RARITY_COLOR[ITEMS[buyItemDefId as ItemId].rarity] }}>
                        {ITEMS[buyItemDefId as ItemId].name}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-600">— choose item type —</span>
                  )}
                </button>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1 uppercase tracking-wide">Max Price (� Gold)</label>
                <input type="number" min="1" step="1" className={inputCls} value={buyItemPrice} onChange={(e) => setBuyItemPrice(e.target.value)} placeholder="e.g. 120" />
              </div>
              <button onClick={handleBuyItem} className={primBtn}>Place Buy Offer</button>
            </div>
          </div>
        )}

        {/* BUY RESOURCE */}
        {tab === 'buy_resource' && (
          <div className="p-6 max-w-md">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
              Place a Buy Offer for Resources
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1 uppercase tracking-wide">Resource</label>
                <select className={inputCls} value={buyResType} onChange={(e) => setBuyResType(e.target.value as ResourceType)}>
                  {RESOURCE_TYPES.filter((r) => r !== 'iridium').map((r) => (
                    <option key={r} value={r}>{RESOURCE_ICONS[r]} {RESOURCE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1 uppercase tracking-wide">Amount</label>
                <input type="number" min="1" step="1" className={inputCls} value={buyResAmount} onChange={(e) => setBuyResAmount(e.target.value)} placeholder="e.g. 200" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1 uppercase tracking-wide">Price (� Gold)</label>
                <input type="number" min="1" step="1" className={inputCls} value={buyResPrice} onChange={(e) => setBuyResPrice(e.target.value)} placeholder="e.g. 30" />
              </div>
              <button onClick={handleBuyResource} className={primBtn}>Place Buy Offer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
