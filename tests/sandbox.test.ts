import { describe, expect, it } from 'vitest';
import { BASE_Y, colY, CONTACT, SPAWN_Y, STEP_MS, TILE } from '../src/game/sim/constants';
import { ENEMIES } from '../src/game/sim/defs';
import { DEFAULT_DEV_RULES, type SandboxWaves, sandboxEnemies, sandboxTeam, sandboxWishes, simForSandbox, worldHasCars } from '../src/game/sim/sandbox';
import type { DevRules, SimEvent } from '../src/game/sim/types';

/** A testing ground on World 1's field (no water), with these rules, and no cars unless asked for. */
function ground(rules: Partial<DevRules> = {}, opts: { world?: number; cars?: boolean } = {}) {
  const r: DevRules = { ...DEFAULT_DEV_RULES, ...rules };
  const sim = simForSandbox({ world: opts.world ?? 1, cars: opts.cars ?? false }, sandboxTeam(), r);
  const waves = sim.waves as SandboxWaves;
  const card = (id: string) => sim.cards.findIndex((c) => c.def.id === id);
  const run = (ms: number): SimEvent[] => {
    const events: SimEvent[] = [];
    for (let t = 0; t < ms; t += STEP_MS) {
      sim.step(STEP_MS);
      events.push(...sim.drainEvents());
    }
    return events;
  };
  const spawn = (id: string, lane: number, y: number) => {
    sim.spawnEnemy(ENEMIES[id], lane, y, { waveIndex: 0 });
    return sim.enemies[sim.enemies.length - 1];
  };
  return { sim, rules: r, waves, card, run, spawn };
}

