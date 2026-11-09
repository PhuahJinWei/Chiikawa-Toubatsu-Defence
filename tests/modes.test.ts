import { describe, expect, it } from 'vitest';
import { ATTACK_RELEASE_MS, colOfY, colY, CONTACT, laneX, STEP_MS, TILE } from '../src/game/sim/constants';
import { ENEMIES } from '../src/game/sim/defs';
import { Sim } from '../src/game/sim/sim';
import { jumpMsOf, swingOf, tempoOf } from '../src/game/sim/tempo';
import type { Pickup, SimEvent } from '../src/game/sim/types';
import type { WaveSource } from '../src/game/sim/waves';

// Every character is always in one mode (owner's call, 2026-11-07). A mode with a length (a swing, a grab, a song, a
// heal, a spell, a transformation, a friend's attack) runs to its end before anything else happens; walking and waiting
// give way at once; only being defeated (or carried off) ends a mode early.

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
  const sim = new Sim({ lanes: [0, 1, 2, 3, 4], startWeeds: 9999, sprout: null, terrain: [], rescues: false, deck, seed: 5, waves: new NoWaves() });
  for (const c of sim.cards) c.cooldownLeft = 0;
  return sim;
}

/** Step until `done` (or `ms` have passed), collecting the events. */
function stepUntil(sim: Sim, done: () => boolean, ms = 10000): SimEvent[] {
  const events: SimEvent[] = [];
  for (let t = 0; t < ms && !done(); t += STEP_MS) {
    sim.step(STEP_MS);
    events.push(...(sim.drainEvents() as SimEvent[]));
  }
  return events;
}

const run = (sim: Sim, ms: number) => stepUntil(sim, () => false, ms);

