import { describe, expect, it } from 'vitest';
import { endlessPool } from '../src/app/progress';
import { enemiesInLevel, ENEMY_LIST, LEVEL_LIST, summonsOf } from '../src/game/sim/defs';
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
