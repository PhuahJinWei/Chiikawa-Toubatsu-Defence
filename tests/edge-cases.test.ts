import { describe, expect, it } from 'vitest';
import { colY, FIELD_ENTRY_Y, SPAWN_Y, STEP_MS, TILE } from '../src/game/sim/constants';
import { ENEMIES, ENEMY_LIST, UNIT_LIST, UNITS, validateContent } from '../src/game/sim/defs';
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

  // Enemies leave a trap alone (owner's call, 2026-11-12).
  it('is in nobody’s way while it cooks: enemies walk over it and never bite it', () => {
    const sim = field(['taiyaki']);
    const trap = sim.place(0, 2, 3)!;
    const bug = spawn(sim, 'mushi_twolegs', 2, colY(3) - 60);
    let bites = 0;
    for (let t = 0; t < UNITS['taiyaki'].mine!.readyMs - 1000 && bug.y <= colY(3) + TILE; t += STEP_MS) {
      sim.step(STEP_MS);
      for (const ev of sim.drainEvents()) if (ev.type === 'enemyAttack') bites++;
    }
    expect(bug.y).toBeGreaterThan(colY(3) + TILE);
    expect(bites).toBe(0);
    expect(trap.hp).toBe(trap.maxHp);
    expect(sim.grid[2][3]).toBe(trap);
  });

  it('cooked, goes off under the first enemy to walk onto it', () => {
    const sim = field(['taiyaki']);
    const trap = sim.place(0, 2, 3)!;
    trap.readyAt = 0;
    const bug = spawn(sim, 'mushi_twolegs', 2, colY(3) - 60);
    run(sim, 6000);
    expect(trap.state).toBe('collapse');
    expect(sim.inPlay(bug)).toBe(false);
  });

  it('still stops ちいかぶ in disguise while it cooks: it shows its true form there, then walks on over it', () => {
    const sim = field(['taiyaki']);
    const trap = sim.place(0, 2, 3)!;
    const boss = spawn(sim, 'chiikabu', 2, colY(3) - 60);
    for (let t = 0; t < 8000 && boss.disguised; t += STEP_MS) sim.step(STEP_MS);
    expect(boss.disguised).toBe(false);
    // At the trap, not at the last tile.
    expect(boss.y).toBeGreaterThanOrEqual(colY(3));
    expect(boss.y).toBeLessThan(colY(3) + TILE);
    const at = boss.y;
    let bites = 0;
    run(sim, 4000, (ev) => {
      if (ev.type === 'enemyAttack') bites++;
    });
    expect(boss.y).toBeGreaterThan(at);
    expect(bites).toBe(0);
    expect(trap.hp).toBe(trap.maxHp);
  });
});