describe('modes: what a character is doing runs to its end', () => {
  it('lets a swing play out when its friend is taken away midway: the blow falls on nobody, then it walks on', () => {
    const sim = field(['yoroi']);
    sim.place(0, 2, 3)!;
    sim.spawnEnemy(ENEMIES['mushi_horned'], 2, colY(3) + CONTACT, { waveIndex: 0 });
    const e = sim.enemies[0];
    stepUntil(sim, () => e.state === 'attack');
    const end = e.stateUntil;
    sim.remove(2, 3);
    const during: SimEvent[] = [];
    while (sim.t < end - STEP_MS) {
      during.push(...run(sim, STEP_MS));
      expect(e.state).toBe('attack');
    }
    expect(during.filter((ev) => ev.type === 'allyHit')).toEqual([]);
    run(sim, 300);
    expect(e.state).toBe('walk');
  });

  it('makes an ability that comes due mid-swing wait for the swing to end', () => {
    const sim = field(['yoroi', 'hachiware']);
    sim.place(0, 2, 3)!;
    // A friend behind the wall for 山姥 to chant at (she never chants at a wall).
    sim.place(1, 2, 2)!;
    sim.spawnEnemy(ENEMIES['yamanba'], 2, colY(3) + CONTACT, { waveIndex: 0 });
    const e = sim.enemies[0];
    e.hp = e.maxHp = 1e6;
    const spell = ENEMIES['yamanba'].abilities.find((a) => a.kind === 'spell')!;
    if (spell.kind !== 'spell') throw new Error('no spell');
    stepUntil(sim, () => e.state === 'attack');
    const end = e.stateUntil;
    e.abilityT = spell.cooldownMs;
    while (sim.t < end - STEP_MS) {
      run(sim, STEP_MS);
      expect(e.state).toBe('attack');
    }
    run(sim, 100);
    expect(e.state).toBe('spell');
  });

  it('ends any mode at once when it is defeated: a swing cut short by its fall lands no blow', () => {
    const sim = field(['yoroi']);
    const wall = sim.place(0, 2, 3)!;
    sim.spawnEnemy(ENEMIES['mushi_horned'], 2, colY(3) + CONTACT, { waveIndex: 0 });
    const e = sim.enemies[0];
    stepUntil(sim, () => e.state === 'attack');
    sim.damageEnemy(e, e.hp, 'test', 'fx_hit', true);
    expect(e.state).toBe('collapse');
    run(sim, 1500);
    expect(wall.hp).toBe(wall.maxHp);
  });

  it('lets でかい鳥 finish its grab: the talons close partway, and it flies off only once the grab is over', () => {
    const sim = field(['chiikawa']);
    const c = sim.place(0, 2, 2)!;
    sim.spawnEnemy(ENEMIES['dekai_tori'], 2, colY(3), { waveIndex: 0 });
    const bird = sim.enemies[0];
    stepUntil(sim, () => bird.state === 'attack', 60000);
    const start = sim.t;
    const swing = swingOf(ENEMIES['dekai_tori']);
    expect(c.state).not.toBe('carried');
    const y = bird.y;
    stepUntil(sim, () => c.state === 'carried');
    expect(sim.t - start).toBeCloseTo(swing.hitMs, -1.5);
    while (sim.t < start + swing.swingMs - STEP_MS) {
      run(sim, STEP_MS);
      expect(bird.state).toBe('attack');
      expect(bird.y).toBe(y);
    }
    run(sim, 500);
    expect(bird.flight!.out).toBe(true);
    expect(bird.y).toBeLessThan(y);
  });

  it('lets a friend’s attack play out whole even when it is silenced midway', () => {
    const sim = field(['hachiware']);
    const h = sim.place(0, 2, 2)!;
    sim.spawnEnemy(ENEMIES['mushi_twolegs'], 2, colY(4), { waveIndex: 0 });
    sim.enemies[0].hp = sim.enemies[0].maxHp = 1e6;
    stepUntil(sim, () => h.state === 'attack');
    const start = h.animStart;
    h.songUntil = sim.t + 5000;
    const during: SimEvent[] = [];
    while (sim.t < start + 480) {
      during.push(...run(sim, STEP_MS));
      expect(h.state).toBe('attack');
    }
    // Its blow still came (a hitscan's jab), and only then does it stand silenced.
    expect(during.filter((ev) => ev.type === 'jab' && ev.ally === h)).toHaveLength(1);
    run(sim, 100);
    expect(h.state).toBe('idle');
  });
});

