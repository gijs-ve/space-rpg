import React from 'react';
import * as G from '../components';
import { GuideChapter } from '../types';
import {
  SKILLS, SKILL_LIST,
  BASE_MAX_ENERGY, ENERGY_REGEN_INTERVAL_SECONDS,
  BASE_MAX_HEALTH, HEALTH_REGEN_INTERVAL_SECONDS,
  ACTIVITY_LIST,
  ITEMS,
} from '@rpg/shared';

// ─── helpers ──────────────────────────────────────────────────────────────────

const energyRegenMinutes = ENERGY_REGEN_INTERVAL_SECONDS / 60;
const healthRegenMinutes = HEALTH_REGEN_INTERVAL_SECONDS / 60;

const hero: GuideChapter = {
  id:      'hero',
  icon:    '🧙',
  title:   'Hero',
  summary: 'Your personal champion — send them on missions, level up skills, and kit them out with gear.',
  sections: [

    // ── Overview ──────────────────────────────────────────────────────────────
    {
      id:    'overview',
      title: 'Overview',
      content: (
        <G.Section>
          <G.P>
            Your <G.Strong>Hero</G.Strong> is your personal champion on the world map. Unlike your
            troops, the hero acts alone — scouting ruins, gathering resources, and fighting hostile
            forces. Everything the hero does earns <G.Strong>experience points (XP)</G.Strong>{' '}
            and levels up skills over time.
          </G.P>
          <G.P>
            The hero has two key resources: <G.Strong>Energy</G.Strong>, which is spent to go on
            missions, and <G.Strong>Health</G.Strong>, which can be depleted in dangerous
            encounters.
          </G.P>
          <G.Tip label="First steps">
            Start with short, low-risk missions to build up XP and item drops before tackling
            harder expeditions.
          </G.Tip>
        </G.Section>
      ),
    },

    // ── Energy ────────────────────────────────────────────────────────────────
    {
      id:    'energy',
      title: 'Energy',
      content: (
        <G.Section>
          <G.P>
            Energy is the <G.Strong>fuel for missions</G.Strong>. Every mission costs a fixed
            amount of energy, and you cannot start one if you don't have enough.
          </G.P>
          <G.Table headers={['Stat', 'Value']}>
            <G.Row>
              <G.Term color="sky">Base maximum</G.Term>
              <G.Cell>{BASE_MAX_ENERGY}</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="sky">Regeneration rate</G.Term>
              <G.Cell>+1 point every {energyRegenMinutes} minutes (offline or online)</G.Cell>
            </G.Row>
          </G.Table>
          <G.P>
            Energy regenerates passively over time whether you are logged in or not. The{' '}
            <G.Strong>{SKILLS.endurance.name}</G.Strong> skill increases your maximum energy by{' '}
            {SKILLS.endurance.bonusPerLevel['maxEnergyBonus']} point per skill level, so investing
            in it lets you queue more missions between sessions.
          </G.P>
          <G.Note>
            Items equipped in your hero's pocket slots can also grant bonus maximum energy.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Health ────────────────────────────────────────────────────────────────
    {
      id:    'health',
      title: 'Health',
      content: (
        <G.Section>
          <G.P>
            Health represents your hero's physical condition. Dangerous missions deal a random
            amount of damage to the hero when they return. If health reaches zero the hero{' '}
            <G.Strong>cannot go on missions</G.Strong> until they have healed.
          </G.P>
          <G.Table headers={['Stat', 'Value']}>
            <G.Row>
              <G.Term color="green">Base maximum</G.Term>
              <G.Cell>{BASE_MAX_HEALTH}</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="green">Regeneration rate</G.Term>
              <G.Cell>+1 point every {healthRegenMinutes} minutes</G.Cell>
            </G.Row>
          </G.Table>
          <G.P>
            The hero's <G.Strong>Defense stat</G.Strong> (from equipped armour) reduces incoming
            mission damage before it is applied, so better gear means less downtime between
            expeditions.
          </G.P>
          <G.Tip>
            Keep a <G.Strong>{ITEMS.herbal_poultice.name}</G.Strong> or{' '}
            <G.Strong>{ITEMS.war_draught.name}</G.Strong> in a pocket slot.
            Consuming them instantly restores health without waiting for natural regen.
          </G.Tip>
        </G.Section>
      ),
    },

    // ── Missions ──────────────────────────────────────────────────────────────
    {
      id:    'missions',
      title: 'Missions',
      content: (
        <G.Section>
          <G.P>
            Missions are the main way your hero earns XP, resources, and gear. Each mission has
            an <G.Strong>energy cost</G.Strong>, a <G.Strong>minimum hero level</G.Strong>, and a
            variable <G.Strong>completion time</G.Strong>. The hero is unavailable until the
            mission finishes.
          </G.P>
          <G.Table headers={['Mission', 'Level req.', 'Energy', 'Duration']}>
            {ACTIVITY_LIST.map((a) => (
              <G.Row key={a.id}>
                <G.Term color="amber">{a.name}</G.Term>
                <G.Cell>{a.heroLevelRequirement}</G.Cell>
                <G.Cell>{a.energyCost}</G.Cell>
                <G.Cell color="gray">
                  {Math.floor(a.durationRange[0] / 60)}–{Math.floor(a.durationRange[1] / 60)} min
                </G.Cell>
              </G.Row>
            ))}
          </G.Table>
          <G.P>
            Harder missions take longer but reward more XP, better loot, and rarer resources.
            The <G.Strong>{SKILLS.tactics.name}</G.Strong> skill reduces mission duration, letting
            you complete more runs in the same time.
          </G.P>
          <G.Note>
            Each mission has a random loot table. Items are not guaranteed — higher-tier missions
            simply have better odds for rarer drops.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Skills ────────────────────────────────────────────────────────────────
    {
      id:    'skills',
      title: 'Skills',
      content: (
        <G.Section>
          <G.P>
            As your hero completes missions they earn <G.Strong>skill XP</G.Strong> in specific
            skills depending on which mission was run. Each skill can be levelled up to{' '}
            {SKILL_LIST[0].maxLevel}, and bonuses grow with every level.
          </G.P>
          <G.Table headers={['Skill', 'Bonus per level', 'Description']}>
            {SKILL_LIST.map((s) => (
              <G.Row key={s.id}>
                <G.Term color="purple">{s.name}</G.Term>
                <G.Cell color="green">
                  {Object.entries(s.bonusPerLevel).map(([k, v]) => `+${v} ${k}`).join(', ')}
                </G.Cell>
                <G.Cell color="gray">{s.description}</G.Cell>
              </G.Row>
            ))}
          </G.Table>
          <G.Note>
            Skill XP is separate from hero XP. A hero can be high level but still have low
            skill levels if they only ran one type of mission.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Equipment & Inventory ─────────────────────────────────────────────────
    {
      id:    'equipment',
      title: 'Equipment & Inventory',
      content: (
        <G.Section>
          <G.P>
            The hero carries items in a <G.Strong>personal inventory grid</G.Strong>. Items
            occupy grid cells and can sometimes be rotated to fit. Above the inventory grid
            sit the <G.Strong>equip slots</G.Strong>:
          </G.P>
          <G.Table headers={['Slot', 'What goes here']}>
            <G.Row><G.Term color="amber">Weapon</G.Term>  <G.Cell>Sword, dagger, bow, or war hammer — provides attack and sometimes other bonuses.</G.Cell></G.Row>
            <G.Row><G.Term color="sky">Helmet</G.Term>    <G.Cell>Head armour — typically improves defense.</G.Cell></G.Row>
            <G.Row><G.Term color="sky">Body</G.Term>      <G.Cell>Chest armour — typically improves defense and max health.</G.Cell></G.Row>
            <G.Row><G.Term color="sky">Legs</G.Term>      <G.Cell>Leg armour — typically improves defense.</G.Cell></G.Row>
            <G.Row><G.Term color="green">Pocket ×4</G.Term><G.Cell>Utility items (consumables, modules) — bonuses are active as long as they sit in a pocket slot.</G.Cell></G.Row>
          </G.Table>
          <G.P>
            Items in <G.Strong>pocket slots</G.Strong> are not used up automatically — you must
            right-click a consumable and choose <em>Consume</em> to trigger its effect.
          </G.P>
          <G.Note>
            Items can be moved to your base's Armoury at any time from the inventory screen.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Multiple Heroes ───────────────────────────────────────────────────────
    {
      id:    'multiple-heroes',
      title: 'Multiple Heroes',
      content: (
        <G.Section>
          <G.P>
            You begin with one hero, but you can recruit additional heroes as your roster grows
            in strength. To unlock the <G.Strong>next hero slot</G.Strong>, your existing heroes
            must collectively reach a combined level threshold:
          </G.P>
          <G.Table headers={['Hero slot', 'Combined level needed']}>
            <G.Row><G.Term color="gray">2nd hero</G.Term><G.Cell>Level 5 across all heroes</G.Cell></G.Row>
            <G.Row><G.Term color="gray">3rd hero</G.Term><G.Cell>Level 25 across all heroes</G.Cell></G.Row>
            <G.Row><G.Term color="gray">4th hero</G.Term><G.Cell>Level 125 across all heroes</G.Cell></G.Row>
          </G.Table>
          <G.P>
            Additional heroes allow you to run multiple missions simultaneously, dramatically
            increasing your resource and item income over time.
          </G.P>
          <G.Tip>
            Level your first hero quickly by spamming the lowest available mission until you
            unlock the second hero slot.
          </G.Tip>
        </G.Section>
      ),
    },

  ],
};

export default hero;
