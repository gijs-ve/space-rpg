import React from 'react';
import * as G from '../components';
import { GuideChapter } from '../types';
import {
  VENDORS, VENDOR_LIST,
  ITEMS,
  RESOURCE_LABELS, RESOURCE_ICONS,
} from '@rpg/shared';

// ─── Helper: restock time in a readable form ──────────────────────────────────
function restockLabel(minutes: number): string {
  if (minutes < 60)  return `${minutes} min`;
  const h = minutes / 60;
  return Number.isInteger(h) ? `${h} hr` : `${h.toFixed(1)} hr`;
}

const vendors: GuideChapter = {
  id:      'vendors',
  icon:    '🛒',
  title:   'Vendors',
  summary: 'Three NPC merchants offer items for sale and will buy equipment back — spend your gold wisely.',
  sections: [

    // ── Overview ──────────────────────────────────────────────────────────────
    {
      id:    'overview',
      title: 'Overview',
      content: (
        <G.Section>
          <G.P>
            Vendors are <G.Strong>non-player merchants</G.Strong> that stock a fixed set of
            items for sale. Unlike the Market, vendor prices never change — but their stock is
            limited and takes time to restock after being purchased.
          </G.P>
          <G.P>
            All vendor transactions use{' '}
            <strong className="text-amber-300">
              {RESOURCE_ICONS.gold} {RESOURCE_LABELS.gold}
            </strong>{' '}
            as currency. Vendors also offer to <G.Strong>buy items back</G.Strong>, though
            they pay considerably less than the sell price.
          </G.P>
          <G.Table headers={['Vendor', 'Speciality']}>
            {VENDOR_LIST.map((v) => (
              <G.Row key={v.id}>
                <G.Term color="amber">{v.name}</G.Term>
                <G.Cell color="gray">{v.description}</G.Cell>
              </G.Row>
            ))}
          </G.Table>
          <G.Tip>
            Check vendors regularly — high-demand items sell out quickly and may not restock
            for hours. If you need something specific, consider posting a buy order on the
            Market instead.
          </G.Tip>
        </G.Section>
      ),
    },

    // ── Black Pegasus Inn ─────────────────────────────────────────────────────
    {
      id:    'black-pegasus',
      title: VENDORS.black_pegasus.name,
      content: (
        <G.Section>
          <G.P>{VENDORS.black_pegasus.description}</G.P>
          <G.P>
            This is the best place to buy <G.Strong>starter gear and consumables</G.Strong>.
            Stock refreshes relatively quickly so it is rarely empty for long.
          </G.P>
          <G.Table headers={['Item', 'Buy price', 'Sell-back', 'Max stock', 'Restock']}>
            {VENDORS.black_pegasus.stock.map((s) => {
              const item = ITEMS[s.itemDefId as keyof typeof ITEMS];
              return (
                <G.Row key={s.itemDefId}>
                  <G.Term color="amber">{item?.name ?? s.itemDefId}</G.Term>
                  <G.Cell>{s.sellPrice} {RESOURCE_ICONS.gold}</G.Cell>
                  <G.Cell color="gray">{s.buyPrice} {RESOURCE_ICONS.gold}</G.Cell>
                  <G.Cell color="gray">{s.maxStock}</G.Cell>
                  <G.Cell color="gray">{restockLabel(s.restockIntervalMinutes)}</G.Cell>
                </G.Row>
              );
            })}
          </G.Table>
        </G.Section>
      ),
    },

    // ── The Wandering Scholar ─────────────────────────────────────────────────
    {
      id:    'wandering-scholar',
      title: VENDORS.wandering_scholar.name,
      content: (
        <G.Section>
          <G.P>{VENDORS.wandering_scholar.description}</G.P>
          <G.P>
            This vendor is valuable for <G.Strong>mid-tier equipment and components</G.Strong>.
            Components like the {ITEMS.surveyors_map.name} and {ITEMS.scholars_tome.name} are hard to
            find on missions and this vendor is often the most reliable source.
          </G.P>
          <G.Table headers={['Item', 'Buy price', 'Sell-back', 'Max stock', 'Restock']}>
            {VENDORS.wandering_scholar.stock.map((s) => {
              const item = ITEMS[s.itemDefId as keyof typeof ITEMS];
              return (
                <G.Row key={s.itemDefId}>
                  <G.Term color="sky">{item?.name ?? s.itemDefId}</G.Term>
                  <G.Cell>{s.sellPrice} {RESOURCE_ICONS.gold}</G.Cell>
                  <G.Cell color="gray">{s.buyPrice} {RESOURCE_ICONS.gold}</G.Cell>
                  <G.Cell color="gray">{s.maxStock}</G.Cell>
                  <G.Cell color="gray">{restockLabel(s.restockIntervalMinutes)}</G.Cell>
                </G.Row>
              );
            })}
          </G.Table>
        </G.Section>
      ),
    },

    // ── Iron Bastion Armoury ──────────────────────────────────────────────────
    {
      id:    'iron-bastion',
      title: VENDORS.iron_bastion.name,
      content: (
        <G.Section>
          <G.P>{VENDORS.iron_bastion.description}</G.P>
          <G.P>
            The most expensive vendor in the game, stocking <G.Strong>late-game iron and steel
            weapons and armour</G.Strong>. Stock is very limited and restocks slowly — if you see
            a steel item in stock, buy it immediately.
          </G.P>
          <G.Table headers={['Item', 'Buy price', 'Sell-back', 'Max stock', 'Restock']}>
            {VENDORS.iron_bastion.stock.map((s) => {
              const item = ITEMS[s.itemDefId as keyof typeof ITEMS];
              return (
                <G.Row key={s.itemDefId}>
                  <G.Term color="purple">{item?.name ?? s.itemDefId}</G.Term>
                  <G.Cell>{s.sellPrice} {RESOURCE_ICONS.gold}</G.Cell>
                  <G.Cell color="gray">{s.buyPrice} {RESOURCE_ICONS.gold}</G.Cell>
                  <G.Cell color="gray">{s.maxStock}</G.Cell>
                  <G.Cell color="gray">{restockLabel(s.restockIntervalMinutes)}</G.Cell>
                </G.Row>
              );
            })}
          </G.Table>
          <G.Note>
            The {VENDORS.iron_bastion.name} stocks the rarest items in the game. At max restock
            intervals of {restockLabel(720)}, some items may only appear once or twice a day.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Selling to Vendors ────────────────────────────────────────────────────
    {
      id:    'selling-back',
      title: 'Selling Items to Vendors',
      content: (
        <G.Section>
          <G.P>
            Every vendor will buy items back from you — not just the items they sell.
            However, <G.Strong>vendor buy prices are always much lower</G.Strong> than what
            you paid (roughly 30–35% of the sell price). Use this as a last resort to clear
            inventory space or get a small amount of gold quickly.
          </G.P>
          <G.P>
            For better returns, consider:
          </G.P>
          <G.Table headers={['Option', 'When to use']}>
            <G.Row>
              <G.Term color="green">Post on the Market</G.Term>
              <G.Cell>Best price — players often pay more than vendor sell prices.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="amber">Sell to vendor</G.Term>
              <G.Cell>Quick cash when you need gold immediately and can't wait for a buyer.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="gray">Equip to a building</G.Term>
              <G.Cell>If the item has base bonuses, equipping it earns more value over time than a one-time sale.</G.Cell>
            </G.Row>
          </G.Table>
        </G.Section>
      ),
    },

  ],
};

export default vendors;
