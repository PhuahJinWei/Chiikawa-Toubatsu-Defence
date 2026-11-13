// Canvas 2D renderer for the battlefield. Reads sim state only; never changes it.
//
// The field is landscape: lanes run left to right, enemies enter from the right and walk toward the
// protected place at the left edge. The simulation measures travel as `y` (distance walked from the
// spawn side); `screenX` / `screenY` from constants.ts turn sim coordinates into screen coordinates.
// Everything in this file that is drawn ("field space") is in screen coordinates.
//
// Everything is paper: the world's backdrop is one painted picture, characters are frame animations (sprites), and
// projectiles, effects, pickups and terrain are single stickers the game pops, spins and fades.

import { pictureBleed, WORLD_BLEED, worldBleed } from '../../art/bleed';
import { type BuiltPiece, buildPiece } from '../../art/pieces';
import {
  drawSpriteFrame,
  frameOf,
  frontShift,
  jumpFrameAt,
  jumpHop,
  ONCE_MS,
  restingBox,
  spriteBox,
  spriteFor,
  type SpriteFrame,
  spriteFrame,
  spriteKeys,
  type SpriteLayout,
  type SpriteMotion,
  spriteFootprint,
  spriteScale,
  spriteSticker,
  spriteStickerBox,
  transformAdjust,
  WALK_FRAME_MS,
} from '../../art/sprite';
import { BASELINE, characterSpec, type SceneSpec, spriteIdFor, STAR_SPRITE, STICKER_VARIANTS, STICKERS, stickerSpec, WORLD_FIELD, worldScene } from '../../art/spec';
import { StickerCache } from '../../art/sticker';
import { resolveScene } from '../../art/store';
import { FONT_STACK, INK, seeded } from '../../art/kit';

/** The stitched lines between the field's tiles: how far they wander from straight, and how often (field px). */
const STITCH_WANDER = 5;
const STITCH_WANDER_EVERY = 70;
/** A melee blow's picture (ms). It fades in and glides out to the end of the reach; there a sweep stays and fades away, and
 *  a thrust's tail catches up with its point as it goes. */
const SWEEP_IN_MS = 50;
const SWEEP_OUT_MS = 230;
const SWEEP_MS = 480;
const THRUST_IN_MS = 40;
const THRUST_OUT_MS = 190;
const THRUST_TAIL_AT = 90;
const THRUST_TAIL_MS = 250;
const THRUST_FADE_AT = 260;
const THRUST_MS = 360;
/** Where a thrust starts, ahead of the friend's middle, and how far its point is out on its first frame (field px). */
const THRUST_FROM = 58;
const THRUST_POINT_START = 40;

/** A melee blow's picture on its way: which one, the friend's column, the lanes it cuts and the last column it reaches. */
interface Swing {
  t0: number;
  fx: string;
  col: number;
  lanes: number[];
  lastCol: number;
}

/** How long the world's full picture outlives the battle's background (ms); see letGoOfPicture. */
const PICTURE_KEEP_MS = 5000;
import {
  acrossOfScreenY,
  ALLY_ATTACK_MS,
  allyFeetY,
  COLLAPSE_MS,
  colLeft,
  COLS,
  colY,
  FADE_MS,
  FIELD_H,
  FIELD_W,
  HIT_LINE,
  LANE_FEET,
  laneX,
  LANES,
  PROJECTILE_HEIGHT,
  screenX,
  screenY,
  STEP_MS,
  stumpStage,
  TILE,
  travelOfScreenX,
  WEED_WILT_MS,
} from '../sim/constants';
import { ENEMIES } from '../sim/defs';
import { attackIntervalOf, deathMsOf, fallMsOf, HEAL_PULSE_MS, HEALED_MARK_MS, healPauseOf, jumpAt, jumpMsOf, swingOf, tempoOf } from '../sim/tempo';
import type { Sim } from '../sim/sim';
import type { Ally, Enemy, Pickup, Projectile, Rescue, SimEvent, UnitDef } from '../sim/types';
import { CAR_STAGGER_MS, carBehind, PARKED_X } from './arrival';
import { glide, glideTime } from './glide';
import { drawKey } from './layers';
import { type Body, byFeet, lineupLayout } from './lineup';
import { battleView } from './view';
import { type Takeoff, WEED_TUG_MS } from './weedFlight';

/** One of the level's enemies waiting on the road before the battle, shown in full whether it has been met yet or not
 *  (owner's call, 2026-11-10: a preview that hides who is coming is no preview; the job notice and the gallery still
 *  keep a never-met enemy dark). */
export interface Waiting {
  id: string;
}

const SIZE_RANK = { S: 0, M: 1, L: 2, XL: 3 } as const;

/** A waiting enemy's visible box at rest (field pixels); a small one's for a picture that is missing. */
function restingBody(id: string): Body {
  const s = spriteFor(spriteIdFor('enemy', id));
  return (s && restingBox(s)) ?? { l: -60, r: 60, t: -150 };
}

export interface RenderUi {
  selectedCard: number;
  /** The send-home tool is in hand: friends' tiles are marked instead of free ones. */
  sendingHome: boolean;
  hover: { lane: number; col: number } | null;
  ghostSprite: string | null;
  placeable: (lane: number, col: number) => boolean;
  guides: boolean;
  reducedMotion: boolean;
}

interface Pt {
  x: number;
  y: number;
}

interface Fx extends Pt {
  /** The effect (how it moves: FX_MOTION, FX_FRAMES). */
  sprite: string;
  /** The sticker it shows: the effect's own, or one of its versions (STICKER_VARIANTS), picked as it began. */
  pic: string;
  t0: number;
  dur: number;
  scale?: number;
  spin: number;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface CharacterLook {
  scale?: number;
  alpha?: number;
  flash?: number;
  tint?: string | null;
  guides?: boolean;
  /** How much slower than a small one's its moves are (by size), its walk frame (ms, by
   *  speed and size) and how long its one-off motion lasts when the sim times it (an enemy's swing). */
  tempo?: number;
  walkMs?: number;
  onceMs?: number;
  /** How far through a move's frames to show (0–1), for a move timed in parts (六足の虫's jump). */
  at?: number;
  /** Drawn around its middle, not moved back to stand face first like an enemy on the field: a flier hanging over
   *  where it is, or an enemy waiting on the road (that line is set out by middles). */
  centered?: boolean;
  /** Mirrored, facing the other way (でかい鳥 flying back out). */
  flip?: boolean;
}

/** Sim position (+ height above the ground) → field space. */
const S = (x: number, y: number, h = 0): Pt => ({ x: screenX(y), y: screenY(x) - h });
/** A stump that has just been hit: how long it stays squashed (ms), and how much at first. */
const STUMP_JOLT_MS = 140;
const STUMP_JOLT = 0.07;
/** A fallen character fades as it falls: fully gone when the fall and the fade are over (no puff of smoke). */
const fadeOut = (since: number, total = COLLAPSE_MS + FADE_MS): number => {
  // Slow at first, so the fall can be seen; gone at the end.
  const k = Math.min(1, Math.max(0, since) / total);
  return 1 - k * k;
};
/** How long a cooked taiyaki shows its sparkling picture (the last of its cook frames) before it settles (ms). */
const COOKED_SPARKLE_MS = 700;
/** One of the five song-note pictures, at random. */
const noteKind = (): number => 1 + Math.floor(Math.random() * 5);
/** The beat of パジャマパーティーズ' song (ms): they let a note go on it, and the rings round the friends their song
 *  speeds up glow and hop to it. */
const SONG_BEAT_MS = 760;
/** How long a speed-up ring takes to pop in round a friend (ms). */
const RING_POP_MS = 260;
/** How flat the rings on the ground are drawn: a circle seen from the camera's height. */
const RING_FLAT = 0.32;
/** The notes at a speed-up ring's left end, front and right end (which picture, and where on the ring: 0 is its right
 *  end, a quarter turn its front), where the friend standing in it never covers them. */
const RING_NOTES = [
  { n: 1, at: Math.PI * 0.94 },
  { n: 3, at: Math.PI * 0.5 },
  { n: 5, at: Math.PI * 0.06 },
];
/** How strongly the previews of a card in hand show (0–1): fainter than the real thing. */
const PREVIEW_ALPHA = 0.6;
/** A speed-up ring's size round a friend standing in it (field px from the middle): a little wider than the friend
 *  itself, so its ends show either side (a boat is wide). */
function ringRadius(sprite: string, def: UnitDef): number {
  const s = spriteFor(sprite);
  const box = s && restingBox(s);
  const half = box ? Math.max(box.r, -box.l) : def.size === 'L' ? 90 : 70;
  return Math.max(62, Math.min(130, half + 20));
}
/** The picture a friend on the field is drawn from (a team's own member's). */
const allySprite = (a: Ally): string => spriteIdFor('ally', a.def.id, a.member ?? undefined);
/** Status colours laid over a character, in place of badges (owner's call, 2026-11-07: badges were hard to spot):
 *  blue while slowed by シーサー's ゴーヤ, purple while held by 山姥's spell or 擬態型's song, pale ice blue while frozen
 *  by むちゃうマン. */
const SLOW_TINT = '#5BB4F0';
const SPELL_TINT = '#9D6FE0';
const ICE_TINT = '#A8E6FF';
/** むちゃうマン's freeze: how long the whole field flashes icy as it strikes (ms). */
const FREEZE_FLASH_MS = 520;
/** How high a missile starts falling from, over the spot it lands on (field px). */
const MISSILE_DROP = 720;
/** How strongly a status colour is laid over a character (0–1): enough to spot at a glance. */
const TINT_STRENGTH = 0.45;

/** How far a giant (でかつよ, あのこ) is drawn above the ground line of the nearest of its three lanes (field px), with
 *  its shadow: its feet and shadow sit inside that lane, not spilling into the one below, and its body is centred on
 *  its three, so it reads as standing across them (the owner saw it a lane low). Only the top of its head or fur
 *  reaches a little into the lane above them. */
const GIANT_LIFT = 65;
/** でかい鳥 cruises a little above its own lane, its body mostly over it and its shadow right under it (owner's calls:
 *  at 175 it looked to be in the lane above, at 18 it skimmed the ground). Over the friend it is after it rises, swoops
 *  down so its talons close on the friend's head, and flies off with the friend hanging from them (owner's call,
 *  2026-11-09: it did not look like it was holding anyone). How high it flies depends on how tall its catch stands. */
const FLY_LOW = 50;
/** How high it grabs at nothing, its pick gone at the last moment (field px). */
const FLY_GRAB = 128;
/** How far above the grab it hovers, to swoop down on its pick (field px). */
const FLY_SWOOP = 36;
/** How much higher it flies off than it grabbed, and how long that takes (field px, ms): the friend's feet leave the ground. */
const CARRY_LIFT = 18;
const CARRY_LIFT_MS = 300;
/** How far up into the closed talons a friend's head reaches (field px): they grip it, drawn over it. */
const TALON_GRIP = 14;
/** Where the claws are in the bird's drawings, measured from where it stands (picture px: across the middle of them, and
 *  down to their tips): one place in all its flying frames, and in each frame of the grab. */
const FLY_TALONS = [-12, -32] as const;
const GRAB_TALONS = [[-47, -20], [-39, 3], [-23, -20], [-30, -39]] as const;
/** The frame of the grab in which the claws have closed, as the friend is lifted (the sim's hit, halfway through). */
const TALONS_CLOSED = GRAB_TALONS[2];
/** Whoever でかい鳥 has stopped over or holds: their picture, and how tall it stands. */
interface FlierPrey {
  ally: Ally;
  sprite: string;
  tall: number;
}
/** How long the end of 星's cast shows over whoever it has just become (ms): its last frame, the puff clearing, fading
 *  out over its second half. */
const WISH_PUFF_MS = 240;
/** A weed coming up (ms): out of the ground with a puff of dust, then a moment to settle before it starts to breathe. */
const WEED_POP_MS = 380;
const WEED_SETTLE_MS = 300;
/** How long before it wilts a weed starts to droop (ms). */
const WEED_WARN_MS = 2500;
/** A picked weed: how high it is tugged (field px) and how long the dust it leaves takes to clear (ms). */
const WEED_TUG_LIFT = 8;
const WEED_PUFF_MS = 260;
/** Out of the ground with a little overshoot: from 0, just past 1, back to 1. */
const popOut = (k: number): number => {
  const u = k - 1;
  return Math.max(0.01, 1 + u * u * (3 * u + 2));
};

/** How far past the field a closed lane runs on over the road, to cover the ground's ragged edge there (field pixels). */
const CLOSED_PAST_FIELD = 60;
/** The trail behind Rakko's car and boat (fx_trail): its size, how far its right end (the big cloud) tucks in under the
 *  back of the car or the boat (field px), and how far the picture's middle is above the foot of its puffs (field px at
 *  full size). */
const TRAIL_SCALE = 0.72;
const TRAIL_TUCK = 25;
const TRAIL_FOOT = 31;

/** How each effect sticker moves: pops in and settles, bursts outward while fading, or rises a little and fades (the
 *  healed mark, upright). */
const FX_MOTION: Record<string, 'pop' | 'burst' | 'rise'> = {
  fx_heal: 'rise',
  fx_hit: 'pop',
  fx_clink: 'pop',
  fx_can_splash: 'pop',
  fx_place: 'pop',
  fx_splat: 'burst',
  fx_boom: 'burst',
  fx_spell: 'burst',
  fx_dust: 'burst',
  fx_freeze: 'pop',
  fx_taiyaki_pop: 'burst',
};

/** Effects drawn as the artist's frames, shown in turn over the effect's time. The frames spread and fade on their
 *  own, so the game only fades the last one away. */
/** How big a heal pulse is drawn for a healer that reaches the 3×3 tiles round it (黒い星): three tiles across, so the
 *  pulse shows who it reaches (its frames are a tile across). */
const HEAL_AREA_SCALE = 3;
const FX_FRAMES: Record<string, string[]> = {
  fx_heal_black: ['fx_heal_black_1', 'fx_heal_black_2', 'fx_heal_black_3'],
};
/** 栗まんじゅう's can splash: how long it shows (ms). One of its three versions, picked at random and popping like a hit
 *  spark, drawn small at its planned size (art/spec/stickers.ts) where the can comes down and over every other enemy it
 *  splashes, so the enemies stay in view (owner's calls 2026-11-07: drawn as wide as its reach, three tiles and then
 *  two, it hid the enemies; the others it splashes showed hit sparks at first; the versions were played as frames
 *  at first). */
const CAN_SPLASH_MS = 450;

export class BattleRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private scale = 1;
  private ox = 0;
  private oy = 0;
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  private fx: Fx[] = [];
  /** When each stump last took a blow (see drawStumps), by lane × 10 + column. */
  private stumpHits = new Map<number, number>();
  /** The version each effect drawn in versions showed last (see pictureFor). */
  private lastPic = new Map<string, string>();
  /** The version each shot drawn in versions (古本屋's books) flies as, picked when it is first drawn. */
  private shotPic = new WeakMap<Projectile, string>();
  /** Where 星 has just turned into a friend, its puff still clearing (see drawWishPuffs). */
  private wishPuffs: (Pt & { t0: number })[] = [];
  /** Song notes floating up; `v` is which of the five note pictures (fx_note_1…5) each one is. */
  private notes: { x: number; y: number; t0: number; v: number }[] = [];
  private healUntil = new Map<number, number>();
  /** When each singing friend (パジャマパーティーズ) last let a note go. */
  private singAt = new Map<number, number>();
  /** When each friend attacking faster (see drawBoosts) began to, so its ring pops in. */
  private boostedAt = new Map<number, number>();
  /** When each friend held by 山姥's spell was caught: it stands frozen in that frame while it is held. */
  private heldAt = new Map<number, number>();
  /** When オデ last kicked up dust as he ran (by his charge's uid). */
  private dustAt = new Map<number, number>();
  /** When むちゃうマン's freeze last struck (the field's icy flash). */
  private freezeAt = -1e9;
  private shakeUntil = 0;
  private shakeAmp = 0;
  /** Pictures drawn, for tidying up now and then (see forgetGone). */
  private frames = 0;
  private stickers = new StickerCache();
  private scene: SceneSpec;
  private picture: { q: number; tall: number; built: BuiltPiece } | null = null;
  /** Melee blows still showing on the ground. */
  private swings: Swing[] = [];
  /** Enemies hit by a melee blow whose picture has not reached them yet: when their hit flash really shows. */
  private lateFlash = new Map<number, { from: number; until: number }>();
  private pictureTimer = 0;
  private scratch: HTMLCanvasElement = document.createElement('canvas');
  private scratch2: HTMLCanvasElement = document.createElement('canvas');
  /** CSS px covered by the HUD (card column on the left, strip on top, the testing ground's panel on the right). */
  private insets: { left: number; top: number; right?: number } = { left: 0, top: 0 };
  /** Reduced motion: whoever stands by holds still instead of breathing. */
  private calm = false;
  /** Before the battle: the enemies waiting on the road, where they stand (field px) and their breathing phase. */
  private lineup: (Waiting & { x: number; y: number; phase: number })[] | null = null;
  private lineupAlpha = 1;
  /** Rakko's cars before the battle: not here yet ('away'), driving in since this moment (performance.now), or parked (null). */
  private carsAt: number | 'away' | null = null;
  private lineupT0 = 0;
  /** How far the camera glides right to bring the road and the picture's right edge into view (CSS px), and how
   *  far along it is (0 = the battle view). */
  private lookShift = 0;
  private look = 0;
  /** The screen size, pixel ratio and HUD room the camera was last fitted to. */
  private sizedFor = '';
  /** Bumped to stop cutting frames' stickers ahead of time (see warmSprites). */
  private warmToken = 0;
  /** The characters whose frames are cut ahead of time, cut again when the scale changes (see resize). */
  private warmIds: string[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    world: number,
    private sim: Sim,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.scene = resolveScene(worldScene(world, sim.activeLanes));
    this.resize();
  }

