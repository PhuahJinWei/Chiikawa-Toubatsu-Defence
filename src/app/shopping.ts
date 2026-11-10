// What the shop has that the player can buy now (owner's call, 2026-11-10: casual players forgot the shop and kept going
// with the jobs, a team of five all the way, and without the bigger pochettes World 5 is much harder: the casual bot won
// 31 of 50 tries there with five friends, 50 with the pochettes). The lobby's お店 button wears a coin badge while there
// is something, and once a world, as the next one starts, the report's 次へ asks whether to stop by (screens/Battle.tsx).

import { LEVELS } from '../game/sim/defs';
import { nameOf, t } from '../i18n/i18n';
import { save, type SaveData } from '../save/save';
import { SHOP } from './progress';
import { SHOP_SPOTS } from './scene/shop';

export type Good = (typeof SHOP.sellers)[number]['items'][number];

/** The shop's own plate is peach, like the plate on the lobby's 「お店」 button. */
export const SHOP_TONE = '#FBD5AB';

/** How many of a good the player has: upgrades bought, tickets held, or 1 for a friend who has joined. */
export function owned(item: Good, d: SaveData = save.value): number {
  if (item.card) return d.cards.includes(item.card) ? 1 : 0;
  if (item.upgrade) return d.upgrades[item.upgrade] >= (item.tier ?? 1) ? 1 : 0;
  if (item.id === 'buta') return d.items.buta;
  return 0;
}

/** An upgrade's steps are bought in order: a later one waits while the one above it is not bought yet. */
export function waits(item: Good, d: SaveData = save.value): boolean {
  return !!item.upgrade && d.upgrades[item.upgrade] < (item.tier ?? 1) - 1;
}

/** What a good costs now (for a ticket, the next one's price). */
export function priceOf(item: Good, d: SaveData = save.value): number {
  return item.prices[Math.min(owned(item, d), item.prices.length - 1)];
}

/** A good's name: a friend's own name, or the item's (the steps of an upgrade share theirs). */
export const goodName = (item: Good) => (item.card ? nameOf(item.card) : t(`shop.items.${item.pic ?? item.id}.name`));

/** What a good does, on its line: a friend's ability, how many friends a pochette lets you bring, the 草 a ラーメン券
 *  starts every job with. `n`: how many are held (for a ticket). */
export function goodDesc(item: Good, n: number): string {
  if (item.card) return t(`card.${item.card}.ability`);
  const tier = item.tier ?? 1;
  if (item.upgrade === 'slots') return t('shop.items.slot.desc', { n: SHOP.slotsBase + tier });
  if (item.upgrade === 'ramen') return t('shop.items.ramen.desc', { n: SHOP.ramenWeeds * tier });
  return t(`shop.items.${item.id}.desc`, { n });
}

export interface Offer {
  item: Good;
  price: number;
  /** Where its seller stands in the shop (SHOP_SPOTS): the shop opens there. */
  spot: string;
}

/** Something lasting the player can buy now (not the ぶた入りラーメン券, which is used up), the first in the shop's order:
 *  the pochettes first, as a bigger team is what the later worlds need most, then the ラーメン券 and the friends. */
export function shopOffer(d: SaveData = save.value): Offer | null {
  for (const seller of SHOP.sellers) {
    const spot = Object.keys(SHOP_SPOTS).find((s) => SHOP_SPOTS[s].seller === seller.id);
    if (!spot) continue;
    for (const item of seller.items) {
      if (item.consumable || owned(item, d) >= item.max || waits(item, d)) continue;
      const price = priceOf(item, d);
      if (price <= d.money) return { item, price, spot };
    }
  }
  return null;
}

/** The question about the shop asked as `world` starts, in the save's list of questions asked (asked once a world). */
export const shopAskKey = (world: number) => `shop:${world}`;

/** Whether going on from job `fromId` to `nextId` first asks about the shop: only as a new world starts, only once for
 *  that world, and only with something lasting there to buy. */
export function shopAsk(fromId: string | undefined, nextId: string, d: SaveData = save.value): Offer | null {
  const from = fromId ? LEVELS[fromId] : undefined;
  const next = LEVELS[nextId];
  if (!from || !next || next.world === from.world || d.asked.includes(shopAskKey(next.world))) return null;
  return shopOffer(d);
}
