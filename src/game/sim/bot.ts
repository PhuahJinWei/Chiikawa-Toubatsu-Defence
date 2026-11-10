// A heuristic player used to check that levels are winnable and to compare difficulty.
//
// It plays like a sensible human: a producer at the back of every lane, then each lane is
// filled from a simple template (attacker, wall, stronger attacker, producer, third attacker,
// second wall). It always works on the most threatened lane and saves weeds for the next
// piece instead of buying whatever is affordable. A water lane (World 5) gets its own template
// of フタバ and ヒトハ throwing behind 島二郎, and until they join, the land either side defends it with モモンガ.
//
// It has no feel for timing, so the friends that need it stay home: たい焼き, オデ, むちゃうマン, パジャマパーティーズ and 星.
// A player has those as well, so what a bot can win a person with the whole team should too.

import { COLS, colY, STEP_MS, TILE } from './constants';
import { fitsJob, LEVEL_LIST, waterOf } from './defs';
import { EndlessWaves } from './endless';
import type { Sim } from './sim';
import type { Enemy, LevelDef } from './types';

export interface BotOptions {
  /** Delay before the bot taps a sprouted weed. Infinity = never collects. */
  reactionMs: number;
  /** Total ちいかわ the bot aims for on a 5-lane field (scaled down for fewer lanes). */
  producers: number;
  /** How far down the lane template the bot is allowed to build. */
  templateDepth: number;
  thinkMs: number;
}

export const BOT_GOOD: BotOptions = { reactionMs: 1200, producers: 8, templateDepth: 7, thinkMs: 250 };
export const BOT_CASUAL: BotOptions = { reactionMs: 3500, producers: 6, templateDepth: 4, thinkMs: 1000 };

type Slot = { kind: 'attacker' | 'wall' | 'producer'; cols: number[]; prefer?: string[] };

/** Per-lane build template, in priority order. */
const TEMPLATE: Slot[] = [
  { kind: 'attacker', cols: [3, 2, 4, 1, 0], prefer: ['hachiware', 'usagi'] },
  { kind: 'wall', cols: [4, 5, 3], prefer: ['yoroi', 'yoroi_erai'] },
  { kind: 'attacker', cols: [2, 1, 3, 0], prefer: ['furuhonya', 'usagi', 'kurimanju', 'momonga', 'shisa', 'hachiware'] },
  { kind: 'producer', cols: [1, 0] },
  { kind: 'attacker', cols: [1, 2, 0], prefer: ['momonga', 'chiikawa_island', 'kurimanju', 'usagi', 'furuhonya', 'shisa', 'hachiware'] },
  { kind: 'wall', cols: [5, 6, 4], prefer: ['rakko', 'yoroi_erai', 'yoroi'] },
  { kind: 'attacker', cols: [0, 1, 2], prefer: ['usagi_cool', 'kurimanju', 'usagi', 'momonga', 'hachiware'] },
];

/** The water lane's template: no producer (nothing grows there), フタバ and ヒトハ throwing side by side (each throws
 *  faster beside the other), 島二郎 in front. */
const WATER_TEMPLATE: Slot[] = [
  { kind: 'attacker', cols: [3, 2, 4, 1, 0], prefer: ['futaba', 'hitoha'] },
  { kind: 'wall', cols: [4, 5, 3], prefer: ['shimajiro'] },
  { kind: 'attacker', cols: [2, 1, 3, 0], prefer: ['hitoha', 'futaba'] },
  { kind: 'attacker', cols: [1, 2, 0], prefer: ['futaba', 'hitoha'] },
  { kind: 'wall', cols: [5, 6, 4], prefer: ['shimajiro'] },
  { kind: 'attacker', cols: [0, 1, 2], prefer: ['hitoha', 'futaba'] },
];

/** The friends who stand on water (UnitDef.aquatic): the pair throw, 島二郎 is the wall. */
const WATER_ATTACKERS = ['futaba', 'hitoha'];
const WATER_WALLS = ['shimajiro'];
/** Land friends whose shots reach the whole lane, unlike ハチワレ's three tiles: who can hit a フグ spitting from afar. */
const LONG_SHOTS = ['usagi', 'furuhonya', 'shisa', 'momonga', 'kurimanju', 'chiikawa_island'];
const ATTACKERS = ['hachiware', 'usagi', 'momonga', 'kurimanju', 'shisa', 'furuhonya', 'chiikawa_island', 'usagi_cool', 'hachiware_pajama', ...WATER_ATTACKERS];
/** Whoever holds the front. ラッコ fights there rather than walling it, but he stands in the same places. */
const WALLS = ['yoroi', 'yoroi_erai', 'rakko', ...WATER_WALLS];

