// Placeholder paintings for scene pieces. Each piece is painted in its scene's stage coordinates, so pieces
// on different layers line up exactly as they will in the game. They are briefs, not art: rough shapes in
// the right places, with the characters' procedural drawings standing in for them.

import { sceneSpec, WORLD_FIELD, WORLD_H } from '../spec';
import { arc, circle, type Ctx, ellipse, glow, INK, label, line, poly, roundRect, seeded, shade, star, stroke, WHITE } from './kit';
import { poseFor } from './pose';
import { type DrawOpts, setFacing, SUBJECTS } from './subjects';

/** Paint one scene piece placeholder into a canvas the size of the piece. A battle world's one piece is its whole picture. */
export function drawScenePiece(ctx: Ctx, sceneId: string, pieceId: string): void {
  const sc = sceneSpec(sceneId);
  const l = sc?.layers.find((x) => x.id === pieceId);
  if (!sc || !l) return;
  ctx.save();
  if (sc.kind === 'world') paintWorld(ctx, Object.values(PAINTERS[sceneId] ?? {}));
  else {
    ctx.translate(-l.x, -l.y);
    PAINTERS[sceneId]?.[pieceId]?.(ctx);
  }
  ctx.restore();
}

/** The worlds' placeholders are drawn on the first plan: 3060 wide, the field at x 600. */
const WORLD_W = 3060;
const WORLD_SHIFT = WORLD_FIELD.x - 600;

/** How wide a band of the picture's left edge fills the strip added on that side. The first plan kept doorways and faces
 *  right of this, so repeating it shows only plain wall or ground. */
const WORLD_BAND = 100;

/** A world's placeholder: its parts painted far to near, moved over to where the field is now. The picture's left edge
 *  carries on into the added strip as that band, mirrored back and forth so the seams meet. */
function paintWorld(ctx: Ctx, parts: ((c: Ctx) => void)[]): void {
  const paint = () => parts.forEach((part) => part(ctx));
  ctx.translate(WORLD_SHIFT, 0);
  for (let i = 0; i * WORLD_BAND < WORLD_SHIFT; i++) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-(i + 1) * WORLD_BAND, 0, WORLD_BAND, WORLD_H);
    ctx.clip();
    if (i % 2) ctx.translate(-(i + 1) * WORLD_BAND, 0);
    else {
      ctx.translate(-i * WORLD_BAND, 0);
      ctx.scale(-1, 1);
    }
    paint();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.rect(0, 0, WORLD_W, WORLD_H);
  ctx.clip();
  paint();
}

/** A front-facing character standing with its feet at (cx, feet), scaled by k. */
function standee(ctx: Ctx, subject: string, cx: number, feet: number, k: number, opts: DrawOpts = {}): void {
  ctx.save();
  ctx.translate(cx, feet);
  ctx.scale(k, k);
  setFacing(0);
  SUBJECTS[subject]?.(ctx, poseFor('idle', 0, 4), opts);
  ctx.restore();
}

/** A small bowl seen from the side (for stacks on shelves). */
function smallBowl(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x - r, y - r * 0.5);
  ctx.quadraticCurveTo(x - r * 0.9, y + r * 0.2, x, y + r * 0.25);
  ctx.quadraticCurveTo(x + r * 0.9, y + r * 0.2, x + r, y - r * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#FBF3EA';
  ctx.fill();
  line(ctx, 4);
  ctx.stroke();
}

function sky(ctx: Ctx, x: number, w: number, h: number, top: string, bottom: string, seed: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(x, 0, w, h);
  const rnd = seeded(seed);
  for (let i = 0; i < Math.ceil(w / 420); i++) {
    const cx = x + 80 + rnd() * (w - 160);
    const cy = 60 + rnd() * 160;
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (let k = 0; k < 3; k++) circle(ctx, cx + k * 34 - 34, cy - (k === 1 ? 14 : 0), 30, WHITE, 0);
    ctx.restore();
  }
}

function hills(ctx: Ctx, x0: number, x1: number, y: number, color: string, seed: number): void {
  const rnd = seeded(seed);
  for (let x = x0 - 100; x < x1 + 100; x += 300) ellipse(ctx, x + rnd() * 80, y + rnd() * 30, 240, 110, color, 4);
}

/** Round lumps (x, y, r) drawn as one clump: every lump's outline first, then every fill over the overlaps, so only
 *  the clump's own edge stays outlined (bushes, tree crowns). */
