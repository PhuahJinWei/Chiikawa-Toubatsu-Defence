import { BANNER_LEAD_MS, EARLY_WAVE_MIN_MS, SPAWN_Y } from './constants';
import { ENEMIES, waterOf } from './defs';
import type { Rng } from './rng';
import type { EnemyDef, LevelDef, SpawnDef, WaveDef } from './types';

/** What a wave source asks the simulation to do. */
export interface WaveHost {
  t: number;
  rng: Rng;
  activeLanes: number[];
  /** The active lanes that are water (see lanesFor). */
  waterLanes: number[];
  aliveEnemies(): number;
  spawnEnemy(def: EnemyDef, lane: number, y: number, opts: { hpMul?: number; boss?: boolean; waveIndex: number }): void;
  emitBanner(kind: 'big' | 'final' | 'boss', bossId?: string): void;
  emitWaveStart(index: number, total: number): void;
}

export interface WaveSource {
  step(host: WaveHost): void;
  /** 0..1 for the wave bar. */
  progress(host: WaveHost): number;
  /** Flag positions on the wave bar (0..1) with their kind. */
  flags(): { at: number; kind: 'big' | 'final' | 'boss' }[];
  /** All waves have spawned. */
  done(): boolean;
  /** 1-based number of the wave most recently started. */
  currentWave(): number;
}

interface QueuedSpawn {
  at: number;
  def: EnemyDef;
  lane: number;
  hpMul?: number;
  boss?: boolean;
  waveIndex: number;
}

/** Spreads random spawns across lanes, favouring lanes that have had fewer recent spawns. */
export class LanePicker {
  private counts = new Map<number, number>();

  pick(rng: Rng, lanes: number[]): number {
    let best: number[] = [];
    let bestScore = Infinity;
    for (const lane of lanes) {
      const score = (this.counts.get(lane) ?? 0) + rng.next() * 1.4;
      if (score < bestScore - 1e-9) {
        bestScore = score;
        best = [lane];
      } else if (Math.abs(score - bestScore) < 1e-9) best.push(lane);
    }
    const lane = best[0];
    this.counts.set(lane, (this.counts.get(lane) ?? 0) + 1);
    // Decay so long levels stay varied.
    for (const [k, v] of this.counts) this.counts.set(k, v * 0.9);
    return lane;
  }

  /** Count `n` more enemies down a lane picked for one: a healer's company, which comes down its lane with it. */
  note(lane: number, n: number): void {
    if (n > 0) this.counts.set(lane, (this.counts.get(lane) ?? 0) + n);
  }
}

/** A healer (黒い流れ星) comes with at most this many of its wave's walkers (owner's call, 2026-11-12). */
export const MOB_ESCORTS = 2;

/** Whether an enemy heals those round it (黒い流れ星): one never comes down a lane alone (see expandSpawns). */
export function isHealer(def: EnemyDef): boolean {
  return def.abilities.some((a) => a.kind === 'heal_aura');
}

/** How well an enemy keeps a healer company in its mob: 0 at its pace (as fast, and stopping at friends as it does), 1
 *  if it goes with it but will not stay (faster or slower, or one that jumps friends), null if it never walks in a mob
 *  (a boss, a giant, a flier, another healer, or a swimmer while there is water about, which keeps to its own lanes). */
export function escortRank(def: EnemyDef, healer: EnemyDef, water: number[] = []): 0 | 1 | null {
  if (def.boss || def.giant || isHealer(def) || def.abilities.some((a) => a.kind === 'flier')) return null;
  if (water.length && !!def.aquatic !== !!healer.aquatic) return null;
  return def.speed === healer.speed && !def.abilities.some((a) => a.kind === 'jump') ? 0 : 1;
}

/** Each healer's company in a wave (see expandSpawns), for each enemy its spawn sends: up to MOB_ESCORTS of the wave's
 *  walkers, those at its pace first (they stay with it), then any others; of each kind the nearest it in the wave, one
 *  before it first. Walkers sent down a lane of their own, or down every lane, keep to it. Each mob is in walking
 *  order: one of its company leads, the healer follows, and the rest close up behind. `taken`: how many of each
 *  spawn's enemies go in a mob instead of coming on their own. */
