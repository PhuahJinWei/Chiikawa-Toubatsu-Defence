// Finding where each exported layer sits in a composited preview, and what that says about the piece:
// pure maths on RGBA pixel arrays, so it runs in Node tools and in tests alike.

export interface RGBA {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

export type Side = 'l' | 'r' | 't' | 'b';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pixels at least this opaque count as part of a piece. */
const SOLID = 128;

/** The box around a picture's visible pixels (null if it is empty). */
export function alphaBox(img: RGBA, min = 8): Box | null {
  let x0 = img.w;
  let y0 = img.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.data[(y * img.w + x) * 4 + 3] >= min) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** The box around all of these boxes. */
export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function crop(img: RGBA, b: Box): RGBA {
  const out = new Uint8ClampedArray(b.w * b.h * 4);
  for (let y = 0; y < b.h; y++) out.set(img.data.subarray(((b.y + y) * img.w + b.x) * 4, ((b.y + y) * img.w + b.x + b.w) * 4), y * b.w * 4);
  return { w: b.w, h: b.h, data: out };
}

/** True if no pixel is transparent (a backdrop). */
export function isOpaque(img: RGBA): boolean {
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 250) return false;
  return true;
}

/** Average blocks of k × k pixels (colour weighted by alpha). */
function shrink(img: RGBA, k: number): RGBA {
  if (k === 1) return img;
  const w = Math.max(1, Math.floor(img.w / k));
  const h = Math.max(1, Math.floor(img.h / k));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < k; dy++) {
        for (let dx = 0; dx < k; dx++) {
          const i = ((y * k + dy) * img.w + x * k + dx) * 4;
          const al = img.data[i + 3];
          r += img.data[i] * al;
          g += img.data[i + 1] * al;
          b += img.data[i + 2] * al;
          a += al;
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
      }
      out[o + 3] = a / (k * k);
    }
  }
  return { w, h, data: out };
}

function shrinkMask(mask: Uint8Array, w: number, h: number, k: number): { mask: Uint8Array; w: number; h: number } {
  if (k === 1) return { mask, w, h };
  const W = Math.max(1, Math.floor(w / k));
  const H = Math.max(1, Math.floor(h / k));
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let n = 0;
      for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) n += mask[(y * k + dy) * w + x * k + dx];
      out[y * W + x] = n * 2 > k * k ? 1 : 0;
    }
  }
  return { mask: out, w: W, h: H };
}

interface Samples {
  /** Pixel coordinates in the layer and their colour, for its solid pixels. */
  xs: Int32Array;
  ys: Int32Array;
  rgb: Uint8Array;
  n: number;
}

function samples(img: RGBA, every = 1): Samples {
  const xs: number[] = [];
  const ys: number[] = [];
  const rgb: number[] = [];
  let k = 0;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const i = (y * img.w + x) * 4;
      if (img.data[i + 3] < 220) continue;
      if (k++ % every) continue;
      xs.push(x);
      ys.push(y);
      rgb.push(img.data[i], img.data[i + 1], img.data[i + 2]);
    }
  }
  return { xs: Int32Array.from(xs), ys: Int32Array.from(ys), rgb: Uint8Array.from(rgb), n: xs.length };
}

/** How well a layer's solid pixels match the preview at (x, y), ignoring preview pixels already explained by a
 *  layer above it. 0–1; small overlaps are penalised. */
function score(pre: RGBA, free: Uint8Array, s: Samples, x: number, y: number, tol: number): number {
  let hit = 0;
  let seen = 0;
  for (let i = 0; i < s.n; i++) {
    const px = s.xs[i] + x;
    const py = s.ys[i] + y;
    if (px < 0 || py < 0 || px >= pre.w || py >= pre.h) continue;
    const j = py * pre.w + px;
    if (!free[j]) continue;
    seen++;
    const o = j * 4;
    const d = Math.abs(pre.data[o] - s.rgb[i * 3]) + Math.abs(pre.data[o + 1] - s.rgb[i * 3 + 1]) + Math.abs(pre.data[o + 2] - s.rgb[i * 3 + 2]);
    if (d < tol) hit++;
  }
  if (!seen) return 0;
  return (hit / seen) * Math.min(1, seen / (0.5 * s.n));
}

