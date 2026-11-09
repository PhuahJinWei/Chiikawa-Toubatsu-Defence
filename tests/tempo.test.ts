import { describe, expect, it } from 'vitest';
import { BREATH_MS, BREATH_RISE, spriteFor, spriteFrame } from '../src/art/sprite';
import { ATTACK_RELEASE_MS, colY, CONTACT, STEP_MS } from '../src/game/sim/constants';
import { ENEMIES } from '../src/game/sim/defs';
import { Sim } from '../src/game/sim/sim';
import { BOSS_FALL, deathMsOf, fallMsOf, swingOf, TEMPO, tempoOf } from '../src/game/sim/tempo';
import type { SimEvent } from '../src/game/sim/types';
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
  const sim = new Sim({ lanes: [0, 1, 2, 3, 4], startWeeds: 9999, sprout: null, terrain: [], rescues: false, deck, seed: 7, waves: new NoWaves() });
  for (const c of sim.cards) c.cooldownLeft = 0;
  return sim;
}

describe('tempo: bigger characters move slower, giants slowest', () => {
  it('slows every size in turn', () => {
    expect(tempoOf(ENEMIES['goblin'])).toBe(TEMPO.S);
    expect(tempoOf(ENEMIES['mushi_horned'])).toBe(TEMPO.L);
    expect(tempoOf(ENEMIES['zou'])).toBe(TEMPO.XL);
    expect(tempoOf(ENEMIES['dekatsuyo'])).toBe(TEMPO.giant);
    // ちいかぶ's true form moves like the big one it is.
    expect(tempoOf(ENEMIES['chiikabu'], 'true')).toBe(TEMPO.XL);
    expect(TEMPO.S).toBeLessThan(TEMPO.M);
    expect(TEMPO.XL).toBeLessThan(TEMPO.giant);
  });

  it('gives each enemy a swing it can be seen to make, ending before the next one', () => {
    // Swings come the interval plus 220 ms apart; each ends before the next begins.
    for (const e of Object.values(ENEMIES)) {
      const s = swingOf(e);
      expect(s.swingMs, e.id).toBeLessThan((e.attack.intervalMs ?? 1000) + ATTACK_RELEASE_MS);
      expect(s.hitMs, e.id).toBeLessThan(s.swingMs);
    }
    expect(swingOf(ENEMIES['goblin'])).toEqual({ hitMs: 320, swingMs: 640 });
    // A big one swings slower; ちゅーしです, twice as quick to attack, swings within its 0.72 s.
    expect(swingOf(ENEMIES['mushi_horned']).swingMs).toBeGreaterThan(swingOf(ENEMIES['goblin']).swingMs);
    expect(swingOf(ENEMIES['chushidesu']).swingMs).toBeLessThan(500 + ATTACK_RELEASE_MS);
    // Giants: long, heavy swings, the blow landing past halfway.
    for (const id of ['dekatsuyo', 'anoko']) {
      expect(swingOf(ENEMIES[id]).swingMs).toBe(1600);
      expect(swingOf(ENEMIES[id]).hitMs).toBe(880);
    }
  });

  it('lands the blow when the swing says, and lets a big one fall for longer before it is gone', () => {
    const sim = field(['yoroi']);
    const wall = sim.place(0, 2, 3)!;
    expect(wall).toBeTruthy();
    sim.spawnEnemy(ENEMIES['mushi_horned'], 2, colY(3) + CONTACT, { waveIndex: 0 });
    let swungAt = -1;
    let hitAt = -1;
    const log: string[] = [];
    for (let t = 0; t < 3000 && hitAt < 0; t += STEP_MS) {
      sim.step(STEP_MS);
      for (const ev of sim.drainEvents() as SimEvent[]) {
        log.push(`${Math.round(sim.t)} ${ev.type}`);
        if (ev.type === 'enemyAttack' && swungAt < 0) swungAt = sim.t;
        else if (ev.type === 'allyHit' && ev.ally === wall && swungAt >= 0) hitAt = sim.t;
      }
    }
    expect(hitAt - swungAt, log.slice(0, 12).join(' | ')).toBeCloseTo(swingOf(ENEMIES['mushi_horned']).hitMs, -1.5);
    // However long the wind-up, it attacks as often as ever: swings the interval plus 220 ms apart.
    let next = -1;
    for (let t = 0; t < 3000 && next < 0; t += STEP_MS) {
      sim.step(STEP_MS);
      for (const ev of sim.drainEvents() as SimEvent[]) if (ev.type === 'enemyAttack') next = sim.t;
    }
    expect(next - swungAt).toBeCloseTo((ENEMIES['mushi_horned'].attack.intervalMs ?? 1000) + ATTACK_RELEASE_MS, -1.5);
    // Falling: a giant stays (fading) for its whole fall.
    expect(fallMsOf(ENEMIES['dekatsuyo'])).toBeGreaterThan(fallMsOf(ENEMIES['goblin']));
  });

  it('lets a swing play out when its blow fells the friend, before the enemy walks on', () => {
    const sim = field(['chiikawa']);
    const a = sim.place(0, 2, 3)!;
    a.hp = 1;
    sim.spawnEnemy(ENEMIES['mushi_horned'], 2, colY(3) + CONTACT, { waveIndex: 0 });
    const e = sim.enemies[0];
    let swungAt = -1;
    let felledAt = -1;
    for (let t = 0; t < 4000 && felledAt < 0; t += STEP_MS) {
      sim.step(STEP_MS);
      for (const ev of sim.drainEvents() as SimEvent[]) {
        if (ev.type === 'enemyAttack' && swungAt < 0) swungAt = sim.t;
        if (ev.type === 'allyCollapse') felledAt = sim.t;
      }
    }
    expect(felledAt).toBeGreaterThan(swungAt);
    const y = e.y;
    const swing = swingOf(ENEMIES['mushi_horned']).swingMs;
    // Until its swing is over it stays where it is, still swinging...
    while (sim.t < swungAt + swing - STEP_MS) {
      sim.step(STEP_MS);
      sim.drainEvents();
      expect(e.y).toBe(y);
      expect(e.anim).toBe('attack');
    }
    // ...then walks on.
    for (let t = 0; t < 500; t += STEP_MS) {
      sim.step(STEP_MS);
      sim.drainEvents();
    }
    expect(e.state).toBe('walk');
    expect(e.y).toBeGreaterThan(y);
  });

  it('lets a boss fall twice as slowly again, and keeps it on the field until its fall is over', () => {
    const zou = ENEMIES['zou'];
    expect(fallMsOf(zou, undefined, true)).toBe(fallMsOf(zou) * BOSS_FALL);
    expect(deathMsOf(zou, undefined, true)).toBe(deathMsOf(zou) * BOSS_FALL);
    // A giant boss lies fading for about three seconds.
    expect(fallMsOf(ENEMIES['dekatsuyo'], undefined, true)).toBeGreaterThan(2900);
    const sim = field([]);
    sim.spawnEnemy(zou, 2, colY(6), { waveIndex: 0 });
    const boss = sim.enemies[sim.enemies.length - 1];
    expect(boss.boss).toBe(true);
    sim.damageEnemy(boss, 1e7, 'test', 'fx_hit', true);
    const fall = fallMsOf(zou, undefined, true);
    for (let t = 0; t < fall - 100; t += STEP_MS) sim.step(STEP_MS);
    expect(sim.enemies.includes(boss)).toBe(true);
    for (let t = 0; t < 200; t += STEP_MS) sim.step(STEP_MS);
    expect(sim.enemies.includes(boss)).toBe(false);
  });

  it('plays a bigger character’s frames slower', () => {
    const goblin = spriteFor('enemy_goblin')!;
    const giant = spriteFor('enemy_dekatsuyo')!;
    // Waiting: a goblin's breath lasts 1.04 s; a giant's lasts 1.9 times that.
    expect(spriteFrame(goblin, 'idle', BREATH_MS / 2, { tempo: 1 })!.sy).toBeCloseTo(1 + BREATH_RISE, 9);
    expect(spriteFrame(giant, 'idle', BREATH_MS / 2, { tempo: TEMPO.giant })!.sy).toBeLessThan(1 + BREATH_RISE);
    expect(spriteFrame(giant, 'idle', (BREATH_MS * TEMPO.giant) / 2, { tempo: TEMPO.giant })!.sy).toBeCloseTo(1 + BREATH_RISE, 9);
    // A swing plays over the time the sim gives it.
    const swing = swingOf(ENEMIES['dekatsuyo']).swingMs;
    expect(spriteFrame(giant, 'attack', swing / 2 - 1, { onceMs: swing })!.i).toBe(3);
    expect(spriteFrame(giant, 'attack', swing, { onceMs: swing })!.i).toBe(giant.anims.attack!.frames - 1);
  });
});
