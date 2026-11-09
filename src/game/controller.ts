// Glue between the simulation, the renderer, input, audio and the DOM HUD.

import { batch, signal } from '@preact/signals';
import { spriteIdFor, STAR_SPRITE } from '../art/spec';
import { art } from '../art/store';
import { audio } from '../audio/audio';
import { nameOf, t } from '../i18n/i18n';
import { allyFeetY, colOfY, laneX, STEP_MS } from './sim/constants';
import { fallMsOf } from './sim/tempo';
import { ENEMIES, summonsOf, UNITS, waterOf, WORLDS } from './sim/defs';
import { EndlessWaves } from './sim/endless';
import { arrivalMs } from './render/arrival';
import { battleArtKeys, BattleRenderer, type RenderUi, type Waiting } from './render/renderer';
import { easeInOut } from './render/view';
import { WEED_TUG_MS, WeedFlights } from './render/weedFlight';
import { type SandboxSetup, SandboxWaves, sandboxEnemies, simForSandbox } from './sim/sandbox';
import { type PlaceCheck, Sim, simForEndless, simForLevel } from './sim/sim';
import type { Ally, DevRules, Enemy, LevelDef, Pickup, SimEvent, SimStats, SpawnDef } from './sim/types';

export interface CardView {
  /** The friend the card places, whose picture and words it shows (for 星's card, the friend wished for). */
  id: string;
  /** The card's id in the team (星's is its own). */
  deckId: string;
  /** 星's card, granting a wish: marked with a star. */
  star: boolean;
  /** The standing picture on the card: the friend it places next (for a team, the member who comes). */
  sprite: string;
  cost: number;
  /** 0 = just used, 1 = ready. */
  ready: number;
  affordable: boolean;
}

export interface BattleEnd {
  won: boolean;
  mode: BattleConfig['mode'];
  levelId?: string;
  stats: SimStats;
  rescuesLeft: number;
  wavesCleared: number;
  timeMs: number;
}

export interface BattleConfig {
  /** `sandbox`: dev mode's testing ground (see sim/sandbox.ts), set by `sandbox` with `devRules`. */
  mode: 'level' | 'endless' | 'sandbox';
  level?: LevelDef;
  sandbox?: SandboxSetup;
  devRules?: DevRules;
  deck: string[];
  bonusWeeds: number;
  /** Every card ready from the start (a ぶた入りラーメン券 used). */
  ready?: boolean;
  /** The friend 星 turns into, when it is on the team. */
  wish?: string;
  autoCollect: boolean;
  attempt: number;
  endlessPool?: string[];
  settings: () => { guides: boolean; reducedMotion: boolean };
  onSeen: (enemyId: string) => void;
  onDefeated: (enemyId: string) => void;
  onMet: (id: string) => void;
  onEnd: (end: BattleEnd) => void;
  /** Cards the player may still pick before the battle (their art loads with it). */
  pool?: string[];
  /** The enemies waiting on the road before the battle, one of each kind. */
  lineup: Waiting[];
  /** Stop on the road view for the team tray (cards to choose, or a ramen ticket to use). */
  picking: boolean;
  /** The team was picked on the job notice: only a quick glance at the enemies before the start. */
  quick?: boolean;
}

/** Getting ready, then the battle: `look` rests on the field and glides over to the waiting enemies, `pick` waits on the
 *  team tray, `go` glides back to the field, brings Rakko's cars and counts down, `battle` runs the sim. */
export type BattlePhase = 'look' | 'pick' | 'go' | 'battle';

export interface Banner {
  key: number;
  text: string;
  kind: 'ready' | 'start' | 'big' | 'final' | 'boss' | 'win' | 'lose' | 'info';
}

const BANNER_MS = 2200;
/** Getting ready (ms): a moment on the field, the glide to the road, a look at the enemies when there is nothing to
 *  pick, and the glide back. */
const PREP = { wait: 600, out: 1100, hold: 1500, back: 850 };
/** The same, quicker, when the team was already picked on the job notice: a glance at who is coming, then go. */
const PREP_QUICK = { wait: 500, out: 850, hold: 600, back: 700 };
/** The glide back after a tap on the road, as a share of the usual one. */
const SKIP_BACK = 0.5;
/** How long 「よーい…」 shows before the battle starts (ms). The banner's animation in global.css lasts as long. */
const READY_MS = 850;

/** The characters a battle draws: Rakko's car (and his boat, with water about), the allies and the enemies (and
 *  ちいかぶ's true form, キメラ with her claws out). */
function characterIdsFor(allies: Iterable<string>, enemies: Iterable<string>, water = false): string[] {
  const ids = new Set<string>(['rescue_rakko_car']);
  if (water) ids.add('rescue_rakko_boat');
  for (const id of allies) {
    // A team's card can bring any of its members.
    const members = UNITS[id]?.members;
    if (members) for (const m of members) ids.add(spriteIdFor('ally', id, m));
    else ids.add(spriteIdFor('ally', id));
  }
  for (const e of enemies) {
    ids.add(spriteIdFor('enemy', e));
    if (e === 'chiikabu') ids.add('enemy_chiikabu_true');
    if (e === 'kimera') ids.add('enemy_kimera_claws');
    for (const s of summonsOf(e)) ids.add(spriteIdFor('enemy', s));
  }
  return [...ids];
}

