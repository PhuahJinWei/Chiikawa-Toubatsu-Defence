// Battle characters drawn from frames: the owner's sprite animations (art/sprites/<character id>/, brought in with
// npm run art:sprites). A character is drawn from them wherever it shows (the field, the road, the gallery, the art
// kit), with the same white cut edge and shadow as every other sticker. Rakko's car and boat are drawn the same way,
// from one picture each.

import { FIELD_LOOK } from './paper';
import { sizeSpec, SPRITE_LOOP_MS, TIER_HEIGHT } from './spec';
import type { StickerCache } from './sticker';

/** The frames a character can have. */
export type SpriteMotion = 'idle' | 'walk' | 'attack' | 'death' | 'ability' | 'transform' | 'spawn' | 'cook' | 'weed_search' | 'weed_found';

/** One motion's frames, all cut to one box. */
export interface SpriteAnimLayout {
  frames: number;
  /** The box's size (source pixels). */
  w: number;
  h: number;
  /** Where the feet are in it: the point standing on the ground. */
  ax: number;
  ay: number;
  /** Each frame's visible box in it: x, y, w, h. */
  boxes: [number, number, number, number][];
}

/** art/sprites/<id>/sprite.json, written by the importer. */
export interface SpriteLayout {
  kind: 'sprite';
  id: string;
  /** How tall the character stands in its idle frames, feet to top (source pixels): the game scales this to its
   *  size on the field. */
  height: number;
  anims: Partial<Record<SpriteMotion, SpriteAnimLayout>>;
  /** Where the frames came from. */
  from?: string;
}

const LAYOUTS = import.meta.glob('/art/sprites/*/sprite.json', { eager: true, import: 'default' }) as Record<string, SpriteLayout>;

/** A character's frames, if it has been delivered as a sprite. */
export function spriteFor(id: string): SpriteLayout | undefined {
  const l = LAYOUTS[`/art/sprites/${id}/sprite.json`];
  return l?.kind === 'sprite' ? l : undefined;
}

/** Every character delivered as a sprite. */
export function spriteIds(): string[] {
  return Object.values(LAYOUTS)
    .filter((l) => l?.kind === 'sprite')
    .map((l) => l.id);
}

const frameKey = (id: string, motion: SpriteMotion, i: number) => `sprites/${id}/${motion}_${i + 1}`;

/** Every picture file of a sprite, for loading (the battle needs them all). */
export function spriteKeys(s: SpriteLayout): string[] {
  const out: string[] = [];
  for (const [motion, a] of Object.entries(s.anims) as [SpriteMotion, SpriteAnimLayout][]) for (let i = 0; i < a.frames; i++) out.push(frameKey(s.id, motion, i));
  return out;
}

/** The picture files of the frames one of the game's motions plays (see PLAYS), for a preview that shows one motion
 *  at a time: a gallery page need not wait for every frame of every motion. */
export function motionKeys(s: SpriteLayout, anim: string): string[] {
  const motion = motionFor(s, anim);
  const a = motion && s.anims[motion];
  return a ? Array.from({ length: a.frames }, (_, i) => frameKey(s.id, motion, i)) : [];
}

/** Which frames each of the game's motions plays, best first: a flier's or a floater's travel is its walk, 黒い星's
 *  heal its ♪ frames, 山姥's spell her chant, a fall the death frames. */
const PLAYS: Record<string, SpriteMotion[]> = {
  idle: ['idle', 'walk'],
  walk: ['walk', 'idle'],
  float: ['walk', 'idle'],
  attack: ['attack', 'idle'],
  heal: ['ability', 'attack', 'idle'],
  song: ['ability', 'idle'],
  spell: ['ability', 'idle'],
  collapse: ['death', 'idle'],
  transform: ['transform', 'idle'],
  // ちいかわ pulling up a weed beside her: her found frames (searching and finding go by their own names).
  pull: ['weed_found', 'ability', 'attack', 'idle'],
  // むちゃうマン's pose: his ability frames, once, the last one held.
  pose: ['ability', 'idle'],
  // ちゅーしです eyeing a friend before it lunges: its swing's first frame, held (the caller asks for it with `at`).
  aim: ['attack', 'idle'],
  // 六足の虫's jump and a goblin picking up 草: their special moves, once over the move.
  jump: ['ability', 'walk', 'idle'],
  steal: ['ability', 'idle'],
  // キメラ drawing her claws: her clawed form's ability frames, once over the move (standing by until it has some).
  claws: ['ability', 'idle'],
  // One called up by セイレーン coming up: its spawn frames, once over the move (人魚 has none: it stands by).
  spawn: ['spawn', 'idle'],
  // A taiyaki cooking, until it is ready (then it stands by: its idle).
  cook: ['cook', 'idle'],
  // 星 granting its wish: its attack frames, once (it never attacks).
  cast: ['attack', 'idle'],
};

