// Scene pieces ready to draw: the picture (real or placeholder) with its cut edges stretched outward and the
// sticker border and shadow added, at the resolution the screen needs. Used by menu scenes (CSS 3D) and by
// the battlefield backdrop (canvas).

import { BLEED_PX } from './bleed';
import { paperize, SCENE_LOOK, type StickerLook } from './paper';
import type { SceneLayer, Side } from './spec';
import { art } from './store';

export interface BuiltPiece {
  el: HTMLCanvasElement;
  /** The canvas's box around the piece's own position, in stage pixels: border room plus stretched edges. */
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Stage pixels added on each side of a piece by stretching its cut edges (`by`: how far on each side). */
export function bleedOf(l: SceneLayer, by: Record<Side, number> = { l: BLEED_PX, r: BLEED_PX, t: BLEED_PX, b: BLEED_PX }): Record<Side, number> {
  const cut = l.cut ?? [];
  return { l: cut.includes('l') ? by.l : 0, r: cut.includes('r') ? by.r : 0, t: cut.includes('t') ? by.t : 0, b: cut.includes('b') ? by.b : 0 };
}

/** The art at q canvas pixels per stage pixel, with each cut edge stretched outward (a strip a few pixels in
 *  from the edge, smeared out), so a view that passes the picture's edge shows more of the same, not a hard cut.
 *  `cpu` keeps the canvas in main memory, for a piece whose pixels are read next (its sticker edge). */
export function stretched(src: CanvasImageSource, sw: number, sh: number, w: number, h: number, b: Record<Side, number>, q: number, cpu = false): HTMLCanvasElement {
  const W = Math.round((w + b.l + b.r) * q);
  const H = Math.round((h + b.t + b.b) * q);
  const c = document.createElement('canvas');
  c.width = Math.max(1, W);
  c.height = Math.max(1, H);
  const ctx = c.getContext('2d', cpu ? { willReadFrequently: true } : undefined);
  if (!ctx) return c;
  const ax = b.l * q;
  const ay = b.t * q;
  const aw = w * q;
  const ah = h * q;
  ctx.drawImage(src, 0, 0, sw, sh, ax, ay, aw, ah);
  if (!b.l && !b.r && !b.t && !b.b) return c;
  ctx.imageSmoothingEnabled = false;
  // A few source pixels in from the edge, past any soft rim.
  const n = Math.max(0, Math.min(4, Math.floor(Math.min(sw, sh) / 8)));
  const left = ax + (n + 1) * (aw / sw);
  const right = ax + (sw - 1 - n) * (aw / sw);
  const top = ay + (n + 1) * (ah / sh);
  const bottom = ay + (sh - 1 - n) * (ah / sh);
  const strip = (sx: number, sy: number, sW: number, sH: number, dx: number, dy: number, dW: number, dH: number) => {
    if (dW > 0 && dH > 0) ctx.drawImage(src, sx, sy, sW, sH, dx, dy, dW, dH);
  };
  if (b.t) strip(0, n, sw, 1, ax, 0, aw, top);
  if (b.b) strip(0, sh - 1 - n, sw, 1, ax, bottom, aw, H - bottom);
  if (b.l) strip(n, 0, 1, sh, 0, ay, left, ah);
  if (b.r) strip(sw - 1 - n, 0, 1, sh, right, ay, W - right, ah);
  if (b.t && b.l) strip(n, n, 1, 1, 0, 0, left, top);
  if (b.t && b.r) strip(sw - 1 - n, n, 1, 1, right, 0, W - right, top);
  if (b.b && b.l) strip(n, sh - 1 - n, 1, 1, 0, bottom, left, H - bottom);
  if (b.b && b.r) strip(sw - 1 - n, sh - 1 - n, 1, 1, right, bottom, W - right, H - bottom);
  return c;
}

/** Make one piece of a scene ready to draw at q canvas pixels per stage pixel. `file` picks another picture of the
 *  same piece (a frame of its idle loop), drawn in the piece's own box. */
export function buildPiece(sceneId: string, l: SceneLayer, q: number, file = l.id, look: StickerLook = SCENE_LOOK, by?: Record<Side, number>): BuiltPiece {
  const key = `scenes/${sceneId}/${file}`;
  const b = bleedOf(l, by);
  const w = l.w + b.l + b.r;
  const h = l.h + b.t + b.b;
  const real = art.loaded(key);
  let src: CanvasImageSource;
  let sw: number;
  let sh: number;
  if (real) {
    src = real;
    sw = real.naturalWidth;
    sh = real.naturalHeight;
  } else {
    // Placeholders are painted at the piece's size; draw them at the screen's resolution for sharp edges.
    const ph = art.placeholder(key);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(l.w * q));
    c.height = Math.max(1, Math.round(l.h * q));
    if (ph) c.getContext('2d', { willReadFrequently: true })?.drawImage(ph, 0, 0, c.width, c.height);
    src = c;
    sw = c.width;
    sh = c.height;
  }
  // A piece with a cut edge has its pixels read to find its outline (paperize), so it is drawn in main memory first:
  // reading a GPU-backed canvas back costs tens of milliseconds a time. The backmost piece has no edge and is shown
  // as it is.
  const flat = stretched(src, sw, sh, l.w, l.h, b, q, l.edge);
  if (!l.edge) return { el: flat, left: -b.l, top: -b.t, width: w, height: h };
  const out = paperize(flat, w, h, q, true, look);
  return { el: out.el, left: -(b.l + out.pad), top: -(b.t + out.pad), width: w + 2 * out.pad, height: h + 2 * out.pad };
}