function clump(ctx: Ctx, lumps: [number, number, number][], fill: string, lw = 4.5): void {
  for (const [x, y, r] of lumps) circle(ctx, x, y, r, null, lw * 2);
  ctx.fillStyle = fill;
  for (const [x, y, r] of lumps) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function grassTufts(ctx: Ctx, x0: number, x1: number, y: number, color: string, seed: number, flowers = true): void {
  const rnd = seeded(seed);
  ctx.fillStyle = color;
  ctx.fillRect(x0, y + 30, x1 - x0, 400);
  for (let x = x0; x < x1; x += 46) {
    const h = 30 + rnd() * 40;
    poly(ctx, [[x, y + 40], [x + 14, y + 40 - h], [x + 28, y + 40]], shade(color, rnd() * 20 - 10), 3);
  }
  if (flowers) {
    for (let i = 0; i < (x1 - x0) / 140; i++) {
      const fx = x0 + rnd() * (x1 - x0);
      const fy = y + 40 + rnd() * 40;
      for (let k = 0; k < 5; k++) circle(ctx, fx + Math.cos(k * 1.26) * 7, fy + Math.sin(k * 1.26) * 7, 5, WHITE, 0);
      circle(ctx, fx, fy, 4, '#FFD86B', 0);
    }
  }
}

function tree(ctx: Ctx, x: number, base: number, h: number, leaf: string): void {
  roundRect(ctx, x - 14, base - h * 0.55, 28, h * 0.55, 8, '#8B6A4E', 4);
  circle(ctx, x, base - h * 0.62, h * 0.32, leaf, 4);
  circle(ctx, x - h * 0.2, base - h * 0.5, h * 0.22, shade(leaf, 10), 4);
  circle(ctx, x + h * 0.2, base - h * 0.52, h * 0.22, shade(leaf, -8), 4);
}

function building(ctx: Ctx, x: number, base: number, w: number, h: number, color: string, roof: string): void {
  roundRect(ctx, x, base - h, w, h, 10, color, 4);
  roundRect(ctx, x - 8, base - h - 18, w + 16, 26, 8, roof, 4);
  for (let r = 0; r < Math.floor((h - 50) / 60); r++) for (let c = 0; c < Math.max(1, Math.floor(w / 70)); c++) roundRect(ctx, x + 18 + c * 70, base - h + 34 + r * 60, 32, 28, 5, '#BFE2F4', 3);
}

/** ハチワレの洞窟: a rocky hill with its dark mouth on the right. Spans x0–x1, ground at `base`. */
function cave(ctx: Ctx, x0: number, x1: number, top: number, base: number): void {
  ctx.beginPath();
  ctx.moveTo(x0 - 40, base);
  ctx.quadraticCurveTo(x0 - 20, top + 20, x0 + (x1 - x0) * 0.35, top);
  ctx.quadraticCurveTo(x1, top + 60, x1, base);
  ctx.closePath();
  ctx.fillStyle = '#C9C6BE';
  ctx.fill();
  line(ctx, 5);
  ctx.stroke();
  const rnd = seeded(31);
  for (let i = 0; i < 10; i++) {
    const x = x0 + 30 + rnd() * (x1 - x0 - 80);
    const y = top + 80 + rnd() * (base - top - 140);
    stroke(ctx, [[x, y], [x + 26, y + 18]], 3, '#9F9B92');
  }
  const mx = x1 - (x1 - x0) * 0.32;
  const mh = Math.min(260, (base - top) * 0.45);
  ctx.beginPath();
  ctx.moveTo(mx - 70, base);
  ctx.quadraticCurveTo(mx - 76, base - mh, mx, base - mh - 10);
  ctx.quadraticCurveTo(mx + 70, base - mh, mx + 66, base);
  ctx.closePath();
  ctx.fillStyle = '#4C4744';
  ctx.fill();
  line(ctx, 5);
  ctx.stroke();
}

/** ラーメン屋「郎」's front: a wooden shop with noren facing right. */
function ramenFront(ctx: Ctx, x0: number, x1: number, top: number, base: number): void {
  roundRect(ctx, x0 - 20, top + 40, x1 - x0 + 20, base - top - 40, 18, '#C98A61', 5);
  roundRect(ctx, x0, top, x1 - x0 - 10, 70, 14, '#3E3532', 5);
  label(ctx, 'ラーメン 郎', (x0 + x1) / 2, top + 36, 34, '#FFF4E0', 'center', 900);
  const n = Math.max(2, Math.floor((base - top - 160) / 120));
  for (let i = 0; i < n; i++) {
    roundRect(ctx, x1 - 90, top + 110 + i * 120, 80, 104, 8, '#D9534F', 4);
    if (i === Math.floor(n / 2)) label(ctx, '郎', x1 - 50, top + 162 + i * 120, 44, WHITE, 'center', 900);
  }
  for (const yy of [top + 90, base - 80]) {
    ellipse(ctx, x1 - 6, yy, 22, 30, '#F26B5B', 4);
    stroke(ctx, [[x1 - 6, yy - 30], [x1 - 6, yy - 42]], 3);
  }
}

/** 森の出口: tall trees with a bright gap toward the right. */
function forestExit(ctx: Ctx, x0: number, x1: number, top: number, base: number, leaf: string): void {
  glow(ctx, x1 - 60, (top + base) / 2, Math.min(260, (base - top) / 2), '#FFFBE0', 0.95);
  const span = base - top;
  for (const [fx, fy, k] of [
    [0.25, 0.3, 1],
    [0.6, 0.18, 0.8],
    [0.3, 0.75, 1.1],
    [0.68, 0.85, 0.9],
  ] as const) {
    const x = x0 + (x1 - x0) * fx;
    const y = top + span * fy;
    roundRect(ctx, x - 22, y, 44, span * 0.2, 14, '#8B6A4E', 4);
    circle(ctx, x, y, 110 * k, leaf, 5);
    circle(ctx, x - 60 * k, y + 30, 70 * k, shade(leaf, 12), 5);
  }
}

/** A night sky: deep blue, lighter toward the horizon, with little stars and dots (as in the owner's World 4 quest
 *  picture). */
function nightSky(ctx: Ctx, w: number, h: number, seed: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2C3F72');
  g.addColorStop(0.3, '#3B5590');
  g.addColorStop(1, '#5A6FA9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rnd = seeded(seed);
  for (let i = 0; i < w / 80; i++) {
    const x = rnd() * w;
    const y = 24 + rnd() * 300;
    if (rnd() < 0.4) star(ctx, x, y, 13 + rnd() * 7, 6, 5, '#FFE9A6', 0);
    else circle(ctx, x, y, 3 + rnd() * 2.5, '#FFF6D8', 0);
  }
}

/** A dome home seen from the side, cut through the centre at `cx` (the owner's ちいかわの家 is a white dome). */
function dome(ctx: Ctx, cx: number, base: number, rx: number, ry: number, fill: string, lw = 5): void {
  ctx.beginPath();
  ctx.ellipse(cx, base, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    line(ctx, lw);
    ctx.stroke();
  }
}

/** A square window with a cross, lit warm from inside. */
function litWindow(ctx: Ctx, x: number, y: number, s: number): void {
  glow(ctx, x + s / 2, y + s / 2, s * 1.1, '#FFE7A8', 0.55);
  roundRect(ctx, x, y, s, s, s * 0.12, '#FFE7A8', Math.max(3, s * 0.05));
  stroke(ctx, [[x + s / 2, y + 2], [x + s / 2, y + s - 2]], Math.max(3, s * 0.06));
  stroke(ctx, [[x + 2, y + s / 2], [x + s - 2, y + s / 2]], Math.max(3, s * 0.06));
}

/** ちいかわの家 from the field's side: the white dome running off the left edge, its door facing right, a lit
 *  window and the little face plate beside the door. Ground at `base`. */
function domeHome(ctx: Ctx, base: number): void {
  dome(ctx, -120, base, 540, 1260, '#DCE0F5');
  // Shading on the far side of the curve.
  ctx.save();
  ctx.globalAlpha = 0.35;
  dome(ctx, -120, base, 300, 1100, '#C3C9EB', 0);
  ctx.restore();
  litWindow(ctx, 160, 600, 116);
  // The door, round at the top, on the ground.
  ctx.beginPath();
  ctx.moveTo(250, base);
  ctx.lineTo(250, 1230);
  ctx.quadraticCurveTo(250, 1150, 305, 1150);
  ctx.quadraticCurveTo(360, 1150, 360, 1230);
  ctx.lineTo(360, base);
  ctx.closePath();
  ctx.fillStyle = '#C8D2F0';
  ctx.fill();
  line(ctx, 5);
  ctx.stroke();
  // The face plate.
  roundRect(ctx, 290, 980, 84, 60, 8, '#FFF8EA', 4);
  circle(ctx, 314, 996, 7, '#FFF8EA', 3);
  circle(ctx, 350, 996, 7, '#FFF8EA', 3);
  circle(ctx, 332, 1012, 18, '#FFF8EA', 3);
  circle(ctx, 325, 1010, 2.4, INK, 0);
  circle(ctx, 339, 1010, 2.4, INK, 0);
}

function roadStrip(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  roundRect(ctx, x + 30, y, w - 30, h + 40, 30, color, 0);
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let yy = y + 60; yy < y + h; yy += 100) roundRect(ctx, x + w / 2 + 6, yy, 22, 48, 8, shade(color, -14), 0);
  ctx.restore();
}

const PAL = {
  1: { ground: '#BFE3A1', ground2: '#B2DA92', accent: '#7FB069', sky: '#DDF0FF', path: '#E9D7AE' },
  2: { ground: '#C4D89B', ground2: '#B5CB89', accent: '#5E8C52', sky: '#E4F1DC', path: '#D8C49A' },
  3: { ground: '#EADFCB', ground2: '#E0D3BB', accent: '#C9876B', sky: '#FFF1E0', path: '#D9CBB2' },
  4: { ground: '#97A3D6', ground2: '#8A97CC', accent: '#4F6496', sky: '#34497E', path: '#7D89BF' },
} as const;

function groundTexture(ctx: Ctx, x: number, y: number, w: number, h: number, n: 1 | 2 | 3 | 4): void {
  const pal = PAL[n];
  ctx.fillStyle = pal.ground;
  ctx.fillRect(x, y, w, h);
  const rnd = seeded(n * 97);
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < (w * h) / 26000; i++) ellipse(ctx, x + rnd() * w, y + rnd() * h, 24 + rnd() * 20, 12 + rnd() * 8, pal.ground2, 0);
  ctx.restore();
  for (let i = 0; i < (w * h) / 20000; i++) {
    const px = x + rnd() * w;
    const py = y + rnd() * h;
    if (n === 3) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      roundRect(ctx, px - 16, py - 10, 32, 20, 6, shade(pal.ground, -10), 0);
      ctx.restore();
    } else {
      stroke(ctx, [[px - 5, py], [px - 2, py - 9]], 2, shade(pal.accent, -10));
      stroke(ctx, [[px, py], [px, py - 11]], 2, shade(pal.accent, -10));
      stroke(ctx, [[px + 5, py], [px + 2, py - 9]], 2, shade(pal.accent, -10));
    }
  }
}