/** How long each frame of a looping motion shows for a small character (ms); bigger ones take longer by their tempo
 *  (game/sim/tempo.ts). A walk's comes from how fast its walker is. A loop with a set length (SPRITE_LOOP_MS:
 *  パジャマパーティーズ' dance) shares that out among its frames instead. */
const LOOP_MS: Partial<Record<SpriteMotion, number>> = { idle: 260, walk: 150, ability: 170, cook: 700 };
/** A character stands by on one picture, the first of its idle frames, and the game makes it breathe (owner's call,
 *  2026-11-08: most four-frame idles were one drawing stretched anyway). A small character's breath (ms), as long as
 *  those four frames took; bigger ones take longer by their tempo. */
export const BREATH_MS = 1040;
/** How much taller it stands at the top of a breath. */
export const BREATH_RISE = 0.02;
/** What breathes: one picture standing by, an idle or a wall's wear. */
const breathes = (motion: string, a: SpriteAnimLayout) => a.frames === 1 && (motion === 'idle' || motion.startsWith('damaged'));
/** Rakko's car and boat are machines: parked or driving, their one picture holds still. */
const MACHINE: Record<string, true> = { parked: true, drive: true };
/** A small walker's walk frame by speed (ms): slow, normal and fast walkers. */
export const WALK_FRAME_MS = { slow: 190, normal: 150, fast: 110 } as const;
/** How high 六足の虫 jumps over a friend (field px). Its jump frames are drawn on the spot, so the game lifts it
 *  (and carries it forward); its shadow stays on the ground. */
export const JUMP_ARC = 120;
/** How high the jumper is `k` of the way through its time in the air (up and down in one arc). */
export function jumpHop(k: number): number {
  return JUMP_ARC * Math.sin(Math.PI * Math.min(1, Math.max(0, k)));
}
/** Which of 六足の虫's jump frames shows in each part of its jump, as a share of them (spriteFrame's `at`): the first
 *  crouches ready, the next three take off, fly and reach down, the last two land and steady it (the owner's six
 *  frames; another count shares out the same way). */
export function jumpFrameAt(phase: 'ready' | 'air' | 'land', k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return phase === 'ready' ? c / 6 : phase === 'air' ? (1 + 3 * c) / 6 : (4 + 2 * c) / 6;
}
/** How long a small character's one-off motions take (ms), each then holding its last frame: a swing (an enemy's own,
 *  from the sim, when the caller gives it), a fall (inside the fade; bigger ones slower), ちいかぶ's transform its
 *  1.5 s, a heal (黒い星's stop, which the caller gives from its data: see healPauseOf) its own (the sim's, whatever
 *  the size), 星's cast all of its frames (the friend wished for takes its place as the last one begins). */
export const ONCE_MS: Record<string, number> = { attack: 640, collapse: 560, transform: 1500, heal: 600, pull: 640, weed_found: 640, pose: 750, cast: 600 };
/** One-off motions that take longer for bigger characters. */
const SLOWS: Record<string, true> = { attack: true, collapse: true };

/** The frame to show. */
export interface SpriteFrame {
  motion: SpriteMotion;
  /** Frame index, from 0. */
  i: number;
  a: SpriteAnimLayout;
  key: string;
  /** How tall it stands against its picture just now, its feet where they are: 1 as drawn, more as it breathes in. */
  sy: number;
}

/** One particular frame, as drawn. */
export function frameOf(s: SpriteLayout, motion: SpriteMotion, i: number): SpriteFrame | null {
  const a = s.anims[motion];
  return a && i >= 0 && i < a.frames ? { motion, i, a, key: frameKey(s.id, motion, i), sy: 1 } : null;
}

/** The frame at the top of its breath, if it breathes: the furthest it reaches. */
export function fullBreath(f: SpriteFrame): SpriteFrame {
  return breathes(f.motion, f.a) ? { ...f, sy: 1 + BREATH_RISE } : f;
}

