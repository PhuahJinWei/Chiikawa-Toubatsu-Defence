import { BANNER_LEAD_MS, SPAWN_Y } from './constants';
import { ENEMIES } from './defs';
import { expandSpawns, LanePicker, type WaveHost, type WaveSource } from './waves';
import type { EnemyDef, SpawnDef } from './types';

/** Endless mode (討伐ランキング): procedurally generated waves that never stop. */
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
  private spawnedOf = new Map<number, number>();
  private aliveOf = new Map<number, number>();

  constructor(pool: string[], private firstGapMs = 22000) {
    const defs = pool.map((id) => ENEMIES[id]).filter(Boolean);
    this.regular = defs.filter((d) => !d.boss);
    this.bosses = defs.filter((d) => d.boss);
    if (this.regular.length === 0) this.regular.push(ENEMIES['mushi_twolegs']);
  }

  private gapFor(wave: number): number {
    if (wave <= 1) return this.firstGapMs;
    return Math.max(16000, 26000 - wave * 300);
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

  private compose(host: WaveHost, wave: number): SpawnDef[] {
    const rng = host.rng;
    const isBig = wave % 5 === 0;
    let budget = (3 + wave * 2.1) * (isBig ? 1.6 : 1);
    const spawns: SpawnDef[] = [];
    if (wave % 10 === 0 && this.bosses.length) {
      const boss = this.bosses[(wave / 10 - 1) % this.bosses.length];
      spawns.push({ enemy: boss.id, count: 1, boss: true, hpMul: 1 + Math.max(0, wave - 10) * 0.04 });
      budget -= boss.weight;
    }
    // Unlock heavier enemies gradually.
    const cap = 1 + wave * 0.45;
    const options = this.regular.filter((d) => d.weight <= cap);
    const pool = options.length ? options : [this.regular[0]];
    let guard = 0;
    while (budget > 0.5 && guard++ < 60) {
      const def = pool[Math.floor(rng.next() * pool.length)];
      if (def.id === 'kuroi_nagareboshi' && spawns.filter((s) => s.enemy === def.id).length >= 2) continue;
      spawns.push({ enemy: def.id, count: 1, hpMul: 1 + Math.max(0, wave - 15) * 0.03 });
      budget -= def.weight;
    }
    return spawns;
  }

  step(host: WaveHost): void {
    if (!this.banner) {
      const due = this.lastFireAt + this.gapFor(this.wave + 1);
      const early = this.wave > 0 && this.queue.length === 0 && host.aliveEnemies() === 0 && host.t - this.lastFireAt >= 6000;
      if (host.t >= due || early) {
        const next = this.wave + 1;
        if (next % 10 === 0 && this.bosses.length) {
          host.emitBanner('boss', this.bosses[(next / 10 - 1) % this.bosses.length].id);
          this.banner = { at: host.t + BANNER_LEAD_MS, wave: next };
        } else if (next % 5 === 0) {
          host.emitBanner('big');
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
  }

  private fire(host: WaveHost, wave: number): void {
    const spawns = this.compose(host, wave);
    this.queue.push(...expandSpawns(spawns, host.rng, host.activeLanes, this.picker, host.t, wave, host.waterLanes));
    this.queue.sort((a, b) => a.at - b.at);
    this.wave = wave;
    this.lastFireAt = host.t;
    host.emitWaveStart(wave, 0);
  }

  progress(host: WaveHost): number {
    const gap = this.gapFor(this.wave + 1);
    return Math.min(1, Math.max(0, (host.t - this.lastFireAt) / gap));
  }

  flags(): { at: number; kind: 'big' | 'final' | 'boss' }[] {
    return [];
  }

  done(): boolean {
    return false;
  }

  currentWave(): number {
    return this.wave;
  }
}