function mobsOf(spawns: SpawnDef[], water: number[]): { mobs: Map<number, SpawnDef[][]>; taken: number[] } {
  const taken = spawns.map(() => 0);
  const mobs = new Map<number, SpawnDef[][]>();
  spawns.forEach((h, hi) => {
    const healer = ENEMIES[h.enemy];
    if (!healer || !isHealer(healer) || h.lane === 'all') return;
    const far = (si: number) => Math.abs(si - hi) * 2 + (si > hi ? 1 : 0);
    const mob: SpawnDef[][] = [];
    for (let c = 0; c < (h.count ?? 1); c++) {
      const company: SpawnDef[] = [];
      for (const rank of [0, 1]) {
        while (company.length < MOB_ESCORTS) {
          let best = -1;
          spawns.forEach((s, si) => {
            const d = ENEMIES[s.enemy];
            if (!d || s.boss || (s.lane !== undefined && s.lane !== 'random') || taken[si] >= (s.count ?? 1)) return;
            if (escortRank(d, healer, water) === rank && (best < 0 || far(si) < far(best))) best = si;
          });
          if (best < 0) break;
          taken[best]++;
          company.push(spawns[best]);
        }
      }
      mob.push([...company.slice(0, 1), h, ...company.slice(1)]);
    }
    mobs.set(hi, mob);
  });
  return { mobs, taken };
}

/** A wave's spawns in the order expandSpawns sends them, each with how many of it come there: a healer's company comes
 *  with it, out of the spawns it is taken from. For counting what a wave sends without sending it. */
export function sendOrder(spawns: SpawnDef[], water: number[] = []): { s: SpawnDef; n: number }[] {
  const { mobs, taken } = mobsOf(spawns, water);
  const out: { s: SpawnDef; n: number }[] = [];
  spawns.forEach((s, si) => {
    if (!ENEMIES[s.enemy]) return;
    const mob = mobs.get(si);
    if (mob) for (const members of mob) for (const m of members) out.push({ s: m, n: 1 });
    else if ((s.count ?? 1) > taken[si]) out.push({ s, n: (s.count ?? 1) - taken[si] });
  });
  return out;
}

/** The lanes an enemy can come down: with water about, a swimmer (人魚, セイレーン) only the water lanes and everyone
 *  else only the land; without, any active lane. */
function lanesFor(def: EnemyDef, lanes: number[], water: number[]): number[] {
  if (!water.length) return lanes;
  const wet = lanes.filter((l) => water.includes(l));
  const dry = lanes.filter((l) => !water.includes(l));
  const mine = def.aquatic ? wet : dry;
  return mine.length ? mine : lanes;
}

/** Where a giant (でかつよ, あのこ) comes down: the lane nearest the middle of these with a lane either side of it among
 *  them, so its body covers three; null when no three lie side by side (it then comes like anyone else, one lane wide). */
export function giantLane(lanes: number[]): number | null {
  if (!lanes.length) return null;
  const mid = (Math.min(...lanes) + Math.max(...lanes)) / 2;
  let best: number | null = null;
  for (const l of lanes) {
    if (!lanes.includes(l - 1) || !lanes.includes(l + 1)) continue;
    if (best === null || Math.abs(l - mid) < Math.abs(best - mid)) best = l;
  }
  return best;
}

/** How many of each enemy a job sends over all its waves, in the order they first come, counted as `expandSpawns`
 *  sends them: a spawn on 'all' lanes once for each lane it can use, a group (小さい人魚) for each one in it, a giant
 *  once a count however its lane is given, and a healer's company where it comes with it. */
export function enemyCounts(level: LevelDef): { id: string; count: number }[] {
  const water = waterOf(level);
  const counts = new Map<string, number>();
  for (const w of level.waves) {
    for (const { s, n } of sendOrder(w.spawns, water)) {
      const def = ENEMIES[s.enemy];
      const pool = lanesFor(def, level.lanes, water);
      const across = s.lane === 'all' && !(def.giant && giantLane(pool) !== null) ? pool.length : 1;
      counts.set(s.enemy, (counts.get(s.enemy) ?? 0) + n * across * Math.max(1, def.pack ?? 1));
    }
  }
  return [...counts].map(([id, count]) => ({ id, count }));
}

export function expandSpawns(
  spawns: SpawnDef[],
  rng: Rng,
  lanes: number[],
  picker: LanePicker,
  t0: number,
  waveIndex: number,
  water: number[] = [],
): QueuedSpawn[] {
  const out: QueuedSpawn[] = [];
  const { mobs, taken } = mobsOf(spawns, water);
  let t = t0;
  for (const [si, s] of spawns.entries()) {
    const def = ENEMIES[s.enemy];
    if (!def) continue;
    const pool = lanesFor(def, lanes, water);
    const mob = mobs.get(si);
    if (mob) {
      // A healer (黒い流れ星) comes in its mob, all down one lane, close behind one another: one of its company leads, it
      // follows, and the rest close up behind (owner's call, 2026-11-12: spread like anyone, it came down a lane alone).
      for (const members of mob) {
        const lane = typeof s.lane === 'number' && pool.includes(s.lane) ? s.lane : picker.pick(rng, pool);
        picker.note(lane, members.length - 1);
        members.forEach((m, n) => {
          const md = ENEMIES[m.enemy];
          const pack = Math.max(1, md.pack ?? 1);
          for (let k = 0; k < pack; k++) {
            out.push({ at: t, def: md, lane, hpMul: m.hpMul, boss: m.boss, waveIndex });
            t += n < members.length - 1 || k < pack - 1 ? rng.range(300, 450) : rng.range(250, 900);
          }
        });
      }
      continue;
    }
    // Those of its enemies in a healer's mob come with it instead.
    const count = (s.count ?? 1) - taken[si];
    const laneList: number[] = [];
    const middle = def.giant ? giantLane(pool) : null;
    if (middle !== null) {
      // A giant always comes down the middle of the field.
      for (let c = 0; c < count; c++) laneList.push(middle);
    } else if (s.lane === 'all') {
      for (let c = 0; c < count; c++) laneList.push(...pool);
    } else {
      for (let c = 0; c < count; c++) {
        laneList.push(typeof s.lane === 'number' && pool.includes(s.lane) ? s.lane : picker.pick(rng, pool));
      }
    }
    const pack = Math.max(1, def.pack ?? 1);
    for (const lane of laneList) {
      // A group (小さい人魚) comes one after another, close behind, in the same lane.
      for (let k = 0; k < pack; k++) {
        out.push({ at: t, def, lane, hpMul: s.hpMul, boss: s.boss, waveIndex });
        t += k < pack - 1 ? rng.range(300, 450) : rng.range(250, 900);
      }
    }
  }
  return out;
}

