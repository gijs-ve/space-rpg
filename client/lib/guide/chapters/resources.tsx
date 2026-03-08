import React from 'react';
import * as G from '../components';
import { GuideChapter } from '../types';
import {
  RESOURCE_LABELS, RESOURCE_ICONS, RESOURCE_TYPES,
  BASE_STORAGE_CAP, STARTING_RESOURCES,
  BUILDINGS,
  UNIT_LIST,
} from '@rpg/shared';

// ─── Helper: display a resource with its icon ─────────────────────────────────
function Res({ r }: { r: typeof RESOURCE_TYPES[number] }) {
  return (
    <span>
      {RESOURCE_ICONS[r]} {RESOURCE_LABELS[r]}
    </span>
  );
}

const resources: GuideChapter = {
  id:      'resources',
  icon:    '🌾',
  title:   'Resources',
  summary: 'The six resources that power everything — what they are, how to earn them, and how to store them.',
  sections: [

    // ── Overview ──────────────────────────────────────────────────────────────
    {
      id:    'overview',
      title: 'Overview',
      content: (
        <G.Section>
          <G.P>
            There are <G.Strong>six resources</G.Strong> in the game. Every action —
            constructing buildings, training troops, crafting items — requires some combination
            of them. Running out of a key resource will stall your progress, so balanced
            production is essential.
          </G.P>
          <G.Table headers={['Resource', 'Primary uses']}>
            <G.Row>
              <G.Term color="amber"><Res r="rations" /></G.Term>
              <G.Cell>Troop upkeep, building construction, training troops.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="sky"><Res r="water" /></G.Term>
              <G.Cell>Building construction and some troop costs.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="green"><Res r="wood" /></G.Term>
              <G.Cell>Building construction, cavalry upkeep, siege engines.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="gray"><Res r="ore" /></G.Term>
              <G.Cell>Building construction, training troops. The most widely used material.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="purple"><Res r="iron" /></G.Term>
              <G.Cell>Military buildings, advanced troops, high-tier construction.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="amber"><Res r="gold" /></G.Term>
              <G.Cell>
                Purchasing from vendors, elite troop costs, premium buildings. Rare and precious.
              </G.Cell>
            </G.Row>
          </G.Table>
        </G.Section>
      ),
    },

    // ── Production ────────────────────────────────────────────────────────────
    {
      id:    'production',
      title: 'How to Produce Resources',
      content: (
        <G.Section>
          <G.P>
            Each resource is produced by a dedicated building in your base. Buildings generate
            resources automatically on a regular <G.Strong>tick</G.Strong>. The higher the
            building level, the more it produces per tick.
          </G.P>
          <G.Table headers={['Resource', 'Produced by', 'Notes']}>
            <G.Row>
              <G.Term color="amber"><Res r="rations" /></G.Term>
              <G.Cell>{BUILDINGS.granary.name} {BUILDINGS.granary.icon}</G.Cell>
              <G.Cell color="gray">Easiest to produce — build and upgrade early.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="sky"><Res r="water" /></G.Term>
              <G.Cell>{BUILDINGS.millpond.name} {BUILDINGS.millpond.icon}</G.Cell>
              <G.Cell color="gray">
                Can also be obtained by processing{' '}
                <strong className="text-gray-200">Gypsum Crystals</strong> in the{' '}
                {BUILDINGS.millpond.name} (see Base → Crafting).
              </G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="green"><Res r="wood" /></G.Term>
              <G.Cell>{BUILDINGS.marketplace.name} {BUILDINGS.marketplace.icon}</G.Cell>
              <G.Cell color="gray">Requires {BUILDINGS.great_hall.name} lv. 2.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="gray"><Res r="ore" /></G.Term>
              <G.Cell>{BUILDINGS.quarry.name} {BUILDINGS.quarry.icon}</G.Cell>
              <G.Cell color="gray">Reliable mid-volume output. No prerequisites.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="purple"><Res r="iron" /></G.Term>
              <G.Cell>{BUILDINGS.forge.name} {BUILDINGS.forge.icon}</G.Cell>
              <G.Cell color="gray">
                Also craftable from <strong className="text-gray-200">Iron Ore Seam</strong>{' '}
                items found on hero missions.
              </G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="amber"><Res r="gold" /></G.Term>
              <G.Cell>{BUILDINGS.forge.name} {BUILDINGS.forge.icon}</G.Cell>
              <G.Cell color="gray">
                Small passive production and craftable from{' '}
                <strong className="text-gray-200">Gemstone Cache</strong> items. Also drops from
                hero missions.
              </G.Cell>
            </G.Row>
          </G.Table>
          <G.P>
            Resources can also be acquired by sending your hero on missions (drops), trading on
            the Market, or purchasing from Vendors with{' '}
            <strong className="text-amber-300">
              {RESOURCE_ICONS.gold} {RESOURCE_LABELS.gold}
            </strong>.
          </G.P>
        </G.Section>
      ),
    },

    // ── Storage ───────────────────────────────────────────────────────────────
    {
      id:    'storage',
      title: 'Storage Caps',
      content: (
        <G.Section>
          <G.P>
            Every resource has a <G.Strong>storage cap</G.Strong>. Production stops for any
            resource that has hit its cap, so upgrading storage is just as important as
            upgrading production.
          </G.P>
          <G.P>
            The default cap starts at <G.Strong>{BASE_STORAGE_CAP}</G.Strong> and can be
            raised in two ways:
          </G.P>
          <G.Table headers={['Source', 'How it helps']}>
            <G.Row>
              <G.Term color="sky">{BUILDINGS.great_hall.name}</G.Term>
              <G.Cell>
                Each level raises the cap for <em>all</em> resources by a flat amount.
              </G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="sky">{BUILDINGS.storage_expansion.name} {BUILDINGS.storage_expansion.icon}</G.Term>
              <G.Cell>
                Assigned to specific resources; adds +500 cap per level for those resources.
                Up to 3 can be built, and you gain an additional resource slot every 2 levels.
              </G.Cell>
            </G.Row>
          </G.Table>
          <G.Tip>
            Assign your {BUILDINGS.storage_expansion.name} buildings to the resources you use the
            most (usually {RESOURCE_LABELS.rations} and {RESOURCE_LABELS.ore}) to avoid
            production waste.
          </G.Tip>
        </G.Section>
      ),
    },

    // ── Troop Upkeep ─────────────────────────────────────────────────────────
    {
      id:    'upkeep',
      title: 'Troop Upkeep',
      content: (
        <G.Section>
          <G.P>
            Every troop in your garrison consumes resources every hour. If you cannot meet
            upkeep your resource pools will be drained until you disband troops.
            Plan your production to comfortably exceed your total hourly upkeep.
          </G.P>
          <G.Table headers={['Unit', 'Hourly upkeep (per unit)']}>
            {UNIT_LIST.map((u) => {
              const upkeepParts = Object.entries(u.upkeep)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => `${RESOURCE_ICONS[k as keyof typeof RESOURCE_ICONS] ?? ''} ${v} ${RESOURCE_LABELS[k as keyof typeof RESOURCE_LABELS] ?? k}`);
              return (
                <G.Row key={u.id}>
                  <G.Term color="amber">{u.name}</G.Term>
                  <G.Cell color="gray">{upkeepParts.join(', ')}</G.Cell>
                </G.Row>
              );
            })}
          </G.Table>
          <G.Note>
            Upkeep is charged even while your troops are marching or in your garrison. There
            is no way to pause it — only disbanding units removes their upkeep drain.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Starting Resources ────────────────────────────────────────────────────
    {
      id:    'starting-resources',
      title: 'Starting Resources',
      content: (
        <G.Section>
          <G.P>
            When you first settle your base you begin with the following resources to get
            construction started:
          </G.P>
          <G.Table headers={['Resource', 'Starting amount']}>
            {RESOURCE_TYPES.map((r) => (
              <G.Row key={r}>
                <G.Term color="amber"><Res r={r} /></G.Term>
                <G.Cell>{STARTING_RESOURCES[r]}</G.Cell>
              </G.Row>
            ))}
          </G.Table>
          <G.Tip>
            Spend your starting {RESOURCE_LABELS.ore} and {RESOURCE_LABELS.iron} on your
            first {BUILDINGS.great_hall.name} upgrade before anything else.
          </G.Tip>
        </G.Section>
      ),
    },

  ],
};

export default resources;
