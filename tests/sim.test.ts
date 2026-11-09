import { describe, expect, it } from 'vitest';
import { BASE_Y, colY, CONTACT, FIELD_ENTRY_Y, HIT_LINE, RESCUE_BOSS_DAMAGE, STEP_MS, STUMP_HP, stumpStage, TILE } from '../src/game/sim/constants';
import { ENEMIES, UNITS } from '../src/game/sim/defs';
import { abilityBusyMs, abilityCycleMs, HEAL_PULSE_MS, healPauseOf, spawnMsOf } from '../src/game/sim/tempo';
import { Rng } from '../src/game/sim/rng';
import { Sim } from '../src/game/sim/sim';
import type { DevRules, Enemy, SimEvent } from '../src/game/sim/types';
import { expandSpawns, giantLane, LanePicker, type WaveSource } from '../src/game/sim/waves';

/** A wave source that never spawns anything, so tests can place enemies by hand. */
class NoWaves implements WaveSource {
  constructor(private finished = false) {}
  step(): void {}
  progress(): number {
    return 0;
  }
  flags() {
    return [];
  }
  done(): boolean {
    return this.finished;
  }
  currentWave(): number {
    return 0;
  }
}

function makeSim(
  deck: string[],
  opts: { weeds?: number; lanes?: number[]; rescues?: boolean; wish?: string; water?: number[]; terrain?: { lane: number; col: number; kind: 'stump' | 'bush' }[]; dev?: DevRules } = {},
) {
  const sim = new Sim({
    lanes: opts.lanes ?? [0, 1, 2, 3, 4],
    startWeeds: opts.weeds ?? 1000,
    sprout: null,
    terrain: opts.terrain ?? [],
    rescues: opts.rescues ?? true,
    deck,
    wish: opts.wish,
    water: opts.water,
    seed: 42,
    waves: new NoWaves(),
    dev: opts.dev,
  });
  for (const c of sim.cards) c.cooldownLeft = 0;
  return sim;
}

