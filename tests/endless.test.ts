import { describe, expect, it } from 'vitest';
import { defaultDeck, endlessPool } from '../src/app/progress';
import { STEP_MS } from '../src/game/sim/constants';
import { enemiesInLevel, ENEMY_LIST, LEVEL_LIST, LEVELS, summonsOf, UNITS } from '../src/game/sim/defs';
import { EndlessWaves, STAGE_WAVES } from '../src/game/sim/endless';
import { simForEndless } from '../src/game/sim/sim';
import { defaultSave, save } from '../src/save/save';

describe('summon-only enemies', () => {
  const summonOnly = ENEMY_LIST.filter((e) => e.summonOnly).map((e) => e.id);

  it('are called up by someone, and are in no job', () => {
    expect(summonOnly).toEqual(['mermaid_twolegs']);
    const called = ENEMY_LIST.flatMap((e) => summonsOf(e.id));
    for (const id of summonOnly) expect(called, id).toContain(id);
    for (const l of LEVEL_LIST) for (const id of summonOnly) expect(enemiesInLevel(l), l.id).not.toContain(id);
  });

  it('are never sent out or lined up in endless mode, even once they have been seen', () => {
    const before = save.value;
    const d = defaultSave('ja');
    d.gallery.seen = ENEMY_LIST.map((e) => e.id);
    save.value = d;
    try {
      const pool = endlessPool();
      for (const id of summonOnly) expect(pool).not.toContain(id);
      // Whoever calls them still comes.
      expect(pool).toContain('seiren');
    } finally {
      save.value = before;
    }
  });
});

describe('endless mode, in stages (owner’s call, 2026-11-10)', () => {
  const pool = ['mushi_twolegs', 'goblin', 'chushidesu', 'mushi_sixlegs', 'kimera', 'guchokipanogitaigata'];

  it('knows each stage before it starts: the same run sends the same stages, ten waves each, closed by a boss', () => {
    const a = new EndlessWaves(pool, 7);
    expect(a.plan(2)).toEqual(new EndlessWaves(pool, 7).plan(2));
    expect(a.plan(2)).not.toEqual(new EndlessWaves(pool, 8).plan(2));
    expect(a.plan(1)).toHaveLength(STAGE_WAVES);
    expect(a.plan(1).map((w) => w.some((s) => s.boss))).toEqual([...Array(STAGE_WAVES - 1).fill(false), true]);
    expect(a.flags()).toEqual([
      { at: 0.5, kind: 'big' },
      { at: 1, kind: 'boss' },
    ]);
    // What the road shows for a stage is everyone it sends.
    expect(a.counts(1).reduce((n, k) => n + k.count, 0)).toBe(a.plan(1).flat().length);
    // With no boss met, a stage closes with a final wave.
    expect(new EndlessWaves(['mushi_twolegs'], 7).flags()[1].kind).toBe('final');
  });

  it('stops between stages until the next begins: the friends, the 草 and the cars stay, the cards are dealt afresh', () => {
    const sim = simForEndless(pool, ['usagi', 'yoroi'], { seed: 5 });
    const waves = sim.waves as EndlessWaves;
    sim.cards[1].cooldownLeft = 0;
    const wall = sim.place(1, 2, 2)!;
    // Everyone sent falls as soon as they come.
    for (let i = 0; i < 60 * 600 && !waves.waiting; i++) {
      sim.step(STEP_MS);
      sim.devDefeatEnemies();
    }
    expect(waves.waiting).toBe(true);
    expect([waves.stage, waves.currentWave(), waves.cleared]).toEqual([1, STAGE_WAVES, STAGE_WAVES]);
    // Nothing more comes while the team is picked.
    for (let i = 0; i < 60 * 60; i++) sim.step(STEP_MS);
    expect(waves.currentWave()).toBe(STAGE_WAVES);
    expect(waves.progress(sim)).toBe(1);
    const weeds = sim.weeds;
    sim.cards[0].cooldownLeft = 4000;
    sim.beginStage(['yoroi', 'usagi']);
    expect([waves.stage, waves.waiting]).toEqual([2, false]);
    expect(sim.cards.map((c) => [c.def.id, c.cooldownLeft])).toEqual([
      ['yoroi', UNITS.yoroi.initialCooldownMs],
      ['usagi', UNITS.usagi.initialCooldownMs],
    ]);
    expect(sim.allies).toContain(wall);
    expect(sim.weeds).toBe(weeds);
    expect(sim.rescues.every((r) => r.state === 'parked')).toBe(true);
    // The next stage's first wave comes in its time.
    for (let i = 0; i < 60 * 40 && waves.currentWave() === STAGE_WAVES; i++) sim.step(STEP_MS);
    expect(waves.currentWave()).toBe(STAGE_WAVES + 1);
  });
});

describe('a team', () => {
  it('is kept in the order it was picked: the battle’s cards go in that order (owner’s call, 2026-11-10)', () => {
    const before = save.value;
    const d = defaultSave('ja');
    d.cards = ['chiikawa', 'usagi', 'yoroi', 'hachiware', 'momonga', 'kurimanju', 'furuhonya'];
    d.lastDeck = ['kurimanju', 'usagi', 'hachiware'];
    save.value = d;
    try {
      // The last team first, as it was picked, then the rest in the usual order.
      expect(defaultDeck(LEVELS['2-1'])).toEqual(['kurimanju', 'usagi', 'hachiware', 'chiikawa', 'yoroi']);
    } finally {
      save.value = before;
    }
  });
});
