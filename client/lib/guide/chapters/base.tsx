import React from 'react';
import * as G from '../components';
import { GuideChapter } from '../types';
import {
  BUILDINGS,
  CITY_BUILDING_SLOTS,
  UNIT_LIST,
  RESOURCE_LABELS,
  CRAFTING_RECIPE_LIST,
  ITEMS,
} from '@rpg/shared';

const base: GuideChapter = {
  id:      'base',
  icon:    '🏰',
  title:   'Base',
  summary: 'Build and upgrade your settlement — produce resources, train troops, and store your gear.',
  sections: [

    // ── Overview ──────────────────────────────────────────────────────────────
    {
      id:    'overview',
      title: 'Overview',
      content: (
        <G.Section>
          <G.P>
            Your <G.Strong>base</G.Strong> is the heart of your kingdom. It generates resources,
            trains troops, stores items, and grows stronger as you construct and upgrade buildings.
            Everything — from feeding your army to crafting advanced materials — flows through
            your settlement.
          </G.P>
          <G.P>
            Your base has <G.Strong>{CITY_BUILDING_SLOTS} building slots</G.Strong>. Each slot
            can hold one building. Plan your layout carefully — not every building can be built
            at once.
          </G.P>
          <G.Note>
            Some buildings have prerequisites. For example, the{' '}
            {BUILDINGS.barracks.name} requires the{' '}
            {BUILDINGS.great_hall.name} to be built first.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Great Hall ────────────────────────────────────────────────────────────
    {
      id:    'great-hall',
      title: BUILDINGS.great_hall.name,
      content: (
        <G.Section>
          <G.P>
            The <G.Strong>{BUILDINGS.great_hall.name}</G.Strong>{' '}
            {BUILDINGS.great_hall.icon} is the administrative core of your settlement.
            Most other buildings require it to be built first, and many require it to be
            upgraded to a minimum level before they can be unlocked.
          </G.P>
          <G.P>
            Every level of the {BUILDINGS.great_hall.name} also increases your{' '}
            <G.Strong>overall storage capacity</G.Strong> for all resources.
          </G.P>
          <G.Tip>
            The {BUILDINGS.great_hall.name} is the first thing you should upgrade. A higher
            level unlocks nearly every other building and gives you more room to stockpile
            resources.
          </G.Tip>
        </G.Section>
      ),
    },

    // ── Production Buildings ──────────────────────────────────────────────────
    {
      id:    'production',
      title: 'Production Buildings',
      content: (
        <G.Section>
          <G.P>
            Production buildings generate resources automatically over time. Each level increases
            the amount produced per tick.
          </G.P>
          <G.Table headers={['Building', 'Produces', 'Notes']}>
            <G.Row>
              <G.Term color="green">{BUILDINGS.granary.name} {BUILDINGS.granary.icon}</G.Term>
              <G.Cell color="amber">{RESOURCE_LABELS.rations}</G.Cell>
              <G.Cell color="gray">No prerequisites. Build early to feed your troops.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="green">{BUILDINGS.millpond.name} {BUILDINGS.millpond.icon}</G.Term>
              <G.Cell color="sky">{RESOURCE_LABELS.water}</G.Cell>
              <G.Cell color="gray">Can also process raw crystals into water (see Crafting).</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="green">{BUILDINGS.quarry.name} {BUILDINGS.quarry.icon}</G.Term>
              <G.Cell color="amber">{RESOURCE_LABELS.ore}</G.Cell>
              <G.Cell color="gray">No prerequisites. Your main source of building material.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="green">{BUILDINGS.forge.name} {BUILDINGS.forge.icon}</G.Term>
              <G.Cell color="amber">{RESOURCE_LABELS.iron} &amp; {RESOURCE_LABELS.gold}</G.Cell>
              <G.Cell color="gray">Smelts stone into iron and extracts gold. Also used for crafting.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="green">{BUILDINGS.marketplace.name} {BUILDINGS.marketplace.icon}</G.Term>
              <G.Cell color="amber">{RESOURCE_LABELS.wood}</G.Cell>
              <G.Cell color="gray">Requires {BUILDINGS.great_hall.name} level 2. Also provides trade capacity.</G.Cell>
            </G.Row>
          </G.Table>
          <G.P>
            Each building can be upgraded up to level 10, with each level increasing output
            by a fixed amount per tick.
          </G.P>
        </G.Section>
      ),
    },

    // ── Military Buildings ────────────────────────────────────────────────────
    {
      id:    'military',
      title: 'Military Buildings',
      content: (
        <G.Section>
          <G.P>
            Military buildings let you train troops. Higher building levels reduce training time.
          </G.P>
          <G.Table headers={['Building', 'Trains', 'Prerequisite']}>
            <G.Row>
              <G.Term color="red">{BUILDINGS.barracks.name} {BUILDINGS.barracks.icon}</G.Term>
              <G.Cell>Infantry &amp; Ranged</G.Cell>
              <G.Cell color="gray">{BUILDINGS.great_hall.name} lv. 1</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="red">{BUILDINGS.stables.name} {BUILDINGS.stables.icon}</G.Term>
              <G.Cell>Cavalry</G.Cell>
              <G.Cell color="gray">{BUILDINGS.barracks.name} lv. 3</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="red">{BUILDINGS.siege_workshop.name} {BUILDINGS.siege_workshop.icon}</G.Term>
              <G.Cell>Siege engines</G.Cell>
              <G.Cell color="gray">{BUILDINGS.barracks.name} lv. 5</G.Cell>
            </G.Row>
          </G.Table>

          <G.P>All available units and what they need to be trained:</G.P>
          <G.Table headers={['Unit', 'Category', 'Trains in', 'Min. building level']}>
            {UNIT_LIST.map((u) => {
              const bldg = BUILDINGS[u.trainingBuilding as keyof typeof BUILDINGS];
              return (
                <G.Row key={u.id}>
                  <G.Term color="amber">{u.name}</G.Term>
                  <G.Cell>{u.category}</G.Cell>
                  <G.Cell>{bldg?.name ?? u.trainingBuilding}</G.Cell>
                  <G.Cell color="gray">lv. {u.trainingBuildingLevel}</G.Cell>
                </G.Row>
              );
            })}
          </G.Table>
          <G.Note>
            Troops require upkeep resources every hour. Make sure your production keeps pace
            before expanding your army — see the Resources guide for details.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Ramparts ──────────────────────────────────────────────────────────────
    {
      id:    'defense',
      title: BUILDINGS.ramparts.name,
      content: (
        <G.Section>
          <G.P>
            The <G.Strong>{BUILDINGS.ramparts.name}</G.Strong>{' '}
            {BUILDINGS.ramparts.icon} fortifies your settlement with stone walls,
            battlements, and watchtowers. It improves your{' '}
            <G.Strong>wall bonus</G.Strong> — the passive defense multiplier that
            boosts your defenders whenever your city is attacked.
          </G.P>
          <G.P>
            Even without {BUILDINGS.ramparts.name} your city has a baseline wall bonus.
            Each level of the building adds an additional percentage on top of that.
          </G.P>
          <G.Tip>
            Build the {BUILDINGS.ramparts.name} early if you expect to be targeted by
            other players. Its bonus applies to the first and final attack waves.
          </G.Tip>
          <G.Note>
            Requires {BUILDINGS.great_hall.name} level 3.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Storage ───────────────────────────────────────────────────────────────
    {
      id:    'storage',
      title: 'Storage',
      content: (
        <G.Section>
          <G.P>
            Resources accumulate up to your current storage cap. Once a resource is at its cap,
            production stops until you spend or expand storage.
          </G.P>
          <G.P>
            Storage capacity can be increased in two ways:
          </G.P>
          <G.Table headers={['Source', 'Effect']}>
            <G.Row>
              <G.Term color="sky">{BUILDINGS.great_hall.name}</G.Term>
              <G.Cell>Each level adds a flat cap bonus across all resources.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="sky">{BUILDINGS.storage_expansion.name} {BUILDINGS.storage_expansion.icon}</G.Term>
              <G.Cell>
                You can build up to 3 of these. Each is assigned to specific resources and
                adds +500 cap per level to those resources. New resource slots open every
                2 levels.
              </G.Cell>
            </G.Row>
          </G.Table>
          <G.Note>
            Items placed on the Market are held separately and do not count against your
            base item storage.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Item Storage ──────────────────────────────────────────────────────────
    {
      id:    'item-storage',
      title: 'Item Storage',
      content: (
        <G.Section>
          <G.P>
            Your base stores equipment and loot in a <G.Strong>grid-based Armoury</G.Strong>.
            Items occupy grid cells (just like the hero inventory) and can be rotated.
            Two buildings expand item storage:
          </G.P>
          <G.Table headers={['Building', 'Grid at max level', 'Prerequisite']}>
            <G.Row>
              <G.Term color="purple">{BUILDINGS.armory.name} {BUILDINGS.armory.icon}</G.Term>
              <G.Cell>14 × 14 cells</G.Cell>
              <G.Cell color="gray">{BUILDINGS.great_hall.name} lv. 1</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="purple">{BUILDINGS.item_vault.name} {BUILDINGS.item_vault.icon}</G.Term>
              <G.Cell>16 × 16 cells</G.Cell>
              <G.Cell color="gray">{BUILDINGS.great_hall.name} lv. 2</G.Cell>
            </G.Row>
          </G.Table>
          <G.P>
            Items stored in the {BUILDINGS.armory.name} or {BUILDINGS.item_vault.name} can
            also be <G.Strong>equipped to buildings</G.Strong> — each building accepts up to
            two items in its equipment slots, granting your entire base passive bonuses such
            as faster construction, improved production, or larger storage.
          </G.P>
          <G.Tip>
            Equip production-boosting items to your highest-level production buildings to
            compound your resource output.
          </G.Tip>
        </G.Section>
      ),
    },

    // ── Crafting ──────────────────────────────────────────────────────────────
    {
      id:    'crafting',
      title: 'Crafting',
      content: (
        <G.Section>
          <G.P>
            Certain buildings can <G.Strong>process raw material items</G.Strong> found on
            missions and convert them into resources. This is useful when natural production
            is insufficient.
          </G.P>
          <G.Table headers={['Building', 'Input item', 'Output']}>
            {CRAFTING_RECIPE_LIST.map((r) => {
              const bldg = BUILDINGS[r.buildingId as keyof typeof BUILDINGS];
              const inputItem = ITEMS[r.inputItemId as keyof typeof ITEMS];
              return (
                <G.Row key={r.id}>
                  <G.Term color="orange">{bldg?.name ?? r.buildingId}</G.Term>
                  <G.Cell>{inputItem?.name ?? r.inputItemId}</G.Cell>
                  <G.Cell color="green">{r.outputAmount} × {r.label.split('→')[1]?.trim() ?? r.outputResource}</G.Cell>
                </G.Row>
              );
            })}
          </G.Table>
          <G.P>
            Higher building levels reduce the time it takes to process a batch. Only one recipe
            can run at a time per building.
          </G.P>
          <G.Note>
            Raw material items ({ITEMS.gypsum_crystals.name}, {ITEMS.iron_ore_seam.name},{' '}
            {ITEMS.gemstone_cache.name}) are found as loot drops from hero missions. They have
            no use outside of crafting.
          </G.Note>
        </G.Section>
      ),
    },

  ],
};

export default base;