/** A horizon edge for a ground piece: a soft wavy top line so the piece reads as a cut-out. */
function groundPiece(ctx: Ctx, x: number, y: number, w: number, h: number, n: 1 | 2 | 3 | 4): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y + 30);
  for (let px = x, i = 0; px < x + w; px += 120, i++) ctx.quadraticCurveTo(px + 60, y + (i % 2 ? 6 : 18), px + 120, y + 30);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.clip();
  groundTexture(ctx, x, y, w, h, n);
  ctx.restore();
}

// ------------------------------------------------------------ World 5, the island (after the owner's quest picture)

/** World 5's colours, after the owner's quest picture: a muted blue sky with pale clouds, a blue-grey sea, pale
 *  greyish-lavender sand, grey-lavender rocks round a dark cave mouth, sage-green bushes. */
const ISLAND = {
  skyTop: '#6383AB',
  skyLow: '#88A2C4',
  cloud: '#AABDD7',
  sea: '#5E82A9',
  /** The water lane and the sea close by: a little lighter than the open sea, so the lane reads. */
  water: '#6A8DB3',
  foam: '#EEF2F8',
  sand: '#BDBECC',
  sand2: '#AFB2C3',
  /** The open beach on the right, where the enemies wait: dry and a little lighter. */
  dry: '#C4C5D2',
  wet: '#A8ACBF',
  dot: '#6E5752',
  pebble: '#9AA3BA',
  rock: '#98A2B9',
  rock2: '#8792AC',
  cave: '#2D2B40',
  bush: '#A3B9A4',
  bush2: '#8FA791',
} as const;

/** The surf line where the sea meets the beach (the sand's wavy top edge), at picture x. */
const beachTop = (x: number): number => 314 + 8 * Math.sin(x / 75) + 3 * Math.sin(x / 31);
/** The shore's wavy left edge, beside the field, at picture y. */
const shoreLeft = (y: number): number => 2108 + 7 * Math.sin(y / 85);
/** Where the beach on the far right meets the sea, at picture y. */
const seaEdge = (y: number): number => 2980 + 22 * Math.sin((y - 300) / 200);

/** A flat pale cloud with a bumpy top and a flat bottom at y, about w wide (no outline, as in the quest picture). */
function softCloud(ctx: Ctx, x: number, y: number, w: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - w, y - w, w * 3, w);
  ctx.clip();
  ctx.fillStyle = ISLAND.cloud;
  for (const [cx, cy, r] of [
    [0.16, 0.02, 0.15],
    [0.38, -0.05, 0.22],
    [0.62, -0.02, 0.17],
    [0.84, 0.03, 0.13],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x + cx * w, y + cy * w, r * w * 1.25, r * w, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Short white ripple dashes on water, in loose rows from y0 to y1 about `gap` apart, some in pairs. */
function ripples(ctx: Ctx, x0: number, x1: number, y0: number, y1: number, gap: number, seed: number, len = 1, alpha = 0.85): void {
  const rnd = seeded(seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let y = y0, row = 0; y < y1; y += gap * (0.8 + rnd() * 0.4), row++) {
    for (let x = x0 + (row % 2) * 90 + rnd() * 80; x < x1; x += 150 + rnd() * 150) {
      const l = (14 + rnd() * 18) * len;
      stroke(ctx, [[x, y], [x + l, y]], 3.5 * Math.min(1, len + 0.2), ISLAND.foam);
      if (rnd() < 0.45) stroke(ctx, [[x + l * 0.4, y + 8 * len], [x + l * 1.1, y + 8 * len]], 3 * Math.min(1, len + 0.2), ISLAND.foam);
    }
  }
  ctx.restore();
}

/** Pale greyish-lavender sand over a box: soft darker patches, little groups of dots and a few pebbles (none on the
 *  field, which stays flat open sand). */
function sandTexture(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  const rnd = seeded(seed);
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < (w * h) / 30000; i++) ellipse(ctx, x + rnd() * w, y + rnd() * h, 30 + rnd() * 26, 10 + rnd() * 8, ISLAND.sand2, 0);
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < (w * h) / 15000; i++) {
    const px = x + rnd() * w;
    const py = y + rnd() * h;
    for (let k = 0, n = 2 + Math.floor(rnd() * 2); k < n; k++) circle(ctx, px + k * 9, py + (k % 2) * 3, 2.1, ISLAND.dot, 0);
  }
  ctx.restore();
  for (let i = 0; i < (w * h) / 70000; i++) {
    const px = x + rnd() * w;
    const py = y + rnd() * h;
    const r = 8 + rnd() * 7;
    if (px > 570 && px < 2160 && py > 340 && py < 1230) continue;
    ellipse(ctx, px, py, r, r * 0.62, ISLAND.pebble, 2.5);
  }
}

/** The outline of a beach piece: the surf line along the top from x0 to x1, down to `bottom`. `left` is a wavy left
 *  edge (the shore beside the field); without it the left side is straight at x0. */
function beachShape(ctx: Ctx, x0: number, x1: number, bottom: number, left?: (y: number) => number): void {
  ctx.beginPath();
  ctx.moveTo(x0, beachTop(x0));
  for (let x = x0 + 20; x < x1 + 20; x += 20) ctx.lineTo(Math.min(x, x1), beachTop(Math.min(x, x1)));
  ctx.lineTo(x1, bottom);
  if (left) for (let y = bottom; y > beachTop(x0); y -= 20) ctx.lineTo(left(y), y);
  else ctx.lineTo(x0, bottom);
  ctx.closePath();
}

/** Where the sea washes up along the top of the beach: a band of wet sand and a lacy line of foam. */
function surfLine(ctx: Ctx, x0: number, x1: number, seed: number): void {
  const rnd = seeded(seed);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  for (let x = x0; x <= x1 + 20; x += 20) ctx.lineTo(x, beachTop(x) + 26 + 4 * Math.sin(x / 41));
  ctx.lineTo(x1 + 20, beachTop(x1) - 10);
  ctx.lineTo(x0, beachTop(x0) - 10);
  ctx.closePath();
  ctx.fillStyle = ISLAND.wet;
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  for (let x = x0; x <= x1 + 20; x += 20) ctx.lineTo(x, beachTop(x) + 8 + 3 * Math.sin(x / 23));
  line(ctx, 7, ISLAND.foam);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  for (let x = x0 + rnd() * 50; x < x1; x += 60 + rnd() * 50) {
    const l = 24 + rnd() * 20;
    stroke(ctx, [[x, beachTop(x) + 20], [x + l, beachTop(x + l) + 20]], 3, ISLAND.foam);
  }
  ctx.restore();
}

/** World 5's sea along the bottom of the picture, from y0 down: blue-grey water with soft foam along its top edge and
 *  white ripple strokes. */
