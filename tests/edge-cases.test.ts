import { describe, expect, it } from 'vitest';
import { colY, STEP_MS, TILE } from '../src/game/sim/constants';
import { ENEMIES, UNITS, validateContent } from '../src/game/sim/defs';
import { EndlessWaves } from '../src/game/sim/endless';
import { Rng } from '../src/game/sim/rng';
import { Sim, simForEndless } from '../src/game/sim/sim';
import type { Ally, Enemy, SimEvent, SpawnDef, TerrainDef } from '../src/game/sim/types';
import type { WaveSource } from '../src/game/sim/waves';

// The audit's quieter findings (2026-11-10): odd corners of the simulation, each pinned so it stays fixed.

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

function field(deck: string[], terrain: TerrainDef[] = []): Sim {
  const sim = new Sim({ lanes: [0, 1, 2, 3, 4], startWeeds: 9999, sprout: null, terrain, rescues: false, deck, seed: 3, waves: new NoWaves() });
  for (const c of sim.cards) c.cooldownLeft = 0;
  return sim;
}

/** Run for `ms`, handing each step's events to `see`. */
function run(sim: Sim, ms: number, see: (ev: SimEvent) => void = () => {}): void {
  for (let t = 0; t < ms && sim.status === 'playing'; t += STEP_MS) {
    sim.step(STEP_MS);
    for (const ev of sim.drainEvents()) see(ev);
  }
}

const spawn = (sim: Sim, id: string, lane: number, y: number): Enemy => {
  sim.spawnEnemy(ENEMIES[id], lane, y, { waveIndex: 0 });
  return sim.enemies[sim.enemies.length - 1];
};

/** でかい鳥's grab and drop, reached directly (staging a real catch and a shot-down bird is long and chancy). */
const bird = (sim: Sim) => sim as unknown as { grab(e: Enemy, a: Ally): void; drop(e: Enemy): void };

describe('たい焼き', () => {
  it('waits for ちいかぶ to show its true form, then goes off under it (nothing harms it disguised)', () => {
    const sim = field(['taiyaki']);
    const trap = sim.place(0, 2, 3)!;
    trap.readyAt = 0;
    const boss = spawn(sim, 'chiikabu', 2, colY(3) - 60);
    let hitDisguised = false;
    run(sim, 8000, (ev) => {
      if (ev.type === 'hit' && ev.enemy === boss && boss.disguised) hitDisguised = true;
    });
    expect(hitDisguised).toBe(false);
    expect(boss.disguised).toBe(false);
    expect(boss.maxHp - boss.hp).toBeGreaterThanOrEqual(UNITS['taiyaki'].mine!.damage);
    expect(trap.state).toBe('collapse');
  });

  it('carried off while cooking and dropped back, still says when it is done', () => {
    const sim = field(['taiyaki']);
    const trap = sim.place(0, 2, 3)!;
    const flier = spawn(sim, 'dekai_tori', 2, colY(3));
    bird(sim).grab(flier, trap);
    bird(sim).drop(flier);
    flier.state = 'gone';
    let cooked = false;
    run(sim, UNITS['taiyaki'].mine!.readyMs + 500, (ev) => {
      if (ev.type === 'cooked' && ev.ally === trap) cooked = true;
    });
    expect(cooked).toBe(true);
  });
});

describe('でかい鳥', () => {
  it('reports a friend it drops where there is nowhere to land as carried off', () => {
    // Stumps on every other tile of the lane, and someone new on the friend's own tile.
    const stumps: TerrainDef[] = [0, 1, 2, 4, 5, 6, 7, 8].map((col) => ({ lane: 2, col, kind: 'stump' }));
    const sim = field(['usagi', 'yoroi'], stumps);
    const friend = sim.place(0, 2, 3)!;
    const flier = spawn(sim, 'dekai_tori', 2, colY(3));
    bird(sim).grab(flier, friend);
    sim.place(1, 2, 3);
    const events: SimEvent[] = [];
    bird(sim).drop(flier);
    events.push(...sim.drainEvents());
    expect(events.some((ev) => ev.type === 'carriedOff' && ev.ally === friend)).toBe(true);
    expect(friend.state).toBe('collapse');
  });
});

