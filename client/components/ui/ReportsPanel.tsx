'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { useGameInventory } from '@/context/inventory';
import { getSocket } from '@/lib/socket';
import { canPlaceClient } from '@/components/inventory/InventoryGrid';
import {
  ACTIVITY_NAMES,
  ITEMS,
  RESOURCE_LABELS,
  ITEM_RARITY_COLOR,
  ITEM_CATEGORY_ICON,
  HERO_INVENTORY_COLS,
  HERO_INVENTORY_ROWS,
} from '@rpg/shared';
import { ResourceAmount, SkillIcon } from '@/components/ui/ResourceIcon';
import Modal from '@/components/ui/Modal';
import type {
  ActivityReport,
  ItemId,
  ItemInstance,
  ResourceType,
  SkillId,
} from '@rpg/shared';

// ─── Time-ago helper ──────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// ─── Client-side inventory fitness check ─────────────────────────────────────
// Simulates placing each unclaimed item one by one (unrotated first, then
// rotated as fallback). Returns true only if every item can fit.

function canAllFitInInventory(
  inventoryItems: ItemInstance[],
  unclaimedItems: ItemInstance[],
): boolean {
  const sim = [...inventoryItems];
  for (const item of unclaimedItems) {
    const def = ITEMS[item.itemDefId as ItemId];
    if (!def) continue; // unknown item — assume fits
    let placed = false;

    // Try upright
    outerUpright:
    for (let y = 0; y < HERO_INVENTORY_ROWS; y++) {
      for (let x = 0; x < HERO_INVENTORY_COLS; x++) {
        if (canPlaceClient(HERO_INVENTORY_COLS, HERO_INVENTORY_ROWS, sim,
          { width: def.width, height: def.height, gridX: x, gridY: y })) {
          sim.push({ ...item, gridX: x, gridY: y, rotated: false, location: 'hero_inventory' });
          placed = true;
          break outerUpright;
        }
      }
    }

    if (!placed) {
      // Try rotated
      outerRotated:
      for (let y = 0; y < HERO_INVENTORY_ROWS; y++) {
        for (let x = 0; x < HERO_INVENTORY_COLS; x++) {
          if (canPlaceClient(HERO_INVENTORY_COLS, HERO_INVENTORY_ROWS, sim,
            { width: def.height, height: def.width, gridX: x, gridY: y })) {
            sim.push({ ...item, gridX: x, gridY: y, rotated: true, location: 'hero_inventory' });
            placed = true;
            break outerRotated;
          }
        }
      }
    }

    if (!placed) return false;
  }
  return true;
}

// ─── Expanded report body ─────────────────────────────────────────────────────