/** The frames one of the game's motions plays on a sprite (see PLAYS), if it has any that fit. */
export function motionFor(s: SpriteLayout, anim: string): SpriteMotion | undefined {
  return (PLAYS[anim] ?? [anim as SpriteMotion, 'idle']).find((m) => s.anims[m]);
}

/** The frame a motion shows `t` ms after it began. A motion played once holds its last frame; the rest loop. `tempo`
 *  slows everything for a bigger character; `walkMs` is its walk frame (by speed and size), `onceMs` how long its
 *  one-off motion lasts when the sim times it (an enemy's swing); `still` holds a breather as drawn (reduced motion). */
export function spriteFrame(s: SpriteLayout, anim: string, t: number, o: { walkMs?: number; onceMs?: number; tempo?: number; at?: number; still?: boolean } = {}): SpriteFrame | null {
  const motion = motionFor(s, anim);
  if (!motion) return null;
  const a = s.anims[motion]!;
  const tempo = o.tempo ?? 1;
  const once = o.onceMs ?? (ONCE_MS[anim] !== undefined ? ONCE_MS[anim] * (SLOWS[anim] ? tempo : 1) : undefined);
  const tt = Math.max(0, t);
  let i: number;
  // A walk loops at the walker's pace; the other loops by their own.
  const walking = motion === 'walk';
  // `at`: a move the caller times in parts (六足の虫's jump) says how far through its frames to show (0–1).
  if (o.at !== undefined && motion !== 'idle' && !walking) i = Math.min(a.frames - 1, Math.max(0, Math.floor(o.at * a.frames)));
  else if (once !== undefined && motion !== 'idle' && !walking) i = Math.min(a.frames - 1, Math.floor((tt / once) * a.frames));
  else {
    // A loop with a set length lasts just that, however many frames it has and whatever the character's size.
    const set = SPRITE_LOOP_MS[s.id]?.[motion];
    i = Math.floor(tt / (set ? set / a.frames : walking && o.walkMs ? o.walkMs : (LOOP_MS[motion] ?? 150) * tempo)) % a.frames;
  }
  // The picture as drawn is the breath out: it rises from there and comes back (so coming back from a swing, at t = 0,
  // nothing jumps).
  const sy = breathes(motion, a) && !o.still && !MACHINE[anim] ? 1 + BREATH_RISE * (0.5 - 0.5 * Math.cos((tt / (BREATH_MS * tempo)) * 2 * Math.PI)) : 1;
  return { motion, i, a, key: frameKey(s.id, motion, i), sy };
}

/** A long character (ちゅーしです, the big bird, the rock-paper-scissors one) is kept to this many times its size's
 *  height in length, standing lower instead. Giants keep their full three lanes' height, and Rakko's car and boat the
 *  heights they were given. */
const LONG = 1.25;

/** Field pixels per source pixel: the character stands its size's height on the field (see TIER_HEIGHT), or
 *  `height` when given, unless that would make it too long. A person's standing picture takes the size of the
 *  fighter they are as big as (PEOPLE_SIZE). */
export function spriteScale(s: SpriteLayout, height?: number): number {
  const r = sizeSpec(s.id);
  const h = height ?? r?.height ?? TIER_HEIGHT[r?.tier ?? 'S'];
  const box = s.anims.idle?.boxes[0];
  const length = box && r?.tier !== 'XXL' && r?.group !== 'rescue' ? box[2] / LONG : 0;
  return h / Math.max(1, s.height, length);
}

/** How far ahead of the point it stands on an enemy's front reaches (field pixels). An enemy stops 68 px short of
 *  the middle of the friend it meets (17 px inside that friend's tile), and an ordinary friend's front is about 60 px
 *  from its middle: so they meet face to face. */
export const REACH = 8;

/** How far to move an enemy's drawing back (field pixels, toward the road) so its front is just ahead of the point it
 *  stands on and its body behind it: it meets a friend face to face, a long one's body trailing behind (でかつよ's down
 *  the road). Friends stand on their tiles' middles and are not moved; nor are fliers, which hang over where they are,
 *  or enemies waiting on the road (the renderer leaves those out). */
export function frontShift(s: SpriteLayout, scale: number): number {
  if (!s.id.startsWith('enemy_')) return 0;
  const idle = s.anims.idle;
  const box = idle?.boxes[0];
  if (!idle || !box) return 0;
  return Math.max(0, (idle.ax - box[0]) * scale - REACH);
}