describe('ちゅーしです', () => {
  it('pounces once on a friend, however often it is pushed back off it', () => {
    const sim = field(['hachiware_pajama']);
    const pusher = sim.place(0, 2, 3)!;
    pusher.hp = pusher.maxHp = 1e6;
    const cat = spawn(sim, 'chushidesu', 2, colY(5));
    cat.hp = cat.maxHp = 1e6;
    let lunges = 0;
    let pushes = 0;
    let was = cat.state;
    for (let t = 0; t < 40000; t += STEP_MS) {
      sim.step(STEP_MS);
      for (const ev of sim.drainEvents()) if (ev.type === 'push' && ev.enemy === cat) pushes++;
      if (cat.state === 'lunge' && was !== 'lunge') lunges++;
      was = cat.state;
    }
    expect(pushes).toBeGreaterThan(3);
    expect(lunges).toBe(1);
  });
});

describe('黒い流れ星', () => {
  it('held up by a friend that never hurts it, drifts on past after a while instead of stalling the job', () => {
    const sim = field(['yoroi']);
    const wall = sim.place(0, 2, 4)!;
    const star = spawn(sim, 'kuroi_nagareboshi', 2, colY(4) - 100);
    run(sim, 9000);
    // Up against the wall, held.
    expect(star.y).toBeLessThan(colY(4) + TILE / 2);
    run(sim, 20000);
    // On past it: towards the protected place (with no car here, all the way to losing the job).
    expect(sim.status === 'lost' || star.y > colY(4) + TILE).toBe(true);
    expect(wall.hp).toBe(wall.maxHp);
  });
});

describe('endless mode', () => {
  const compose = (w: EndlessWaves, wave: number) => (w as unknown as { compose(h: { rng: Rng }, n: number): SpawnDef[] }).compose({ rng: new Rng(7) }, wave);
  const strength = (spawns: SpawnDef[]) => spawns.filter((s) => !s.boss).reduce((n, s) => n + ENEMIES[s.enemy].weight * (s.hpMul ?? 1), 0);

  it('spends all of a wave’s budget: on more enemies up to 60, then on making them tougher', () => {
    // No boss in this pool, so the whole budget goes on the rest.
    const w = new EndlessWaves(['mushi_twolegs', 'goblin', 'fugu', 'majyo', 'kuroi_nagareboshi', 'mushi_horned']);
    for (const n of [40, 90, 121, 150, 200]) {
      const spawns = compose(w, n);
      const budget = (1 + n * 1.3) * (n % 5 === 0 ? 1.6 : 1);
      const toughness = 1 + Math.max(0, n - 15) * 0.03;
      expect(spawns.length, `wave ${n}`).toBeLessThanOrEqual(60);
      expect(strength(spawns) / toughness, `wave ${n}`).toBeGreaterThan(budget - 1);
    }
  });
});

describe('the simulation', () => {
  it('keeps the seed it started from, so a run can be played again', () => {
    expect(simForEndless(['mushi_twolegs'], ['usagi'], { seed: 42 }).seed).toBe(42);
    expect(field(['usagi']).seed).toBe(3);
  });
});

describe('content checks', () => {
  it('name a friend or enemy that attacks without saying how hard, or names someone who does not exist', () => {
    const usagi = UNITS['usagi'].attack;
    const fugu = ENEMIES['fugu'].attack;
    const rally = ENEMIES['seiren'].abilities.find((a) => a.kind === 'rally') as { who: string[] };
    const kept = { usagi: usagi.damage, fugu: fugu.intervalMs, who: rally.who };
    try {
      usagi.damage = undefined;
      fugu.intervalMs = undefined;
      rally.who = [...kept.who, 'nobody'];
      const problems = validateContent();
      expect(problems.some((p) => p.startsWith('usagi:'))).toBe(true);
      expect(problems.some((p) => p.startsWith('fugu:'))).toBe(true);
      expect(problems.some((p) => p.includes('nobody'))).toBe(true);
    } finally {
      usagi.damage = kept.usagi;
      fugu.intervalMs = kept.fugu;
      rally.who = kept.who;
    }
    expect(validateContent()).toEqual([]);
  });
});