// The moves that set the everyday enemies apart (owner's calls, 2026-11-07): ちゅーしです lunges at a friend within a
// tile, 六足の虫 jumps over every friend and never attacks, a goblin picks up the 草 growing where it walks, and
// キメラ, hurt low enough, draws her claws and then moves and claws twice as fast.
describe('the everyday enemies’ own moves', () => {
  /** A 草 lying in lane 2 on a tile (a weed growing there, or ちいかわ's find), as the field puts one. */
  const weedAt = (sim: Sim, col: number, kind: Pickup['kind'] = 'weed', claimedBy = -1): Pickup => {
    const p: Pickup = {
      uid: 9000 + col,
      kind,
      lane: 2,
      col,
      x: laneX(2),
      y: colY(col) + TILE * 0.28,
      value: 25,
      bornAt: 0,
      expiresAt: Infinity,
      autoAt: Infinity,
      state: 'idle',
      stateAt: 0,
      claimedBy,
    };
    sim.pickups.push(p);
    return p;
  };
  const damageTo = (events: SimEvent[], who: unknown) => events.flatMap((ev) => (ev.type === 'allyHit' && ev.ally === who ? [ev.damage] : []));

  it('ちゅーしです stops a tile away for a moment, then lunges: a dash in over its wind-up, a blow twice as hard, then its usual swings', () => {
    const sim = field(['yoroi']);
    const wall = sim.place(0, 2, 3)!;
    sim.spawnEnemy(ENEMIES['chushidesu'], 2, colY(5), { waveIndex: 0 });
    const e = sim.enemies[0];
    e.hp = e.maxHp = 1e6;
    const stopY = colY(3) + CONTACT;
    const ab = ENEMIES['chushidesu'].abilities.find((a) => a.kind === 'lunge')!;
    if (ab.kind !== 'lunge') throw new Error('no lunge');
    // It walks until a tile from its friend, and stops there, eyeing it.
    const before = stepUntil(sim, () => e.state === 'aim', 30000);
    expect(before.some((ev) => ev.type === 'enemyAttack')).toBe(false);
    expect(stopY - e.y).toBeLessThanOrEqual(TILE);
    expect(stopY - e.y).toBeGreaterThan(TILE - 10);
    // A moment, keeping still, before it pounces (its one attack is the lunge it starts at the end).
    const y = e.y;
    const start = sim.t;
    const pause = stepUntil(sim, () => {
      expect(e.y).toBe(y);
      return e.state !== 'aim';
    });
    expect(e.state).toBe('lunge');
    expect(sim.t - start).toBeGreaterThanOrEqual(ab.readyMs);
    expect(sim.t - start).toBeLessThan(ab.readyMs + STEP_MS * 2);
    expect(pause.filter((ev) => ev.type === 'enemyAttack')).toHaveLength(1);
    // The dash: it gets there by the time its blow lands, which hurts twice as much as a swing.
    const damage = ENEMIES['chushidesu'].attack.damage!;
    const lunge = stepUntil(sim, () => e.state !== 'lunge');
    expect(damageTo(lunge, wall)).toEqual([damage * 2]);
    expect(e.y).toBeCloseTo(stopY, 0);
    // Then it swings as usual, at its usual strength, without lunging again.
    const after = run(sim, 3000);
    const hits = damageTo(after, wall);
    expect(hits.length).toBeGreaterThan(2);
    expect(hits.every((d) => d === damage)).toBe(true);
    expect(e.y).toBeCloseTo(stopY, 0);
  });

  it('ちゅーしです never lunges backward: a friend put down on the tile it is in gets its usual swings where it stands', () => {
    const sim = field(['chiikawa']);
    sim.spawnEnemy(ENEMIES['chushidesu'], 2, colY(5), { waveIndex: 0 });
    const e = sim.enemies[0];
    e.hp = e.maxHp = 1e6;
    // With nobody near, it just walks.
    run(sim, 2000);
    expect(e.state).toBe('walk');
    const y = e.y;
    const c = sim.place(0, 2, colOfY(y))!;
    const events: SimEvent[] = [];
    for (let t = 0; t < 2000; t += STEP_MS) {
      events.push(...run(sim, STEP_MS));
      expect(e.state).not.toBe('lunge');
      expect(e.state).not.toBe('aim');
      expect(e.y).toBe(y);
    }
    const damage = ENEMIES['chushidesu'].attack.damage!;
    expect(damageTo(events, c).length).toBeGreaterThan(0);
    expect(damageTo(events, c).every((d) => d === damage)).toBe(true);
  });

  it('六足の虫 gets ready, jumps over every friend in its way and lands, one after another, and never attacks', () => {
    const sim = field(['yoroi', 'chiikawa']);
    const wall = sim.place(0, 2, 4)!;
    const c = sim.place(1, 2, 3)!;
    sim.spawnEnemy(ENEMIES['mushi_sixlegs'], 2, colY(6), { waveIndex: 0 });
    const bug = sim.enemies[0];
    const jump = ENEMIES['mushi_sixlegs'].abilities.find((a) => a.kind === 'jump')!;
    if (jump.kind !== 'jump') throw new Error('no jump');
    // Up to the wall.
    const walk = stepUntil(sim, () => bug.state === 'jump', 30000);
    const y0 = bug.y;
    expect(y0).toBeCloseTo(colY(4) + CONTACT, 0);
    const start = sim.t;
    // It gets ready where it is, still on the ground.
    const ready = stepUntil(sim, () => sim.t >= start + jump.readyMs - STEP_MS);
    expect(bug.y).toBe(y0);
    expect(ready.some((ev) => ev.type === 'jump')).toBe(false);
    // It leaves the ground, flies over the wall and comes down just past its tile, right at ちいかわ's.
    const air = stepUntil(sim, () => sim.t >= start + jump.readyMs + jump.airMs);
    expect(air.filter((ev) => ev.type === 'jump')).toHaveLength(1);
    expect(bug.y).toBeCloseTo(colY(3) + CONTACT, 0);
    // It steadies itself there, then goes straight over her too.
    const land = stepUntil(sim, () => sim.t >= start + jumpMsOf(jump) - STEP_MS);
    expect(bug.state).toBe('jump');
    expect(bug.y).toBeCloseTo(colY(3) + CONTACT, 0);
    const next = stepUntil(sim, () => bug.y > colY(3) + TILE && bug.state !== 'jump', 20000);
    expect(next.filter((ev) => ev.type === 'jump')).toHaveLength(1);
    expect(sim.t - start).toBeGreaterThanOrEqual(jumpMsOf(jump) * 2 - STEP_MS * 2);
    expect(sim.t - start).toBeLessThan(jumpMsOf(jump) * 2 + 100);
    // Past them both it walks on, and nobody was ever touched.
    const rest = run(sim, 2000);
    expect(bug.state).toBe('walk');
    for (const ev of [...walk, ...ready, ...air, ...land, ...next, ...rest]) expect(ev.type === 'allyHit' || ev.type === 'enemyAttack').toBe(false);
    expect(wall.hp).toBe(wall.maxHp);
    expect(c.hp).toBe(c.maxHp);
  });

  it('a goblin picks up the 草 growing where it walks (not ちいかわ’s finds, nor one she is pulling) and drops it when beaten', () => {
    const sim = field([]);
    const find = weedAt(sim, 6, 'drop');
    const pulled = weedAt(sim, 5, 'weed', 77);
    const grass = weedAt(sim, 4);
    sim.spawnEnemy(ENEMIES['goblin'], 2, colY(7), { waveIndex: 0 });
    const g = sim.enemies[0];
    g.hp = g.maxHp = 1e6;
    // It walks past ちいかわ's find and the 草 she is pulling, and over the one growing on its own until that one is
    // under its hand, about half a tile behind its front, where it bends down for it.
    const walk = stepUntil(sim, () => g.state === 'steal', 30000);
    expect(walk.some((ev) => ev.type === 'steal')).toBe(false);
    expect(g.y - grass.y).toBeGreaterThanOrEqual(TILE * 0.55);
    expect(g.y - grass.y).toBeLessThan(TILE * 0.55 + 10);
    const start = sim.t;
    const taking = stepUntil(sim, () => g.state !== 'steal');
    expect(sim.t - start).toBeCloseTo(500 * tempoOf(ENEMIES['goblin']), -1.5);
    expect(taking.filter((ev) => ev.type === 'steal')).toHaveLength(1);
    expect(grass.state).toBe('gone');
    expect(g.stolen).toEqual([25]);
    expect(find.state).toBe('idle');
    expect(pulled.state).toBe('idle');
    // The 草 is gone from the field and the goblin walks on; beaten, it drops it where it falls, sprouting there to
    // be picked up again.
    run(sim, 1000);
    expect(g.state).toBe('walk');
    expect(g.anim).toBe('walk');
    sim.damageEnemy(g, g.hp, 'test', 'fx_hit', true);
    const back = (sim.drainEvents() as SimEvent[]).find((ev) => ev.type === 'stolenBack');
    if (back?.type !== 'stolenBack') throw new Error('nothing dropped');
    expect(back.pickups).toHaveLength(1);
    const p = back.pickups[0];
    expect(p).toMatchObject({ kind: 'weed', value: 25, lane: 2, state: 'sprout', claimedBy: -1 });
    expect(Math.abs(p.y - g.y)).toBeLessThan(TILE / 2);
    expect(sim.pickups).toContain(p);
    expect(g.stolen).toEqual([]);
  });

  it('a goblin fighting a friend grabs a 草 that sprouts on its own tile, at its back: after its swing, then fights on', () => {
    const sim = field(['yoroi']);
    const wall = sim.place(0, 2, 3)!;
    sim.spawnEnemy(ENEMIES['goblin'], 2, colY(3) + CONTACT, { waveIndex: 0 });
    const g = sim.enemies[0];
    g.hp = g.maxHp = 1e6;
    // Mid-swing, a 草 sprouts on the tile it stands on (where the field grows one), behind its hand.
    stepUntil(sim, () => g.state === 'attack');
    run(sim, 100);
    const grass = weedAt(sim, 4);
    expect(g.y - grass.y).toBeGreaterThan(TILE * 0.75);
    const swingEnd = g.stateUntil;
    // The swing plays out, then it bends down for the 草, which is gone halfway through.
    const swing = stepUntil(sim, () => g.state !== 'attack');
    expect(sim.t).toBeGreaterThanOrEqual(swingEnd);
    expect(swing.some((ev) => ev.type === 'steal')).toBe(false);
    expect(g.state).toBe('steal');
    const taking = stepUntil(sim, () => g.state !== 'steal');
    expect(taking.filter((ev) => ev.type === 'steal')).toHaveLength(1);
    expect(grass.state).toBe('gone');
    expect(g.stolen).toEqual([25]);
    // Then it goes straight back to attacking the wall.
    const after = run(sim, 2000);
    expect(damageTo(after, wall).length).toBeGreaterThan(0);
  });

  it('a goblin still fights ちいかわ, and leaves the 草 on her tile alone while she stands', () => {
    const sim = field(['chiikawa']);
    const c = sim.place(0, 2, 3)!;
    weedAt(sim, 3);
    sim.spawnEnemy(ENEMIES['goblin'], 2, colY(4), { waveIndex: 0 });
    const g = sim.enemies[0];
    const events = run(sim, 12000);
    expect(damageTo(events, c).length).toBeGreaterThan(0);
    expect(events.some((ev) => ev.type === 'steal')).toBe(false);
    expect(g.stolen).toEqual([]);
  });

  it('キメラ starts with her claws hidden; hurt low enough she stops to draw them (once), then claws twice as often to the end, healed or not', () => {
    const sim = field(['yoroi']);
    const wall = sim.place(0, 2, 3)!;
    sim.spawnEnemy(ENEMIES['kimera'], 2, colY(3) + CONTACT, { waveIndex: 0 });
    const k = sim.enemies[0];
    const claws = ENEMIES['kimera'].abilities.find((a) => a.kind === 'claws')!;
    if (claws.kind !== 'claws') throw new Error('no claws');
    const interval = ENEMIES['kimera'].attack.intervalMs!;
    const damage = ENEMIES['kimera'].attack.damage!;
    /** Run on, noting when she starts each swing. */
    const swings = (ms: number) => {
      const at: number[] = [];
      const events: SimEvent[] = [];
      for (let t = 0; t < ms; t += STEP_MS) {
        const step = run(sim, STEP_MS);
        for (const ev of step) if (ev.type === 'enemyAttack' && ev.enemy === k) at.push(sim.t);
        events.push(...step);
      }
      return { gaps: at.slice(1).map((t, i) => t - at[i]), events };
    };
    const paced = (gaps: number[], cycle: number) => gaps.length > 1 && gaps.every((g) => g > cycle - 1 && g < cycle + STEP_MS + 1);
    // Claws hidden, she swings at her usual pace.
    stepUntil(sim, () => k.state === 'attack');
    expect(paced(swings(4000).gaps, interval + ATTACK_RELEASE_MS)).toBe(true);
    expect(k.form).toBe('normal');
    // Hurt low enough mid-swing, she finishes the swing, then stops and draws her claws (once; in her clawed form from
    // the start, whose frames hold the drawing), keeping still and hitting nobody.
    stepUntil(sim, () => k.state === 'attack');
    const swingEnd = k.stateUntil;
    sim.damageEnemy(k, k.hp - k.maxHp * claws.atHp, 'test', 'fx_hit', true);
    expect(k.form).toBe('normal');
    const swing = stepUntil(sim, () => k.state !== 'attack');
    expect(sim.t).toBeGreaterThanOrEqual(swingEnd);
    expect(k.state).toBe('claws');
    expect(k.form).toBe('claws');
    expect(swing.filter((ev) => ev.type === 'claws')).toHaveLength(1);
    const y = k.y;
    const start = sim.t;
    const drawing = stepUntil(sim, () => {
      // Still while she draws them (on the step that is over she is off again at once).
      if (k.state === 'claws') expect(k.y).toBe(y);
      return k.state !== 'claws';
    });
    expect(sim.t - start).toBeGreaterThanOrEqual(claws.ms - 1);
    expect(sim.t - start).toBeLessThan(claws.ms + STEP_MS * 2);
    expect(drawing.some((ev) => ev.type === 'enemyAttack' || ev.type === 'allyHit')).toBe(false);
    // From then on she claws twice as often, each blow as hard as ever.
    const fast = swings(4000);
    expect(paced(fast.gaps, interval / claws.attackSpeedMul + ATTACK_RELEASE_MS)).toBe(true);
    expect(damageTo(fast.events, wall).every((d) => d === damage)).toBe(true);
    // Healed back to full, she keeps it up, claws out, and never draws them again.
    k.hp = k.maxHp;
    const healed = swings(3000);
    expect(paced(healed.gaps, interval / claws.attackSpeedMul + ATTACK_RELEASE_MS)).toBe(true);
    expect(healed.events.some((ev) => ev.type === 'claws')).toBe(false);
    expect(k.form).toBe('claws');
  });

  it('キメラ hurt low enough as she walks stops there to draw her claws, then walks on twice as fast; felled in one blow from above that, she just falls, claws hidden', () => {
    const sim = field([]);
    sim.spawnEnemy(ENEMIES['kimera'], 2, colY(7), { waveIndex: 0 });
    sim.spawnEnemy(ENEMIES['kimera'], 3, colY(7), { waveIndex: 0 });
    const [k, other] = sim.enemies;
    const claws = ENEMIES['kimera'].abilities.find((a) => a.kind === 'claws')!;
    if (claws.kind !== 'claws') throw new Error('no claws');
    const y0 = k.y;
    run(sim, 1000);
    expect(k.state).toBe('walk');
    const calm = k.y - y0;
    // Just above her mark she walks on, claws hidden; just under it she stops to draw them.
    sim.damageEnemy(k, k.hp - (k.maxHp * claws.atHp + 1), 'test', 'fx_hit', true);
    run(sim, 200);
    expect(k.state).toBe('walk');
    expect(k.form).toBe('normal');
    sim.damageEnemy(k, 2, 'test', 'fx_hit', true);
    sim.damageEnemy(other, other.hp, 'test', 'fx_hit', true);
    const events = run(sim, STEP_MS);
    expect(k.state).toBe('claws');
    expect(other.state).toBe('collapse');
    expect(other.form).toBe('normal');
    expect(events.flatMap((ev) => (ev.type === 'claws' ? [ev.enemy] : []))).toEqual([k]);
    const y = k.y;
    stepUntil(sim, () => {
      // Still while she draws them (on the step that is over she is off again at once).
      if (k.state === 'claws') expect(k.y).toBe(y);
      return k.state !== 'claws';
    });
    // Claws out, she walks on twice as fast.
    const y1 = k.y;
    run(sim, 1000);
    expect(k.state).toBe('walk');
    expect(k.form).toBe('claws');
    expect((k.y - y1) / calm).toBeCloseTo(claws.moveSpeedMul, 1);
  });
});