/** A frame's visible box on the field, its feet at (x, y). */
export function spriteBox(f: SpriteFrame, x: number, y: number, scale: number): { x0: number; y0: number; x1: number; y1: number } {
  const [bx, by, bw, bh] = f.a.boxes[f.i] ?? [0, 0, f.a.w, f.a.h];
  const down = scale * f.sy;
  return { x0: x + (bx - f.a.ax) * scale, y0: y + (by - f.a.ay) * down, x1: x + (bx + bw - f.a.ax) * scale, y1: y + (by + bh - f.a.ay) * down };
}

/** A frame's box on the field with its sticker's room around it: the white cut edge and the shadow spill past the
 *  art by the sticker's pad (cut for `unit`, drawn at `scale`). Anything that draws the whole sticker off screen first
 *  (a fade, a hit flash, a tint) must take this box, or the edge and shadow are cut off in straight lines. */
export function spriteStickerBox(f: SpriteFrame, x: number, y: number, scale: number, unit = scale): { x0: number; y0: number; x1: number; y1: number } {
  // The whole frame canvas with the sticker's pad round it: exactly what drawSpriteFrame draws, so nothing the sticker
  // holds (a shadow's soft tail runs a little past the art's own box) can fall outside it.
  const pad = (FIELD_LOOK.pad / unit) * scale;
  const a = f.a;
  return { x0: x - a.ax * scale - pad, y0: y - (a.ay * scale + pad) * f.sy, x1: x + (a.w - a.ax) * scale + pad, y1: y + ((a.h - a.ay) * scale + pad) * f.sy };
}

/** The sticker of a frame (its white cut edge and shadow), cut for `unit` field pixels per source pixel and never
 *  finer than the frame itself. Cut once, then kept in `stickers`. */
export function spriteSticker(f: SpriteFrame, unit: number, stickers: StickerCache, edge = true) {
  return stickers.get(f.key, f.a.w, f.a.h, unit, edge, FIELD_LOOK, 1);
}

/** Draw a frame with its feet at (x, y) in the context's field space, `scale` field pixels per source pixel. `unit`
 *  is the scale its sticker is cut for (the character's own), so a passing squash or pop does not cut it again. */
export function drawSpriteFrame(ctx: CanvasRenderingContext2D, f: SpriteFrame, x: number, y: number, scale: number, stickers: StickerCache, unit = scale, edge = true): void {
  const st = spriteSticker(f, unit, stickers, edge);
  if (!st) return;
  const a = f.a;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale * f.sy);
  ctx.drawImage(st.el, -a.ax - st.pad, -a.ay - st.pad, a.w + 2 * st.pad, a.h + 2 * st.pad);
  ctx.restore();
}

/** Where a character's shadow goes, from the point it stands on (field pixels across: under the middle of its idle
 *  body, moved back with a long one's drawing) and at least how wide it is. */
export function spriteFootprint(s: SpriteLayout, scale: number, centered = false): { dx: number; rx: number } {
  const idle = s.anims.idle;
  const box = idle?.boxes[0];
  if (!idle || !box) return { dx: 0, rx: 0 };
  return { dx: (centered ? 0 : frontShift(s, scale)) + (box[0] + box[2] / 2 - idle.ax) * scale, rx: box[2] * scale * 0.3 };
}

/** ちいかぶ's transform frames grow it from the small form into the true one. Each frame is sized and placed between
 *  where the small form stood and where the true form will, so neither end jumps: `k` scales the true form's size,
 *  `dx` shifts it across (field pixels). */
export function transformAdjust(small: SpriteLayout | undefined, big: SpriteLayout, f: SpriteFrame): { k: number; dx: number } {
  const n = f.a.frames;
  const first = f.a.boxes[0];
  const sIdle = small?.anims.idle;
  if (!small || !sIdle || !first || n < 2) return { k: 1, dx: 0 };
  const bigScale = spriteScale(big);
  const smallScale = spriteScale(small);
  // The first frame stands as tall as the small form, centred where it was.
  const k0 = (small.height * smallScale) / Math.max(1, (f.a.ay - first[1]) * bigScale);
  const smallMid = (sIdle.boxes[0][0] + sIdle.boxes[0][2] / 2 - sIdle.ax) * smallScale;
  const firstMid = (first[0] + first[2] / 2 - f.a.ax) * bigScale * k0;
  const dx0 = smallMid - firstMid;
  const p = f.i / (n - 1);
  return { k: k0 + (1 - k0) * p, dx: dx0 * (1 - p) };
}
