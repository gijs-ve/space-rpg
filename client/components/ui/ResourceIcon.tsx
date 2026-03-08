'use client';

import React from 'react';
import { RESOURCE_LABELS, SKILLS } from '@rpg/shared';
import type { ResourceType, SkillId } from '@rpg/shared';

// ─── Shared internal sprite icon ──────────────────────────────────────────────

interface SpriteIconProps {
  src: string;
  iconCount: number;
  index: number;
  label: string;
  size?: number;
  /** Which side to show the tooltip. Default 'above'. Use 'below' near the top of the screen. */
  placement?: 'above' | 'below';
  /** Set to false to suppress the hover tooltip entirely. Default true. */
  showTooltip?: boolean;
  className?: string;
}

function SpriteIcon({ src, iconCount, index, label, size = 16, placement = 'above', showTooltip = true, className = '' }: SpriteIconProps) {
  const tooltipCls = placement === 'below'
    ? 'pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap rounded bg-gray-900 border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-200 shadow-lg opacity-0 group-hover/gi:opacity-100 transition-opacity z-[200]'
    : 'pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-gray-900 border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-200 shadow-lg opacity-0 group-hover/gi:opacity-100 transition-opacity z-[200]';

  return (
    <span
      className={`relative inline-block shrink-0 group/gi ${className}`}
      style={{
        width:              size,
        height:             size,
        backgroundImage:    `url('${src}')`,
        backgroundSize:     `${size * iconCount}px ${size}px`,
        backgroundPosition: `${-index * size}px 0`,
        backgroundRepeat:   'no-repeat',
        verticalAlign:      'middle',
      }}
      aria-label={label}
      role="img"
    >
      {showTooltip && <span className={tooltipCls}>{label}</span>}
    </span>
  );
}

// ─── ResourceIcon ─────────────────────────────────────────────────────────────
// resource-icons.svg: 192×32, 6 icons.  rations=0 water=1 ore=2 iron=3 wood=4 gold=5
// Sprite positions are fixed to the original sheet order regardless of RESOURCE_TYPES ordering.

const RESOURCE_INDEX: Record<ResourceType, number> = {
  rations: 0,
  water:   1,
  ore:     2,
  iron:  3,
  wood:    4,
  gold: 5,
};

interface ResourceIconProps {
  type: ResourceType;
  size?: number;
  placement?: 'above' | 'below';
  showTooltip?: boolean;
  className?: string;
}

export function ResourceIcon({ type, size = 16, placement = 'above', showTooltip = true, className = '' }: ResourceIconProps) {
  return (
    <SpriteIcon
      src="/icons/resource-icons.svg"
      iconCount={6}
      index={RESOURCE_INDEX[type] ?? 0}
      label={RESOURCE_LABELS[type] ?? type}
      size={size}
      placement={placement}
      showTooltip={showTooltip}
      className={className}
    />
  );
}

// ─── StatIcon ─────────────────────────────────────────────────────────────────
// stat-icons.svg: 192×32, 6 icons.  attack=0 defense=1 maxEnergy=2 maxHealth=3 gathering=4 speed=5

export type StatType = 'attack' | 'defense' | 'maxEnergy' | 'maxHealth' | 'gathering' | 'speed';

const STAT_INDEX: Record<StatType, number> = {
  attack:    0,
  defense:   1,
  maxEnergy: 2,
  maxHealth: 3,
  gathering: 4,
  speed:     5,
};

const STAT_LABELS: Record<StatType, string> = {
  attack:    'Attack',
  defense:   'Defense',
  maxEnergy: 'Max Energy',
  maxHealth: 'Max Health',
  gathering: 'Gathering',
  speed:     'Adv. Speed',
};

interface StatIconProps {
  type: StatType;
  size?: number;
  placement?: 'above' | 'below';
  showTooltip?: boolean;
  className?: string;
}

export function StatIcon({ type, size = 16, placement = 'above', showTooltip = true, className = '' }: StatIconProps) {
  return (
    <SpriteIcon
      src="/icons/stat-icons.svg"
      iconCount={6}
      index={STAT_INDEX[type] ?? 0}
      label={STAT_LABELS[type] ?? type}
      size={size}
      placement={placement}
      showTooltip={showTooltip}
      className={className}
    />
  );
}

// ─── SkillIcon ────────────────────────────────────────────────────────────────
// skill-icons.svg: 160×32, 5 icons.  combat=0 endurance=1 observation=2 navigation=3 tactics=4

const SKILL_INDEX: Partial<Record<SkillId, number>> = {
  combat:      0,
  endurance:   1,
  observation: 2,
  navigation:  3,
  tactics:     4,
};

interface SkillIconProps {
  skill: SkillId;
  size?: number;
  placement?: 'above' | 'below';
  showTooltip?: boolean;
  className?: string;
}

export function SkillIcon({ skill, size = 16, placement = 'above', showTooltip = true, className = '' }: SkillIconProps) {
  return (
    <SpriteIcon
      src="/icons/skill-icons.svg"
      iconCount={5}
      index={SKILL_INDEX[skill] ?? 0}
      label={SKILLS[skill]?.name ?? skill}
      size={size}
      placement={placement}
      showTooltip={showTooltip}
      className={className}
    />
  );
}

// ─── ResourceAmount ───────────────────────────────────────────────────────────

interface ResourceAmountProps {
  type: ResourceType;
  amount: number;
  /** Icon size in px. Default 14. */
  size?: number;
  /** Show +/- prefix. Default false. */
  signed?: boolean;
  className?: string;
  amountClassName?: string;
}

/**
 * Sprite icon + formatted amount inline.
 * Example: <ResourceAmount type="iron" amount={100} signed />  → [alloy icon] +100
 */
export function ResourceAmount({
  type,
  amount,
  size = 14,
  signed = false,
  className = '',
  amountClassName = '',
}: ResourceAmountProps) {
  const label    = RESOURCE_LABELS[type] ?? type;
  const abs      = Math.floor(Math.abs(amount));
  const prefix   = signed ? (amount >= 0 ? '+' : '−') : '';
  const negative = signed && amount < 0;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <ResourceIcon type={type} size={size} />
      <span
        className={`tabular-nums ${negative ? 'text-red-400' : ''} ${amountClassName}`}
        title={label}
      >
        {prefix}{abs.toLocaleString()}
      </span>
    </span>
  );
}
