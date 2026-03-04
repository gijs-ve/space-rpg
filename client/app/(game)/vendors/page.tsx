'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { useGameInventory } from '@/context/inventory';
import { ITEMS, ITEM_RARITY_COLOR } from '@rpg/shared';
import type { VendorWithStock, VendorStockEntry, ItemId } from '@rpg/shared';

// ─── Countdown helper ─────────────────────────────────────────────────────────

function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatRestockTime(lastRestockedAt: string, intervalMinutes: number): string {
  const last = new Date(lastRestockedAt).getTime();
  const next = last + intervalMinutes * 60_000;
  const diff = next - Date.now();
  if (diff <= 0) return 'Restocking…';
  const m = Math.floor(diff / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Stock Row ────────────────────────────────────────────────────────────────

function StockRow({
  entry,
  onBuy,
  onSell,
  listableItemsForEntry,
}: {
  entry: VendorStockEntry;
  onBuy: (entry: VendorStockEntry) => void;
  onSell: (entry: VendorStockEntry, itemInstanceId: string) => void;
  listableItemsForEntry: { id: string; location: string }[];
}) {
  const now = useNow();
  const [selectedItem, setSelectedItem] = useState('');

  const def = ITEMS[entry.itemDefId as ItemId];
  if (!def) return null;

  const color = ITEM_RARITY_COLOR[def.rarity];
  const stockPct = entry.maxStock > 0 ? (entry.currentStock / entry.maxStock) * 100 : 0;

  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-gray-900 hover:bg-gray-900/30 transition">
      {/* Item info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span style={{ color }} className="font-semibold text-xs truncate">{def.name}</span>
          <span className="text-gray-600 text-[10px] capitalize">{def.rarity}</span>
        </div>
        <div className="text-gray-600 text-[10px] truncate">{def.description}</div>
      </div>

      {/* Stock bar */}
      <div className="w-24 text-center">
        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
          <div
            className="h-full bg-amber-600 transition-all"
            style={{ width: `${stockPct}%` }}
          />
        </div>
        <span className="text-[10px] tabular-nums text-gray-500">
          {entry.currentStock}/{entry.maxStock}
        </span>
      </div>

      {/* Restock timer */}
      <div className="w-20 text-[10px] text-gray-600 text-center tabular-nums">
        {formatRestockTime(entry.lastRestockedAt, entry.restockIntervalMinutes)}
      </div>

      {/* Prices */}
      <div className="text-right w-20">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Buy</div>
        <div className="text-amber-300 text-xs font-mono tabular-nums">💎 {entry.sellPrice}</div>
      </div>
      <div className="text-right w-20">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Sell back</div>
        <div className="text-blue-300 text-xs font-mono tabular-nums">💎 {entry.buyPrice}</div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          disabled={entry.currentStock === 0}
          onClick={() => onBuy(entry)}
          className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded font-semibold transition bg-amber-800/60 hover:bg-amber-700 text-amber-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Buy ×1
        </button>

        {listableItemsForEntry.length > 0 && (
          <div className="flex items-center gap-1">
            <select
              className="bg-gray-900 border border-gray-700 rounded px-1.5 py-1 text-[10px] text-gray-300 focus:outline-none focus:border-amber-600"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
            >
              <option value="">— item —</option>
              {listableItemsForEntry.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.location.replace('_', ' ')}
                </option>
              ))}
            </select>
            <button
              disabled={!selectedItem}
              onClick={() => { if (selectedItem) { onSell(entry, selectedItem); setSelectedItem(''); } }}
              className="px-3 py-1.5 text-[10px] uppercase tracking-wider rounded font-semibold transition bg-sky-900/60 hover:bg-sky-800 text-sky-300 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Sell
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const { token } = useAuth();
  const { heroHomeCityId, heroItems, baseItems, fetchHeroItems, notifyReportRefresh } =
    useGameInventory();

  const [vendors,   setVendors]   = useState<VendorWithStock[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

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
  }, [token]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  function flash(msg: string, isError = false) {
    if (isError) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  }

  const handleBuy = async (vendorId: string, entry: VendorStockEntry) => {
    if (!heroHomeCityId) { flash('No base found', true); return; }
    try {
      await apiFetch('/vendors/buy', {
        method: 'POST', token: token!,
        body: JSON.stringify({ cityId: heroHomeCityId, vendorId, itemDefId: entry.itemDefId, quantity: 1 }),
      });
      flash(`Purchased ${ITEMS[entry.itemDefId as ItemId]?.name ?? entry.itemDefId} — check activity reports`);
      fetchVendors();
      notifyReportRefresh();
    } catch (e: any) { flash(e.message, true); }
  };

  const handleSell = async (vendorId: string, entry: VendorStockEntry, itemInstanceId: string) => {
    if (!heroHomeCityId) { flash('No base found', true); return; }
    try {
      await apiFetch('/vendors/sell', {
        method: 'POST', token: token!,
        body: JSON.stringify({ cityId: heroHomeCityId, vendorId, itemInstanceId }),
      });
      flash(`Sold for 💎 ${entry.buyPrice} — check activity reports`);
      fetchVendors();
      fetchHeroItems();
      notifyReportRefresh();
    } catch (e: any) { flash(e.message, true); }
  };

  const activeVendor = vendors.find((v) => v.id === activeTab);

  // Items the player owns that could be sold to a given vendor stock entry
  const ownedItems = [...heroItems, ...baseItems].filter(
    (it) =>
      it.itemDefId !== 'market_voucher' &&
      it.location !== 'market_listing' &&
      it.location !== 'activity_report',
  );

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
        <div className="flex gap-4 items-start">
          {/* ── Vendor tab list ── */}
          <nav className="shrink-0 w-48 bg-gray-800/50 p-1 rounded-xl space-y-0.5">
            {vendors.map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveTab(v.id)}
                className={[
                  'w-full text-left px-3 py-3 rounded-lg text-xs transition',
                  activeTab === v.id
                    ? 'bg-gray-700 text-white shadow'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/40',
                ].join(' ')}
              >
                <div className="font-semibold leading-tight">{v.name}</div>
                <div className="text-[10px] text-gray-500 mt-0.5 leading-tight line-clamp-2">
                  {v.description}
                </div>
              </button>
            ))}
          </nav>

          {/* ── Selected vendor stock ── */}
          {activeVendor && (
            <div className="flex-1 bg-gray-800 rounded-xl overflow-hidden">
              {/* Column header */}
              <div className="flex items-center gap-4 py-2 px-4 border-b border-gray-700 text-[10px] text-gray-400 uppercase tracking-wider">
                <span className="flex-1">Item</span>
                <span className="w-24 text-center">Stock</span>
                <span className="w-20 text-center">Restock</span>
                <span className="w-20 text-right">Buy</span>
                <span className="w-20 text-right">Sell back</span>
                <span className="w-40 text-right">Actions</span>
              </div>

              {activeVendor.stock.map((entry) => {
                const ownedOfType = ownedItems.filter((it) => it.itemDefId === entry.itemDefId);
                return (
                  <StockRow
                    key={entry.id}
                    entry={entry}
                    onBuy={(e) => handleBuy(activeVendor.id, e)}
                    onSell={(e, itemId) => handleSell(activeVendor.id, e, itemId)}
                    listableItemsForEntry={ownedOfType.map((it) => ({
                      id: it.id,
                      location: it.location,
                    }))}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {!loading && vendors.length === 0 && (
        <p className="text-gray-600 text-xs text-center py-12">No vendors available.</p>
      )}
    </div>
  );
}
