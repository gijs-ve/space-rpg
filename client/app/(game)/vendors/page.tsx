'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { useGameInventory } from '@/context/inventory';
import { ITEMS, ITEM_RARITY_COLOR } from '@rpg/shared';
import type { VendorWithStock, VendorStockEntry, ItemId, ItemInstance } from '@rpg/shared';
import { ItemDefTooltip } from '@/components/ui/ItemTooltip';

// ─── Types ────────────────────────────────────────────────────────────────────

type BuyCartItem  = { entry: VendorStockEntry; qty: number };
type SellCartItem = { instance: ItemInstance; stockEntry: VendorStockEntry };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRestockTime(lastRestockedAt: string, intervalMinutes: number): string {
  const next = new Date(lastRestockedAt).getTime() + intervalMinutes * 60_000;
  const diff = next - Date.now();
  if (diff <= 0) return 'Restocking…';
  const m = Math.floor(diff / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Stock Card ───────────────────────────────────────────────────────────────

function StockCard({
  entry,
  cartQty,
  onAdd,
}: {
  entry: VendorStockEntry;
  cartQty: number;
  onAdd: () => void;
}) {

  const def = ITEMS[entry.itemDefId as ItemId];
  if (!def) return null;

  const color    = ITEM_RARITY_COLOR[def.rarity];
  const stockPct = entry.maxStock > 0 ? (entry.currentStock / entry.maxStock) * 100 : 0;
  const canAdd   = entry.currentStock > cartQty;

  return (
    <ItemDefTooltip def={def}>
      <button
        onClick={onAdd}
        disabled={!canAdd}
        title={`${def.name} — click to add to buy cart`}
        className={[
          'relative flex flex-col gap-1 p-3 rounded-xl border text-left transition w-full',
          canAdd
            ? 'border-gray-700 bg-gray-900/50 hover:border-amber-600/60 hover:bg-amber-900/10 cursor-pointer'
            : 'border-gray-800 bg-gray-900/20 opacity-40 cursor-not-allowed',
        ].join(' ')}
      >
        {cartQty > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-amber-600 text-white text-[10px] font-bold rounded-full px-1">
            ×{cartQty}
          </span>
        )}
        <div className="font-semibold text-xs leading-tight pr-5" style={{ color }}>{def.name}</div>
        <div className="text-[10px] text-gray-500 capitalize">{def.rarity} · {def.category}</div>
        <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden mt-0.5">
          <div className="h-full bg-amber-600 transition-all" style={{ width: `${stockPct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 tabular-nums">
          <span>{entry.currentStock}/{entry.maxStock} left</span>
          <span>{formatRestockTime(entry.lastRestockedAt, entry.restockIntervalMinutes)}</span>
        </div>
        <div className="flex justify-between mt-0.5">
          <div className="text-[10px] text-gray-500">
            Buy <span className="text-amber-300 font-mono">💎 {entry.sellPrice}</span>
          </div>
          {entry.buyPrice > 0 && (
            <div className="text-[10px] text-gray-500">
              Sell <span className="text-sky-300 font-mono">💎 {entry.buyPrice}</span>
            </div>
          )}
        </div>
      </button>
    </ItemDefTooltip>
  );
}

// ─── Player Item Card ─────────────────────────────────────────────────────────

function PlayerItemCard({
  instance,
  canSell,
  inCart,
  onClick,
}: {
  instance: ItemInstance;
  canSell: boolean;
  inCart: boolean;
  onClick: () => void;
}) {
  const def = ITEMS[instance.itemDefId as ItemId];
  if (!def) return null;
  const color = ITEM_RARITY_COLOR[def.rarity];

  return (
    <ItemDefTooltip def={def}>
      <button
        onClick={onClick}
        disabled={!canSell}
        title={canSell ? `${def.name} — click to add to sell cart` : `${def.name} — vendor doesn't buy this`}
        className={[
          'relative flex flex-col gap-1 p-2.5 rounded-xl border text-left transition w-full',
          inCart
            ? 'border-sky-500 bg-sky-900/20'
            : canSell
            ? 'border-gray-700 bg-gray-900/50 hover:border-sky-600/60 hover:bg-sky-900/10 cursor-pointer'
            : 'border-gray-800 bg-gray-900/20 opacity-30 cursor-not-allowed',
        ].join(' ')}
      >
        {inCart && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-sky-500 rounded-full" />}
        <div className="font-semibold text-xs leading-tight pr-4" style={{ color }}>{def.name}</div>
        <div className="text-[10px] text-gray-500 capitalize">
          {instance.location === 'hero_inventory' ? 'Hero' : 'Base'}
        </div>
      </button>
    </ItemDefTooltip>
  );
}

// ─── Cart Panel ───────────────────────────────────────────────────────────────

function CartPanel({
  buyCart,
  sellCart,
  onRemoveBuy,
  onRemoveSell,
  onConfirm,
  confirming,
}: {
  buyCart: BuyCartItem[];
  sellCart: SellCartItem[];
  onRemoveBuy: (entryId: string) => void;
  onRemoveSell: (instanceId: string) => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const buyTotal = buyCart.reduce((s, i) => s + i.entry.sellPrice * i.qty, 0);
  const sellTotal = sellCart.reduce((s, i) => s + i.stockEntry.buyPrice, 0);
  const net = buyTotal - sellTotal;
  const hasItems = buyCart.length > 0 || sellCart.length > 0;

  return (
    <div className="flex flex-col gap-3 shrink-0 w-60 sticky top-4">
      {/* Buy cart */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-700 text-[10px] text-amber-400 uppercase tracking-wider font-semibold">
          🛒 Buying
        </div>
        {buyCart.length === 0 ? (
          <p className="px-3 py-3 text-[10px] text-gray-600">Click items above to add</p>
        ) : (
          <div className="divide-y divide-gray-700/50 max-h-48 overflow-y-auto">
            {buyCart.map((ci) => {
              const def = ITEMS[ci.entry.itemDefId as ItemId];
              return (
                <div key={ci.entry.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-200 truncate">{def?.name ?? ci.entry.itemDefId}</div>
                    <div className="text-[10px] text-amber-300 tabular-nums">
                      ×{ci.qty} · 💎 {ci.entry.sellPrice * ci.qty}
                    </div>
                  </div>
                  <button onClick={() => onRemoveBuy(ci.entry.id)} className="text-gray-600 hover:text-red-400 text-xs shrink-0">✕</button>
                </div>
              );
            })}
          </div>
        )}
        {buyCart.length > 0 && (
          <div className="px-3 py-2 border-t border-gray-700 text-right text-xs tabular-nums text-amber-300">
            Total: 💎 {buyTotal}
          </div>
        )}
      </div>

      {/* Sell cart */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-700 text-[10px] text-sky-400 uppercase tracking-wider font-semibold">
          💰 Selling
        </div>
        {sellCart.length === 0 ? (
          <p className="px-3 py-3 text-[10px] text-gray-600">Click your items below to add</p>
        ) : (
          <div className="divide-y divide-gray-700/50 max-h-48 overflow-y-auto">
            {sellCart.map((ci) => {
              const def = ITEMS[ci.instance.itemDefId as ItemId];
              return (
                <div key={ci.instance.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-200 truncate">{def?.name ?? ci.instance.itemDefId}</div>
                    <div className="text-[10px] text-sky-300 tabular-nums">💎 {ci.stockEntry.buyPrice}</div>
                  </div>
                  <button onClick={() => onRemoveSell(ci.instance.id)} className="text-gray-600 hover:text-red-400 text-xs shrink-0">✕</button>
                </div>
              );
            })}
          </div>
        )}
        {sellCart.length > 0 && (
          <div className="px-3 py-2 border-t border-gray-700 text-right text-xs tabular-nums text-sky-300">
            Total: 💎 {sellTotal}
          </div>
        )}
      </div>

      {/* Net + Confirm */}
      {hasItems && (
        <div className="bg-gray-800 rounded-xl p-3 space-y-3">
          <div className="text-xs text-gray-400">
            Net:{' '}
            {net === 0 ? (
              <span className="text-gray-300 font-semibold">No cost</span>
            ) : net > 0 ? (
              <span className="text-red-400 font-semibold">Pay 💎 {net}</span>
            ) : (
              <span className="text-green-400 font-semibold">Receive 💎 {Math.abs(net)}</span>
            )}
          </div>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="w-full py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition bg-amber-700 hover:bg-amber-600 text-amber-100 disabled:opacity-50"
          >
            {confirming ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const { token } = useAuth();
  const { heroHomeCityId, heroItems, baseItems, fetchHeroItems, notifyReportRefresh } =
    useGameInventory();

  const [vendors,    setVendors]    = useState<VendorWithStock[]>([]);
  const [activeTab,  setActiveTab]  = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');

  // ── Carts ──────────────────────────────────────────────────────────────────
  const [buyCart,  setBuyCart]  = useState<BuyCartItem[]>([]);
  const [sellCart, setSellCart] = useState<SellCartItem[]>([]);

  // Clear carts when switching vendor
  useEffect(() => { setBuyCart([]); setSellCart([]); }, [activeTab]);

  // ── Fetchers ───────────────────────────────────────────────────────────────

  const fetchVendors = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<VendorWithStock[]>('/vendors', { token });
      setVendors(data);
      if (!activeTab && data.length > 0) setActiveTab(data[0].id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  function flash(msg: string, isError = false) {
    if (isError) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 5000);
  }

  // ── Cart actions ───────────────────────────────────────────────────────────

  const addToBuyCart = useCallback((entry: VendorStockEntry) => {
    setBuyCart((prev) => {
      const existing = prev.find((i) => i.entry.id === entry.id);
      const currentQty = existing?.qty ?? 0;
      if (currentQty >= entry.currentStock) return prev;
      if (existing) return prev.map((i) => i.entry.id === entry.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { entry, qty: 1 }];
    });
  }, []);

  const removeFromBuyCart  = useCallback((entryId: string)    => setBuyCart((p)  => p.filter((i) => i.entry.id    !== entryId)),    []);
  const removeFromSellCart = useCallback((instanceId: string) => setSellCart((p) => p.filter((i) => i.instance.id !== instanceId)), []);

  const addToSellCart = useCallback((instance: ItemInstance, vendor: VendorWithStock) => {
    setSellCart((prev) => {
      if (prev.some((i) => i.instance.id === instance.id)) return prev;
      const stockEntry = vendor.stock.find((s) => s.itemDefId === instance.itemDefId);
      if (!stockEntry || stockEntry.buyPrice <= 0) return prev;
      return [...prev, { instance, stockEntry }];
    });
  }, []);

  // ── Confirm ────────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!heroHomeCityId || !activeTab) { flash('No base found', true); return; }
    if (buyCart.length === 0 && sellCart.length === 0) return;
    setConfirming(true);
    try {
      for (const ci of buyCart) {
        for (let i = 0; i < ci.qty; i++) {
          await apiFetch('/vendors/buy', {
            method: 'POST', token: token!,
            body: JSON.stringify({ cityId: heroHomeCityId, vendorId: activeTab, itemDefId: ci.entry.itemDefId, quantity: 1 }),
          });
        }
      }
      for (const ci of sellCart) {
        await apiFetch('/vendors/sell', {
          method: 'POST', token: token!,
          body: JSON.stringify({ cityId: heroHomeCityId, vendorId: activeTab, itemInstanceId: ci.instance.id }),
        });
      }
      flash('Transaction complete — check activity reports');
      setBuyCart([]);
      setSellCart([]);
      fetchVendors();
      fetchHeroItems();
      notifyReportRefresh();
    } catch (e: any) {
      flash(e.message, true);
    } finally {
      setConfirming(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeVendor = useMemo(
    () => vendors.find((v) => v.id === activeTab) ?? null,
    [vendors, activeTab],
  );

  const sellableItems = useMemo(
    () =>
      [...heroItems, ...baseItems].filter(
        (it) =>
          it.location !== 'hero_equipped' &&
          it.location !== 'market_listing' &&
          it.location !== 'activity_report' &&
          it.itemDefId !== 'market_voucher',
      ),
    [heroItems, baseItems],
  );

  const vendorBuysDefIds = useMemo(
    () => new Set(activeVendor?.stock.filter((s) => s.buyPrice > 0).map((s) => s.itemDefId) ?? []),
    [activeVendor],
  );

  const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

  const sortedSellableItems = useMemo(() => {
    return sellableItems
      .filter((it) => vendorBuysDefIds.has(it.itemDefId))
      .sort((a, b) => {
        const defA = ITEMS[a.itemDefId as ItemId];
        const defB = ITEMS[b.itemDefId as ItemId];
        const rankA = defA ? (RARITY_RANK[defA.rarity] ?? 99) : 99;
        const rankB = defB ? (RARITY_RANK[defB.rarity] ?? 99) : 99;
        if (rankA !== rankB) return rankA - rankB;
        const nameA = defA?.name ?? a.itemDefId;
        const nameB = defB?.name ?? b.itemDefId;
        return nameA.localeCompare(nameB);
      });
  }, [sellableItems, vendorBuysDefIds]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-5">
      {/* ── Header card ── */}
      <div className="bg-gray-800 rounded-xl p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">🏪 Vendors</h1>
          <p className="text-gray-500 text-xs mt-1">
            NPC traders · Shared stock across all players · Restocks over time
          </p>
        </div>
        <button
          onClick={fetchVendors}
          className="text-xs text-gray-500 hover:text-amber-400 uppercase tracking-wider transition"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Flash messages ── */}
      {error   && <div className="px-4 py-2 bg-red-900/30 border border-red-800/50 rounded-xl text-red-400 text-xs">{error}</div>}
      {success && <div className="px-4 py-2 bg-green-900/30 border border-green-800/50 rounded-xl text-green-400 text-xs">{success}</div>}

      {loading && <p className="text-gray-600 text-xs text-center py-12">Loading vendors…</p>}

      {!loading && vendors.length > 0 && (
        <>
          {/* ── Vendor nav ── */}
          <div className="flex gap-1 bg-gray-800/50 p-1 rounded-xl">
            {vendors.map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveTab(v.id)}
                className={[
                  'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                  activeTab === v.id
                    ? 'bg-gray-700 text-white shadow'
                    : 'text-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                {v.name}
              </button>
            ))}
          </div>

          {activeVendor && (
            <div className="flex gap-4 items-start">
              {/* ── Left column: Buy + Sell stacked ── */}
              <div className="flex-1 min-w-0 space-y-4">

                {/* BUY — vendor stock */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 px-1">
                    Buy — click to add to cart
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {activeVendor.stock.map((entry) => {
                      const cartQty = buyCart.find((i) => i.entry.id === entry.id)?.qty ?? 0;
                      return (
                        <StockCard
                          key={entry.id}
                          entry={entry}
                          cartQty={cartQty}
                          onAdd={() => addToBuyCart(entry)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* SELL — player's items */}
                <div className="bg-gray-800 rounded-xl">
                  <div className="px-4 py-3 border-b border-gray-700 rounded-t-xl">
                    <p className="text-sm font-semibold text-gray-300">Sell — your items</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Only items this vendor buys ·{' '}
                      <span className="text-sky-400">highlighted</span> = in cart
                    </p>
                  </div>
                  {sortedSellableItems.length === 0 ? (
                    <p className="px-4 py-6 text-xs text-gray-600 text-center">No matching items in inventory.</p>
                  ) : (
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {sortedSellableItems.map((it) => {
                        const inCart = sellCart.some((s) => s.instance.id === it.id);
                        return (
                          <PlayerItemCard
                            key={it.id}
                            instance={it}
                            canSell={true}
                            inCart={inCart}
                            onClick={() => {
                              if (inCart) removeFromSellCart(it.id);
                              else addToSellCart(it, activeVendor);
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* ── Right column: Cart (sticky) ── */}
              <CartPanel
                buyCart={buyCart}
                sellCart={sellCart}
                onRemoveBuy={removeFromBuyCart}
                onRemoveSell={removeFromSellCart}
                onConfirm={handleConfirm}
                confirming={confirming}
              />
            </div>
          )}
        </>
      )}

      {!loading && vendors.length === 0 && (
        <p className="text-gray-600 text-xs text-center py-12">No vendors available.</p>
      )}
    </div>
  );
}
