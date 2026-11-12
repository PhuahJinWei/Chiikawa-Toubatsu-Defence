import { BANNER_LEAD_MS, SPAWN_Y } from './constants';
import { ENEMIES } from './defs';
import { hashString, Rng } from './rng';
import { escortRank, expandSpawns, isHealer, LanePicker, MOB_ESCORTS, sendOrder, type WaveHost, type WaveSource } from './waves';
import type { EnemyDef, SpawnDef } from './types';

/** The most enemies one endless wave picks (reached around wave 90): past it, what a wave's growing budget cannot spend
 *  on more of them makes them tougher instead, so a long run keeps getting harder without crowding a phone's screen.
 *  (It used to be a loop guard that quietly stopped waves growing at all: 2026-11-10 audit.) */
const MOST_PER_WAVE = 60;

/** Endless mode is played in stages of this many waves (owner's call, 2026-11-10, after PvZ's Survival, whose rounds
 *  are 10 or 20 waves): a big wave halfway, and a boss (one of those met) closing each. Between stages the battle stops
 *  to look at the next stage's enemies on the road and to pick the team again (see the controller). */
export const STAGE_WAVES = 10;

/** Endless mode (討伐ランキング): generated waves that never stop coming, a stage at a time. */
export class EndlessWaves implements WaveSource {
  private wave = 0;
  private lastFireAt = 0;
  private banner: { at: number; wave: number } | null = null;
  private queue: ReturnType<typeof expandSpawns> = [];
  private picker = new LanePicker();
  private readonly regular: EnemyDef[];
  private readonly bosses: EnemyDef[];
  /** Highest wave whose enemies were all defeated. */
  cleared = 0;
  /** The stage being played, or, while `waiting`, the one just cleared. */
  stage = 1;
  /** Between stages: everyone the last one sent is down, and the next waits for beginNext. */
  waiting = false;
  private spawnedOf = new Map<number, number>();
  private aliveOf = new Map<number, number>();
  private plans = new Map<number, SpawnDef[][]>();

  /** `seed`: the run's, from which every stage's enemies are drawn (so the same run sends the same stages). */
  constructor(
    pool: string[],
    private readonly seed = 0,
    private firstGapMs = 28000,
  ) {
    const defs = pool.map((id) => ENEMIES[id]).filter(Boolean);
    this.regular = defs.filter((d) => !d.boss);
    this.bosses = defs.filter((d) => d.boss);
    if (this.regular.length === 0) this.regular.push(ENEMIES['mushi_twolegs']);
  }

  private gapFor(wave: number): number {
    if (wave <= 1) return this.firstGapMs;
    return Math.max(20000, 30000 - wave * 300);
  }

  /** The boss closing a stage (its last wave), when one has been met: each in turn, stage after stage. */
  private bossOf(wave: number): EnemyDef | undefined {
    return wave % STAGE_WAVES === 0 && this.bosses.length ? this.bosses[(wave / STAGE_WAVES - 1) % this.bosses.length] : undefined;
  }

  /** A stage's waves, what each sends: drawn from the stage's own randomness, so they are known before it starts (the
   *  road shows them while the team is picked) and stay the same however the battle goes. */
  plan(stage: number): SpawnDef[][] {
    let p = this.plans.get(stage);
    if (!p) {
      const rng = new Rng(hashString(`${this.seed}:endless:${stage}`));
      p = Array.from({ length: STAGE_WAVES }, (_, i) => this.compose(rng, (stage - 1) * STAGE_WAVES + i + 1));
      this.plans.set(stage, p);
    }
    return p;
  }

  /** How many of each enemy a stage sends, in the order they first come (a group, 小さい人魚, for each one in it, and a
   *  healer's company where it comes with it). */
  counts(stage: number): { id: string; count: number }[] {
    const n = new Map<string, number>();
    for (const w of this.plan(stage)) for (const { s, n: k } of sendOrder(w)) n.set(s.enemy, (n.get(s.enemy) ?? 0) + k * Math.max(1, ENEMIES[s.enemy].pack ?? 1));
    return [...n].map(([id, count]) => ({ id, count }));
  }

  /** The next stage begins, its first wave a gap from `t`: the team has been picked again. */
  beginNext(t: number): void {
    if (!this.waiting) return;
    this.waiting = false;
    this.stage++;
    this.lastFireAt = t;
  }

  /** Called by the sim whenever an enemy of a given wave collapses. */
  noteDefeated(waveIndex: number): void {
    this.aliveOf.set(waveIndex, (this.aliveOf.get(waveIndex) ?? 1) - 1);
    // A wave counts as cleared once all of its enemies are down and it has fully spawned.
    let w = this.cleared + 1;
    while (w <= this.wave && (this.aliveOf.get(w) ?? 0) <= 0 && (this.spawnedOf.get(w) ?? 0) > 0 && !this.queue.some((q) => q.waveIndex === w)) {
      this.cleared = w;
      w++;
    }
  }

  noteSpawned(waveIndex: number): void {
    this.spawnedOf.set(waveIndex, (this.spawnedOf.get(waveIndex) ?? 0) + 1);
    this.aliveOf.set(waveIndex, (this.aliveOf.get(waveIndex) ?? 0) + 1);
  }