/** Mean colour difference of a layer's solid pixels against the free preview pixels under them at (x, y). */
function meanDiff(pre: RGBA, free: Uint8Array, s: Samples, x: number, y: number): number {
  let sum = 0;
  let seen = 0;
  for (let i = 0; i < s.n; i++) {
    const px = s.xs[i] + x;
    const py = s.ys[i] + y;
    if (px < 0 || py < 0 || px >= pre.w || py >= pre.h) continue;
    const j = py * pre.w + px;
    if (!free[j]) continue;
    seen++;
    const o = j * 4;
    sum += Math.abs(pre.data[o] - s.rgb[i * 3]) + Math.abs(pre.data[o + 1] - s.rgb[i * 3 + 1]) + Math.abs(pre.data[o + 2] - s.rgb[i * 3 + 2]);
  }
  // Placements that leave most of the layer off the picture are not candidates.
  return seen < 0.5 * s.n ? Infinity : sum / seen;
}

export interface Placement {
  x: number;
  y: number;
  /** How well it matched, 0–1. */
  match: number;
}

/**
 * Where each layer sits in the composited preview. Layers are given back to front, as painted; they are placed
 * front to back so that pixels covered by nearer layers do not mislead the search for farther ones. A layer the
 * size of the preview is taken to be exported in place (the usual "export layers at canvas size").
 */
export function locate(preview: RGBA, layers: RGBA[]): Placement[] {
  const free = new Uint8Array(preview.w * preview.h).fill(1);
  const out: Placement[] = new Array(layers.length);
  for (let li = layers.length - 1; li >= 0; li--) {
    const layer = layers[li];
    let best: Placement;
    if (layer.w === preview.w && layer.h === preview.h) best = { x: 0, y: 0, match: 1 };
    else {
      // Coarse to fine: search everywhere at 1/8 size, then refine around the best spot at 1/4, 1/2 and full size.
      let bx = 0;
      let by = 0;
      let bm = -1;
      for (const k of [8, 4, 2, 1]) {
        const pre = shrink(preview, k);
        const fr = shrinkMask(free, preview.w, preview.h, k).mask;
        const lay = shrink(layer, k);
        // Enough samples to judge, few enough to stay quick on big pieces.
        const s = samples(lay, Math.max(1, Math.floor((lay.w * lay.h) / (k === 8 ? 4000 : 60000))));
        const tol = k === 1 ? 60 : 90;
        const candidates: [number, number][] = [];
        if (k === 8) {
          // Anywhere the layer keeps at least half of itself inside the picture.
          for (let y = -Math.floor(lay.h / 2); y <= pre.h - Math.ceil(lay.h / 2); y++) for (let x = -Math.floor(lay.w / 2); x <= pre.w - Math.ceil(lay.w / 2); x++) candidates.push([x, y]);
        } else {
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) candidates.push([bx * 2 + dx, by * 2 + dy]);
        }
        bm = -1;
        for (const [x, y] of candidates) {
          const m = score(pre, fr, s, x, y, tol);
          if (m > bm) {
            bm = m;
            bx = x;
            by = y;
          }
        }
      }
      // Final touch: the smallest colour difference over every solid pixel, which outlines pin down exactly
      // (a hit count alone cannot tell apart positions a few pixels apart on flat colour).
      const all = samples(layer, 1);
      let bestD = Infinity;
      let fx = bx;
      let fy = by;
      // Walk downhill: search around the best spot until it stops moving (at most a few steps).
      for (let step = 0; step < 6; step++) {
        const cx = fx;
        const cy = fy;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const d = meanDiff(preview, free, all, cx + dx, cy + dy);
            if (d < bestD) {
              bestD = d;
              fx = cx + dx;
              fy = cy + dy;
            }
          }
        }
        if (fx === cx && fy === cy) break;
      }
      best = { x: fx, y: fy, match: Math.max(0, score(preview, free, all, fx, fy, 60)) };
    }
    out[li] = best;
    // Claim the preview pixels this layer explains.
    for (let y = 0; y < layer.h; y++) {
      for (let x = 0; x < layer.w; x++) {
        if (layer.data[(y * layer.w + x) * 4 + 3] < SOLID) continue;
        const px = x + best.x;
        const py = y + best.y;
        if (px >= 0 && py >= 0 && px < preview.w && py < preview.h) free[py * preview.w + px] = 0;
      }
    }
  }
  return out;
}