/** Who a bot takes along first, after ちいかわ and the islanders. */
const TEAM_ORDER = ['hachiware', 'yoroi', 'yoroi_erai', 'momonga', 'furuhonya', 'kurimanju', 'rakko', 'chiikawa_island', 'usagi_cool', 'usagi', 'hachiware_pajama'];

/** The team a bot takes on a job: the friends the jobs before it have brought, as many as the pochettes a player would
 *  have bought by then allow (5 in World 1, 6 in World 2, 7 in World 3, 8 from World 4). */
export function botDeck(level: LevelDef): string[] {
  if (level.deck.forced?.length) return level.deck.forced;
  const owned = new Set(['usagi']);
  for (const l of LEVEL_LIST) {
    if (l.id === level.id) break;
    if (l.rewards.unlockCard) owned.add(l.rewards.unlockCard);
  }
  const water = waterOf(level).length ? ['futaba', 'hitoha', 'shimajiro'] : [];
  // With three islanders along there is no room for a second kind of wall on land.
  const land = water.length ? TEAM_ORDER.filter((id) => id !== 'yoroi_erai') : TEAM_ORDER;
  return ['chiikawa', ...water, ...land].filter((id) => owned.has(id) && fitsJob(id, level)).slice(0, Math.min(8, 4 + level.world));
}

export class Bot {
  private nextThink = 0;

  constructor(private sim: Sim, private opts: BotOptions = BOT_GOOD) {}

  private cardIndex(id: string): number {
    return this.sim.cards.findIndex((c) => c.def.id === id);
  }

  private has(id: string): boolean {
    return this.cardIndex(id) >= 0;
  }

  /** The enemies in a lane (a giant counts in each of its three). */
  private laneEnemies(lane: number): Enemy[] {
    return this.sim.enemies.filter((e) => this.sim.covers(e, lane) && e.state !== 'collapse');
  }

  private deepest(lane: number): number {
    let y = -Infinity;
    for (const e of this.laneEnemies(lane)) y = Math.max(y, e.y);
    return y;
  }

  /** Threat: enemy HP in the lane, weighted up the closer and faster it is. */
  private threat(lane: number): number {
    let t = 0;
    for (const e of this.laneEnemies(lane)) {
      const closeness = 0.6 + Math.max(0, e.y) / (TILE * COLS);
      t += e.hp * closeness * (e.def.speed === 'fast' ? 1.5 : 1) * (e.def.attack.kind === 'stomp' ? 1.6 : 1);
    }
    return t;
  }

  private count(lane: number, ids: string[]): number {
    let n = 0;
    for (let col = 0; col < COLS; col++) {
      const a = this.sim.grid[lane][col];
      if (a && ids.includes(a.def.id)) n++;
    }
    return n;
  }

  /** A col is useful only if no enemy has already walked past it. A wall can go onto a tile an enemy has just come
   *  into (it stops the enemy there); anyone else put down where an enemy stands, or is about to, is only eaten. */
  private safeRow(lane: number, col: number, wall = false): boolean {
    const limit = wall ? colY(col) + TILE * 0.3 : colY(col);
    for (const e of this.laneEnemies(lane)) if (e.y > limit) return false;
    return true;
  }

  /** For attackers: leave at least ~1.5 tiles between the new ally and the deepest enemy. */
  private roomyRow(lane: number, col: number): boolean {
    const deep = this.deepest(lane);
    return !Number.isFinite(deep) || colY(col) + TILE * 0.3 > deep + TILE * 1.5;
  }

  private freeRows(lane: number, cols: number[], attacker: boolean, wall = false): number[] {
    const out: number[] = [];
    for (const r of cols) {
      if (r < 0 || r >= COLS || out.includes(r)) continue;
      if (this.sim.tileOpen(lane, r) && this.safeRow(lane, r, wall) && (!attacker || this.roomyRow(lane, r))) out.push(r);
    }
    return out;
  }

  private frontAttackerRow(lane: number): number {
    for (let col = COLS - 1; col >= 0; col--) {
      const a = this.sim.grid[lane][col];
      if (a && ATTACKERS.includes(a.def.id)) return col;
    }
    return -1;
  }