/** Campaign waves from a level script. Gaps between waves are preserved when a wave starts early. */
export class ScriptedWaves implements WaveSource {
  private i = 0;
  private lastFireAt = 0;
  private queue: QueuedSpawn[] = [];
  private banner: { at: number; index: number } | null = null;
  private picker = new LanePicker();

  constructor(private waves: WaveDef[]) {}

  private gapBefore(index: number): number {
    if (index === 0) return this.waves[0].at * 1000;
    return (this.waves[index].at - this.waves[index - 1].at) * 1000;
  }

  step(host: WaveHost): void {
    if (this.i < this.waves.length && !this.banner) {
      const due = this.lastFireAt + this.gapBefore(this.i);
      const sinceLast = host.t - this.lastFireAt;
      const early =
        this.i > 0 &&
        this.queue.length === 0 &&
        host.aliveEnemies() === 0 &&
        sinceLast >= Math.max(EARLY_WAVE_MIN_MS, this.gapBefore(this.i) * 0.6);
      if (host.t >= due || early) {
        const w = this.waves[this.i];
        if (w.big || w.final || w.boss) {
          const bossSpawn = w.spawns.find((s) => s.boss || ENEMIES[s.enemy]?.boss);
          host.emitBanner(w.boss ? 'boss' : w.final ? 'final' : 'big', w.boss ? bossSpawn?.enemy : undefined);
          this.banner = { at: host.t + BANNER_LEAD_MS, index: this.i };
          // The banner holds the wave; the gap clock restarts once it fires.
        } else {
          this.fire(host, this.i);
        }
      }
    }
    if (this.banner && host.t >= this.banner.at) {
      const idx = this.banner.index;
      this.banner = null;
      this.fire(host, idx);
    }
    while (this.queue.length && this.queue[0].at <= host.t) {
      const q = this.queue.shift()!;
      host.spawnEnemy(q.def, q.lane, SPAWN_Y - host.rng.range(0, 40), {
        hpMul: q.hpMul,
        boss: q.boss,
        waveIndex: q.waveIndex,
      });
    }
  }

  private fire(host: WaveHost, index: number): void {
    const w = this.waves[index];
    const spawns = expandSpawns(w.spawns, host.rng, host.activeLanes, this.picker, host.t, index, host.waterLanes);
    this.queue.push(...spawns);
    this.queue.sort((a, b) => a.at - b.at);
    this.lastFireAt = host.t;
    this.i = index + 1;
    host.emitWaveStart(index + 1, this.waves.length);
  }

  progress(host: WaveHost): number {
    const n = this.waves.length;
    if (n === 0) return 1;
    if (this.i >= n) return 1;
    const gap = this.gapBefore(this.i);
    const part = gap > 0 ? Math.min(1, Math.max(0, (host.t - this.lastFireAt) / gap)) : 1;
    return Math.min(1, (this.i + (this.banner ? 1 : part)) / n);
  }

  flags(): { at: number; kind: 'big' | 'final' | 'boss' }[] {
    const n = this.waves.length;
    const out: { at: number; kind: 'big' | 'final' | 'boss' }[] = [];
    this.waves.forEach((w, i) => {
      if (w.boss) out.push({ at: (i + 1) / n, kind: 'boss' });
      else if (w.final) out.push({ at: (i + 1) / n, kind: 'final' });
      else if (w.big) out.push({ at: (i + 1) / n, kind: 'big' });
    });
    return out;
  }

  done(): boolean {
    return this.i >= this.waves.length && this.queue.length === 0 && !this.banner;
  }

  currentWave(): number {
    return this.i;
  }
}