/** Every picture a level's battle draws with this team (星 drawn as the friend it turns into), so the job notice can
 *  start loading them while its 「受注」 stamp is pressed. */
export function levelArtKeys(level: LevelDef, team: string[], wish?: string): string[] {
  const allies = team.map((id) => (UNITS[id]?.wish ? wish ?? '' : id)).filter(Boolean);
  return battleArtKeys(level.world, characterIdsFor(allies, level.waves.flatMap((w) => w.spawns.map((s) => s.enemy)), waterOf(level).length > 0));
}

export class BattleController {
  sim: Sim;
  renderer: BattleRenderer | null = null;
  readonly world: number;

  // HUD state
  readonly weeds = signal(0);
  readonly cards = signal<CardView[]>([]);
  readonly selected = signal(-1);
  readonly shovel = signal(false);
  readonly progress = signal(0);
  readonly flags: { at: number; kind: 'big' | 'final' | 'boss' }[];
  readonly wave = signal(0);
  readonly banner = signal<Banner | null>(null);
  readonly boss = signal<{ id: string; frac: number } | null>(null);
  readonly paused = signal(false);
  /** Game speed: 1 or 2 (the 2× button); the testing ground also has 0.5 and 4. */
  readonly speed = signal(1);
  /** The testing ground: time held still without the pause sheet (cards can still be placed, one step taken). */
  readonly hold = signal(false);
  /** The testing ground: what a tap on the field does — play as usual, change a tile's terrain, or look at whoever is
   *  there (its readout in `inspect`). */
  readonly tool = signal<'play' | 'terrain' | 'inspect'>('play');
  readonly inspect = signal<string | null>(null);
  readonly status = signal<'playing' | 'won' | 'lost'>('playing');
  readonly toast = signal<{ key: number; text: string } | null>(null);
  readonly rescuesLeft = signal(0);
  readonly phase = signal<BattlePhase>('look');

  private canvas: HTMLCanvasElement | null = null;
  private readonly flights = new WeedFlights();
  private raf = 0;
  private lastTs = 0;
  private acc = 0;
  private hudAt = 0;
  private bannerQueue: Banner[] = [];
  private bannerUntil = 0;
  private bannerSeq = 1;
  private hover: { lane: number; col: number } | null = null;
  private down: { x: number; y: number; t: number; id: number } | null = null;
  private drag: { card: number; x: number; y: number; moved: boolean } | null = null;
  private portraitMq: MediaQueryList | null = null;
  private insets: { left: number; top: number; right?: number } = { left: 0, top: 0 };
  private ended = false;
  private endTimer = 0;
  /** Time (ms, at the game's speed) since the battle was won: the sim stops, but the last falls play out. */
  private afterMs = 0;
  private playMs = 0;
  private lastHit = 0;
  /** Where getting ready is, and how far the camera has glided toward the road (0-1). */
  private prep: { stage: 'wait' | 'out' | 'hold' | 'pick' | 'back' | 'cars' | 'ready'; t0: number; from: number; ms?: number; skip?: boolean } = { stage: 'wait', t0: 0, from: 0 };
  private look = 0;
  /** The testing ground: the friend or enemy being looked at. */
  private picked: Ally | Enemy | null = null;

  constructor(private cfg: BattleConfig) {
    const s = this.makeSim();
    this.sim = s;
    this.world = cfg.sandbox?.world ?? cfg.level?.world ?? 1;
    this.flags = s.waves.flags();
    this.rescuesLeft.value = s.rescues.length;
    this.refreshHud(true);
  }

  private makeSim(): Sim {
    const cfg = this.cfg;
    if (cfg.mode === 'sandbox') return simForSandbox(cfg.sandbox ?? { world: 1, cars: true }, cfg.deck, cfg.devRules ?? { free: true, freeze: false, safeFriends: false, safeEnemies: false }, { autoCollect: cfg.autoCollect, wish: cfg.wish });
    return cfg.mode === 'endless'
      ? simForEndless(cfg.endlessPool ?? ['mushi_twolegs'], cfg.deck, {
          bonusWeeds: cfg.bonusWeeds,
          autoCollect: cfg.autoCollect,
          ready: cfg.ready,
          wish: cfg.wish,
        })
      : simForLevel(cfg.level!, cfg.deck, {
          attempt: cfg.attempt,
          bonusWeeds: cfg.bonusWeeds,
          autoCollect: cfg.autoCollect,
          ready: cfg.ready,
          wish: cfg.wish,
        });
  }

  /** Character ids of everyone who can appear in this battle. */
  characterIds(): string[] {
    const allies = [...this.sim.cards.flatMap((c) => (c.star ? [c.def.id, c.star.id] : [c.def.id])), ...(this.cfg.pool ?? [])];
    const enemies =
      this.cfg.mode === 'sandbox'
        ? sandboxEnemies()
        : this.cfg.mode === 'endless'
          ? this.cfg.endlessPool ?? []
          : (this.cfg.level?.waves ?? []).flatMap((w) => w.spawns.map((s) => s.enemy));
    return characterIdsFor(allies, enemies, this.sim.waterLanes.length > 0);
  }