  /** The nearest bush (World 2) in front of the lane's front attacker, or -1. */
  private bushAhead(lane: number, front: number): number {
    for (let col = Math.max(0, front + 1); col < COLS - 1; col++) if (this.sim.terrain[lane][col] === 'bush') return col;
    return -1;
  }

  /** The lanes friends can stand on that grow 草 and hold producers: the land. */
  private land(): number[] {
    return this.sim.activeLanes.filter((l) => !this.sim.water[l]);
  }

  private totalProducers(): number {
    return this.land().reduce((n, l) => n + this.count(l, ['chiikawa']), 0);
  }

  private producerTarget(): number {
    const lanes = this.land().length;
    return Math.min(this.opts.producers, Math.max(1, Math.round((this.opts.producers * lanes) / 5)));
  }

  /** A land lane right beside an active water lane: its モモンガ throws into the water too. */
  private besideWater(lane: number): boolean {
    return this.sim.waterLanes.some((w) => Math.abs(w - lane) === 1);
  }

  /** Whether the water lanes can be defended from the water itself (フタバ or ヒトハ has joined). */
  private waterFriends(): boolean {
    return WATER_ATTACKERS.some((id) => this.has(id));
  }

  private pickAttacker(lane: number, prefer: string[]): string | null {
    const lanes = this.land();
    // Beside the water, モモンガ comes first: her throw covers the water lane as well as her own.
    const order = this.besideWater(lane) && this.has('momonga') ? ['momonga', ...prefer.filter((x) => x !== 'momonga')] : prefer;
    for (const id of order) {
      if (!this.has(id) || WATER_ATTACKERS.includes(id)) continue;
      if (id === 'momonga' && !this.besideWater(lane) && (lanes.length < 3 || lane === lanes[0] || lane === lanes[lanes.length - 1])) continue;
      if (id === 'shisa' && this.count(lane, ['shisa']) >= 1) continue;
      return id;
    }
    // The first friends anyone has: うさぎ (from the start) and ハチワレ.
    return ['usagi', 'hachiware'].find((x) => this.has(x)) ?? null;
  }

  /** The water lane's next build: フタバ, ヒトハ and 島二郎 from the water template. */
  private nextForWater(lane: number): { id: string; cols: number[] } | null {
    const attackers = this.count(lane, WATER_ATTACKERS);
    const walls = this.count(lane, WATER_WALLS);
    let needA = 0;
    let needW = 0;
    for (let i = 0; i < Math.min(WATER_TEMPLATE.length, this.opts.templateDepth); i++) {
      const slot = WATER_TEMPLATE[i];
      if (slot.kind === 'attacker') {
        needA++;
        if (attackers >= needA) continue;
        const id = (slot.prefer ?? WATER_ATTACKERS).find((x) => this.has(x));
        if (!id) continue;
        const cols = this.freeRows(lane, slot.cols, true);
        if (cols.length) return { id, cols };
        const fallback = this.freeRows(lane, [0, 1, 2, 3], false);
        if (fallback.length) return { id, cols: fallback };
      } else if (slot.kind === 'wall') {
        needW++;
        const id = (slot.prefer ?? WATER_WALLS).find((x) => this.has(x));
        if (walls >= needW || !id) continue;
        const front = this.frontAttackerRow(lane);
        const cols = this.freeRows(lane, front >= 0 ? [front + 1, front + 2, ...slot.cols] : slot.cols, false, true);
        if (cols.length) return { id, cols };
      }
    }
    return null;
  }

