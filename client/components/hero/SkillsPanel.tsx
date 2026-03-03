import React from 'react';
import ProgressBar from '@/components/ui/ProgressBar';
import { SKILLS } from '@rpg/shared';
import type { Hero } from '@rpg/shared';

interface SkillsPanelProps {
  hero: Hero;
}

const SKILL_ICONS: Record<string, string> = {
  combat:     '⚔️',
  endurance:  '🛡️',
  gathering:  '⛏️',
  leadership: '👑',
  tactics:    '🔭',
};

export default function SkillsPanel({ hero }: SkillsPanelProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
        Skills
      </h2>
      <div className="grid grid-cols-5 gap-3">
        {Object.values(SKILLS).map((skill) => {
          const totalXp:  number = hero.skillXp?.[skill.id]              ?? 0;
          const level:    number = Math.max(1, hero.skillLevels?.[skill.id] ?? 1);
          const xpAtLevel  = skill.xpPerLevel.slice(0, level - 1).reduce((s, v) => s + v, 0);
          const xpForNext  = skill.xpPerLevel[level - 1] ?? 1;
          const pct = xpForNext > 0
            ? Math.min(100, ((totalXp - xpAtLevel) / xpForNext) * 100)
            : 0;

          return (
            <div key={skill.id} className="bg-gray-700/60 rounded-lg px-3 py-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-lg leading-none select-none">
                  {SKILL_ICONS[skill.id] ?? '◆'}
                </span>
                <span className="text-[10px] text-amber-400 font-bold tabular-nums">
                  Lv {level}
                </span>
              </div>
              <p className="text-xs text-gray-300 font-medium leading-tight">{skill.name}</p>
              <ProgressBar value={totalXp - xpAtLevel} max={xpForNext} colorClass="bg-green-600" />
              <p className="text-[10px] text-gray-600 tabular-nums text-right">
                {totalXp - xpAtLevel} / {xpForNext}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