function run(sim: Sim, ms: number) {
  const steps = Math.ceil(ms / STEP_MS);
  for (let i = 0; i < steps && sim.status === 'playing'; i++) {
    sim.step(STEP_MS);
    sim.events.length = 0;
  }
}

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });
  it('shuffle() keeps every item once, in a new order, and leaves the list alone', () => {
    const r = new Rng(4);
    const items = [1, 2, 3, 4, 5, 6];
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const out = r.shuffle(items);
      expect([...out].sort((a, b) => a - b)).toEqual(items);
      orders.add(out.join());
    }
    expect(orders.size).toBeGreaterThan(1);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('sample() picks up to n different items, and all of them, drawing nothing, when there are no more', () => {
    const r = new Rng(5);
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = 0; i < 50; i++) {
      const got = r.sample(items, 3);
      expect(got).toHaveLength(3);
      expect(new Set(got).size).toBe(3);
      for (const v of got) expect(items).toContain(v);
    }
    const a = new Rng(9);
    const b = new Rng(9);
    expect(a.sample(items, 2)).toEqual(b.sample(items, 2));
    // No more than n: all of them, as they are, without a draw (a goes on as b does).
    expect(a.sample([1, 2], 3)).toEqual([1, 2]);
    expect(a.next()).toBe(b.next());
  });
  it('int() stays within bounds', () => {
    const r = new Rng(3);
    for (let i = 0; i < 500; i++) {
      const v = r.int(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

describe('placement', () => {
  it('spends weeds, starts the cooldown and occupies the tile', () => {
    const sim = makeSim(['hachiware'], { weeds: 150 });
    expect(sim.canPlace(0, 2, 3)).toBe('ok');
    expect(sim.place(0, 2, 3)).not.toBeNull();
    expect(sim.weeds).toBe(50);
    expect(sim.cards[0].cooldownLeft).toBeGreaterThan(0);
    expect(sim.canPlace(0, 2, 3)).toBe('occupied');
  });

  it('rejects unaffordable cards, inactive lanes and terrain', () => {
    const sim = new Sim({
      lanes: [1, 2, 3],
      startWeeds: 40,
      sprout: null,
      terrain: [{ lane: 2, col: 4, kind: 'stump' }],
      rescues: true,
      deck: ['hachiware'],
      seed: 1,
      waves: new NoWaves(),
    });
    sim.cards[0].cooldownLeft = 0;
    expect(sim.canPlace(0, 2, 2)).toBe('weeds');
    sim.weeds = 500;
    expect(sim.canPlace(0, 0, 2)).toBe('inactive');
    expect(sim.canPlace(0, 2, 4)).toBe('terrain');
  });

  it('removing an ally frees the tile', () => {
    const sim = makeSim(['yoroi']);
    sim.place(0, 1, 1);
    expect(sim.remove(1, 1)).toBe(true);
    expect(sim.allyAt(1, 1)).toBeNull();
  });
});

describe('start', () => {
  it('a ぶた入りラーメン券 has every friend ready from the start', () => {
    const base = { lanes: [2], startWeeds: 50, sprout: null, terrain: [], rescues: true, deck: ['yoroi_erai', 'shisa'], seed: 1, waves: new NoWaves() };
    expect(new Sim(base).cards.map((c) => c.cooldownLeft)).toEqual([12000, 3000]);
    expect(new Sim({ ...base, ready: true }).cards.map((c) => c.cooldownLeft)).toEqual([0, 0]);
  });
});

describe('combat', () => {
  it('ハチワレ only reaches 3 tiles along the lane', () => {
    const sim = makeSim(['hachiware']);
    sim.place(0, 2, 0);
    sim.spawnEnemy(ENEMIES['mushi_twolegs'], 2, colY(5) + 20, { waveIndex: 0 });
    const e = sim.enemies[0];
    e.y = colY(5) + 20; // 5 columns ahead: out of reach
    const hp = e.hp;
    // Freeze the enemy so only range matters.
    for (let i = 0; i < 120; i++) {
      e.y = colY(5) + 20;
      sim.step(STEP_MS);
    }
    expect(e.hp).toBe(hp);
    for (let i = 0; i < 200; i++) {
      e.y = colY(3) + HIT_LINE + 20;
      sim.step(STEP_MS);
    }
    expect(e.hp).toBeLessThan(hp);
  });

  it('armor reduces every hit by a flat amount', () => {
    const sim = makeSim([]);
    sim.spawnEnemy(ENEMIES['mushi_horned'], 1, 400, { waveIndex: 0 });
    const e = sim.enemies[0];
    const dealt = sim.damageEnemy(e, 30, 'test', 'fx_hit');
    expect(dealt).toBe(20);
    expect(sim.damageEnemy(e, 5, 'test', 'fx_hit')).toBe(1);
  });

  it('シーサー slows the enemy it hits', () => {
    const sim = makeSim(['shisa']);
    sim.place(0, 3, 0);
    sim.spawnEnemy(ENEMIES['mushi_twolegs'], 3, colY(6), { waveIndex: 0 });
    run(sim, 4000);
    expect(sim.enemies[0].slowUntil).toBeGreaterThan(sim.t);
  });

  it('うさぎ is the plain shot: her blast hits only the first enemy in her lane', () => {
    const sim = makeSim(['usagi'], { dev: { free: false, freeze: true, safeFriends: false, safeEnemies: false } });
    sim.place(0, 0, 0);
    sim.spawnEnemy(ENEMIES['kimera'], 0, colY(3), { waveIndex: 0 });
    sim.spawnEnemy(ENEMIES['kimera'], 0, colY(3) - 40, { waveIndex: 0 });
    const [a, b] = sim.enemies;
    run(sim, 3000);
    expect((a.maxHp - a.hp) % UNITS.usagi.attack.damage!).toBe(0);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBe(b.maxHp);
  });

  it('enemies stop at a wall and damage it', () => {
    const sim = makeSim(['yoroi']);
    const wall = sim.place(0, 4, 2)!;
    sim.spawnEnemy(ENEMIES['mushi_twolegs'], 4, colY(4), { waveIndex: 0 });
    run(sim, 20000);
    const e = sim.enemies[0];
    expect(e.state).toBe('engaged');
    expect(e.y).toBeLessThanOrEqual(colY(2) + CONTACT + 0.01);
    expect(wall.hp).toBeLessThan(wall.maxHp);
  });

  it('フグ stops three tiles short and spits', () => {
    const sim = makeSim(['yoroi']);
    const wall = sim.place(0, 1, 1)!;
    sim.spawnEnemy(ENEMIES['fugu'], 1, colY(6), { waveIndex: 0 });
    run(sim, 25000);
    const e = sim.enemies[0];
    // Its front stops two whole tiles before the wall's tile (three tiles off), and no nearer.
    expect(e.y).toBeLessThanOrEqual(colY(1) + CONTACT - 2 * TILE + 0.01);
    expect(e.y).toBeGreaterThan(colY(1) + CONTACT - 2 * TILE - 1);
    expect(wall.hp).toBeLessThan(wall.maxHp);
  });

  it('ゾウ defeats an ally in one stomp', () => {
    const sim = makeSim(['yoroi_erai']);
    const wall = sim.place(0, 2, 1)!;
    sim.spawnEnemy(ENEMIES['zou'], 2, colY(1), { waveIndex: 0 });
    run(sim, 4000);
    expect(wall.state).toBe('collapse');
  });
});

describe('abilities', () => {
  it('黒い星 heals the enemies in the 3×3 tiles round it (a lane and a tile and a half each way), and no further', () => {
    const sim = makeSim([]);
    sim.spawnEnemy(ENEMIES['kuroi_nagareboshi'], 2, colY(5), { waveIndex: 0 });
    const star = sim.enemies[0];
    const at = (lane: number, dy: number) => {
      sim.spawnEnemy(ENEMIES['kimera'], lane, colY(5) + dy, { waveIndex: 0 });
      const k = sim.enemies[sim.enemies.length - 1];
      k.hp = 500;
      return k;
    };
    const inside = [at(2, TILE * 1.4), at(1, -TILE * 1.4), at(3, TILE * 1.4), at(2, 0)];
    const outside = [at(2, TILE * 1.6), at(0, 0), at(4, 0), at(1, -TILE * 1.6)];
    // Everyone kept where they are, so only the reach counts.
    star.abilityT = 1e6;
    for (const e of sim.enemies) e.slowUntil = 0;
    sim.step(STEP_MS);
    for (const k of inside) expect(k.hp).toBeGreaterThan(500);
    for (const k of outside) expect(k.hp).toBe(500);
  });

  it('黒い星 heals nearby enemies', () => {
    const sim = makeSim([]);
    sim.spawnEnemy(ENEMIES['kuroi_nagareboshi'], 2, 300, { waveIndex: 0 });
    sim.spawnEnemy(ENEMIES['kimera'], 3, 300, { waveIndex: 0 });
    const k = sim.enemies[1];
    k.hp = 500;
    const ab = ENEMIES['kuroi_nagareboshi'].abilities.find((a) => a.kind === 'heal_aura')!;
    if (ab.kind !== 'heal_aura') throw new Error('no heal');
    run(sim, abilityCycleMs(ab) + 500);
    expect(k.hp).toBeGreaterThan(500);
  });

  it('黒い星 stops for a moment each time it heals, then drifts on, healing again a cooldown after each stop', () => {
    const sim = makeSim([]);
    sim.spawnEnemy(ENEMIES['kuroi_nagareboshi'], 2, colY(7), { waveIndex: 0 });
    const star = sim.enemies[0];
    const ab = ENEMIES['kuroi_nagareboshi'].abilities.find((a) => a.kind === 'heal_aura')!;
    if (ab.kind !== 'heal_aura') throw new Error('no heal');
    star.abilityT = ab.cooldownMs - 10;
    let heals = 0;
    const step = (ms: number) => {
      for (let i = 0; i < ms / STEP_MS; i++) {
        sim.step(STEP_MS);
        heals += sim.events.filter((ev) => ev.type === 'heal').length;
        sim.events.length = 0;
      }
    };
    step(50);
    expect(heals).toBe(1);
    expect(star.state).toBe('heal');
    const y = star.y;
    // It stays put for its whole stop (long enough for its pulse to be over), then drifts on.
    const pause = healPauseOf(ENEMIES['kuroi_nagareboshi']);
    expect(pause).toBeGreaterThanOrEqual(HEAL_PULSE_MS + 200);
    step(pause - 150);
    expect(star.y).toBe(y);
    step(300);
    expect(star.y).toBeGreaterThan(y);
    // Each cooldown starts once its stop is over: three more heals in the next three stops and cooldowns.
    step(abilityCycleMs(ab) * 3);
    expect(heals).toBe(4);
  });

  it('擬態型 sings as it goes, a few seconds after it arrives and again a cooldown after each song: three friends in its lane, picked at random, are caught', () => {
    const sim = makeSim(['hachiware']);
    // Five friends in its lane, near and far, and one in the lane beside it.
    const lane = [0, 1, 2, 3, 4].map((col) => put(sim, 0, 2, col));
    const beside = put(sim, 0, 1, 3);
    sim.spawnEnemy(ENEMIES['guchokipanogitaigata'], 2, colY(7), { waveIndex: 0 });
    const e = sim.enemies[0];
    e.hp = e.maxHp = 1e6;
    const song = ENEMIES['guchokipanogitaigata'].abilities.find((a) => a.kind === 'song')!;
    if (song.kind !== 'song') throw new Error('no song');
    const songs: number[] = [];
    const picked = new Set<number>();
    let y = e.y;
    for (let i = 0; i < (song.firstMs + abilityCycleMs(song) + 500) / STEP_MS; i++) {
      sim.step(STEP_MS);
      for (const ev of sim.events) {
        if (ev.type !== 'song') continue;
        songs.push(sim.t);
        // Three different friends of its lane are caught, the others not; none in the lane beside it.
        expect(ev.allies).toHaveLength(song.targets);
        expect(new Set(ev.allies).size).toBe(song.targets);
        for (const a of lane) {
          if (ev.allies.includes(a)) {
            expect(a.swayUntil).toBeCloseTo(sim.t + song.durationMs, -1);
            expect(a.songUntil).toBe(a.swayUntil);
            picked.add(a.uid);
          } else expect(a.swayUntil).toBeLessThanOrEqual(sim.t);
        }
        expect(beside.songUntil).toBe(0);
      }
      sim.events.length = 0;
      // It never stops for its song: it walks on.
      expect(e.y).toBeGreaterThan(y);
      y = e.y;
    }
    expect(songs).toHaveLength(2);
    expect(songs[0]).toBeGreaterThanOrEqual(song.firstMs - STEP_MS);
    expect(songs[0]).toBeLessThan(song.firstMs + STEP_MS * 2);
    // It sings again a cooldown after the sway is over, picking afresh: not the same three both times.
    expect(Math.abs(songs[1] - (songs[0] + song.durationMs) - song.cooldownMs)).toBeLessThanOrEqual(STEP_MS + 1);
    expect(picked.size).toBeGreaterThan(song.targets);
  });

  it('a cooldown starts when its ability is over: a longer song puts the next one back as much', () => {
    const base = ENEMIES['guchokipanogitaigata'];
    const song = base.abilities.find((a) => a.kind === 'song')!;
    if (song.kind !== 'song') throw new Error('no song');
    const long = { ...song, durationMs: song.durationMs + 2000 };
    const sim = makeSim(['hachiware']);
    put(sim, 0, 2, 0);
    sim.spawnEnemy({ ...base, abilities: [long] }, 2, colY(7), { waveIndex: 0 });
    const e = sim.enemies[0];
    e.hp = e.maxHp = 1e6;
    const songs: number[] = [];
    while (songs.length < 2 && sim.t < long.firstMs + abilityCycleMs(long) + 1000) {
      sim.step(STEP_MS);
      if (sim.events.some((ev) => ev.type === 'song')) songs.push(sim.t);
      sim.events.length = 0;
    }
    expect(songs).toHaveLength(2);
    expect(Math.abs(songs[1] - songs[0] - (long.durationMs + long.cooldownMs))).toBeLessThanOrEqual(STEP_MS + 1);
  });

  it('擬態型’s blows land twice as hard on a friend its song has caught', () => {
    const sim = makeSim(['yoroi']);
    const wall = put(sim, 0, 2, 3);
    sim.spawnEnemy(ENEMIES['guchokipanogitaigata'], 2, colY(3) + CONTACT, { waveIndex: 0 });
    const song = ENEMIES['guchokipanogitaigata'].abilities.find((a) => a.kind === 'song')!;
    if (song.kind !== 'song') throw new Error('no song');
    const damage = ENEMIES['guchokipanogitaigata'].attack.damage!;
    const hits: { d: number; sway: boolean }[] = [];
    for (let i = 0; i < 9000 / STEP_MS; i++) {
      sim.step(STEP_MS);
      for (const ev of sim.events) if (ev.type === 'allyHit' && ev.ally === wall) hits.push({ d: ev.damage, sway: wall.swayUntil > sim.t });
      sim.events.length = 0;
    }
    expect(hits.some((h) => h.sway)).toBe(true);
    expect(hits.some((h) => !h.sway)).toBe(true);
    for (const h of hits) expect(h.d).toBe(h.sway ? damage * song.relaxedDamageMul : damage);
  });

  it('ちいかぶ is untargetable until it transforms', () => {
    const sim = makeSim(['hachiware']);
    sim.place(0, 0, 0);
    sim.spawnEnemy(ENEMIES['chiikabu'], 0, colY(2), { waveIndex: 0 });
    const e = sim.enemies[0];
    expect(e.disguised).toBe(true);
    const hp = e.hp;
    // Walk it up to the ally: no damage while disguised.
    for (let i = 0; i < 60 * 20 && e.disguised; i++) {
      sim.step(STEP_MS);
      sim.events.length = 0;
    }
    expect(e.hp).toBe(hp);
    expect(e.disguised).toBe(false);
    expect(e.form).toBe('true');
    // After the reveal the ally attacks it.
    run(sim, 3000);
    expect(e.hp).toBeLessThan(hp);
  });
});

describe('economy', () => {
  it('ちいかわ produces weeds that are collected automatically', () => {
    const sim = makeSim(['chiikawa'], { weeds: 50 });
    sim.place(0, 0, 0);
    expect(sim.weeds).toBe(0);
    run(sim, 8000);
    expect(sim.weeds).toBe(25);
  });

  it('sprouted weeds can be tapped, then wilt if ignored', () => {
    const sim = new Sim({
      lanes: [2],
      startWeeds: 0,
      sprout: { firstMs: 100, minMs: 100000, maxMs: 100000, value: 25, lifeMs: 2000 },
      terrain: [],
      rescues: true,
      deck: [],
      seed: 9,
      waves: new NoWaves(),
    });
    run(sim, 300);
    const w = sim.pickups[0];
    expect(w.kind).toBe('weed');
    expect(sim.collect(w.uid)).toBe(true);
    expect(sim.weeds).toBe(25);
    expect(sim.collect(w.uid)).toBe(false);
  });
});

describe('rescue and outcome', () => {
  it('the car clears the lane once, then a second crossing loses', () => {
    const sim = makeSim([], { lanes: [1] });
    sim.spawnEnemy(ENEMIES['mushi_twolegs'], 1, BASE_Y - 5, { waveIndex: 0 });
    run(sim, 1500);
    expect(sim.stats.rescuesUsed).toBe(1);
    expect(sim.enemies.every((e) => e.state === 'collapse')).toBe(true);
    expect(sim.status).toBe('playing');
    run(sim, 2000);
    sim.spawnEnemy(ENEMIES['mushi_twolegs'], 1, BASE_Y - 5, { waveIndex: 0 });
    run(sim, 1000);
    expect(sim.status).toBe('lost');
  });

  it('the car only dents bosses', () => {
    const sim = makeSim([], { lanes: [1] });
    sim.spawnEnemy(ENEMIES['zou'], 1, BASE_Y - 5, { waveIndex: 0 });
    run(sim, 1000);
    const z = sim.enemies[0];
    expect(z.state).not.toBe('collapse');
    expect(z.hp).toBeLessThan(z.maxHp);
  });

  it('wins when waves are done and the field is clear', () => {
    const sim = new Sim({
      lanes: [0],
      startWeeds: 0,
      sprout: null,
      terrain: [],
      rescues: true,
      deck: [],
      seed: 1,
      waves: new NoWaves(true),
    });
    run(sim, 100);
    expect(sim.status).toBe('won');
  });

  it('enemies above the field cannot be targeted yet', () => {
    const sim = makeSim(['usagi']);
    sim.place(0, 2, 0);
    sim.spawnEnemy(ENEMIES['mushi_twolegs'], 2, FIELD_ENTRY_Y - 60, { waveIndex: 0 });
    const e = sim.enemies[0];
    for (let i = 0; i < 30; i++) {
      e.y = FIELD_ENTRY_Y - 60;
      sim.step(STEP_MS);
    }
    expect(sim.projectiles.length).toBe(0);
  });
});

/** Place a card, whatever its cooldown (tests place the same card more than once). */
function put(sim: Sim, card: number, lane: number, col: number) {
  sim.cards[card].cooldownLeft = 0;
  const a = sim.place(card, lane, col);
  if (!a) throw new Error(`could not place card ${card} at ${lane},${col}`);
  return a;
}

/** Step until a condition holds (or the time runs out). */
function runUntil(sim: Sim, done: () => boolean, maxMs: number) {
  for (let i = 0; i < maxMs / STEP_MS && !done() && sim.status === 'playing'; i++) {
    sim.step(STEP_MS);
    sim.events.length = 0;
  }
}

/** Step for a while, counting the events of each kind. */
function tally(sim: Sim, ms: number): Record<string, number> {
  const n: Record<string, number> = {};
  for (let i = 0; i < ms / STEP_MS && sim.status === 'playing'; i++) {
    sim.step(STEP_MS);
    for (const ev of sim.events) n[ev.type] = (n[ev.type] ?? 0) + 1;
    sim.events.length = 0;
  }
  return n;
}

describe('星 (a wish on a star)', () => {
  it('takes the card of the friend wished for, cost and recharge too, so that friend can come twice', () => {
    const sim = makeSim(['hachiware', 'hoshi'], { wish: 'hachiware' });
    expect(sim.cards.map((c) => c.def.id)).toEqual(['hachiware', 'hachiware']);
    expect(sim.cards.map((c) => c.star?.id)).toEqual([undefined, 'hoshi']);
    const weeds = sim.weeds;
    put(sim, 1, 2, 3);
    expect(sim.weeds).toBe(weeds - UNITS.hachiware.cost);
    expect(sim.cards[1].cooldownLeft).toBe(UNITS.hachiware.cooldownMs);
    // Each card waits on its own.
    expect(sim.canPlace(0, 2, 4)).toBe('ok');
  });

  it('waits out the wished friend’s opening recharge', () => {
    const sim = new Sim({ lanes: [2], startWeeds: 500, sprout: null, terrain: [], rescues: false, deck: ['hoshi'], wish: 'usagi', seed: 1, waves: new NoWaves() });
    expect(sim.cards[0].cooldownLeft).toBe(UNITS.usagi.initialCooldownMs);
  });

  it('stays home without a wish (and cannot wish to be itself)', () => {
    expect(makeSim(['hoshi', 'yoroi']).cards.map((c) => c.def.id)).toEqual(['yoroi']);
    expect(makeSim(['hoshi', 'yoroi'], { wish: 'hoshi' }).cards.map((c) => c.def.id)).toEqual(['yoroi']);
  });

  it('is a star for a moment, doing nothing, then turns into its friend, who fights from then on', () => {
    const sim = makeSim(['hoshi'], { wish: 'usagi' });
    sim.spawnEnemy(ENEMIES['mushi_twolegs'], 2, colY(7), { waveIndex: 0 });
    const e = sim.enemies[0];
    e.hp = e.maxHp = 1e6;
    const a = put(sim, 0, 2, 0);
    expect(a.def.id).toBe('usagi');
    expect(a.hp).toBe(UNITS.usagi.hp);
    expect(a.wishUntil).toBe(sim.t + UNITS.hoshi.wish!.transformMs);
    const before = tally(sim, UNITS.hoshi.wish!.transformMs - 100);
    expect(before.wishGranted ?? 0).toBe(0);
    expect(before.allyAttack ?? 0).toBe(0);
    expect(a.wishUntil).toBeGreaterThan(0);
    const after = tally(sim, 4000);
    expect(after.wishGranted).toBe(1);
    expect(a.wishUntil).toBe(0);
    expect(after.allyAttack ?? 0).toBeGreaterThan(0);
  });

  it('never turns if it is taken away first', () => {
    const sim = makeSim(['hoshi'], { wish: 'hachiware' });
    put(sim, 0, 1, 1);
    expect(sim.remove(1, 1)).toBe(true);
    expect(tally(sim, 3000).wishGranted ?? 0).toBe(0);
  });

  it('brings a one-use friend (オデ) the same way: a star on the tile first, then he goes and the tile is free', () => {
    const sim = makeSim(['hoshi'], { wish: 'ode' });
    sim.spawnEnemy(ENEMIES['mushi_twolegs'], 2, colY(6), { waveIndex: 0 });
    const bug = sim.enemies[0];
    const star = put(sim, 0, 2, 7);
    expect(star.wishUntil).toBe(sim.t + UNITS.hoshi.wish!.transformMs);
    // He has no HP to lend it, so it stands with its own.
    expect(star.hp).toBe(UNITS.hoshi.hp);
    expect(star.hp).toBeGreaterThan(0);
    const before = tally(sim, UNITS.hoshi.wish!.transformMs - 100);
    expect(before.oneUse ?? 0).toBe(0);
    expect(sim.allyAt(2, 7)).toBe(star);
    const after = tally(sim, 200);
    expect(after.oneUse).toBe(1);
    expect(after.wishGranted).toBe(1);
    expect(sim.allyAt(2, 7)).toBeNull();
    expect(sim.allies).not.toContain(star);
    run(sim, 3000);
    expect(bug.state).toBe('collapse');
  });

  it('needs an empty tile of its friend’s ground, even to bring むちゃうマン, who can go anywhere himself', () => {
    const sim = makeSim(['muchauman', 'hoshi', 'hachiware'], { wish: 'muchauman', water: [3] });
    put(sim, 2, 2, 3);
    // Himself: on the friend, or on the water.
    expect(sim.canPlace(0, 2, 3)).toBe('ok');
    expect(sim.canPlace(0, 3, 3)).toBe('ok');
    // As a star: it has to stand somewhere first.
    expect(sim.canPlace(1, 2, 3)).toBe('occupied');
    expect(sim.targetOpen(1, 2, 3)).toBe(false);
    expect(sim.canPlace(1, 3, 3)).toBe('water');
    expect(sim.targetOpen(1, 3, 3)).toBe(false);
    expect(sim.targetOpen(1, 2, 4)).toBe(true);
    put(sim, 1, 2, 4);
    expect(tally(sim, UNITS.hoshi.wish!.transformMs + 100).oneUse).toBe(1);
    expect(sim.allyAt(2, 4)).toBeNull();
  });

  it('never brings a one-use friend if its star is taken away first', () => {
    const sim = makeSim(['hoshi'], { wish: 'ode' });
    const star = put(sim, 0, 2, 7);
    expect(sim.remove(2, 7)).toBe(true);
    expect(star.state).toBe('collapse');
    expect(tally(sim, 3000).oneUse ?? 0).toBe(0);
  });
});

describe('the water lane (World 5)', () => {
  it('takes only the islanders (ヒトハ, フタバ, 島二郎), who take nothing else', () => {
    const sim = makeSim(['hachiware', 'futaba', 'hitoha', 'muchauman', 'shimajiro'], { water: [2] });
    expect(sim.canPlace(0, 2, 3)).toBe('water');
    expect(sim.canPlace(1, 1, 3)).toBe('land');
    expect(sim.canPlace(1, 2, 3)).toBe('ok');
    expect(sim.canPlace(2, 2, 4)).toBe('ok');
    expect(sim.canPlace(4, 2, 5)).toBe('ok');
    expect(sim.canPlace(4, 3, 5)).toBe('land');
    expect(sim.targetOpen(0, 2, 3)).toBe(false);
    expect(sim.targetOpen(1, 2, 3)).toBe(true);
    expect(sim.targetOpen(1, 1, 3)).toBe(false);
    // むちゃうマン appears wherever he is put, water or not.
    expect(sim.canPlace(3, 2, 5)).toBe('ok');
  });

  it('sends swimmers down the water and everyone else down the land', () => {
    const rng = new Rng(9);
    const picker = new LanePicker();
    const q = expandSpawns(
      [{ enemy: 'ningyo', count: 4 }, { enemy: 'mushi_twolegs', count: 12 }, { enemy: 'goblin', lane: 'all' }, { enemy: 'seiren', lane: 0 }],
      rng,
      [0, 1, 2, 3, 4],
      picker,
      0,
      0,
      [2],
    );
    for (const s of q) expect(s.lane === 2).toBe(!!s.def.aquatic);
    expect(q.filter((s) => s.def.id === 'goblin').map((s) => s.lane)).toEqual([0, 1, 3, 4]);
    // Without water, a mermaid walks any lane.
    const dry = expandSpawns([{ enemy: 'ningyo', count: 6 }], new Rng(9), [0, 1, 2, 3, 4], new LanePicker(), 0, 0);
    expect(new Set(dry.map((s) => s.lane)).size).toBeGreaterThan(1);
  });

  it('grows nothing and sends Rakko by boat', () => {
    const sim = new Sim({
      lanes: [1, 2, 3],
      startWeeds: 0,
      sprout: { firstMs: 0, minMs: 100, maxMs: 100, value: 25, lifeMs: 60000 },
      terrain: [],
      rescues: true,
      deck: [],
      seed: 3,
      water: [2],
      waves: new NoWaves(),
    });
    run(sim, 6000);
    // Every land tile has sprouted a weed (2 lanes × 9), and the water none.
    expect(sim.pickups.length).toBe(18);
    expect(sim.pickups.every((p) => p.lane !== 2)).toBe(true);
    expect(sim.rescues.map((r) => [r.lane, r.boat])).toEqual([[1, false], [2, true], [3, false]]);
  });

  it('makes フタバ and ヒトハ each throw 1.5× as fast with the other right beside', () => {
    // Throws by one of the pair (card `who`) in 30 s, alone or with the other on the next tile.
    const throws = (who: number, together: boolean) => {
      const sim = makeSim(['futaba', 'hitoha'], { water: [2] });
      const a = put(sim, who, 2, 1);
      if (together) put(sim, 1 - who, 2, 2);
      sim.spawnEnemy(ENEMIES['kuroi_nagareboshi'], 2, colY(7), { waveIndex: 0 });
      sim.enemies[0].hp = sim.enemies[0].maxHp = 1e7;
      let n = 0;
      for (let i = 0; i < 60 * 30; i++) {
        sim.step(STEP_MS);
        for (const ev of sim.events) if (ev.type === 'allyAttack' && ev.ally === a) n++;
        sim.events.length = 0;
      }
      return n;
    };
    for (const who of [0, 1]) {
      const ratio = throws(who, true) / throws(who, false);
      expect(ratio, `card ${who}`).toBeGreaterThan(1.35);
      expect(ratio, `card ${who}`).toBeLessThan(1.65);
    }
    // Neither softens the other's hits any more.
    const sim = makeSim(['futaba', 'hitoha'], { water: [2] });
    const h = put(sim, 1, 2, 4);
    put(sim, 0, 2, 3);
    sim.damageAlly(h, 100, 'test');
    expect(h.hp).toBe(h.maxHp - 100);
  });

  it('sends フタバ’s shells through every enemy in the lane, and ヒトハ’s spiral shell into the nearest one only', () => {
    const volley = (card: 'futaba' | 'hitoha') => {
      const sim = makeSim([card], { water: [2] });
      put(sim, 0, 2, 1);
      // Three mermaids one behind the other, too tough to fall, and a goblin in the next lane.
      const foes = [4, 5.5, 7].map((c) => {
        sim.spawnEnemy(ENEMIES['ningyo'], 2, colY(c), { waveIndex: 0 });
        const e = sim.enemies[sim.enemies.length - 1];
        e.hp = e.maxHp = 1e6;
        return e;
      });
      sim.spawnEnemy(ENEMIES['goblin'], 3, colY(5), { waveIndex: 0 });
      const other = sim.enemies[sim.enemies.length - 1];
      // One throw, and time for it to cross the field.
      runUntil(sim, () => sim.projectiles.length > 0, 10000);
      run(sim, 2500);
      return { hits: foes.map((e) => e.maxHp - e.hp), other: other.maxHp - other.hp, sim };
    };
    const f = volley('futaba');
    const shell = UNITS['futaba'].attack.damage!;
    expect(UNITS['futaba'].attack.passThrough).toBe(true);
    // Each mermaid hit by the shell exactly once (the first throw), whatever came after.
    for (const h of f.hits) expect(h % shell).toBe(0);
    for (const h of f.hits) expect(h).toBeGreaterThanOrEqual(shell);
    expect(f.other).toBe(0);
    const h = volley('hitoha');
    // Only the nearest mermaid (the deepest down the lane) is hit.
    expect(h.hits[0]).toBeGreaterThan(0);
    expect(h.hits[1]).toBe(0);
    expect(h.hits[2]).toBe(0);
    expect(UNITS['hitoha'].attack.damage!).toBeGreaterThan(shell);
  });

  it('puts 島二郎 on the water as its wall: he holds the mermaids and never attacks', () => {
    const sim = makeSim(['shimajiro', 'futaba'], { water: [2] });
    const wall = put(sim, 0, 2, 5);
    expect(UNITS['shimajiro'].wall && UNITS['shimajiro'].aquatic).toBe(true);
    sim.spawnEnemy(ENEMIES['ningyo'], 2, colY(7), { waveIndex: 0 });
    const e = sim.enemies[0];
    let swung = false;
    for (let i = 0; i < 20000 / STEP_MS; i++) {
      sim.step(STEP_MS);
      if (sim.events.some((ev) => ev.type === 'allyAttack' && ev.ally === wall)) swung = true;
      sim.events.length = 0;
    }
    // The mermaid stopped at him and bit him; nobody got past.
    expect(wall.hp).toBeLessThan(wall.maxHp);
    expect(e.y).toBeLessThan(colY(5) + TILE);
    expect(swung).toBe(false);
  });
});

describe('Rakko (v2 friend)', () => {
  it('hits hard up close and a tile ahead, straight through armour, and no further', () => {
    const sim = makeSim(['rakko']);
    put(sim, 0, 2, 3);
    // A horned bug (armoured) held a tile ahead: every blow lands in full. Then a goblin three tiles ahead: out of reach.
    sim.spawnEnemy(ENEMIES['mushi_horned'], 2, colY(4) + TILE / 2, { waveIndex: 0 });
    const bug = sim.enemies[0];
    bug.hp = bug.maxHp = 1e6;
    const hits: { enemy: number; damage: number; armored: boolean }[] = [];
    for (let i = 0; i < 3000 / STEP_MS; i++) {
      bug.y = bug.prevY = colY(4) + TILE / 2;
      sim.step(STEP_MS);
      for (const ev of sim.events) if (ev.type === 'hit') hits.push({ enemy: ev.enemy.uid, damage: ev.damage, armored: ev.armored });
      sim.events.length = 0;
    }
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.damage).toBe(UNITS['rakko'].attack.damage);
      expect(h.armored).toBe(false);
    }
    const far = makeSim(['rakko']);
    put(far, 0, 2, 3);
    far.spawnEnemy(ENEMIES['goblin'], 2, colY(6) + TILE / 2, { waveIndex: 0 });
    const g = far.enemies[0];
    let hit = false;
    for (let i = 0; i < 2000 / STEP_MS; i++) {
      g.y = g.prevY = colY(6) + TILE / 2;
      far.step(STEP_MS);
      if (far.events.some((ev) => ev.type === 'hit')) hit = true;
      far.events.length = 0;
    }
    expect(hit).toBe(false);
  });

  it('sweeps his sword through his lane and the lanes either side: everyone within two tiles in front of him, each once', () => {
    // Enemies held still (the testing ground's freeze): how often each is struck, and the most any is struck in a step.
    const sweep = (spawns: [string, number, number][]) => {
      const sim = makeSim(['rakko'], { dev: { free: false, freeze: true, safeFriends: false, safeEnemies: false } });
      put(sim, 0, 2, 3);
      const list = spawns.map(([id, lane, y]) => {
        sim.spawnEnemy(ENEMIES[id], lane, y, { waveIndex: 0 });
        const e = sim.enemies[sim.enemies.length - 1];
        e.hp = e.maxHp = 1e6;
        return e;
      });
      const got = new Map<number, number>();
      let most = 0;
      for (let i = 0; i < 3000 / STEP_MS; i++) {
        sim.step(STEP_MS);
        const now = new Map<number, number>();
        for (const ev of sim.events) if (ev.type === 'hit') now.set(ev.enemy.uid, (now.get(ev.enemy.uid) ?? 0) + 1);
        for (const [uid, n] of now) {
          got.set(uid, (got.get(uid) ?? 0) + n);
          most = Math.max(most, n);
        }
        sim.events.length = 0;
      }
      return { list, got, most };
    };
    const near = colY(3) + CONTACT;
    const ahead = colY(4) + TILE / 2;
    const second = colY(5) + TILE / 2;
    const far = colY(6) + TILE / 2;
    const level = colY(3) + TILE / 2;
    // A tile ahead in the lane above, up close in the lane below, two in his own lane and two tiles ahead in the lane above
    // (all cut); none two lanes off, nor three tiles ahead, nor level with him in the lanes either side.
    const r = sweep([
      ['mushi_twolegs', 1, ahead],
      ['mushi_twolegs', 3, near],
      ['mushi_twolegs', 2, near],
      ['mushi_twolegs', 2, ahead],
      ['mushi_twolegs', 0, ahead],
      ['mushi_twolegs', 4, near],
      ['mushi_twolegs', 3, far],
      ['mushi_twolegs', 1, level],
      ['mushi_twolegs', 3, level],
      ['mushi_twolegs', 1, second],
    ]);
    const [above, below, mine, alsoMine, twoUp, twoDown, belowFar, besideUp, besideDown, aboveSecond] = r.list;
    for (const e of [above, below, mine, alsoMine, aboveSecond]) expect(r.got.get(e.uid) ?? 0).toBeGreaterThan(1);
    expect(r.got.get(above.uid)).toBe(r.got.get(mine.uid));
    for (const e of [twoUp, twoDown, belowFar, besideUp, besideDown]) expect(r.got.get(e.uid) ?? 0).toBe(0);
    // He swings for an enemy in a lane beside his, with his own lane empty.
    const side = sweep([['mushi_twolegs', 3, ahead]]);
    expect(side.got.get(side.list[0].uid) ?? 0).toBeGreaterThan(0);
    // A giant across all three lanes is cut once a swing, not once a lane.
    const giant = sweep([['dekatsuyo', 2, ahead]]);
    expect(giant.list[0].half).toBe(1);
    expect(giant.got.get(giant.list[0].uid) ?? 0).toBeGreaterThan(1);
    expect(giant.most).toBe(1);
  });

  it('stands at the front: tough, but not a wall', () => {
    const r = UNITS['rakko'];
    expect(r.wall).toBeFalsy();
    expect(r.hp).toBeGreaterThan(UNITS['usagi'].hp * 5);
    expect(r.hp).toBeLessThan(UNITS['yoroi'].hp);
  });
});

describe('terrain (World 2)', () => {
  /** Damage each enemy takes from friends in `ms`, with the enemies held still where they were put. */
  const hits = (sim: Sim, ms: number) => {
    const got = new Map<number, number>();
    const blocked: number[] = [];
    for (let i = 0; i < ms / STEP_MS; i++) {
      for (const e of sim.enemies) e.y = e.prevY = (e as unknown as { at: number }).at;
      sim.step(STEP_MS);
      for (const ev of sim.events) {
        if (ev.type === 'hit') got.set(ev.enemy.uid, (got.get(ev.enemy.uid) ?? 0) + ev.damage);
        if (ev.type === 'blocked') blocked.push(ev.y);
      }
      sim.events.length = 0;
    }
    return { got, blocked };
  };
  const foe = (sim: Sim, id: string, lane: number, col: number) => {
    sim.spawnEnemy(ENEMIES[id], lane, colY(col) + TILE / 2, { waveIndex: 0 });
    const e = sim.enemies[sim.enemies.length - 1];
    e.hp = e.maxHp = 1e6;
    (e as unknown as { at: number }).at = e.y;
    return e;
  };

  const run = (sim: Sim, ms: number) => {
    const events: SimEvent[] = [];
    for (let i = 0; i < ms / STEP_MS; i++) {
      sim.step(STEP_MS);
      events.push(...sim.events);
      sim.events.length = 0;
    }
    return events;
  };
  const stumpAt = (col: number, lane = 2) => ({ terrain: [{ lane, col, kind: 'stump' as const }] });

  it('a stump stops straight shots and takes their damage: friends keep at it until it breaks and its tile is free', () => {
    const sim = makeSim(['usagi'], stumpAt(4));
    put(sim, 0, 2, 1);
    expect(sim.stumpHp[2][4]).toBe(STUMP_HP);
    const shots = Math.ceil(STUMP_HP / UNITS['usagi'].attack.damage!);
    const events = run(sim, (shots + 2) * 1700);
    expect(events.filter((e) => e.type === 'blocked')).toHaveLength(shots);
    expect(events.filter((e) => e.type === 'stumpHit' && e.broken)).toHaveLength(1);
    expect(sim.terrain[2][4]).toBeNull();
    expect(sim.stumpHp[2][4]).toBe(0);
    // The lane ahead is clear now: no more shots, and the tile takes a friend.
    expect(run(sim, 6000).filter((e) => e.type === 'shoot')).toEqual([]);
    sim.cards[0].cooldownLeft = 0;
    expect(sim.canPlace(0, 2, 4)).toBe('ok');
  });

  it('a friend takes no notice of a stump behind it', () => {
    const sim = makeSim(['usagi'], stumpAt(2));
    put(sim, 0, 2, 5);
    expect(run(sim, 5000).filter((e) => e.type === 'shoot')).toEqual([]);
  });

  it('a straight shot hits whatever comes first: an enemy before the stump, or the stump before an enemy beyond it', () => {
    const near = makeSim(['usagi'], stumpAt(4));
    put(near, 0, 2, 1);
    const g = foe(near, 'goblin', 2, 3);
    expect(hits(near, 6000).got.get(g.uid) ?? 0).toBeGreaterThan(0);
    expect(near.stumpHp[2][4]).toBe(STUMP_HP);
    const far = makeSim(['usagi'], stumpAt(4));
    put(far, 0, 2, 1);
    const o = foe(far, 'goblin', 2, 6);
    expect(hits(far, 6000).got.get(o.uid) ?? 0).toBe(0);
    expect(far.stumpHp[2][4]).toBeLessThan(STUMP_HP);
  });

  it('jabs, sword sweeps, lobbed cans and missiles go for the enemy past a stump and leave the stump alone', () => {
    for (const [id, col, at] of [['hachiware', 3, 5], ['rakko', 3, 4], ['kurimanju', 1, 6], ['usagi_cool', 1, 6]] as const) {
      const sim = makeSim([id], stumpAt(4));
      put(sim, 0, 2, col);
      const e = foe(sim, 'goblin', 2, at);
      const r = hits(sim, 9000);
      expect(r.got.get(e.uid) ?? 0, id).toBeGreaterThan(0);
      expect(r.blocked, id).toEqual([]);
      expect(sim.stumpHp[2][4], id).toBe(STUMP_HP);
    }
  });

  it('with no enemy to go for they turn on a stump: a blow within its reach, a can ahead, a missile anywhere in the lane', () => {
    const struck = (id: string, col: number, stump: number, ms: number) => {
      const sim = makeSim([id], stumpAt(stump));
      put(sim, 0, 2, col);
      run(sim, ms);
      return STUMP_HP - sim.stumpHp[2][stump];
    };
    expect(struck('hachiware', 1, 4, 3000)).toBeGreaterThan(0);
    expect(struck('hachiware', 1, 5, 3000)).toBe(0);
    expect(struck('rakko', 3, 4, 3000)).toBeGreaterThan(0);
    expect(struck('kurimanju', 0, 6, 8000)).toBeGreaterThan(0);
    expect(struck('usagi_cool', 6, 2, 12000)).toBeGreaterThan(0);
    // モモンガ's acorns fly down three lanes, so a stump in the lane beside hers counts.
    const m = makeSim(['momonga'], stumpAt(4, 3));
    put(m, 0, 2, 1);
    run(m, 5000);
    expect(m.stumpHp[3][4]).toBeLessThan(STUMP_HP);
  });

  it('enemies take no notice of a stump, and only フグ’s spit hurts one, when it is in the way', () => {
    // Nobody to spit at: フグ walks over the stump like anyone.
    const alone = makeSim(['usagi'], stumpAt(3));
    alone.spawnEnemy(ENEMIES['fugu'], 2, colY(6), { waveIndex: 0 });
    alone.spawnEnemy(ENEMIES['goblin'], 2, colY(6), { waveIndex: 0 });
    run(alone, 30000);
    expect(alone.stumpHp[2][3]).toBe(STUMP_HP);
    // A stump between フグ and the friend it spits at takes the spit, from three tiles off, until it breaks.
    const spit = makeSim(['yoroi'], stumpAt(3));
    const w = put(spit, 0, 2, 2);
    spit.spawnEnemy(ENEMIES['fugu'], 2, colY(6) + TILE / 2, { waveIndex: 0 });
    const f = spit.enemies[spit.enemies.length - 1];
    const events = run(spit, 40000);
    expect(f.y).toBeLessThanOrEqual(colY(2) + CONTACT - 2 * TILE + 0.01);
    expect(events.filter((e) => e.type === 'blocked')).toHaveLength(Math.ceil(STUMP_HP / ENEMIES['fugu'].attack.damage!));
    expect(spit.terrain[2][3]).toBeNull();
    expect(w.hp).toBeLessThan(w.maxHp);
  });

  it('フグ and a friend either side of a stump break it between them, so a lane never stalls', () => {
    const sim = makeSim(['yoroi', 'usagi'], stumpAt(4));
    put(sim, 0, 2, 3);
    put(sim, 1, 2, 1);
    sim.spawnEnemy(ENEMIES['fugu'], 2, colY(8), { waveIndex: 0 });
    const f = sim.enemies[sim.enemies.length - 1];
    run(sim, 60000);
    expect(sim.terrain[2][4]).toBeNull();
    expect(f.hp).toBeLessThanOrEqual(0);
  });

  it('draws a stump whole, cracked, then split as it wears down', () => {
    expect(stumpStage(STUMP_HP)).toBe(1);
    expect(stumpStage((STUMP_HP * 2) / 3 + 1)).toBe(1);
    expect(stumpStage((STUMP_HP * 2) / 3)).toBe(2);
    expect(stumpStage(STUMP_HP / 3 + 1)).toBe(2);
    expect(stumpStage(STUMP_HP / 3)).toBe(3);
    expect(stumpStage(1)).toBe(3);
  });

  it('フグ stops to spit only on the field and in the open: a friend near the road or a bush does not let it hide', () => {
    const walk = (sim: Sim, ms: number) => {
      for (let i = 0; i < ms / STEP_MS; i++) {
        sim.step(STEP_MS);
        sim.events.length = 0;
      }
    };
    // A wall near the far end of the lane would have it spit from out on the road, where nothing can aim at it.
    const road = makeSim(['yoroi']);
    put(road, 0, 2, 7);
    road.spawnEnemy(ENEMIES['fugu'], 2, -TILE * 2, { waveIndex: 0 });
    const r = road.enemies[road.enemies.length - 1];
    walk(road, 30000);
    expect(r.y).toBeGreaterThanOrEqual(FIELD_ENTRY_Y);
    // A friend comes within its reach while it is in a bush: it comes out of the bush first, where it can be aimed at.
    const leafy = makeSim(['yoroi'], { terrain: [{ lane: 2, col: 6, kind: 'bush' }] });
    leafy.spawnEnemy(ENEMIES['fugu'], 2, colY(6) + TILE / 2, { waveIndex: 0 });
    const b = leafy.enemies[leafy.enemies.length - 1];
    put(leafy, 0, 2, 4);
    walk(leafy, 20000);
    expect(['engaged', 'attack']).toContain(b.state);
    expect(b.y - (colY(6) + TILE / 2)).toBeGreaterThan(TILE * 0.31);
  });

  it('栗まんじゅう’s can splashes where it lands: every enemy in the 3×3 tiles round the spot takes the blow, none further', () => {
    const sim = makeSim(['kurimanju']);
    put(sim, 0, 2, 0);
    const at = (lane: number, dy: number) => {
      sim.spawnEnemy(ENEMIES['mushi_twolegs'], lane, colY(6) + dy, { waveIndex: 0 });
      const e = sim.enemies[sim.enemies.length - 1];
      e.hp = e.maxHp = 1e6;
      return e;
    };
    // Its target (the first in its lane), and others a lane and up to a tile and a half away; then some further off.
    const target = at(2, 0);
    const inside = [at(1, 0), at(3, TILE), at(2, -TILE * 1.4), at(1, TILE * 1.4)];
    const outside = [at(0, 0), at(4, 0), at(2, -TILE * 1.7), at(3, -TILE * 1.8)];
    let splash: Extract<SimEvent, { type: 'splash' }> | undefined;
    const fxOf = new Map<number, string>();
    for (let i = 0; i < 6000 / STEP_MS && !splash; i++) {
      sim.step(STEP_MS);
      for (const e of sim.events) if (e.type === 'hit') fxOf.set(e.enemy.uid, e.fx);
      splash = sim.events.find((e): e is Extract<SimEvent, { type: 'splash' }> => e.type === 'splash');
      sim.events.length = 0;
    }
    expect(splash).toMatchObject({ lane: 2, tiles: 1 });
    const can = UNITS['kurimanju'].attack.damage!;
    for (const e of [target, ...inside]) expect(e.maxHp - e.hp).toBe(can);
    for (const e of outside) expect(e.hp).toBe(e.maxHp);
    // The can lands on its target; the others are hit by the splash, and each shows it.
    expect(fxOf.get(target.uid)).toBe('fx_can');
    for (const e of inside) expect(fxOf.get(e.uid)).toBe('fx_can_splash');
  });

  it('a bush hides an enemy inside it: friends do not aim at it and shots fly past', () => {
    const sim = makeSim(['usagi', 'hachiware'], { terrain: [{ lane: 2, col: 5, kind: 'bush' }] });
    put(sim, 0, 2, 1);
    put(sim, 1, 2, 3);
    const hid = foe(sim, 'goblin', 2, 5);
    expect(sim.hidden(hid)).toBe(true);
    const r = hits(sim, 8000);
    expect(r.got.get(hid.uid) ?? 0).toBe(0);
    // Nobody wastes a throw on it: no attack is made at all.
    expect(sim.allies.every((a) => a.attackT > 0 || a.state !== 'attack')).toBe(true);
    // Out of the bush, it is fair game.
    const out = makeSim(['usagi'], { terrain: [{ lane: 2, col: 5, kind: 'bush' }] });
    put(out, 0, 2, 1);
    const g = foe(out, 'goblin', 2, 6);
    expect(out.hidden(g)).toBe(false);
    expect(hits(out, 6000).got.get(g.uid) ?? 0).toBeGreaterThan(0);
    // A giant is too big to hide in a bush.
    const big = makeSim([], { terrain: [{ lane: 2, col: 5, kind: 'bush' }] });
    big.spawnEnemy(ENEMIES['dekatsuyo'], 2, colY(5) + TILE / 2, { waveIndex: 0 });
    expect(big.hidden(big.enemies[0])).toBe(false);
  });
});

describe('giants (でかつよ, あのこ)', () => {
  it('come down the middle of the field, three lanes wide when three are open', () => {
    expect(ENEMIES['dekatsuyo'].giant && ENEMIES['anoko'].giant).toBe(true);
    expect(giantLane([0, 1, 2, 3, 4])).toBe(2);
    expect(giantLane([1, 2, 3])).toBe(2);
    expect(giantLane([2, 3, 4])).toBe(3);
    expect(giantLane([2])).toBe(null);
    const q = expandSpawns([{ enemy: 'dekatsuyo', lane: 0 }, { enemy: 'anoko', lane: 'random' }], new Rng(1), [0, 1, 2, 3, 4], new LanePicker(), 0, 0);
    expect(q.map((s) => s.lane)).toEqual([2, 2]);
    const wide = makeSim([]);
    wide.spawnEnemy(ENEMIES['dekatsuyo'], 2, colY(8), { waveIndex: 0 });
    expect(wide.enemies[0].half).toBe(1);
    expect([0, 1, 2, 3, 4].filter((l) => wide.covers(wide.enemies[0], l))).toEqual([1, 2, 3]);
    // With no lane open either side it is one lane wide.
    const narrow = makeSim([], { lanes: [2] });
    narrow.spawnEnemy(ENEMIES['dekatsuyo'], 2, colY(8), { waveIndex: 0 });
    expect(narrow.enemies[0].half).toBe(0);
  });

  it('are hit by friends in any of their three lanes, where the blow lands', () => {
    const sim = makeSim(['hachiware', 'usagi']);
    put(sim, 0, 1, 4);
    put(sim, 1, 3, 1);
    sim.spawnEnemy(ENEMIES['dekatsuyo'], 2, colY(6), { waveIndex: 0 });
    const g = sim.enemies[0];
    g.hp = g.maxHp = 1e6;
    const lanes = new Set<number>();
    for (let i = 0; i < 6000 / STEP_MS; i++) {
      sim.step(STEP_MS);
      for (const ev of sim.events) if (ev.type === 'hit' && ev.enemy === g) lanes.add(ev.lane);
      sim.events.length = 0;
    }
    expect([...lanes].sort()).toEqual([1, 3]);
  });

  it('stop at the first friend in any of their lanes and swing at the friend level with them in each', () => {
    const sim = makeSim(['hachiware', 'yoroi', 'chiikawa']);
    const h = put(sim, 0, 1, 5);
    const w = put(sim, 1, 3, 5);
    const c = put(sim, 2, 2, 3);
    sim.spawnEnemy(ENEMIES['dekatsuyo'], 2, colY(7), { waveIndex: 0 });
    const g = sim.enemies[0];
    g.hp = g.maxHp = 1e6;
    runUntil(sim, () => h.state === 'collapse', 30000);
    // Stopped at the front pair; one swing reaches both of them, not the friend further back in the middle lane.
    expect(h.state).toBe('collapse');
    expect(w.hp).toBeLessThan(w.maxHp);
    expect(c.hp).toBe(c.maxHp);
    expect(g.y).toBeLessThan(colY(5) + TILE);
  });

  it('call all three lanes’ cars when they reach the base', () => {
    const sim = makeSim([], { rescues: true });
    sim.spawnEnemy(ENEMIES['dekatsuyo'], 2, BASE_Y - 4, { waveIndex: 0 });
    const g = sim.enemies[0];
    const called: number[] = [];
    for (let i = 0; i < 3000 / STEP_MS && sim.status === 'playing'; i++) {
      sim.step(STEP_MS);
      for (const ev of sim.events) if (ev.type === 'rescue') called.push(ev.lane);
      sim.events.length = 0;
    }
    expect(called.sort()).toEqual([1, 2, 3]);
    expect(sim.stats.rescuesUsed).toBe(3);
    // Each car does what a car does to a boss; a giant that is still standing then gets through.
    expect(g.maxHp - g.hp).toBe(3 * 1500);
    expect(sim.status).toBe('lost');
  });
});

describe('v2 friends', () => {

  it('たい焼き cooks first: an enemy that reaches it before it is ready bites it like anyone, and nothing goes off', () => {
    const sim = makeSim(['taiyaki']);
    const t = put(sim, 0, 2, 3);
    expect(t.readyAt).toBe(sim.t + UNITS.taiyaki.mine!.readyMs);
    expect(t.anim).toBe('cook');
    sim.spawnEnemy(ENEMIES['mushi_twolegs'], 2, colY(3), { waveIndex: 0 });
    const bug = sim.enemies[0];
    const n = tally(sim, 2500);
    expect(n.mine ?? 0).toBe(0);
    expect(t.hp).toBeLessThan(t.maxHp);
    expect(bug.hp).toBe(bug.maxHp);
  });

  it('once cooked, the first enemy to reach it sets it off: every enemy on its tile or half a tile in front takes the blow, and it is used up (not lost)', () => {
    const sim = makeSim(['taiyaki']);
    const t = put(sim, 0, 2, 3);
    const m = UNITS.taiyaki.mine!;
    const n0 = tally(sim, m.readyMs + 100);
    expect(n0.cooked).toBe(1);
    expect(t.anim).toBe('idle');
    const spawn = (lane: number, y: number) => {
      const e = sim.spawnEnemy(ENEMIES['kimera'], lane, y, { waveIndex: 0 });
      e.hp = e.maxHp = 5000;
      return e;
    };
    const first = spawn(2, colY(3) - 10);
    const behind = spawn(2, colY(3) - TILE * 0.4);
    const far = spawn(2, colY(3) - TILE * 1.2);
    const other = spawn(1, colY(3) + 20);
    const n = tally(sim, 1500);
    expect(n.mine).toBe(1);
    expect(first.hp).toBe(5000 - m.damage);
    expect(behind.hp).toBe(5000 - m.damage);
    expect(far.hp).toBe(5000);
    expect(other.hp).toBe(5000);
    expect(sim.allyAt(2, 3)).toBeNull();
    expect(sim.stats.alliesLost).toBe(0);
  });

  it('オデ runs the length of his lane from the base end and runs over every enemy in it, as Rakko’s car does (a boss takes the car’s blow), leaving the rest alone', () => {
    const sim = makeSim(['ode', 'yoroi'], { water: [4] });
    // He is put down like any friend, on an empty land tile, and stands nowhere.
    const wall = put(sim, 1, 2, 7);
    expect(sim.canPlace(0, 2, 7)).toBe('occupied');
    expect(sim.canPlace(0, 4, 6)).toBe('water');
    expect(sim.targetOpen(0, 2, 7)).toBe(false);
    expect(sim.targetOpen(0, 2, 6)).toBe(true);
    const spawn = (id: string, lane: number, y: number) => sim.spawnEnemy(ENEMIES[id], lane, y, { waveIndex: 0 });
    const horned = spawn('mushi_horned', 2, colY(2));
    const far = spawn('kimera', 2, colY(8));
    const boss = spawn('mushi_pink', 2, colY(6));
    boss.hp = boss.maxHp = 10000;
    const other = spawn('mushi_twolegs', 1, colY(4));
    expect(sim.canPlace(0, 2, 6)).toBe('ok');
    expect(sim.place(0, 2, 6)).toBeNull();
    expect(sim.allyAt(2, 6)).toBeNull();
    expect(sim.sweeps.length).toBe(1);
    run(sim, 4000);
    expect(horned.state).toBe('collapse');
    expect(far.state).toBe('collapse');
    expect(boss.maxHp - boss.hp).toBe(RESCUE_BOSS_DAMAGE);
    expect(other.hp).toBe(other.maxHp);
    expect(wall.hp).toBe(wall.maxHp);
    expect(sim.allyAt(2, 7)).toBe(wall);
    expect(sim.sweeps.length).toBe(0);
    expect(sim.rescues.every((r) => r.state === 'parked')).toBe(true);
  });

  it('むちゃうマン strikes his pose, then every enemy freezes for a while (whatever it was doing waits), and then all goes on', () => {
    const sim = makeSim(['muchauman', 'yoroi']);
    const u = UNITS.muchauman.oneUse!;
    if (u.kind !== 'freeze') throw new Error('no freeze');
    const wall = put(sim, 1, 2, 3);
    const biter = sim.spawnEnemy(ENEMIES['mushi_twolegs'], 2, colY(3) + CONTACT, { waveIndex: 0 });
    const walker = sim.spawnEnemy(ENEMIES['mushi_twolegs'], 1, colY(6), { waveIndex: 0 });
    run(sim, 600);
    expect(sim.place(0, 4, 5)).toBeNull();
    expect(sim.cameos.length).toBe(1);
    // Until his pose is struck, everyone goes on.
    expect(tally(sim, 1000).freeze ?? 0).toBe(0);
    expect(tally(sim, 200).freeze).toBe(1);
    expect(biter.frozenUntil).toBeGreaterThan(sim.t);
    const y0 = walker.y;
    const hp0 = wall.hp;
    // One that comes after is not frozen.
    const late = sim.spawnEnemy(ENEMIES['mushi_twolegs'], 0, colY(6), { waveIndex: 0 });
    const yl = late.y;
    const n = tally(sim, u.freezeMs - 500);
    expect(walker.y).toBe(y0);
    expect(wall.hp).toBe(hp0);
    expect(n.enemyAttack ?? 0).toBe(0);
    expect(late.y).toBeGreaterThan(yl);
    // He has gone.
    expect(sim.cameos.length).toBe(0);
    // Thawed, they go on.
    run(sim, 2500);
    expect(walker.y).toBeGreaterThan(y0);
    expect(wall.hp).toBeLessThan(hp0);
  });

  it('ハチワレ（パジャマ） jabs up to 3 tiles ahead and pushes everyone it hits back a little; never a boss, and never off the field', () => {
    const sim = makeSim(['hachiware_pajama'], { dev: { free: false, freeze: true, safeFriends: false, safeEnemies: false } });
    put(sim, 0, 2, 0);
    put(sim, 0, 3, 0);
    put(sim, 0, 4, 6);
    const spawn = (id: string, lane: number, y: number) => {
      const e = sim.spawnEnemy(ENEMIES[id], lane, y, { waveIndex: 0 });
      e.hp = e.maxHp = 1e6;
      return e;
    };
    const bug = spawn('kimera', 2, colY(2) + 40);
    const behind = spawn('kimera', 2, colY(3) + HIT_LINE + 10);
    const boss = spawn('mushi_pink', 3, colY(2) + 40);
    const edge = spawn('kimera', 4, FIELD_ENTRY_Y + 10);
    const y0 = { bug: bug.y, behind: behind.y, boss: boss.y };
    runUntil(sim, () => bug.hp < bug.maxHp && boss.hp < boss.maxHp && edge.hp < edge.maxHp, 5000);
    run(sim, 400);
    expect(y0.bug - bug.y).toBeCloseTo(UNITS.hachiware_pajama.attack.pushTiles! * TILE, 5);
    expect(y0.behind - behind.y).toBeCloseTo(UNITS.hachiware_pajama.attack.pushTiles! * TILE, 5);
    expect(boss.y).toBe(y0.boss);
    expect(edge.y).toBe(FIELD_ENTRY_Y);
  });

  it('ハチワレ（パジャマ）’s push only delays: even the slowest enemy in his reach keeps getting closer', () => {
    const sim = makeSim(['hachiware_pajama']);
    put(sim, 0, 2, 0);
    const e = sim.spawnEnemy(ENEMIES['mushi_horned'], 2, colY(3) + 10, { waveIndex: 0 });
    e.hp = e.maxHp = 1e6;
    const y0 = e.y;
    run(sim, 26000);
    expect(e.y).toBeGreaterThan(y0 + TILE / 2);
  });

  it('ハチワレ jabs every enemy within her reach at once, and nobody past it', () => {
    const sim = makeSim(['hachiware'], { dev: { free: false, freeze: true, safeFriends: false, safeEnemies: false } });
    put(sim, 0, 2, 0);
    const spawn = (y: number) => {
      const e = sim.spawnEnemy(ENEMIES['kimera'], 2, y, { waveIndex: 0 });
      e.hp = e.maxHp = 1e6;
      return e;
    };
    const near = spawn(colY(1) + 40);
    const mid = spawn(colY(2) + 40);
    const last = spawn(colY(3) + HIT_LINE + 10);
    const past = spawn(colY(3) + HIT_LINE - 10);
    runUntil(sim, () => near.hp < near.maxHp, 4000);
    expect(mid.hp).toBe(near.hp);
    expect(last.hp).toBe(near.hp);
    expect(past.hp).toBe(past.maxHp);
  });

  it('reaches an enemy with a melee blow once its hit line is in reach, as a shot would, not just its nose', () => {
    for (const id of ['hachiware', 'hachiware_pajama', 'rakko'] as const) {
      const sim = makeSim([id], { dev: { free: false, freeze: true, safeFriends: false, safeEnemies: false } });
      put(sim, 0, 2, 1);
      const end = colY(1) - UNITS[id].attack.rangeTiles! * TILE;
      const spawn = (y: number) => {
        const e = sim.spawnEnemy(ENEMIES['kimera'], 2, y, { waveIndex: 0 });
        e.hp = e.maxHp = 1e6;
        return e;
      };
      const nose = spawn(end + HIT_LINE - 1);
      const body = spawn(end + HIT_LINE + 1);
      runUntil(sim, () => body.hp < body.maxHp, 4000);
      expect(body.hp, id).toBeLessThan(body.maxHp);
      expect(nose.hp, id).toBe(nose.maxHp);
    }
  });

  it('does not start a melee swing for an enemy with only its nose in reach', () => {
    const sim = makeSim(['rakko'], { dev: { free: false, freeze: true, safeFriends: false, safeEnemies: false } });
    const a = put(sim, 0, 2, 3);
    const e = sim.spawnEnemy(ENEMIES['kimera'], 2, colY(3) - UNITS['rakko'].attack.rangeTiles! * TILE + HIT_LINE - 1, { waveIndex: 0 });
    e.hp = e.maxHp = 1e6;
    run(sim, 3000);
    expect(a.anim).not.toBe('attack');
    expect(e.hp).toBe(e.maxHp);
  });

  it('says what a melee blow covers: its reach ahead, only open lanes, only on the field', () => {
    const swing = (id: string, lane: number, col: number, lanes = [0, 1, 2, 3, 4]) => {
      const sim = makeSim([id], { lanes, dev: { free: false, freeze: true, safeFriends: false, safeEnemies: false } });
      const a = put(sim, 0, lane, col);
      const e = sim.spawnEnemy(ENEMIES['kimera'], lane, colY(col) - TILE / 2, { waveIndex: 0 });
      e.hp = e.maxHp = 1e6;
      let seen: { lanes: number[]; lastCol: number } | undefined;
      for (let i = 0; i < 4000 / STEP_MS && !seen; i++) {
        sim.step(STEP_MS);
        for (const [at, ev] of sim.events.entries()) {
          if (ev.type !== 'swing') continue;
          expect(ev.ally).toBe(a);
          // Before its hits, so whoever shows a hit knows the blow it belongs to.
          expect(sim.events.slice(0, at).some((x) => x.type === 'hit')).toBe(false);
          seen = { lanes: ev.lanes, lastCol: ev.lastCol };
        }
        sim.events.length = 0;
      }
      return seen;
    };
    // Down her lane, three tiles ahead; only as far as the field goes.
    expect(swing('hachiware', 2, 1)).toEqual({ lanes: [2], lastCol: 4 });
    expect(swing('hachiware', 2, 7)).toEqual({ lanes: [2], lastCol: 8 });
    // His sweep: two tiles ahead, in three lanes; at the edge of the field, and beside closed lanes, only the lanes there are.
    expect(swing('rakko', 2, 3)).toEqual({ lanes: [1, 2, 3], lastCol: 5 });
    expect(swing('rakko', 0, 3)).toEqual({ lanes: [0, 1], lastCol: 5 });
    expect(swing('rakko', 2, 3, [2])).toEqual({ lanes: [2], lastCol: 5 });
  });

  it('うさぎ（クール） only poses; with nobody on the field no missile falls, then one falls on each lane with an enemy and blows up everyone round where it lands', () => {
    const sim = makeSim(['usagi_cool'], { dev: { free: false, freeze: true, safeFriends: false, safeEnemies: false } });
    const cool = put(sim, 0, 0, 0);
    expect(tally(sim, 6000).missiles ?? 0).toBe(0);
    const spawn = (lane: number, y: number) => sim.spawnEnemy(ENEMIES['kimera'], lane, y, { waveIndex: 0 });
    const a = spawn(2, colY(4));
    const b = spawn(2, colY(4) - 20);
    const d = spawn(4, colY(6));
    const n = tally(sim, 1500);
    expect(n.missiles).toBe(1);
    expect(n.blast).toBe(2);
    expect(n.allyAttack ?? 0).toBe(0);
    expect(cool.anim).toBe('idle');
    const dmg = UNITS.usagi_cool.attack.damage!;
    for (const e of [a, b, d]) expect(e.maxHp - e.hp).toBe(dmg);
  });

  it('ちいかわ（人魚の島）’s flame hits only the first enemy in her lane, hard, and nothing burns after', () => {
    const sim = makeSim(['chiikawa_island'], { dev: { free: false, freeze: true, safeFriends: false, safeEnemies: false } });
    put(sim, 0, 2, 0);
    const front = sim.spawnEnemy(ENEMIES['kimera'], 2, colY(4), { waveIndex: 0 });
    const back = sim.spawnEnemy(ENEMIES['kimera'], 2, colY(4) - 30, { waveIndex: 0 });
    runUntil(sim, () => front.hp < front.maxHp, 6000);
    const hp = front.hp;
    expect(front.maxHp - hp).toBe(UNITS.chiikawa_island.attack.damage);
    expect(back.hp).toBe(back.maxHp);
    run(sim, 1500);
    expect(front.hp).toBe(hp);
  });

  it('パジャマパーティーズ make friends in their lane attack 1.5× as often while they sing', () => {
    const count = (silenced: boolean) => {
      const sim = makeSim(['pajama_parties', 'hachiware']);
      const p = put(sim, 0, 1, 0);
      put(sim, 1, 1, 3);
      put(sim, 1, 3, 3);
      // Targets that never bite back, in reach of both.
      for (const lane of [1, 3]) sim.spawnEnemy(ENEMIES['kuroi_nagareboshi'], lane, colY(5), { waveIndex: 0 });
      for (const e of sim.enemies) e.hp = e.maxHp = 1e7;
      const n = [0, 0, 0, 0, 0];
      for (let i = 0; i < 60 * 30; i++) {
        if (silenced) p.songUntil = sim.t + 1000;
        sim.step(STEP_MS);
        for (const ev of sim.events) if (ev.type === 'allyAttack') n[ev.ally.lane]++;
        sim.events.length = 0;
      }
      return n[1] / n[3];
    };
    expect(count(false)).toBeGreaterThan(1.35);
    expect(count(false)).toBeLessThan(1.65);
    // Silenced by a song, they do not sing.
    expect(count(true)).toBeCloseTo(1, 1);
  });

  it('パジャマパーティーズ’ card brings one of the four members at a time, at random, and shows who is next', () => {
    const sim = makeSim(['pajama_parties'], { dev: { free: true, freeze: false, safeFriends: false, safeEnemies: false } });
    const seen = new Set<string>();
    for (const lane of [0, 1, 2, 3, 4]) {
      for (let col = 0; col < 9; col++) {
        const next = sim.cards[0].member;
        const a = sim.place(0, lane, col)!;
        expect(a.member).toBe(next);
        seen.add(a.member!);
      }
    }
    expect([...seen].sort()).toEqual([...UNITS.pajama_parties.members!].sort());
    // Nobody else comes in members.
    expect(put(makeSim(['usagi']), 0, 0, 0).member).toBeNull();
  });

  it('ちいかわ sits searching, plucks up what she finds, and it is hers at once: no weed is laid out to pick up', () => {
    const sim = makeSim(['chiikawa'], { weeds: 50 });
    const c = put(sim, 0, 2, 0);
    const first = UNITS.chiikawa.produce!.firstMs;
    run(sim, 1000);
    expect(c.anim).toBe('weed_search');
    // Her find begins a moment before the 草 is hers, her hand coming up with it.
    run(sim, first - 1000 - 480 + 30);
    expect(c.anim).toBe('weed_found');
    expect(sim.weeds).toBe(0);
    const n = tally(sim, 480);
    expect(n.weedCollect).toBe(1);
    expect(sim.weeds).toBe(25);
    expect(sim.pickups.some((p) => p.state === 'idle' || p.state === 'sprout')).toBe(false);
    // She holds it up a moment and goes back to searching.
    expect(c.anim).toBe('weed_found');
    run(sim, 500);
    expect(c.anim).toBe('weed_search');
  });

  it('栗まんじゅう’s can leaves her hand late, on her throw', () => {
    const sim = makeSim(['kurimanju'], { dev: { free: false, freeze: true, safeFriends: false, safeEnemies: false } });
    put(sim, 0, 2, 0);
    sim.spawnEnemy(ENEMIES['kimera'], 2, colY(4), { waveIndex: 0 });
    let attackAt = -1;
    let shotAt = -1;
    for (let i = 0; i < 5000 / STEP_MS && shotAt < 0; i++) {
      sim.step(STEP_MS);
      for (const ev of sim.events) {
        if (ev.type === 'allyAttack' && attackAt < 0) attackAt = sim.t;
        if (ev.type === 'shoot' && shotAt < 0) shotAt = sim.t;
      }
      sim.events.length = 0;
    }
    expect(shotAt - attackAt).toBeGreaterThanOrEqual(UNITS.kurimanju.attack.releaseMs! - 1);
    expect(shotAt - attackAt).toBeLessThan(UNITS.kurimanju.attack.releaseMs! + 40);
  });

  it('古本屋 throws two books at a time, a moment apart, and each one hits', () => {
    const sim = makeSim(['furuhonya'], { dev: { free: false, freeze: true, safeFriends: false, safeEnemies: false } });
    put(sim, 0, 2, 0);
    sim.spawnEnemy(ENEMIES['kimera'], 2, colY(4), { waveIndex: 0 });
    const shots: number[] = [];
    let hits = 0;
    for (let i = 0; i < 4000 / STEP_MS; i++) {
      sim.step(STEP_MS);
      for (const ev of sim.events) {
        if (ev.type === 'shoot') shots.push(sim.t);
        if (ev.type === 'hit' && ev.source === 'furuhonya') hits++;
      }
      sim.events.length = 0;
    }
    expect(shots.length).toBeGreaterThanOrEqual(4);
    // Two books a moment apart, then a whole interval to the next two.
    expect(shots[1] - shots[0]).toBeGreaterThan(150);
    expect(shots[1] - shots[0]).toBeLessThan(200);
    expect(shots[2] - shots[1]).toBeGreaterThan(1000);
    expect(shots[3] - shots[2]).toBeLessThan(200);
    expect(hits).toBeGreaterThanOrEqual(4);
  });
});

describe('v2 enemies', () => {
  it('山姥 stops to chant at five key friends anywhere on the field, picked at random (never a wall), a few seconds after she arrives and again a cooldown after each hold wears off', () => {
    const sim = makeSim(['hachiware', 'yoroi', 'chiikawa']);
    // A wall right in front of her, and eight friends who matter all over the field: every lane, near and far (four
    // of them two lanes from hers, so some of those are always picked).
    const wall = put(sim, 1, 2, 5);
    const key = [put(sim, 0, 2, 4), put(sim, 0, 1, 4), put(sim, 2, 3, 0), put(sim, 0, 1, 1), put(sim, 0, 0, 0), put(sim, 2, 0, 7), put(sim, 0, 4, 2), put(sim, 0, 4, 8)];
    sim.spawnEnemy(ENEMIES['yamanba'], 2, colY(6), { waveIndex: 0 });
    const y = sim.enemies[0];
    y.hp = y.maxHp = 1e6;
    const ab = ENEMIES['yamanba'].abilities.find((a) => a.kind === 'spell')!;
    if (ab.kind !== 'spell') throw new Error('no spell');
    const spellNow = () => {
      const ev = sim.events.find((e): e is Extract<SimEvent, { type: 'spell' }> => e.type === 'spell');
      sim.events.length = 0;
      return ev;
    };
    let spell: Extract<SimEvent, { type: 'spell' }> | undefined;
    while (!spell && sim.t < ab.firstMs + 1000) {
      sim.step(STEP_MS);
      spell = spellNow();
    }
    expect(sim.t).toBeGreaterThanOrEqual(ab.firstMs - STEP_MS);
    expect(sim.t).toBeLessThan(ab.firstMs + STEP_MS * 2);
    const first = spell!.allies;
    expect(first).toHaveLength(ab.targets);
    expect(new Set(first).size).toBe(ab.targets);
    for (const a of first) {
      expect(key).toContain(a);
      expect(a.spellUntil).toBeCloseTo(sim.t + ab.freezeMs, -1);
      expect(a.songUntil).toBe(a.spellUntil);
    }
    expect(first.some((a) => Math.abs(a.lane - 2) === 2)).toBe(true);
    for (const a of key) if (!first.includes(a)) expect(a.spellUntil).toBe(0);
    expect(wall.spellUntil).toBe(0);
    // She keeps still while she chants, and those held do not attack while it lasts.
    expect(y.state).toBe('spell');
    const at = y.y;
    const start = sim.t;
    let attacks = 0;
    while (sim.t < start + ab.freezeMs - 200) {
      sim.step(STEP_MS);
      for (const e of sim.events) if (e.type === 'allyAttack' && first.includes(e.ally)) attacks++;
      sim.events.length = 0;
      if (sim.t < start + ab.castMs - STEP_MS) expect(y.y).toBe(at);
    }
    expect(attacks).toBe(0);
    expect(y.state).not.toBe('spell');
    // She chants again a cooldown after her hold wears off, picking afresh.
    let next: Extract<SimEvent, { type: 'spell' }> | undefined;
    while (!next && sim.t < start + abilityCycleMs(ab) + 1000) {
      sim.step(STEP_MS);
      next = spellNow();
    }
    expect(abilityBusyMs(ab)).toBe(ab.freezeMs);
    expect(Math.abs(sim.t - (start + ab.freezeMs) - ab.cooldownMs)).toBeLessThanOrEqual(STEP_MS + 1);
    expect(next!.allies).toHaveLength(ab.targets);
    expect(new Set([...first, ...next!.allies]).size).toBeGreaterThan(ab.targets);
  });

  it('でかい鳥 flies over walls to the friend nearest the base, hovers, grabs it and carries it off for good', () => {
    const sim = makeSim(['chiikawa', 'yoroi']);
    const c = put(sim, 0, 2, 0);
    const w = put(sim, 1, 2, 5);
    sim.spawnEnemy(ENEMIES['dekai_tori'], 2, colY(7), { waveIndex: 0 });
    const bird = sim.enemies[0];
    let hovered = false;
    for (let i = 0; i < 60 * 120 && c.state !== 'carried'; i++) {
      sim.step(STEP_MS);
      if (sim.events.some((ev) => ev.type === 'hover')) hovered = true;
      sim.events.length = 0;
    }
    expect(hovered).toBe(true);
    expect(c.state).toBe('carried');
    expect(sim.allyAt(2, 0)).toBeNull();
    // It never bites: the wall it flew over is untouched.
    expect(w.hp).toBe(w.maxHp);
    runUntil(sim, () => !sim.enemies.includes(bird), 120000);
    expect(sim.enemies.includes(bird)).toBe(false);
    expect(sim.allies.includes(c)).toBe(false);
    expect(sim.stats.alliesLost).toBe(1);
    expect(sim.stats.enemiesDefeated).toBe(0);
    // It never reached the base: no rescue, no loss.
    expect(sim.status).toBe('playing');
    expect(sim.rescueOf(2)?.state).toBe('parked');
  });

  it('でかい鳥 shot down while carrying lets the friend land back on its tile', () => {
    const sim = makeSim(['chiikawa']);
    const c = put(sim, 0, 2, 0);
    sim.spawnEnemy(ENEMIES['dekai_tori'], 2, colY(3), { waveIndex: 0 });
    const bird = sim.enemies[0];
    runUntil(sim, () => c.state === 'carried', 120000);
    run(sim, 2000);
    sim.damageEnemy(bird, bird.hp, 'hachiware', 'fx_hit');
    expect(bird.state).toBe('collapse');
    expect(c.state).toBe('idle');
    expect(sim.allyAt(2, 0)).toBe(c);
  });

  it('でかい鳥 with nobody to take turns at the last tile and leaves', () => {
    const sim = makeSim([]);
    sim.spawnEnemy(ENEMIES['dekai_tori'], 2, colY(7), { waveIndex: 0 });
    runUntil(sim, () => sim.enemies.length === 0, 160000);
    expect(sim.enemies.length).toBe(0);
    expect(sim.status).toBe('playing');
    expect(sim.rescueOf(2)?.state).toBe('parked');
  });

  it('モモンガ’s acorns hit fliers twice as hard', () => {
    const sim = makeSim([]);
    sim.spawnEnemy(ENEMIES['dekai_tori'], 2, colY(5), { waveIndex: 0 });
    sim.spawnEnemy(ENEMIES['kimera'], 3, colY(5), { waveIndex: 0 });
    const [bird, kimera] = sim.enemies;
    expect(sim.damageEnemy(bird, 20, 'momonga', 'fx_acorn')).toBe(40);
    expect(sim.damageEnemy(kimera, 20, 'momonga', 'fx_acorn')).toBe(20);
    expect(sim.damageEnemy(bird, 20, 'usagi', 'fx_blast')).toBe(20);
  });

  it('あのこ falls at 0 HP like everyone else, and is gone once it has faded', () => {
    const sim = makeSim([]);
    sim.spawnEnemy(ENEMIES['anoko'], 2, colY(4), { waveIndex: 0 });
    const a = sim.enemies[0];
    sim.damageEnemy(a, a.hp, 'usagi', 'fx_blast');
    expect(a.state).toBe('collapse');
    expect(sim.stats.defeated['anoko']).toBe(1);
    expect(sim.aliveEnemies()).toBe(0);
    runUntil(sim, () => sim.enemies.length === 0, 5000);
    expect(sim.enemies.length).toBe(0);
  });

  it('stops for a friend put down on the tile its front is in and goes for it, but not for one behind it', () => {
    const sim = makeSim(['yoroi']);
    // 100 px into tile 4: past where it would have stopped for a friend standing there.
    sim.spawnEnemy(ENEMIES['mushi_twolegs'], 2, colY(4) + 100, { waveIndex: 0 });
    const e = sim.enemies[sim.enemies.length - 1];
    const behind = put(sim, 0, 2, 5);
    const onIt = put(sim, 0, 2, 4);
    run(sim, 3000);
    expect(['engaged', 'attack']).toContain(e.state);
    expect(e.targetUid).toBe(onIt.uid);
    expect(e.y).toBeCloseTo(colY(4) + 100, 5);
    expect(onIt.hp).toBeLessThan(onIt.maxHp);
    expect(behind.hp).toBe(behind.maxHp);
    // With the one on its tile gone, it walks on: the one behind it is not in its way.
    sim.remove(2, 4);
    run(sim, 1000);
    expect(e.y).toBeGreaterThan(colY(4) + 100);
    expect(e.state).toBe('walk');
  });

  it('小さい人魚 come in threes, one after another in the same lane', () => {
    const q = expandSpawns([{ enemy: 'ningyo', lane: 'random' }], new Rng(5), [0, 1, 2, 3, 4], new LanePicker(), 0, 0);
    expect(q.length).toBe(3);
    expect(new Set(q.map((s) => s.lane)).size).toBe(1);
    expect(q[2].at - q[0].at).toBeLessThan(1000);
  });

  it('セイレーン walks with her walk frames, never singing on the move, and now and then stops to sing and call up followers', () => {
    const sim = makeSim([], { water: [2] });
    sim.spawnEnemy(ENEMIES['seiren'], 2, FIELD_ENTRY_Y, { waveIndex: 0 });
    const e = sim.enemies[0];
    e.hp = e.maxHp = 1e6;
    const call = ENEMIES['seiren'].abilities.find((a) => a.kind === 'summon')!;
    if (call.kind !== 'summon') throw new Error('no call');
    expect(ENEMIES['seiren'].speed).toBe('normal');
    const calls: number[] = [];
    for (let i = 0; i < (call.firstMs + abilityCycleMs(call) + 500) / STEP_MS; i++) {
      const before = { state: e.state, y: e.y };
      sim.step(STEP_MS);
      if (sim.events.some((ev) => ev.type === 'summon')) calls.push(sim.t);
      sim.events.length = 0;
      // Walking, it uses its walk frames; calling, it stands still and sings.
      if (e.state === 'walk') expect(e.anim).toBe('walk');
      if (before.state === 'summon' && e.state === 'summon') expect(e.y).toBe(before.y);
      expect(e.state).not.toBe('sing');
    }
    expect(calls).toHaveLength(2);
    expect(Math.abs(calls[0] - call.firstMs)).toBeLessThanOrEqual(STEP_MS * 2);
    // It calls again a cooldown after its stop to sing is over.
    expect(Math.abs(calls[1] - calls[0] - abilityCycleMs(call))).toBeLessThanOrEqual(STEP_MS + 1);
  });

  it('セイレーン calls up 4–6 followers one by one through her song, round her column, in lanes dealt out at random: 人魚 on water, two-legged mermaids on land, never past a friend', () => {
    const call = ENEMIES['seiren'].abilities.find((a) => a.kind === 'summon')!;
    if (call.kind !== 'summon') throw new Error('no call');
    const counts = new Set<number>();
    for (let seed = 0; seed < 12; seed++) {
      const sim = makeSim(['yoroi'], { water: [2] });
      (sim as unknown as { rng: Rng }).rng = new Rng(1000 + seed);
      // A wall in every land lane on the very tile she stands on: whoever comes up there comes up in front of it.
      for (const lane of [0, 1, 3, 4]) put(sim, 0, lane, 4);
      const at = colY(4) + TILE / 2;
      sim.spawnEnemy(ENEMIES['seiren'], 2, at, { waveIndex: 0 });
      const e = sim.enemies[0];
      e.abilityT = call.cooldownMs;
      let start = -1;
      const came: { m: Enemy; t: number; y: number }[] = [];
      for (let i = 0; i < (call.castMs + 500) / STEP_MS; i++) {
        sim.step(STEP_MS);
        for (const ev of sim.events) {
          if (ev.type === 'summon') start = sim.t;
          if (ev.type !== 'callUp') continue;
          expect(ev.mob.state).toBe('spawn');
          expect(sim.enemies).toContain(ev.mob);
          came.push({ m: ev.mob, t: sim.t, y: ev.mob.y });
        }
        sim.events.length = 0;
        if (start >= 0 && sim.t < start + call.castMs - STEP_MS) expect(e.state).toBe('summon');
      }
      expect(start, `seed ${seed}`).toBeGreaterThan(0);
      counts.add(came.length);
      expect(came.length).toBeGreaterThanOrEqual(call.min);
      expect(came.length).toBeLessThanOrEqual(call.max);
      // One at a time, each at its own moment, all while she sings.
      for (let i = 1; i < came.length; i++) expect(came[i].t).toBeGreaterThan(came[i - 1].t);
      for (const c of came) {
        expect(c.t).toBeGreaterThan(start);
        expect(c.t).toBeLessThanOrEqual(start + call.castMs);
      }
      // Lanes dealt out: none has a second before every open lane has one.
      const per = [0, 1, 2, 3, 4].map((l) => came.filter((c) => c.m.lane === l).length);
      expect(Math.max(...per) - Math.min(...per)).toBeLessThanOrEqual(1);
      for (const { m, y } of came) {
        expect(m.def.id).toBe(m.lane === 2 ? call.water : call.land);
        // Round her column, just ahead of her front (not down the road); on land, in front of the wall on her tile.
        if (m.lane === 2) {
          expect(y).toBeGreaterThanOrEqual(at - 1);
          expect(y).toBeLessThanOrEqual(at + 0.6 * TILE + 1);
        } else expect(y).toBeCloseTo(colY(4) + CONTACT, 5);
      }
      // Each comes up, then walks on (or goes for the wall it came up at).
      for (let t = 0; t < spawnMsOf(came[0].m.def) + 2 * STEP_MS; t += STEP_MS) sim.step(STEP_MS);
      for (const { m } of came) expect(m.state).not.toBe('spawn');
    }
    // The number varies.
    expect(counts.size).toBeGreaterThan(1);
  });

  it('while セイレーン is on the field every mermaid, anywhere, moves twice as fast; nobody else, and not once she is gone', () => {
    const sim = makeSim([]);
    sim.spawnEnemy(ENEMIES['seiren'], 0, colY(7), { waveIndex: 0 });
    sim.spawnEnemy(ENEMIES['ningyo'], 4, colY(5), { waveIndex: 0 });
    sim.spawnEnemy(ENEMIES['mermaid_twolegs'], 3, colY(6), { waveIndex: 0 });
    sim.spawnEnemy(ENEMIES['mushi_twolegs'], 1, colY(6), { waveIndex: 0 });
    const [siren, mermaid, twoLegged, bug] = sim.enemies;
    const rally = ENEMIES['seiren'].abilities.find((a) => a.kind === 'rally')!;
    if (rally.kind !== 'rally') throw new Error('no rally');
    expect(sim.rallyMulOf(mermaid)).toBe(rally.speedMul);
    expect(sim.rallyMulOf(twoLegged)).toBe(rally.speedMul);
    expect(sim.rallyMulOf(bug)).toBe(1);
    expect(sim.rallyMulOf(siren)).toBe(1);
    const m0 = twoLegged.y;
    const b0 = bug.y;
    run(sim, 1000);
    expect((twoLegged.y - m0) / (bug.y - b0)).toBeCloseTo(rally.speedMul, 1);
    sim.damageEnemy(siren, 1e9, 'test', 'fx_hit', true);
    expect(sim.rallyMulOf(mermaid)).toBe(1);
  });
});