/** Sides where a placed layer runs off the picture: the layer is cut off along that edge of its own (solid pixels
 *  right at its border) and that border lies on the picture's edge or beyond (within a couple of pixels). */
export function cutSides(layer: RGBA, x: number, y: number, W: number, H: number, near = 2): Side[] {
  const solid = (lx: number, ly: number) => layer.data[(ly * layer.w + lx) * 4 + 3] >= SOLID;
  const column = (lx: number) => {
    for (let ly = 0; ly < layer.h; ly++) if (solid(lx, ly)) return true;
    return false;
  };
  const row = (ly: number) => {
    for (let lx = 0; lx < layer.w; lx++) if (solid(lx, ly)) return true;
    return false;
  };
  const out: Side[] = [];
  if (x <= near && column(0)) out.push('l');
  if (x + layer.w >= W - near && column(layer.w - 1)) out.push('r');
  if (y <= near && row(0)) out.push('t');
  if (y + layer.h >= H - near && row(layer.h - 1)) out.push('b');
  return out;
}


/** "03-character-silver-customer.png" → "character-silver-customer". */
export function layerName(file: string): string {
  return file
    .replace(/\.(png|webp|jpe?g)$/i, '')
    .replace(/^\d+[\s._-]*/, '')
    .trim();
}

/** The frames of idle loops among layer files: names ending in _1, _2 … (two or more, numbered from 1 with no
 *  gap), grouped by what comes before. "02-character-idle_3.png" is frame 3 of "02-character-idle". */
export function frameGroups(files: string[]): { stem: string; files: string[] }[] {
  const byStem = new Map<string, { n: number; file: string }[]>();
  for (const file of files) {
    const m = /^(.+)_(\d+)\.(png|webp|jpe?g)$/i.exec(file);
    if (!m) continue;
    const list = byStem.get(m[1]) ?? [];
    list.push({ n: Number(m[2]), file });
    byStem.set(m[1], list);
  }
  const out: { stem: string; files: string[] }[] = [];
  for (const [stem, list] of byStem) {
    list.sort((a, b) => a.n - b.n);
    if (list.length >= 2 && list.every((f, i) => f.n === i + 1)) out.push({ stem, files: list.map((f) => f.file) });
  }
  return out;
}

/** A layer file's leading number ("02-character.png" → "02"), if it has one. */
export function leadingNumber(file: string): string | undefined {
  return /^(\d+)/.exec(file)?.[1];
}

/** Order of a layer file: its leading number, then its name. */
export function layerOrder(a: string, b: string): number {
  const na = Number(/^(\d+)/.exec(a)?.[1] ?? Infinity);
  const nb = Number(/^(\d+)/.exec(b)?.[1] ?? Infinity);
  return na !== nb ? na - nb : a.localeCompare(b);
}

const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '_');

/**
 * Which spec id each layer file is: an explicit map first, then the same name. If no layer is named after a
 * piece and the counts agree, layers are taken in stack order. Anything else keeps its own name.
 */
export function mapLayers(files: string[], ids: string[], explicit: Record<string, string> = {}): { file: string; id: string; how: 'map' | 'name' | 'order' | 'new' }[] {
  const named = files.some((f) => !explicit[f] && ids.some((id) => norm(id) === norm(layerName(f))));
  const byOrder = !named && files.length === ids.length;
  return files.map((file, i) => {
    if (explicit[file]) return { file, id: explicit[file], how: 'map' as const };
    const name = norm(layerName(file));
    const same = ids.find((id) => norm(id) === name);
    if (same) return { file, id: same, how: 'name' as const };
    if (byOrder) return { file, id: ids[i], how: 'order' as const };
    return { file, id: name || `layer_${i}`, how: 'new' as const };
  });
}

/** An image generator's PNG may carry a content-credentials chunk (caBX) that the canvas library refuses to read past
 *  ("Invalid SVG image"), or a lone gamma tag (gAMA with no sRGB beside it) that makes it shift the colours a little; the
 *  game's art is all sRGB, so the picture is taken as stored, without either. */
export function readable(buf: Buffer): Buffer {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return buf;
  const parts = [buf.subarray(0, 8)];
  for (let o = 8; o + 12 <= buf.length; ) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    if (type !== 'caBX' && type !== 'gAMA') parts.push(buf.subarray(o, o + 12 + len));
    o += 12 + len;
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}