describe('the testing ground (dev mode)', () => {
  it('has every friend on the team, 星 too, every enemy to send, and the cars wherever the world has them', () => {
    const team = sandboxTeam();
    for (const id of ['chiikawa', 'rakko', 'shimajiro', 'taiyaki', 'hoshi']) expect(team).toContain(id);
    expect(sandboxEnemies()).toEqual(expect.arrayContaining(['mushi_twolegs', 'dekatsuyo', 'anoko']));
    expect(worldHasCars(1)).toBe(true);
    expect(worldHasCars(6)).toBe(false);
  });

  it('puts 星 in the tray as the friend picked for it, and can change who at once (a star already down keeps its wish)', () => {
    const { sim } = ground();
    expect(sandboxWishes()).toEqual(sandboxTeam().filter((id) => id !== 'hoshi'));
    // First in the tray: at the end of it, it would be off the screen.
    const star = 0;
    expect(sim.cards[star].star?.id).toBe('hoshi');
    expect(sim.cards[star].def.id).toBe(sandboxWishes()[0]);
    const first = sim.place(star, 1, 1)!;
    expect(first.wishUntil).toBeGreaterThan(0);
    sim.devSetWish('usagi');
    expect(sim.cards[star].def.id).toBe('usagi');
    expect(first.def.id).toBe(sandboxWishes()[0]);
    expect(sim.place(star, 1, 2)!.def.id).toBe('usagi');
    // It cannot wish to be itself, nor to be nobody.
    sim.devSetWish('hoshi');
    sim.devSetWish('nobody');
    expect(sim.cards[star].def.id).toBe('usagi');
    const picked = simForSandbox({ world: 1, cars: false }, sandboxTeam(), { ...DEFAULT_DEV_RULES }, { wish: 'momonga' });
    expect(picked.cards.find((c) => c.star)?.def.id).toBe('momonga');
  });

  it('free cards cost nothing and are ready again at once; switched off, they cost and recharge', () => {
    const { sim, rules, card } = ground();
    const yoroi = card('yoroi');
    const before = sim.weeds;
    expect(sim.place(yoroi, 1, 1)).not.toBeNull();
    expect(sim.place(yoroi, 1, 2)).not.toBeNull();
    expect(sim.weeds).toBe(before);
    expect(sim.cards[yoroi].cooldownLeft).toBe(0);
    // The ground still has to be free (a wall goes on its own kind only once that one is worn).
    expect(sim.canPlace(yoroi, 1, 1)).toBe('unworn');
    rules.free = false;
    expect(sim.place(yoroi, 1, 3)).not.toBeNull();
    expect(sim.weeds).toBe(before - sim.cards[yoroi].def.cost);
    expect(sim.canPlace(yoroi, 1, 4)).toBe('cooldown');
  });

  it('unbeatable friends feel every bite and lose nothing', () => {
    const { sim, rules, card, run, spawn } = ground({ safeFriends: true });
    const a = sim.place(card('yoroi'), 2, 3)!;
    // Already biting: at the stop line in front of the friend.
    spawn('mushi_twolegs', 2, colY(3) + CONTACT);
    const events = run(4000);
    expect(events.some((ev) => ev.type === 'allyHit' && ev.ally === a && ev.damage === 0)).toBe(true);
    expect(a.hp).toBe(a.maxHp);
    rules.safeFriends = false;
    run(4000);
    expect(a.hp).toBeLessThan(a.maxHp);
  });

  it('unbeatable enemies take every blow and lose nothing', () => {
    const { sim, rules, card, run, spawn } = ground({ safeEnemies: true });
    sim.place(card('usagi'), 2, 0);
    const e = spawn('mushi_twolegs', 2, colY(4));
    const events = run(3000);
    expect(events.some((ev) => ev.type === 'hit' && ev.enemy === e)).toBe(true);
    expect(e.hp).toBe(e.maxHp);
    rules.safeEnemies = false;
    run(3000);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('frozen enemies on the field hold still, while one still on the road walks in', () => {
    const { rules, run, spawn } = ground({ freeze: true });
    const still = spawn('mushi_twolegs', 1, colY(6));
    const road = spawn('mushi_twolegs', 3, SPAWN_Y);
    run(2000);
    expect(still.y).toBe(colY(6));
    expect(road.y).toBeGreaterThan(SPAWN_Y);
    rules.freeze = false;
    run(1000);
    expect(still.y).toBeGreaterThan(colY(6));
  });

  it('is never lost or won: an enemy that gets through with no car just leaves the field', () => {
    const { sim, run, spawn, waves } = ground({}, { cars: false });
    const e = spawn('mushi_twolegs', 2, BASE_Y - 5);
    run(3000);
    expect(e.state).toBe('gone');
    expect(sim.status).toBe('playing');
    expect(waves.done()).toBe(false);
  });

  it('sends enemies down the road when asked (a giant always down the middle)', () => {
    const { sim, waves, run } = ground();
    waves.send([{ enemy: 'mushi_twolegs', count: 3, lane: 1 }], sim);
    expect(sim.enemies).toHaveLength(0);
    run(4000);
    const sent = sim.enemies.filter((e) => e.def.id === 'mushi_twolegs');
    expect(sent).toHaveLength(3);
    expect(sent.every((e) => e.lane === 1)).toBe(true);
    waves.send([{ enemy: 'mushi_twolegs', count: 1, lane: 'all' }], sim);
    run(4000);
    expect(new Set(sim.enemies.filter((e) => e.def.id === 'mushi_twolegs').map((e) => e.lane)).size).toBe(5);
    waves.send([{ enemy: 'dekatsuyo', count: 1, lane: 0 }], sim);
    run(1000);
    expect(sim.enemies.find((e) => e.def.id === 'dekatsuyo')?.lane).toBe(2);
  });

  it('puts enemies straight onto a column, one behind the other', () => {
    const { sim, waves } = ground();
    waves.place([{ enemy: 'mushi_twolegs', count: 2, lane: 3 }], 4, sim);
    const placed = sim.enemies.filter((e) => e.lane === 3);
    expect(placed).toHaveLength(2);
    expect(placed[0].y).toBe(colY(4) + TILE / 2);
    expect(placed[1].y).toBeCloseTo(colY(4) + TILE / 2 - TILE * 0.35);
  });

  it('edits terrain, heals, picks, parks the cars again and clears the field', () => {
    const { sim, card, run, spawn } = ground({}, { cars: true });
    sim.devCycleTerrain(0, 5);
    expect(sim.terrain[0][5]).toBe('stump');
    expect(sim.stumpHp[0][5]).toBeGreaterThan(0);
    sim.devCycleTerrain(0, 5);
    expect(sim.terrain[0][5]).toBe('bush');
    expect(sim.stumpHp[0][5]).toBe(0);
    sim.devCycleTerrain(0, 5);
    expect(sim.terrain[0][5]).toBeNull();

    const a = sim.place(card('yoroi'), 1, 2)!;
    a.hp = 10;
    const e = spawn('mushi_twolegs', 4, colY(5) + TILE / 2);
    e.hp = 1;
    sim.devHealAll();
    expect(a.hp).toBe(a.maxHp);
    expect(e.hp).toBe(e.maxHp);
    expect(sim.devPick(1, 2)).toBe(a);
    expect(sim.devPick(4, 5)).toBe(e);
    expect(sim.devPick(0, 0)).toBeNull();

    // Lane 0's car goes for an enemy at the base, then parks again.
    spawn('mushi_twolegs', 0, BASE_Y - 5);
    run(1000);
    expect(sim.rescues.find((r) => r.lane === 0)?.state).not.toBe('parked');
    sim.devRefillCars();
    expect(sim.rescues.every((r) => r.state === 'parked')).toBe(true);

    // Defeating everyone: each falls as in battle (its fall plays, then it is gone).
    const standing = sim.enemies.filter((x) => sim.inPlay(x));
    sim.devDefeatEnemies();
    expect(sim.enemies.some((x) => sim.inPlay(x))).toBe(false);
    expect(standing.every((x) => x.state === 'collapse' && x.anim === 'collapse')).toBe(true);
    sim.devDefeatFriends();
    expect(sim.allyAt(1, 2)).toBeNull();
    expect(a.state).toBe('collapse');
    // A friend has no defeat frames: it fades away as it was.
    expect(a.anim).not.toBe('collapse');
    expect(sim.status).toBe('playing');
    run(5000);
    expect(sim.enemies).toHaveLength(0);
    expect(sim.allies).toHaveLength(0);
  });
});
