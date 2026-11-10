import { describe, expect, it } from 'vitest';
import { statsOf } from '../src/app/components/Stats';
import { ENEMY_LIST, UNIT_LIST } from '../src/game/sim/defs';
import { lang, t } from '../src/i18n/i18n';

// The numbers on the gallery book's pages and the job notice's details cards.
describe('a friend or an enemy in numbers', () => {
  it('every friend has numbers, all written in words in both languages', () => {
    for (const l of ['ja', 'en'] as const) {
      lang.value = l;
      for (const { id } of UNIT_LIST) {
        const stats = statsOf(id);
        expect(stats.length, id).toBeGreaterThan(0);
        for (const { k, v } of stats) {
          expect(k, id).not.toMatch(/^stat\./);
          expect(v, id).not.toMatch(/^(stat|speedTier|size)\./);
        }
      }
    }
    lang.value = 'ja';
  });

  it('a friend shows cost and recharge; an enemy shows no numbers at all', () => {
    const keys = (id: string) => statsOf(id).map((s) => s.k);
    expect(keys('chiikawa')).toEqual(expect.arrayContaining([t('stat.cost'), t('stat.hp'), t('stat.cooldown')]));
    for (const { id } of ENEMY_LIST) expect(statsOf(id), id).toEqual([]);
  });

  it('星 costs what its wish costs, and shows how soon it turns into them', () => {
    const s = statsOf('hoshi');
    expect(s.find((x) => x.k === t('stat.cost'))?.v).toBe(t('stat.sameAsWish'));
    expect(s.find((x) => x.k === t('stat.wishTime'))?.v).toBe(t('stat.seconds', { n: '1.2' }));
    expect(s.map((x) => x.k)).not.toContain(t('stat.hp'));
  });

  it('a trap that goes off where it stands reads 目の前, and tells how long it cooks', () => {
    const s = statsOf('taiyaki');
    expect(s.find((x) => x.k === t('stat.range'))?.v).toBe(t('stat.rangeTouch'));
    expect(s.find((x) => x.k === t('stat.ready'))?.v).toBe(t('stat.seconds', { n: '15.0' }));
  });

  it('a one-use card tells what it does and where: オデ his lane, むちゃうマン the whole field', () => {
    const v = (id: string, k: string) => statsOf(id).find((s) => s.k === t(k))?.v;
    expect(v('ode', 'stat.range')).toBe(t('stat.rangeLane'));
    expect(v('muchauman', 'stat.range')).toBe(t('stat.rangeField'));
    expect(v('muchauman', 'stat.effect')).toBe(t('stat.effectFreeze', { s: '5.0' }));
    expect(statsOf('ode').map((s) => s.k)).not.toContain(t('stat.hp'));
  });
});