function shoreSea(ctx: Ctx, y0: number, seed: number): void {
  const x0 = -20;
  const x1 = WORLD_W + 20;
  const y1 = 1520;
  ctx.fillStyle = ISLAND.water;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const rnd = seeded(seed);
  ctx.save();
  ctx.fillStyle = ISLAND.foam;
  // A band of foam hugging the edge, scalloped on the water side, and a lacy line just inside it.
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let x = x0; x < x1; x += 46) ctx.quadraticCurveTo(x + 23, y0 + 16 + rnd() * 10, x + 46, y0 + 5);
  ctx.lineTo(x1, y0);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.55;
  for (let x = x0 + rnd() * 40; x < x1; x += 64 + rnd() * 40) {
    const l = 26 + rnd() * 16;
    stroke(ctx, [[x, y0 + 25], [x + l, y0 + 24]], 3, ISLAND.foam);
  }
  ctx.restore();
  ripples(ctx, x0, x1, y0 + 36, y1 - 34, 32, seed + 1);
}

/** A closed outline through the middles of the sides of a polygon, its corners rounded off. */
function smoothShape(ctx: Ctx, pts: [number, number][]): void {
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ctx.beginPath();
  ctx.moveTo(...mid(pts[pts.length - 1], pts[0]));
  for (let i = 0; i < pts.length; i++) ctx.quadraticCurveTo(...pts[i], ...mid(pts[i], pts[(i + 1) % pts.length]));
  ctx.closePath();
}

/** 浜辺の洞窟 (picture x 0–430): grey-lavender cliffs with green bushes on top and the dark cave mouth on the field's
 *  side. */
function seaCave(ctx: Ctx): void {
  const rock: [number, number][] = [
    [-40, 1440],
    [-40, 230],
    [40, 186],
    [140, 168],
    [230, 190],
    [300, 178],
    [364, 228],
    [400, 300],
    [414, 390],
    [402, 456],
    [422, 540],
    [432, 660],
    [432, 900],
    [410, 966],
    [424, 1060],
    [404, 1136],
    [428, 1250],
    [416, 1440],
  ];
  smoothShape(ctx, rock);
  ctx.fillStyle = ISLAND.rock;
  ctx.fill();
  ctx.save();
  smoothShape(ctx, rock);
  ctx.clip();
  // The rock masses it is made of, a darker side toward the field, cracks and little hatch marks (as the quest
  // picture draws its rocks).
  ctx.globalAlpha = 0.45;
  for (const [x, y, rx, ry] of [
    [380, 430, 70, 150],
    [392, 1060, 60, 170],
    [70, 700, 90, 150],
    [220, 1200, 130, 80],
    [140, 300, 110, 50],
  ])
    ellipse(ctx, x, y, rx, ry, ISLAND.rock2, 0);
  ctx.globalAlpha = 1;
  for (const [x0, y0, cx, cy, x1, y1] of [
    [60, 262, 112, 300, 120, 382],
    [250, 224, 228, 300, 268, 362],
    [336, 300, 300, 382, 334, 470],
    [30, 470, 92, 516, 96, 612],
    [168, 400, 204, 462, 178, 524],
    [120, 900, 172, 950, 158, 1042],
    [300, 942, 280, 1012, 322, 1082],
    [50, 1100, 110, 1140, 100, 1222],
    [232, 1062, 252, 1122, 220, 1182],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    line(ctx, 3.5);
    ctx.stroke();
  }
  for (const [x, y] of [
    [88, 334],
    [206, 302],
    [292, 512],
    [64, 770],
    [128, 652],
    [352, 1002],
    [80, 984],
    [196, 1246],
    [330, 1186],
  ]) {
    stroke(ctx, [[x, y], [x + 5, y - 11]], 2.5);
    stroke(ctx, [[x + 9, y], [x + 14, y - 11]], 2.5);
  }
  // The mouth, facing the field: dark inside.
  const arch = () => {
    ctx.beginPath();
    ctx.moveTo(166, 872);
    ctx.bezierCurveTo(152, 700, 194, 526, 294, 522);
    ctx.bezierCurveTo(394, 520, 422, 690, 416, 872);
    ctx.closePath();
  };
  arch();
  ctx.fillStyle = ISLAND.cave;
  ctx.fill();
  line(ctx, 5);
  ctx.stroke();
  // Boulders at the cliff's foot.
  for (const [x, y, rx, ry] of [
    [356, 1214, 62, 42],
    [112, 1262, 84, 52],
  ]) {
    ellipse(ctx, x, y, rx, ry, ISLAND.rock, 4.5);
    stroke(ctx, [[x - rx * 0.3, y - ry * 0.2], [x - rx * 0.1, y - ry * 0.45]], 2.5);
  }
  ctx.restore();
  smoothShape(ctx, rock);
  line(ctx, 5);
  ctx.stroke();
  // Green bushes along the top, outlined as one clump, with a few darker lumps and little marks.
  const bushes: [number, number, number][] = [
    [-10, 222, 44],
    [52, 190, 48],
    [118, 172, 40],
    [178, 170, 46],
    [240, 188, 38],
    [292, 178, 40],
    [346, 214, 34],
  ];
  clump(ctx, bushes, ISLAND.bush);
  ctx.save();
  ctx.globalAlpha = 0.6;
  for (const [x, y, r] of bushes) ellipse(ctx, x + r * 0.15, y + r * 0.45, r * 0.7, r * 0.35, ISLAND.bush2, 0);
  ctx.restore();
  for (const [x, y] of [
    [40, 178],
    [132, 156],
    [204, 160],
    [290, 168],
  ]) {
    stroke(ctx, [[x, y], [x + 1, y + 7]], 2.4);
    stroke(ctx, [[x + 8, y - 1], [x + 9, y + 6]], 2.4);
  }
}

// ------------------------------------------------------------ World 6, the big hunt (after the owner's quest picture)

/** World 6's colours, after the owner's quest picture: a forest clearing in soft pastels, everything outlined dark. */
const WILD = {
  skyTop: '#CDE4EA',
  skyLow: '#EEF5EA',
  crown: '#BCD7A9',
  crownLight: '#D3E6C4',
  teal: '#86B19B',
  glint: '#C4E3CF',
  trunk: '#F9DDD3',
  trunkFar: '#E7D1C3',
  bush: '#A8C597',
  ground: '#F2E4CF',
  ground2: '#E9D8BF',
  /** The dash marks and the strokes of the little grass tufts. */
  mark: '#7A5446',
  tuft: '#D4E4B4',
  cap: '#F9B6E9',
  stripe: '#93507F',
  stem: '#FBF4EE',
  frog: '#9CCB7E',
} as const;
/** Wild and tall grass, in the bushes' soft greens. */
const GRASS = ['#A6C895', '#BAD6A6', '#95BA87'] as const;

/** The clearing's back edge (the ground's wavy top, where the forest's bushes stand), at picture x. */
const clearingTop = (x: number): number => 312 + 7 * Math.sin(x / 90) + 3 * Math.sin(x / 37);

/** A little two-leaf sprout growing up from (x, y). */
function sprout(ctx: Ctx, x: number, y: number, k = 1): void {
  stroke(ctx, [[x, y], [x, y - 16 * k]], 3);
  for (const s of [-1, 1]) ellipse(ctx, x + s * 7 * k, y - 19 * k, 7.5 * k, 4.5 * k, WILD.bush, 2.6, -s * 0.5);
}

/** A round bush of lumps (one outline round the clump) with a few inner curves and little sprouts on its highest
 *  lumps, as in the owner's World 6 picture. */
function bush(ctx: Ctx, lumps: [number, number, number][], seed: number, sprouts = 1): void {
  const rnd = seeded(seed);
  const tops = [...lumps].sort((a, b) => a[1] - a[2] - (b[1] - b[2]));
  for (const [x, y, r] of tops.slice(0, sprouts)) sprout(ctx, x + (rnd() - 0.5) * r * 0.6, y - r + 6, 0.9 + rnd() * 0.4);
  clump(ctx, lumps, WILD.bush);
  for (const [x, y, r] of lumps) if (rnd() < 0.45) arc(ctx, x + (rnd() - 0.5) * r * 0.5, y + r * 0.3, r * 0.45, Math.PI * 1.1, Math.PI * 1.9, 3.5);
}

/** A tree trunk from `top` down to the ground at `base`, flaring a little at its foot, with bark lines. */
function trunk(ctx: Ctx, x: number, top: number, base: number, w: number, fill: string, seed: number): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, top);
  ctx.lineTo(x + w / 2, top);
  ctx.quadraticCurveTo(x + w * 0.46, base - (base - top) * 0.3, x + w * 0.64, base);
  ctx.lineTo(x - w * 0.64, base);
  ctx.quadraticCurveTo(x - w * 0.46, base - (base - top) * 0.3, x - w / 2, top);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  line(ctx, 4.5);
  ctx.stroke();
  const rnd = seeded(seed);
  for (let i = 0; i < Math.round(w / 22); i++) {
    const bx = x - w * 0.34 + rnd() * w * 0.68;
    const by = top + 30 + rnd() * (base - top - 90);
    stroke(ctx, [[bx, by], [bx + (rnd() - 0.5) * 3, by + 20 + rnd() * 40]], 2.6);
  }
}