  /** Every picture this battle draws, for loading the real art before it starts. */
  artKeys(): string[] {
    return battleArtKeys(this.world, this.characterIds());
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.renderer = new BattleRenderer(canvas, this.world, this.sim);
    this.renderer.setInsets(this.insets);
    this.renderer.warmSprites(this.characterIds());
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerleave', this.onLeave);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointermove', this.onWindowMove);
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.portraitMq = window.matchMedia('(orientation: portrait)');
    this.portraitMq.addEventListener('change', this.onOrientation);
    this.onOrientation();
    if (this.cfg.mode === 'sandbox') this.start();
    else {
      // Getting ready: the enemies wait on the road and the camera glides over to them. Rakko's cars are not here yet.
      this.renderer.setLineup(this.cfg.lineup);
      this.renderer.setCars('away');
      this.prep = { stage: 'wait', t0: performance.now(), from: 0 };
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  resize(): void {
    this.renderer?.resize();
  }

  /** Screen space (CSS px) covered by the HUD on the left and top (and the testing ground's panel on the right); the
   *  camera keeps the field out of it. */
  setInsets(i: { left: number; top: number; right?: number }): void {
    this.insets = i;
    this.renderer?.setInsets(i);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.renderer?.stopWarming();
    window.clearTimeout(this.endTimer);
    this.flights.clear();
    const c = this.canvas;
    if (c) {
      c.removeEventListener('pointerdown', this.onDown);
      c.removeEventListener('pointermove', this.onMove);
      c.removeEventListener('pointerleave', this.onLeave);
    }
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointermove', this.onWindowMove);
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.portraitMq?.removeEventListener('change', this.onOrientation);
  }

  // ------------------------------------------------------------ loop

  private loop = (ts: number): void => {
    const dt = this.lastTs ? Math.min(50, ts - this.lastTs) : 16;
    this.lastTs = ts;
    // A tap collects between frames, and its 草 must be in the air before the counter is next read.
    this.handleEvents();
    if (this.phase.value !== 'battle') this.prepTick(ts);
    else if (!this.paused.value && !this.hold.value && this.sim.status === 'playing') {
      this.playMs += dt;
      this.acc += dt * this.speed.value;
      let steps = 0;
      while (this.acc >= STEP_MS && steps < 10) {
        this.sim.step(STEP_MS);
        this.acc -= STEP_MS;
        steps++;
        this.handleEvents();
      }
      if (steps >= 10) this.acc = 0;
    } else if (this.ended && this.status.value === 'won' && !this.paused.value) this.afterMs += dt * this.speed.value;
    this.renderer?.render(this.paused.value || this.hold.value ? 0 : this.acc / STEP_MS, this.renderUi());
    if (ts - this.hudAt > 50) {
      this.hudAt = ts;
      this.refreshHud(false);
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private renderUi(): RenderUi {
    const s = this.cfg.settings();
    const sel = this.selected.value;
    const card = sel >= 0 ? this.sim.cards[sel] : null;
    return {
      selectedCard: sel,
      shovel: this.shovel.value,
      hover: this.hover,
      // Every card shows who it puts down as a ghost on the tile under the finger: its friend, one-use cards too (owner's
      // call, 2026-11-08: オデ is put down like any friend), or 星 itself, which stands there first.
      ghostSprite: card ? (card.star ? STAR_SPRITE : spriteIdFor('ally', card.def.id, card.member)) : null,
      placeable: (lane, col) => (sel >= 0 ? this.sim.targetOpen(sel, lane, col) : this.sim.tileOpen(lane, col)),
      guides: s.guides,
      reducedMotion: s.reducedMotion,
      text: (key) => t(key),
      afterMs: this.afterMs,
    };
  }

  private refreshHud(force: boolean): void {
    const s = this.sim;
    const now = performance.now();
    const free = !!s.dev?.free;
    batch(() => {
      this.weeds.value = this.weedsOnCounter();
      this.cards.value = s.cards.map((c) => ({
        id: c.def.id,
        deckId: c.star?.id ?? c.def.id,
        star: !!c.star,
        sprite: spriteIdFor('ally', c.def.id, c.member),
        cost: c.def.cost,
        ready: free ? 1 : c.def.cooldownMs > 0 ? 1 - c.cooldownLeft / Math.max(c.def.cooldownMs, c.def.initialCooldownMs || 0, 1) : 1,
        affordable: free || s.weeds >= c.def.cost,
      }));
      if (this.cfg.mode === 'sandbox') this.inspect.value = this.readout();
      this.progress.value = s.waves.progress(s);
      this.wave.value = s.waves.currentWave();
      this.rescuesLeft.value = s.rescues.filter((r) => r.state === 'parked').length;
      const boss = s.enemies.find((e) => e.boss && e.state !== 'collapse' && !e.disguised && e.y > -40);
      this.boss.value = boss ? { id: boss.def.id, frac: Math.max(0, boss.hp / boss.maxHp) } : null;
      // Banners.
      if (force || now > this.bannerUntil) {
        const next = this.bannerQueue.shift();
        if (next) {
          this.banner.value = next;
          this.bannerUntil = now + BANNER_MS;
        } else if (this.banner.value && now > this.bannerUntil) this.banner.value = null;
      }
      if (this.toast.value && now - this.toast.value.key > 1600) this.toast.value = null;
    });
  }

  // ------------------------------------------------------------ events

  private handleEvents(): void {
    const events = this.sim.drainEvents();
    if (!events.length) return;
    const r = this.renderer;
    const ui = r ? this.renderUi() : null;
    for (const e of events) {
      if (r && ui) r.onEvent(e, this.sim.t, ui);
      this.sound(e);
      this.track(e);
      if (e.type === 'weedCollect') this.flyWeed(e.pickup);
    }
  }

  /** What the counter shows: the 草 is the player's to spend from the moment it is collected, but the number goes up as
   *  it lands. */
  private weedsOnCounter(): number {
    return Math.max(0, this.sim.weeds - this.flights.inAir);
  }

  /** A collected 草 flies to the counter: a picked weed once it is out of the ground, one ちいかわ found from her hand. */
  private flyWeed(p: Pickup): void {
    const root = this.canvas?.closest<HTMLElement>('.screen.battle');
    const from = this.cfg.settings().reducedMotion ? null : this.renderer?.weedTakeoff(p);
    if (!root || !from) return;
    const delay = p.kind === 'drop' ? 0 : WEED_TUG_MS / this.speed.value;
    this.flights.launch(root, from, p.value, delay, () => {
      this.weeds.value = this.weedsOnCounter();
    });
  }

  private sound(e: SimEvent): void {
    switch (e.type) {
      case 'place':
        audio.sfx('sfx_place');
        break;
      case 'remove':
        audio.sfx('sfx_shovel');
        break;
      case 'jab':
        audio.sfx('sfx_jab', { gap: 0.05 });
        break;
      case 'shoot':
        audio.sfx(e.projectile.fx === 'fx_blast' ? 'sfx_blast' : 'sfx_throw', { gap: 0.06 });
        break;
      case 'blocked':
        audio.sfx('sfx_clink', { gap: 0.08 });
        break;
      case 'hit':
        if (e.armored && e.source !== 'rakko_car') audio.sfx('sfx_clink', { gap: 0.08 });
        else if (performance.now() - this.lastHit > 45) {
          this.lastHit = performance.now();
          audio.sfx('sfx_hit', { gap: 0.045, pitch: 0.9 + Math.random() * 0.25 });
        }
        break;
      case 'enemyAttack':
        audio.sfx('sfx_bite', { gap: 0.09 });
        break;
      case 'spit':
        audio.sfx('sfx_spit', { gap: 0.08 });
        break;
      case 'stomp':
        audio.sfx('sfx_stomp');
        break;
      case 'allyCollapse':
        audio.sfx('sfx_collapse_ally', { gap: 0.1 });
        break;
      case 'enemyCollapse':
        audio.sfx('sfx_collapse_enemy', { gap: 0.06 });
        break;
      case 'weedSprout':
        audio.sfx('sfx_sprout');
        break;
      case 'weedCollect':
        audio.sfx('sfx_pull', { gap: 0.04 });
        break;
      case 'song':
      case 'summon':
        audio.sfx('sfx_song');
        break;
      case 'spell':
        audio.sfx('sfx_transform', { gap: 0.5 });
        break;
      case 'heal':
        audio.sfx('sfx_heal', { gap: 0.2 });
        break;
      case 'oneUse':
        // オデ sets off at a run; むちゃうマン appears.
        audio.sfx(e.def.oneUse?.kind === 'charge' ? 'sfx_stomp' : 'sfx_place');
        break;
      case 'freeze':
        audio.sfx('sfx_transform');
        break;
      case 'cooked':
        audio.sfx('sfx_sprout', { gap: 0.1 });
        break;
      case 'mine':
        audio.sfx('sfx_blast');
        break;
      case 'blast':
        audio.sfx('sfx_blast', { gap: 0.07 });
        break;
      case 'wishGranted':
        audio.sfx('sfx_unlock');
        break;
      case 'grab':
        audio.sfx('sfx_bite');
        break;
      case 'jump':
        audio.sfx('sfx_throw', { gap: 0.1 });
        break;
      case 'steal':
        audio.sfx('sfx_pull', { gap: 0.05, pitch: 0.8 });
        break;
      case 'stolenBack':
        audio.sfx('sfx_sprout');
        break;
      case 'claws':
        audio.sfx('sfx_claws');
        break;
      case 'splash':
        audio.sfx('sfx_splash', { gap: 0.06 });
        break;
      case 'transformStart':
        audio.sfx('sfx_transform');
        break;
      case 'rescue':
        audio.sfx('sfx_car');
        break;
      case 'banner':
        audio.sfx(e.kind === 'boss' ? 'sfx_boss' : 'sfx_wave');
        break;
      case 'won':
        audio.sfx('sfx_win');
        break;
      case 'lost':
        audio.sfx('sfx_lose');
        break;
      default:
        break;
    }
  }

  private track(e: SimEvent): void {
    switch (e.type) {
      case 'enemySpawn': {
        const id = e.enemy.def.id;
        this.cfg.onSeen(id);
        if (id === 'chiikabu') this.pushBanner('boss', t('banner.mystery', { name: nameOf(id) }));
        break;
      }
      case 'enemyCollapse':
        this.cfg.onDefeated(e.enemy.def.id);
        break;
      case 'rescue':
        this.cfg.onMet('rakko');
        break;
      case 'banner': {
        if (e.kind === 'big') {
          this.pushBanner('big', t('banner.big'));
        } else if (e.kind === 'final') this.pushBanner('final', t('banner.final'));
        else if (e.kind === 'boss' && e.bossId !== 'chiikabu') this.pushBanner('boss', t('banner.boss', { name: e.bossId ? nameOf(e.bossId) : '' }));
        break;
      }
      case 'waveStart':
        if (this.cfg.mode === 'endless' && e.index > 1) this.pushBanner('info', t('banner.wave', { n: e.index }));
        break;
      case 'transformEnd':
        this.pushBanner('boss', t('banner.transform'));
        break;
      case 'won':
      case 'lost':
        this.finish(e.type === 'won');
        break;
      default:
        break;
    }
  }

  private finish(won: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.selected.value = -1;
    this.shovel.value = false;
    this.status.value = won ? 'won' : 'lost';
    this.pushBanner(won ? 'win' : 'lose', won ? t('banner.win') : t('banner.lose'), true);
    const waves = this.sim.waves instanceof EndlessWaves ? this.sim.waves.cleared : this.sim.waves.currentWave();
    const end: BattleEnd = {
      won,
      mode: this.cfg.mode,
      levelId: this.cfg.level?.id,
      stats: this.sim.stats,
      rescuesLeft: this.sim.rescues.filter((r) => r.state === 'parked').length,
      wavesCleared: waves,
      timeMs: this.playMs,
    };
    // A win waits for the last one still falling (a boss falls slowly) before the result comes up.
    let falling = 0;
    if (won) {
      for (const e of this.sim.enemies) {
        if (e.state === 'collapse') falling = Math.max(falling, fallMsOf(e.def, e.form, e.boss) - (this.sim.t - e.collapseAt));
      }
    }
    this.endTimer = window.setTimeout(() => this.cfg.onEnd(end), Math.max(1700, Math.min(4500, falling / this.speed.value + 400)));
  }

  // ------------------------------------------------------------ getting ready

  private get prepMs(): typeof PREP {
    return this.cfg.quick ? PREP_QUICK : PREP;
  }

  private prepTick(now: number): void {
    const p = this.prep;
    const PREP_MS = this.prepMs;
    const calm = this.cfg.settings().reducedMotion;
    const along = (ms: number) => (calm || ms <= 0 ? 1 : Math.min(1, (now - p.t0) / ms));
    switch (p.stage) {
      case 'wait':
        if (now - p.t0 >= PREP_MS.wait) this.prep = { stage: 'out', t0: now, from: this.look };
        break;
      case 'out': {
        const k = along(PREP_MS.out);
        this.look = p.from + (1 - p.from) * easeInOut(k);
        if (k >= 1) {
          if (this.cfg.picking) this.toPick(now);
          else this.prep = { stage: 'hold', t0: now, from: 1 };
        }
        break;
      }
      case 'hold':
        if (now - p.t0 >= PREP_MS.hold) this.toBack(now);
        break;
      case 'pick':
        break;
      case 'back': {
        const k = along(p.ms ?? PREP_MS.back);
        this.look = p.from * (1 - easeInOut(k));
        this.renderer?.setLineupAlpha(1 - k);
        if (k >= 1) {
          if (p.skip || calm) this.start();
          else this.toCars(now);
        }
        break;
      }
      case 'cars':
        if (now - p.t0 >= arrivalMs(this.sim.rescues.length)) this.toReady(now);
        break;
      case 'ready':
        if (now - p.t0 >= READY_MS) this.start();
        break;
    }
    this.renderer?.setLook(this.look);
  }

  private toPick(now: number): void {
    this.look = 1;
    this.prep = { stage: 'pick', t0: now, from: 1 };
    this.phase.value = 'pick';
  }

  /** Back to the field. `skip`: a tap asked for it, so quicker, with the cars already parked and no countdown. */
  private toBack(now: number, skip = false): void {
    this.prep = { stage: 'back', t0: now, from: this.look, ms: this.prepMs.back * (skip ? SKIP_BACK : 1), skip };
    if (skip) this.renderer?.setCars(null);
    this.phase.value = 'go';
  }

  /** Back on the field: Rakko's cars drive in, one lane after another. */
  private toCars(now: number): void {
    this.prep = { stage: 'cars', t0: now, from: 0 };
    if (!this.sim.rescues.length) return;
    this.renderer?.setCars(now);
    audio.sfx('sfx_car');
  }

  private toReady(now: number): void {
    this.prep = { stage: 'ready', t0: now, from: 0 };
    this.pushBanner('ready', t('banner.ready'), true);
  }

  /** Set off: glide back to the field, then the battle starts. */
  go(): void {
    if (this.phase.value === 'battle' || this.phase.value === 'go') return;
    this.toBack(performance.now());
  }

  /** A tap while getting ready hurries it along. On the way to the road: straight to the team tray, or back to the field
   *  with no ceremony. Once on the way back: no more ceremony either, and the battle starts as soon as the camera is
   *  home. */
  skipLook(): void {
    const now = performance.now();
    if (this.phase.value === 'look') {
      if (this.cfg.picking) {
        this.toPick(now);
        this.renderer?.setLook(1);
      } else this.toBack(now, true);
    } else if (this.phase.value === 'go') {
      if (this.prep.stage === 'back') {
        this.prep.skip = true;
        this.renderer?.setCars(null);
      } else this.start();
    }
  }

  /** Before the battle: the team being taken (and the friend 星 turns into), the ラーメン券's extra 草, and whether a
   *  ぶた入りラーメン券 is used. */
  setTeam(deck: string[], bonusWeeds: number, ready = false, wish?: string): void {
    if (this.phase.value === 'battle') return;
    this.cfg = { ...this.cfg, deck, bonusWeeds, ready, wish };
    this.sim = this.makeSim();
    this.renderer?.setSim(this.sim);
    this.refreshHud(true);
  }

  /** The waiting enemies leave the road and the battle begins. */
  private start(): void {
    this.look = 0;
    this.renderer?.setLook(0);
    this.renderer?.setLineup(null);
    this.renderer?.setCars(null);
    this.phase.value = 'battle';
    this.lastTs = 0;
    this.acc = 0;
    // Takes over from 「よーい…」 at once.
    this.bannerUntil = 0;
    this.pushBanner('start', this.cfg.mode === 'sandbox' ? t('sandbox.title') : this.cfg.mode === 'endless' ? t('endless.title') : t('banner.start'));
  }

  // ------------------------------------------------------------ banners

  private pushBanner(kind: Banner['kind'], text: string, now = false): void {
    const b = { key: this.bannerSeq++, kind, text };
    if (now) {
      this.bannerQueue = [];
      this.banner.value = b;
      this.bannerUntil = performance.now() + BANNER_MS * 2;
      return;
    }
    // Keep banners timely: an older pending banner is dropped in favour of the newest one.
    this.bannerQueue = [b];
  }

  // ------------------------------------------------------------ commands

  selectCard(i: number): void {
    if (this.sim.status !== 'playing' || this.phase.value !== 'battle') return;
    this.shovel.value = false;
    if (this.selected.value === i) {
      this.selected.value = -1;
      audio.sfx('sfx_cancel');
      return;
    }
    const c = this.sim.cards[i];
    if (!c) return;
    if (this.tool.value !== 'play') this.tool.value = 'play';
    if (!this.sim.dev?.free && c.cooldownLeft > 0) {
      this.say(t('battle.cooldown'));
      return;
    }
    if (!this.sim.dev?.free && this.sim.weeds < c.def.cost) {
      this.say(t('battle.notEnough'));
      return;
    }
    this.selected.value = i;
    audio.sfx('sfx_card');
  }

  toggleShovel(): void {
    if (this.sim.status !== 'playing' || this.phase.value !== 'battle') return;
    this.selected.value = -1;
    this.shovel.value = !this.shovel.value;
    audio.sfx(this.shovel.value ? 'sfx_card' : 'sfx_cancel');
  }

  setPaused(p: boolean): void {
    this.paused.value = p;
    if (p) {
      this.selected.value = -1;
      this.shovel.value = false;
    }
    this.lastTs = 0;
  }

  setSpeed(s: number): void {
    this.speed.value = s;
  }

  // ------------------------------------------------------------ the testing ground (dev mode)

  /** The testing ground's rules, switched in place (the sim reads the same object). */
  get devRules(): DevRules | null {
    return this.sim.dev;
  }

  setTool(tool: 'play' | 'terrain' | 'inspect'): void {
    this.tool.value = this.tool.value === tool ? 'play' : tool;
    this.selected.value = -1;
    this.shovel.value = false;
    if (this.tool.value !== 'inspect') this.picked = null;
    this.inspect.value = this.readout();
  }

  setHold(on: boolean): void {
    this.hold.value = on;
    this.lastTs = 0;
  }

  /** Move time on by `ms` (one step of the game, or more), held or not. */
  stepBy(ms: number): void {
    this.debugAdvance(Math.max(STEP_MS, ms));
  }

  /** Send enemies: down the road, or (`col`) straight onto the field with their feet in that column. */
  sandboxSend(spawns: SpawnDef[], col?: number): void {
    const w = this.sim.waves;
    if (!(w instanceof SandboxWaves)) return;
    if (col === undefined) w.send(spawns, this.sim);
    else w.place(spawns, col, this.sim);
    this.handleEvents();
  }

  /** The testing ground: defeat every enemy (and drop the ones sent but not out yet), or every friend. Each falls as
   *  it would in battle, so its death can be seen. */
  sandboxDefeat(what: 'enemies' | 'friends'): void {
    if (what === 'enemies') {
      const w = this.sim.waves;
      if (w instanceof SandboxWaves) w.clear();
      this.sim.devDefeatEnemies();
    } else this.sim.devDefeatFriends();
    this.handleEvents();
  }

  sandboxHeal(): void {
    this.sim.devHealAll();
  }

  sandboxCars(): void {
    this.sim.devRefillCars();
    this.rescuesLeft.value = this.sim.rescues.length;
  }

  sandboxWeeds(n: number): void {
    this.sim.weeds += n;
    this.refreshHud(false);
  }

  /** Who 星's card turns into from now on. */
  sandboxWish(id: string): void {
    this.sim.devSetWish(id);
    this.refreshHud(false);
  }

  /** What the inspect tool shows about whoever it picked: name, HP, what it is doing, where. */
  private readout(): string | null {
    if (this.tool.value !== 'inspect') return null;
    const p = this.picked;
    if (!p) return t('sandbox.inspectHint');
    const hp = `${t('sandbox.hp')} ${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`;
    if ('col' in p) {
      const gone = p.state === 'collapse' ? ` · ${t('sandbox.down')}` : '';
      const held = p.songUntil > this.sim.t ? ` · ${t('sandbox.held')}` : '';
      const who = p.wishUntil > 0 ? t('wish.as', { name: nameOf(p.def.id) }) : nameOf(p.def.id);
      return `${who} · ${hp} · ${p.anim}${held}${gone}`;
    }
    const where = t('sandbox.at', { lane: p.lane + 1, col: colOfY(Math.max(0, p.y)) + 1 });
    const hidden = this.sim.hidden(p) ? ` · ${t('sandbox.hidden')}` : '';
    const gone = this.sim.inPlay(p) ? '' : ` · ${t('sandbox.down')}`;
    return `${nameOf(p.def.id)} · ${hp} · ${p.state} · ${where}${hidden}${gone}`;
  }

  private say(text: string): void {
    this.toast.value = { key: performance.now(), text };
  }

  private reasonText(c: PlaceCheck): string {
    switch (c) {
      case 'weeds':
        return t('battle.notEnough');
      case 'cooldown':
        return t('battle.cooldown');
      case 'occupied':
        return t('battle.occupied');
      case 'terrain':
        return t('battle.terrain');
      case 'water':
        return t('battle.water');
      case 'land':
        return t('battle.land');
      case 'inactive':
        return t('battle.inactive');
      default:
        return '';
    }
  }

  /** Handle a tap at world coordinates. */
  private tapWorld(x: number, y: number): void {
    const s = this.sim;
    // The testing ground's tools work while time is held or paused too.
    if (this.tool.value !== 'play' && this.renderer && this.phase.value === 'battle') {
      const tile = this.renderer.tileAt(x, y);
      if (!tile) return;
      if (this.tool.value === 'terrain') {
        s.devCycleTerrain(tile.lane, tile.col);
        this.renderer.refreshBackground();
        audio.sfx('sfx_card');
      } else {
        this.picked = s.devPick(tile.lane, tile.col);
        this.inspect.value = this.readout();
      }
      return;
    }
    if (s.status !== 'playing' || this.paused.value || !this.renderer || this.phase.value !== 'battle') return;
    const tile = this.renderer.tileAt(x, y);
    if (this.shovel.value) {
      if (tile && s.allyAt(tile.lane, tile.col)) s.remove(tile.lane, tile.col);
      this.shovel.value = false;
      return;
    }
    const sel = this.selected.value;
    if (sel >= 0) {
      if (tile) {
        const check = s.canPlace(sel, tile.lane, tile.col);
        if (check === 'ok') {
          const weed = s.weedOnTile(tile.lane, tile.col);
          if (weed) s.collect(weed.uid);
          s.place(sel, tile.lane, tile.col);
          this.selected.value = -1;
          return;
        }
        const p = s.pickupNear(x, y);
        if (p) {
          s.collect(p.uid);
          return;
        }
        const msg = this.reasonText(check);
        if (msg) this.say(msg);
        if (check === 'weeds' || check === 'cooldown') this.selected.value = -1;
        return;
      }
      const p = s.pickupNear(x, y);
      if (p) s.collect(p.uid);
      else this.selected.value = -1;
      return;
    }
    const p = s.pickupNear(x, y, 100);
    if (p) s.collect(p.uid);
  }

  // ------------------------------------------------------------ pointer input

  private onDown = (ev: PointerEvent): void => {
    audio.unlock();
    if (this.phase.value !== 'battle') {
      this.skipLook();
      return;
    }
    this.down = { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId };
    // Collect weeds immediately on press for snappy feel.
    if (!this.renderer || this.selected.value >= 0 || this.shovel.value || this.tool.value !== 'play') return;
    const w = this.renderer.toWorld(ev.clientX, ev.clientY);
    const p = this.sim.pickupNear(w.x, w.y, 100);
    if (p && this.sim.status === 'playing' && !this.paused.value) {
      this.sim.collect(p.uid);
      this.down = null;
    }
  };

  private onMove = (ev: PointerEvent): void => {
    if (!this.renderer) return;
    const w = this.renderer.toWorld(ev.clientX, ev.clientY);
    this.hover = this.renderer.tileAt(w.x, w.y);
  };

  private onLeave = (): void => {
    if (!this.drag) this.hover = null;
  };

  private onWindowMove = (ev: PointerEvent): void => {
    const d = this.drag;
    if (!d || !this.renderer) return;
    if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 12) {
      d.moved = true;
      // Dragged off its card it is picked up: the tiles it can go on light up, and its ghost follows the finger.
      if (this.selected.value !== d.card) this.selectCard(d.card);
    }
    const w = this.renderer.toWorld(ev.clientX, ev.clientY);
    this.hover = this.renderer.tileAt(w.x, w.y);
  };

  private onUp = (ev: PointerEvent): void => {
    if (this.drag) {
      const d = this.drag;
      this.drag = null;
      if (d.moved && this.renderer) {
        const w = this.renderer.toWorld(ev.clientX, ev.clientY);
        if (this.renderer.tileAt(w.x, w.y)) {
          if (this.selected.value !== d.card) this.selected.value = d.card;
          this.tapWorld(w.x, w.y);
        } else if (this.selected.value === d.card) this.selected.value = -1; // Let go off the field: put back.
        if (ev.pointerType !== 'mouse') this.hover = null;
      }
      return;
    }
    const d = this.down;
    this.down = null;
    if (!d || d.id !== ev.pointerId || !this.renderer) return;
    if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 24) return;
    const w = this.renderer.toWorld(ev.clientX, ev.clientY);
    this.tapWorld(w.x, w.y);
    if (ev.pointerType !== 'mouse') this.hover = null;
  };

  /** Called by the card tray on pointerdown: starts a possible drag. */
  beginCardDrag(card: number, ev: PointerEvent): void {
    audio.unlock();
    if (this.phase.value !== 'battle') return;
    this.drag = { card, x: ev.clientX, y: ev.clientY, moved: false };
  }

  /** The press on a card was taken over (the testing ground's column scrolled under the finger): no drag after all. */
  cancelCardDrag(): void {
    this.drag = null;
  }

  /** Whether the card just pressed has been dragged off it: it is being placed, not tapped or looked at. */
  get cardDragged(): boolean {
    return !!this.drag?.moved;
  }

  private onKey = (ev: KeyboardEvent): void => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement || ev.target instanceof HTMLSelectElement) return;
    if (this.phase.value !== 'battle') return;
    if (ev.key >= '1' && ev.key <= '9') {
      const i = Number(ev.key) - 1;
      if (i < this.sim.cards.length) this.selectCard(i);
    } else if (ev.key === 'Escape') {
      this.selected.value = -1;
      this.shovel.value = false;
    } else if (ev.key === 's' || ev.key === 'S') this.toggleShovel();
    else if (ev.key === ' ') {
      ev.preventDefault();
      this.setPaused(!this.paused.value);
    }
  };

  /** The field is landscape: a phone held upright shows the rotate prompt and the game waits. */
  private onOrientation = (): void => {
    if (this.portraitMq?.matches && this.sim.status === 'playing' && this.phase.value === 'battle') this.setPaused(true);
  };

  private onVisibility = (): void => {
    if (document.hidden && this.sim.status === 'playing' && this.phase.value === 'battle') this.setPaused(true);
  };

  /** QA: advance by `ms` of game time and draw one frame (works even when animation frames are throttled). */
  debugAdvance(ms: number, render = true): void {
    if (this.phase.value !== 'battle') this.start();
    const steps = Math.round(ms / STEP_MS);
    for (let i = 0; i < steps && this.sim.status === 'playing'; i++) {
      this.sim.step(STEP_MS);
      this.handleEvents();
    }
    this.handleEvents();
    if (render) {
      this.renderer?.render(0, this.renderUi());
      this.refreshHud(false);
    }
  }

  // ------------------------------------------------------------ queries for the HUD

  enemyName(id: string): string {
    return nameOf(id);
  }

  portrait(id: string): string {
    return art.portraitUrl(id);
  }

  worldName(): string {
    return t(`world.${this.world}.name`);
  }

  worldBgm(): string {
    return WORLDS[this.world]?.bgm ?? 'bgm_world1';
  }

  isBossLevel(): boolean {
    return !!this.cfg.level?.waves.some((w) => w.boss || w.spawns.some((s) => s.boss || ENEMIES[s.enemy]?.boss));
  }

  /** Screen position of a lane/col, for DOM overlays. */
  tileClient(lane: number, col: number): { x: number; y: number } | null {
    if (!this.renderer) return null;
    return this.renderer.toClient(laneX(lane), allyFeetY(col), 80);
  }
}
