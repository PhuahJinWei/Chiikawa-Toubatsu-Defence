import { describe, expect, it } from 'vitest';
import gallery from '../src/data/gallery.json';
import { ENEMY_LIST, LEVEL_LIST, UNIT_LIST } from '../src/game/sim/defs';
import { GALLERY_MOTIONS } from '../src/art/spec';
import { headingNameOf, keysOf, lang, nameOf, t } from '../src/i18n/i18n';

describe('i18n', () => {
  it('Japanese and English define exactly the same keys', () => {
    const ja = new Set(keysOf('ja'));
    const en = new Set(keysOf('en'));
    expect([...ja].filter((k) => !en.has(k))).toEqual([]);
    expect([...en].filter((k) => !ja.has(k))).toEqual([]);
  });

  it('wraps a long name in a heading between its words, and it still reads as the full name', () => {
    const was = lang.value;
    lang.value = 'ja';
    expect(headingNameOf('yoroi_pochette')).toBe('ポシェットの​鎧さん');
    expect(headingNameOf('guchokipanogitaigata')).toBe('グーチョキパーの​擬態型');
    expect(headingNameOf('pajama_parties')).toBe('パジャマ​パーティーズ');
    expect(headingNameOf('chiikawa_island')).toBe('ちいかわ​（人魚の島）');
    expect(headingNameOf('chiikawa')).toBe('ちいかわ');
    for (const l of ['ja', 'en'] as const) {
      lang.value = l;
      for (const e of gallery.entries) expect(headingNameOf(e.id).replace(/​/g, ''), e.id).toBe(nameOf(e.id));
    }
    lang.value = was;
  });

  it('every level has its job note (shown on the level sheet) in both languages', () => {
    for (const l of ['ja', 'en'] as const) {
      lang.value = l;
      for (const level of LEVEL_LIST) expect(t(`job.lines.${level.id}`)).not.toBe(`job.lines.${level.id}`);
    }
    lang.value = 'ja';
  });

  it('every unit and enemy has a name, an ability line and lore', () => {
    for (const u of UNIT_LIST) {
      expect(t(`card.${u.id}.name`)).not.toContain('card.');
      expect(t(`card.${u.id}.ability`)).not.toContain('card.');
      expect(t(`lore.${u.id}`)).not.toContain('lore.');
    }
    for (const e of ENEMY_LIST) {
      expect(t(`enemy.${e.id}.name`)).not.toContain('enemy.');
      expect(t(`enemy.${e.id}.ability`)).not.toContain('enemy.');
      expect(t(`lore.${e.id}`)).not.toContain('lore.');
    }
  });

  it('every gallery entry has lore, and the game links to no sources (they live in the GDD)', () => {
    const g = gallery as unknown as Record<string, unknown> & { entries: Record<string, unknown>[] };
    expect(g.sources).toBeUndefined();
    for (const e of g.entries) {
      expect(t(`lore.${e.id}`)).not.toContain('lore.');
      expect(e.sources).toBeUndefined();
    }
  });

  it('names every move the gallery can show, in both languages', () => {
    for (const l of ['ja', 'en'] as const) {
      const keys = new Set(keysOf(l));
      for (const m of GALLERY_MOTIONS) expect(keys.has(`gallery.motion.${m}`), `${l}: ${m}`).toBe(true);
    }
  });

  it('fills parameters', () => {
    lang.value = 'en';
    expect(t('battle.wave', { n: 3 })).toBe('Wave 3');
    lang.value = 'ja';
    expect(t('battle.wave', { n: 3 })).toBe('ウェーブ 3');
  });
});