  /** The lane's next build from the template, with the card and candidate cols. */
  private nextFor(lane: number): { id: string; cols: number[] } | null {
    if (this.sim.water[lane]) return this.nextForWater(lane);
    const attackers = this.count(lane, ATTACKERS);
    const walls = this.count(lane, WALLS);
    const producers = this.count(lane, ['chiikawa']);
    let needA = 0;
    let needW = 0;
    let needP = 1;
    for (let i = 0; i < Math.min(TEMPLATE.length, this.opts.templateDepth); i++) {
      const slot = TEMPLATE[i];
      if (slot.kind === 'attacker') needA++;
      else if (slot.kind === 'wall') needW++;
      else needP++;
      if (slot.kind === 'producer') {
        if (producers >= needP || this.totalProducers() >= this.producerTarget() || !this.has('chiikawa')) continue;
        const cols = this.freeRows(lane, slot.cols, false);
        if (cols.length) return { id: 'chiikawa', cols };
        continue;
      }
      if (slot.kind === 'wall') {
        if (walls >= needW) continue;
        const prefer = slot.prefer ?? WALLS;
        const id =
          prefer.find((x) => this.has(x) && this.sim.cards[this.cardIndex(x)].cooldownLeft < 5000) ?? prefer.find((x) => this.has(x));
        if (!id) continue;
        const front = this.frontAttackerRow(lane);
        // A bush in front of the attackers hides whoever walks into it: hold them before they get there.
        const bush = this.bushAhead(lane, front);
        const first = bush >= 0 ? [bush + 1, bush + 2] : front >= 0 ? [front + 1, front + 2] : [];
        const cols = this.freeRows(lane, [...first, ...slot.cols], false, true);
        if (cols.length) return { id, cols };
        continue;
      }
      if (attackers >= needA) continue;
      const id = this.pickAttacker(lane, slot.prefer ?? ['hachiware']);
      if (!id) continue;
      const cols = this.freeRows(lane, slot.cols, true);
      if (cols.length) return { id, cols };
      const fallback = this.freeRows(lane, [0, 1, 2, 3], false);
      if (fallback.length) return { id, cols: fallback };
    }
    return null;
  }

  private place(id: string, lane: number, cols: number[]): boolean {
    const i = this.cardIndex(id);
    if (i < 0) return false;
    for (const col of cols) {
      if (this.sim.canPlace(i, lane, col) !== 'ok') continue;
      // It goes down: a one-use card stands nowhere afterwards, so place()'s answer does not say whether it went.
      this.sim.place(i, lane, col);
      return true;
    }
    return false;
  }

  private affordable(id: string): boolean {
    const i = this.cardIndex(id);
    if (i < 0) return false;
    const c = this.sim.cards[i];
    return c.cooldownLeft <= 0 && this.sim.weeds >= c.def.cost;
  }

  tick(): void {
    const s = this.sim;
    if (s.status !== 'playing') return;
    // Endless mode between stages: the bot keeps its team and goes straight on.
    if (s.waves instanceof EndlessWaves && s.waves.waiting) s.beginStage();
    if (Number.isFinite(this.opts.reactionMs)) {
      for (const p of s.pickups) {
        if (p.kind === 'weed' && (p.state === 'idle' || p.state === 'sprout') && s.t - p.bornAt >= this.opts.reactionMs) s.collect(p.uid);
      }
    }
    if (s.t < this.nextThink) return;
    this.nextThink = s.t + this.opts.thinkMs;
    for (let k = 0; k < 4; k++) if (!this.think()) break;
  }

  /** Without フタバ or ヒトハ, a water lane under attack is defended from the land beside it: the next モモンガ for the bank
   *  with the fewest, or null when there is nothing to add. */
  private bankHelp(water: number): { id: string; lane: number; cols: number[] } | null {
    if (!this.has('momonga')) return null;
    const banks = [water - 1, water + 1].filter((l) => this.sim.laneActive[l] && !this.sim.water[l]).sort((a, b) => this.count(a, ['momonga']) - this.count(b, ['momonga']));
    for (const lane of banks) {
      if (this.count(lane, ['momonga']) >= 2) continue;
      const cols = this.freeRows(lane, [2, 1, 3, 0], false);
      if (cols.length) return { id: 'momonga', lane, cols };
    }
    return null;
  }