/** Soft green tree crowns across the top of the forest: lumpy masses from just under `top` down to a scalloped lower
 *  edge around `bottom`, lighter on top, with the edges of crowns behind showing inside. */
function crowns(ctx: Ctx, x0: number, x1: number, top: number, bottom: number, seed: number): void {
  const rnd = seeded(seed);
  // Upper and lower lumps close enough together that the band between them is always covered.
  const upper: [number, number, number][] = [];
  const lower: [number, number, number][] = [];
  for (let x = x0 - 60; x < x1 + 90; x += 70 + rnd() * 30) upper.push([x, top + 80 + rnd() * 30, 58 + rnd() * 20]);
  for (let x = x0 - 40; x < x1 + 60; x += 46 + rnd() * 10) lower.push([x, bottom - 40 + rnd() * 6, 36 + rnd() * 6]);
  const lumps = [...upper, ...lower];
  for (const [x, y, r] of lumps) circle(ctx, x, y, r, null, 9);
  ctx.fillStyle = WILD.crown;
  ctx.fillRect(x0 - 60, top + 100, x1 - x0 + 150, bottom - top - 137);
  for (const [x, y, r] of lumps) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.globalAlpha = 0.8;
  for (const [x, y, r] of upper) ellipse(ctx, x + 6, y - r * 0.3, r * 0.62, r * 0.36, WILD.crownLight, 0);
  ctx.restore();
  for (let x = x0 + rnd() * 120; x < x1; x += 180 + rnd() * 160) {
    const y = top + 120 + rnd() * Math.max(10, bottom - top - 190);
    for (let k = 0; k < 3; k++) arc(ctx, x + k * 34, y, 17, 0.15 * Math.PI, 0.85 * Math.PI, 3.5);
  }
}

/** The teal shade deep in the forest between the trees, with long pale glints. */
function forestShade(ctx: Ctx, x0: number, x1: number, top: number, bottom: number, seed: number): void {
  ctx.fillStyle = WILD.teal;
  ctx.fillRect(x0, top, x1 - x0, bottom - top);
  const rnd = seeded(seed);
  ctx.save();
  ctx.globalAlpha = 0.75;
  for (let x = x0 + rnd() * 100; x < x1; x += 110 + rnd() * 150) roundRect(ctx, x, top + 70 + rnd() * 50, 15, 42 + rnd() * 18, 7.5, WILD.glint, 0);
  ctx.restore();
}

/** A small grass tuft on the ground: three short strokes over a soft green smudge. */
function tuft(ctx: Ctx, x: number, y: number): void {
  ctx.save();
  ctx.globalAlpha = 0.85;
  ellipse(ctx, x, y - 2, 15, 6, WILD.tuft, 0);
  ctx.restore();
  for (const [dx, tx, ty] of [
    [-6, -9, -10],
    [0, 0, -12],
    [6, 9, -10],
  ])
    stroke(ctx, [[x + dx, y], [x + tx, y + ty]], 2.6, WILD.mark);
}

/** A blade of grass from its foot at (x, y): `h` tall, `w` wide at the foot, its tip leaning by `lean`. */
function blade(ctx: Ctx, x: number, y: number, h: number, w: number, lean: number, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w * 0.2 + lean * 0.3, y - h * 0.6, x + lean, y - h);
  ctx.quadraticCurveTo(x + w * 0.2 + lean * 0.5, y - h * 0.5, x + w / 2, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  line(ctx, 3);
  ctx.stroke();
}

/** A clump of broad grass blades rising from around (x, y), up to about `h` tall, fanning out. */
function grassClump(ctx: Ctx, x: number, y: number, h: number, seed: number, n = 4): void {
  const rnd = seeded(seed);
  for (let i = 0; i < n; i++) {
    const dx = (i / (n - 1) - 0.5) * h * 0.46;
    blade(ctx, x + dx, y + rnd() * 4, h * (0.62 + rnd() * 0.38), h * 0.24, dx * 0.6 + (rnd() - 0.5) * h * 0.18, GRASS[Math.floor(rnd() * GRASS.length)]);
  }
}

/** The clearing's ground over a box: pale cream with soft patches, little dash marks (often in pairs) and small grass
 *  tufts, as in the quest picture, and clumps of wild grass off the field (which stays flat). */
function clearing(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number): void {
  ctx.fillStyle = WILD.ground;
  ctx.fillRect(x, y, w, h);
  const rnd = seeded(seed);
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < (w * h) / 30000; i++) ellipse(ctx, x + rnd() * w, y + rnd() * h, 34 + rnd() * 30, 11 + rnd() * 8, WILD.ground2, 0);
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < (w * h) / 16000; i++) {
    const px = x + rnd() * w;
    const py = y + rnd() * h;
    const l = 16 + rnd() * 14;
    stroke(ctx, [[px, py], [px + l, py]], 2.6, WILD.mark);
    if (rnd() < 0.6) stroke(ctx, [[px + l * 0.4, py + 7], [px + l * 1.1, py + 7]], 2.6, WILD.mark);
  }
  ctx.restore();
  for (let i = 0; i < (w * h) / 40000; i++) tuft(ctx, x + rnd() * w, y + rnd() * h);
  for (let i = 0; i < (w * h) / 50000; i++) {
    const px = x + rnd() * w;
    const py = y + rnd() * h;
    const ch = 40 + rnd() * 26;
    if (px > 560 && px < 2170 && py > 340 && py < 1290) continue;
    grassClump(ctx, px, py, ch, seed + i, 4);
  }
}

/** One of the mushrooms the trio had never seen: a dome cap striped pink and purple on a wavy white stem, standing
 *  at (x, base), its cap w wide. */
