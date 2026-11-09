import { describe, expect, it } from 'vitest';
import gallery from '../src/data/gallery.json';
import { DEV_MONEY, unlockEverything } from '../src/dev';
import { LEVEL_LIST, UNIT_LIST } from '../src/game/sim/defs';
import { DEV_SAVE_KEY, defaultSave, SAVE_KEY } from '../src/save/save';

describe('dev mode', () => {
  it('plays from a save of its own', () => {
    expect(DEV_SAVE_KEY).not.toBe(SAVE_KEY);
  });

  it('unlocks every job, friend and gallery entry, with money to spare, and leaves the shop to buy', () => {
    const d = defaultSave('ja');
    unlockEverything(d);
    for (const l of LEVEL_LIST) expect(d.cleared[l.id]?.stars).toBe(3);
    expect(new Set(d.cards)).toEqual(new Set(UNIT_LIST.map((u) => u.id)));
    expect(d.features).toEqual({ endless: true, speed: true });
    for (const e of gallery.entries) {
      if (e.tab === 'enemies') expect(d.gallery.defeated).toContain(e.id);
      else expect(d.gallery.met).toContain(e.id);
    }
    expect(d.money).toBeGreaterThanOrEqual(DEV_MONEY);
    expect(d.upgrades).toEqual({ slots: 0, ramen: 0 });
    expect(d.items).toEqual({ buta: 0 });
  });

  it('runs on every start without doubling anything, and keeps what was bought', () => {
    const d = defaultSave('ja');
    unlockEverything(d);
    d.money = DEV_MONEY + 500;
    d.upgrades.slots = 2;
    d.items.buta = 3;
    const before = JSON.stringify({ cleared: d.cleared, cards: d.cards, gallery: d.gallery });
    unlockEverything(d);
    expect(JSON.stringify({ cleared: d.cleared, cards: d.cards, gallery: d.gallery })).toBe(before);
    expect(d.money).toBe(DEV_MONEY + 500);
    expect(d.upgrades.slots).toBe(2);
    expect(d.items.buta).toBe(3);
  });
});
