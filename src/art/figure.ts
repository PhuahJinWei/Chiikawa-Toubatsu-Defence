// One stage for every character shown outside the battle (the gallery's right page, the art kit's list). Each stands
// on the same ground at the same scale, its frames sized by the battle's own rules, so a preview keeps the size the
// character has on the field beside every other. Nothing is fitted to its own box: fitting each one made でかつよ look
// smaller than キメラ.
//
// The stage holds everyone but the giants whole: the biggest of them sets it, so a bigger one arriving makes every
// preview a little smaller instead of spilling out. The giants (でかつよ, あのこ: three lanes tall) are drawn at the
// same scale and are too big for it (the user's call, so the small ones show twice as big): a giant's preview grows
// taller so its head stays in view, and it runs off the stage's back edge with its front kept in, as if still coming
// down the road.

import { FIELD_LOOK } from './paper';
import { sizeSpec, type Tier, TIER_HEIGHT } from './spec';
import { frameOf, fullBreath, spriteBox, spriteFor, spriteIds, type SpriteMotion, spriteScale } from './sprite';

/** A box in field pixels, around a character's feet at (0, 0). */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The stage, in field pixels: `w` × `h`, its ground `ground` below its top. */
export interface Stage {
  w: number;
  h: number;
  ground: number;
}

/** One character's preview, in field pixels: the stage's width, its height grown for anyone taller than the stage
 *  (a giant), and where the character's feet stand: `feet` across from the left, `ground` down from the top. */
export interface Frame {
  w: number;
  h: number;
  ground: number;
  feet: number;
}

/** How a preview draws one character: `k` CSS pixels per field pixel (the same for every character: this is what keeps
 *  them true to size), where its feet stand (`x`, `y`, CSS pixels from the preview's top left), and the preview's
 *  height for its width (taller for a giant). */
export interface FigureLayout {
  k: number;
  x: number;
  y: number;
  height: number;
}

/** Room kept around the biggest character (field pixels): its white cut edge, and a little air. */
const AIR = FIELD_LOOK.border + 6;

/** Each size's shadow, as wide as in battle at least (half-widths, field pixels; see game/render/renderer.ts). */
const SHADOW: Record<Tier, number> = { S: 44, M: 58, L: 80, XL: 110, XXL: 190 };

/** The biggest size that fits the stage: anyone taller is a giant to it (でかつよ and あのこ, three lanes tall, and
 *  セイレーン, as tall as they are in her one lane). */
const BIGGEST: Tier = 'XL';

/** Whether a character is too big for the stage, left out when the stage is measured (it runs off the stage instead). */
export function isGiant(id: string): boolean {
  const r = sizeSpec(id);
  return !!r && (r.height ?? TIER_HEIGHT[r.tier]) > TIER_HEIGHT[BIGGEST];
}

/** Which way a character faces, as in battle: friends right, enemies left. */
function facingOf(id: string): 1 | -1 {
  return sizeSpec(id)?.facing ?? (id.startsWith('enemy_') ? -1 : 1);
}

/** Every character a preview can show: everyone drawn from frames (fighters, people, Rakko's car and boat). */
export function figureIds(): string[] {
  return spriteIds();
}

const union = (a: Box | null, b: Box): Box => (a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : b);

const RESTS = new Map<string, Box | null>();
const REACHES = new Map<string, Box | null>();

/** Where a character's body is at rest (field pixels, feet at 0, 0): its first idle frame. */
export function restOf(id: string): Box | null {
  if (RESTS.has(id)) return RESTS.get(id) ?? null;
  let out: Box | null = null;
  const s = spriteFor(id);
  if (s) {
    const motion = (s.anims.idle ? 'idle' : Object.keys(s.anims)[0]) as SpriteMotion | undefined;
    const f = motion ? frameOf(s, motion, 0) : null;
    if (f) out = spriteBox(f, 0, 0, spriteScale(s));
  }
  RESTS.set(id, out);
  return out;
}

/** Everything a character covers (field pixels, feet at 0, 0): every frame of every motion it has been drawn in (at
 *  the top of its breath, if it breathes). */
export function reachOf(id: string): Box | null {
  if (REACHES.has(id)) return REACHES.get(id) ?? null;
  const s = spriteFor(id);
  let out: Box | null = null;
  if (s) {
    const k = spriteScale(s);
    for (const [motion, a] of Object.entries(s.anims)) {
      for (let i = 0; i < (a?.frames ?? 0); i++) {
        const f = frameOf(s, motion as SpriteMotion, i);
        if (f) out = union(out, spriteBox(fullBreath(f), 0, 0, k));
      }
    }
  }
  REACHES.set(id, out);
  return out;
}

