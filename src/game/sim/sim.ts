import {
  ALLY_ATTACK_MS,
  allyFeetY,
  ATTACK_RELEASE_MS,
  AUTO_COLLECT_MS,
  BASE_Y,
  CHIIKAWA_PULL_MS,
  COLLAPSE_MS,
  CONTACT,
  FADE_MS,
  FIELD_ENTRY_Y,
  HIT_LINE,
  laneX,
  MUZZLE,
  PROJECTILE_SPEED,
  RESCUE_BOSS_DAMAGE,
  RESCUE_SPEED,
  COLS,
  colOfY,
  colY,
  LANE_LEN,
  ODE_SPEED,
  SPAWN_Y,
  SPEED_PX_PER_S,
  SPIT_SPEED,
  TILE,
  WEED_PULLED_MS,
  WEED_SPROUT_MS,
  WEED_WILT_MS,
  WEEDS_CAP,
} from './constants';
import { ENEMIES, UNITS, WORLDS } from './defs';
import { EndlessWaves } from './endless';
import { hashString, Rng } from './rng';
import type {
  Ally,
  Cameo,
  CardState,
  DevRules,
  Enemy,
  EnemyAbility,
  EnemyDef,
  EnemyState,
  LevelDef,
  Pickup,
  Projectile,
  Rescue,
  SimEvent,
  SimStats,
  SimStatus,
  SproutDef,
  Sweep,
  TerrainDef,
  UnitDef,
} from './types';
import { abilityBusyMs, attackIntervalOf, fallMsOf, jumpAt, jumpMsOf, moveSpeedMulOf, spawnMsOf, swingOf, tempoOf } from './tempo';
import { ScriptedWaves, type WaveHost, type WaveSource } from './waves';

export interface SimConfig {
  lanes: number[];
  startWeeds: number;
  sprout: SproutDef | null;
  terrain: TerrainDef[];
  rescues: boolean;
  deck: string[];
  /** Multiplies every enemy's HP (a world's difficulty). */
  enemyHp?: number;
  seed: number;
  autoCollect?: boolean;
  /** Every card ready from the start, without its opening wait (a ぶた入りラーメン券). */
  ready?: boolean;
  /** The friend 星 turns into: its card in the deck becomes that friend's card. Without one, 星 stays home. */
  wish?: string;
  /** Lanes that are water (World 5): only aquatic friends go on them and only aquatic enemies come down them. */
  water?: number[];
  waves: WaveSource;
  levelId?: string;
  /** Dev mode's testing ground: its rules (see DevRules). Nothing is lost there: an enemy that reaches the base with
   *  no car to stop it simply leaves the field. */
  dev?: DevRules;
}

/** How far either side of a bush's middle an enemy is hidden in it (the bush's picture). */
const BUSH_REACH = Math.round(TILE * 0.32);

/** Every character is always in one mode (owner's call, 2026-11-07). These modes have a length and, once begun, run to
 *  their end before anything else happens: a swing (or でかい鳥's grab), ちゅーしです's lunge, 六足の虫's jump, a goblin
 *  picking up 草, a song, セイレーン's phrase, a heal, a spell, a transformation. Walking, waiting between swings and
 *  hovering are open: they give way at once to whatever there is to do next. Only being defeated (or, for a friend,
 *  being carried off) ends a mode early. Frozen by むちゃうマン, an enemy waits where it is in its mode. */
const FIXED_MODES: ReadonlySet<EnemyState> = new Set<EnemyState>(['attack', 'aim', 'lunge', 'jump', 'steal', 'claws', 'summon', 'spawn', 'heal', 'spell', 'transform']);
/** How long 草 a goblin drops back stays to be picked up, where nothing sprouts (ms). */
const DROPPED_WEED_MS = 9000;
/** Where a goblin picks up 草: under its hand as it bends down at its feet in its pick-up frames, about half a tile
 *  behind its front (travel px; 92–99 px on the owner's frames). It walks on over a 草 until the 草 is there. One
 *  that sprouts under its back it picks up too, up to STEAL_SPAN further back: that takes in a 草 growing on its own
 *  tile while it fights (139 px back), which it grabs between swings (owner's call). */
const STEAL_REACH = TILE * 0.55;
const STEAL_SPAN = TILE * 0.3;
/** How soon an enemy that has just come up against a friend swings at it (ms). */
const FIRST_SWING_MS = 380;
/** ちいかわ's find, on her weed_found frames: the 草 is hers this long after they start (as her hand comes up with it, on
 *  the last frame), and she holds it up this long after that. */
const FOUND_LEAD_MS = 480;
const FOUND_HOLD_MS = 420;
/** Where her raised hand holds the 草 on that last frame, from the point she stands on (across, along the lane): the 草
 *  flies to the count from there (the renderer lifts it 40 px more). */
const FOUND_HAND = { across: -51, travel: 55 };
/** How long after one shot of a volley the next follows (ms): 古本屋's two books. */
const VOLLEY_GAP_MS = 170;
/** How fast a jab pushes an enemy back (travel px/s): half a tile in about a seventh of a second. */
const PUSH_SPEED = 600;
/** How long a missile falls before it lands (ms), and the gap between one lane's missile and the next. */
const MISSILE_FALL_MS = 700;
const MISSILE_STAGGER_MS = 90;
/** How far a missile may land from the enemy it was sent at, either way along the lane (px). */
const MISSILE_SCATTER = TILE * 0.2;
/** Where a taiyaki goes off: from this far in front of its tile (toward the enemies) to the back of its tile. */
const MINE_FRONT = TILE * 0.5;
/** むちゃうマン: from when he appears until his pose is struck and everyone freezes, and then until he is gone (ms). */
const CAMEO_POSE_MS = 1100;
const CAMEO_STAY_MS = 500;

/** `water`: a land friend on a water tile. `land`: a water friend (ヒトハ, フタバ, 島二郎) on a land tile. */
export type PlaceCheck = 'ok' | 'inactive' | 'occupied' | 'terrain' | 'water' | 'land' | 'cooldown' | 'weeds' | 'over';

export function simForLevel(
  level: LevelDef,
  deck: string[],
  opts: { attempt?: number; bonusWeeds?: number; autoCollect?: boolean; ready?: boolean; wish?: string; seed?: number } = {},
): Sim {
  return new Sim({
    levelId: level.id,
    lanes: level.lanes,
    startWeeds: level.startWeeds + (opts.bonusWeeds ?? 0),
    sprout: level.sprout,
    terrain: level.terrain,
    rescues: level.rescues,
    deck,
    enemyHp: WORLDS[level.world]?.enemyHp,
    seed: opts.seed ?? hashString(`${level.id}:${opts.attempt ?? 0}`),
    autoCollect: opts.autoCollect,
    ready: opts.ready,
    wish: opts.wish,
    water: WORLDS[level.world]?.water,
    waves: new ScriptedWaves(level.waves),
  });
}

export function simForEndless(
  pool: string[],
  deck: string[],
  opts: { seed?: number; bonusWeeds?: number; autoCollect?: boolean; ready?: boolean; wish?: string } = {},
): Sim {
  return new Sim({
    levelId: 'endless',
    lanes: [0, 1, 2, 3, 4],
    startWeeds: 50 + (opts.bonusWeeds ?? 0),
    sprout: { firstMs: 3000, minMs: 8000, maxMs: 12000, value: 25, lifeMs: 10000 },
    terrain: [],
    rescues: true,
    deck,
    seed: opts.seed ?? Date.now() >>> 0,
    autoCollect: opts.autoCollect,
    ready: opts.ready,
    wish: opts.wish,
    waves: new EndlessWaves(pool),
  });
}

