import React from 'react';
import ProgressBar from '@/components/ui/ProgressBar';
import { SKILLS } from '@rpg/shared';
import type { Hero } from '@rpg/shared';

interface SkillsPanelProps {
  hero: Hero;
}

const SKILL_ICONS: Record<string, string> = {
  combat: '⚔',
  endurance: '🛡',
  gathering: '🌿',
  leadership: '👑',
  tactics: '🗺',
};

export default function SkillsPanel({ hero }: SkillsPanelProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Skills</h2>
      {Object.values(SKILLS).map((skill) => {
        const totalXp: number = hero.skillXp?.[skill.id] ?? 0;
        const level = hero.skillLevels?.[skill.id] ?? 1;
        // XP accumulated up to the start of current level
        const xpAtLevel = skill.xpPerLevel.slice(0, level - 1).reduce((s, v) => s + v, 0);
        const xpForNext = skill.xpPerLevel[level - 1] ?? 1;
        return (
          <div key={skill.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{SKILL_ICONS[skill.id]} {skill.name}</span>
              <span>Lv {level}</span>
            </div>
            <ProgressBar
              value={totalXp - xpAtLevel}
              max={xpForNext}
              colorClass="bg-green-600"
            />
          </div>
        );
      })}
    </div>
  );
}
