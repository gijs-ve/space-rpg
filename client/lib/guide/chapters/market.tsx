import React from 'react';
import * as G from '../components';
import { GuideChapter } from '../types';
import {
  BLACK_MARKET_TAX_RATE,
  RESOURCE_LABELS,
  RESOURCE_ICONS,
  ITEMS,
} from '@rpg/shared';

const taxPercent    = BLACK_MARKET_TAX_RATE * 100;
const payoutPercent = (1 - BLACK_MARKET_TAX_RATE) * 100;

const market: GuideChapter = {
  id:      'market',
  icon:    '⚖️',
  title:   'Market',
  summary: 'Post buy and sell listings to trade items and resources directly with other players.',
  sections: [

    // ── Overview ──────────────────────────────────────────────────────────────
    {
      id:    'overview',
      title: 'Overview',
      content: (
        <G.Section>
          <G.P>
            The <G.Strong>Market</G.Strong> is a player-driven trading post where you can buy
            and sell both <G.Strong>items</G.Strong> and <G.Strong>resources</G.Strong>. Every
            listing you post or fulfill is between real players — there is no automated buy
            from the game.
          </G.P>
          <G.P>
            You can reach the Market from the navigation bar at any time. Listings posted by
            all players on your server appear here, and you can post your own.
          </G.P>
          <G.Tip>
            Check the Market before visiting Vendors — player listings often offer better
            prices, especially for common equipment.
          </G.Tip>
        </G.Section>
      ),
    },

    // ── Listing Types ─────────────────────────────────────────────────────────
    {
      id:    'listing-types',
      title: 'Listing Types',
      content: (
        <G.Section>
          <G.P>
            When you create a listing you choose two things: the <G.Strong>direction</G.Strong>{' '}
            (sell or buy) and the <G.Strong>kind</G.Strong> (item or resource). This gives four
            possible listing types:
          </G.P>
          <G.Table headers={['Type', 'What it means']}>
            <G.Row>
              <G.Term color="red">Sell Item</G.Term>
              <G.Cell>
                You offer a specific item from your inventory at a set{' '}
                {RESOURCE_ICONS.iridium} {RESOURCE_LABELS.iridium} price.
                Another player pays and receives the item.
              </G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="red">Sell Resource</G.Term>
              <G.Cell>
                You offer a quantity of one resource at a price per unit.
                The buyer pays and the resources are transferred.
              </G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="green">Buy Item</G.Term>
              <G.Cell>
                You post a wanted ad for a specific item type and how much you are willing to pay.
                Another player who has the item can fulfil your request.
              </G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="green">Buy Resource</G.Term>
              <G.Cell>
                You offer to purchase a quantity of a resource at a set price per unit.
                Any player can partially or fully fulfil a resource buy order.
              </G.Cell>
            </G.Row>
          </G.Table>
        </G.Section>
      ),
    },

    // ── Tax & Fees ────────────────────────────────────────────────────────────
    {
      id:    'tax',
      title: 'Market Tax',
      content: (
        <G.Section>
          <G.P>
            Every completed sale on the Market is subject to a{' '}
            <G.Strong>{taxPercent}% tax</G.Strong>. The tax is taken automatically from the
            sale proceeds before they are credited to the seller.
          </G.P>
          <G.Table headers={['What happens', 'Amount']}>
            <G.Row>
              <G.Term color="gray">Buyer pays</G.Term>
              <G.Cell>Full listing price</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="red">Tax deducted</G.Term>
              <G.Cell>{taxPercent}% of the listing price</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="green">Seller receives</G.Term>
              <G.Cell>{payoutPercent}% of the listing price</G.Cell>
            </G.Row>
          </G.Table>
          <G.P>
            Factor the tax into your asking price if you want a specific net payout.
          </G.P>
          <G.Note>
            Buy orders are not taxed when you post them — the tax only applies to the seller
            when a buy order is fulfilled.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Item Listings & Voucher ───────────────────────────────────────────────
    {
      id:    'voucher',
      title: 'Item Listings & the Market Voucher',
      content: (
        <G.Section>
          <G.P>
            When you post an item for sale, the item is moved out of your inventory and held
            in escrow. A <G.Strong>{ITEMS.market_voucher.name}</G.Strong> placeholder
            appears in the item's place so you know which slot is reserved.
          </G.P>
          <G.P>
            The voucher is removed automatically when the listing resolves:
          </G.P>
          <G.Table headers={['Outcome', 'What happens to your slot']}>
            <G.Row>
              <G.Term color="green">Item sells</G.Term>
              <G.Cell>Voucher disappears; {RESOURCE_LABELS.iridium} is credited to your account (minus tax).</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="amber">Listing cancelled</G.Term>
              <G.Cell>The original item is returned to your inventory; voucher disappears.</G.Cell>
            </G.Row>
          </G.Table>
          <G.Tip>
            Check your <G.Strong>Activity Reports</G.Strong> to see when your listings complete
            or are cancelled — the game notifies you there.
          </G.Tip>
        </G.Section>
      ),
    },

    // ── Tips ──────────────────────────────────────────────────────────────────
    {
      id:    'tips',
      title: 'Trading Tips',
      content: (
        <G.Section>
          <G.P>
            A few things to keep in mind when using the Market:
          </G.P>
          <G.Table headers={['Tip', 'Why it matters']}>
            <G.Row>
              <G.Term color="amber">Price check first</G.Term>
              <G.Cell>
                Browse existing sell listings before posting your own. Undercutting is common
                and your listing may sit unfilled if priced too high.
              </G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="amber">Use buy orders for rare items</G.Term>
              <G.Cell>
                If you need a specific rare item and none are listed for sale, post a buy order
                at a competitive price — another player may have it sitting in their inventory.
              </G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="amber">Resources sell fast</G.Term>
              <G.Cell>
                Players always need {RESOURCE_LABELS.iridium} and {RESOURCE_LABELS.alloys} —
                these tend to move quickly at reasonable prices.
              </G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="amber">Account for the tax</G.Term>
              <G.Cell>
                If you want to net 100 {RESOURCE_LABELS.iridium}, list at{' '}
                {Math.ceil(100 / (1 - BLACK_MARKET_TAX_RATE))} to account for the {taxPercent}% cut.
              </G.Cell>
            </G.Row>
          </G.Table>
        </G.Section>
      ),
    },

  ],
};

export default market;