export class Sim implements WaveHost {
  t = 0;
  rng: Rng;
  weeds: number;
  status: SimStatus = 'playing';
  readonly activeLanes: number[];
  readonly laneActive: boolean[];
  /** Which lanes are water, and the active ones that are. */
  readonly water: boolean[];
  readonly waterLanes: number[];
  readonly grid: (Ally | null)[][];
  readonly terrain: (TerrainDef['kind'] | null)[][];
  allies: Ally[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  rescues: Rescue[] = [];
  /** One-use cards crossing a lane (オデ's charge). */
  sweeps: Sweep[] = [];
  /** One-use friends on a tile for a moment (むちゃうマン). */
  cameos: Cameo[] = [];
  readonly cards: CardState[];
  events: SimEvent[] = [];
  readonly stats: SimStats = {
    rescuesUsed: 0,
    alliesLost: 0,
    weedsCollected: 0,
    enemiesDefeated: 0,
    placed: {},
    defeated: {},
    seen: {},
  };
  readonly waves: WaveSource;
  autoCollect: boolean;
  readonly levelId: string;
  lostLane = -1;
  private uidSeq = 1;
  private nextSproutAt: number;
  private readonly sprout: SproutDef | null;
  private readonly rescuesEnabled: boolean;
  private readonly enemyHp: number;
  /** The testing ground's rules, or null in a real battle. */
  readonly dev: DevRules | null;

  constructor(cfg: SimConfig) {
    this.rng = new Rng(cfg.seed);
    this.weeds = cfg.startWeeds;
    this.activeLanes = [...cfg.lanes].sort((a, b) => a - b);
    this.laneActive = [0, 1, 2, 3, 4].map((l) => this.activeLanes.includes(l));
    this.water = [0, 1, 2, 3, 4].map((l) => !!cfg.water?.includes(l));
    this.waterLanes = this.activeLanes.filter((l) => this.water[l]);
    this.grid = [0, 1, 2, 3, 4].map(() => new Array<Ally | null>(COLS).fill(null));
    this.terrain = [0, 1, 2, 3, 4].map(() => new Array<TerrainDef['kind'] | null>(COLS).fill(null));
    for (const t of cfg.terrain) if (this.laneActive[t.lane]) this.terrain[t.lane][t.col] = t.kind;
    this.cards = cfg.deck.flatMap((id): CardState[] => {
      const def = UNITS[id];
      if (!def) return [];
      if (!def.wish) return [{ def, cooldownLeft: cfg.ready ? 0 : def.initialCooldownMs, member: this.nextMember(def) }];
      // 星's card is the wished-for friend's card, cost and recharge and all (see WishDef).
      const wish = cfg.wish ? UNITS[cfg.wish] : undefined;
      if (!wish || wish.wish) return [];
      return [{ def: wish, star: def, cooldownLeft: cfg.ready ? 0 : wish.initialCooldownMs, member: this.nextMember(wish) }];
    });
    this.sprout = cfg.sprout;
    this.nextSproutAt = cfg.sprout ? cfg.sprout.firstMs : Infinity;
    this.rescuesEnabled = cfg.rescues;
    this.enemyHp = cfg.enemyHp ?? 1;
    this.autoCollect = !!cfg.autoCollect;
    this.waves = cfg.waves;
    this.levelId = cfg.levelId ?? 'custom';
    this.dev = cfg.dev ?? null;
    if (cfg.rescues) {
      for (const lane of this.activeLanes) {
        this.rescues.push({ lane, boat: this.water[lane], state: 'parked', y: BASE_Y + 70, prevY: BASE_Y + 70, hit: new Set(), startedAt: 0 });
      }
    }
  }

  // ------------------------------------------------------------ queries

  aliveEnemies(): number {
    let n = 0;
    for (const e of this.enemies) if (this.inPlay(e)) n++;
    return n;
  }

  /** Still on the field to be fought: not fallen, not flown away. */
  inPlay(e: Enemy): boolean {
    return e.state !== 'collapse' && e.state !== 'gone';
  }

  /** Whether an enemy's body is in this lane: its own lane, or for a giant any of its three. */
  covers(e: Enemy, lane: number): boolean {
    return Math.abs(e.lane - lane) <= e.half;
  }

  /** How many lanes lie between an enemy's body and this lane (0 when it is in it). */
  laneGap(e: Enemy, lane: number): number {
    return Math.max(0, Math.abs(e.lane - lane) - e.half);
  }

  /** The lanes an enemy's body is in, its own lane first. */
  lanesOf(e: Enemy): number[] {
    const out = [e.lane];
    for (let d = 1; d <= e.half; d++) out.push(e.lane - d, e.lane + d);
    return out;
  }

  allyAt(lane: number, col: number): Ally | null {
    return this.grid[lane]?.[col] ?? null;
  }

  enemyByUid(uid: number): Enemy | undefined {
    return this.enemies.find((e) => e.uid === uid);
  }

  allyByUid(uid: number): Ally | undefined {
    return this.allies.find((a) => a.uid === uid);
  }

  rescueOf(lane: number): Rescue | undefined {
    return this.rescues.find((r) => r.lane === lane);
  }

  allyDamage(a: Ally): number {
    return a.def.attack.damage ?? 0;
  }

  canPlace(cardIndex: number, lane: number, col: number): PlaceCheck {
    if (this.status !== 'playing') return 'over';
    const card = this.cards[cardIndex];
    if (!card) return 'over';
    if (lane < 0 || lane > 4 || col < 0 || col >= COLS || !this.laneActive[lane]) return 'inactive';
    // むちゃうマン appears wherever he is put, so any tile will do. Everyone else goes on an empty tile of their own
    // ground, オデ too (owner's call, 2026-11-08: he is put down like any friend): water friends on water, the rest on
    // land. So does a star, whoever it is to become: it stands there first.
    if (!this.anywhere(card)) {
      if (this.terrain[lane][col]) return 'terrain';
      if (this.water[lane] !== !!card.def.aquatic) return this.water[lane] ? 'water' : 'land';
      if (this.grid[lane][col]) return 'occupied';
    }
    if (this.dev?.free) return 'ok';
    if (card.cooldownLeft > 0) return 'cooldown';
    if (this.weeds < card.def.cost) return 'weeds';
    return 'ok';
  }

  /** Whether a card could go on a tile, ignoring cooldown and cost (for highlighting): any tile in an active lane
   *  for むちゃうマン, else an empty tile of its own ground (water for the islanders, land for the rest). */
  targetOpen(cardIndex: number, lane: number, col: number): boolean {
    const card = this.cards[cardIndex];
    if (card && this.anywhere(card)) return lane >= 0 && lane <= 4 && col >= 0 && col < COLS && this.laneActive[lane];
    return this.tileOpen(lane, col) && this.water[lane] === !!card?.def.aquatic;
  }

  /** A card that goes on any tile of an open lane, a friend standing there or not, water or land: むちゃうマン, who
   *  only appears there a moment (unless a star is bringing him, which has to stand somewhere first). */
  private anywhere(card: CardState): boolean {
    return !card.star && card.def.oneUse?.kind === 'freeze';
  }

  /** Tile check that ignores cooldown and cost (for highlighting). */
  tileOpen(lane: number, col: number): boolean {
    return (
      lane >= 0 && lane <= 4 && col >= 0 && col < COLS && this.laneActive[lane] && !this.terrain[lane][col] && !this.grid[lane][col]
    );
  }

  // ------------------------------------------------------------ commands

  place(cardIndex: number, lane: number, col: number): Ally | null {
    if (this.canPlace(cardIndex, lane, col) !== 'ok') return null;
    const card = this.cards[cardIndex];
    const def = card.def;
    if (!this.dev?.free) {
      this.weeds -= def.cost;
      card.cooldownLeft = def.cooldownMs;
    }
    this.stats.placed[def.id] = (this.stats.placed[def.id] ?? 0) + 1;
    const wish = card.star?.wish;
    // A one-use friend goes at once, unless a star is bringing them: then they go when it turns (see grantWish).
    if (def.oneUse && !wish) {
      this.useOneUse(def, lane, col);
      return null;
    }
    const interval = def.attack.intervalMs ?? 1000;
    // A star stands with its friend's HP, or its own if its friend has none (a one-use friend).
    const hp = def.hp || (card.star?.hp ?? 0);
    const a: Ally = {
      uid: this.uidSeq++,
      def,
      lane,
      col,
      hp,
      maxHp: hp,
      state: 'idle',
      anim: 'idle',
      animStart: this.t - this.rng.range(0, 1400),
      attackT: Math.max(0, interval - this.rng.range(250, 650)),
      pendingRelease: -1,
      nextProduceAt: def.produce ? this.t + def.produce.firstMs : Infinity,
      pullTarget: -1,
      pullAt: 0,
      songUntil: 0,
      spellUntil: 0,
      swayUntil: 0,
      hitFlashUntil: 0,
      collapseAt: -1,
      placedAt: this.t,
      catchphraseUntil: this.t + 4000,
      carriedBy: -1,
      // 星 places a star, which turns into the friend once this passes (see grantWish).
      wishUntil: wish ? this.t + wish.transformMs : 0,
      // A taiyaki starts cooking once it is itself (a star's wish first).
      readyAt: def.mine ? this.t + (wish?.transformMs ?? 0) + def.mine.readyMs : 0,
      shotsLeft: 0,
      member: card.member ?? null,
    };
    card.member = this.nextMember(def);
    if (def.support?.kind === 'aura_attackspeed' && !wish) a.anim = 'song';
    if (def.mine) a.anim = 'cook';
    this.grid[lane][col] = a;
    this.allies.push(a);
    this.events.push({ type: 'place', ally: a });
    return a;
  }

  /** Who a team's card brings next: one of its members, at random (nobody for any other card). */
  private nextMember(def: UnitDef): string | undefined {
    return def.members ? this.rng.pick(def.members) : undefined;
  }

  /** A one-use card does its one thing: オデ comes running in from the base end of the lane (see stepSweeps), or
   *  むちゃうマン appears on the tile to strike his pose (see stepCameos). */
  private useOneUse(def: UnitDef, lane: number, col: number): void {
    const u = def.oneUse!;
    if (u.kind === 'charge') {
      const y = BASE_Y + TILE * 0.5;
      this.sweeps.push({ uid: this.uidSeq++, source: def.id, lane, y, prevY: y, vy: -ODE_SPEED, hit: new Set(), startedAt: this.t, dead: false });
    } else {
      this.cameos.push({ uid: this.uidSeq++, def, lane, col, startedAt: this.t, firesAt: this.t + CAMEO_POSE_MS, leavesAt: this.t + CAMEO_POSE_MS + CAMEO_STAY_MS, fired: false });
    }
    this.events.push({ type: 'oneUse', def, lane, col });
  }

  remove(lane: number, col: number): boolean {
    const a = this.allyAt(lane, col);
    if (!a || this.status !== 'playing') return false;
    this.grid[lane][col] = null;
    this.releaseClaims(a);
    // It fades away as it was, as a beaten friend does.
    a.state = 'collapse';
    a.collapseAt = this.t;
    this.events.push({ type: 'remove', ally: a });
    return true;
  }

  // ------------------------------------------------------------ the testing ground (dev mode)

  /** The testing ground: a tile's terrain goes round none → stump → bush → none (a friend standing there stays). */
  devCycleTerrain(lane: number, col: number): void {
    if (!this.laneActive[lane] || col < 0 || col >= COLS) return;
    const now = this.terrain[lane][col];
    this.terrain[lane][col] = now === null ? 'stump' : now === 'stump' ? 'bush' : null;
  }

  /** The testing ground: every enemy is defeated where it is and falls as it would (its death frames, its fade); shots
   *  in flight go. */
  devDefeatEnemies(): void {
    for (const e of this.enemies) if (this.inPlay(e)) this.collapseEnemy(e);
    this.projectiles = [];
  }

  /** The testing ground: every friend on the field is defeated and falls as it would. */
  devDefeatFriends(): void {
    for (const a of this.allies) if (this.onTile(a)) this.collapseAlly(a);
  }

  /** The testing ground: every friend and enemy back to full HP. */
  devHealAll(): void {
    for (const a of this.allies) if (a.state !== 'collapse') a.hp = a.maxHp;
    for (const e of this.enemies) if (this.inPlay(e)) e.hp = e.maxHp;
  }

  /** The testing ground: who 星's card turns into from now on (a star already on the field keeps its wish). */
  devSetWish(id: string): void {
    const wish = UNITS[id];
    if (!wish || wish.wish) return;
    for (const c of this.cards) {
      if (!c.star) continue;
      c.def = wish;
      c.member = this.nextMember(wish);
    }
  }

  /** The testing ground: every rescue car parked and ready again. */
  devRefillCars(): void {
    for (const r of this.rescues) {
      r.state = 'parked';
      r.y = r.prevY = BASE_Y + 70;
      r.hit = new Set();
    }
  }

  /** The testing ground: which friend stands on a tile, or else the enemy in that lane nearest the tile's middle
   *  (within about a tile), for its readout. */
  devPick(lane: number, col: number): Ally | Enemy | null {
    const a = this.allyAt(lane, col);
    if (a && a.state !== 'collapse') return a;
    const mid = colY(col) + TILE / 2;
    let best: Enemy | null = null;
    for (const e of this.enemies) {
      if (!this.inPlay(e) || !this.covers(e, lane)) continue;
      const d = Math.abs(e.y - HIT_LINE / 2 - mid);
      if (d < TILE * 1.1 && (!best || d < Math.abs(best.y - HIT_LINE / 2 - mid))) best = e;
    }
    return best;
  }

  /** Collect a pickup by uid (player tap). */
  collect(uid: number, auto = false): boolean {
    const p = this.pickups.find((q) => q.uid === uid);
    if (!p || (p.state !== 'sprout' && p.state !== 'idle')) return false;
    this.gainWeeds(p.value);
    p.state = 'pulled';
    p.stateAt = this.t;
    this.stats.weedsCollected += p.value;
    this.events.push({ type: 'weedCollect', pickup: p, auto });
    return true;
  }

  /** Nearest collectable pickup to a point within radius. */
  pickupNear(x: number, y: number, radius = TILE * 0.5): Pickup | null {
    let best: Pickup | null = null;
    let bestD = radius * radius;
    for (const p of this.pickups) {
      if (p.state !== 'sprout' && p.state !== 'idle') continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  weedOnTile(lane: number, col: number): Pickup | null {
    return this.pickups.find((p) => p.kind === 'weed' && p.lane === lane && p.col === col && (p.state === 'sprout' || p.state === 'idle')) ?? null;
  }

  // ------------------------------------------------------------ wave host

  spawnEnemy(def: EnemyDef, lane: number, y: number, opts: { hpMul?: number; boss?: boolean; waveIndex: number }): Enemy {
    const hp = Math.round(def.hp * (opts.hpMul ?? 1) * this.enemyHp);
    const disguise = def.abilities.some((a) => a.kind === 'disguise');
    const flier = def.abilities.some((a) => a.kind === 'flier');
    const e: Enemy = {
      uid: this.uidSeq++,
      def,
      lane,
      x: laneX(lane),
      y,
      prevY: y,
      hp,
      maxHp: hp,
      state: 'walk',
      anim: flier ? 'float' : 'walk',
      animStart: this.t - this.rng.range(0, 800),
      attackT: 0,
      pendingHitAt: -1,
      targetUid: -1,
      slowUntil: 0,
      hitFlashUntil: 0,
      abilityT: this.rng.range(0, 1500),
      abilityBusyUntil: 0,
      stateUntil: 0,
      disguised: disguise,
      form: disguise ? 'small' : 'normal',
      boss: !!(opts.boss || def.boss),
      collapseAt: -1,
      spawnedAt: this.t,
      waveIndex: opts.waveIndex,
      flight: flier ? { target: -1, carry: -1, out: false } : null,
      half: def.giant && this.laneActive[lane - 1] && this.laneActive[lane + 1] ? 1 : 0,
      moveFrom: y,
      moveTo: y,
      stolen: [],
      stealTarget: -1,
      calls: [],
      frozenUntil: 0,
      pushLeft: 0,
    };
    // Its first use. 擬態型 sings, 山姥 chants and セイレーン calls `firstMs` after coming onto the field (their timers fill only there,
    // from below 0 when that is further off than a cooldown); 黒い星 first heals its stop and its cooldown after it
    // appears, less the random start above (3 to 4.5 s).
    for (const ab of def.abilities) {
      if (ab.kind === 'song' || ab.kind === 'spell' || ab.kind === 'summon') e.abilityT = ab.cooldownMs - ab.firstMs;
      else if (ab.kind === 'heal_aura') e.abilityT -= abilityBusyMs(ab);
    }
    this.enemies.push(e);
    this.stats.seen[def.id] = (this.stats.seen[def.id] ?? 0) + 1;
    if (this.waves instanceof EndlessWaves) this.waves.noteSpawned(opts.waveIndex);
    this.events.push({ type: 'enemySpawn', enemy: e });
    return e;
  }

  emitBanner(kind: 'big' | 'final' | 'boss', bossId?: string): void {
    this.events.push({ type: 'banner', kind, bossId });
  }

  emitWaveStart(index: number, total: number): void {
    this.events.push({ type: 'waveStart', index, total });
  }

  // ------------------------------------------------------------ step

  step(dt: number): void {
    if (this.status !== 'playing') return;
    this.t += dt;
    for (const c of this.cards) if (c.cooldownLeft > 0) c.cooldownLeft = Math.max(0, c.cooldownLeft - dt);
    this.waves.step(this);
    this.stepSprouts();
    this.stepPickups();
    this.stepAllies(dt);
    this.stepEnemies(dt);
    if (this.status !== 'playing') return;
    this.stepProjectiles(dt);
    this.stepSweeps(dt);
    this.stepCameos();
    this.stepRescues(dt);
    this.cleanup();
    if (this.status === 'playing' && this.waves.done() && this.aliveEnemies() === 0) {
      this.status = 'won';
      for (const p of this.pickups) if (p.state === 'sprout' || p.state === 'idle') this.collect(p.uid, true);
      this.events.push({ type: 'won' });
    }
  }

  private gainWeeds(n: number): void {
    this.weeds = Math.min(WEEDS_CAP, this.weeds + n);
  }

  // ------------------------------------------------------------ weeds

  private stepSprouts(): void {
    if (!this.sprout || this.t < this.nextSproutAt) return;
    const s = this.sprout;
    this.nextSproutAt = this.t + this.rng.range(s.minMs, s.maxMs);
    const empty: [number, number][] = [];
    const occupied: [number, number][] = [];
    for (const lane of this.activeLanes) {
      for (let col = 0; col < COLS; col++) {
        // Nothing grows on the water.
        if (this.terrain[lane][col] || this.water[lane] || this.weedOnTile(lane, col)) continue;
        (this.grid[lane][col] ? occupied : empty).push([lane, col]);
      }
    }
    const pool = empty.length && (this.rng.chance(0.75) || !occupied.length) ? empty : occupied;
    if (!pool.length) return;
    const [lane, col] = this.rng.pick(pool);
    const p: Pickup = {
      uid: this.uidSeq++,
      kind: 'weed',
      lane,
      col,
      x: laneX(lane) + this.rng.range(-16, 16),
      y: colY(col) + TILE * 0.28, // ahead of the tile's ally, toward the enemies
      value: s.value,
      bornAt: this.t,
      expiresAt: this.t + WEED_SPROUT_MS + s.lifeMs,
      autoAt: this.autoCollect ? this.t + AUTO_COLLECT_MS : Infinity,
      state: 'sprout',
      stateAt: this.t,
      claimedBy: -1,
    };
    this.pickups.push(p);
    this.events.push({ type: 'weedSprout', pickup: p });
  }

  private stepPickups(): void {
    for (const p of this.pickups) {
      if (p.state === 'sprout' && this.t - p.bornAt >= WEED_SPROUT_MS) {
        p.state = 'idle';
        p.stateAt = this.t;
      }
      if ((p.state === 'sprout' || p.state === 'idle') && this.t >= p.autoAt) {
        this.collect(p.uid, true);
        continue;
      }
      if ((p.state === 'sprout' || p.state === 'idle') && p.claimedBy < 0 && this.t >= p.expiresAt) {
        p.state = 'wilt';
        p.stateAt = this.t;
        this.events.push({ type: 'weedWilt', pickup: p });
      }
      if (p.state === 'wilt' && this.t - p.stateAt >= WEED_WILT_MS) p.state = 'gone';
      if (p.state === 'pulled' && this.t - p.stateAt >= WEED_PULLED_MS) p.state = 'gone';
    }
  }

  private releaseClaims(a: Ally): void {
    for (const p of this.pickups) if (p.claimedBy === a.uid) p.claimedBy = -1;
    a.pullTarget = -1;
  }

  // ------------------------------------------------------------ allies

  private stepAllies(dt: number): void {
    // Stars whose wish comes true now turn into their friends; until then a star does nothing.
    for (const a of this.allies) if (a.wishUntil > 0 && this.t >= a.wishUntil && this.onTile(a)) this.grantWish(a);
    // パジャマパーティーズ: friends in a lane where they are singing (not silenced) attack faster.
    const pace = [1, 1, 1, 1, 1];
    for (const a of this.allies) {
      const s = a.def.support;
      if (s?.kind === 'aura_attackspeed' && this.onTile(a) && !a.wishUntil && a.songUntil <= this.t) pace[a.lane] = Math.max(pace[a.lane], s.mul);
    }
    for (const a of this.allies) {
      if (!this.onTile(a) || a.wishUntil) continue;
      // A taiyaki is a trap, not a fighter: it cooks, then waits for an enemy to reach it.
      if (a.def.mine) {
        this.stepMine(a);
        continue;
      }
      const silenced = a.songUntil > this.t;
      if (a.def.produce) this.stepProducer(a, dt, silenced);
      if (a.def.support) {
        this.stepSupport(a, silenced);
        continue;
      }
      if (a.def.attack.kind === 'none') {
        if (a.state === 'attack' && this.t - a.animStart >= ALLY_ATTACK_MS) this.setAllyAnim(a, 'idle');
        continue;
      }
      if (a.pendingRelease >= 0) {
        if (this.t >= a.pendingRelease) {
          a.pendingRelease = -1;
          this.release(a);
        }
        continue;
      }
      // Its attack is a mode: it plays out whole (even silenced or held midway), and the next waits for it.
      if (a.state === 'attack' && this.t - a.animStart >= ALLY_ATTACK_MS) this.setAllyAnim(a, 'idle');
      if (silenced) continue;
      const interval = a.def.attack.intervalMs ?? 1400;
      // A faster lane (パジャマパーティーズ) and a partner beside it (フタバ and ヒトハ, each with the other) quicken the
      // whole attack, the wind-up too.
      const speed = pace[a.lane] * (a.def.bond?.attackMul && this.bonded(a) ? a.def.bond.attackMul : 1);
      a.attackT = Math.min(interval, a.attackT + dt * speed);
      if (a.state === 'attack') continue;
      // うさぎ（クール） never moves: her missiles just come, once there is something on the field to drop them on.
      if (a.def.attack.kind === 'missiles') {
        if (a.attackT >= interval && this.launchMissiles(a)) a.attackT = 0;
        continue;
      }
      if (a.attackT >= interval && this.hasTarget(a)) {
        a.attackT = 0;
        a.shotsLeft = 0;
        a.pendingRelease = this.t + (a.def.attack.releaseMs ?? ATTACK_RELEASE_MS) / speed;
        this.setAllyAnim(a, 'attack');
        this.events.push({ type: 'allyAttack', ally: a });
      }
    }
  }

  /** 星's wish comes true: the star becomes the friend wished for, who starts doing what they do from now (a little pop,
   *  as when placed). A one-use friend does their one thing instead, and the tile is free again. */
  private grantWish(a: Ally): void {
    a.wishUntil = 0;
    if (a.def.oneUse) {
      this.grid[a.lane][a.col] = null;
      this.releaseClaims(a);
      this.allies = this.allies.filter((o) => o !== a);
      this.useOneUse(a.def, a.lane, a.col);
      this.events.push({ type: 'wishGranted', lane: a.lane, col: a.col, ally: null });
      return;
    }
    a.state = 'idle';
    a.anim = a.def.support?.kind === 'aura_attackspeed' ? 'song' : a.def.mine ? 'cook' : 'idle';
    a.animStart = this.t;
    a.placedAt = this.t;
    if (a.def.produce) a.nextProduceAt = this.t + a.def.produce.firstMs;
    a.catchphraseUntil = this.t + 4000;
    this.events.push({ type: 'wishGranted', lane: a.lane, col: a.col, ally: a });
  }

  /** Whether a friend's partner (BondDef) stands right beside it in its lane, in front or behind, and is itself (a
   *  star still turning into the partner does not count yet). */
  bonded(a: Ally): boolean {
    const b = a.def.bond;
    if (!b || !this.onTile(a)) return false;
    for (const dc of [-1, 1]) {
      const o = this.allyAt(a.lane, a.col + dc);
      if (o && o.def.id === b.with && this.onTile(o) && !o.wishUntil) return true;
    }
    return false;
  }

  /** Standing on its tile: not fallen, not in a flier's talons. */
  private onTile(a: Ally): boolean {
    return a.state !== 'collapse' && a.state !== 'carried';
  }

  /** A friend who helps instead of attacking: sings, speeding up its lane (パジャマパーティーズ, see stepAllies).
   *  Silenced by a song, it does not. */
  private stepSupport(a: Ally, silenced: boolean): void {
    const want = silenced ? 'idle' : 'song';
    if (a.anim !== want) {
      a.anim = want;
      a.animStart = this.t;
    }
  }

  /** A taiyaki (MineDef): cooking until it is ready (enemies bite it like anyone), then waiting for the first enemy on
   *  the ground to reach it, which sets it off (see mineGoesOff). One that has gone past it (六足の虫 in the air over it)
   *  is not on it. */
  private stepMine(a: Ally): void {
    if (this.t < a.readyAt) return;
    if (a.anim === 'cook') {
      a.anim = 'idle';
      a.animStart = this.t;
      this.events.push({ type: 'cooked', ally: a });
    }
    const front = colY(a.col) + CONTACT - 0.5;
    const back = colY(a.col) + TILE;
    for (const e of this.enemies) {
      if (!this.onGround(e) || !this.covers(e, a.lane) || e.y < front || e.y > back) continue;
      this.mineGoesOff(a);
      return;
    }
  }

  /** On the ground to be hit from below or beside: in play, not a flier, not 六足の虫 in the air. */
  private onGround(e: Enemy): boolean {
    return this.inPlay(e) && !e.flight && !(e.state === 'jump' && e.pendingHitAt < 0 && e.y < e.moveTo);
  }

  /** A taiyaki goes off: every enemy on the ground in its lane from half a tile in front of its tile to the back of
   *  it takes its blow (through armour), and it is used up: gone from its tile at once (not beaten: it is not counted
   *  as a friend lost). */
  private mineGoesOff(a: Ally): void {
    const m = a.def.mine!;
    const front = colY(a.col) - MINE_FRONT;
    const back = colY(a.col) + TILE;
    this.grid[a.lane][a.col] = null;
    this.releaseClaims(a);
    a.state = 'collapse';
    a.anim = 'idle';
    a.collapseAt = this.t - COLLAPSE_MS - FADE_MS - 1;
    a.pendingRelease = -1;
    this.events.push({ type: 'mine', ally: a });
    for (const e of this.enemies) {
      if (!this.onGround(e) || !this.covers(e, a.lane) || e.y < front || e.y > back) continue;
      this.damageEnemy(e, m.damage, a.def.id, 'fx_hit', true, a.lane);
    }
  }

  /** うさぎ（クール）'s missiles: one for each lane with an enemy on the field to drop it on (one of that lane's enemies
   *  on the ground, at random, never one hidden in a bush or ちいかぶ in disguise), each landing a moment after the last,
   *  a little either side of where its enemy was. False if there was nowhere to drop one. */
  private launchMissiles(a: Ally): boolean {
    const atk = a.def.attack;
    const out: Projectile[] = [];
    for (const lane of this.activeLanes) {
      const there = this.enemies.filter((e) => this.covers(e, lane) && this.targetableEnemy(e) && this.onGround(e) && e.y < BASE_Y);
      if (!there.length) continue;
      const e = this.rng.pick(there);
      const yT = Math.max(FIELD_ENTRY_Y, e.y - HIT_LINE + this.rng.range(-MISSILE_SCATTER, MISSILE_SCATTER));
      const p: Projectile = {
        uid: this.uidSeq++,
        fx: atk.fx ?? 'fx_missile',
        lane,
        x0: laneX(lane),
        x: laneX(lane),
        y: yT,
        y0: yT,
        prevY: yT,
        vy: 0,
        damage: this.allyDamage(a),
        source: a.def.id,
        drop: { t0: this.t + out.length * MISSILE_STAGGER_MS, dur: MISSILE_FALL_MS, yT, tiles: atk.blastTiles ?? 0.75 },
        bornAt: this.t,
        dead: false,
      };
      out.push(p);
    }
    if (!out.length) return false;
    this.projectiles.push(...out);
    this.events.push({ type: 'missiles', ally: a, projectiles: out });
    return true;
  }

  private setAllyAnim(a: Ally, anim: 'idle' | 'attack' | 'pull'): void {
    a.state = anim;
    a.anim = anim;
    a.animStart = this.t;
  }

  private stepProducer(a: Ally, dt: number, silenced: boolean): void {
    const prod = a.def.produce!;
    if (silenced) {
      a.nextProduceAt += dt;
      return;
    }
    if (this.t >= a.nextProduceAt) {
      a.nextProduceAt = this.t + prod.intervalMs;
      // The 草 she finds is drawn in her hand on her frames (owner's call, 2026-11-08), so none is laid out for picking
      // up: it is hers at once, and flies to the count from her hand.
      const p: Pickup = {
        uid: this.uidSeq++,
        kind: 'drop',
        lane: a.lane,
        col: a.col,
        x: laneX(a.lane) + FOUND_HAND.across,
        y: allyFeetY(a.col) + FOUND_HAND.travel,
        value: prod.amount,
        bornAt: this.t,
        expiresAt: Infinity,
        autoAt: Infinity,
        state: 'idle',
        stateAt: this.t,
        claimedBy: -1,
      };
      this.pickups.push(p);
      this.events.push({ type: 'produce', ally: a, pickup: p });
      this.collect(p.uid, true);
    }
    if (a.pullTarget < 0) {
      if (a.state === 'pull' && this.t - a.animStart > FOUND_LEAD_MS + FOUND_HOLD_MS) this.setAllyAnim(a, 'idle');
      for (const p of this.pickups) {
        if (p.kind !== 'weed' || p.claimedBy >= 0 || (p.state !== 'idle' && p.state !== 'sprout')) continue;
        if (Math.abs(p.lane - a.lane) + Math.abs(p.col - a.col) <= prod.pullRadius) {
          p.claimedBy = a.uid;
          a.pullTarget = p.uid;
          a.pullAt = this.t + CHIIKAWA_PULL_MS;
          this.setAllyAnim(a, 'pull');
          this.events.push({ type: 'pull', ally: a, pickup: p });
          break;
        }
      }
    } else if (this.t >= a.pullAt) {
      const uid = a.pullTarget;
      a.pullTarget = -1;
      const p = this.pickups.find((q) => q.uid === uid);
      if (p) {
        p.claimedBy = -1;
        this.collect(uid, true);
      }
    }
    // Between finds she sits searching, left and right; as a find comes she plucks it and holds it up (her frames).
    if (a.state === 'idle') {
      const left = a.nextProduceAt - this.t;
      const since = prod.intervalMs - left;
      const want = left <= FOUND_LEAD_MS || (since >= 0 && since < FOUND_HOLD_MS) ? 'weed_found' : 'weed_search';
      if (a.anim !== want) {
        a.anim = want;
        a.animStart = this.t;
      }
    }
  }

  private targetableEnemy(e: Enemy): boolean {
    return this.inPlay(e) && !e.disguised && e.y >= FIELD_ENTRY_Y && !this.hidden(e);
  }

  /** Hidden in a bush (World 2's 茂み): a walking enemy whose feet are in the middle of a bush tile in its lane, where
   *  the bush's picture stands. Friends cannot see it to aim at it, and shots fly past it; a giant is too big to hide
   *  in one, and a flier is above it. */
  hidden(e: Enemy): boolean {
    if (e.half || e.flight || e.y < 0 || e.y >= LANE_LEN) return false;
    const col = colOfY(e.y);
    return this.terrain[e.lane]?.[col] === 'bush' && Math.abs(e.y - (colY(col) + TILE / 2)) <= BUSH_REACH;
  }

  /** The first stump (World 2's 切り株) a shot going from `from` to `to` along a lane runs into, as the point of the lane
   *  where it stops (the middle of the stump's tile), or null. */
  private stumpCrossed(lane: number, from: number, to: number): number | null {
    let hit: number | null = null;
    const row = this.terrain[lane];
    if (!row) return null;
    for (let col = 0; col < COLS; col++) {
      if (row[col] !== 'stump') continue;
      const line = colY(col) + TILE / 2;
      if (to < from ? line >= to && line < from && (hit === null || line > hit) : line > from && line <= to && (hit === null || line < hit)) hit = line;
    }
    return hit;
  }

  /** A shot runs into a stump and stops there. */
  private blockShot(p: Projectile, at: number): void {
    p.dead = true;
    p.y = at;
    this.events.push({ type: 'blocked', lane: p.lane, y: at });
  }

  /** Nearest enemy in a lane between minY and maxY (feet), i.e. the one closest to the ally. */
  private firstEnemyInLane(lane: number, minY: number, maxY: number): Enemy | null {
    let best: Enemy | null = null;
    for (const e of this.enemies) {
      if (!this.covers(e, lane) || !this.targetableEnemy(e)) continue;
      if (e.y < minY || e.y > maxY) continue;
      if (!best || e.y > best.y) best = e;
    }
    return best;
  }

  private targetFor(a: Ally, lane = a.lane): Enemy | null {
    const top = colY(a.col);
    const maxY = top + TILE;
    const range = a.def.attack.rangeTiles;
    const minY = range !== undefined ? top - range * TILE : FIELD_ENTRY_Y;
    return this.firstEnemyInLane(lane, minY, maxY);
  }

  private hasTarget(a: Ally): boolean {
    // More than its own lane: モモンガ's three acorns, and ラッコ's sweep (`sweepLanes` either side of his).
    const spread = a.def.attack.kind === 'spread3' ? 1 : (a.def.attack.sweepLanes ?? 0);
    if (spread) {
      for (let l = a.lane - spread; l <= a.lane + spread; l++) if (this.laneActive[l] && this.targetFor(a, l)) return true;
      return false;
    }
    return !!this.targetFor(a);
  }

  private release(a: Ally): void {
    if (a.state === 'collapse') return;
    const atk = a.def.attack;
    const damage = this.allyDamage(a);
    const muzzleY = allyFeetY(a.col) - MUZZLE;
    switch (atk.kind) {
      case 'hitscan': {
        // One blow at the first enemy within reach. A sweep (ラッコ's sword, `sweepLanes`) strikes the first in each lane
        // either side too, nearest lanes first, each enemy once (a giant across them, in the nearest of its lanes).
        const spread = atk.sweepLanes ?? 0;
        const struck = new Set<Enemy>();
        for (let gap = 0; gap <= spread; gap++) {
          for (const lane of gap ? [a.lane - gap, a.lane + gap] : [a.lane]) {
            if (gap && !this.laneActive[lane]) continue;
            const e = this.targetFor(a, lane);
            if (!e || struck.has(e)) continue;
            struck.add(e);
            this.events.push({ type: 'jab', ally: a, enemy: e, lane });
            this.damageEnemy(e, damage, a.def.id, atk.fx ?? 'fx_hit', !!atk.ignoresArmor, lane);
            if (atk.pushTiles) this.push(e, atk.pushTiles * TILE);
          }
        }
        break;
      }
      case 'projectile': {
        const p = this.spawnProjectile(a, a.lane, muzzleY, damage);
        p.splashBehind = atk.splashBehind;
        p.slowMs = atk.slowMs;
        if (atk.passThrough) p.passed = new Set();
        // A volley (古本屋's two books): the next shot follows a moment later, whatever it finds then.
        if (a.shotsLeft > 0) a.shotsLeft--;
        else a.shotsLeft = (atk.volley ?? 1) - 1;
        if (a.shotsLeft > 0) a.pendingRelease = this.t + VOLLEY_GAP_MS;
        break;
      }
      case 'spread3': {
        for (let l = a.lane - 1; l <= a.lane + 1; l++) if (this.laneActive[l]) this.spawnProjectile(a, l, muzzleY, damage);
        break;
      }
      case 'lob': {
        const e = this.targetFor(a);
        if (!e) break;
        const dist = Math.max(0, muzzleY - (e.y - HIT_LINE));
        const p = this.spawnProjectile(a, a.lane, muzzleY, damage);
        p.vy = 0;
        p.lob = { targetUid: e.uid, t0: this.t, dur: 520 + dist / 2.4, yT: e.y - HIT_LINE, height: 80 + dist * 0.12 };
        p.splashTiles = atk.splashTiles;
        break;
      }
      default:
        break;
    }
    if (a.def.catchphrase && this.t >= a.catchphraseUntil && this.rng.chance(a.def.catchphraseChance ?? 0.1)) {
      a.catchphraseUntil = this.t + 7000;
      this.events.push({ type: 'catchphrase', ally: a, key: a.def.catchphrase });
    }
  }

  private spawnProjectile(a: Ally, lane: number, y: number, damage: number): Projectile {
    const p: Projectile = {
      uid: this.uidSeq++,
      fx: a.def.attack.fx ?? 'fx_hit',
      lane,
      x0: laneX(a.lane),
      x: laneX(a.lane),
      y,
      y0: y,
      prevY: y,
      vy: -PROJECTILE_SPEED,
      damage,
      source: a.def.id,
      bornAt: this.t,
      dead: false,
      // Whoever is standing on the shooter's own tile is in front of it too (it is on top of the shooter).
      back: colY(a.col) + TILE - HIT_LINE,
    };
    this.projectiles.push(p);
    this.events.push({ type: 'shoot', ally: a, projectile: p });
    return p;
  }

  // ------------------------------------------------------------ damage

  /** Apply damage to an enemy. `pierce` skips armor (rescue car). Returns damage dealt. */
  /** Hurt an enemy. `pierce` ignores its armour (Rakko's car); `at` is the lane the blow comes from (a giant is hit in
   *  any of its three). */
  damageEnemy(e: Enemy, raw: number, source: string, fx: string, pierce = false, at = e.lane): number {
    if (!this.inPlay(e)) return 0;
    // Some attacks hit fliers harder (モモンガ's acorns).
    let dmg = e.flight ? raw * (UNITS[source]?.attack.vsFlierMultiplier ?? 1) : raw;
    let armored = false;
    if (!pierce) {
      const armor = e.def.abilities.find((x): x is Extract<EnemyAbility, { kind: 'armor' }> => x.kind === 'armor');
      if (armor) {
        dmg = Math.max(1, dmg - armor.flat);
        armored = true;
      }
    }
    // The testing ground can make enemies take nothing: the blow still lands and shows.
    if (!this.dev?.safeEnemies) e.hp -= dmg;
    e.hitFlashUntil = this.t + 110;
    this.events.push({ type: 'hit', enemy: e, damage: dmg, armored, source, fx, lane: at });
    if (e.hp <= 0) this.collapseEnemy(e);
    return dmg;
  }

  /** Push an enemy back (a jab from ハチワレ（パジャマ）): over the next moment it slides `px` back toward where it came
   *  from, whatever it is doing (a swing under way then lands on nobody). Not a boss or a giant (too big to push), nor
   *  one in the air, jumping or lunging (moving on its own). */
  private push(e: Enemy, px: number): void {
    if (!this.inPlay(e) || e.boss || e.def.giant || e.flight || e.state === 'jump' || e.state === 'lunge') return;
    e.pushLeft = Math.max(e.pushLeft, px);
    this.events.push({ type: 'push', enemy: e });
  }

  /** Run over by Rakko's car or オデ: an ordinary enemy is defeated outright, through armour; a boss takes
   *  RESCUE_BOSS_DAMAGE (ちいかぶ in disguise shows its true form first). */
  private runOver(e: Enemy, source: string, lane: number): void {
    if (e.boss) {
      if (e.disguised) this.startTransform(e);
      this.damageEnemy(e, RESCUE_BOSS_DAMAGE, source, 'fx_hit', true, lane);
    } else {
      this.damageEnemy(e, e.hp + 99999, source, 'fx_hit', true, lane);
    }
  }

  private collapseEnemy(e: Enemy): void {
    e.hp = 0;
    e.pendingHitAt = -1;
    this.stats.enemiesDefeated++;
    this.stats.defeated[e.def.id] = (this.stats.defeated[e.def.id] ?? 0) + 1;
    if (this.waves instanceof EndlessWaves) this.waves.noteDefeated(e.waveIndex);
    if (e.flight && e.flight.carry >= 0) this.drop(e);
    if (e.stolen.length) this.dropStolen(e);
    e.state = 'collapse';
    e.anim = 'collapse';
    e.animStart = this.t;
    e.collapseAt = this.t;
    this.events.push({ type: 'enemyCollapse', enemy: e });
  }

  /** Hurt a friend. A partner beside it can soften ordinary hits (BondDef.damageMul; none does at the moment); `crush`
   *  (ゾウ's stomp) is never softened. */
  damageAlly(a: Ally, dmg: number, source: string, crush = false): void {
    if (a.state === 'collapse') return;
    if (this.dev?.safeFriends) {
      // The testing ground: the blow lands and shows, and takes nothing.
      a.hitFlashUntil = this.t + 110;
      this.events.push({ type: 'allyHit', ally: a, damage: 0, source });
      return;
    }
    if (!crush && a.def.bond?.damageMul !== undefined && this.bonded(a)) dmg *= a.def.bond.damageMul;
    a.hp -= dmg;
    a.hitFlashUntil = this.t + 110;
    this.events.push({ type: 'allyHit', ally: a, damage: dmg, source });
    if (a.hp <= 0) this.collapseAlly(a);
  }

  /** A friend is beaten: it leaves its tile and fades away as it was (owner's call, 2026-11-08: friends have no defeat
   *  frames, like PvZ's plants). */
  private collapseAlly(a: Ally): void {
    a.hp = 0;
    this.grid[a.lane][a.col] = null;
    this.releaseClaims(a);
    a.state = 'collapse';
    a.collapseAt = this.t;
    a.pendingRelease = -1;
    this.stats.alliesLost++;
    this.events.push({ type: 'allyCollapse', ally: a });
  }

  // ------------------------------------------------------------ enemies

  /** How fast an enemy walks (px/s): by its speed, and faster now and then (see walkMulOf). */
  private speedOf(e: Enemy): number {
    return SPEED_PX_PER_S[e.def.speed] * this.walkMulOf(e);
  }

  /** How many times its speed an enemy walks or swims now: faster for キメラ with her claws out (moveSpeedMulOf), and
   *  for a mermaid while セイレーン is on the field (rallyMulOf). The renderer quickens their steps with it. */
  walkMulOf(e: Enemy): number {
    return moveSpeedMulOf(e) * this.rallyMulOf(e);
  }

  /** セイレーン's rally (owner's call, 2026-11-07): while she is on the field, every mermaid (人魚 and the two-legged
   *  ones she calls up), wherever it is, moves faster (in the story they stay by her side). 1 for anyone else. */
  rallyMulOf(e: Enemy): number {
    let mul = 1;
    for (const o of this.enemies) {
      if (o === e || !this.inPlay(o) || o.y < FIELD_ENTRY_Y) continue;
      for (const ab of o.def.abilities) if (ab.kind === 'rally' && ab.who.includes(e.def.id)) mul = Math.max(mul, ab.speedMul);
    }
    return mul;
  }

  /** The ally this enemy will run into next: the nearest ally ahead of it in its lane (a giant: in any of its lanes,
   *  whichever it reaches first). */
  private blockerFor(e: Enemy): Ally | null {
    let best: Ally | null = null;
    for (const lane of this.lanesOf(e)) {
      const a = this.aheadIn(e, lane);
      if (a && (!best || a.col > best.col)) best = a;
    }
    return best;
  }

  /** The nearest ally ahead of an enemy in one lane: the next it would run into there. One put down on the tile the
   *  enemy's front is already in counts too: the enemy stops where it is and goes for it (like planting on a zombie).
   *  Friends on tiles it has passed are behind it. */
  private aheadIn(e: Enemy, lane: number): Ally | null {
    const row = this.grid[lane];
    if (!row) return null;
    for (let col = COLS - 1; col >= 0; col--) {
      const a = row[col];
      if (a && colY(col) + TILE > e.y) return a;
    }
    return null;
  }

  /** Whom a giant's swing hits: the friend it is up against, and in each of its other lanes the friend in front of it
   *  if that one is level with it (within half a tile). */
  private swingTargets(e: Enemy, target: Ally): Ally[] {
    const out = [target];
    for (const lane of this.lanesOf(e)) {
      if (lane === target.lane) continue;
      const a = this.aheadIn(e, lane);
      if (a && this.onTile(a) && colY(a.col) + CONTACT - e.y <= TILE * 0.5) out.push(a);
    }
    return out;
  }

  /** Each enemy's step, mode by mode (see FIXED_MODES): a mode with a length runs on to its end; when it is over, or
   *  while the enemy walks or waits, it decides what to do now. */
  private stepEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (e.state === 'collapse' || e.state === 'gone') continue;
      e.prevY = e.y;
      // Pushed back by a jab, it slides back over a moment, whatever it is doing (never back off the field; a jump or a
      // lunge carries it on its own way).
      if (e.pushLeft > 0) {
        if (e.state === 'jump' || e.state === 'lunge') e.pushLeft = 0;
        else {
          const d = Math.min(e.pushLeft, (PUSH_SPEED * dt) / 1000);
          e.pushLeft -= d;
          if (e.y > FIELD_ENTRY_Y) e.y = Math.max(FIELD_ENTRY_Y, e.y - d);
        }
      }
      // The testing ground can hold every enemy on the field still: no walking, biting or abilities (one still on the
      // road walks on until it reaches the field).
      if (this.dev?.freeze && e.y >= 0) continue;
      // Frozen by むちゃうマン: it does nothing, and whatever it was in the middle of waits for it.
      if (e.frozenUntil > this.t) {
        this.waitFrozen(e, dt);
        continue;
      }
      const slowed = e.slowUntil > this.t;
      const rate = slowed ? 0.5 : 1;
      if (e.flight) {
        this.stepFlier(e, dt, rate);
        continue;
      }
      // Its abilities come due while it walks, waits and swings (not while it is using one); one that is due waits for
      // the mode in progress to end.
      if (e.state === 'walk' || e.state === 'engaged' || e.state === 'attack') this.fillAbilities(e, dt);
      if (!FIXED_MODES.has(e.state) || !this.runMode(e, dt, rate)) this.decide(e, dt, rate);
      if (e.y >= BASE_Y) {
        this.reachBase(e);
        if (this.status !== 'playing') return;
      }
    }
  }

  /** Frozen by むちゃうマン: whatever the enemy was in the middle of waits as long as it is frozen (a swing, a song, a
   *  spell, a call, a hover, an ability's cooldown), and its frames stand still. */
  private waitFrozen(e: Enemy, dt: number): void {
    e.animStart += dt;
    e.stateUntil += dt;
    if (e.pendingHitAt >= 0) e.pendingHitAt += dt;
    e.abilityBusyUntil += dt;
    for (const c of e.calls) c.at += dt;
  }

  /** One step of a mode with a length; false once it is over (what comes next is then decided at once). */
  private runMode(e: Enemy, dt: number, rate: number): boolean {
    if (e.state === 'attack') {
      // A swing: its blow lands partway through, on whoever it is up against by then (nobody, if its friend has gone),
      // and its attack cycle runs on.
      e.attackT += dt * rate;
      if (e.pendingHitAt >= 0 && this.t >= e.pendingHitAt) {
        e.pendingHitAt = -1;
        const b = this.blockerFor(e);
        if (b && e.y >= this.stopYFor(e, b) - 0.5) this.landEnemyHit(e, b);
      }
    } else if (e.state === 'aim') {
      // ちゅーしです eyes the friend within its reach, keeping still; then it lunges at whoever is in reach by then (with
      // nobody there any more, it is free again).
      if (this.t >= e.stateUntil) {
        const b = this.blockerFor(e);
        const lunge = this.lungeOf(e);
        if (b && lunge && this.stopYFor(e, b) - e.y <= lunge.tiles * TILE) this.startLunge(e, b, rate);
      }
    } else if (e.state === 'lunge') {
      // ちゅーしです dashes in over the wind-up (never past a friend now in its way, never backward), then its swipe
      // lands, on whoever it is up against by then.
      e.attackT += dt * rate;
      if (e.pendingHitAt >= 0) {
        const b = this.blockerFor(e);
        const stopY = b ? this.stopYFor(e, b) : Infinity;
        const k = Math.min(1, (this.t - e.animStart) / Math.max(1, e.pendingHitAt - e.animStart));
        e.y = Math.max(e.y, Math.min(stopY, e.moveFrom + (e.moveTo - e.moveFrom) * k * (2 - k)));
        if (this.t >= e.pendingHitAt) {
          e.pendingHitAt = -1;
          if (b && e.y >= stopY - 0.5) this.landEnemyHit(e, b, this.lungeOf(e)?.damageMul ?? 1);
        }
      }
    } else if (e.state === 'jump') {
      // 六足の虫 gets ready where it is, springs over the friend in its way and lands just past its tile, steadying
      // itself there (friends can hit it all the while).
      const j = this.jumpOf(e);
      if (j) {
        const at = jumpAt(j, ((this.t - e.animStart) / Math.max(1, e.stateUntil - e.animStart)) * jumpMsOf(j));
        e.y = at.phase === 'ready' ? e.moveFrom : at.phase === 'air' ? e.moveFrom + (e.moveTo - e.moveFrom) * at.k : e.moveTo;
      }
      // It leaves the ground.
      if (e.pendingHitAt >= 0 && this.t >= e.pendingHitAt) {
        e.pendingHitAt = -1;
        this.events.push({ type: 'jump', enemy: e });
      }
    } else if (e.state === 'steal') {
      // A goblin picks up the 草 halfway through, as its hand reaches it, and the 草 is simply gone (if it is still
      // there: the player may have got to it first).
      if (e.pendingHitAt >= 0 && this.t >= e.pendingHitAt) {
        e.pendingHitAt = -1;
        const p = this.pickups.find((q) => q.uid === e.stealTarget);
        if (p && this.stealable(e, p, true)) {
          p.state = 'gone';
          p.stateAt = this.t;
          e.stolen.push(p.value);
          this.events.push({ type: 'steal', enemy: e, pickup: p });
        }
        e.stealTarget = -1;
      }
    } else if (e.state === 'summon') {
      // セイレーン's followers come up one after another through her song.
      while (e.calls.length && e.calls[0].at <= this.t) this.callUp(e, e.calls.shift()!);
    }
    if (this.t < e.stateUntil) return true;
    if (e.state === 'transform') this.events.push({ type: 'transformEnd', enemy: e });
    return false;
  }

  /** What an enemy does now that it is free (walking, waiting, or just out of a mode): an ability that has come due
   *  (キメラ drawing her claws, once she is hurt low enough), else 草 to pick up where it passes (ゴブリン), else ちいかぶ's reveal, else the friend it is up against (六足の虫
   *  jumps over it), else a lunge at one within reach (ちゅーしです, after a pause), else walk on. */
  private decide(e: Enemy, dt: number, rate: number): void {
    if (this.startAbility(e, rate)) return;
    if (this.startSteal(e, rate)) return;
    const blocker = this.blockerFor(e);
    const stopY = blocker ? this.stopYFor(e, blocker) : Infinity;
    // ちいかぶ in disguise shows its true form where it is stopped, or at the last tile.
    if (e.disguised && (blocker ? e.y >= stopY : e.y >= colY(0))) {
      this.startTransform(e);
      return;
    }
    if (blocker && e.y >= stopY) {
      if (this.jumpOf(e)) this.startJump(e, blocker, rate);
      else this.engage(e, blocker, dt, rate);
      return;
    }
    const lunge = this.lungeOf(e);
    if (blocker && lunge && stopY - e.y <= lunge.tiles * TILE) {
      this.startAim(e, blocker, rate);
      return;
    }
    this.walk(e, stopY, dt, rate);
  }

  private lungeOf(e: Enemy) {
    return e.def.abilities.find((a): a is Extract<EnemyAbility, { kind: 'lunge' }> => a.kind === 'lunge');
  }

  private jumpOf(e: Enemy) {
    return e.def.abilities.find((a): a is Extract<EnemyAbility, { kind: 'jump' }> => a.kind === 'jump');
  }

  private stealOf(e: Enemy) {
    return e.def.abilities.find((a): a is Extract<EnemyAbility, { kind: 'steal' }> => a.kind === 'steal');
  }

  /** ちゅーしです has come within reach of a friend: it stops for a moment, eyeing it (the first frame of its swing,
   *  held), before it lunges (owner's call: it lunged too suddenly). */
  private startAim(e: Enemy, target: Ally, rate: number): void {
    e.state = 'aim';
    e.anim = 'aim';
    e.animStart = this.t;
    e.targetUid = target.uid;
    e.pendingHitAt = -1;
    e.stateUntil = this.t + (this.lungeOf(e)?.readyMs ?? 0) / rate;
  }

  /** ちゅーしです lunges at a friend within its reach, after its pause: a swing (its attack frames) whose wind-up is a
   *  dash in, and whose swipe lands harder. It counts as a swing in its attack cycle. */
  private startLunge(e: Enemy, target: Ally, rate: number): void {
    const swing = swingOf(e.def, e.form);
    e.state = 'lunge';
    e.anim = 'attack';
    e.animStart = this.t;
    e.targetUid = target.uid;
    e.attackT = 0;
    e.moveFrom = e.y;
    e.moveTo = this.stopYFor(e, target);
    e.pendingHitAt = this.t + swing.hitMs / rate;
    e.stateUntil = this.t + swing.swingMs / rate;
    this.events.push({ type: 'enemyAttack', enemy: e });
  }

  /** 六足の虫 has met a friend: it gets ready, jumps over it and lands just past its tile (where, if another friend is
   *  waiting, it jumps again). It leaves the ground (the 'jump' event) once it is ready. */
  private startJump(e: Enemy, over: Ally, rate: number): void {
    const j = this.jumpOf(e)!;
    e.state = 'jump';
    e.anim = 'jump';
    e.animStart = this.t;
    e.targetUid = -1;
    e.pendingHitAt = this.t + j.readyMs / rate;
    e.moveFrom = e.y;
    e.moveTo = Math.max(e.y, colY(over.col) + TILE + CONTACT);
    e.stateUntil = this.t + jumpMsOf(j) / rate;
  }

  /** A goblin stops to pick up 草 growing where it passes, if there is any. */
  private startSteal(e: Enemy, rate: number): boolean {
    const ab = this.stealOf(e);
    if (!ab) return false;
    const p = this.pickups.find((q) => this.stealable(e, q, false));
    if (!p) return false;
    const ms = ab.ms * tempoOf(e.def, e.form);
    e.state = 'steal';
    e.anim = 'steal';
    e.animStart = this.t;
    e.targetUid = -1;
    e.stealTarget = p.uid;
    e.pendingHitAt = this.t + ms / 2 / rate;
    e.stateUntil = this.t + ms / rate;
    return true;
  }

  /** Whether a goblin can pick up this 草: a weed growing (not ちいかわ's finds, nor one she is pulling) in its lane,
   *  that has come under its hand (see STEAL_REACH; `taking`: as it picks it up, still there). */
  private stealable(e: Enemy, p: Pickup, taking: boolean): boolean {
    if (p.kind !== 'weed' || (p.state !== 'sprout' && p.state !== 'idle') || p.claimedBy >= 0 || !this.covers(e, p.lane)) return false;
    const d = e.y - p.y;
    return taking ? d >= -TILE * 0.5 : d >= STEAL_REACH && d < STEAL_REACH + STEAL_SPAN;
  }

  /** A goblin defeated: the 草 it carried drop back where it fell, to be picked up again (they sprout up there). */
  private dropStolen(e: Enemy): void {
    const y = Math.max(FIELD_ENTRY_Y, Math.min(LANE_LEN - 1, e.y));
    const n = e.stolen.length;
    const back: Pickup[] = e.stolen.map((value, i) => {
      const at = Math.max(FIELD_ENTRY_Y, Math.min(LANE_LEN - 1, y + (i - (n - 1) / 2) * 28));
      const p: Pickup = {
        uid: this.uidSeq++,
        kind: 'weed',
        lane: e.lane,
        col: colOfY(at),
        x: laneX(e.lane) + (i % 2 ? 12 : -12),
        y: at,
        value,
        bornAt: this.t,
        expiresAt: this.t + WEED_SPROUT_MS + (this.sprout?.lifeMs ?? DROPPED_WEED_MS),
        autoAt: this.autoCollect ? this.t + AUTO_COLLECT_MS : Infinity,
        state: 'sprout',
        stateAt: this.t,
        claimedBy: -1,
      };
      this.pickups.push(p);
      return p;
    });
    e.stolen = [];
    this.events.push({ type: 'stolenBack', enemy: e, pickups: back });
  }

  /** Where an enemy stops for a friend ahead (its front, in travel px): just inside the friend's tile, or as far off as
   *  its reach (フグ spits from further away). But フグ stops only where it can be hit back: on the field, out of any bush
   *  (nothing can aim at it in one), and with no stump between them (a stump stops its spit and the friends' shots
   *  alike). Otherwise a lane could stall, with neither side able to reach the other. */
  private stopYFor(e: Enemy, b: Ally): number {
    const reach = e.def.attack.rangeTiles ?? 1;
    const close = colY(b.col) + CONTACT;
    if (reach <= 1) return close;
    const friend = allyFeetY(b.col) - TILE * 0.45;
    let y = Math.max(close - (reach - 1) * TILE, FIELD_ENTRY_Y);
    if (this.hidden(e)) y = Math.max(y, colY(colOfY(e.y)) + TILE / 2 + BUSH_REACH + 1);
    for (let s = this.stumpCrossed(e.lane, y - HIT_LINE, friend); s !== null; s = this.stumpCrossed(e.lane, y - HIT_LINE, friend)) y = s + HIT_LINE;
    return Math.min(y, close);
  }

  /** Walking on toward whatever is ahead; it gives way at once to anything else there is to do. Everyone walks with
   *  their walk frames (セイレーン too, since 2026-11-07: she no longer sings as she swims). */
  private walk(e: Enemy, stopY: number, dt: number, rate: number): void {
    e.targetUid = -1;
    e.pendingHitAt = -1;
    if (e.state !== 'walk' || e.anim !== 'walk') {
      e.state = 'walk';
      e.anim = 'walk';
      e.animStart = this.t;
      e.stateUntil = Infinity;
    }
    if (e.y < stopY) e.y = Math.min(stopY, e.y + (this.speedOf(e) * rate * dt) / 1000);
  }

  /** でかい鳥: flies over walls, terrain and other enemies to the friend nearest the base in its lane (whoever that is
   *  now), hovers over it, grabs it and flies back out with it. With nobody in the lane it turns at the last tile and
   *  leaves. It never bites and never reaches the base. */
  private stepFlier(e: Enemy, dt: number, rate: number): void {
    const f = e.flight!;
    if (e.state === 'attack') {
      // The grab is a mode: its talons close partway through (on the friend, if it is still there), and only once it
      // is over does it fly off with the friend (or, its talons empty, look again).
      if (e.pendingHitAt >= 0 && this.t >= e.pendingHitAt) {
        e.pendingHitAt = -1;
        const held = this.allyByUid(f.target);
        if (held && this.allyAt(held.lane, held.col) === held) this.grab(e, held);
      }
      if (this.t < e.stateUntil) return;
      e.state = 'walk';
      e.anim = 'float';
      e.animStart = this.t;
      e.stateUntil = Infinity;
      if (f.carry >= 0) f.out = true;
    }
    const step = (this.speedOf(e) * rate * dt) / 1000;
    if (f.out) {
      e.y -= step;
      if (e.y < SPAWN_Y - TILE * 1.5) this.flyOff(e);
      return;
    }
    if (e.state === 'hover') {
      const held = this.allyByUid(f.target);
      if (held && this.allyAt(held.lane, held.col) === held) {
        if (this.t >= e.stateUntil) this.startGrab(e, rate);
        return;
      }
      // The friend it was after is gone: it looks again (hovering gives way at once).
      e.state = 'walk';
      e.stateUntil = Infinity;
    }
    const target = this.backmostAlly(e.lane);
    f.target = target ? target.uid : -1;
    const goal = allyFeetY(target ? target.col : 0);
    const d = goal - e.y;
    e.y += Math.sign(d) * Math.min(Math.abs(d), step);
    if (Math.abs(goal - e.y) > 0.5) return;
    if (!target) {
      // Nobody to take: it turns at the last tile and leaves.
      f.out = true;
      return;
    }
    const ab = e.def.abilities.find((x): x is Extract<EnemyAbility, { kind: 'flier' }> => x.kind === 'flier');
    e.state = 'hover';
    e.stateUntil = this.t + (ab?.hoverMs ?? 2500);
    this.events.push({ type: 'hover', enemy: e, ally: target });
  }

  /** The friend nearest the base in a lane (でかい鳥's pick). */
  private backmostAlly(lane: number): Ally | null {
    for (let col = 0; col < COLS; col++) {
      const a = this.grid[lane][col];
      if (a) return a;
    }
    return null;
  }

  /** でかい鳥's grab begins (a mode: see stepFlier). */
  private startGrab(e: Enemy, rate: number): void {
    const swing = swingOf(e.def);
    e.state = 'attack';
    e.anim = 'attack';
    e.animStart = this.t;
    e.pendingHitAt = this.t + swing.hitMs / rate;
    e.stateUntil = this.t + swing.swingMs / rate;
  }

  /** でかい鳥's talons close on the friend: it is lifted off its tile (being carried off ends whatever it was doing). */
  private grab(e: Enemy, a: Ally): void {
    this.grid[a.lane][a.col] = null;
    this.releaseClaims(a);
    a.state = 'carried';
    a.carriedBy = e.uid;
    a.pendingRelease = -1;
    a.anim = 'idle';
    a.animStart = this.t;
    e.flight!.carry = a.uid;
    this.events.push({ type: 'grab', enemy: e, ally: a });
  }

  /** でかい鳥 is off the field: the friend it carries is gone for good (no refund). It was not beaten. */
  private flyOff(e: Enemy): void {
    const f = e.flight!;
    const a = f.carry >= 0 ? this.allyByUid(f.carry) : undefined;
    f.carry = -1;
    if (a && a.state === 'carried') {
      this.loseCarried(a);
      this.events.push({ type: 'carriedOff', enemy: e, ally: a });
    }
    e.state = 'gone';
    if (this.waves instanceof EndlessWaves) this.waves.noteDefeated(e.waveIndex);
  }

  /** でかい鳥 fell while carrying: the friend lands back on its own tile, else the nearest free tile in the lane, else
   *  it is lost. */
  private drop(e: Enemy): void {
    const a = this.allyByUid(e.flight!.carry);
    e.flight!.carry = -1;
    if (!a || a.state !== 'carried') return;
    a.carriedBy = -1;
    let col = -1;
    for (let d = 0; d < COLS && col < 0; d++) {
      for (const c of d ? [a.col - d, a.col + d] : [a.col]) {
        if (c >= 0 && c < COLS && !this.grid[a.lane][c] && !this.terrain[a.lane][c]) {
          col = c;
          break;
        }
      }
    }
    if (col < 0) {
      this.loseCarried(a);
      return;
    }
    a.col = col;
    a.state = 'idle';
    a.anim = a.def.support?.kind === 'aura_attackspeed' ? 'song' : 'idle';
    a.animStart = this.t;
    this.grid[a.lane][col] = a;
    this.events.push({ type: 'drop', enemy: e, ally: a });
  }

  /** A carried friend is gone: off the field with the bird, or with nowhere to land. Not drawn falling. */
  private loseCarried(a: Ally): void {
    a.carriedBy = -1;
    a.state = 'collapse';
    a.anim = 'idle';
    a.collapseAt = this.t - COLLAPSE_MS - FADE_MS - 1;
    this.stats.alliesLost++;
  }

  /** Up against a friend: it waits for its next swing, then swings. A swing is a mode (see runMode); waiting gives way
   *  at once (its friend gone, an ability due). Swings come the interval plus 220 ms apart, however long each one is
   *  (キメラ's is shorter once her claws are out). */
  private engage(e: Enemy, target: Ally, dt: number, rate: number): void {
    const atk = e.def.attack;
    const interval = attackIntervalOf(e);
    const cycle = interval + ATTACK_RELEASE_MS;
    // Just out of a swing, its attack cycle runs on (this step is counted already); fresh from walking or an ability,
    // it swings soon.
    const fromSwing = e.state === 'attack' || e.state === 'lunge';
    if (e.state !== 'engaged') {
      if (!fromSwing) e.attackT = Math.max(e.attackT, cycle - FIRST_SWING_MS);
      e.state = 'engaged';
      e.anim = 'idle';
      e.animStart = this.t;
      e.stateUntil = Infinity;
      e.pendingHitAt = -1;
    }
    e.targetUid = target.uid;
    if (atk.kind === 'none') return;
    if (!fromSwing) e.attackT += dt * rate;
    if (e.attackT < cycle) return;
    const swing = swingOf(e.def, e.form, interval);
    e.attackT = 0;
    e.state = 'attack';
    e.anim = 'attack';
    e.animStart = this.t;
    e.pendingHitAt = this.t + swing.hitMs / rate;
    e.stateUntil = this.t + swing.swingMs / rate;
    this.events.push({ type: 'enemyAttack', enemy: e });
  }

  /** An enemy's blow lands on the friend it is up against (`mul`: harder, as ちゅーしです's lunge). */
  private landEnemyHit(e: Enemy, target: Ally, mul = 1): void {
    if (target.state === 'collapse') return;
    const atk = e.def.attack;
    if (atk.kind === 'melee') {
      // A giant's swing (でかつよ, あのこ) sweeps across its three lanes.
      for (const a of e.half ? this.swingTargets(e, target) : [target]) this.damageAlly(a, (atk.damage ?? 0) * mul * this.relaxedMul(e, a), e.def.id);
    }
    else if (atk.kind === 'stomp') {
      this.events.push({ type: 'stomp', enemy: e, ally: target });
      this.damageAlly(target, target.hp, e.def.id, true);
    } else if (atk.kind === 'ranged') {
      const p: Projectile = {
        uid: this.uidSeq++,
        fx: atk.fx ?? 'fx_spit',
        lane: e.lane,
        x0: e.x,
        x: e.x,
        y: e.y - HIT_LINE,
        y0: e.y - HIT_LINE,
        prevY: e.y - HIT_LINE,
        vy: SPIT_SPEED,
        damage: atk.damage ?? 0,
        source: e.def.id,
        hostileTarget: target.uid,
        bornAt: this.t,
        dead: false,
      };
      this.projectiles.push(p);
      this.events.push({ type: 'spit', enemy: e, projectile: p });
    }
  }

  /** How much harder 擬態型's blow lands on a friend its song has caught (1 for anyone else). */
  private relaxedMul(e: Enemy, a: Ally): number {
    if (a.swayUntil <= this.t) return 1;
    const song = e.def.abilities.find((x): x is Extract<EnemyAbility, { kind: 'song' }> => x.kind === 'song');
    return song?.relaxedDamageMul ?? 1;
  }

  private startTransform(e: Enemy): void {
    const ab = e.def.abilities.find((x): x is Extract<EnemyAbility, { kind: 'disguise' }> => x.kind === 'disguise');
    e.disguised = false;
    e.form = 'true';
    e.state = 'transform';
    e.anim = 'transform';
    e.animStart = this.t;
    e.stateUntil = this.t + (ab?.transformMs ?? 1500);
    e.pendingHitAt = -1;
    e.targetUid = -1;
    this.events.push({ type: 'transformStart', enemy: e });
  }

  /** An ability that has come due, begun now (as a mode of its own); false if none did (or one that does not stop it). */
  private startAbility(e: Enemy, rate: number): boolean {
    for (const ab of e.def.abilities) {
      if (ab.kind === 'claws' && this.startClaws(e, ab, rate)) return true;
      if (ab.kind === 'heal_aura' && this.startHeal(e, ab)) return true;
      // 擬態型 sings as it goes: its song does not stop it.
      if (ab.kind === 'song') this.lureSong(e, ab);
      if (ab.kind === 'spell' && this.startSpell(e, ab)) return true;
      if (ab.kind === 'summon' && this.startSummon(e, ab)) return true;
    }
    return false;
  }

  /** キメラ starts with her claws hidden. Down to `atHp` of her HP for the first time, she stops and draws them out (a
   *  mode: a swing in progress ends first). From its start she is in her clawed form (form 'claws': her clawed
   *  frames, whose ability is the drawing), and once it is over she walks and swings faster, to the end, however much she is
   *  healed (owner's call, 2026-11-07). A blow from above that straight to 0 fells her with them still hidden. */
  private startClaws(e: Enemy, ab: Extract<EnemyAbility, { kind: 'claws' }>, rate: number): boolean {
    if (e.form === 'claws' || e.hp > e.maxHp * ab.atHp) return false;
    e.form = 'claws';
    e.state = 'claws';
    e.anim = 'claws';
    e.animStart = this.t;
    e.targetUid = -1;
    e.pendingHitAt = -1;
    e.stateUntil = this.t + ab.ms / rate;
    this.events.push({ type: 'claws', enemy: e });
    return true;
  }

  /** Ability timers fill while an enemy walks, waits and swings, once the ability it used last is over (owner's call,
   *  2026-11-07: a cooldown starts when its ability ends, not when it starts): an ability comes due then, and starts
   *  once it is free. */
  private fillAbilities(e: Enemy, dt: number): void {
    // Only the part of this step after its last ability ended counts.
    const free = Math.min(dt, this.t - e.abilityBusyUntil);
    if (free <= 0) return;
    for (const ab of e.def.abilities) {
      if (ab.kind === 'heal_aura') e.abilityT += free;
      else if ((ab.kind === 'song' || ab.kind === 'spell' || ab.kind === 'summon') && e.y >= FIELD_ENTRY_Y && !e.disguised) e.abilityT = Math.min(ab.cooldownMs, e.abilityT + free);
    }
  }

  /** 黒い星 heals the enemies round it, stopping to do it (a mode: it moves on once its pulse is over): those within
   *  `radiusTiles` lanes and tiles of it, the 3×3 tiles round it with it in the middle (owner's call, 2026-11-07; it
   *  used to reach a tile each way). It heals again a cooldown after the stop is over. */
  private startHeal(e: Enemy, ab: Extract<EnemyAbility, { kind: 'heal_aura' }>): boolean {
    if (e.abilityT < ab.cooldownMs) return false;
    const pause = abilityBusyMs(ab);
    e.abilityT = 0;
    e.abilityBusyUntil = this.t + pause;
    const healed: Enemy[] = [];
    for (const o of this.enemies) {
      if (o === e || !this.inPlay(o)) continue;
      if (this.laneGap(o, e.lane) > ab.radiusTiles || Math.abs(o.y - e.y) > (ab.radiusTiles + 0.5) * TILE) continue;
      if (o.hp >= o.maxHp) continue;
      o.hp = Math.min(o.maxHp, o.hp + ab.amount);
      healed.push(o);
    }
    this.events.push({ type: 'heal', enemy: e, healed });
    if (pause <= 0) return false;
    e.state = 'heal';
    e.anim = 'heal';
    e.animStart = this.t;
    e.stateUntil = this.t + pause;
    e.pendingHitAt = -1;
    return true;
  }

  /** 擬態型's lure song (owner's call, 2026-11-07): a few seconds after it comes onto the field, and again a cooldown
   *  after each song is over, it sings as it goes (it does not stop: it walks and fights on), and up to `targets`
   *  friends in its lane, however far, picked at random (it used to reach them all), are caught by it: no attacks, no
   *  草, no support while it lasts. Its blows land harder on a caught friend (relaxedMul; in the story it draws
   *  Chiikawa-folk in with a song and strikes once they relax). It sings only when a friend is in its lane. */
  private lureSong(e: Enemy, ab: Extract<EnemyAbility, { kind: 'song' }>): void {
    if (e.y < FIELD_ENTRY_Y || e.abilityT < ab.cooldownMs) return;
    const inLane = this.allies.filter((a) => this.onTile(a) && a.lane === e.lane);
    if (!inLane.length) return;
    const hit = this.rng.sample(inLane, ab.targets);
    const until = this.t + ab.durationMs;
    e.abilityT = 0;
    e.abilityBusyUntil = this.t + abilityBusyMs(ab);
    for (const a of hit) {
      a.songUntil = Math.max(a.songUntil, until);
      a.swayUntil = Math.max(a.swayUntil, until);
    }
    this.events.push({ type: 'song', enemy: e, allies: hit });
  }

  /** 山姥's spell (owner's call, 2026-11-07): a few seconds after she comes onto the field, and again a cooldown after
   *  each hold wears off, she stops to chant at up to `targets` key friends (keyFriend) anywhere on the field, picked
   *  at random, any not held yet before any that are (owner's call, 2026-11-07; she used to take the nearest few
   *  within 4 tiles, in her lane and the lanes beside it). Each is held: no attacks, no 草, no support. She chants
   *  only when there is one. */
  private startSpell(e: Enemy, ab: Extract<EnemyAbility, { kind: 'spell' }>): boolean {
    if (e.y < FIELD_ENTRY_Y || e.disguised || e.abilityT < ab.cooldownMs) return false;
    const key = this.allies.filter((a) => this.onTile(a) && !a.wishUntil && this.keyFriend(a));
    if (!key.length) return false;
    // Friends not held yet first (another 山姥 may hold some), then held ones if there are too few.
    const held = this.rng.sample(
      key.filter((a) => a.spellUntil <= this.t),
      ab.targets,
    );
    if (held.length < ab.targets) held.push(...this.rng.sample(key.filter((a) => a.spellUntil > this.t), ab.targets - held.length));
    e.abilityT = 0;
    e.abilityBusyUntil = this.t + abilityBusyMs(ab);
    e.state = 'spell';
    e.anim = 'idle';
    e.animStart = this.t;
    e.stateUntil = this.t + ab.castMs;
    e.pendingHitAt = -1;
    const until = this.t + ab.freezeMs;
    for (const a of held) {
      a.songUntil = Math.max(a.songUntil, until);
      a.spellUntil = Math.max(a.spellUntil, until);
    }
    this.events.push({ type: 'spell', enemy: e, allies: held });
    return true;
  }

  /** セイレーン's call, the game's summoner boss (owner's calls, 2026-11-07): a few seconds after she comes onto the
   *  field, and again a cooldown after each call is over, she stops to sing, and `min`–`max` small mobs come up round
   *  the column she is in (not down the road), one after another through her song (each in its own share of it), in
   *  lanes dealt out at random, each open lane once before any has a second: 人魚 on a water lane, the two-legged
   *  mermaid on land (see callUp). Who comes where and when is settled as she starts. */
  private startSummon(e: Enemy, ab: Extract<EnemyAbility, { kind: 'summon' }>): boolean {
    if (e.y < FIELD_ENTRY_Y || e.disguised || e.abilityT < ab.cooldownMs) return false;
    const n = this.rng.int(ab.min, ab.max);
    const lanes: number[] = [];
    while (lanes.length < n) lanes.push(...this.rng.shuffle(this.activeLanes).slice(0, n - lanes.length));
    const share = ab.castMs / n;
    e.calls = lanes.map((lane, i) => ({ at: this.t + (i + this.rng.range(0.1, 0.9)) * share, lane, id: this.water[lane] ? ab.water : ab.land }));
    e.abilityT = 0;
    e.abilityBusyUntil = this.t + abilityBusyMs(ab);
    e.state = 'summon';
    e.anim = 'song';
    e.animStart = this.t;
    e.targetUid = -1;
    e.pendingHitAt = -1;
    e.stateUntil = this.t + ab.castMs;
    this.events.push({ type: 'summon', enemy: e });
    return true;
  }

  /** One of セイレーン's followers comes up (the 'spawn' mode) just ahead of her front, so it is not hidden behind her,
   *  before it walks on; never past a friend level with her or ahead of her in its lane (it comes up in front of that
   *  one instead). */
  private callUp(e: Enemy, call: { lane: number; id: string }): void {
    const def = ENEMIES[call.id];
    if (!def) return;
    const m = this.spawnEnemy(def, call.lane, Math.min(BASE_Y - TILE, e.y + this.rng.range(0, 0.6) * TILE), { waveIndex: e.waveIndex });
    const friend = this.aheadIn(e, call.lane);
    if (friend && m.y > this.stopYFor(m, friend)) m.y = m.prevY = m.moveFrom = m.moveTo = this.stopYFor(m, friend);
    m.state = 'spawn';
    m.anim = 'spawn';
    m.animStart = this.t;
    m.stateUntil = this.t + spawnMsOf(def);
    this.events.push({ type: 'callUp', enemy: e, mob: m });
  }

  /** A friend whose hold matters to 山姥: one that attacks, makes 草 or supports. Never a wall. */
  private keyFriend(a: Ally): boolean {
    return !a.def.wall && (a.def.attack.kind !== 'none' || !!a.def.produce || !!a.def.support);
  }

  private reachBase(e: Enemy): void {
    // A giant reaches the base in all its lanes at once: every car there that is still parked comes for it.
    let saved = false;
    for (const lane of this.lanesOf(e)) {
      const r = this.rescueOf(lane);
      if (this.rescuesEnabled && r && r.state === 'parked') {
        r.state = 'driving';
        r.startedAt = this.t;
        r.y = BASE_Y + 40;
        r.prevY = r.y;
        this.stats.rescuesUsed++;
        this.events.push({ type: 'rescue', lane });
        saved = true;
      } else if (r && r.state === 'driving' && !r.hit.has(e.uid) && r.y > e.y - TILE) saved = true; // a car is about to hit it
    }
    if (saved) return;
    if (this.dev) {
      // The testing ground is never lost: whoever gets through just leaves the field.
      e.state = 'gone';
      return;
    }
    this.status = 'lost';
    this.lostLane = e.lane;
    this.events.push({ type: 'lost', lane: e.lane, enemy: e });
  }

  // ------------------------------------------------------------ projectiles

  private stepProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.prevY = p.y;
      if (p.drop) {
        this.stepDrop(p);
        continue;
      }
      if (p.lob) {
        this.stepLob(p);
        continue;
      }
      if (p.hostileTarget !== undefined) {
        const a = this.allyByUid(p.hostileTarget);
        p.y += (p.vy * dt) / 1000;
        // フグ's spit stops at a stump too.
        const wall = this.stumpCrossed(p.lane, p.prevY, p.y);
        if (wall !== null && (!a || wall < allyFeetY(a.col) - TILE * 0.45)) {
          this.blockShot(p, wall);
          continue;
        }
        if (!a || !this.onTile(a)) {
          if (p.y > colY(0) + TILE) p.dead = true;
          if (!a) p.dead = true;
          continue;
        }
        if (p.y >= allyFeetY(a.col) - TILE * 0.45) {
          p.dead = true;
          this.events.push({ type: 'spitHit', ally: a, projectile: p });
          this.damageAlly(a, p.damage, p.source);
        }
        continue;
      }
      p.y += (p.vy * dt) / 1000;
      const travelled = p.y0 - p.y;
      const laneT = Math.min(1, travelled / 120);
      p.x = p.x0 + (laneX(p.lane) - p.x0) * (1 - (1 - laneT) * (1 - laneT));
      // A stump in the way stops the shot (a lob flies over it): only what is before the stump can be hit.
      const wall = this.stumpCrossed(p.lane, p.prevY, p.y);
      const before = (e: Enemy) => wall === null || e.y - HIT_LINE >= wall;
      const back = p.back;
      p.back = undefined;
      if (p.passed) {
        // Through everyone (フタバ's shells): each enemy it crosses is hit once, and it flies on off the field.
        for (const e of this.crossedEnemies(p.lane, p.y, p.prevY, back)) {
          if (p.passed.has(e.uid) || !before(e)) continue;
          p.passed.add(e.uid);
          this.projectileHit(p, e);
        }
        if (wall !== null) this.blockShot(p, wall);
        else if (p.y < SPAWN_Y - 200) p.dead = true;
        continue;
      }
      const e = this.crossedEnemy(p.lane, p.y, p.prevY, back);
      if (e && before(e)) {
        p.dead = true;
        this.projectileHit(p, e);
      } else if (wall !== null) this.blockShot(p, wall);
      else if (p.y < SPAWN_Y - 200) p.dead = true;
    }
  }

  private crossedEnemy(lane: number, yNew: number, yOld: number, back?: number): Enemy | null {
    let best: Enemy | null = null;
    let bestLine = -Infinity;
    for (const e of this.crossedEnemies(lane, yNew, yOld, back)) {
      const line = e.y - HIT_LINE;
      if (line > bestLine) {
        best = e;
        bestLine = line;
      }
    }
    return best;
  }

  /** Every enemy a shot flying up the lane from yOld to yNew passes this step. */
  /** The enemies a shot passed this step: their hit lines between where it was (and a little behind, or `back` on a
   *  shot's first step) and where it is now. */
  private crossedEnemies(lane: number, yNew: number, yOld: number, back?: number): Enemy[] {
    const out: Enemy[] = [];
    const behind = Math.max(yOld + 40, back ?? -Infinity);
    for (const e of this.enemies) {
      if (!this.covers(e, lane) || !this.inPlay(e) || e.disguised || e.y < SPAWN_Y + 30 || this.hidden(e)) continue;
      const line = e.y - HIT_LINE;
      if (line >= yNew - 2 && line <= behind) out.push(e);
    }
    return out;
  }

  private projectileHit(p: Projectile, e: Enemy): void {
    this.damageEnemy(e, p.damage, p.source, p.fx, false, p.lane);
    if (p.slowMs) e.slowUntil = Math.max(e.slowUntil, this.t + p.slowMs);
    if (p.splashBehind) {
      for (const o of this.enemies) {
        if (o === e || !this.covers(o, p.lane) || !this.inPlay(o) || o.disguised) continue;
        // "Behind" = further up the lane; enemies piled at the same spot count too.
        const d = e.y - o.y;
        if (d >= -12 && d <= TILE * 1.15) this.damageEnemy(o, p.splashBehind, p.source, 'fx_splash', false, p.lane);
      }
    }
  }

  private stepLob(p: Projectile): void {
    const lob = p.lob!;
    const target = this.enemyByUid(lob.targetUid);
    if (target && this.inPlay(target)) lob.yT = target.y - HIT_LINE;
    const k = Math.min(1, (this.t - lob.t0) / lob.dur);
    p.y = p.y0 + (lob.yT - p.y0) * k;
    p.x = p.x0;
    if (k < 1) return;
    p.dead = true;
    // 栗まんじゅう's can splashes where it lands, over everyone round the spot (its target among them, if still there).
    if (p.splashTiles) {
      this.splash(p, lob.yT, p.splashTiles, target);
      return;
    }
    if (target && this.inPlay(target) && !this.hidden(target)) {
      this.projectileHit(p, target);
      return;
    }
    let best: Enemy | null = null;
    for (const e of this.enemies) {
      if (!this.covers(e, p.lane) || !this.inPlay(e) || e.disguised || this.hidden(e)) continue;
      if (Math.abs(e.y - HIT_LINE - lob.yT) < TILE * 0.6 && (!best || e.y > best.y)) best = e;
    }
    if (best) this.projectileHit(p, best);
  }

  /** A can splashing where it lands (栗まんじゅう, owner's call 2026-11-07: PvZ's melon-pult): every enemy within
   *  `tiles` lanes of its lane and `tiles` and a half tiles of the spot along the lane (1: the 3×3 tiles round it)
   *  takes the blow, each once. Not one hidden in a bush, nor ちいかぶ in disguise: no shot reaches those. The can
   *  lands on its target; every other enemy is hit by the splash, `fx_can_splash` (owner's call: each one shows the
   *  splash too). */
  private splash(p: Projectile, yT: number, tiles: number, target: Enemy | undefined): void {
    for (const e of this.enemies) {
      if (!this.inPlay(e) || e.disguised || this.hidden(e)) continue;
      if (this.laneGap(e, p.lane) > tiles || Math.abs(e.y - HIT_LINE - yT) > (tiles + 0.5) * TILE) continue;
      this.damageEnemy(e, p.damage, p.source, e === target ? p.fx : 'fx_can_splash', false, p.lane);
    }
    this.events.push({ type: 'splash', lane: p.lane, y: yT, tiles });
  }

  /** A missile from the sky (うさぎ（クール）) lands where it was sent and blows up: every enemy on the ground in its
   *  lane within its reach either side takes the blow, each once. Not one hidden in a bush, nor ちいかぶ in disguise. */
  private stepDrop(p: Projectile): void {
    const d = p.drop!;
    if (this.t < d.t0 + d.dur) return;
    p.dead = true;
    for (const e of this.enemies) {
      if (!this.onGround(e) || !this.covers(e, p.lane) || e.disguised || this.hidden(e)) continue;
      if (Math.abs(e.y - HIT_LINE - d.yT) > d.tiles * TILE) continue;
      this.damageEnemy(e, p.damage, p.source, p.fx, false, p.lane);
    }
    this.events.push({ type: 'blast', lane: p.lane, y: d.yT, source: p.source });
  }

  // ------------------------------------------------------------ one-use cards

  /** オデ's charge: he sprints the length of his lane from the base end, and every enemy he runs into is run over, each
   *  once, as by Rakko's car (see runOver). Fliers are overhead: he runs under them. */
  private stepSweeps(dt: number): void {
    for (const s of this.sweeps) {
      if (s.dead) continue;
      s.prevY = s.y;
      s.y += (s.vy * dt) / 1000;
      for (const e of this.enemies) {
        if (!this.covers(e, s.lane) || !this.inPlay(e) || e.flight || s.hit.has(e.uid)) continue;
        if (e.y >= s.y - TILE * 0.5 && e.y <= s.prevY + TILE * 0.7) {
          s.hit.add(e.uid);
          this.runOver(e, s.source, s.lane);
        }
      }
      if (s.y < SPAWN_Y - TILE * 2) s.dead = true;
    }
  }

  /** むちゃうマン strikes his pose; as it is struck every enemy in play freezes for `freezeMs` (one frozen already stays
   *  frozen for whichever lasts longer), and a moment later he is gone. */
  private stepCameos(): void {
    for (const c of this.cameos) {
      if (c.fired || this.t < c.firesAt) continue;
      c.fired = true;
      const u = c.def.oneUse;
      if (u?.kind !== 'freeze') continue;
      const frozen = this.enemies.filter((e) => this.inPlay(e));
      for (const e of frozen) e.frozenUntil = Math.max(e.frozenUntil, this.t + u.freezeMs);
      this.events.push({ type: 'freeze', lane: c.lane, col: c.col, enemies: frozen });
    }
  }

  // ------------------------------------------------------------ rescues

  private stepRescues(dt: number): void {
    for (const r of this.rescues) {
      if (r.state !== 'driving') continue;
      r.prevY = r.y;
      r.y -= (RESCUE_SPEED * dt) / 1000;
      for (const e of this.enemies) {
        // Fliers are overhead: the car passes under them.
        if (!this.covers(e, r.lane) || !this.inPlay(e) || e.flight || r.hit.has(e.uid)) continue;
        if (e.y >= r.y - TILE * 0.5 && e.y <= r.prevY + TILE * 0.7) {
          r.hit.add(e.uid);
          this.runOver(e, 'rakko_car', r.lane);
        }
      }
      if (r.y < SPAWN_Y - 260) r.state = 'used';
    }
  }

  // ------------------------------------------------------------ cleanup

  private cleanup(): void {
    const gone = COLLAPSE_MS + FADE_MS;
    if (this.allies.some((a) => a.state === 'collapse' && this.t - a.collapseAt > gone)) {
      this.allies = this.allies.filter((a) => !(a.state === 'collapse' && this.t - a.collapseAt > gone));
    }
    const over = (e: Enemy) => e.state === 'gone' || (e.state === 'collapse' && this.t - e.collapseAt > fallMsOf(e.def, e.form, e.boss));
    if (this.enemies.some(over)) this.enemies = this.enemies.filter((e) => !over(e));
    if (this.projectiles.some((p) => p.dead)) this.projectiles = this.projectiles.filter((p) => !p.dead);
    if (this.sweeps.some((s) => s.dead)) this.sweeps = this.sweeps.filter((s) => !s.dead);
    // むちゃうマン fades as he goes.
    if (this.cameos.some((c) => this.t > c.leavesAt + FADE_MS)) this.cameos = this.cameos.filter((c) => this.t <= c.leavesAt + FADE_MS);
    if (this.pickups.some((p) => p.state === 'gone')) this.pickups = this.pickups.filter((p) => p.state !== 'gone');
  }

  /** Remove consumed events (call once per rendered frame). */
  drainEvents(): SimEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}

export { ENEMIES, UNITS };
