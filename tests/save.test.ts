import { describe, expect, it, vi } from 'vitest';
import {
  applyImported,
  crc32,
  defaultSave,
  exportCode,
  FIRST_FRIEND,
  importCode,
  initSave,
  migrate,
  resetSave,
  save,
  SAVE_KEY,
  SAVE_VERSION,
  type SaveData,
  storageOk,
  updateSave,
} from '../src/save/save';
import { payOwedFriends } from '../src/app/progress';

/** localStorage as a map, for the tests that read and write it (node has none). */
function fakeStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
  vi.stubGlobal('localStorage', ls);
  return { store, ls };
}

describe('save', () => {
  it('export → import round-trips the whole save', () => {
    const d = defaultSave('ja');
    d.money = 1234;
    d.cards.push('chiikawa', 'yoroi');
    d.cleared['1-1'] = { stars: 3, clears: 2 };
    d.gallery.seen.push('mushi_twolegs');
    d.settings.lang = 'en';
    const code = exportCode(d);
    expect(code.startsWith('CTD1.')).toBe(true);
    const read = importCode(code);
    expect(read).toHaveProperty('save');
    const back = 'save' in read ? read.save : null;
    expect(back!.money).toBe(1234);
    expect(back!.cards).toEqual(['usagi', 'chiikawa', 'yoroi']);
    expect(back!.cleared['1-1']).toEqual({ stars: 3, clears: 2 });
    expect(back!.settings.lang).toBe('en');
  });

  it('lets only dev mode keep the art guides on (only its settings have the switch)', () => {
    const raw = { v: SAVE_VERSION, settings: { guides: true } };
    expect(migrate(raw, defaultSave('ja')).settings.guides).toBe(false);
    initSave('ja', true);
    expect(migrate(raw, defaultSave('ja')).settings.guides).toBe(true);
    initSave('ja', false);
  });

  it('rejects tampered or garbage codes', () => {
    const code = exportCode(defaultSave());
    const parts = code.split('.');
    const tampered = `${parts[0]}.${parts[1]}.00000000`;
    expect(importCode(tampered)).toEqual({ error: 'bad' });
    expect(importCode('hello')).toEqual({ error: 'bad' });
    expect(importCode('')).toEqual({ error: 'bad' });
  });

  it('refuses a code too long to be a save, or one that inflates past any real save', () => {
    expect(importCode(`CTD1.${'A'.repeat(20_000)}.00000000`)).toEqual({ error: 'bad' });
    // A few hundred characters that unpack to 300 KB.
    const bomb = exportCode({ ...defaultSave(), junk: 'a'.repeat(300_000) } as unknown as SaveData);
    expect(bomb.length).toBeLessThan(2000);
    expect(importCode(bomb)).toEqual({ error: 'bad' });
  });

  it('hands over at once the friends an imported older save is owed', () => {
    fakeStorage();
    try {
      initSave('ja');
      const old = defaultSave('ja');
      for (const id of ['1-1', '1-2', '1-3']) old.cleared[id] = { stars: 3, clears: 1 };
      expect(applyImported(old)).toBe(true);
      payOwedFriends();
      expect(save.value.cards).toEqual(expect.arrayContaining(['usagi', 'chiikawa', 'yoroi', 'hachiware']));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('refuses a code from a newer version of the game, which it could only read in part', () => {
    const newer = { ...defaultSave(), v: SAVE_VERSION + 1 } as SaveData;
    expect(importCode(exportCode(newer))).toEqual({ error: 'newer' });
  });

  it('starts any save, however damaged, with every field of the right type', () => {
    const def = defaultSave('ja');
    const raw = {
      v: SAVE_VERSION,
      cleared: null,
      attempts: { '1-1': 'x', '1-2': 2 },
      cards: 'usagi',
      gallery: { seen: 5, met: ['usagi', 7] },
      money: 'lots',
      upgrades: { slots: -2, ramen: 1.5 },
      items: null,
      settings: 'loud',
      stats: { wins: 'x' },
      wish: 3,
      tips: {},
      best: [],
      features: { endless: 'yes' },
      lastDeck: [1, 'usagi'],
      createdAt: 5,
    };
    const m = migrate(raw, def);
    expect(m.cleared).toEqual({});
    expect(m.attempts).toEqual({ '1-2': 2 });
    expect(m.cards).toEqual([FIRST_FRIEND]);
    expect(m.gallery).toEqual({ seen: [], defeated: [], met: ['usagi'] });
    expect(m.money).toBe(0);
    expect(m.upgrades).toEqual({ slots: 0, ramen: 1 });
    expect(m.items).toEqual({ buta: 0 });
    expect(m.settings).toEqual(def.settings);
    expect(m.stats.wins).toBe(0);
    expect(m.wish).toBeNull();
    expect('tips' in m).toBe(false);
    expect(m.best).toEqual({ endless: 0 });
    expect(m.features).toEqual({ endless: false, speed: false });
    expect(m.lastDeck).toEqual(['usagi']);
    expect(typeof m.createdAt).toBe('string');
    // A cleared job's record is mended rather than dropped; one that is not a record at all is dropped.
    expect(migrate({ v: SAVE_VERSION, cleared: { '1-1': { stars: 9, clears: 'x' }, '1-2': 4 } }, def).cleared).toEqual({ '1-1': { stars: 3, clears: 1 } });
    expect(migrate({ v: SAVE_VERSION, settings: { lang: 'fr', speed: 3, bgm: 4 } }, def).settings).toMatchObject({ lang: 'ja', speed: 1, bgm: 1 });
  });

  it('keeps a copy of a save it cannot read, or of one from a newer version, before starting', () => {
    const { store } = fakeStorage();
    try {
      store.set(SAVE_KEY, '[1,2]');
      initSave('ja');
      expect([...store.keys()].some((k) => k.startsWith(`${SAVE_KEY}.broken.`))).toBe(true);
      expect(save.value.money).toBe(0);
      store.clear();
      store.set(SAVE_KEY, JSON.stringify({ ...defaultSave(), v: SAVE_VERSION + 1, money: 7 }));
      initSave('ja');
      expect(store.has(`${SAVE_KEY}.v${SAVE_VERSION + 1}`)).toBe(true);
      expect(save.value.money).toBe(7);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps the save an import replaces, and says when a save could not be written', () => {
    const { store, ls } = fakeStorage();
    try {
      initSave('ja');
      updateSave((d) => {
        d.money = 5;
      });
      const read = importCode(exportCode({ ...defaultSave(), money: 99 }));
      expect(applyImported((read as { save: SaveData }).save)).toBe(true);
      expect(JSON.parse(store.get(`${SAVE_KEY}.before-import`)!).money).toBe(5);
      expect(save.value.money).toBe(99);
      // Storage full: a reset is not reported as done.
      ls.setItem = () => {
        throw new Error('QuotaExceededError');
      };
      expect(resetSave()).toBe(false);
      expect(storageOk.value).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('takes the save another tab wrote when it is newer than its own, and only then', () => {
    fakeStorage();
    vi.stubGlobal('window', new EventTarget());
    try {
      initSave('ja');
      const mine = save.value;
      const from = (d: object) => window.dispatchEvent(Object.assign(new Event('storage'), { key: SAVE_KEY, newValue: JSON.stringify(d) }));
      from({ ...mine, money: 1, updatedAt: '2000-01-01T00:00:00.000Z' });
      expect(save.value.money).toBe(mine.money);
      from({ ...mine, money: 42, updatedAt: '2999-01-01T00:00:00.000Z' });
      expect(save.value.money).toBe(42);
      // Another slot's save (dev mode's) is not this one's.
      window.dispatchEvent(Object.assign(new Event('storage'), { key: `${SAVE_KEY}.dev`, newValue: JSON.stringify({ ...mine, money: 3, updatedAt: '3000-01-01T00:00:00.000Z' }) }));
      expect(save.value.money).toBe(42);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('migrates old or partial saves by filling defaults', () => {
    const old = { money: 50, cards: ['chiikawa'], settings: { bgm: 0.2 } };
    const m = migrate(old, defaultSave('en'));
    expect(m.v).toBe(SAVE_VERSION);
    expect(m.money).toBe(50);
    // うさぎ is everyone's first friend (ハチワレ was, until 2026-11-08): a save from before keeps him and gets her.
    expect(m.cards).toContain('usagi');
    expect(migrate({ cards: ['hachiware', 'chiikawa'] }, defaultSave('en')).cards).toEqual(['usagi', 'hachiware', 'chiikawa']);
    expect(m.settings.bgm).toBe(0.2);
    expect(m.settings.sfx).toBe(0.8);
    expect(m.upgrades).toEqual({ slots: 0, ramen: 0 });
  });

  it('drops the removed weeding exam from version 1 saves', () => {
    const v1 = {
      v: 1,
      money: 300,
      features: { exam: true, endless: true, speed: false },
      best: { endless: 12, exam: 40, examGrade: 4 },
      examGrades: [5, 4],
    };
    const m = migrate(v1, defaultSave('ja')) as unknown as Record<string, unknown>;
    expect(m.v).toBe(SAVE_VERSION);
    expect(m.money).toBe(300);
    expect(m.features).toEqual({ endless: false, speed: false });
    expect(m.best).toEqual({ endless: 12 });
    expect('examGrades' in m).toBe(false);
  });

  it('locks endless mode again until World 6 is cleared, keeping the best run', () => {
    const v3 = { v: 3, cleared: { '1-10': { stars: 3, clears: 1 } }, features: { endless: true, speed: true }, best: { endless: 12 } };
    const m = migrate(v3, defaultSave('ja'));
    expect(m.features).toEqual({ endless: false, speed: true });
    expect(m.best.endless).toBe(12);
    const done = migrate({ ...v3, cleared: { '6-10': { stars: 1, clears: 1 } } }, defaultSave('ja'));
    expect(done.features.endless).toBe(true);
  });

  it('keeps the jobs that are left now the worlds have five, and what clearing them gives', () => {
    const v6 = {
      v: 6,
      cleared: { '1-5': { stars: 3, clears: 1 }, '1-6': { stars: 2, clears: 1 }, '6-10': { stars: 1, clears: 1 } },
      attempts: { '1-5': 2, '2-7': 4 },
      features: { endless: false, speed: false },
    };
    const m = migrate(v6, defaultSave('ja'));
    expect(Object.keys(m.cleared)).toEqual(['1-5']);
    expect(Object.keys(m.attempts)).toEqual(['1-5']);
    expect(m.features).toEqual({ endless: false, speed: true });
    expect(migrate({ v: 6, cleared: { '6-5': { stars: 1, clears: 1 } } }, defaultSave('ja')).features.endless).toBe(true);
    // Whatever was already open stays open, even with the job that opened it gone.
    const opened = { v: 6, cleared: { '6-10': { stars: 1, clears: 1 } }, features: { endless: true, speed: true } };
    expect(migrate(opened, defaultSave('ja')).features).toEqual({ endless: true, speed: true });
  });

  it('refunds the removed さすまた and 討伐棒 tune-ups', () => {
    const v2 = { v: 2, money: 100, upgrades: { slots: 1, sasumata: 2, rod: 1 } };
    const m = migrate(v2, defaultSave('ja'));
    expect(m.v).toBe(SAVE_VERSION);
    expect(m.upgrades).toEqual({ slots: 1, ramen: 0 });
    expect(m.money).toBe(100 + 500 + 1000 + 750);
  });

  it('counts pochettes bought before the split into three as already stamped', () => {
    const v4 = { v: 4, upgrades: { slots: 2 }, stamped: ['cleared:world1', 'soldout:slot'] };
    const m = migrate(v4, defaultSave('ja'));
    expect(m.v).toBe(SAVE_VERSION);
    expect(m.upgrades.slots).toBe(2);
    expect(m.stamped).toEqual(['cleared:world1', 'soldout:slot1', 'soldout:slot2']);
  });

  it('pays back one-use ramen tickets still held when they became lasting ラーメン券', () => {
    const v5 = { v: 5, money: 100, upgrades: { slots: 1 }, items: { ramen: 3 } };
    const m = migrate(v5, defaultSave('ja'));
    expect(m.v).toBe(SAVE_VERSION);
    expect(m.money).toBe(100 + 3 * 150);
    expect(m.upgrades).toEqual({ slots: 1, ramen: 0 });
    expect(m.items).toEqual({ buta: 0 });
  });

  it('counts the first friend as seen for anyone who has already played, and only them', () => {
    const played = { v: 7, gallery: { seen: ['mushi_twolegs'], defeated: [], met: ['yoroi_rodo'] } };
    expect(migrate(played, defaultSave('ja')).gallery.met).toEqual(['yoroi_rodo', FIRST_FRIEND]);
    const fresh = { v: 7, gallery: { seen: [], defeated: [], met: ['yoroi_rodo', 'furuhonya'] } };
    expect(migrate(fresh, defaultSave('ja')).gallery.met).toEqual(['yoroi_rodo', 'furuhonya']);
  });

  it('crc32 matches a known value', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926');
  });
});