function ReportDetail({
  report,
  token,
  onDismiss,
  onClaimed,
  onDeposited,
  animate,
}: {
  report:     ActivityReport;
  token:      string;
  onDismiss:  () => void;
  onClaimed:  () => void;
  onDeposited: () => void;
  animate:    boolean;
}) {
  const { heldItem, setHeldItem, heroItems, fetchHeroItems, heroHomeCityId, heroHomeCityName } = useGameInventory();
  const [claiming,   setClaiming]   = useState(false);
  const [claimed,    setClaimed]    = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [deposited,  setDeposited]  = useState(report.resourcesClaimed);

  const resources      = (report.resources ?? {}) as Record<ResourceType, number>;
  const hasResources   = Object.values(resources).some((v) => (v as number) > 0);
  const unclaimedItems = report.items.filter((it) => it.location === 'activity_report');

  // Current hero inventory items (for the fitness simulation)
  const inventoryItems = useMemo(
    () => heroItems.filter((i) => i.location === 'hero_inventory'),
    [heroItems],
  );

  const canAutoPickUp = useMemo(
    () => !claimed && unclaimedItems.length > 0 && canAllFitInInventory(inventoryItems, unclaimedItems),
    [claimed, unclaimedItems, inventoryItems],
  );

  // Staggered pop-in helper — each call increments the delay slot
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _animIdx = 0;
  const pop = (): React.CSSProperties =>
    animate
      ? { opacity: 0, animation: 'pop-in 0.28s ease forwards', animationDelay: `${_animIdx++ * 75}ms` }
      : {};

  const handleAutoPickUp = async () => {
    if (!unclaimedItems.length) return;
    setClaiming(true);
    try {
      await apiFetch(`/activity-reports/${report.id}/claim-all`, {
        method: 'POST',
        token,
        body: JSON.stringify({}),
      });
      await fetchHeroItems();
      setClaimed(true);
      onClaimed();
    } catch { /* ignore */ }
    setClaiming(false);
  };

  const handleDismiss = async () => {
    // Cancel any held item from this report before dismissing
    if (heldItem?.source === 'activity_report' && heldItem.reportId === report.id) {
      setHeldItem(null);
    }
    try {
      await apiFetch(`/activity-reports/${report.id}/dismiss`, {
        method: 'POST',
        token,
        body: JSON.stringify({}),
      });
      onDismiss();
    } catch { /* ignore */ }
  };

  const handleDepositResources = async () => {
    if (!heroHomeCityId) return;
    setDepositing(true);
    try {
      await apiFetch(`/activity-reports/${report.id}/claim-resources`, {
        method: 'POST',
        token,
        body: JSON.stringify({}),
      });
      setDeposited(true);
      onDeposited();
    } catch { /* ignore */ }
    setDepositing(false);
  };

  return (
    <div className="pt-2 pb-1 space-y-2 border-t border-gray-800 mt-1">
      {/* XP */}
      {report.xpAwarded > 0 && (
        <p className="text-amber-400 text-xs font-semibold" style={pop()}>
          +{report.xpAwarded.toLocaleString()} XP
        </p>
      )}

      {/* Damage taken */}
      {(report.damageTaken ?? 0) > 0 && (
        <p className="text-red-400 text-xs font-semibold" style={pop()}>
          💔 −{report.damageTaken} HP
        </p>
      )}

      {/* Skill XP */}
      {Object.entries(report.skillXpAwarded ?? {})
        .filter(([, v]) => (v as number) > 0)
        .map(([skillId, xp]) => (
          <div key={skillId} className="flex items-center gap-1 text-sky-400 text-[11px]" style={pop()}>
            <SkillIcon skill={skillId as SkillId} size={14} />
            <span>+{(xp as number).toLocaleString()} XP</span>
          </div>
        ))}

      {/* Resources */}
      {Object.entries(resources)
        .filter(([, v]) => (v as number) > 0)
        .map(([key, val]) => (
          <p key={key} className="text-gray-300 text-[11px]" style={pop()}>
            <ResourceAmount type={key as ResourceType} amount={val as number} size={12} signed />
          </p>
        ))}

      {/* Resource deposit action */}
      {hasResources && (
        <div className="flex items-center gap-1.5" style={pop()}>
          {deposited ? (
            <span className="text-[10px] text-teal-500">✓ Deposited to {heroHomeCityName ?? 'base'}</span>
          ) : heroHomeCityId ? (
            <button
              disabled={depositing}
              className="text-[10px] py-0.5 px-2 rounded bg-blue-900/50 hover:bg-blue-900/80 text-blue-300 border border-blue-900/60 transition active:scale-95 disabled:opacity-50"
              onClick={handleDepositResources}
            >
              {depositing ? '…' : `⬆ Deposit to ${heroHomeCityName ?? 'base'}`}
            </button>
          ) : (
            <span className="text-[10px] text-gray-600 italic">Found a base to claim resources</span>
          )}
        </div>
      )}

      {/* Items */}
      {report.items.length > 0 && (
        <div style={pop()}>
          <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1 font-semibold">
            Items
          </p>
          <div className="flex flex-wrap gap-1">
            {report.items.map((item) => {
              const def        = ITEMS[item.itemDefId as ItemId];
              if (!def) return null;
              const isClaimed  = item.location !== 'activity_report';
              const isHeld     = heldItem?.instance.id === item.id;
              const isPickable = !isClaimed && !claimed && heldItem === null;

              return (
                <div
                  key={item.id}
                  title={isClaimed ? `${def.name} (claimed)` : def.name}
                  className={[
                    'flex items-center justify-center rounded text-base select-none transition-all',
                    isPickable ? 'cursor-grab hover:brightness-125 active:scale-95' : '',
                    isHeld     ? 'cursor-pointer ring-1 ring-amber-400'             : '',
                  ].join(' ')}
                  style={{
                    width:      34,
                    height:     34,
                    background: isClaimed ? '#1a1a1a' : 'rgba(255,255,255,0.05)',
                    border:     `1px solid ${isClaimed ? '#333' : ITEM_RARITY_COLOR[def.rarity]}`,
                    opacity:    isClaimed || isHeld ? 0.35 : 1,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Clicking a held item cancels the pickup
                    if (isHeld) { setHeldItem(null); return; }
                    if (!isPickable) return;
                    setHeldItem({
                      instance:        item,
                      effectiveWidth:  def.width,
                      effectiveHeight: def.height,
                      rotated:         false,
                      source:          'activity_report',
                      reportId:        report.id,
                    });
                  }}
                >
                  {ITEM_CATEGORY_ICON[def.category]}
                </div>
              );
            })}
          </div>

          {/* Pick-up hint */}
          {unclaimedItems.length > 0 && !claimed && (
            <p className="text-[9px] text-gray-700 mt-1 leading-tight">
              {heldItem?.source === 'activity_report' && heldItem.reportId === report.id
                ? '↓ Drop in inventory · [R] rotate · [Esc] cancel'
                : 'Click item to pick up manually'}
            </p>
          )}
        </div>
      )}

      {/* No rewards at all */}
      {report.xpAwarded === 0 &&
        Object.values(resources).every((v) => !v) &&
        report.items.length === 0 && (
          <p className="text-gray-600 text-[11px] italic">No rewards.</p>
        )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-1">
        {unclaimedItems.length > 0 && !claimed && (
          <>
            {canAutoPickUp ? (
              <button
                disabled={claiming}
                className="flex-1 text-[10px] py-1 rounded bg-teal-900/50 hover:bg-teal-900/80 text-teal-300 border border-teal-900 transition active:scale-95 disabled:opacity-50"
                onClick={handleAutoPickUp}
              >
                {claiming ? '…' : 'Auto pick up'}
              </button>
            ) : (
              <span
                className="flex-1 text-[10px] py-1 text-center text-gray-700"
                title="Not enough space in inventory"
              >
                Inventory full
              </span>
            )}
          </>
        )}
        {claimed && (
          <span className="flex-1 text-[10px] text-teal-500 text-center">✓ Picked up</span>
        )}
        <button
          className="flex-1 text-[10px] py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-500 border border-gray-800 transition active:scale-95"
          onClick={handleDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─── Report row (compact feed item) ─────────────────────────────────────────

function ReportRow({
  report,
  onOpen,
}: {
  report: ActivityReport;
  onOpen: () => void;
}) {
  const actName        = ACTIVITY_NAMES[report.activityType] ?? report.activityType;
  const unclaimedCount = report.items.filter((i) => i.location === 'activity_report').length;
  const hasResources   = !report.resourcesClaimed &&
    Object.values((report.resources ?? {}) as Record<string, number>).some((v) => v > 0);

  return (
    <button
      className={[
        'w-full text-left rounded border bg-gray-900/40 shrink-0 px-2 py-1.5',
        'flex items-start gap-1.5 hover:bg-gray-800/40 transition active:scale-[0.99]',
        unclaimedCount > 0 || hasResources ? 'border-teal-800/60' : 'border-gray-800',
      ].join(' ')}
      onClick={onOpen}
    >
      {/* Unread dot */}
      <span
        className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full"
        style={{ background: report.viewed ? 'transparent' : '#f59e0b' }}
      />

      <div className="flex-1 min-w-0">
        <p className={`text-[11px] leading-tight truncate ${report.viewed ? 'text-gray-400' : 'text-white font-semibold'}`}>
          {actName}
        </p>
        {(report.heroName || report.cityName) && (
          <p className="text-[9px] flex flex-wrap gap-x-2 mt-0.5">
            {report.heroName && (
              <span className="text-indigo-400">⚔ {report.heroName}</span>
            )}
            {report.cityName && (
              <span className="text-emerald-600">🏰 {report.cityName}</span>
            )}
          </p>
        )}
        <p className="text-[9px] text-gray-700 mt-0.5 flex items-center gap-1.5 flex-wrap">
          {timeAgo(report.completedAt)}
          {unclaimedCount > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-teal-900/60 border border-teal-700/50 text-teal-300 font-semibold leading-none">
              📦 {unclaimedCount} item{unclaimedCount !== 1 ? 's' : ''}
            </span>
          )}
          {hasResources && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-900/50 border border-amber-700/50 text-amber-300 font-semibold leading-none">
              ⚡ resources
            </span>
          )}
        </p>
      </div>

      {/* Open hint */}
      <span className="text-gray-700 text-[10px] mt-0.5 shrink-0">›</span>
    </button>
  );
}

// ─── ReportsPanel ─────────────────────────────────────────────────────────────

export default function ReportsPanel() {
  const { token } = useAuth();
  const { reportRefreshSignal } = useGameInventory();
  const [reports,      setReports]      = useState<ActivityReport[]>([]);
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<ActivityReport[]>('/activity-reports', { token });
      setReports(data);
    } catch { /* non-fatal */ }
  }, [token]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // Re-fetch whenever a manual drag-to-inventory claim happens
  useEffect(() => {
    if (reportRefreshSignal > 0) fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportRefreshSignal]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on('adventure:complete', fetchReports);
    return () => { socket.off('adventure:complete', fetchReports); };
  }, [fetchReports]);

  const removeReport = useCallback((id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    setOpenReportId(null);
  }, []);

  const openReport = useCallback((report: ActivityReport) => {
    setOpenReportId(report.id);
    // Mark as viewed
    if (!report.viewed && token) {
      apiFetch(`/activity-reports/${report.id}/view`, {
        method: 'POST',
        token,
        body: JSON.stringify({}),
      })
        .then(() => setReports((prev) =>
          prev.map((r) => r.id === report.id ? { ...r, viewed: true } : r),
        ))
        .catch(() => {});
    }
  }, [token]);

  const unreadCount = reports.filter((r) => !r.viewed).length;

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-2">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <p
          className="uppercase tracking-[0.18em] text-[10px] font-semibold"
          style={{ color: 'var(--hud-border)' }}
        >
          Reports
        </p>
        {unreadCount > 0 && (
          <span className="text-[9px] font-bold text-amber-400 bg-amber-900/40 border border-amber-800/60 rounded-full px-1.5 py-0.5 leading-none">
            {unreadCount}
          </span>
        )}
      </div>

      {reports.length === 0 ? (
        <p className="text-gray-700 italic text-[11px]">No reports.</p>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-y-auto min-h-0 flex-1">
          {reports.slice(0, 30).map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              onOpen={() => openReport(r)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {openReportId && (() => {
        const report = reports.find((r) => r.id === openReportId);
        if (!report) return null;
        const actName = ACTIVITY_NAMES[report.activityType] ?? report.activityType;
        const subtitle = [report.heroName, report.cityName].filter(Boolean).join(' · ');
        return (
          <Modal
            title={subtitle ? `${actName} — ${subtitle}` : actName}
            onClose={() => setOpenReportId(null)}
          >
            <ReportDetail
              report={report}
              token={token ?? ''}
              onDismiss={() => removeReport(report.id)}
              onClaimed={fetchReports}
              onDeposited={() =>
                setReports((prev) =>
                  prev.map((r) => r.id === report.id ? { ...r, resourcesClaimed: true } : r),
                )
              }
              animate={!report.viewed}
            />
          </Modal>
        );
      })()}
    </div>
  );
}