describe('擬態型', () => {
  it('never catches a trap in its song (owner’s call, 2026-11-12)', () => {
    const sing = (deck: string[], cols: number[]) => {
      const sim = field(deck);
      cols.forEach((col, card) => sim.place(card, 2, col));
      const singer = spawn(sim, 'guchokipanogitaigata', 2, FIELD_ENTRY_Y + 10);
      singer.hp = singer.maxHp = 1e6;
      const caught: string[][] = [];
      run(sim, 12000, (ev) => {
        if (ev.type === 'song') caught.push(ev.allies.map((a) => a.def.id));
      });
      return caught;
    };
    // With only a trap in its lane it does not sing at all;
    expect(sing(['taiyaki'], [1])).toEqual([]);
    // with a friend there too, the friend is the one caught.
    const caught = sing(['taiyaki', 'usagi'], [1, 0]);
    expect(caught.length).toBeGreaterThan(0);
    for (const ids of caught) expect(ids).toEqual(['usagi']);
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

  it('passes over a trap for the friend behind it, and finds nobody in a lane with only a trap (owner’s call, 2026-11-12)', () => {
    const sim = field(['taiyaki', 'yoroi']);
    sim.place(0, 2, 0);
    const wall = sim.place(1, 2, 2)!;
    const flier = spawn(sim, 'dekai_tori', 2, colY(4));
    let picked: Ally | null = null;
    for (let t = 0; t < 30000 && !picked; t += STEP_MS) {
      sim.step(STEP_MS);
      for (const ev of sim.drainEvents()) if (ev.type === 'hover' && ev.enemy === flier) picked = ev.ally;
    }
    expect(picked).toBe(wall);
    const lone = field(['taiyaki']);
    lone.place(0, 2, 0);
    expect((lone as unknown as { backmostAlly(lane: number): Ally | null }).backmostAlly(2)).toBeNull();
  });
});

describe('六足の虫 and ゴブリン (owner’s call, 2026-11-12)', () => {
  it('a lone うさぎ in any of the four back columns shoots 六足の虫 down before it jumps past', () => {
    for (const col of [0, 1, 2, 3]) {
      const sim = field(['usagi']);
      sim.place(0, 2, col);
      const bug = spawn(sim, 'mushi_sixlegs', 2, SPAWN_Y);
      for (let t = 0; t < 60000 && sim.inPlay(bug) && bug.y <= colY(col) + TILE && sim.status === 'playing'; t += STEP_MS) sim.step(STEP_MS);
      expect(sim.inPlay(bug), `うさぎ in column ${col}`).toBe(false);
    }
  });

  it('ゴブリン has the two-legged bug’s numbers', () => {
    const goblin = ENEMIES['goblin'];
    const bug = ENEMIES['mushi_twolegs'];
    expect([goblin.hp, goblin.speed, goblin.attack]).toEqual([bug.hp, bug.speed, bug.attack]);
  });
});

describe('after a win (owner’s call, 2026-11-12)', () => {
  it('a shot still in the air flies on until it is off the field, instead of hanging there', () => {
    const sim = field(['usagi']);
    sim.place(0, 2, 0);
    const bug = spawn(sim, 'mushi_twolegs', 2, colY(6));
    for (let t = 0; t < 10000 && !sim.projectiles.length; t += STEP_MS) sim.step(STEP_MS);
    const shot = sim.projectiles[0];
    expect(shot).toBeDefined();
    bug.state = 'gone';
    sim.status = 'won';
    const y0 = shot.y;
    // The battle itself is over...
    sim.step(STEP_MS);
    expect(shot.y).toBe(y0);
    // ...but the shot flies on.
    sim.settle(STEP_MS);
    expect(shot.y).toBeLessThan(y0);
    expect(sim.settled).toBe(false);
    for (let t = 0; t < 10000 && !sim.settled; t += STEP_MS) sim.settle(STEP_MS);
    expect(sim.settled).toBe(true);
    expect(sim.projectiles).toHaveLength(0);
  });

  it('is the only time the field runs on by itself', () => {
    const sim = field(['usagi']);
    sim.settle(1000);
    expect(sim.t).toBe(0);
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
  const compose = (w: EndlessWaves, wave: number) => (w as unknown as { compose(rng: Rng, n: number): SpawnDef[] }).compose(new Rng(7), wave);
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

describe('the battlefield', () => {
  it('gives nobody a line to say: no speech balloons or text boxes in battle (owner’s call, 2026-11-10)', () => {
    for (const d of [...UNIT_LIST, ...ENEMY_LIST]) expect(Object.keys(d).filter((k) => /phrase|speech|balloon/i.test(k)), d.id).toEqual([]);
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

describe('a friend’s end (owner’s call, 2026-11-11: no fading away)', () => {
  it('sent home, it is off its tile at once and off the field by the next step', () => {
    const sim = field(['usagi']);
    sim.place(0, 2, 3);
    expect(sim.remove(2, 3)).toBe(true);
    expect(sim.grid[2][3]).toBeNull();
    sim.step(STEP_MS);
    expect(sim.allies).toHaveLength(0);
  });

  it('beaten, it is gone just as fast', () => {
    const sim = field(['usagi']);
    sim.place(0, 2, 3);
    sim.devDefeatFriends();
    expect(sim.grid[2][3]).toBeNull();
    sim.step(STEP_MS);
    expect(sim.allies).toHaveLength(0);
  });
});
