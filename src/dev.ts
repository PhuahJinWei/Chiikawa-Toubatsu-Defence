// Dev mode, for testing: open the game with ?dev in the address (…/?dev) and it plays from a save of its own with
// everything unlocked. The player's own save is never touched; without ?dev it is back as it was.

import gallery from './data/gallery.json';
import { LEVEL_LIST, UNIT_LIST } from './game/sim/defs';
import type { SaveData } from './save/save';

/** Dev mode is on when the address has ?dev (with or without a value). */
export const DEV_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev');

/** Money a dev save always has at least, for trying the shop. */
export const DEV_MONEY = 99999;

/**
 * Unlock everything in a save: every job cleared with three stars, every friend (those sold in the なかま屋 too),
 * 2× speed and endless mode, every gallery entry known, and money to spare. What the shop sells is left to buy, so
 * buying can be tried. Run on every start in dev mode, so whatever is added to the game later is unlocked as well.
 */
export function unlockEverything(d: SaveData): void {
  for (const l of LEVEL_LIST) {
    const was = d.cleared[l.id];
    d.cleared[l.id] = { stars: 3, clears: Math.max(1, was?.clears ?? 0) };
  }
  for (const u of UNIT_LIST) if (!d.cards.includes(u.id)) d.cards.push(u.id);
  d.features = { ...d.features, endless: true, speed: true };
  for (const e of gallery.entries) {
    if (e.tab === 'enemies') {
      if (!d.gallery.seen.includes(e.id)) d.gallery.seen.push(e.id);
      if (!d.gallery.defeated.includes(e.id)) d.gallery.defeated.push(e.id);
    } else if (!d.gallery.met.includes(e.id)) d.gallery.met.push(e.id);
  }
  d.money = Math.max(d.money, DEV_MONEY);
}
