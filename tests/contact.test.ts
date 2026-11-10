import { describe, expect, it } from 'vitest';
import { colY, STEP_MS, TILE } from '../src/game/sim/constants';
import { ENEMIES } from '../src/game/sim/defs';
import { Sim } from '../src/game/sim/sim';
import type { WaveSource } from '../src/game/sim/waves';

class NoWaves implements WaveSource {
  step(): void {}
  progress(): number {
    return 0;
  }
  flags() {
    return [];
  }
  done(): boolean {
    return false;
  }
  currentWave(): number {
    return 0;
  }
}

function field(deck: string[]): Sim {
  const sim = new Sim({ lanes: [0, 1, 2, 3, 4], startWeeds: 9999, sprout: null, terrain: [], rescues: false, deck, seed: 3, waves: new NoWaves() });
  for (const c of sim.cards) c.cooldownLeft = 0;
  return sim;
}

const run = (sim: Sim, ms: number) => {
  for (let t = 0; t < ms && sim.status === 'playing'; t += STEP_MS) {
    sim.step(STEP_MS);
    sim.drainEvents();
  }
};

const spawn = (sim: Sim, id: string, lane: number, y: number) => {
  sim.spawnEnemy(ENEMIES[id], lane, y, { waveIndex: 0 });
  return sim.enemies[sim.enemies.length - 1];
};

describe('who can reach whom: in front, on top, behind', () => {
  it('a friend in front of an enemy hits it, and the enemy comes for it', () => {
    const sim = field(['usagi']);
    const a = sim.place(0, 2, 2)!;
    const e = spawn(sim, 'goblin', 2, colY(6));
    run(sim, 3000);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(a.hp).toBe(a.maxHp);
  });

  it('an enemy standing on a friend’s tile and the friend fight each other, shots and all', () => {
    const sim = field(['usagi']);
    // Deep in tile 4, past the middle: once behind a shot's reach from the muzzle.
    const e = spawn(sim, 'goblin', 2, colY(4) + 140);
    const a = sim.place(0, 2, 4)!;
    run(sim, 3000);
    // Up against it: waiting for its next swing, or swinging.
    expect(['engaged', 'attack']).toContain(e.state);
    expect(e.targetUid).toBe(a.uid);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('a friend put down behind an enemy neither hits it nor is hit, and the enemy walks on', () => {
    const sim = field(['usagi']);
    const e = spawn(sim, 'goblin', 2, colY(4) + 30);
    const a = sim.place(0, 2, 5)!;
    const y0 = e.y;
    run(sim, 2500);
    expect(e.hp).toBe(e.maxHp);
    expect(a.hp).toBe(a.maxHp);
    expect(e.y).toBeGreaterThan(y0);
    expect(e.state).toBe('walk');
  });

  it('friends under a giant’s body, behind its front, are left alone and cannot touch it', () => {
    const sim = field(['usagi', 'yoroi']);
    const wall = sim.place(1, 2, 2)!;
    const giant = spawn(sim, 'dekatsuyo', 2, colY(2) + 17);
    const putFresh = (lane: number, col: number) => {
      sim.cards[0].cooldownLeft = 0;
      return sim.place(0, lane, col)!;
    };
    const under = [putFresh(1, 4), putFresh(3, 5)];
    expect(under.every(Boolean)).toBe(true);
    run(sim, 3500);
    // It is busy with the wall in front of it...
    expect(['engaged', 'attack']).toContain(giant.state);
    expect(wall.hp).toBeLessThan(wall.maxHp);
    // ...and the two under its body are behind it: nobody hits anybody there.
    expect(giant.hp).toBe(giant.maxHp);
    for (const a of under) expect(a.hp).toBe(a.maxHp);
  });

  it('ラッコ cuts whoever stands on his own tile, and whoever is level with him in the lanes beside it', () => {
    const sim = field(['rakko']);
    const mine = spawn(sim, 'goblin', 2, colY(4) + 120);
    const a = sim.place(0, 2, 4)!;
    mine.hp = mine.maxHp = 1e6;
    run(sim, 3000);
    expect(['engaged', 'attack']).toContain(mine.state);
    expect(mine.targetUid).toBe(a.uid);
    expect(mine.hp).toBeLessThan(mine.maxHp);
    // Level with him in the lane above, held there: struck too.
    const beside = field(['rakko']);
    beside.place(0, 2, 4);
    const e = spawn(beside, 'goblin', 1, colY(4) + TILE / 2);
    e.hp = e.maxHp = 1e6;
    for (let t = 0; t < 3000; t += STEP_MS) {
      e.y = e.prevY = colY(4) + TILE / 2;
      beside.step(STEP_MS);
      beside.drainEvents();
    }
    expect(e.hp).toBeLessThan(e.maxHp);
  });
});

describe('the last column, at the very edge of the field', () => {
  it('a friend in the last column hits back whoever comes up against it', () => {
    for (const id of ['usagi', 'hachiware']) {
      const sim = field([id]);
      const a = sim.place(0, 2, 8)!;
      const e = spawn(sim, 'goblin', 2, -40);
      a.hp = a.maxHp = e.hp = e.maxHp = 1e6;
      run(sim, 6000);
      expect(['engaged', 'attack'], id).toContain(e.state);
      expect(e.hp, id).toBeLessThan(e.maxHp);
    }
  });

  it('a Fugu spitting at a friend in the last column can be hit back', () => {
    const sim = field(['usagi']);
    const a = sim.place(0, 2, 8)!;
    const fugu = spawn(sim, 'fugu', 2, -40);
    a.hp = a.maxHp = fugu.hp = fugu.maxHp = 1e6;
    run(sim, 6000);
    expect(fugu.hp).toBeLessThan(fugu.maxHp);
  });

  it('a Black Star stopped by a friend in the last column is fought, not left there for ever', () => {
    const sim = field(['usagi']);
    sim.place(0, 2, 8);
    const star = spawn(sim, 'kuroi_nagareboshi', 2, -40);
    run(sim, 8000);
    expect(star.hp).toBeLessThan(star.maxHp);
  });
});
