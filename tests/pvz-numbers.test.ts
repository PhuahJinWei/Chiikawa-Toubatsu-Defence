import { describe, expect, it } from 'vitest';
import { LOB_FLIGHT_MS, PROJECTILE_SPEED, SPEED_PX_PER_S, TILE } from '../src/game/sim/constants';
import { ENEMIES, LEVEL_LIST, UNIT_LIST } from '../src/game/sim/defs';
import { simForLevel } from '../src/game/sim/sim';

// PvZ's own numbers are the campaign's yardstick (owner's call, 2026-11-10).

describe('PvZ as the yardstick', () => {
  it('walks and shoots at its speeds', () => {
    expect(TILE / SPEED_PX_PER_S.normal).toBeCloseTo(4.7, 6);
    expect(TILE / SPEED_PX_PER_S.fast).toBeCloseTo(2.5, 6);
    expect(PROJECTILE_SPEED / TILE).toBeCloseTo(4.16, 6);
    expect(LOB_FLIGHT_MS).toBe(1200);
  });

  it('has no friend attacking quicker than its peashooter', () => {
    for (const u of UNIT_LIST) if (u.attack.intervalMs !== undefined) expect(u.attack.intervalMs, u.id).toBeGreaterThanOrEqual(1500);
  });

  it('has every enemy fight with the health it lists, in every job', () => {
    for (const level of LEVEL_LIST) {
      const sim = simForLevel(level, ['usagi'], { seed: 1 });
      const e = sim.spawnEnemy(ENEMIES.goblin, level.lanes[0], 0, { waveIndex: 0 });
      expect(e.maxHp, level.id).toBe(ENEMIES.goblin.hp);
    }
  });

  it('gives both mermaids one set of numbers', () => {
    const { ningyo: a, mermaid_twolegs: b } = ENEMIES;
    expect([b.hp, b.speed, b.size, b.attack]).toEqual([a.hp, a.speed, a.size, a.attack]);
  });
});