  private compose(rng: Rng, wave: number): SpawnDef[] {
    const isBig = wave % 5 === 0;
    let budget = (1 + wave * 1.3) * (isBig ? 1.6 : 1);
    const spawns: SpawnDef[] = [];
    const boss = this.bossOf(wave);
    if (boss) {
      spawns.push({ enemy: boss.id, count: 1, boss: true, hpMul: 1 + Math.max(0, wave - 10) * 0.04 });
      budget -= boss.weight;
    }
    // Unlock heavier enemies gradually.
    const cap = 1 + wave * 0.45;
    const options = this.regular.filter((d) => d.weight <= cap);
    const pool = options.length ? options : [this.regular[0]];
    const toughness = 1 + Math.max(0, wave - 15) * 0.03;
    let picked = 0;
    let spent = 0;
    for (let tries = 0; budget > 0.5 && picked < MOST_PER_WAVE && tries < MOST_PER_WAVE * 10; tries++) {
      const def = pool[Math.floor(rng.next() * pool.length)];
      // 黒い流れ星: two a wave at most, and each only once the wave has two walkers at its pace to come with it (owner's
      // call, 2026-11-12: it never comes down a lane alone; see expandSpawns).
      if (isHealer(def)) {
        const healers = spawns.filter((s) => isHealer(ENEMIES[s.enemy])).length;
        const company = spawns.filter((s) => !s.boss && escortRank(ENEMIES[s.enemy], def) === 0).length;
        if (healers >= 2 || company < (healers + 1) * MOB_ESCORTS) continue;
      }
      spawns.push({ enemy: def.id, count: 1, hpMul: toughness });
      budget -= def.weight;
      spent += def.weight;
      picked++;
    }
    // A full wave: what is left of its budget goes into its enemies' health.
    if (budget > 0.5 && spent > 0) for (const s of spawns) if (!s.boss) s.hpMul = (s.hpMul ?? 1) * (1 + budget / spent);
    return spawns;
  }

  step(host: WaveHost): void {
    if (this.waiting) return;
    const last = this.stage * STAGE_WAVES;
    if (!this.banner && this.wave < last) {
      const due = this.lastFireAt + this.gapFor(this.wave + 1);
      const early = this.wave > 0 && this.queue.length === 0 && host.aliveEnemies() === 0 && host.t - this.lastFireAt >= 6000;
      if (host.t >= due || early) {
        const next = this.wave + 1;
        const boss = this.bossOf(next);
        if (boss) {
          host.emitBanner('boss', boss.id);
          this.banner = { at: host.t + BANNER_LEAD_MS, wave: next };
        } else if (next % 5 === 0) {
          host.emitBanner(next % STAGE_WAVES === 0 ? 'final' : 'big');
          this.banner = { at: host.t + BANNER_LEAD_MS, wave: next };
        } else {
          this.fire(host, next);
        }
      }
    }
    if (this.banner && host.t >= this.banner.at) {
      const w = this.banner.wave;
      this.banner = null;
      this.fire(host, w);
    }
    while (this.queue.length && this.queue[0].at <= host.t) {
      const q = this.queue.shift()!;
      host.spawnEnemy(q.def, q.lane, SPAWN_Y - host.rng.range(0, 40), { hpMul: q.hpMul, boss: q.boss, waveIndex: q.waveIndex });
    }
    // The stage is over once its last wave is out and everyone it sent (and everyone before) is down.
    if (this.wave >= last && !this.banner && this.queue.length === 0 && this.cleared >= last) this.waiting = true;
  }

  private fire(host: WaveHost, wave: number): void {
    const spawns = this.plan(Math.ceil(wave / STAGE_WAVES))[(wave - 1) % STAGE_WAVES];
    this.queue.push(...expandSpawns(spawns, host.rng, host.activeLanes, this.picker, host.t, wave, host.waterLanes));
    this.queue.sort((a, b) => a.at - b.at);
    this.wave = wave;
    this.lastFireAt = host.t;
    host.emitWaveStart(wave, 0);
  }

  /** How far through the stage it is, for the wave bar: its waves sent so far and the time to the next. */
  progress(host: WaveHost): number {
    if (this.waiting) return 1;
    const sent = this.wave - (this.stage - 1) * STAGE_WAVES;
    if (sent >= STAGE_WAVES) return 1;
    const part = this.banner ? 1 : Math.min(1, Math.max(0, (host.t - this.lastFireAt) / this.gapFor(this.wave + 1)));
    return Math.min(1, (sent + part) / STAGE_WAVES);
  }

  /** Every stage's wave bar: its big wave halfway, and its boss (or final wave) at the end. */
  flags(): { at: number; kind: 'big' | 'final' | 'boss' }[] {
    return [
      { at: 5 / STAGE_WAVES, kind: 'big' },
      { at: 1, kind: this.bosses.length ? 'boss' : 'final' },
    ];
  }

  done(): boolean {
    return false;
  }

  currentWave(): number {
    return this.wave;
  }
}