  // ------------------------------------------------------------ camera

  setInsets(i: { left: number; top: number; right?: number }): void {
    this.insets = i;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    // Nothing to do unless the screen or the HUD's room changed (the testing ground's panel opens and closes).
    // Setting a canvas's size clears it, even to the same size, so a needless resize would flash it blank.
    const sig = `${rect.width}x${rect.height}@${dpr}:${this.insets.left},${this.insets.top},${this.insets.right ?? 0}`;
    if (sig === this.sizedFor) return;
    this.sizedFor = sig;
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.dpr = dpr;
    const w = Math.round(this.cssW * this.dpr);
    const h = Math.round(this.cssH * this.dpr);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    const view = battleView(this.cssW, this.cssH, { left: this.insets.left, top: this.insets.top, right: this.insets.right ?? 0 }, { h: this.scene.h, field: this.scene.field ?? WORLD_FIELD });
    this.scale = view.scale;
    this.ox = view.ox;
    this.oy = view.oy;
    // Looking at the road: the picture's right edge at the screen's right edge.
    this.lookShift = Math.max(0, this.ox - (this.cssW - this.pictureRight() * this.scale));
    // A new scale empties the sticker cache: cut the battle's pictures again ahead of time, as at the start, so a
    // resize does not leave each one to be cut on its first draw, a hitch every time.
    if (this.stickers.setDeviceScale(this.scale * this.dpr) && this.warmIds.length) this.warmSprites(this.warmIds);
    this.bgKey = '';
  }

  /** The background has to be built again (the screen changed size, which also wipes the canvas). */
  get needsRebuild(): boolean {
    return this.bgKey === '';
  }

  /** The picture's right edge, in field pixels. */
  private pictureRight(): number {
    return this.scene.w - (this.scene.field ?? WORLD_FIELD).x;
  }

  /** Where the field's origin is on screen across, with the camera's glide toward the road. */
  private viewX(): number {
    return this.ox - this.lookShift * this.look;
  }