/** A character's shadow (field pixels): `dx` from its feet to under the middle of its body at rest, `rx` its
 *  half-width, as in battle (a long one's spans its body). */
export function shadowOf(id: string): { dx: number; rx: number } {
  const rest = restOf(id);
  const tier = sizeSpec(id)?.tier ?? 'S';
  if (!rest) return { dx: 0, rx: SHADOW[tier] };
  return { dx: (rest.x0 + rest.x1) / 2, rx: Math.max(SHADOW[tier], (rest.x1 - rest.x0) * 0.3) };
}

/** How far a character's front reaches while it stands and walks (field pixels from its feet, on the side it faces):
 *  what stays in view when it is too big for the stage. A strike may reach further, past the edge for a moment. */
export function frontOf(id: string): number {
  const facing = facingOf(id);
  const s = spriteFor(id);
  let front = facing < 0 ? Infinity : -Infinity;
  if (s) {
    const k = spriteScale(s);
    for (const motion of ['idle', 'walk'] as SpriteMotion[]) {
      for (let i = 0; i < (s.anims[motion]?.frames ?? 0); i++) {
        const f = frameOf(s, motion, i);
        if (!f) continue;
        const b = spriteBox(f, 0, 0, k);
        front = facing < 0 ? Math.min(front, b.x0) : Math.max(front, b.x1);
      }
    }
  }
  if (!Number.isFinite(front)) {
    const r = restOf(id);
    front = r ? (facing < 0 ? r.x0 : r.x1) : 0;
  }
  return front;
}

let STAGE: Stage | null = null;

/** The stage: wide enough for the widest character's reach (each centred on its own) and tall enough for the tallest,
 *  with its shadow under it, the giants left out. */
export function stage(): Stage {
  if (STAGE) return STAGE;
  let half = 0;
  let top = 0;
  let below = 0;
  for (const id of figureIds()) {
    if (isGiant(id)) continue;
    const r = reachOf(id);
    if (!r) continue;
    const mid = (r.x0 + r.x1) / 2;
    const sh = shadowOf(id);
    half = Math.max(half, (r.x1 - r.x0) / 2, Math.abs(sh.dx - mid) + sh.rx);
    top = Math.max(top, -r.y0);
    below = Math.max(below, r.y1, sh.rx * 0.24 - 4);
  }
  const ground = Math.ceil(top + AIR);
  STAGE = { w: Math.ceil(2 * (half + AIR)), h: ground + Math.ceil(below + AIR), ground };
  return STAGE;
}

const FRAMES = new Map<string, Frame>();

/** A character's preview: the stage, grown taller (the ground moving down) for anyone taller than it, so a giant's
 *  head stays in view. Whoever fits across stands centred on all it does; anyone wider (a giant) stands with its front
 *  just inside the side it faces and runs off the other. */
export function figureFrame(id: string): Frame {
  const hit = FRAMES.get(id);
  if (hit) return hit;
  const st = stage();
  const r = reachOf(id);
  let out: Frame = { w: st.w, h: st.h, ground: st.ground, feet: st.w / 2 };
  if (r) {
    const sh = shadowOf(id);
    const ground = Math.max(st.ground, Math.ceil(-r.y0 + AIR));
    const h = ground + Math.max(st.h - st.ground, Math.ceil(Math.max(r.y1, sh.rx * 0.24 - 4) + AIR));
    const mid = (r.x0 + r.x1) / 2;
    const fits = r.x1 - r.x0 <= st.w - 2 * AIR && Math.abs(sh.dx - mid) + sh.rx <= st.w / 2 - AIR;
    const feet = fits ? st.w / 2 - mid : facingOf(id) < 0 ? AIR - frontOf(id) : st.w - AIR - frontOf(id);
    out = { w: st.w, h, ground, feet };
  }
  FRAMES.set(id, out);
  return out;
}

/** How a preview `width` CSS pixels across draws a character: every character at the one scale (the stage's width in
 *  the preview's), placed as figureFrame says. */
export function figureLayout(id: string, width: number): FigureLayout {
  const f = figureFrame(id);
  const k = width / stage().w;
  return { k, x: f.feet * k, y: f.ground * k, height: f.h * k };
}
