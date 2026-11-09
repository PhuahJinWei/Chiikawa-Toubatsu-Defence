import { beforeEach, describe, expect, it } from 'vitest';
import { applyResult, galleryKnown, jobCards, levelUnlocked, nextLevel, rewardFor, worldUnlocked } from '../src/app/progress';
import gallery from '../src/data/gallery.json';
import type { BattleEnd } from '../src/game/controller';
import { enemiesInLevel, LEVEL_LIST, LEVELS, summonsOf, UNIT_LIST } from '../src/game/sim/defs';
import { simForLevel } from '../src/game/sim/sim';
import { defaultSave, FIRST_FRIEND, save } from '../src/save/save';

/** Clear a job, the way the result screen does. */
function clear(levelId: string) {
  const end = {
    won: true,
    mode: 'level',
    levelId,
    rescuesLeft: 5,
    wavesCleared: 1,
    timeMs: 1000,
    stats: { rescuesUsed: 0, weedsCollected: 0, enemiesDefeated: 0 },
  } as unknown as BattleEnd;
  const reward = rewardFor(end);
  applyResult(end, reward);
  return reward;
}

describe("the gallery book's friends", () => {
  const friends = gallery.entries.filter((e) => e.tab === 'allies').map((e) => e.id);

  beforeEach(() => {
    save.value = defaultSave('ja');
  });

  it('are all a 「？」 on a new save, the one already on the team too', () => {
    expect(save.value.cards).toContain(FIRST_FRIEND);
    for (const id of friends) expect(galleryKnown(id), id).toBe('none');
  });

  it('are a dark shape once met somewhere, until they join', () => {
    for (const id of friends.filter((f) => f !== FIRST_FRIEND)) {
      save.value = defaultSave('ja');
      save.value.gallery.met.push(id);
      expect(galleryKnown(id), id).toBe('seen');
      save.value.cards.push(id);
      expect(galleryKnown(id), id).toBe('full');
    }
  });

  it('are known in full as soon as a job brings them in', () => {
    clear('1-1');
    expect(galleryKnown('chiikawa')).toBe('full');
  });

  it('count the friend everyone starts with from their first battle', () => {
    save.value.gallery.met.push(FIRST_FRIEND);
    expect(galleryKnown(FIRST_FRIEND)).toBe('full');
  });

  it('leave the people known from the first meeting', () => {
    expect(galleryKnown('yoroi_rodo')).toBe('none');
    save.value.gallery.met.push('yoroi_rodo');
    expect(galleryKnown('yoroi_rodo')).toBe('full');
  });
});

describe('the campaign, played from a new save', () => {
  beforeEach(() => {
    save.value = defaultSave('ja');
  });

  it('opens each job in turn, and each friend joins on its first clear only', () => {
    for (const level of LEVEL_LIST) {
      expect(nextLevel().id).toBe(level.id);
      expect(levelUnlocked(level.id), level.id).toBe(true);
      expect(worldUnlocked(level.world), level.id).toBe(true);
      expect(clear(level.id).newCard, level.id).toBe(level.rewards.unlockCard);
      expect(clear(level.id).newCard, `${level.id} again`).toBeUndefined();
    }
    // Everyone but those sold at the なかま屋.
    const fromJobs = UNIT_LIST.map((u) => u.id).filter((id) => !['shisa', 'hoshi'].includes(id));
    expect([...save.value.cards].sort()).toEqual([...fromJobs].sort());
  });

  it('has the friend who answers a new enemy on the team by the time it comes', () => {
    const answers: Record<string, string> = {
      '1-1': 'usagi',
      '1-3': 'yoroi',
      '1-4': 'hachiware',
      '1-5': 'kurimanju',
      '2-1': 'chiikawa',
      '2-2': 'furuhonya',
      '2-3': 'taiyaki',
      '2-4': 'kurimanju',
      '2-5': 'momonga',
      '3-1': 'momonga',
      '3-2': 'ode',
      '3-4': 'pajama_parties',
      '3-5': 'ode',
      '4-2': 'rakko',
      '4-3': 'muchauman',
      '4-5': 'yoroi_erai',
      '5-1': 'momonga',
      '5-5': 'shimajiro',
    };
    for (const level of LEVEL_LIST) {
      if (answers[level.id]) expect(jobCards(LEVELS[level.id]), level.id).toContain(answers[level.id]);
      clear(level.id);
    }
  });

  it('opens 2× speed with 1-5 and endless mode with 6-5', () => {
    for (const level of LEVEL_LIST) {
      expect(save.value.features.speed, level.id).toBe(LEVEL_LIST.indexOf(level) > LEVEL_LIST.indexOf(LEVELS['1-5']));
      expect(save.value.features.endless, level.id).toBe(false);
      clear(level.id);
    }
    expect(save.value.features).toEqual({ endless: true, speed: true });
  });
});

describe('every job, run from its first wave to its last', () => {
  // Nothing about whether it can be won: with nobody on the field and the testing ground's rule that whoever gets
  // through just leaves it, this only shows that each job comes out as written.
  it('sends everyone it lists, with a boss banner where the plan has a boss', { timeout: 60000 }, () => {
    const bossBanners: Record<string, string[]> = {
      '1-5': ['mushi_pink'],
      '2-5': ['guchokipanogitaigata'],
      '3-4': ['zou'],
      '3-5': ['chiikabu'],
      '4-5': ['anoko'],
      '5-5': ['seiren'],
      '6-3': ['zou'],
      '6-4': ['guchokipanogitaigata'],
      '6-5': ['dekatsuyo'],
    };
    for (const level of LEVEL_LIST) {
      const sim = simForLevel(level, ['usagi'], { seed: 1 });
      Object.assign(sim, { dev: { free: false, freeze: false, safeFriends: false, safeEnemies: false } });
      const came = new Set<string>();
      const banners: string[] = [];
      for (let t = 0; t < 20 * 60 * 1000 && sim.status === 'playing'; t += 50) {
        sim.step(50);
        for (const e of sim.enemies) came.add(e.def.id);
        for (const ev of sim.drainEvents()) if (ev.type === 'banner' && ev.kind === 'boss' && ev.bossId) banners.push(ev.bossId);
      }
      expect(sim.status, level.id).toBe('won');
      for (const id of enemiesInLevel(level).flatMap((e) => [e, ...summonsOf(e)])) expect(came.has(id), `${level.id}: ${id}`).toBe(true);
      expect(banners, level.id).toEqual(bossBanners[level.id] ?? []);
    }
  });
});