function stripedMushroom(ctx: Ctx, x: number, base: number, w: number): void {
  const lw = Math.max(2.6, w * 0.022);
  const sw = w * 0.3;
  const capY = base - w * 0.5;
  const ch = w * 0.46;
  // The stem: white, its two sides waving together like a ribbon.
  const n = 3;
  const step = (base - capY) / n;
  ctx.beginPath();
  ctx.moveTo(x - sw / 2, base);
  for (let i = 0; i < n; i++) ctx.quadraticCurveTo(x - sw / 2 + (i % 2 ? 1 : -1) * sw * 0.3, base - step * (i + 0.5), x - sw / 2, base - step * (i + 1));
  ctx.lineTo(x + sw / 2, capY);
  for (let j = 0; j < n; j++) ctx.quadraticCurveTo(x + sw / 2 + ((n - 1 - j) % 2 ? 1 : -1) * sw * 0.3, capY + step * (j + 0.5), x + sw / 2, capY + step * (j + 1));
  ctx.closePath();
  ctx.fillStyle = WILD.stem;
  ctx.fill();
  line(ctx, lw);
  ctx.stroke();
  // The cap: a dome, its rim curving a little under, striped top to bottom (pink at both edges).
  const cap = () => {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, capY);
    ctx.bezierCurveTo(x - w / 2, capY - ch * 1.33, x + w / 2, capY - ch * 1.33, x + w / 2, capY);
    ctx.quadraticCurveTo(x, capY + ch * 0.2, x - w / 2, capY);
    ctx.closePath();
  };
  cap();
  ctx.fillStyle = WILD.cap;
  ctx.fill();
  ctx.save();
  cap();
  ctx.clip();
  const k = Math.max(5, Math.round(w / 24)) | 1;
  ctx.fillStyle = WILD.stripe;
  for (let i = 1; i < k; i += 2) ctx.fillRect(x - w / 2 + (i * w) / k, capY - ch * 1.1, w / k, ch * 1.4);
  ctx.restore();
  cap();
  line(ctx, lw * 1.2);
  ctx.stroke();
}

/** A little green frog sitting on the ground at (x, y), facing the viewer. */
function frog(ctx: Ctx, x: number, y: number, k = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  for (const s of [-1, 1]) ellipse(ctx, s * 26, -7, 15, 8, WILD.frog, 3);
  ellipse(ctx, 0, -26, 32, 24, WILD.frog, 4);
  ellipse(ctx, 0, -18, 19, 13, '#F3F0D2', 0);
  for (const s of [-1, 1]) {
    circle(ctx, s * 16, -47, 11, WILD.frog, 4);
    circle(ctx, s * 16, -47, 5, INK, 0);
    circle(ctx, s * 16 - 2, -49, 1.8, WHITE, 0);
    ellipse(ctx, s * 22, -32, 5, 3, '#F2A9B4', 0);
  }
  arc(ctx, 0, -36, 8, Math.PI * 0.15, Math.PI * 0.85, 2.4);
  for (const s of [-1, 1]) ellipse(ctx, s * 12, -5, 8, 5, WILD.frog, 3);
  ctx.restore();
}

/** 着地したところ (picture x 0–430): the clearing where the team came down, among the striped mushrooms they had never
 *  seen, big and small, in front of a tall clump of round bushes with sprouts. */
function landingSpot(ctx: Ctx): void {
  const rnd = seeded(161);
  const lumps: [number, number, number][] = [];
  for (let y = 220; y < 1470; y += 92) {
    lumps.push([-30, y + 40, 92]);
    lumps.push([80 + rnd() * 40, y + 20, 86 + rnd() * 14]);
    lumps.push([226 + rnd() * 30, y + 40, 78 + rnd() * 14]);
    lumps.push([336 + rnd() * 14, y, 58 + rnd() * 12]);
  }
  bush(ctx, lumps, 162, 3);
  // The mushrooms, far (high up) to near (low down).
  for (const [x, base, w] of [
    [330, 362, 130],
    [56, 430, 64],
    [150, 640, 210],
    [392, 610, 60],
    [292, 890, 240],
    [62, 880, 80],
    [140, 1130, 230],
    [236, 1250, 74],
    [288, 1386, 270],
  ])
    stripedMushroom(ctx, x, base, w);
}

