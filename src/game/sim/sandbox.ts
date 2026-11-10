// Dev mode's testing ground (テスト場): a battle with no script, for trying anything by hand. Every friend is on the
// team, enemies come only when sent (down the road, or straight onto a tile), nothing is won or lost, and its rules
// (DevRules) can be switched while it runs. It never touches the save.

import { colY, SPAWN_Y, TILE } from './constants';
import { ENEMY_LIST, LEVEL_LIST, UNIT_LIST, WORLDS } from './defs';
import { Sim } from './sim';
import type { DevRules, SpawnDef, SproutDef } from './types';
import { expandSpawns, LanePicker, type WaveHost, type WaveSource } from './waves';

/** Where the testing ground is set: a world's field (its picture, its water lane, its night with nothing sprouting,
 *  its enemies' toughness), and whether Rakko's cars wait at the end of the lanes. */
export interface SandboxSetup {
  world: number;
  cars: boolean;
}

/** The rules a testing ground starts with: free cards, everything else as in a real battle. */
export const DEFAULT_DEV_RULES: DevRules = { free: true, freeze: false, safeFriends: false, safeEnemies: false };

/** Everyone who can be put on the field: 星 first (it turns into whoever is picked for it in the panel, and at the end
 *  of a tray this long it would be off the screen), then every other friend. */
export function sandboxTeam(): string[] {
  return [...UNIT_LIST.filter((u) => u.wish).map((u) => u.id), ...sandboxWishes()];
}

/** Who 星 can turn into here: every other friend, the first of them until another is picked. */
export function sandboxWishes(): string[] {
  return UNIT_LIST.filter((u) => !u.wish).map((u) => u.id);
}

/** Whether a world's jobs have Rakko's cars (World 6's big hunt does not): the testing ground's starting choice. */
export function worldHasCars(world: number): boolean {
  return LEVEL_LIST.find((l) => l.world === world)?.rescues ?? true;
}

/** How weeds sprout in a world's jobs (World 4's night: not at all). */
function sproutOf(world: number): SproutDef | null {
  const l = LEVEL_LIST.find((x) => x.world === world);
  return l ? l.sprout : { firstMs: 2500, minMs: 7000, maxMs: 10000, value: 25, lifeMs: 10000 };
}

/** Enemies only when sent: what is sent comes down the road at once (a group, or a level's wave, still in its own
 *  rhythm). There are no waves to win: it is never done. */
export class SandboxWaves implements WaveSource {
  private queue: ReturnType<typeof expandSpawns> = [];
  private picker = new LanePicker();

  /** Send spawns down the road (lanes as in a level: a number, 'random' or 'all'; a giant always down the middle). */
  send(spawns: SpawnDef[], host: WaveHost): void {
    this.queue.push(...expandSpawns(spawns, host.rng, host.activeLanes, this.picker, host.t, 0, host.waterLanes));
    this.queue.sort((a, b) => a.at - b.at);
  }

  /** Put spawns straight onto the field, their feet in the middle of column `col` (a group one behind the other). */
  place(spawns: SpawnDef[], col: number, host: WaveHost): void {
    const list = expandSpawns(spawns, host.rng, host.activeLanes, this.picker, host.t, 0, host.waterLanes);
    const behind = new Map<number, number>();
    for (const q of list) {
      const n = behind.get(q.lane) ?? 0;
      behind.set(q.lane, n + 1);
      host.spawnEnemy(q.def, q.lane, Math.max(SPAWN_Y, colY(col) + TILE / 2 - n * TILE * 0.35), { hpMul: q.hpMul, boss: q.boss, waveIndex: 0 });
    }
  }

  /** Drop whatever was sent and is not out yet. */
  clear(): void {
    this.queue = [];
  }

  step(host: WaveHost): void {
    while (this.queue.length && this.queue[0].at <= host.t) {
      const q = this.queue.shift()!;
      host.spawnEnemy(q.def, q.lane, SPAWN_Y - host.rng.range(0, 40), { hpMul: q.hpMul, boss: q.boss, waveIndex: 0 });
    }
  }

  progress(): number {
    return 0;
  }

  flags(): { at: number; kind: 'big' | 'final' | 'boss' }[] {
    return [];
  }

  done(): boolean {
    return false;
  }

  currentWave(): number {
    return 0;
  }
}

/** A testing ground: all five lanes of a world's field, every friend, 1000 草 to start, and `rules` (one object,
 *  shared with whoever switches them, so a change takes effect at once). */
export function simForSandbox(setup: SandboxSetup, deck: string[], rules: DevRules, opts: { autoCollect?: boolean; wish?: string } = {}): Sim {
  const w = WORLDS[setup.world];
  return new Sim({
    levelId: 'sandbox',
    lanes: [0, 1, 2, 3, 4],
    startWeeds: 1000,
    sprout: sproutOf(setup.world),
    terrain: [],
    rescues: setup.cars,
    deck,
    seed: Date.now() >>> 0,
    autoCollect: opts.autoCollect,
    ready: true,
    wish: opts.wish ?? sandboxWishes()[0],
    water: w?.water,
    waves: new SandboxWaves(),
    dev: rules,
  });
}

/** Every enemy, for the testing ground's list, in the data's order (ちいかぶ's true form comes out of the small one). */
export function sandboxEnemies(): string[] {
  return ENEMY_LIST.map((e) => e.id);
}