  /** Client (CSS pixel) coordinates → sim coordinates of the point `h` pixels above the ground there. */
  toWorld(clientX: number, clientY: number, h = 0): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = (clientX - rect.left - this.viewX()) / this.scale;
    const sy = (clientY - rect.top - this.oy) / this.scale;
    return { x: acrossOfScreenY(sy + h), y: travelOfScreenX(sx) };
  }

  /** Sim coordinates (+ height) → client coordinates, for DOM overlays. */
  toClient(x: number, y: number, h = 0): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const p = S(x, y, h);
    return { x: rect.left + this.viewX() + p.x * this.scale, y: rect.top + this.oy + p.y * this.scale };
  }

  /** Where a collected weed's flight to the counter starts, and what flies: the 草 icon, the same plant as the weed
   *  without its sparkles. One ちいかわ found comes smaller, from her hand. */
  weedTakeoff(p: Pickup): Takeoff | null {
    const spec = stickerSpec('pickup_weed');
    const st = spec && this.stickers.get(`stickers/${spec.id}`, spec.w, spec.h, 1, spec.edge ?? true);
    if (!spec || !st) return null;
    const found = p.kind === 'drop';
    const at = this.toClient(p.x, p.y, found ? 40 : spec.h / 2 - BASELINE + WEED_TUG_LIFT);
    const width = spec.w + 2 * st.pad;
    return { x: at.x, y: at.y, pic: st.el, size: width * this.scale * (found ? 0.55 : 1), edge: width / spec.w };
  }

  // ------------------------------------------------------------ getting ready

  /** Draw the field's still picture again (the testing ground changed a tile's terrain). */
  refreshBackground(): void {
    this.bgKey = '';
  }

  /** Another sim for the same battle (the team changed before it started). */
  setSim(sim: Sim): void {
    this.sim = sim;
    this.bgKey = '';
  }

  /** The enemies waiting on the road before the battle (a crowd in proportion to who is coming, see `crowdOf`), or
   *  null once it starts. Small ones stand at the front, nearest the field. */
  setLineup(list: Waiting[] | null): void {
    if (!list) {
      this.lineup = null;
      return;
    }
    const rank = (w: Waiting) => SIZE_RANK[ENEMIES[w.id]?.size ?? 'M'];
    const order = [...list].sort((a, b) => rank(a) - rank(b));
    // Swimmers wait in the water when there is any, everyone else on the sand, the others keep clear of a giant, and
    // nobody stands where it is out of sight or hides another.
    const spots = lineupLayout(
      order.map((w) => ({ swims: !!ENEMIES[w.id]?.aquatic, giant: !!ENEMIES[w.id]?.giant, body: restingBody(w.id) })),
      this.pictureRight(),
      this.sim.waterLanes,
    );
    this.lineup = order.map((w, i) => ({ ...w, ...spots[i], phase: i * 370 })).sort(byFeet);
    this.lineupT0 = performance.now();
    this.lineupAlpha = 1;
  }

  setLineupAlpha(a: number): void {
    this.lineupAlpha = Math.max(0, Math.min(1, a));
  }

  /** Rakko's cars before the battle (see `carsAt`). */
  setCars(at: number | 'away' | null): void {
    this.carsAt = at;
  }

  /** The camera's glide toward the road: 0 = the battle view, 1 = the road and the waiting enemies in view. */
  setLook(k: number): void {
    this.look = Math.max(0, Math.min(1, k));
  }

  /** The tile under a sim position (as returned by toWorld), or null outside the field. */
  tileAt(x: number, y: number): { lane: number; col: number } | null {
    const p = S(x, y);
    if (p.x < 0 || p.x >= FIELD_W || p.y < 0 || p.y >= FIELD_H) return null;
    return { lane: Math.floor(p.y / TILE), col: Math.floor(p.x / TILE) };
  }

  private worldTransform(ctx: CanvasRenderingContext2D, shakeX = 0, shakeY = 0): void {
    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, (this.viewX() + shakeX) * this.dpr, (this.oy + shakeY) * this.dpr);
  }

  // ------------------------------------------------------------ background

  /** The world's picture, built for the current resolution (kept across small resizes). */
  private worldPicture(): BuiltPiece {
    const q = Math.min(2.5, this.scale * this.dpr);
    // A squarish screen shows more than the picture's height, so the picture carries on to its edges, in soft colour.
    const seen = this.cssH / this.scale;
    const tall = pictureBleed(seen, this.scene.h);
    if (this.picture && this.picture.tall === tall && Math.abs(this.picture.q - q) / q < 0.12) return this.picture.built;
    const soft = tall > WORLD_BLEED.t || seen > this.scene.h;
    const built = buildPiece(this.scene.id, this.scene.layers[0], q, undefined, undefined, worldBleed((this.scene.field ?? WORLD_FIELD).x, tall), soft);
    this.picture = { q, tall, built };
    return built;
  }

  /** The world's full picture is only ever drawn into the background, and it is the largest canvas of a battle, so it
   *  goes once the battle's own background is built (`more`: this one was the opening's wider one, the battle's is still
   *  to come). It stays a few seconds longer because a window being dragged to a new size builds the background over
   *  and over; after that a new size cuts it again. */
  private letGoOfPicture(more: boolean): void {
    window.clearTimeout(this.pictureTimer);
    if (!more) this.pictureTimer = window.setTimeout(() => (this.picture = null), PICTURE_KEEP_MS);
  }

  /** The tiles of the open lanes, marked by hand-wobbled stitches along their edges, so the painted ground shows through
   *  and every tile can still be told apart. Seeded, so they stay put when the background is drawn again. The field's
   *  left edge is left to the base line, which runs there. */
  private drawFieldLines(ctx: CanvasRenderingContext2D): void {
    const open = this.sim.laneActive;
    const rnd = seeded(20261110);
    const stitch = (x0: number, y0: number, x1: number, y1: number): void => {
      const length = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(2, Math.round(length / STITCH_WANDER_EVERY));
      const nx = (y1 - y0) / length;
      const ny = -(x1 - x0) / length;
      let px = x0;
      let py = y0;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let i = 1; i <= n; i++) {
        const off = i === n ? 0 : (rnd() - 0.5) * STITCH_WANDER;
        const qx = x0 + ((x1 - x0) * i) / n + nx * off;
        const qy = y0 + ((y1 - y0) * i) / n + ny * off;
        ctx.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2);
        px = qx;
        py = qy;
      }
      ctx.lineTo(px, py);
      ctx.stroke();
    };
    ctx.save();
    ctx.strokeStyle = this.scene.fieldLine ?? 'rgba(74, 42, 18, 0.17)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.setLineDash([15, 15]);
    for (let col = 1; col <= COLS; col++) {
      for (let lane = 0; lane < LANES; lane++) {
        // From the top of each run of open lanes to its foot.
        if (!open[lane] || open[lane - 1]) continue;
        let last = lane;
        while (open[last + 1]) last++;
        stitch(colLeft(col), lane * TILE, colLeft(col), (last + 1) * TILE);
      }
    }
    for (let edge = 0; edge <= LANES; edge++) if (open[edge - 1] || open[edge]) stitch(0, edge * TILE, FIELD_W, edge * TILE);
    ctx.restore();
  }

  /** The still part of the picture (scenery, tiles, terrain) for the battle view, `extra` CSS px wider on the
   *  right while the camera may glide to the road (it is then drawn shifted, not rebuilt). */
  private buildBackground(guides: boolean, extra: number): void {
    const c = document.createElement('canvas');
    c.width = this.canvas.width + Math.ceil(extra * this.dpr);
    c.height = this.canvas.height;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const v: Box = { x0: -this.ox / this.scale, y0: -this.oy / this.scale, x1: (this.cssW + extra - this.ox) / this.scale, y1: (this.cssH - this.oy) / this.scale };
    const sc = this.scene;
    const F = sc.field ?? WORLD_FIELD;
    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, this.ox * this.dpr, this.oy * this.dpr);

    // The world's picture. Picture pixels are field pixels, offset by the field's place in it.
    ctx.fillStyle = sc.backdrop;
    ctx.fillRect(v.x0 - 10, v.y0 - 10, v.x1 - v.x0 + 20, v.y1 - v.y0 + 20);
    const pic = this.worldPicture();
    ctx.drawImage(pic.el, sc.layers[0].x - F.x + pic.left, sc.layers[0].y - F.y + pic.top, pic.width, pic.height);
    // Closed lanes are covered over, in one shape, so a solid colour shows no seams between neighbouring lanes. A world's
    // own colour carries on into the road it was matched to; the plain tint stops at the field, where its end would show.
    ctx.fillStyle = sc.closedLane ?? 'rgba(205, 178, 135, 0.55)';
    const closedTo = FIELD_W + (sc.closedLane ? CLOSED_PAST_FIELD : 0);
    ctx.beginPath();
    for (let lane = 0; lane < LANES; lane++) if (!this.sim.laneActive[lane]) ctx.rect(0, lane * TILE, closedTo, TILE);
    ctx.fill();

    // Water lanes (World 5): a picture with its sea painted in needs nothing; any other gets a plain band of water.
    for (let lane = 0; lane < LANES; lane++) {
      if (!this.sim.water[lane] || sc.paintedWater) continue;
      ctx.fillStyle = '#7FA3C7';
      ctx.fillRect(-170, lane * TILE + 6, FIELD_W + 1100, TILE - 12);
    }

    this.drawFieldLines(ctx);
    // Base line, beside the open lanes (a closed lane has nothing to guard).
    ctx.save();
    ctx.beginPath();
    for (let lane = 0; lane < LANES; lane++) if (this.sim.laneActive[lane]) ctx.rect(-8, lane * TILE, 16, TILE);
    ctx.clip();
    ctx.setLineDash([16, 12]);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(-2, FIELD_H);
    ctx.stroke();
    ctx.restore();

    // A bush's shadow. The bush itself is drawn with the characters, over the enemies hiding in it, and a stump every
    // frame, since it can break (see render and drawStumps).
    for (let lane = 0; lane < LANES; lane++) {
      for (let col = 0; col < COLS; col++) {
        if (this.sim.terrain[lane][col] === 'bush') shadow(ctx, colLeft(col) + TILE / 2, lane * TILE + LANE_FEET - 10, 62);
      }
    }

    if (guides) {
      ctx.save();
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = 'rgba(226,90,120,0.9)';
      ctx.lineWidth = 3;
      ctx.font = `700 20px ${FONT_STACK}`;
      for (const l of sc.layers) {
        ctx.strokeRect(l.x - F.x, l.y - F.y, l.w, l.h);
        const t = `${sc.id}/${l.id} · ${l.w}×${l.h}`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(l.x - F.x + 6, l.y - F.y + 6, ctx.measureText(t).width + 12, 26);
        ctx.fillStyle = INK;
        ctx.fillText(t, l.x - F.x + 12, l.y - F.y + 25);
      }
      ctx.setLineDash([]);
      ctx.font = `600 16px ${FONT_STACK}`;
      ctx.fillStyle = 'rgba(59,47,47,0.55)';
      for (let lane = 0; lane < LANES; lane++) for (let col = 0; col < COLS; col++) ctx.fillText(`L${lane}·C${col}`, colLeft(col) + 8, lane * TILE + 20);
      ctx.restore();
    }
    this.bg = c;
  }

  // ------------------------------------------------------------ events → effects

  onEvent(e: SimEvent, now: number, ui: RenderUi): void {
    switch (e.type) {
      case 'swing':
        // A friend at the far end of the field has nothing ahead of it to show.
        if (e.lastCol > e.ally.col) this.swings.push({ t0: now, fx: e.ally.def.attack.fx ?? 'fx_thrust', col: e.ally.col, lanes: e.lanes, lastCol: e.lastCol });
        break;
      case 'hit': {
        const en = e.enemy;
        // A giant is hit in whichever of its lanes the blow came down.
        const p = S(en.half ? laneX(e.lane) : en.x, en.y - HIT_LINE, PROJECTILE_HEIGHT + 10);
        // The spark and flash of a melee blow wait for its picture to get there.
        const at = now + this.swingArrival(e.fx, p.x, now, ui);
        if (at > now) this.lateFlash.set(en.uid, { from: at, until: at + Math.max(0, en.hitFlashUntil - this.sim.t) });
        if (e.source === 'usagi' && e.fx === 'fx_blast') this.addFx('fx_boom', p.x, p.y, now, 300);
        // Splashed by 栗まんじゅう's can (any enemy round where it lands but its target, armoured or not): the splash
        // over it too, as high as where the can comes down.
        else if (e.fx === 'fx_can_splash') this.addFx('fx_can_splash', p.x, p.y + 10, now, CAN_SPLASH_MS);
        else if (e.armored && e.source !== 'rakko_car') this.addFx('fx_clink', p.x - 10, p.y - 20, at, 220, 0.9);
        // A missile's blow: its blast shows where it lands ('blast'), no spark over each one it hits.
        else if (e.fx !== 'fx_missile') this.addFx('fx_hit', p.x + (Math.random() - 0.5) * 30, p.y + (Math.random() - 0.5) * 30, at, 200, 0.8);
        break;
      }
      case 'place': {
        const p = S(laneX(e.ally.lane), allyFeetY(e.ally.col), 10);
        this.addFx('fx_place', p.x, p.y, now, 260);
        break;
      }
      case 'heal': {
        // 黒い星 heals the enemies round it: its black pulse spreads from the middle of its body (over before it moves
        // on), and each one it healed shows the healed mark.
        this.healUntil.set(e.enemy.uid, now + healPauseOf(e.enemy.def));
        const c = this.enemyBody(e.enemy);
        this.addFx('fx_heal_black', c.x, c.y, now, HEAL_PULSE_MS, HEAL_AREA_SCALE);
        for (const o of e.healed) this.healedMark(this.enemyBody(o), now);
        break;
      }
      case 'spell': {
        // 山姥 chants: a burst of light over her, and sparkles round each friend she holds (each stands frozen in a
        // spell circle while it lasts: see drawAlly).
        const p = S(e.enemy.x, e.enemy.y, 150);
        this.addFx('fx_spell', p.x, p.y, now, 520, 1.1);
        this.holdFx(e.allies, now);
        break;
      }
      case 'song': {
        // 擬態型 sings: notes rise from it, and the friends it catches are held just as 山姥's spell holds them (owner's
        // call, 2026-11-07: they used to rock, a note over each).
        const p = S(e.enemy.x, e.enemy.y, 150);
        for (let i = 0; i < 6; i++) this.notes.push({ x: p.x + (i - 2.5) * 26, y: p.y, t0: now + i * 260, v: noteKind() });
        this.holdFx(e.allies, now);
        break;
      }
      case 'summon': {
        // セイレーン sings: notes rise from her (her followers come up one by one as she sings: 'callUp').
        const p = S(e.enemy.x, e.enemy.y, 300);
        for (let i = 0; i < 6; i++) this.notes.push({ x: p.x + (i - 2.5) * 30, y: p.y, t0: now + i * 260, v: noteKind() });
        break;
      }
      case 'callUp': {
        // One of セイレーン's followers comes up (its 'spawn' mode): sparkles at its feet.
        const q = S(e.mob.x, e.mob.y, 30);
        this.addFx('fx_place', q.x, q.y, now, 420, 1.2);
        break;
      }
      case 'transformStart': {
        this.shake(now, 12, 600, ui);
        const p = S(e.enemy.x, e.enemy.y, 90);
        this.addFx('fx_spell', p.x, p.y, now, 460, 2);
        break;
      }
      case 'stomp': {
        this.shake(now, 14, 280, ui);
        const p = S(laneX(e.ally.lane), allyFeetY(e.ally.col));
        this.addFx('fx_dust', p.x, p.y, now, 340, 1.1);
        break;
      }
      case 'splash': {
        // 栗まんじゅう's can splashes where it comes down (as high as shots fly), small; the other enemies it splashes
        // show the splash too (see 'hit').
        const p = S(laneX(e.lane), e.y, PROJECTILE_HEIGHT);
        this.addFx('fx_can_splash', p.x, p.y, now, CAN_SPLASH_MS);
        break;
      }
      case 'blocked': {
        const p = S(laneX(e.lane), e.y, PROJECTILE_HEIGHT);
        this.addFx('fx_hit', p.x, p.y, now, 200, 0.6);
        break;
      }
      case 'stumpHit': {
        this.stumpHits.set(e.lane * 10 + e.col, now);
        const y = colY(e.col) + TILE / 2;
        if (e.spark) {
          const p = S(laneX(e.lane), y, PROJECTILE_HEIGHT);
          this.addFx('fx_hit', p.x, p.y, now, 200, 0.6);
        }
        if (e.broken) {
          const p = S(laneX(e.lane), y, 30);
          this.addFx('fx_dust', p.x, p.y, now, 340, 0.7);
        }
        break;
      }
      case 'jump': {
        // 六足の虫 leaves the ground: a little dust where it took off.
        const p = S(e.enemy.x, e.enemy.y);
        this.addFx('fx_dust', p.x + 30, p.y - 6, now, 300, 0.45);
        break;
      }
      case 'stolenBack': {
        // A goblin beaten: the 草 it carried spring up where it fell.
        for (const pk of e.pickups) {
          const p = S(pk.x, pk.y, 10);
          this.addFx('fx_place', p.x, p.y, now, 300, 0.7);
        }
        break;
      }
      case 'spitHit': {
        const p = S(laneX(e.ally.lane), allyFeetY(e.ally.col), 70);
        this.addFx('fx_splat', p.x, p.y, now, 260);
        break;
      }
      case 'rescue':
        this.shake(now, 6, 240, ui);
        break;
      case 'oneUse': {
        // オデ sets off with a thud (he runs in from the base end: see drawSweeps); むちゃうマン pops up on his tile.
        if (e.def.oneUse?.kind === 'charge') this.shake(now, 5, 200, ui);
        else {
          const p = S(laneX(e.lane), allyFeetY(e.col), 10);
          this.addFx('fx_place', p.x, p.y, now, 380, 1.3);
        }
        break;
      }
      case 'freeze': {
        // むちゃうマン's pose strikes: the field flashes icy, and a glint of ice shows a moment over each enemy as it
        // freezes, small and high on its body so it stays in view (it stays ice blue while frozen: see drawEnemy).
        this.freezeAt = now;
        e.enemies.forEach((en, i) => {
          const c = this.enemyBody(en);
          this.addFx('fx_freeze', c.x, c.y - c.h * 0.2, now + i * 35, 420, 0.7);
        });
        break;
      }
      case 'cooked': {
        // A taiyaki is cooked and ready: a sparkle round it.
        const c = this.allyBody(e.ally);
        this.addFx('fx_place', c.x, c.y, now, 420, 1.1);
        break;
      }
      case 'mine': {
        // A taiyaki goes off under the enemy that reached it.
        const p = S(laneX(e.ally.lane), allyFeetY(e.ally.col), 60);
        this.addFx('fx_taiyaki_pop', p.x, p.y, now, 520, 1.1);
        const d = S(laneX(e.ally.lane), allyFeetY(e.ally.col));
        this.addFx('fx_dust', d.x, d.y - 6, now, 360, 0.8);
        this.shake(now, 12, 320, ui);
        break;
      }
      case 'blast': {
        // A missile lands and blows up: low and small, so the enemies stay in view.
        const p = S(laneX(e.lane), e.y, 40);
        this.addFx('fx_boom', p.x, p.y, now, 360, 0.6);
        this.shake(now, 4, 160, ui);
        break;
      }
      case 'push': {
        // Pushed back by a jab: a little dust at its feet.
        const p = S(e.enemy.x, e.enemy.y);
        this.addFx('fx_dust', p.x + 24, p.y - 4, now, 300, 0.4);
        break;
      }
      case 'grab':
        this.shake(now, 5, 180, ui);
        break;
      case 'drop': {
        const p = S(laneX(e.ally.lane), allyFeetY(e.ally.col), 10);
        this.addFx('fx_place', p.x, p.y, now, 260);
        break;
      }
      case 'wishGranted': {
        // 星's wish comes true: the friend has taken its place behind the puff, which now clears, with sparkles at the
        // friend's feet.
        const p = S(laneX(e.lane), allyFeetY(e.col));
        this.wishPuffs.push({ x: p.x, y: p.y, t0: now });
        const f = S(laneX(e.lane), allyFeetY(e.col), 10);
        this.addFx('fx_place', f.x, f.y, now + 60, 300, 1.1);
        break;
      }
      default:
        break;
    }
  }

  /** Friends caught by a hold (山姥's spell, 擬態型's song): each freezes in the frame it is in (see drawAlly), with
   *  sparkles round it, one after another. */
  private holdFx(allies: Ally[], now: number): void {
    allies.forEach((a, i) => {
      this.heldAt.set(a.uid, now);
      const q = S(laneX(a.lane), allyFeetY(a.col), 60);
      this.addFx('fx_place', q.x, q.y, now + 200 + i * 120, 420, 1.2);
    });
  }

  private addFx(sprite: string, x: number, y: number, t0: number, dur: number, scale = 1): void {
    this.fx.push({ sprite, pic: this.pictureFor(sprite), x, y, t0, dur, scale, spin: (Math.random() - 0.5) * 0.8 });
    if (this.fx.length > 160) this.fx.splice(0, this.fx.length - 160);
  }

  /** The healed mark (「＋HP」) over one healed, for a moment, as big as they are. */
  private healedMark(body: { x: number; y: number; h: number }, now: number): void {
    this.addFx('fx_heal', body.x, body.y, now, HEALED_MARK_MS, Math.max(0.8, Math.min(2.4, body.h / 150)));
  }

  /** The middle of a friend's body as it is drawn on its tile (field px), and how tall it stands. */
  private allyBody(a: Ally): { x: number; y: number; h: number } {
    const p = S(laneX(a.lane), allyFeetY(a.col));
    return this.bodyOf(spriteIdFor('ally', a.def.id, a.member ?? undefined), p.x, p.y, true);
  }

  /** The middle of an enemy's body as it is drawn (field px), and how tall it stands: a giant on its nearest lane, an
   *  enemy's drawing moved back behind its front (see frontShift), でかい鳥 up in the air. */
  private enemyBody(e: Enemy): { x: number; y: number; h: number } {
    const p = S(e.x + e.half * TILE, e.y);
    if (e.half) p.y -= GIANT_LIFT;
    const id = spriteIdFor('enemy', e.def.id, e.form);
    if (e.flight) {
      const pose = this.flierPose(e, this.sim.t);
      const at = p.x + pose.reach;
      const body = this.bodyOf(id, at, p.y - pose.h, true);
      return pose.flip ? { ...body, x: 2 * at - body.x } : body;
    }
    return this.bodyOf(id, p.x, p.y, false);
  }

  /** The middle of a character's body at rest, standing at (x, y) as the renderer draws it (its first idle frame), and
   *  how tall it stands. `centered`: drawn on the point it stands on, not moved back behind its front. */
  private bodyOf(id: string, x: number, y: number, centered: boolean): { x: number; y: number; h: number } {
    const s = spriteFor(id);
    const f = s ? (frameOf(s, 'idle', 0) ?? frameOf(s, Object.keys(s.anims)[0] as SpriteMotion, 0)) : null;
    if (!s || !f) return { x, y: y - 75, h: 150 };
    const unit = spriteScale(s);
    const b = spriteBox(f, x + (centered ? 0 : frontShift(s, unit)), y, unit);
    return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, h: b.y1 - b.y0 };
  }

  /** The sticker an effect shows this time: one of its versions at random, never the one it showed last (an effect
   *  with one picture shows that). */
  private pictureFor(sprite: string): string {
    const all = STICKER_VARIANTS[sprite];
    if (!all?.length) return sprite;
    const last = this.lastPic.get(sprite);
    const pool = all.length > 1 ? all.filter((p) => p !== last) : all;
    const pic = pool[Math.floor(Math.random() * pool.length)];
    this.lastPic.set(sprite, pic);
    return pic;
  }

  /** The sticker a shot flies as: its own, or one of its versions (古本屋's books), picked as it is first drawn and
   *  kept all the way (so the two books of a throw differ, and a book never changes in the air). */
  private shotPicture(p: Projectile): string {
    if (!STICKER_VARIANTS[p.fx]) return p.fx;
    let pic = this.shotPic.get(p);
    if (!pic) {
      pic = this.pictureFor(p.fx);
      this.shotPic.set(p, pic);
    }
    return pic;
  }

  private shake(now: number, amp: number, ms: number, ui: RenderUi): void {
    if (ui.reducedMotion) return;
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeUntil = Math.max(this.shakeUntil, now + ms);
  }

  // ------------------------------------------------------------ drawing helpers

  /** Draw a sticker standing at (x, y) (its feet, or its middle), turned, scaled and faded. */
  private drawSticker(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, o: { scale?: number; sx?: number; sy?: number; rot?: number; alpha?: number } = {}): void {
    // An effect drawn in versions, named as a whole (a shot with no picture of its own is 'fx_hit'), shows its first.
    const spec = stickerSpec(id) ?? stickerSpec(STICKER_VARIANTS[id]?.[0] ?? '');
    if (!spec) return;
    const st = this.stickers.get(`stickers/${spec.id}`, spec.w, spec.h, 1, spec.edge ?? true);
    if (!st) return;
    const k = o.scale ?? 1;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(k * (o.sx ?? 1), k * (o.sy ?? 1));
    if (o.alpha !== undefined) ctx.globalAlpha *= Math.max(0, Math.min(1, o.alpha));
    const ax = spec.w / 2;
    const ay = spec.anchor === 'feet' ? spec.h - BASELINE : spec.h / 2;
    ctx.drawImage(st.el, -ax - st.pad, -ay - st.pad, spec.w + 2 * st.pad, spec.h + 2 * st.pad);
    ctx.restore();
  }

  /** A scratch canvas at least w × h (whole pixels), wiped clean all over. It is shared and only ever grows, so what a
   *  bigger character left beyond the region in use must go too: drawing the region back sampled the stale pixels just
   *  past its edge, a straight line behind and below whoever was hit or falling. */
  private sized(c: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
    if (c.width < w || c.height < h) {
      c.width = Math.max(c.width, Math.ceil(w));
      c.height = Math.max(c.height, Math.ceil(h));
    }
    const cx = c.getContext('2d');
    cx?.setTransform(1, 0, 0, 1, 0, 0);
    cx?.clearRect(0, 0, c.width, c.height);
    return cx;
  }

  /** Draw a character (`paint` draws it in the context's field space) with its look: faded, flashing or tinted. Such a
   *  character is drawn into a scratch canvas first, and the look is laid over that. */
  private drawLook(ctx: CanvasRenderingContext2D, box: Box, paint: (c: CanvasRenderingContext2D) => void, o: CharacterLook, guide: () => void): Box {
    const alpha = o.alpha ?? 1;
    const flash = o.flash ?? 0;
    if (alpha >= 1 && !flash && !o.tint) paint(ctx);
    else {
      const m = ctx.getTransform();
      const dx0 = m.a * box.x0 + m.e;
      const dy0 = m.d * box.y0 + m.f;
      // Whole pixels, so the region drawn back is sampled exactly, never blended with what lies past its edge.
      const w = Math.ceil((box.x1 - box.x0) * m.a + 4);
      const h = Math.ceil((box.y1 - box.y0) * m.d + 4);
      const sx = this.sized(this.scratch, w, h);
      if (sx && w > 1 && h > 1) {
        sx.setTransform(m.a, m.b, m.c, m.d, m.e - dx0 + 2, m.f - dy0 + 2);
        paint(sx);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.drawImage(this.scratch, 0, 0, w, h, dx0 - 2, dy0 - 2, w, h);
        if (o.tint) {
          const tx = this.sized(this.scratch2, w, h);
          if (tx) {
            tx.drawImage(this.scratch, 0, 0, w, h, 0, 0, w, h);
            tx.globalCompositeOperation = 'source-in';
            tx.fillStyle = o.tint;
            tx.fillRect(0, 0, w, h);
            tx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = alpha * TINT_STRENGTH;
            ctx.drawImage(this.scratch2, 0, 0, w, h, dx0 - 2, dy0 - 2, w, h);
          }
        }
        if (flash > 0) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = alpha * flash * 0.45;
          ctx.drawImage(this.scratch, 0, 0, w, h, dx0 - 2, dy0 - 2, w, h);
        }
        ctx.restore();
      }
    }
    if (o.guides) guide();
    return box;
  }

  private drawCharacter(ctx: CanvasRenderingContext2D, id: string, anim: string, t: number, x: number, y: number, o: CharacterLook = {}): Box | null {
    const sprite = spriteFor(id);
    return sprite ? this.drawSprite(ctx, sprite, anim, t, x, y, o) : null;
  }

  /** A character drawn from its frames (see art/sprite.ts), standing at (x, y). */
  private drawSprite(ctx: CanvasRenderingContext2D, sprite: SpriteLayout, anim: string, t: number, x: number, y: number, o: CharacterLook): Box | null {
    const f = spriteFrame(sprite, anim, t, { tempo: o.tempo, walkMs: o.walkMs, onceMs: o.onceMs, at: o.at, still: this.calm });
    if (!f) return null;
    const unit = spriteScale(sprite);
    let scale = unit * (o.scale ?? 1);
    // An enemy on the field meets friends face to face, its body behind it (a long one's trailing); a flier hangs over
    // where it is.
    let fx = x + (o.centered ? 0 : frontShift(sprite, unit));
    if (f.motion === 'transform') {
      // ちいかぶ grows out of where its small form stood.
      const adj = transformAdjust(spriteFor('enemy_chiikabu'), sprite, f);
      scale *= adj.k;
      fx += adj.dx;
    }
    const box = spriteBox(f, fx, y, scale);
    // No glow while healing (the user's call): the heal shows as its pulse (fx_heal / fx_heal_black).
    // The look is drawn over the sticker's whole room (edge and shadow included), not just the art's box.
    const room = spriteStickerBox(f, fx, y, scale, unit);
    const mirrored = o.flip ? { ...room, x0: 2 * fx - room.x1, x1: 2 * fx - room.x0 } : room;
    const paint = (c: CanvasRenderingContext2D): void => {
      if (!o.flip) return void drawSpriteFrame(c, f, fx, y, scale, this.stickers, unit);
      c.save();
      c.translate(2 * fx, 0);
      c.scale(-1, 1);
      drawSpriteFrame(c, f, fx, y, scale, this.stickers, unit);
      c.restore();
    };
    this.drawLook(ctx, mirrored, paint, o, () => this.drawSpriteGuide(ctx, sprite, f, fx, y, scale, box));
    return box;
  }

  /** The art guide over a character drawn from frames: the frame's box, where it stands, and which frame it is. */
  private drawSpriteGuide(ctx: CanvasRenderingContext2D, sprite: SpriteLayout, f: SpriteFrame, x: number, y: number, scale: number, box: Box): void {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(226,90,120,0.9)';
    ctx.strokeRect(x - f.a.ax * scale, y - f.a.ay * scale, f.a.w * scale, f.a.h * scale);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(40,170,120,1)';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `700 14px ${FONT_STACK}`;
    const text = `${sprite.id} · ${f.motion} ${f.i + 1}/${f.a.frames}`;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillRect(box.x0, box.y0 - 20, ctx.measureText(text).width + 10, 18);
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.fillText(text, box.x0 + 5, box.y0 - 6);
    ctx.restore();
  }

  /** Cut these characters' frames and every effect's sticker ahead of time, a few at a time in spare moments, so nothing
   *  stutters the first time it walks, strikes, falls or goes off. Started again, it drops the last run. */
  warmSprites(ids: string[]): void {
    this.warmIds = ids;
    const jobs: (() => void)[] = [];
    const cut = (motion: SpriteMotion, who: string[]): void => {
      for (const id of who) {
        const s = spriteFor(id);
        const a = s?.anims[motion];
        if (!s || !a) continue;
        const unit = spriteScale(s);
        for (let i = 0; i < a.frames; i++) {
          const f = frameOf(s, motion, i);
          if (f) jobs.push(() => void spriteSticker(f, unit, this.stickers));
        }
      }
    };
    // What shows soonest goes first: the enemies waiting on the road, the friends as they are put down, whoever walks in,
    // the effects of the first hits, and then everything else anyone can do.
    const waiting = ids.filter((id) => id.startsWith('enemy_'));
    cut('idle', [...waiting, ...ids.filter((id) => !waiting.includes(id))]);
    cut('walk', ids);
    for (const s of STICKERS) jobs.push(() => void this.stickers.get(`stickers/${s.id}`, s.w, s.h, 1, s.edge ?? true));
    const rest = new Set<SpriteMotion>(['attack', 'death', 'ability', 'transform', ...ids.flatMap((id) => Object.keys(spriteFor(id)?.anims ?? {}) as SpriteMotion[])]);
    rest.delete('idle');
    rest.delete('walk');
    for (const motion of rest) cut(motion, ids);
    const token = ++this.warmToken;
    let look = this.look;
    const step = () => {
      if (token !== this.warmToken) return;
      // One sticker can take longer than a frame on a slow phone, and only a moving picture shows it: not while the camera glides.
      const gliding = this.look !== look;
      look = this.look;
      const t0 = performance.now();
      while (!gliding && jobs.length && performance.now() - t0 < 6) jobs.shift()!();
      if (jobs.length) window.setTimeout(step, 30);
    };
    window.setTimeout(step, 30);
  }

  /** The battle is over: no more cutting ahead of time, and nothing left waiting on a timer to keep this renderer alive. */
  stopWarming(): void {
    this.warmToken++;
    this.warmIds = [];
    window.clearTimeout(this.pictureTimer);
  }

  /** The battle is decided: no shaking on (after a loss the field's clock stops, and a shake under way never ended). */
  calmShake(): void {
    this.shakeAmp = 0;
    this.shakeUntil = 0;
  }

  /** The battle is gone: its canvases are let go at once (sized to nothing), not whenever the garbage collector gets
   *  round to them. iOS Safari caps a page's canvas memory, and a battle makes tens of MB of it (2026-11-10 audit). */
  dispose(): void {
    this.stopWarming();
    for (const c of [this.bg, this.picture?.built.el, this.scratch, this.scratch2]) if (c) c.width = c.height = 0;
    this.bg = null;
    this.picture = null;
    this.stickers.dispose();
  }

  /** Forget what was noted about enemies, friends and charges that are gone (a long endless run kept every one). */
  private forgetGone(): void {
    const here = new Set<number>();
    for (const e of this.sim.enemies) here.add(e.uid);
    for (const a of this.sim.allies) here.add(a.uid);
    for (const s of this.sim.sweeps) here.add(s.uid);
    for (const notes of [this.healUntil, this.singAt, this.heldAt, this.dustAt, this.lateFlash]) {
      for (const uid of notes.keys()) if (!here.has(uid)) notes.delete(uid);
    }
  }

  // ------------------------------------------------------------ frame

  render(alpha: number, ui: RenderUi): void {
    if (++this.frames % 240 === 0) this.forgetGone();
    const sim = this.sim;
    const ctx = this.ctx;
    const now = sim.t + alpha * STEP_MS;
    this.calm = ui.reducedMotion;
    const extra = this.lineup ? this.lookShift : 0;
    const key = `${this.canvas.width}x${this.canvas.height}:${ui.guides}:${Math.round(extra)}`;
    if (key !== this.bgKey || !this.bg) {
      this.buildBackground(ui.guides, extra);
      this.bgKey = key;
      this.letGoOfPicture(extra > 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bg) ctx.drawImage(this.bg, -this.lookShift * this.look * this.dpr, 0);

    let sx = 0;
    let sy = 0;
    if (now < this.shakeUntil) {
      const k = (this.shakeUntil - now) / 300;
      sx = (Math.random() - 0.5) * this.shakeAmp * Math.min(1, k);
      sy = (Math.random() - 0.5) * this.shakeAmp * Math.min(1, k);
    } else this.shakeAmp = 0;
    this.worldTransform(ctx, sx, sy);

    this.drawSwings(ctx, now, ui);
    this.drawStumps(ctx, now);
    this.drawWater(ctx, now, ui);
    this.drawHighlights(ctx, ui, now);
    this.drawReach(ctx, ui, now);
    this.drawBoosts(ctx, ui, now);
    this.drawParkedCars(ctx, now, ui);
    this.drawLineup(ctx, ui);

    // Entities, lane by lane: a nearer lane is always in front, and within a lane every enemy is over every friend (see
    // drawKey). Among a lane's enemies whoever's feet are lower stands in front, the lead one on top.
    const list: { key: number; draw: () => void }[] = [];
    for (const a of sim.allies) {
      // A friend in でかい鳥's talons is drawn with the bird.
      if (a.state === 'carried') continue;
      const p = S(laneX(a.lane), allyFeetY(a.col));
      list.push({ key: drawKey(a.lane, false, p.y * 10 + (COLS - a.col) * 0.01), draw: () => this.drawAlly(ctx, a, p.x, p.y, now, ui) });
    }
    for (const e of sim.enemies) {
      const y = e.prevY + (e.y - e.prevY) * alpha;
      // A giant (でかつよ, あのこ) stands on the nearest of its three lanes, lifted GIANT_LIFT off its ground line, its body
      // rising over the other two. It is layered by where its feet are like everyone (owner's call, 2026-11-07: true
      // depth): it covers whoever is further back in its other two lanes, and those in front of its feet cover it.
      const p = S(e.x + e.half * TILE, y);
      const feet = p.y - (e.half ? GIANT_LIFT : 0);
      const key = feet * 10 + 5 + (p.x < 0 ? 0 : (FIELD_W + 400 - p.x) / (FIELD_W + 400));
      list.push({ key: drawKey(e.lane + e.half, true, key), draw: () => this.drawEnemy(ctx, e, p.x, p.y - (e.half ? GIANT_LIFT : 0), now, ui) });
    }
    // Bushes, in front of the enemies in their lane, so whoever walks into one hides in it.
    for (let lane = 0; lane < LANES; lane++) {
      for (let col = 0; col < COLS; col++) {
        if (sim.terrain[lane][col] !== 'bush') continue;
        const x = colLeft(col) + TILE / 2;
        const y = lane * TILE + LANE_FEET;
        list.push({ key: drawKey(lane, true, y * 10 + 6.5), draw: () => this.drawSticker(ctx, 'terrain_bush', x, y - 6) });
      }
    }
    list.sort((p, q) => p.key - q.key);
    for (const it of list) it.draw();

    this.drawProjectiles(ctx, alpha, now);
    this.drawSweeps(ctx, alpha, now, ui);
    this.drawCameos(ctx, now, ui);
    this.drawFreezeFlash(ctx, now, ui);
    this.drawWishPuffs(ctx, now);
    this.drawFxLayer(ctx, now);
    this.drawPickups(ctx, now);
    this.drawDrivingCars(ctx, now, ui);
    this.drawGhost(ctx, ui, now);
  }

  /** The stumps on the ground, under everyone: whole, cracked or split by what each has left, and for a moment after a
   *  blow squashed a little, from its roots. */
  private drawStumps(ctx: CanvasRenderingContext2D, now: number): void {
    const sim = this.sim;
    for (let lane = 0; lane < LANES; lane++) {
      for (let col = 0; col < COLS; col++) {
        if (sim.terrain[lane][col] !== 'stump') continue;
        const x = colLeft(col) + TILE / 2;
        const y = lane * TILE + LANE_FEET - 6;
        shadow(ctx, x, y - 4, 62);
        const since = now - (this.stumpHits.get(lane * 10 + col) ?? -Infinity);
        const jolt = this.calm || since >= STUMP_JOLT_MS ? 0 : (1 - since / STUMP_JOLT_MS) * STUMP_JOLT;
        this.drawSticker(ctx, `terrain_stump_${stumpStage(sim.stumpHp[lane][col])}`, x, y, { sx: 1 + jolt, sy: 1 - jolt });
      }
    }
  }

  /** The waiting enemies, breathing on the road (on their own clock: the battle has not started). */
  private drawLineup(ctx: CanvasRenderingContext2D, ui: RenderUi): void {
    const list = this.lineup;
    if (!list || this.lineupAlpha <= 0) return;
    const t = performance.now() - this.lineupT0;
    for (const w of list) {
      const size = ENEMIES[w.id]?.size ?? 'M';
      const alpha = this.lineupAlpha;
      const lane = Math.max(0, Math.min(LANES - 1, Math.floor(w.y / TILE)));
      const rx = ENEMIES[w.id]?.giant ? 190 : size === 'XL' ? 110 : size === 'L' ? 80 : size === 'M' ? 58 : 44;
      this.underfoot(ctx, lane, w.x, w.y - 4, rx, t, alpha);
      const def = ENEMIES[w.id];
      this.drawCharacter(ctx, spriteIdFor('enemy', w.id), 'idle', t + w.phase, w.x, w.y, {
        alpha,
        guides: ui.guides,
        centered: true,
        tempo: def ? tempoOf(def) : 1,
      });
    }
  }

  /** Light on the water lanes: short ripples drifting toward the base, as the tide runs into the cave (still when
   *  motion is reduced). */
  private drawWater(ctx: CanvasRenderingContext2D, now: number, ui: RenderUi): void {
    const lanes = this.sim.waterLanes;
    if (!lanes.length) return;
    const span = FIELD_W + 1000;
    const drift = ui.reducedMotion ? 0 : now / 45;
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    for (const lane of lanes) {
      for (let i = 0; i < 22; i++) {
        const x = span - 60 - ((i * 397 + drift * (0.7 + (i % 3) * 0.2)) % span);
        const y = lane * TILE + 26 + ((i * 53) % (TILE - 52));
        ctx.globalAlpha = Math.max(0, 0.22 + 0.18 * Math.sin(now / 640 + i * 1.7));
        ctx.beginPath();
        ctx.moveTo(x - 15, y);
        ctx.quadraticCurveTo(x, y - 6, x + 15, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** What is under someone standing in a lane: a shadow on the ground, or ripples on the water. */
  private underfoot(ctx: CanvasRenderingContext2D, lane: number, x: number, y: number, rx: number, now: number, alpha = 1): void {
    if (this.sim.water[lane]) ripple(ctx, x, y, rx, now, alpha);
    else shadow(ctx, x, y, rx, alpha);
  }

  private drawHighlights(ctx: CanvasRenderingContext2D, ui: RenderUi, now: number): void {
    if (ui.selectedCard < 0 && !ui.sendingHome) return;
    const pulse = 0.5 + 0.5 * Math.sin(now / 180);
    for (let lane = 0; lane < LANES; lane++) {
      for (let col = 0; col < COLS; col++) {
        const hovered = ui.hover && ui.hover.lane === lane && ui.hover.col === col;
        const ok = ui.sendingHome ? !!this.sim.allyAt(lane, col) : ui.placeable(lane, col);
        if (!ok) continue;
        ctx.fillStyle = ui.sendingHome ? `rgba(240, 120, 110, ${hovered ? 0.4 : 0.18})` : `rgba(255,255,255,${hovered ? 0.5 : 0.2 + pulse * 0.12})`;
        roundRectPath(ctx, colLeft(col) + 8, lane * TILE + 8, TILE - 16, TILE - 16, 18);
        ctx.fill();
        if (hovered) {
          ctx.strokeStyle = ui.sendingHome ? 'rgba(220,90,80,0.9)' : 'rgba(255,255,255,0.95)';
          ctx.lineWidth = 5;
          ctx.stroke();
        }
      }
    }
  }

  /** The friend a card in hand would put down on the tile under the finger (or mouse), when it can go there: what the
   *  reach and speed-up previews are of. A phone's tap on a card and then a tile puts it down at once, so these show
   *  while a card is dragged, or under a mouse. */
  private placing(ui: RenderUi): { def: UnitDef; lane: number; col: number } | null {
    if (ui.selectedCard < 0 || ui.sendingHome || !ui.hover) return null;
    const card = this.sim.cards[ui.selectedCard];
    if (!card || !ui.placeable(ui.hover.lane, ui.hover.col)) return null;
    return { def: card.def, lane: ui.hover.lane, col: ui.hover.col };
  }

  /** While a card is in hand, what its friend would reach from the tile under the finger (owner's call, 2026-11-10), on
   *  the ground under everyone: a melee blow's tiles, ラッコ's sweep, モモンガ's three lanes or the lane パジャマパーティーズ'
   *  song speeds up, in gold with a running dashed edge; for フタバ and ヒトハ, the tiles beside it where the partner
   *  would stand, the edge alone. A shooter's reach is the whole lane ahead, as in PvZ, and shows nothing. */
  private drawReach(ctx: CanvasRenderingContext2D, ui: RenderUi, now: number): void {
    const p = this.placing(ui);
    if (!p) return;
    const glow = ui.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now / 260);
    ctx.save();
    ctx.lineWidth = 5;
    ctx.setLineDash([22, 14]);
    ctx.lineDashOffset = ui.reducedMotion ? 0 : -now / 40;
    ctx.strokeStyle = 'rgba(236, 160, 30, 0.9)';
    ctx.fillStyle = `rgba(255, 205, 80, ${0.2 + 0.08 * glow})`;
    for (const s of this.sim.reachFrom(p.def, p.lane, p.col)) {
      const x = colLeft(s.from) + 6;
      roundRectPath(ctx, x, s.lane * TILE + 6, colLeft(s.to) + TILE - 6 - x, TILE - 12, 22);
      if (s.kind !== 'partner') ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** A gold ring round the feet of every friend attacking faster (パジャマパーティーズ' song next to it, or its partner
   *  beside it), on the ground under everyone, so it never hides an enemy (owner's call, 2026-11-10: the song's reach
   *  showed nowhere). While a card is in hand, faintly, the rings putting it down would add, and one under its ghost if
   *  it would attack faster there itself. */
  private drawBoosts(ctx: CanvasRenderingContext2D, ui: RenderUi, now: number): void {
    const sim = this.sim;
    const pace = sim.tilePace();
    const live = new Set<number>();
    for (const a of sim.allies) {
      if (!sim.spedUp(a, pace)) continue;
      live.add(a.uid);
      const since = this.boostedAt.get(a.uid) ?? now;
      this.boostedAt.set(a.uid, since);
      const p = S(laneX(a.lane), allyFeetY(a.col));
      this.boostRing(ctx, p.x, p.y, ringRadius(allySprite(a), a.def), now, ui, 1, now - since);
    }
    for (const uid of this.boostedAt.keys()) if (!live.has(uid)) this.boostedAt.delete(uid);
    const pl = this.placing(ui);
    if (!pl) return;
    const { allies, self } = sim.boostsFrom(pl.def, pl.lane, pl.col);
    for (const a of allies) {
      if (live.has(a.uid)) continue;
      const p = S(laneX(a.lane), allyFeetY(a.col));
      this.boostRing(ctx, p.x, p.y, ringRadius(allySprite(a), a.def), now, ui, PREVIEW_ALPHA);
    }
    if (self) {
      const p = S(laneX(pl.lane), allyFeetY(pl.col));
      this.boostRing(ctx, p.x, p.y, ringRadius(ui.ghostSprite ?? spriteIdFor('ally', pl.def.id), pl.def), now, ui, PREVIEW_ALPHA);
    }
  }

  /** One speed-up ring on the ground round the feet at (x, y): a gold circle glowing on each beat of the song, with a
   *  note at each end and at its front hopping in turn to the beat (all of it still when motion is reduced). `since`:
   *  how long the friend has been attacking faster, so the ring pops in. */
  private boostRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, now: number, ui: RenderUi, alpha: number, since = Infinity): void {
    const calm = ui.reducedMotion;
    const beat = calm ? 0.6 : (1 - (now % SONG_BEAT_MS) / SONG_BEAT_MS) ** 2;
    const k = calm ? 1 : Math.min(1, since / RING_POP_MS);
    // Out a little past its size and back (an ease-out-back), the notes with it.
    const grow = 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;
    const rx = r * grow;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y - 4);
    ctx.save();
    ctx.scale(1, RING_FLAT);
    const g = ctx.createRadialGradient(0, 0, rx * 0.3, 0, 0, rx * 1.2);
    g.addColorStop(0, `rgba(255, 214, 96, ${0.45 + 0.3 * beat})`);
    g.addColorStop(1, 'rgba(255, 214, 96, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 1.2, 0, Math.PI * 2);
    ctx.fill();
    // The ring: a bright gold band on a deep gold edge (it shows on pale ground too), and a white line inside it like a
    // sticker's cut edge.
    const ring = (w: number, colour: string, at: number) => {
      ctx.lineWidth = w;
      ctx.strokeStyle = colour;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, at), 0, Math.PI * 2);
      ctx.stroke();
    };
    ring(14, 'rgba(206, 120, 10, 0.9)', rx);
    ring(7, 'rgb(255, 204, 64)', rx);
    ring(3.5, 'rgba(255, 253, 247, 0.95)', rx - 10);
    ctx.restore();
    RING_NOTES.forEach(({ n, at }, i) => {
      // Each hops on its own third of the beat, so they take turns.
      const hop = calm ? 0 : 16 * (1 - (((now + (i * SONG_BEAT_MS) / 3) % SONG_BEAT_MS) / SONG_BEAT_MS)) ** 3;
      this.drawSticker(ctx, `fx_note_${n}`, Math.cos(at) * rx, Math.sin(at) * rx * RING_FLAT - 16 - hop, { scale: 0.72 * grow });
    });
    ctx.restore();
  }

  /** How long after the blow a melee picture reaches field x (ms), its swing having been announced just before its hits.
   *  0 for any other hit. */
  private swingArrival(fx: string, x: number, now: number, ui: RenderUi): number {
    const s = this.swings[this.swings.length - 1];
    if (!s || s.fx !== fx || s.t0 !== now || ui.reducedMotion) return 0;
    const { from, to, outMs } = swingPath(s);
    return glideTime((x - from) / Math.max(1, to - from)) * outMs;
  }

  /** Whether an enemy shows its hit flash now (a melee blow's waits for its picture, see swingArrival). */
  private flashing(e: Enemy, now: number): boolean {
    const late = this.lateFlash.get(e.uid);
    if (late) {
      if (now < late.until) return now >= late.from;
      this.lateFlash.delete(e.uid);
    }
    return e.hitFlashUntil > this.sim.t;
  }

  /** A melee blow: its picture goes out from the friend to the end of the reach and fades there. On the ground, under
   *  everyone, so it shows how far the blow went without hiding who it hit. */
  private drawSwings(ctx: CanvasRenderingContext2D, now: number, ui: RenderUi): void {
    if (!this.swings.length) return;
    this.swings = this.swings.filter((s) => now - s.t0 < (s.fx === 'fx_sweep' ? SWEEP_MS : THRUST_MS));
    for (const s of this.swings) {
      const spec = stickerSpec(s.fx);
      if (!spec) continue;
      const t = now - s.t0;
      const { from, to, outMs } = swingPath(s);
      const e = ui.reducedMotion ? 1 : glide(t / outMs);
      const first = s.lanes[0];
      const last = s.lanes[s.lanes.length - 1];
      if (s.fx === 'fx_sweep') {
        // A crescent off the sword, growing as it flies to the far edge of the reach, as tall as the lanes it cuts.
        const w = spec.w * (0.75 + 0.25 * e);
        const h = ((last - first + 1) * TILE - 8) * (0.62 + 0.38 * e);
        const alpha = Math.min(1, t / SWEEP_IN_MS) * (t < SWEEP_OUT_MS ? 1 : 1 - (t - SWEEP_OUT_MS) / (SWEEP_MS - SWEEP_OUT_MS));
        this.drawSticker(ctx, s.fx, from + (to - from) * e - w / 2, ((first + last + 1) / 2) * TILE, { sx: w / spec.w, sy: h / spec.h, alpha });
      } else {
        // A stab down the lane: the point runs out to the end of the reach, and the tail follows it.
        const head = from + (to - from) * e;
        const start = from - THRUST_POINT_START;
        const tail = start + (to - 90 - start) * (ui.reducedMotion ? 0 : Math.max(0, Math.min(1, (t - THRUST_TAIL_AT) / THRUST_TAIL_MS)) ** 2);
        const alpha = Math.min(1, t / THRUST_IN_MS) * (t < THRUST_FADE_AT ? 1 : 1 - (t - THRUST_FADE_AT) / (THRUST_MS - THRUST_FADE_AT));
        this.drawSticker(ctx, s.fx, (head + tail) / 2, (first + 0.5) * TILE + 6, { sx: (head - tail) / spec.w, alpha });
      }
    }
  }

  private drawAlly(ctx: CanvasRenderingContext2D, a: Ally, x: number, y: number, now: number, ui: RenderUi): void {
    // Beaten or sent home, a friend is simply gone (owner's call, 2026-11-11: no fading away, as PvZ's plants go).
    if (a.state === 'collapse') return;
    if (a.wishUntil > 0) {
      this.drawWishStar(ctx, a, x, y, now, ui);
      return;
    }
    const id = spriteIdFor('ally', a.def.id, a.member ?? undefined);
    let anim = a.anim;
    let elapsed = now - a.animStart;
    if (a.def.wall) {
      // Damage states split HP evenly: 2 states → 66% / 33%, 3 states → 75% / 50% / 25%.
      const r = a.hp / a.maxHp;
      const motions = characterSpec(id)?.motions ?? [];
      const states = motions.filter((n) => n.startsWith('damaged'));
      let worn: string | null = null;
      for (let i = states.length; i >= 1; i--) {
        if (r <= 1 - i / (states.length + 1)) {
          worn = states[i - 1];
          break;
        }
      }
      // A wall that hits back throws its punch instead (none now: ポシェットの鎧さん did, until 2026-11-08).
      if (!(a.anim === 'attack' && motions.includes('attack'))) {
        anim = worn ?? 'idle';
        elapsed = now - a.placedAt;
      }
    }
    // たい焼き from its frames: its cook pictures are stages (raw to done). All but the last share out the cooking; the
    // last (done, with sparkles) shows a moment as it comes ready, and then it stands by on its idle.
    let at: number | undefined;
    const stages = a.def.mine ? spriteFor(id)?.anims.cook : undefined;
    if (a.def.mine && stages) {
      const left = a.readyAt - now;
      if (left > 0) {
        anim = 'cook';
        at = ((1 - left / a.def.mine.readyMs) * (stages.frames - 1)) / stages.frames;
      } else if (-left < COOKED_SPARKLE_MS) {
        anim = 'cook';
        at = 1;
      } else anim = 'idle';
    }
    const since = now - a.placedAt;
    const scale = since < 260 && !ui.reducedMotion ? 1 + 0.12 * Math.sin((since / 260) * Math.PI) : 1;
    this.underfoot(ctx, a.lane, x, y - 4, a.def.size === 'L' ? 70 : a.def.size === 'M' ? 54 : 44, now);
    const flash = a.hitFlashUntil > this.sim.t ? 1 : 0;
    const shakeX = flash && !ui.reducedMotion ? Math.sin(now / 18) * 3 : 0;
    // Held by 山姥's spell or caught by 擬態型's song: frozen in the frame it was caught in, in a spell circle, and purple
    // (the status colour: there are no badges).
    const held = a.spellUntil > this.sim.t || a.swayUntil > this.sim.t;
    if (held) {
      elapsed -= now - (this.heldAt.get(a.uid) ?? now);
      this.spellCircle(ctx, x, y, now, ui);
    }
    // A worn wall that the wall in hand could replace glows, as PvZ lights up a nut a Wall-nut can go on (owner's call,
    // 2026-11-10), so it shows on a phone too, where a tap puts the card down at once.
    const mend = a.def.wall && ui.selectedCard >= 0 && !ui.sendingHome && this.sim.replaces(ui.selectedCard, a.lane, a.col) === a;
    const glow = mend ? (ui.reducedMotion ? 0.35 : 0.22 + 0.24 * (0.5 + 0.5 * Math.sin(now / 180))) : 0;
    const box = this.drawCharacter(ctx, id, anim, elapsed, x + shakeX, y, { scale, flash: Math.max(flash * 0.5, glow), tint: held ? SPELL_TINT : null, guides: ui.guides, tempo: tempoOf(a.def), onceMs: anim === 'attack' ? ALLY_ATTACK_MS : undefined, at });
    if (!box) return;
    // パジャマパーティーズ let a note go now and then while they sing.
    if (a.anim === 'song' && !ui.reducedMotion && now - (this.singAt.get(a.uid) ?? -1e9) > SONG_BEAT_MS) {
      this.singAt.set(a.uid, now);
      this.notes.push({ x: x + (Math.random() - 0.5) * 50, y: box.y0 + 20, t0: now, v: noteKind() });
    }
  }

  /** The ring on the ground round a friend held by 山姥's spell: a purple circle of dashes, slowly turning. */
  private spellCircle(ctx: CanvasRenderingContext2D, x: number, y: number, now: number, ui: RenderUi): void {
    ctx.save();
    ctx.translate(x, y - 4);
    ctx.scale(1, 0.32);
    if (!ui.reducedMotion) ctx.rotate(now / 900);
    ctx.lineCap = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(146, 96, 214, 0.85)';
    ctx.setLineDash([26, 14]);
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(206, 178, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** 星 before its wish comes true: it stands on its tile as itself, like any friend, then casts, closing its eyes and
   *  going up in a puff, and the friend wished for takes its place behind it (see Sim.grantWish; drawWishPuffs shows the
   *  puff clearing). */
  private drawWishStar(ctx: CanvasRenderingContext2D, a: Ally, x: number, y: number, now: number, ui: RenderUi): void {
    const since = now - a.placedAt;
    const scale = since < 260 && !ui.reducedMotion ? 1 + 0.12 * Math.sin((since / 260) * Math.PI) : 1;
    this.underfoot(ctx, a.lane, x, y - 4, 44, now);
    const flash = a.hitFlashUntil > this.sim.t ? 1 : 0;
    const shakeX = flash && !ui.reducedMotion ? Math.sin(now / 18) * 3 : 0;
    // The change comes as its cast's last frame begins, the puff there to hide it.
    const frames = spriteFor(STAR_SPRITE)?.anims.attack?.frames ?? 1;
    const cast = (ONCE_MS.cast * (frames - 1)) / frames - (a.wishUntil - now);
    this.drawCharacter(ctx, STAR_SPRITE, cast < 0 ? 'idle' : 'cast', cast < 0 ? since : cast, x + shakeX, y, { scale, flash: flash * 0.5, guides: ui.guides });
  }

  /** The end of 星's cast, over whoever it has just become: its last frame, the puff clearing. */
  private drawWishPuffs(ctx: CanvasRenderingContext2D, now: number): void {
    this.wishPuffs = this.wishPuffs.filter((p) => now - p.t0 < WISH_PUFF_MS);
    for (const p of this.wishPuffs) this.drawCharacter(ctx, STAR_SPRITE, 'cast', ONCE_MS.cast, p.x, p.y, { alpha: Math.min(1, 2 * (1 - (now - p.t0) / WISH_PUFF_MS)) });
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, now: number, ui: RenderUi): void {
    if (e.state === 'gone') return;
    if (e.flight) {
      this.drawFlier(ctx, e, x, y, now, ui);
      return;
    }
    const id = spriteIdFor('enemy', e.def.id, e.form);
    // A giant's shadow spans its three lanes' worth, under its feet on the nearest.
    const groundLane = e.lane + e.half;
    let anim = e.anim;
    let elapsed = now - e.animStart;
    let alpha = 1;
    const slowed = e.slowUntil > this.sim.t;
    // 黒い星 heals for as long as it stops to (its heal frames play over the whole stop); stopped at a friend (it never
    // attacks) it stands at rest, and only drifts while it moves.
    const healMs = healPauseOf(e.def);
    if (e.def.id === 'kuroi_nagareboshi' && anim !== 'collapse') {
      const until = this.healUntil.get(e.uid) ?? 0;
      anim = until > now ? 'heal' : e.state === 'engaged' ? 'idle' : 'float';
      if (anim === 'heal') elapsed = now - (until - healMs);
    }
    // 山姥 chants her spell.
    if (e.state === 'spell' && anim !== 'collapse') anim = 'spell';
    // Slowed by ゴーヤ, everything it does takes twice as long (as in the sim).
    if (slowed) elapsed *= 0.5;
    if (e.state === 'collapse') {
      const since = now - e.collapseAt;
      elapsed = since;
      alpha = fadeOut(since, fallMsOf(e.def, e.form, e.boss));
      if (alpha <= 0) return;
    }
    const size = e.form === 'true' ? 'XL' : e.def.size;
    // The shadow lies under the body (a long one's trails behind its front) and spans it.
    const sprite = spriteFor(id);
    const foot = sprite ? spriteFootprint(sprite, spriteScale(sprite)) : { dx: 0, rx: 0 };
    this.underfoot(ctx, groundLane, x + foot.dx, y - 4, Math.max(foot.rx, e.half ? 190 : size === 'XL' ? 110 : size === 'L' ? 80 : size === 'M' ? 58 : 44), now, alpha);
    const flash = this.flashing(e, now) ? 1 : 0;
    const tempo = tempoOf(e.def, e.form);
    // A mode with a length (a goblin picking up 草, 六足の虫's jump) plays its frames once over it.
    const modeMs = Math.max(1, e.stateUntil - e.animStart);
    // 六足の虫's jump, in parts: getting ready, in the air (its frames are drawn on the spot, so it is lifted over in an
    // arc, its shadow staying down) and landing; its frames are shared out over the parts.
    const jump = e.state === 'jump' ? e.def.abilities.find((a) => a.kind === 'jump') : undefined;
    const part = jump ? jumpAt(jump, ((now - e.animStart) / modeMs) * jumpMsOf(jump)) : null;
    const hop = part?.phase === 'air' ? jumpHop(part.k) : 0;
    this.drawCharacter(ctx, id, anim, elapsed, x, y - hop, {
      alpha,
      flash,
      tint: e.frozenUntil > this.sim.t && e.state !== 'collapse' ? ICE_TINT : slowed ? SLOW_TINT : null,
      guides: ui.guides,
      tempo,
      // Walking faster (キメラ with her claws out, a mermaid rallied by セイレーン), it steps quicker too: by the square
      // root of the speed-up, as the speed tiers' walk frames do.
      walkMs: (WALK_FRAME_MS[e.def.speed] * tempo) / Math.sqrt(this.sim.walkMulOf(e)),
      // Each move's frames play over its mode: a swing, a fall, a heal, a pick-up, キメラ drawing her claws, one called
      // up by セイレーン coming up (a jump goes by its parts; ちゅーしです eyeing a friend holds its swing's first frame;
      // セイレーン's song as she calls loops).
      at: part ? jumpFrameAt(part.phase, part.k) : e.state === 'aim' ? 0 : undefined,
      onceMs:
        anim === 'attack'
          ? swingOf(e.def, e.form, attackIntervalOf(e)).swingMs
          : anim === 'collapse'
            ? deathMsOf(e.def, e.form, e.boss)
            : anim === 'heal' && healMs
              ? healMs
              : (anim === 'steal' && e.state === 'steal') || (anim === 'claws' && e.state === 'claws') || (anim === 'spawn' && e.state === 'spawn')
                ? modeMs
                : undefined,
    });
  }

  /** Whoever でかい鳥 has stopped over or holds. */
  private flierPrey(e: Enemy): FlierPrey | null {
    const f = e.flight;
    const uid = !f ? -1 : f.carry >= 0 ? f.carry : e.state === 'hover' || e.state === 'attack' ? f.target : -1;
    const ally = uid >= 0 ? this.sim.allyByUid(uid) : undefined;
    if (!ally) return null;
    const sprite = ally.wishUntil ? STAR_SPRITE : spriteIdFor('ally', ally.def.id, ally.member ?? undefined);
    const layout = spriteFor(sprite);
    const rest = layout && frameOf(layout, 'idle', 0);
    if (!layout || !rest) return null;
    return { ally, sprite, tall: -spriteBox(rest, 0, 0, spriteScale(layout)).y0 };
  }

  /** Where でかい鳥 hangs in the air (`h`, field px above its lane) and how far along it has moved (`reach`) so its closing
   *  talons come down on the head of whoever it is after; `calm` is how much of its bob it has settled out of; `flip`,
   *  that it has turned round to fly back out (owner's call, 2026-11-09: its drawings all face the base). */
  private flierPose(e: Enemy, now: number): { h: number; reach: number; calm: number; flip: boolean; prey: FlierPrey | null } {
    const prey = this.flierPrey(e);
    const flip = !!e.flight?.out;
    if (!prey) return { h: e.state === 'attack' ? FLY_GRAB : FLY_LOW, reach: 0, calm: 0, flip, prey };
    const layout = spriteFor(spriteIdFor('enemy', e.def.id, e.form));
    const unit = layout ? spriteScale(layout) : 1;
    // At this height the claws, as they close, have the friend's head in them with its feet still on the ground.
    const grab = prey.tall - TALON_GRIP + TALONS_CLOSED[1] * unit;
    // Over where the friend stands, which is under its head: what it holds out to one side is not.
    const reach = -TALONS_CLOSED[0] * unit;
    const smooth = (k: number): number => {
      const c = Math.max(0, Math.min(1, k));
      return c * c * (3 - 2 * c);
    };
    if (e.flight!.carry >= 0) {
      const lift = smooth((now - prey.ally.animStart) / CARRY_LIFT_MS);
      // It turns round about its claws, so whoever it holds does not jump sideways when it does.
      const turn = flip ? (GRAB_TALONS[GRAB_TALONS.length - 1][0] + FLY_TALONS[0]) * unit : 0;
      return { h: grab + CARRY_LIFT * lift, reach: reach + turn, calm: 1 - lift, flip, prey };
    }
    if (e.state === 'attack') return { h: grab + FLY_SWOOP * (1 - smooth((now - e.animStart) / swingOf(e.def).hitMs)), reach, calm: 1, flip, prey };
    const ab = e.def.abilities.find((a) => a.kind === 'flier');
    const hoverMs = ab && ab.kind === 'flier' ? ab.hoverMs : 2500;
    const rise = smooth(1 - (e.stateUntil - now) / hoverMs);
    return { h: FLY_LOW + (grab + FLY_SWOOP - FLY_LOW) * rise, reach: reach * rise, calm: rise * rise * rise, flip, prey };
  }

  /** でかい鳥 flies low over its lane, its shadow right under it, so it is plain which lane it is in (flying high, it
   *  looked to be in the lane above). Over the friend it is after it rises as it hovers, then swoops and closes its
   *  talons on the friend's head; whoever it carries hangs from them as it flies off. Shot down, it falls. */
  private drawFlier(ctx: CanvasRenderingContext2D, e: Enemy, x0: number, y: number, now: number, ui: RenderUi): void {
    const id = spriteIdFor('enemy', e.def.id, e.form);
    const pose = this.flierPose(e, now);
    const x = x0 + pose.reach;
    const dir = pose.flip ? -1 : 1;
    const carried = e.flight && e.flight.carry >= 0 ? pose.prey : null;
    let alpha = 1;
    let h = pose.h + (ui.reducedMotion ? 0 : Math.sin(now / 260 + e.uid) * 8 * (1 - pose.calm));
    if (e.state === 'collapse') {
      const since = now - e.collapseAt;
      h *= Math.max(0, 1 - since / COLLAPSE_MS);
      alpha = fadeOut(since, fallMsOf(e.def));
      if (alpha <= 0) return;
    }
    // Its shadow, under its body and as wide: dark while it flies low, smaller and paler as it rises.
    const sprite = spriteFor(id);
    const foot = sprite ? spriteFootprint(sprite, spriteScale(sprite), true) : { dx: 0, rx: 0 };
    const high = Math.max(0, Math.min(1, (h - FLY_LOW) / (FLY_GRAB - FLY_LOW)));
    shadow(ctx, x + foot.dx * dir, y - 4, Math.max(58, foot.rx) * (1 - 0.25 * high), alpha * (2.2 - 0.9 * high));
    const slowed = e.slowUntil > this.sim.t;
    let anim = e.state === 'collapse' ? 'collapse' : e.anim;
    const elapsed = e.state === 'collapse' ? now - e.collapseAt : now - e.animStart;
    // The grab plays once and the bird flies on, flapping, with whoever it carries.
    const swingMs = swingOf(e.def).swingMs;
    if (anim === 'attack' && elapsed > swingMs) anim = 'float';
    // Whoever it holds hangs from its claws wherever this frame has them, behind them, so they close over the head. Not
    // breathing: held like that, a head rising and falling slips in the talons.
    if (carried && sprite) {
      const f = spriteFrame(sprite, anim, elapsed, { tempo: tempoOf(e.def), onceMs: anim === 'attack' ? swingMs : undefined, still: this.calm });
      const [tx, ty] = f?.motion === 'attack' ? GRAB_TALONS[Math.min(f.i, GRAB_TALONS.length - 1)] : FLY_TALONS;
      const unit = spriteScale(sprite);
      this.drawCharacter(ctx, carried.sprite, 'idle', 0, x + tx * unit * dir, y - h + ty * unit - TALON_GRIP + carried.tall, { guides: ui.guides });
    }
    const flash = this.flashing(e, now) ? 1 : 0;
    this.drawCharacter(ctx, id, anim, elapsed, x, y - h, {
      alpha,
      flash,
      tint: slowed ? SLOW_TINT : null,
      guides: ui.guides,
      centered: true,
      tempo: tempoOf(e.def),
      onceMs: anim === 'attack' ? swingMs : undefined,
      flip: pose.flip,
    });
  }

  /** オデ's charge: he runs the length of his lane from the base end (his front is the sweep's point; he is drawn just
   *  behind it), kicking up dust as he goes. */
  private drawSweeps(ctx: CanvasRenderingContext2D, alpha: number, now: number, ui: RenderUi): void {
    for (const s of this.sim.sweeps) {
      if (s.dead) continue;
      const y = s.prevY + (s.y - s.prevY) * alpha;
      const p = S(laneX(s.lane), y);
      const x = p.x - 40;
      if (!ui.reducedMotion && now - (this.dustAt.get(s.uid) ?? -1e9) > 120) {
        this.dustAt.set(s.uid, now);
        this.addFx('fx_dust', x - 60, p.y - 8, now, 320, 0.45);
      }
      this.underfoot(ctx, s.lane, x, p.y - 4, 70, now);
      this.drawCharacter(ctx, spriteIdFor('ally', s.source), 'walk', now - s.startedAt, x, p.y, { guides: ui.guides, walkMs: 70 });
    }
  }

  /** むちゃうマン on his tile: he pops up, strikes his pose and holds it while everyone freezes, then fades away. */
  private drawCameos(ctx: CanvasRenderingContext2D, now: number, ui: RenderUi): void {
    for (const c of this.sim.cameos) {
      const since = now - c.startedAt;
      const alpha = now < c.leavesAt ? 1 : Math.max(0, 1 - (now - c.leavesAt) / FADE_MS);
      if (alpha <= 0) continue;
      const p = S(laneX(c.lane), allyFeetY(c.col));
      const pop = since < 260 && !ui.reducedMotion ? 0.7 + 0.3 * Math.sin(((since / 260) * Math.PI) / 2) : 1;
      this.underfoot(ctx, c.lane, p.x, p.y - 4, 54, now, alpha);
      this.drawCharacter(ctx, spriteIdFor('ally', c.def.id), 'pose', since, p.x, p.y, { alpha, scale: pop, guides: ui.guides });
    }
  }

  /** As むちゃうマン's freeze strikes, the whole field flashes a pale icy blue for a moment (not when motion is
   *  reduced). */
  private drawFreezeFlash(ctx: CanvasRenderingContext2D, now: number, ui: RenderUi): void {
    const k = (now - this.freezeAt) / FREEZE_FLASH_MS;
    if (k < 0 || k >= 1 || ui.reducedMotion) return;
    ctx.save();
    ctx.globalAlpha = 0.3 * (1 - k) * (1 - k);
    ctx.fillStyle = '#D8F4FF';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.restore();
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D, alpha: number, now: number): void {
    for (const p of this.sim.projectiles) {
      if (p.dead) continue;
      if (p.drop) {
        // A missile falling out of the sky onto its spot, faster and faster, its shadow on the ground growing as it
        // comes.
        const k = (now - p.drop.t0) / p.drop.dur;
        if (k < 0) continue;
        const kk = Math.min(1, k);
        const g = S(p.x, p.drop.yT);
        shadow(ctx, g.x, g.y, 10 + 20 * kk, 0.3 + 0.5 * kk);
        this.drawSticker(ctx, this.shotPicture(p), g.x, g.y - PROJECTILE_HEIGHT * 0.6 - MISSILE_DROP * (1 - kk * kk));
        continue;
      }
      const travel = p.prevY + (p.y - p.prevY) * alpha;
      const ground = S(p.x, travel);
      let drawY = ground.y - PROJECTILE_HEIGHT;
      if (p.lob) {
        const k = Math.min(1, (now - p.lob.t0) / p.lob.dur);
        drawY -= 4 * p.lob.height * k * (1 - k);
        shadow(ctx, ground.x, ground.y, 16, 0.8);
      }
      const age = now - p.bornAt;
      const spin = p.fx === 'fx_can' || p.fx === 'fx_goya' || p.fx === 'fx_conch' || p.fx === 'fx_book' ? age / 80 : 0;
      const pulse = p.fx === 'fx_blast' || p.fx === 'fx_flame' ? 1 + 0.08 * Math.sin(age / 40) : 1;
      this.drawSticker(ctx, this.shotPicture(p), ground.x, drawY, { rot: spin, scale: pulse });
    }
  }

  private drawFxLayer(ctx: CanvasRenderingContext2D, now: number): void {
    this.fx = this.fx.filter((f) => now - f.t0 < f.dur);
    for (const f of this.fx) {
      if (now < f.t0) continue;
      const k = (now - f.t0) / f.dur;
      const base = f.scale ?? 1;
      const frames = FX_FRAMES[f.sprite];
      if (frames) {
        const at = Math.min(frames.length - 1, Math.floor(k * frames.length));
        const fade = at === frames.length - 1 ? 1 - (k * frames.length - at) : 1;
        this.drawSticker(ctx, frames[at], f.x, f.y, { scale: base, alpha: fade });
      } else if (FX_MOTION[f.sprite] === 'rise') {
        // Upright: it pops in, rises a little with its light, and fades.
        const pop = Math.min(1, k / 0.18);
        const fade = k < 0.12 ? k / 0.12 : k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
        this.drawSticker(ctx, f.pic, f.x, f.y - k * 26 * base, { scale: base * (0.84 + 0.16 * pop), alpha: fade });
      } else if (FX_MOTION[f.sprite] === 'burst') {
        this.drawSticker(ctx, f.pic, f.x, f.y - k * 10, { scale: base * (0.55 + 0.75 * Math.sqrt(k)), alpha: 1 - k * k, rot: f.spin * 0.3 });
      } else {
        const pop = k < 0.35 ? 0.6 + (0.55 * k) / 0.35 : 1.15 - 0.15 * Math.min(1, (k - 0.35) / 0.3);
        this.drawSticker(ctx, f.pic, f.x, f.y, { scale: base * pop, alpha: k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5, rot: f.spin });
      }
    }
    this.notes = this.notes.filter((n) => now - n.t0 < 1600);
    for (const n of this.notes) {
      if (now < n.t0) continue;
      const k = (now - n.t0) / 1600;
      this.drawSticker(ctx, `fx_note_${n.v}`, n.x + Math.sin(k * 6) * 14, n.y - k * 220, { alpha: 1 - k, rot: Math.sin(k * 8) * 0.25 });
    }
  }

  /** The weeds on the field. Paper like everyone else there: solid, standing on a soft shadow (owner's call, 2026-11-09). */
  private drawPickups(ctx: CanvasRenderingContext2D, now: number): void {
    // A little dust at its feet, `k` (0–1) of the way through.
    const puff = (x: number, y: number, k: number, size: number): void => this.drawSticker(ctx, 'fx_dust', x, y - 10 - k * 14, { scale: size + 0.2 * k, alpha: 1 - k });
    for (const p of this.sim.pickups) {
      // What ちいかわ finds is drawn in her hand on her frames, and goes straight to the counter.
      if (p.state === 'gone' || p.kind === 'drop') continue;
      const at = S(p.x, p.y);
      if (p.state === 'pulled') {
        // Tugged out of the ground. After that it is in the air, on the page (see weedFlight.ts), and only its dust is left.
        if (this.calm) continue;
        const t = now - p.stateAt;
        if (t < WEED_PUFF_MS) puff(at.x, at.y, t / WEED_PUFF_MS, 0.45);
        if (t < WEED_TUG_MS) {
          const k = t / WEED_TUG_MS;
          const pull = Math.sin((k * Math.PI) / 2);
          this.drawSticker(ctx, 'pickup_drop', at.x, at.y - k * WEED_TUG_LIFT, { sx: 1 - 0.12 * pull, sy: 1 + 0.2 * pull });
        }
        continue;
      }
      if (p.state === 'wilt') {
        // It droops and sinks into the ground.
        const k = Math.min(1, (now - p.stateAt) / WEED_WILT_MS);
        this.drawSticker(ctx, 'pickup_drop', at.x, at.y, { sx: 1 - 0.4 * k, sy: Math.max(0.02, 1 - k), rot: 0.3 * k });
        continue;
      }
      // Growing or grown: it pops out of the ground, then settles into breathing and swaying, each weed in its own time.
      const since = now - p.bornAt;
      const pop = this.calm || since >= WEED_POP_MS ? 1 : popOut(since / WEED_POP_MS);
      const settled = this.calm ? 0 : Math.min(1, Math.max(0, since - WEED_POP_MS) / WEED_SETTLE_MS);
      const phase = p.uid * 1.7;
      const breath = settled * Math.sin(now / 420 + phase);
      let rot = settled * 0.06 * Math.sin(now / 620 + phase);
      let droop = 1;
      // About to wilt: it droops further and further, and shivers.
      const left = (p.expiresAt - now) / WEED_WARN_MS;
      if (left < 1 && p.claimedBy < 0) {
        const d = 1 - Math.max(0, left);
        rot = d * 0.2 + (this.calm ? 0 : 0.05 * Math.sin(now / 55));
        droop = 1 - d * 0.16;
      }
      this.underfoot(ctx, p.lane, at.x, at.y - 2, 40 * Math.min(1, pop), now, Math.min(1, since / 200));
      if (!this.calm && since < WEED_POP_MS) puff(at.x, at.y, since / WEED_POP_MS, 0.4);
      this.drawSticker(ctx, 'pickup_drop', at.x, at.y, { sx: pop * (1 - 0.025 * breath), sy: pop * (1 + 0.04 * breath) * droop, rot });
    }
  }

  /** Rakko waits at the end of every lane: in the car, or in his boat on a water lane. Before a battle he drives in, one
   *  lane after another (see setCars). */
  private drawParkedCars(ctx: CanvasRenderingContext2D, now: number, ui: RenderUi): void {
    if (this.carsAt === 'away') return;
    const since = this.carsAt === null ? Infinity : performance.now() - this.carsAt;
    this.sim.rescues.forEach((r, i) => {
      if (r.state !== 'parked') return;
      const y = r.lane * TILE + LANE_FEET;
      const behind = carBehind(i, since);
      if (behind > 0) {
        const under = since - i * CAR_STAGGER_MS;
        if (under > 0) this.drawUnderWay(ctx, r, PARKED_X - behind, y, under, now, ui, Math.min(1, behind / 120));
        return;
      }
      this.underfoot(ctx, r.lane, PARKED_X, y - 4, 66, now);
      this.drawCharacter(ctx, r.boat ? 'rescue_rakko_boat' : 'rescue_rakko_car', 'parked', now, PARKED_X, y, { guides: ui.guides });
    });
  }

  private drawDrivingCars(ctx: CanvasRenderingContext2D, now: number, ui: RenderUi): void {
    for (const r of this.sim.rescues) {
      if (r.state !== 'driving') continue;
      // r.y is the car's front bumper; the car is centred 70 px behind it.
      this.drawUnderWay(ctx, r, screenX(r.y) - 70, r.lane * TILE + LANE_FEET, now - r.startedAt, now, ui);
    }
  }

  /** Rakko under way: the boat's wake or the car's dust behind him, then the vehicle. (x, y): the point it stands on;
   *  `since`: ms since he set off; `trail`: how much of his trail is left (it dies away as he comes to a stop). */
  private drawUnderWay(ctx: CanvasRenderingContext2D, r: Rescue, x: number, y: number, since: number, now: number, ui: RenderUi, trail = 1): void {
    if (r.boat) {
      // The boat's wake: ripples spreading behind it.
      const t = since % 340;
      for (let i = 0; i < 3; i++) ripple(ctx, x - 70 - i * 46, y - 4, 30 + i * 10 + t / 34, now, 0.75 * (1 - i / 3) * trail);
    }
    const vehicle = r.boat ? 'rescue_rakko_boat' : 'rescue_rakko_car';
    this.underfoot(ctx, r.lane, x, y - 4, 66, now);
    this.drawTrail(ctx, vehicle, x, y, since, trail);
    this.drawCharacter(ctx, vehicle, 'drive', since, x, y, { guides: ui.guides });
  }

  /** The trail of dust (behind the boat, smoke and spray) Rakko leaves as he drives: the trail picture on the ground,
   *  its big cloud tucked in under the back of the car or the boat (which is drawn over it). It stretches out as he
   *  sets off and puffs a little as he goes. (x, y): the point the vehicle stands on; `since`: ms since he set off;
   *  `left`: how much of it is left as he comes to a stop (1 = all of it). */
  private drawTrail(ctx: CanvasRenderingContext2D, vehicle: string, x: number, y: number, since: number, left = 1): void {
    const spec = stickerSpec('fx_trail');
    const sprite = spriteFor(vehicle);
    const idle = sprite?.anims.idle;
    if (!spec || !sprite || !idle) return;
    // The vehicle's back: its picture's left edge (the boat's runs on past its motor), behind the point it stands on.
    const back = (idle.boxes[0][0] - idle.ax) * spriteScale(sprite);
    const phase = (since / 340) * Math.PI * 2;
    const sx = (0.3 + 0.7 * Math.min(1, since / 260)) * (1 + 0.05 * Math.sin(phase)) * (0.4 + 0.6 * left);
    const sy = 1 + 0.07 * Math.sin(phase + 1.2);
    const k = TRAIL_SCALE;
    // Stretched about its right end, and standing on the foot of its puffs.
    this.drawSticker(ctx, 'fx_trail', x + back + TRAIL_TUCK - (spec.w / 2) * k * sx, y + 2 - TRAIL_FOOT * k * sy, { scale: k, sx, sy, alpha: 0.92 * left });
  }

  private drawGhost(ctx: CanvasRenderingContext2D, ui: RenderUi, now: number): void {
    if (!ui.hover || !ui.ghostSprite || ui.selectedCard < 0) return;
    if (!ui.placeable(ui.hover.lane, ui.hover.col)) return;
    const p = S(laneX(ui.hover.lane), allyFeetY(ui.hover.col));
    this.drawCharacter(ctx, ui.ghostSprite, 'idle', now, p.x, p.y, { alpha: 0.5 });
  }

}


// ---------------------------------------------------------------- small helpers

/** Where a melee picture's leading edge starts and ends on the field, and how long it takes to get there. */
function swingPath(s: Swing): { from: number; to: number; outMs: number } {
  const body = colLeft(s.col) + TILE / 2;
  const to = colLeft(s.lastCol) + TILE;
  if (s.fx === 'fx_sweep') return { from: Math.min(to, body + (stickerSpec(s.fx)?.w ?? 0)), to, outMs: SWEEP_OUT_MS };
  return { from: body + THRUST_FROM + THRUST_POINT_START, to, outMs: THRUST_OUT_MS };
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = 0.16 * alpha;
  ctx.fillStyle = '#2B2420';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Where someone floats or swims: a dark ring of water and a white ripple along its front edge, in place of the
 *  shadow a body throws on the ground. `t` breathes the ripple in and out. */
function ripple(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, t: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = 0.24 * alpha;
  ctx.fillStyle = '#2F5677';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  const r = rx + 6 + Math.sin(t / 380) * 4;
  ctx.globalAlpha = 0.8 * alpha;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.24, 0, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();
  ctx.restore();
}

/** Every picture a battle in this world, on these lanes and with this cast, draws, for loading before it starts. */
export function battleArtKeys(world: number, lanes: readonly number[], characterIds: string[]): string[] {
  const keys = new Set<string>();
  const sc = resolveScene(worldScene(world, lanes));
  for (const l of sc.layers) keys.add(`scenes/${sc.id}/${l.id}`);
  for (const id of characterIds) {
    const sprite = spriteFor(id);
    if (sprite) for (const k of spriteKeys(sprite)) keys.add(k);
  }
  for (const s of STICKERS) keys.add(`stickers/${s.id}`);
  // 星 (any team may wish with it): its frames are few and small.
  const star = spriteFor(STAR_SPRITE);
  if (star) for (const k of spriteKeys(star)) keys.add(k);
  return [...keys];
}
