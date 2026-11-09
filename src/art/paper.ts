// The paper-cutout look for scene layers: a white cut edge and a soft shadow around each piece,
// a shared paper-grain texture, and torn-paper outlines for panels. The game applies all of it,
// so artists paint flat pieces with nothing around them.

import { seeded } from './placeholders/kit';

/** The sticker look, in the units of the piece being cut out (stage pixels for scenes, field pixels in battle). */
export interface StickerLook {
  /** Width of the white border. */
  border: number;
  /** Gaps in the outline narrower than about twice this are bridged, like a die-cut sticker. */
  bridge: number;
  /** Room around the piece for the border and the shadow. */
  pad: number;
  /** Size of the soft drop shadow (1 = a scene piece's). */
  shadow: number;
}

/** Scene pieces: a thick border and a deep shadow (stage pixels). */
export const SCENE_LOOK: StickerLook = { border: 10, bridge: 9, pad: 48, shadow: 1 };
/** Things on the battlefield: thinner, so small characters stay readable (field pixels). */
export const FIELD_LOOK: StickerLook = { border: 4.5, bridge: 3, pad: 16, shadow: 0.35 };
/** Space around a processed scene piece for its sticker border and shadow, in stage pixels. */
export const PAPER_PAD = SCENE_LOOK.pad;
const BORDER = '#FFFDF7';

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Grow a shape outward by r pixels: the union of copies shifted around a few rings. */
function grow(src: HTMLCanvasElement, r: number): HTMLCanvasElement {
  const out = canvas(src.width, src.height);
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  ctx.drawImage(src, 0, 0);
  for (const [k, n] of [
    [1, 32],
    [0.68, 24],
    [0.36, 12],
  ]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k;
      ctx.drawImage(src, Math.cos(a) * r * k, Math.sin(a) * r * k);
    }
  }
  return out;
}

/** Shrink a shape inward by r pixels (grow everything outside it, then cut that away). */
function shrink(src: HTMLCanvasElement, r: number): HTMLCanvasElement {
  const outside = canvas(src.width, src.height);
  const oc = outside.getContext('2d');
  const res = canvas(src.width, src.height);
  const rc = res.getContext('2d');
  if (!oc || !rc) return src;
  oc.fillRect(0, 0, outside.width, outside.height);
  oc.globalCompositeOperation = 'destination-out';
  oc.drawImage(src, 0, 0);
  const around = grow(outside, r);
  rc.drawImage(src, 0, 0);
  rc.globalCompositeOperation = 'destination-out';
  rc.drawImage(around, 0, 0);
  outside.width = outside.height = around.width = around.height = 0;
  return res;
}

/** A solid silhouette of the art: soft or faint pixels below half opacity do not count. */
function silhouette(src: CanvasImageSource, W: number, H: number, at: number, aw: number, ah: number): HTMLCanvasElement {
  const sil = canvas(W, H);
  const ctx = sil.getContext('2d', { willReadFrequently: true });
  if (!ctx) return sil;
  ctx.drawImage(src, at, at, aw, ah);
  const img = ctx.getImageData(0, 0, sil.width, sil.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255;
    d[i + 1] = 253;
    d[i + 2] = 247;
    d[i + 3] = d[i + 3] >= 128 ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  return sil;
}

/**
 * Turn flat art (w × h units) into a sticker at q canvas pixels per unit: a white die-cut border that follows
 * the outline (bridging narrow gaps), a crisp edge shadow and a soft drop shadow. With `edge`, the result is
 * padded by look.pad units on every side.
 */
export function paperize(src: CanvasImageSource, w: number, h: number, q: number, edge: boolean, look: StickerLook = SCENE_LOOK): { el: HTMLCanvasElement; pad: number } {
  if (!edge) {
    const c = canvas(w * q, h * q);
    c.getContext('2d')?.drawImage(src, 0, 0, c.width, c.height);
    return { el: c, pad: 0 };
  }
  const pad = look.pad;
  const EDGE = look.border;
  const BRIDGE = look.bridge;
  const W = (w + 2 * pad) * q;
  const H = (h + 2 * pad) * q;
  const at = Math.round(pad * q);
  const aw = Math.round(w * q);
  const ah = Math.round(h * q);
  const out = canvas(W, H);
  const oc = out.getContext('2d');
  if (!oc) return { el: out, pad };

  // The border: grow past the edge by EDGE + BRIDGE, then pull back by BRIDGE (fills narrow gaps).
  const sil = silhouette(src, W, H, at, aw, ah);
  const wide = grow(sil, (EDGE + BRIDGE) * q);
  const cut = shrink(wide, BRIDGE * q);
  const cc = cut.getContext('2d');
  if (cc) {
    cc.globalCompositeOperation = 'source-in';
    cc.fillStyle = BORDER;
    cc.fillRect(0, 0, cut.width, cut.height);
  }
  // A soft shadow under the sticker, then a thin darker rim (the sticker's thickness), then the art.
  oc.shadowColor = 'rgba(59, 47, 47, 0.24)';
  oc.shadowBlur = 18 * q * look.shadow;
  oc.shadowOffsetY = 12 * q * look.shadow;
  oc.drawImage(cut, 0, 0);
  oc.shadowColor = 'rgba(59, 47, 47, 0.18)';
  oc.shadowBlur = 0;
  oc.shadowOffsetY = Math.max(1, 3 * q * Math.sqrt(look.shadow));
  oc.drawImage(cut, 0, 0);
  oc.shadowColor = 'transparent';
  oc.drawImage(src, at, at, aw, ah);
  sil.width = sil.height = wide.width = wide.height = cut.width = cut.height = 0;
  return { el: out, pad };
}

let grain = '';

/** A small tileable paper-grain texture (data URL), made once. */
export function paperGrainUrl(): string {
  if (grain) return grain;
  if (typeof document === 'undefined') return '';
  const size = 160;
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(size, size);
  const rnd = seeded(99);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 255 - Math.floor(rnd() * rnd() * 40);
    img.data[i] = v;
    img.data[i + 1] = v - 2;
    img.data[i + 2] = v - 7;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // A few faint fibres.
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#6F6058';
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const a = rnd() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
    ctx.stroke();
  }
  grain = c.toDataURL('image/png');
  return grain;
}

/** A torn-paper outline as a CSS clip-path polygon, the same every time for one seed. */
export function deckle(seed: number, jitter = 0.9, steps = 22): string {
  const rnd = seeded(seed);
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) pts.push([(i / steps) * 100, rnd() * jitter]);
  for (let i = 1; i <= steps; i++) pts.push([100 - rnd() * jitter * 0.6, (i / steps) * 100]);
  for (let i = steps - 1; i >= 0; i--) pts.push([(i / steps) * 100, 100 - rnd() * jitter]);
  for (let i = steps - 1; i >= 1; i--) pts.push([rnd() * jitter * 0.6, (i / steps) * 100]);
  return `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(', ')})`;
}
