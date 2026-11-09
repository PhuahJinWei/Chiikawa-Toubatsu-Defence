import { describe, expect, it } from 'vitest';
import { crc32, defaultSave, exportCode, importCode, migrate, SAVE_VERSION } from '../src/save/save';

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
    const back = importCode(code);
    expect(back).not.toBeNull();
    expect(back!.money).toBe(1234);
    expect(back!.cards).toEqual(['usagi', 'chiikawa', 'yoroi']);
    expect(back!.cleared['1-1']).toEqual({ stars: 3, clears: 2 });
    expect(back!.settings.lang).toBe('en');
  });

  it('rejects tampered or garbage codes', () => {
    const code = exportCode(defaultSave());
    const parts = code.split('.');
    const tampered = `${parts[0]}.${parts[1]}.00000000`;
    expect(importCode(tampered)).toBeNull();
    expect(importCode('hello')).toBeNull();
    expect(importCode('')).toBeNull();
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

  it('crc32 matches a known value', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926');
  });
});