const PAINTERS: Record<string, Record<string, (ctx: Ctx) => void>> = {
  // ------------------------------------------------------------ shop (the owner's real art replaces these)
  shop: {
    shop_wall(ctx) {
      const rnd = seeded(7);
      ctx.fillStyle = '#CEE8E3';
      ctx.fillRect(0, 0, 1620, 972);
      for (let row = 0, y = 30; y < 972; row++, y += 118) {
        stroke(ctx, [[0, y], [1620, y + 6]], 3, '#8FBFB8');
        for (let x = (row % 2) * 120 + rnd() * 30; x < 1620; x += 240) stroke(ctx, [[x, y + 3], [x, y + 121]], 3, '#8FBFB8');
      }
      const panels: [number, number, number, number][] = [
        [350, 640, 0, 75],
        [640, 1230, 130, 130],
        [1230, 1620, 110, 95],
      ];
      for (const [x0, x1, y0, y1] of panels) {
        ctx.beginPath();
        ctx.moveTo(x0, -10);
        ctx.lineTo(x1, -10);
        ctx.lineTo(x1, y1);
        ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 14, x0, y0);
        ctx.closePath();
        ctx.fillStyle = '#FFE58A';
        ctx.fill();
        line(ctx, 5);
        ctx.stroke();
      }
      label(ctx, '郎', 965, 62, 96, INK, 'center', 900);
      for (let k = 0; k < 3; k++) smallBowl(ctx, 666, 268 - k * 52, 80);
      roundRect(ctx, 495, 292, 278, 32, 8, '#E8B27E', 4);
      roundRect(ctx, 528, 324, 26, 48, 4, '#E8B27E', 4);
      roundRect(ctx, 692, 324, 26, 48, 4, '#E8B27E', 4);
      poly(ctx, [[1015, 160], [1197, 192], [1193, 214], [1012, 182]], '#E8B27E', 4);
      stroke(ctx, [[1060, 182], [1060, 300]], 7, '#A99BA5');
      ellipse(ctx, 1060, 318, 40, 26, '#B9AEB8', 4);
      stroke(ctx, [[1155, 200], [1155, 300]], 7, '#A99BA5');
      poly(ctx, [[1115, 305], [1195, 305], [1170, 392], [1140, 392]], '#E7D9E0', 4);
    },
    shop_master(ctx) {
      standee(ctx, 'yoroi_ramen', 294, 877, 5);
    },
    shop_counter(ctx) {
      poly(ctx, [[-4, 826], [1606, 866], [1606, 980], [-4, 980]], '#EBC9C3', 4);
      poly(ctx, [[-4, 711], [1614, 830], [1614, 866], [-4, 826]], '#D96B72', 4);
      poly(ctx, [[-4, 611], [1600, 771], [1614, 790], [1614, 830], [-4, 711]], '#E9858A', 5);
      stroke(ctx, [[200, 650], [430, 668]], 6, '#F6B6BB');
      stroke(ctx, [[1040, 742], [1150, 752]], 6, '#F6B6BB');
    },
    shop_pochette(ctx) {
      standee(ctx, 'yoroi_pochette', 1361, 1010, 5);
      stroke(ctx, [[1290, 400], [1490, 740]], 14, '#F6A9C0');
      ellipse(ctx, 1468, 718, 22, 22, '#F6A9C0', 4);
      ellipse(ctx, 1552, 718, 22, 22, '#F6A9C0', 4);
      ellipse(ctx, 1510, 780, 70, 60, '#F6A9C0', 5);
      label(ctx, '･ω･', 1510, 786, 34, INK, 'center', 900);
    },
    shop_shisa(ctx) {
      standee(ctx, 'shisa', 797, 1220, 5, { standee: true });
    },
  },

  // ------------------------------------------------------------ lobby (the owner's real art replaces these)
  lobby: {
    wall(ctx) {
      ctx.fillStyle = '#F6E4D6';
      ctx.fillRect(0, 0, 1620, 972);
      ctx.save();
      ctx.translate(-40, 190);
      ctx.rotate(-0.36);
      roundRect(ctx, 0, -20, 560, 36, 4, '#D9A77A', 4);
      ctx.restore();
      for (const x of [300, 1205]) stroke(ctx, [[x, 0], [x, 560]], 3, '#C9AE98');
      roundRect(ctx, -10, 470, 1640, 110, 0, '#CFE3C6', 0);
    },
    counter(ctx) {
      roundRect(ctx, -20, 600, 1660, 70, 12, '#EDB98E', 5);
      roundRect(ctx, -20, 664, 1660, 330, 0, '#E8B48C', 5);
      for (let k = 0; k < 3; k++) roundRect(ctx, 1215 + k * 4, 566 - k * 10, 330, 64, 8, '#FFF8EA', 3);
    },
    yoroi(ctx) {
      standee(ctx, 'yoroi_rodo', 710, 860, 5);
    },
  },
  quests: {
    board(ctx) {
      ctx.fillStyle = '#EFBA93';
      ctx.fillRect(0, 0, 1620, 972);
      const rnd = seeded(77);
      for (let i = 0; i < 220; i++) {
        const x = rnd() * 1620;
        const y = rnd() * 972;
        stroke(ctx, [[x, y], [x + 10 + rnd() * 30, y + (rnd() - 0.5) * 6]], 2, '#E2AA82');
      }
    },
  },

  // ------------------------------------------------------------ rooms
  book: {
    wall(ctx) {
      ctx.fillStyle = '#DACE93';
      ctx.fillRect(0, 0, 1620, 972);
      ctx.beginPath();
      ctx.moveTo(0, 190);
      ctx.quadraticCurveTo(810, 90, 1620, 190);
      ctx.lineTo(1620, 972);
      ctx.lineTo(0, 972);
      ctx.closePath();
      ctx.fillStyle = '#F0AB7C';
      ctx.fill();
    },
    furuhonya(ctx) {
      for (let k = 0; k < 4; k++) roundRect(ctx, 20, 640 - k * 24, 130, 22, 6, ['#F6F1E7', '#BFE0D8', '#F6F1E7', '#9CCB8A'][k], 3);
      standee(ctx, 'furuhonya', 280, 700, 1.9);
    },
  },

  // ------------------------------------------------------------ battle worlds (on the first plan, each part painted in this order, far to near: see paintWorld)
  world1: {
    sky(ctx) {
      sky(ctx, 0, WORLD_W, 1500, '#CFE9FF', '#F4FAFF', 71);
    },
    hills(ctx) {
      hills(ctx, 0, WORLD_W, 330, shade(PAL[1].accent, 30), 72);
    },
    meadow(ctx) {
      groundPiece(ctx, 0, 300, WORLD_W, 1210, 1);
    },
    road(ctx) {
      roadStrip(ctx, 2090, 330, WORLD_W - 2090, 1180, PAL[1].path);
      for (let y = 380; y < 1450; y += 120) {
        roundRect(ctx, WORLD_W - 50, y, 14, 46, 5, '#B98F63', 3);
        roundRect(ctx, WORLD_W - 60, y + 14, 34, 8, 3, '#B98F63', 0);
      }
    },
    cave(ctx) {
      cave(ctx, 0, 430, 140, 1400);
    },
    front(ctx) {
      grassTufts(ctx, -10, WORLD_W + 10, 1290, '#9FD38B', 73);
    },
  },
  world2: {
    sky(ctx) {
      sky(ctx, 0, WORLD_W, 1500, '#D7EED3', '#F3FAEE', 81);
    },
    far_trees(ctx) {
      for (let x = 0; x < WORLD_W + 40; x += 120) tree(ctx, x, 480, 260 + ((x / 120) % 3) * 50, shade(PAL[2].accent, 18));
    },
    floor(ctx) {
      groundPiece(ctx, 0, 300, WORLD_W, 1210, 2);
    },
    trees_right(ctx) {
      roadStrip(ctx, 2090, 330, WORLD_W - 2090, 1180, PAL[2].path);
      for (let x = 2240; x < WORLD_W - 160; x += 230) tree(ctx, x, 440, 230, shade(PAL[2].accent, 8));
      for (let y = 220; y < 1500; y += 230) tree(ctx, WORLD_W - 160 + ((y / 230) % 2) * 60, y + 200, 300, PAL[2].accent);
    },
    exit(ctx) {
      forestExit(ctx, 0, 430, 110, 1400, PAL[2].accent);
    },
    front(ctx) {
      grassTufts(ctx, -10, WORLD_W + 10, 1290, '#A9C98A', 83, false);
    },
  },
  world3: {
    sky(ctx) {
      sky(ctx, 0, WORLD_W, 1500, '#FFD9B8', '#FFF4E6', 91);
    },
    town(ctx) {
      const rnd = seeded(92);
      for (let x = 0; x < WORLD_W; ) {
        const w = 140 + rnd() * 100;
        building(ctx, x, 480, w, 200 + rnd() * 160, ['#F6E1D3', '#E9F0F7', '#F8EDC9', '#F3D9DE'][Math.floor(rnd() * 4)], shade(PAL[3].accent, -10));
        x += w + 22;
      }
    },
    street(ctx) {
      groundPiece(ctx, 0, 300, WORLD_W, 1210, 3);
    },
    alley(ctx) {
      roadStrip(ctx, 2100, 230, WORLD_W - 2100, 1180, PAL[3].path);
      for (let y = 300; y < 1400; y += 280) {
        roundRect(ctx, WORLD_W - 40, y, 12, 170, 4, '#6A6F78', 3);
        roundRect(ctx, WORLD_W - 62, y - 24, 56, 32, 10, '#FFF1B8', 3);
      }
    },
    ramen_shop(ctx) {
      ramenFront(ctx, 0, 430, 120, 1400);
    },
    front(ctx) {
      ctx.fillStyle = '#D8C8AE';
      ctx.fillRect(-10, 1310, WORLD_W + 20, 200);
      for (let x = 0; x < WORLD_W; x += 90) roundRect(ctx, x + 6, 1320, 78, 40, 10, '#E8DCC6', 3);
      for (const x of [300, 900, 1500, 2100, 2700]) {
        roundRect(ctx, x, 1270, 90, 70, 14, '#C98A61', 4);
        circle(ctx, x + 45, 1250, 46, '#7FB069', 4);
        star(ctx, x + 45, 1240, 12, 5, 5, '#FFD86B', 2);
      }
    },
  },
  world4: {
    sky(ctx) {
      nightSky(ctx, WORLD_W, 1500, 101);
    },
    bushes(ctx) {
      const rnd = seeded(102);
      for (let x = -40; x < WORLD_W + 80; x += 110) {
        const r = 60 + rnd() * 34;
        circle(ctx, x, 330 - r * 0.45, r, shade(PAL[4].accent, -8 + rnd() * 10), 4);
      }
      // The neighbours' homes, far off, their windows lit.
      for (const [cx, rx] of [
        [880, 150],
        [1760, 120],
        [2620, 160],
      ] as const) {
        dome(ctx, cx, 345, rx, rx * 0.72, '#C4CAEB', 4);
        litWindow(ctx, cx - rx * 0.45, 345 - rx * 0.45, rx * 0.22);
      }
    },
    grass(ctx) {
      groundPiece(ctx, 0, 300, WORLD_W, 1210, 4);
    },
    path(ctx) {
      roadStrip(ctx, 2090, 330, WORLD_W - 2090, 1180, PAL[4].path);
      const rnd = seeded(104);
      for (let y = 400; y < 1460; y += 150) ellipse(ctx, WORLD_W - 70 + rnd() * 30, y + rnd() * 40, 22, 14, '#9AA5D4', 3);
    },
    home(ctx) {
      domeHome(ctx, 1400);
    },
    front(ctx) {
      grassTufts(ctx, -10, WORLD_W + 10, 1290, '#7E8CC6', 103, false);
    },
  },
  // The beach cave, with the sea along the bottom: its edge is the bottom lane (y 1040–1210).
  world5: {
    sky(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 330);
      g.addColorStop(0, ISLAND.skyTop);
      g.addColorStop(1, ISLAND.skyLow);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD_W, 1500);
      const rnd = seeded(121);
      for (let x = 40 + rnd() * 120; x < WORLD_W; x += 380 + rnd() * 220) softCloud(ctx, x, 80 + rnd() * 110, 200 + rnd() * 150);
    },
    sea(ctx) {
      const g = ctx.createLinearGradient(0, 215, 0, 340);
      g.addColorStop(0, '#56779E');
      g.addColorStop(1, ISLAND.sea);
      ctx.fillStyle = g;
      ctx.fillRect(0, 215, WORLD_W, 285);
      ripples(ctx, 0, WORLD_W, 232, 330, 22, 122, 0.7, 0.8);
    },
    sand(ctx) {
      ctx.save();
      beachShape(ctx, 0, WORLD_W, 1510);
      ctx.clip();
      sandTexture(ctx, 0, 290, WORLD_W, 1220, 123, ISLAND.sand);
      surfLine(ctx, 0, WORLD_W, 124);
      ctx.restore();
    },
    shore(ctx) {
      ctx.save();
      beachShape(ctx, 2090, WORLD_W, 1510, shoreLeft);
      ctx.clip();
      sandTexture(ctx, 2080, 290, WORLD_W - 2080, 1220, 125, ISLAND.dry);
      surfLine(ctx, 2080, WORLD_W, 126);
      // The sea at the far right: wet sand, then the water with a line of foam along the beach.
      const edge = (dx: number) => {
        ctx.beginPath();
        for (let y = 280; y <= 1520; y += 20) ctx.lineTo(seaEdge(y) + dx, y);
      };
      ctx.save();
      ctx.globalAlpha = 0.5;
      edge(-16);
      line(ctx, 30, ISLAND.wet);
      ctx.stroke();
      ctx.restore();
      edge(0);
      ctx.lineTo(WORLD_W + 20, 1520);
      ctx.lineTo(WORLD_W + 20, 280);
      ctx.closePath();
      ctx.fillStyle = ISLAND.water;
      ctx.fill();
      ripples(ctx, 3010, WORLD_W, 340, 1500, 44, 127);
      ctx.save();
      ctx.globalAlpha = 0.92;
      edge(2);
      line(ctx, 9, ISLAND.foam);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    },
    cave(ctx) {
      seaCave(ctx);
    },
    // Painted last, so the cliff's foot goes under it.
    shoreline(ctx) {
      shoreSea(ctx, 1040, 128);
    },
  },
  // The big hunt: a forest clearing. No car parks here (Rakko is not on this hunt).
  world6: {
    sky(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 320);
      g.addColorStop(0, WILD.skyTop);
      g.addColorStop(1, WILD.skyLow);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD_W, 1500);
    },
    trees(ctx) {
      // From the back: the teal shade between the trees, the far trunks, the big pale-pink trunks, the crowns over
      // them all, and the bushes along the forest's foot (their bottoms behind the clearing's edge).
      forestShade(ctx, 0, WORLD_W, 150, 480, 131);
      const rnd = seeded(132);
      for (let x = 60 + rnd() * 80; x < WORLD_W; x += 190 + rnd() * 120) trunk(ctx, x, 170, 330, 52 + rnd() * 16, WILD.trunkFar, 133 + x);
      for (const x of [230, 960, 1680, 2440]) trunk(ctx, x + rnd() * 60, 150, 340, 120 + rnd() * 30, WILD.trunk, 134 + x);
      crowns(ctx, 0, WORLD_W, 40, 215, 135);
      for (let x = -40 + rnd() * 40; x < WORLD_W + 60; x += 170 + rnd() * 110) {
        const r = 44 + rnd() * 16;
        bush(
          ctx,
          [
            [x - r * 0.8, 302, r * 0.85],
            [x, 290 - rnd() * 14, r],
            [x + r * 0.85, 304, r * 0.8],
          ],
          136 + x,
          rnd() < 0.6 ? 1 : 0,
        );
      }
    },
    ground(ctx) {
      ctx.save();
      ctx.beginPath();
      for (let x = 0; x <= WORLD_W + 20; x += 20) ctx.lineTo(x, clearingTop(x));
      ctx.lineTo(WORLD_W + 20, 1510);
      ctx.lineTo(0, 1510);
      ctx.closePath();
      ctx.clip();
      clearing(ctx, 0, 290, WORLD_W, 1220, 141);
      ctx.restore();
    },
    tall_grass(ctx) {
      // The tall grass the big ones come out of: along the top and the bottom of the road and down its far right edge,
      // leaving the middle (x 2130–3060, y 360–1210) open ground for the line-up.
      const rnd = seeded(151);
      for (let x = 2160; x < WORLD_W + 40; x += 52 + rnd() * 30) grassClump(ctx, x, 360 + rnd() * 10, 160 + rnd() * 70, 152 + x);
      for (let y = 420; y < 1500; y += 70 + rnd() * 30) grassClump(ctx, 3010 + rnd() * 40, y, 160 + rnd() * 60, 153 + y);
      for (let x = 2160; x < WORLD_W + 40; x += 52 + rnd() * 30) grassClump(ctx, x, 1330 + rnd() * 10, 96 + rnd() * 14, 154 + x);
    },
    landing(ctx) {
      landingSpot(ctx);
    },
    front(ctx) {
      const top = (x: number) => 1310 + 6 * Math.sin(x / 70) + 3 * Math.sin(x / 26);
      ctx.save();
      ctx.beginPath();
      for (let x = -10; x <= WORLD_W + 30; x += 20) ctx.lineTo(x, top(x));
      ctx.lineTo(WORLD_W + 30, 1520);
      ctx.lineTo(-10, 1520);
      ctx.closePath();
      ctx.clip();
      clearing(ctx, -10, 1290, WORLD_W + 40, 230, 171);
      ctx.restore();
      // Grass tips along the bottom edge, leaving room for little mushrooms and the frog.
      const rnd = seeded(172);
      const spots: [number, 'mushroom' | 'frog'][] = [
        [260, 'mushroom'],
        [880, 'mushroom'],
        [1540, 'frog'],
        [2200, 'mushroom'],
        [2760, 'mushroom'],
      ];
      for (let x = -10; x < WORLD_W + 20; x += 34 + rnd() * 22) {
        const tall = 70 + rnd() * 80;
        const lean = (rnd() - 0.5) * 30;
        const fill = GRASS[Math.floor(rnd() * GRASS.length)];
        if (spots.some(([sx]) => Math.abs(x - sx) < 70)) continue;
        blade(ctx, x, 1512, tall, 28 + rnd() * 10, lean, fill);
      }
      for (const [sx, kind] of spots) {
        if (kind === 'frog') frog(ctx, sx, 1452, 1.2);
        else stripedMushroom(ctx, sx, 1462, 70 + rnd() * 34);
      }
    },
  },
};
