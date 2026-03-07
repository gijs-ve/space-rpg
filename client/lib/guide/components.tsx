/**
 * Guide component kit — `G.*`
 *
 * All shared primitives for writing guide chapters.
 * Import once per chapter file:
 *
 *   import * as G from '@/lib/guide/components';
 *
 * ─────────────────────────────────────────────────────────────
 * Available components
 * ─────────────────────────────────────────────────────────────
 *
 *  <G.Section>           Wrapper with standard spacing / font defaults.
 *  <G.P>                 Body paragraph.
 *  <G.Strong>            Highlighted inline term (bright white).
 *  <G.Formula>           Monospace formula / code block. Accepts string or JSX lines.
 *  <G.Tip label="…">    Amber strategy-tip callout. label defaults to "Tip".
 *  <G.Note>              Small muted footnote / caveat.
 *  <G.Table headers      Standard data table.
 *        colors?>
 *  <G.Row>               Table body row — goes inside <G.Table>.
 *  <G.Term color?>       First-column colored semibold cell inside a <G.Row>.
 *  <G.Cell color?>       Generic colored cell (other columns).
 */

import React from 'react';

type TermColor = 'amber' | 'sky' | 'green' | 'purple' | 'red' | 'orange' | 'gray';

const TERM_COLORS: Record<TermColor, string> = {
  amber:  'text-amber-300',
  sky:    'text-sky-300',
  green:  'text-green-300',
  purple: 'text-purple-300',
  red:    'text-red-400',
  orange: 'text-orange-400',
  gray:   'text-gray-500',
};

// ── Section wrapper ──────────────────────────────────────────────────────────

export function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
      {children}
    </div>
  );
}

// ── Body paragraph ───────────────────────────────────────────────────────────

export function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

// ── Inline emphasis ──────────────────────────────────────────────────────────

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-gray-100">{children}</strong>;
}

// ── Formula / code block ─────────────────────────────────────────────────────

export function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-900/70 rounded-lg px-4 py-3 font-mono text-xs text-gray-300 border border-gray-800 space-y-1">
      {children}
    </div>
  );
}

// ── Tip callout ──────────────────────────────────────────────────────────────

interface TipProps {
  label?: string;
  children: React.ReactNode;
}

export function Tip({ label = 'Tip', children }: TipProps) {
  return (
    <div className="bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2 text-xs text-amber-300/80">
      {label && <strong>{label}: </strong>}
      {children}
    </div>
  );
}

// ── Muted footnote ───────────────────────────────────────────────────────────

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-500">{children}</p>;
}

// ── Table ────────────────────────────────────────────────────────────────────

interface TableProps {
  /** Column header labels */
  headers: string[];
  children: React.ReactNode;
}

export function Table({ headers, children }: TableProps) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="text-gray-500 uppercase tracking-widest text-left">
          {headers.map((h, i) => (
            <th key={i} className={`pb-1 ${i < headers.length - 1 ? 'pr-4' : ''}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-800">{children}</tbody>
    </table>
  );
}

// ── Table row ────────────────────────────────────────────────────────────────

export function Row({ children }: { children: React.ReactNode }) {
  return <tr>{children}</tr>;
}

// ── Colored term cell (first column) ─────────────────────────────────────────

interface TermProps {
  color?: TermColor;
  children: React.ReactNode;
}

export function Term({ color = 'amber', children }: TermProps) {
  return (
    <td className={`py-1 pr-4 font-semibold ${TERM_COLORS[color]}`}>
      {children}
    </td>
  );
}

// ── Generic colored cell ─────────────────────────────────────────────────────

interface CellProps {
  color?: TermColor;
  /** Whether to add right padding (not the last column) */
  pad?: boolean;
  children: React.ReactNode;
}

export function Cell({ color, pad = false, children }: CellProps) {
  const colorClass = color ? TERM_COLORS[color] : 'text-gray-400';
  return (
    <td className={`py-1 ${pad ? 'pr-4' : ''} ${colorClass}`}>
      {children}
    </td>
  );
}