  private think(): boolean {
    const s = this.sim;
    const lanes = s.activeLanes;
    const land = this.land();

    // 1. Emergency: an enemy is on the field in a lane with no attacker. A water lane without フタバ or ヒトハ is helped
    // from the banks instead.
    const bare = lanes
      .filter((l) => this.count(l, ATTACKERS) === 0 && this.deepest(l) > -TILE * 0.2)
      .filter((l) => !s.water[l] || this.waterFriends() || this.bankHelp(l))
      .sort((a, b) => this.deepest(b) - this.deepest(a));
    if (bare.length) {
      const lane = bare[0];
      if (s.water[lane] && !this.waterFriends()) {
        const help = this.bankHelp(lane)!;
        return this.affordable(help.id) ? this.place(help.id, help.lane, help.cols) : false;
      }
      const id = s.water[lane] ? WATER_ATTACKERS.find((x) => this.has(x))! : this.has('hachiware') ? 'hachiware' : this.has('usagi') ? 'usagi' : this.pickAttacker(lane, ATTACKERS);
      if (!id) return false;
      if (this.affordable(id)) {
        const cols = this.freeRows(lane, [3, 2, 4, 1, 0], true);
        return this.place(id, lane, cols.length ? cols : this.freeRows(lane, [0, 1, 2, 3], false));
      }
      return false; // save for it
    }

    // A フグ stops three tiles short of whoever it spits at: a lane held only by jabs can never reach it, and rebuilding
    // the wall it spits at would keep it there for good. Any player would put a shooter down, once the rest is built (so
    // only with 草 to spare: this is for a stand-off, not the opening).
    const longShot = s.weeds >= 500 ? LONG_SHOTS.find((x) => this.has(x) && this.affordable(x)) : undefined;
    if (longShot) {
      for (const lane of land) {
        if (this.count(lane, LONG_SHOTS) === 0 && this.laneEnemies(lane).some((e) => e.def.attack.kind === 'ranged')) {
          // Behind the wall if there is room, else right up against the enemy.
          const cols = this.freeRows(lane, [1, 2, 0, 3, 4, 5, 6], false, true);
          if (cols.length) return this.place(longShot, lane, cols);
        }
      }
    }

    // 2. Opening: one producer per land lane.
    const target = this.producerTarget();
    if (this.has('chiikawa') && this.totalProducers() < Math.min(target, land.length)) {
      const lane = [...land].sort((a, b) => this.count(a, ['chiikawa']) - this.count(b, ['chiikawa']))[0];
      if (this.count(lane, ['chiikawa']) === 0) {
        if (this.affordable('chiikawa')) return this.place('chiikawa', lane, this.freeRows(lane, [0, 1], false));
        return false;
      }
    }

    // 3. Most threatened lane's next template piece; save up for it.
    const ranked = lanes
      .map((lane) => ({ lane, threat: this.threat(lane), next: this.nextFor(lane) }))
      .filter((x) => x.next)
      .sort((a, b) => b.threat - a.threat || this.count(a.lane, ATTACKERS) - this.count(b.lane, ATTACKERS));
    const top = ranked[0];
    if (top && top.next) {
      const quiet = top.threat <= 0;
      if (quiet && this.has('chiikawa') && this.totalProducers() < target && this.affordable('chiikawa')) {
        for (const lane of land) if (this.place('chiikawa', lane, this.freeRows(lane, [1, 0], false))) return true;
      }
      const { id, cols } = top.next;
      if (this.affordable(id)) return this.place(id, top.lane, cols);
      // A piece on a long cooldown should not block everything else.
      const ci = this.cardIndex(id);
      if (ci >= 0 && s.cards[ci].cooldownLeft > 3000) {
        for (const other of ranked.slice(1)) {
          if (other.next && other.next.id !== id && this.affordable(other.next.id)) return this.place(other.next.id, other.lane, other.next.cols);
        }
      }
      return false;
    }

    // 4. Nothing planned: more producers.
    if (this.has('chiikawa') && this.totalProducers() < target && this.affordable('chiikawa')) {
      for (const lane of land) if (this.place('chiikawa', lane, this.freeRows(lane, [1, 0], false))) return true;
    }
    return false;
  }
}

interface BotResult {
  levelId: string;
  won: boolean;
  timeS: number;
  rescuesUsed: number;
  alliesLost: number;
  weedsCollected: number;
  enemiesDefeated: number;
  lostLane: number;
}

/** Run a sim with a bot until it ends (or a time cap). */
export function runBot(sim: Sim, opts: BotOptions = BOT_GOOD, capMs = 15 * 60 * 1000): BotResult {
  const bot = new Bot(sim, opts);
  while (sim.status === 'playing' && sim.t < capMs) {
    bot.tick();
    sim.step(STEP_MS);
    sim.events.length = 0;
  }
  return {
    levelId: sim.levelId,
    won: sim.status === 'won',
    timeS: Math.round(sim.t / 1000),
    rescuesUsed: sim.stats.rescuesUsed,
    alliesLost: sim.stats.alliesLost,
    weedsCollected: sim.stats.weedsCollected,
    enemiesDefeated: sim.stats.enemiesDefeated,
    lostLane: sim.lostLane,
  };
}
