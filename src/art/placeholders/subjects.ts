// Procedural stand-ins for every character. Drawn at "unit" scale: feet at (0,0), about 150 px
// tall, y up = negative. The frame renderer scales them to the sprite's size tier.
// These are placeholders that show palette, silhouette, pose and where items sit — not final art.

import {
  arc,
  blush,
  BLUSH,
  circle,
  type Ctx,
  ellipse,
  eyes,
  glow,
  INK,
  line,
  mouth,
  type Mood,
  poly,
  roundRect,
  shade,
  star,
  stroke,
  WHITE,
} from './kit';
import type { Pose } from './pose';

/** Horizontal shift of the facial features toward the side a character faces. 0 = straight at the viewer (portraits). */
let FX = 0;
export function setFacing(dir: -1 | 0 | 1): void {
  FX = dir * 14;
}

export interface DrawOpts {
  headOnly?: boolean;
  /** Posed for a scene (no battle props in hand). */
  standee?: boolean;
}

type Drawer = (ctx: Ctx, p: Pose, o: DrawOpts) => void;

/** Head centre (unit coords) per subject, used to frame portraits. */
export const HEAD_CENTER: Record<string, { y: number; r: number }> = {};
const DEFAULT_HEAD = { y: -92, r: 62 };

// ---------------------------------------------------------------- shared body parts

function feet(ctx: Ctx, p: Pose, color: string, spread = 18, rx = 15): void {
  const lift = 6;
  ellipse(ctx, -spread + p.legs * 2, -6 - Math.max(0, p.legs) * lift, rx, 8, color, 3.5);
  ellipse(ctx, spread + p.legs * 2, -6 - Math.max(0, -p.legs) * lift, rx, 8, color, 3.5);
}

function torso(ctx: Ctx, color: string, rx = 34, ry = 30, y = -38): void {
  ellipse(ctx, 0, y, rx, ry, color, 4);
}

function arms(ctx: Ctx, p: Pose, color: string, y = -44, x = 33): void {
  const up = p.armUp;
  // Shoulders: the inner top end of each arm's oval.
  ellipse(ctx, -x - up * 4, y - up * 18, 10, 14, color, 3.5, 0.5 + up * 0.8);
  ellipse(ctx, x + up * 4, y - up * 18, 10, 14, color, 3.5, -0.5 - up * 0.8);
}

function head(ctx: Ctx, color: string, rx = 54, ry = 46, y = -92): void {
  ellipse(ctx, 0, y, rx, ry, color, 4.5);
}

function face(ctx: Ctx, p: Pose, def: Mood, opts: { y?: number; gap?: number; r?: number; mouthKind?: Parameters<typeof mouth>[3]; blushGap?: number } = {}): void {
  const y = opts.y ?? -90;
  const mood = p.mood ?? def;
  eyes(ctx, FX, y, opts.gap ?? 17, opts.r ?? 6, mood);
  if (opts.blushGap !== 0) {
    const bg = opts.blushGap ?? 33;
    blushPair(ctx, y + 12, bg);
  }
  const m = p.mouthOpen ? 'open' : opts.mouthKind ?? 'w';
  mouth(ctx, FX, y + 15, m);
}

function blushPair(ctx: Ctx, y: number, gap: number): void {
  ctx.save();
  ctx.globalAlpha = 0.9;
  for (const s of [-1, 1]) {
    const x = FX + s * gap;
    ellipse(ctx, x, y, 10, 6, BLUSH, 0);
    for (let i = -1; i <= 1; i++) stroke(ctx, [[x + i * 5 - 2, y + 3], [x + i * 5 + 2, y - 3]], 1.6, '#E07A92');
  }
  ctx.restore();
}

function clipEllipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fn: () => void): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  fn();
  ctx.restore();
}

export function weedTuft(ctx: Ctx, x: number, y: number, s = 1): void {
  const leaf = '#76BF63';
  for (const a of [-0.7, -0.25, 0.2, 0.65]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ellipse(ctx, 0, -14 * s, 5 * s, 15 * s, leaf, 2.4);
    ctx.restore();
  }
  ellipse(ctx, x, y + 2 * s, 6 * s, 4 * s, '#B38A5E', 2);
}

/** A tail that tapers along a cubic curve through p0…p3, w0 wide at the root and w1 at the tip, outlined. Returns
 *  the points along its right-hand side (seen going from root to tip), where a ridge of spikes can go. */
function taperedTail(ctx: Ctx, pts: [number, number][], w0: number, w1: number, fill: string, lw = 4): [number, number][] {
  const [a, b, c, d] = pts;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  const n = 32;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0];
    const y = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1];
    const dx = 3 * u * u * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0]);
    const dy = 3 * u * u * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1]);
    const len = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * t) / 2;
    left.push([x + (dy / len) * w, y - (dx / len) * w]);
    right.push([x - (dy / len) * w, y + (dx / len) * w]);
  }
  poly(ctx, [...left, ...[...right].reverse()], fill, lw);
  return right;
}

/** A jointed leg (hip → knee → foot) drawn as an outlined tube. */
function tube(ctx: Ctx, pts: [number, number][], w: number, fill: string): void {
  stroke(ctx, pts, w + 5, INK);
  stroke(ctx, pts, w, fill);
}

// ---------------------------------------------------------------- allies

const chiikawa: Drawer = (ctx, p, o) => {
  if (!o.headOnly) {
    feet(ctx, p, WHITE);
    torso(ctx, WHITE);
    arms(ctx, p, WHITE);
  }
  ellipse(ctx, -31, -127, 13, 12, WHITE, 4);
  ellipse(ctx, 31, -127, 13, 12, WHITE, 4);
  head(ctx, WHITE);
  face(ctx, p, 'worried');
};

/** A torch's flame at (x, y) (its foot), k = 1 about 40 tall. */
function torchFlame(ctx: Ctx, x: number, y: number, k: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.quadraticCurveTo(-16, -2, -5, -18);
  ctx.quadraticCurveTo(-1, -10, 2, -28);
  ctx.quadraticCurveTo(16, -8, 9, 6);
  ctx.quadraticCurveTo(5, 10, 0, 8);
  ctx.closePath();
  ctx.fillStyle = '#F47A35';
  ctx.fill();
  line(ctx, 3);
  ctx.stroke();
  ellipse(ctx, 1, -3, 5, 8, '#FFD45E', 0);
  ctx.restore();
}

// ちいかわ（人魚の島）: Chiikawa in island dress, a pink flower crown and a green grass skirt (as on the cover of manga
// volume 8), holding up a lit torch in the near hand (the torch is this game's own): it thrusts it forward to throw.
const chiikawaIsland: Drawer = (ctx, p, o) => {
  if (!o.headOnly) {
    feet(ctx, p, WHITE);
    torso(ctx, WHITE);
    // The grass skirt: green strands hanging from the waist.
    for (let i = -4; i <= 4; i++) roundRect(ctx, i * 7.5 - 5, -40, 10, 31, 4, i % 2 ? '#8DBF5A' : '#76AE47', 2.4);
    // The torch: a wooden handle with its flame, thrust forward and up on the attack.
    const tx = 56 + p.extend * 20;
    const ty = -128 - p.extend * 10;
    stroke(ctx, [[36, -32], [tx, ty]], 7, '#8A5A3C');
    stroke(ctx, [[36, -32], [tx, ty]], 2.5, '#B98A62');
    glow(ctx, tx, ty - 14, 26 + (p.impact ? 12 : 0), '#FFB347', 0.85);
    torchFlame(ctx, tx, ty - 2, p.impact ? 1.25 : 1);
    arms(ctx, p, WHITE);
  }
  ellipse(ctx, -31, -127, 13, 12, WHITE, 4);
  ellipse(ctx, 31, -127, 13, 12, WHITE, 4);
  head(ctx, WHITE);
  // The flower crown: pink blossoms round the top of the head.
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.1 + (i / 6) * 0.8);
    const x = Math.cos(a) * 50;
    const y = -92 + Math.sin(a) * 42;
    for (let k = 0; k < 5; k++) circle(ctx, x + Math.cos(k * 1.26) * 5, y + Math.sin(k * 1.26) * 5, 4.2, '#F7B6C8', 1.6);
    circle(ctx, x, y, 2.6, '#FFF3C8', 0);
  }
  face(ctx, p, 'worried');
};

const hachiware: Drawer = (ctx, p, o) => {
  const blue = '#8DB3D8';
  if (!o.headOnly) {
    feet(ctx, p, WHITE);
    torso(ctx, WHITE);
    // さすまた: pole with a U fork; thrusts up the lane on attack.
    const top = -156 - p.extend * 18;
    const px = 58;
    stroke(ctx, [[px, -4], [px, top + 8]], 6, '#9C7452');
    stroke(ctx, [[px, -4], [px, top + 8]], 2, '#C7A27E');
    ctx.beginPath();
    ctx.arc(px, top, 15, 0, Math.PI);
    line(ctx, 5, '#8F98A5');
    ctx.stroke();
    stroke(ctx, [[px - 15, top], [px - 15, top - 9]], 5, '#8F98A5');
    stroke(ctx, [[px + 15, top], [px + 15, top - 9]], 5, '#8F98A5');
    if (p.impact) glow(ctx, px, top - 10, 30, '#FFF6B0', 0.9);
    arms(ctx, p, WHITE);
  }
  poly(ctx, [[-50, -118], [-38, -152], [-18, -132]], blue, 4);
  poly(ctx, [[50, -118], [38, -152], [18, -132]], blue, 4);
  head(ctx, WHITE);
  clipEllipse(ctx, 0, -92, 54, 46, () => {
    poly(ctx, [[-70, -150], [70, -150], [70, -102], [10, -104], [0, -90], [-10, -104], [-70, -102]], blue, 0);
  });
  ellipse(ctx, 0, -92, 54, 46, null, 4.5);
  face(ctx, p, 'normal', { y: -86 });
};

const usagi: Drawer = (ctx, p, o) => {
  const c = '#FFF1BD';
  if (!o.headOnly) {
    feet(ctx, p, c);
    torso(ctx, c);
    // 討伐棒: raised on attack, blast from the tip on the impact frame.
    const tx = 58 + p.armUp * 4;
    const ty = -146 - p.armUp * 14 - p.extend * 8;
    stroke(ctx, [[36, -40], [tx, ty]], 8, '#5B4A42');
    stroke(ctx, [[36, -40], [tx, ty]], 3, '#8A776B');
    circle(ctx, tx, ty, 6, '#E9D7C9', 3);
    if (p.impact) {
      glow(ctx, tx, ty, 40, '#FFC25E', 1);
      star(ctx, tx, ty, 16, 7, 6, '#FFE08A', 3);
    }
    arms(ctx, p, c);
  }
  for (const s of [-1, 1]) {
    roundRect(ctx, s * 14 - 9, -176, 18, 60, 9, c, 4);
    roundRect(ctx, s * 14 - 4, -168, 8, 42, 4, '#F6B4C2', 0);
  }
  head(ctx, c);
  face(ctx, p, 'normal', { gap: 15, r: 6.5, mouthKind: 'wide' });
};

// ハチワレ（パジャマ）: Hachiware in Pochette 鎧さん's pale-blue pajamas, the cat-eared hood up round the face, holding a
// deck brush (the trio faced the giant bird with deck brushes): it thrusts the brush up the lane on the attack.
const hachiwarePajama: Drawer = (ctx, p, o) => {
  const pj = '#BFE3F4';
  const blue = '#8DB3D8';
  if (!o.headOnly) {
    feet(ctx, p, pj);
    torso(ctx, pj);
    // The deck brush: a long handle, the brush head across its top, bristles out.
    const top = -150 - p.extend * 18;
    const px = 60 + p.extend * 8;
    stroke(ctx, [[px - 20, -6], [px, top + 12]], 6, '#9C7452');
    stroke(ctx, [[px - 20, -6], [px, top + 12]], 2, '#C7A27E');
    for (let i = -3; i <= 3; i++) stroke(ctx, [[px + i * 6, top + 2], [px + i * 6 + 2, top - 10]], 2.6, '#8A6B3A');
    roundRect(ctx, px - 24, top, 48, 14, 5, '#E9C46A', 3);
    if (p.impact) glow(ctx, px, top - 8, 30, '#FFF6B0', 0.9);
    arms(ctx, p, pj);
  }
  // The hood round the face, its cat ears on top.
  poly(ctx, [[-54, -110], [-46, -160], [-16, -138]], pj, 4);
  poly(ctx, [[54, -110], [46, -160], [16, -138]], pj, 4);
  ellipse(ctx, 0, -94, 62, 54, pj, 4.5);
  // Hachiware's face in it, blue on top.
  ellipse(ctx, 0, -88, 46, 38, WHITE, 0);
  clipEllipse(ctx, 0, -88, 46, 38, () => {
    poly(ctx, [[-60, -140], [60, -140], [60, -100], [9, -102], [0, -90], [-9, -102], [-60, -100]], blue, 0);
  });
  ellipse(ctx, 0, -88, 46, 38, null, 4);
  face(ctx, p, 'normal', { y: -82, gap: 15, r: 5.5 });
};

// うさぎ（クール）: Usagi in black sunglasses (this look is the game's own), striking a cool pose with nothing in
// hand: her missiles come from the sky.
const usagiCool: Drawer = (ctx, p, o) => {
  const c = '#FFF1BD';
  if (!o.headOnly) {
    feet(ctx, p, c);
    torso(ctx, c);
    arms(ctx, { ...p, armUp: Math.max(p.armUp, 0.3) }, c);
  }
  for (const s of [-1, 1]) {
    roundRect(ctx, s * 14 - 9, -176, 18, 60, 9, c, 4);
    roundRect(ctx, s * 14 - 4, -168, 8, 42, 4, '#F6B4C2', 0);
  }
  head(ctx, c);
  face(ctx, p, 'normal', { gap: 15, r: 6.5, mouthKind: 'wide' });
  // The sunglasses over the eyes: two dark lenses, a bridge and a glint on each.
  for (const s of [-1, 1]) roundRect(ctx, FX + s * 17 - 15, -101, 30, 21, 9, '#2B2A33', 3);
  stroke(ctx, [[FX - 3, -93], [FX + 3, -93]], 3);
  for (const s of [-1, 1]) stroke(ctx, [[FX + s * 17 - 9, -96], [FX + s * 17 - 2, -96]], 2.4, 'rgba(255,255,255,0.85)');
};

const momonga: Drawer = (ctx, p, o) => {
  const blue = '#BFE4F6';
  if (!o.headOnly) {
    // Fluffy tail behind.
    ellipse(ctx, -46, -64, 22, 44, '#F4F6F8', 4, -0.4);
    feet(ctx, p, WHITE);
    if (p.armUp > 0.2) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      poly(ctx, [[-38 - p.armUp * 18, -70], [-30, -12], [-14, -30]], '#DCE7EE', 3);
      poly(ctx, [[38 + p.armUp * 18, -70], [30, -12], [14, -30]], '#DCE7EE', 3);
      ctx.restore();
    }
    torso(ctx, WHITE);
    arms(ctx, p, WHITE);
    if (p.anim === 'attack' && p.frame < 2) {
      ellipse(ctx, -44, -62 - p.armUp * 18, 7, 8, '#9C6B45', 2.5);
      ellipse(ctx, 44, -62 - p.armUp * 18, 7, 8, '#9C6B45', 2.5);
    }
  }
  for (const s of [-1, 1]) {
    ellipse(ctx, s * 36, -128, 15, 17, WHITE, 4);
    ellipse(ctx, s * 36, -127, 8, 10, blue, 0);
  }
  head(ctx, WHITE);
  for (const s of [-1, 1]) {
    for (const k of [-1, 0, 1]) stroke(ctx, [[s * 40, -80 + k * 6], [s * 60, -82 + k * 9]], 2);
  }
  ellipse(ctx, 0, -84, 6, 5, blue, 2.5);
  eyes(ctx, FX, -94, 19, 8, p.mood ?? 'sparkle');
  blushPair(ctx, -80, 32);
  mouth(ctx, FX, -72, p.mouthOpen ? 'open' : 'w');
};

const kurimanju: Drawer = (ctx, p, o) => {
  const c = '#FCE6C6';
  const cap = '#A46F4D';
  if (!o.headOnly) {
    feet(ctx, p, c);
    torso(ctx, c);
    arms(ctx, p, c);
    // Cup-sake can: held at the side, overhead on the wind-up, gone after the throw.
    if (!(p.anim === 'attack' && p.frame >= 2)) {
      const cx = p.anim === 'attack' ? 14 : 40;
      const cy = p.anim === 'attack' ? -150 - p.armUp * 6 : -46;
      roundRect(ctx, cx - 9, cy - 14, 18, 26, 4, '#EEF5FA', 3);
      roundRect(ctx, cx - 9, cy - 6, 18, 9, 0, '#6FA6D6', 0);
    }
  }
  ellipse(ctx, -54, -96, 10, 9, c, 3.5);
  ellipse(ctx, 54, -96, 10, 9, c, 3.5);
  head(ctx, c);
  clipEllipse(ctx, 0, -92, 54, 46, () => {
    ctx.beginPath();
    ctx.moveTo(-70, -150);
    ctx.lineTo(70, -150);
    ctx.lineTo(70, -110);
    for (let x = 60; x >= -60; x -= 20) ctx.quadraticCurveTo(x - 10, -101, x - 20, -110);
    ctx.closePath();
    ctx.fillStyle = cap;
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ellipse(ctx, -18, -128, 14, 5, '#D9A27E', 0);
  });
  ellipse(ctx, 0, -92, 54, 46, null, 4.5);
  face(ctx, p, p.anim === 'idle' ? 'happy' : 'normal', { y: -86, gap: 16, r: 5 });
};

const shisa: Drawer = (ctx, p, o) => {
  const c = '#FFF1D8';
  const mane = '#F09A55';
  if (!o.headOnly) {
    feet(ctx, p, c);
    torso(ctx, c);
    arms(ctx, p, c);
    if (!o.standee && !(p.anim === 'attack' && p.frame >= 2)) {
      const gx = p.anim === 'attack' ? 30 : 44;
      const gy = p.anim === 'attack' ? -140 - p.armUp * 10 : -50;
      ellipse(ctx, gx, gy, 11, 24, '#7CBC57', 3, 0.35);
      for (let i = -2; i <= 2; i++) circle(ctx, gx + i * 1.5, gy + i * 8, 2.2, '#5E9C40', 0);
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    circle(ctx, Math.cos(a) * 55, -92 + Math.sin(a) * 47, 15, mane, 3.5);
  }
  poly(ctx, [[-44, -122], [-36, -148], [-20, -134]], c, 3.5);
  poly(ctx, [[44, -122], [36, -148], [20, -134]], c, 3.5);
  head(ctx, c);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * 17, -106, 7, Math.PI, Math.PI * 2);
    line(ctx, 3.5, mane);
    ctx.stroke();
  }
  face(ctx, p, 'normal', { y: -88 });
};

/** A 鎧さん's armour: steel, or another metal (偉い鎧さん's gold, with a crown on top in place of the knob). */
interface Metal {
  steel: string;
  dark: string;
  crown?: boolean;
}
const STEEL: Metal = { steel: '#C9D0DA', dark: '#A5AEBB' };
const GOLD: Metal = { steel: '#EBCB6E', dark: '#C9A23C', crown: true };

function armor(ctx: Ctx, p: Pose, o: DrawOpts, extra?: (ctx: Ctx) => void, metal: Metal = STEEL): void {
  const { steel, dark } = metal;
  if (!o.headOnly) {
    ellipse(ctx, -17, -6, 14, 8, dark, 3.5);
    ellipse(ctx, 17, -6, 14, 8, dark, 3.5);
    roundRect(ctx, -32, -74, 64, 66, 22, steel, 4);
    stroke(ctx, [[-30, -44], [30, -44]], 3, dark);
    ellipse(ctx, -36, -52, 11, 16, steel, 3.5, 0.3);
    ellipse(ctx, 36, -52, 11, 16, steel, 3.5, -0.3);
  }
  ellipse(ctx, 0, -104, 40, 38, steel, 4.5);
  roundRect(ctx, -28, -110, 56, 12, 6, '#4C5361', 0);
  if (metal.crown) {
    // A crown-like ornament on top.
    poly(ctx, [[-20, -136], [-23, -160], [-10, -148], [0, -165], [10, -148], [23, -160], [20, -136]], '#F2C94C', 3.5);
    circle(ctx, 0, -152, 3.5, '#E6787A', 2);
  } else {
    stroke(ctx, [[0, -142], [0, -124]], 4, dark);
    circle(ctx, 0, -146, 5, '#E6787A', 3);
  }
  ctx.save();
  ctx.globalAlpha = 0.5;
  ellipse(ctx, -16, -124, 10, 5, WHITE, 0, -0.4);
  ctx.restore();
  if (p.damaged >= 1) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ellipse(ctx, 14, -88, 7, 5, '#7E8796', 0);
    ellipse(ctx, -12, -36, 6, 4, '#7E8796', 0);
    ctx.restore();
  }
  if (p.damaged >= 2) {
    stroke(ctx, [[-20, -130], [-12, -118], [-18, -108], [-8, -98]], 2.5);
    stroke(ctx, [[10, -60], [18, -50], [12, -40], [22, -30]], 2.5);
  }
  if (extra) extra(ctx);
}

const yoroi: Drawer = (ctx, p, o) => armor(ctx, p, o);
// 偉い鎧さん: gold armour, like a boss to the other 鎧さん, a crown-like ornament on the head.
const yoroiErai: Drawer = (ctx, p, o) => armor(ctx, p, o, undefined, GOLD);

const ode: Drawer = (ctx, p, o) => {
  const c = '#CFA77D';
  const tilt = p.damaged >= 3 ? 0.06 : 0;
  ctx.save();
  ctx.rotate(tilt);
  if (!o.headOnly) {
    feet(ctx, p, shade(c, -18), 24, 18);
    ellipse(ctx, 0, -50, 50, 46, c, 4.5);
    ellipse(ctx, 0, -40, 32, 28, shade(c, 18), 0);
    ellipse(ctx, -52, -56, 15, 24, c, 4, 0.35);
    ellipse(ctx, 52, -56, 15, 24, c, 4, -0.35);
  }
  ellipse(ctx, 0, -116, 36, 32, c, 4.5);
  for (const x of [-14, 0, 14]) ellipse(ctx, x, -146, 9, 10, '#6E4E3A', 3);
  eyes(ctx, FX, -118, 13, 4.5, p.mood ?? (p.damaged >= 3 ? 'closed' : 'normal'));
  blushPair(ctx, -106, 24);
  mouth(ctx, FX, -100, p.mouthOpen ? 'open' : 'grin', 0.9);
  if (p.damaged >= 1) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ellipse(ctx, 22, -60, 9, 6, '#8A6648', 0);
    ellipse(ctx, -26, -34, 8, 5, '#8A6648', 0);
    ctx.restore();
  }
  if (p.damaged >= 2) {
    roundRect(ctx, 14, -134, 22, 9, 3, '#FFF6E6', 2.5);
    roundRect(ctx, -30, -64, 22, 9, 3, '#FFF6E6', 2.5);
  }
  ctx.restore();
};

// パジャマパーティーズ: four small Chiikawa-folk in pajamas, drawn as one group. Two stand in front, two behind them
// (peeking out between the front two's heads). Each is told apart by its pajamas and its head: みどり two horns,
// ぴんく droopy ears, しろ a pointed cream-horn tip, むらさき round ears like Chiikawa's.
interface Idol {
  x: number;
  /** Where its feet are: the back row stands behind, a little higher. */
  y: number;
  /** Size; the front row is a little bigger. */
  k: number;
  pj: string;
  dots: string;
  look: 'horns' | 'droopy' | 'point' | 'round';
}

const IDOLS: Idol[] = [
  { x: -21, y: -50, k: 0.95, pj: '#CDB8EC', dots: '#E9E0F8', look: 'round' },
  { x: 22, y: -52, k: 0.95, pj: '#F4F2EE', dots: '#A9CBEA', look: 'point' },
  { x: -31, y: 0, k: 1.1, pj: '#A8D89C', dots: '#D5EFCB', look: 'horns' },
  { x: 31, y: 0, k: 1.1, pj: '#F7AFC6', dots: '#FCD9E4', look: 'droopy' },
];

function idolBody(ctx: Ctx, d: Idol): void {
  const { x, y, k } = d;
  const front = d.y === 0;
  if (front) for (const s of [-1, 1]) ellipse(ctx, x + s * 9 * k, y - 5 * k, 9 * k, 5 * k, d.pj, 3);
  for (const s of [-1, 1]) {
    const ax = x + s * 22 * k;
    const ay = y - 26 * k;
    const sleeve = () => {
      ellipse(ctx, ax, ay, 7 * k, 10 * k, d.pj, 3, -s * 0.5);
      if (d.look === 'droopy' && s > 0) {
        // A microphone in the near hand.
        const hx = ax + 5 * k;
        const hy = ay + 8 * k;
        stroke(ctx, [[hx, hy], [hx + 5 * k, hy - 12 * k]], 5.5 * k, INK);
        stroke(ctx, [[hx, hy], [hx + 5 * k, hy - 12 * k]], 2.5 * k, '#8C8A93');
        circle(ctx, hx + 6 * k, hy - 15 * k, 5 * k, '#C9CBD3', 2.5);
      }
    };
    sleeve();
  }
  const ty = y - 24 * k;
  ellipse(ctx, x, ty, 21 * k, 19 * k, d.pj, 3.5);
  clipEllipse(ctx, x, ty, 21 * k, 19 * k, () => {
    for (const [dx, dy] of [
      [-11, -8],
      [9, -10],
      [-4, 4],
      [13, 6],
      [-14, 9],
    ])
      circle(ctx, x + dx * k, ty + dy * k, 2.4 * k, d.dots, 0);
  });
  // Collar and buttons.
  for (const s of [-1, 1]) ellipse(ctx, x + s * 6 * k, ty - 15 * k, 7 * k, 4 * k, d.look === 'point' ? '#DCEAF6' : WHITE, 2.5, s * 0.35);
  for (const dy of [-6, 4]) circle(ctx, x, ty + dy * k, 1.9 * k, d.look === 'point' ? '#8FB6DA' : WHITE, 1.6);
}

function idolHead(ctx: Ctx, p: Pose, d: Idol): void {
  const { x, k } = d;
  const hy = d.y - 62 * k;
  if (d.look === 'round') for (const s of [-1, 1]) ellipse(ctx, x + s * 16 * k, hy - 17 * k, 7.5 * k, 7 * k, WHITE, 3);
  if (d.look === 'horns')
    for (const s of [-1, 1])
      poly(ctx, [[x + s * 5 * k, hy - 18 * k], [x + s * 13 * k, hy - 32 * k], [x + s * 16 * k, hy - 15 * k]], '#FFF2D2', 3);
  if (d.look === 'point') {
    // A pointed swirl on top, like soft cream.
    ellipse(ctx, x, hy - 19 * k, 12 * k, 5.5 * k, WHITE, 3);
    ellipse(ctx, x + 1 * k, hy - 25 * k, 9 * k, 4.5 * k, WHITE, 3);
    ellipse(ctx, x + 2 * k, hy - 30.5 * k, 6 * k, 3.8 * k, WHITE, 3);
    ctx.beginPath();
    ctx.moveTo(x - 2 * k, hy - 33 * k);
    ctx.quadraticCurveTo(x + 2 * k, hy - 39 * k, x + 7 * k, hy - 41 * k);
    ctx.quadraticCurveTo(x + 6 * k, hy - 36 * k, x + 7 * k, hy - 32 * k);
    ctx.closePath();
    ctx.fillStyle = WHITE;
    ctx.fill();
    line(ctx, 3);
    ctx.stroke();
  }
  if (d.look === 'droopy')
    for (const s of [-1, 1]) {
      ellipse(ctx, x + s * 25 * k, hy - 6 * k, 6.5 * k, 13 * k, WHITE, 3, -s * 0.65);
      ellipse(ctx, x + s * 25 * k, hy - 5 * k, 3 * k, 8 * k, '#F6B4C2', 0, -s * 0.65);
    }
  ellipse(ctx, x, hy, 26 * k, 22 * k, WHITE, 3.5);
  const fx = x + FX * 0.45 * k;
  eyes(ctx, fx, hy + 1 * k, 9 * k, 4 * k, p.mood ?? 'sparkle');
  for (const s of [-1, 1]) blush(ctx, fx + s * 16 * k, hy + 8 * k, 0.55 * k);
  mouth(ctx, fx, hy + 9 * k, p.mouthOpen ? 'open' : 'w', 0.6 * k);
}

const pajamaParties: Drawer = (ctx, p, o) => {
  for (const d of IDOLS) {
    if (!o.headOnly) idolBody(ctx, d);
    idolHead(ctx, p, d);
  }
};

// ---------------------------------------------------------------- NPC / portraits only

const rakkoHead = (ctx: Ctx, p: Pose): void => {
  const c = '#FFF3DE';
  ellipse(ctx, 0, -92, 54, 46, c, 4.5);
  ellipse(ctx, -54, -96, 6, 7, INK, 0);
  ellipse(ctx, 54, -96, 6, 7, INK, 0);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    stroke(ctx, [[Math.cos(a) * 48, -92 + Math.sin(a) * 40], [Math.cos(a) * 52, -92 + Math.sin(a) * 43]], 2.5);
  }
  star(ctx, -22, -116, 13, 4, 4, '#E2C7A0', 3, 0);
  eyes(ctx, FX, -88, 18, 6, p.mood ?? 'happy');
  blushPair(ctx, -76, 32);
  mouth(ctx, FX, -74, 'w');
};

// Rakko (as the owner's car and boat pictures show him): a round cream face with a spiky furry edge, little black ears,
// a star-shaped scar and a white muffler. As a friend he stands at the front with his sword (he hunts with one in the
// original) in his near paw, and sweeps it from overhead down through the lanes either side.
const RAKKO = '#FFF3DE';
/** His sword in the near paw: held up and forward, raised overhead on the wind-up, swept down and forward on the blow. */
const rakkoSword = (ctx: Ctx, p: Pose): void => {
  const up = p.armUp;
  // The near paw: the outer end of the near arm, as arms() draws it.
  const a = 0.5 + 0.8 * up;
  const hx = 33 + up * 4 + Math.sin(a) * 14;
  const hy = -44 - up * 18 + Math.cos(a) * 14;
  const ang = -0.95 - 1.1 * up + 2 * p.extend;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const at = (d: number): [number, number] => [hx + dx * d, hy + dy * d];
  // The blade (a pale steel middle in an ink edge), the guard across it, then the grip in the paw.
  stroke(ctx, [at(10), at(76)], 10, INK);
  stroke(ctx, [at(10), at(74)], 5, '#E4EAF0');
  stroke(ctx, [[hx + dx * 8 - dy * 11, hy + dy * 8 + dx * 11], [hx + dx * 8 + dy * 11, hy + dy * 8 - dx * 11]], 6, '#C9A64B');
  stroke(ctx, [at(-12), at(6)], 7, '#8A5A3C');
  if (p.impact) {
    const [tx, ty] = at(66);
    glow(ctx, tx, ty, 30, '#FFF6B0', 0.9);
  }
};
const rakko: Drawer = (ctx, p, o) => {
  if (!o.headOnly) {
    feet(ctx, p, shade(RAKKO, -10));
    torso(ctx, RAKKO);
    rakkoSword(ctx, p);
    arms(ctx, p, RAKKO);
    // The white muffler at his neck, its end hanging down the front.
    roundRect(ctx, -34, -54, 68, 17, 8, WHITE, 3.5);
    roundRect(ctx, 10, -44, 16, 26, 6, WHITE, 3);
  }
  rakkoHead(ctx, p);
};

const yoroiRodo: Drawer = (ctx, p, o) =>
  armor(ctx, p, o, (c) => {
    roundRect(c, -18, -86, 36, 12, 5, '#FFD566', 3);
  });
const yoroiPochette: Drawer = (ctx, p, o) =>
  armor(ctx, p, o, (c) => {
    stroke(c, [[-34, -80], [26, -40]], 4, '#E88AA3');
    roundRect(c, 14, -50, 26, 20, 7, '#F6B6C6', 3);
  });
const yoroiRamen: Drawer = (ctx, p, o) =>
  armor(ctx, p, o, (c) => {
    roundRect(c, -40, -138, 80, 12, 6, WHITE, 3);
    stroke(c, [[30, -132], [48, -122]], 4, WHITE);
  });

// 古本屋 (fans call it カニちゃん): soft pink with round ears, wearing the red crab headband Momonga gave it. Keeps the
// gallery's book and, as a friend, heals the friends around it. Limbs come from the shared helpers, so it splits.
const furuhonya: Drawer = (ctx, p, o) => {
  const c = '#FCE6E8';
  const crab = '#E8604F';
  if (!o.headOnly) {
    feet(ctx, p, c);
    torso(ctx, c);
    arms(ctx, p, c);
  }
  for (const s of [-1, 1]) {
    ellipse(ctx, s * 34, -124, 15, 14, c, 4);
    ellipse(ctx, s * 34, -123, 8, 7.5, '#F6B9C6', 0);
  }
  head(ctx, c);
  // The headband, over the top of the head.
  clipEllipse(ctx, 0, -92, 54, 46, () => {
    ctx.beginPath();
    ctx.ellipse(0, -88, 52, 43, 0, Math.PI * 1.06, Math.PI * 1.94);
    line(ctx, 15, INK);
    ctx.stroke();
    line(ctx, 8, crab);
    ctx.stroke();
  });
  ellipse(ctx, 0, -92, 54, 46, null, 4.5);
  // The crab sitting on it: legs, claws held up, eyes on stalks, its shell.
  for (const s of [-1, 1]) {
    for (const k of [0, 1, 2]) stroke(ctx, [[s * (8 + k * 5), -136], [s * (16 + k * 6), -130 + k * 2]], 3);
    stroke(ctx, [[s * 10, -142], [s * 20, -154]], 7, INK);
    stroke(ctx, [[s * 10, -142], [s * 20, -154]], 3, crab);
    ctx.save();
    ctx.translate(s * 23, -160);
    ctx.rotate(s * 0.35);
    // A pincer: a mitten with a V cut into its top.
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.quadraticCurveTo(-11, 6, -9, -5);
    ctx.lineTo(-4, -12);
    ctx.lineTo(0, -3);
    ctx.lineTo(4, -12);
    ctx.quadraticCurveTo(11, -5, 8, 3);
    ctx.quadraticCurveTo(6, 8, 0, 8);
    ctx.closePath();
    ctx.fillStyle = crab;
    ctx.fill();
    line(ctx, 3);
    ctx.stroke();
    ctx.restore();
    stroke(ctx, [[s * 5, -144], [s * 6, -153]], 2.5);
    circle(ctx, s * 6, -155, 3.2, WHITE, 2);
    circle(ctx, s * 6.5, -155, 1.6, INK, 0);
  }
  ellipse(ctx, 0, -139, 16, 9, crab, 3.5);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ellipse(ctx, -5, -142, 6, 2.5, WHITE, 0);
  ctx.restore();
  face(ctx, p, 'normal', { y: -86, r: 6.5 });
};

// ---------------------------------------------------------------- the islanders, in their boats

// ヒトハ and フタバ: islanders of the island arc (the film 『人魚の島のひみつ』), always together. As on the owner's icons:
// one round, slightly wide greyish-mauve body, dark grey-brown veined leaves on top (ヒトハ one, フタバ two) and short
// diagonal blush strokes on both cheeks, with no eyes or mouth. In battle each sits in a little wooden rowboat on the
// water lane, its waterline at the feet line.
const ISLANDER = '#988483';

/** A leaf growing from (x, y), leaning `rot` from upright and `len` long: dark grey-brown with its veins drawn in. */
function veinedLeaf(ctx: Ctx, x: number, y: number, rot: number, len: number): void {
  const w = len * 0.45;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(w * 0.6, -len * 0.25, w * 1.25, -len * 0.8, 0, -len);
  ctx.bezierCurveTo(-w * 1.25, -len * 0.8, -w * 0.6, -len * 0.25, 0, 0);
  ctx.closePath();
  ctx.fillStyle = '#75666A';
  ctx.fill();
  line(ctx, 3);
  ctx.stroke();
  stroke(ctx, [[0, 2], [0, -len * 0.86]], 2.4);
  for (const k of [0.3, 0.5, 0.68]) for (const s of [-1, 1]) stroke(ctx, [[0, -len * k], [s * w * 0.5 * (1 - k * 0.5), -len * (k + 0.15)]], 1.8);
  ctx.restore();
}

function sweatDrop(ctx: Ctx, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - 9);
  ctx.quadraticCurveTo(x + 7, y + 1, x, y + 5);
  ctx.quadraticCurveTo(x - 7, y + 1, x, y - 9);
  ctx.closePath();
  ctx.fillStyle = '#BFE3F5';
  ctx.fill();
  line(ctx, 2.4);
  ctx.stroke();
}

/** The round islander, sitting so its lower part is down in the boat. Only its blush shows which way it faces. Hurt,
 *  it breaks into a sweat, then shivers with its leaves drooping (a wall's damage pictures: neither islander is a wall
 *  since 2026-11-06, when ヒトハ took to throwing, so these go unused for now). */
function islander(ctx: Ctx, p: Pose, leaves: 1 | 2): void {
  const cy = -62;
  const shaken = p.damaged >= 2;
  // The leaves first, their stems tucked under the top of the body.
  if (leaves === 1) veinedLeaf(ctx, 3, cy - 40, shaken ? 1.25 : 0.4, 31);
  else {
    veinedLeaf(ctx, -3, cy - 40, shaken ? -1.3 : -0.62, 28);
    veinedLeaf(ctx, 3, cy - 40, shaken ? 1.15 : 0.58, 28);
  }
  // Slightly wide, and a little flatter below than above.
  ctx.beginPath();
  ctx.ellipse(0, cy, 50, 44, 0, Math.PI, Math.PI * 2);
  ctx.ellipse(0, cy, 50, 38, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = ISLANDER;
  ctx.fill();
  line(ctx, 4.5);
  ctx.stroke();
  const fx = FX * 0.7;
  for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) stroke(ctx, [[fx + s * 30 + i * 5 - 2, cy + 14], [fx + s * 30 + i * 5 + 2, cy + 7]], 2.2, '#4E3C3F');
  if (p.damaged >= 1) sweatDrop(ctx, fx + 50, cy - 34);
  if (shaken) {
    sweatDrop(ctx, fx - 54, cy - 28);
    for (const s of [-1, 1]) {
      stroke(ctx, [[s * 58, cy - 16], [s * 66, cy - 22]], 2.4);
      stroke(ctx, [[s * 60, cy - 2], [s * 69, cy - 4]], 2.4);
    }
  }
}

/** The water a boat sits in: a blue-grey strip whose wavy top is the waterline (the feet line, y 0), from x0 to x1,
 *  with short white ripple strokes. Rakko's boat sits in one too. */
function boatWater(ctx: Ctx, x0: number, x1: number): void {
  const n = Math.max(2, Math.round((x1 - x0) / 24));
  const step = (x1 - x0) / n;
  ctx.beginPath();
  ctx.moveTo(x0, 1);
  for (let i = 0; i < n; i++) ctx.quadraticCurveTo(x0 + step * (i + 0.5), -6, x0 + step * (i + 1), 1);
  ctx.quadraticCurveTo(x1 + 2, 6, x1 - 8, 9);
  ctx.lineTo(x0 + 8, 9);
  ctx.quadraticCurveTo(x0 - 2, 6, x0, 1);
  ctx.closePath();
  ctx.fillStyle = '#7F9DBF';
  ctx.fill();
  line(ctx, 3);
  ctx.stroke();
  for (const [a, b] of [
    [x0 + 10, x0 + 26],
    [-24, -8],
    [16, 30],
    [x1 - 28, x1 - 12],
  ])
    stroke(ctx, [[a, 4.5], [b, 4.5]], 2.6, WHITE);
}

/** A little wooden rowboat seen from the side, bow to the right, sitting in the water with its waterline at the feet
 *  line. Damaged 1 scuffs it; 2 cracks it, with a board nailed over the crack. */
function rowboat(ctx: Ctx, damaged: number): void {
  const wood = '#D8B48A';
  const plank = '#B48A60';
  const scuff = '#8E6A48';
  const hull = () => {
    ctx.beginPath();
    ctx.moveTo(-80, -46);
    ctx.quadraticCurveTo(2, -36, 84, -55);
    ctx.quadraticCurveTo(78, -16, 54, 4);
    ctx.lineTo(-62, 4);
    ctx.quadraticCurveTo(-72, -18, -80, -46);
    ctx.closePath();
  };
  hull();
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.save();
  hull();
  ctx.clip();
  // The planks follow the sheer; a darker rail runs along the top.
  for (const dy of [15, 29]) {
    ctx.beginPath();
    ctx.moveTo(-90, -46 + dy);
    ctx.quadraticCurveTo(2, -36 + dy, 92, -56 + dy);
    line(ctx, 2.4, plank);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-90, -46);
  ctx.quadraticCurveTo(2, -36, 92, -56);
  line(ctx, 10, '#BF956A');
  ctx.stroke();
  for (const x of [-66, 66]) circle(ctx, x, -38, 1.8, scuff, 0);
  if (damaged >= 1) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (const [x, y, rx] of [
      [-38, -22, 10],
      [28, -18, 8],
      [54, -32, 6],
    ])
      ellipse(ctx, x, y, rx, 4, scuff, 0);
    ctx.restore();
    stroke(ctx, [[-16, -31], [0, -27]], 2, scuff);
    stroke(ctx, [[34, -36], [46, -39]], 2, scuff);
  }
  if (damaged >= 2) {
    stroke(ctx, [[-58, -38], [-50, -28], [-55, -19], [-44, -9]], 2.6);
    stroke(ctx, [[-4, -36], [6, -28], [2, -20], [14, -12]], 2.6);
    ctx.save();
    ctx.translate(8, -24);
    ctx.rotate(-0.14);
    roundRect(ctx, -17, -9, 34, 18, 2, '#E9CDA6', 2.6);
    for (const [nx, ny] of [
      [-12, -5],
      [12, -5],
      [-12, 5],
      [12, 5],
    ])
      circle(ctx, nx, ny, 1.7, INK, 0);
    ctx.restore();
  }
  ctx.restore();
  hull();
  line(ctx, 4);
  ctx.stroke();
  boatWater(ctx, -96, 96);
}

/** An islander in its boat with the small near hand resting on the rim; the hand swings up behind to throw, like the
 *  other throwers'. フタバ skims scallop shells, ヒトハ throws a big spiral shell. */
function islanderThrowing(ctx: Ctx, p: Pose, o: DrawOpts, leaves: 1 | 2): void {
  islander(ctx, p, leaves);
  if (o.headOnly) return;
  rowboat(ctx, p.damaged);
  ellipse(ctx, 36, -54, 8.5, 11.5, ISLANDER, 3.5, 0.17);
}

const futaba: Drawer = (ctx, p, o) => islanderThrowing(ctx, p, o, 2);
const hitoha: Drawer = (ctx, p, o) => islanderThrowing(ctx, p, o, 1);

// ---------------------------------------------------------------- 島二郎, swimming

// 島二郎: the owner of the diner 「島二郎」 deep in the island's forest (the island arc, the film 『人魚の島のひみつ』).
// Much bigger than Chiikawa and friends and built like a real burly man, with a moustache, nothing but an apron at his
// waist, the hair on top of his head shaped like a swirl of whipped cream or a chestnut, and a pattern on the side of
// his head. He dives for the shellfish in his 貝汁, so in battle he swims: no boat, the sea up to his waist (its line
// at the feet line, as for the boats), the top of the apron just above it, his arms folded as he holds the water lane.
// Hurt, he gets scraped and sweats, then wears plasters. Colours are stand-ins until the owner's picture.
const SHIMA_SKIN = '#E9BE96';
const SHIMA_SKIN_SHADE = '#D6A982';
const SHIMA_HAIR = '#3E322D';
const SHIMA_LINES = '#B98E6C';

const shimajiro: Drawer = (ctx, p, o) => {
  const fx = FX * 0.5;
  if (!o.headOnly) {
    // The far arm: a brawny upper arm behind his shoulder (its forearm is under the near one, out of sight).
    ellipse(ctx, -54, -64, 15, 25, SHIMA_SKIN_SHADE, 4, 0.12);
    // His trunk: broad shoulders narrowing to the waist at the waterline.
    ctx.beginPath();
    ctx.moveTo(-38, 8);
    ctx.bezierCurveTo(-44, -26, -58, -66, -46, -88);
    ctx.quadraticCurveTo(0, -102, 46, -88);
    ctx.bezierCurveTo(58, -66, 44, -26, 38, 8);
    ctx.closePath();
    ctx.fillStyle = SHIMA_SKIN;
    ctx.fill();
    line(ctx, 4.5);
    ctx.stroke();
    // Chest and belly lines, a little toward where he faces.
    for (const s of [-1, 1]) stroke(ctx, [[fx * 0.6 + s * 4, -76], [fx * 0.6 + s * 18, -70], [fx * 0.6 + s * 32, -76]], 2.4, SHIMA_LINES);
    for (const y of [-40, -30]) for (const s of [-1, 1]) stroke(ctx, [[fx * 0.6 + s * 5, y], [fx * 0.6 + s * 14, y]], 2.2, SHIMA_LINES);
    // The apron tied at his waist: its top edge and strings just above the water.
    roundRect(ctx, -32, -20, 64, 26, 4, '#F7F3EA', 3.5);
    stroke(ctx, [[-40, -19], [40, -19]], 3.5);
    stroke(ctx, [[36, -19], [46, -27], [44, -16], [36, -19], [50, -12]], 2.6);
    if (p.damaged >= 1) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ellipse(ctx, -30, -64, 9, 5, '#B5694F', 0);
      ellipse(ctx, 26, -46, 7, 4, '#B5694F', 0);
      ctx.restore();
    }
    if (p.damaged >= 2) {
      ctx.save();
      ctx.translate(-30, -64);
      ctx.rotate(-0.4);
      roundRect(ctx, -13, -5, 26, 10, 3, '#FFF6E6', 2.5);
      ctx.restore();
    }
    // The sea, up to his waist.
    boatWater(ctx, -62, 62);
    // The near arm, folded across his chest over the far one's forearm.
    ellipse(ctx, 0, -54, 44, 12, SHIMA_SKIN, 4, -0.04);
    circle(ctx, -40, -54, 9.5, SHIMA_SKIN, 3.5);
    ellipse(ctx, 52, -66, 15, 25, SHIMA_SKIN, 4, -0.12);
  }
  // Head: a grown man's, small for his size next to a Chiikawa-folk's. The ear is on the side away from where he faces.
  ellipse(ctx, -24, -112, 6, 9, SHIMA_SKIN, 3.5);
  ellipse(ctx, 0, -114, 27, 30, SHIMA_SKIN, 4.5);
  // The pattern on the side of his head: short lines above the ear.
  for (const dy of [0, 7]) stroke(ctx, [[-25, -127 + dy], [-14, -131 + dy]], 2.4, SHIMA_HAIR);
  // The hair on top: a soft pointed swirl, like whipped cream or a chestnut.
  ctx.beginPath();
  ctx.moveTo(-19, -134);
  ctx.bezierCurveTo(-22, -150, -6, -154, 2, -166);
  ctx.bezierCurveTo(6, -154, 24, -150, 19, -134);
  ctx.quadraticCurveTo(0, -128, -19, -134);
  ctx.closePath();
  ctx.fillStyle = SHIMA_HAIR;
  ctx.fill();
  line(ctx, 3.5);
  ctx.stroke();
  stroke(ctx, [[-12, -140], [0, -145], [11, -140]], 2.2, '#7A685D');
  stroke(ctx, [[-5, -151], [3, -155], [8, -150]], 2.2, '#7A685D');
  // Face: small eyes under heavy brows, a nose, and the moustache over his mouth.
  const mood = p.mood ?? (p.damaged >= 2 ? 'closed' : 'normal');
  if (mood === 'closed') for (const s of [-1, 1]) stroke(ctx, [[fx + s * 9 - 4, -116], [fx + s * 9 + 4, -116]], 2.6);
  else for (const s of [-1, 1]) circle(ctx, fx + s * 9, -116, 3.2, INK, 0);
  for (const s of [-1, 1]) stroke(ctx, [[fx + s * 4, -126], [fx + s * 14, -128]], 3.2, SHIMA_HAIR);
  ellipse(ctx, fx, -106, 5, 4, SHIMA_SKIN_SHADE, 2.4);
  for (const s of [-1, 1]) ellipse(ctx, fx + s * 9, -99, 11, 5.5, SHIMA_HAIR, 2.4, s * 0.22);
  if (p.mouthOpen) ellipse(ctx, fx, -91, 5, 3, '#8C3B3B', 2.2);
  if (p.damaged >= 1) sweatDrop(ctx, fx + 34, -128);
  if (p.damaged >= 2) {
    sweatDrop(ctx, fx - 36, -122);
    ctx.save();
    ctx.translate(fx - 17, -104);
    ctx.rotate(0.35);
    roundRect(ctx, -9, -4, 18, 8, 3, '#FFF6E6', 2.2);
    ctx.restore();
  }
};

/** A big spiral shell centred at (x, y), about 2r tall, its spire up and turned by `rot`: a knobbly brown turban shell
 *  like a サザエ with a cream mouth. ヒトハ throws them (the fx_conch sticker). */
export function conchShell(ctx: Ctx, x: number, y: number, r: number, rot = 0): void {
  const lw = Math.max(2, r * 0.1);
  const shell = '#B08B6C';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // The spire, its whorls stacked from the tip down, each a little wider than the one above.
  ellipse(ctx, r * 0.12, -r * 0.78, r * 0.24, r * 0.17, shell, lw);
  ellipse(ctx, r * 0.06, -r * 0.46, r * 0.46, r * 0.26, shell, lw);
  // Knobs along the shoulder of the body whorl.
  for (const k of [-0.62, -0.2, 0.22, 0.62]) poly(ctx, [[r * k - r * 0.1, -r * 0.18], [r * k, -r * 0.42], [r * k + r * 0.1, -r * 0.18]], shell, lw * 0.8);
  ellipse(ctx, 0, r * 0.12, r * 0.78, r * 0.52, shell, lw);
  // A dark band round the body whorl, and its cream mouth.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, r * 0.12, r * 0.78, r * 0.52, 0, 0, Math.PI * 2);
  ctx.clip();
  stroke(ctx, [[-r, r * 0.02], [-r * 0.2, r * 0.14], [r, r * 0.04]], lw * 1.4, '#8A6A50');
  ctx.restore();
  ellipse(ctx, -r * 0.42, r * 0.3, r * 0.28, r * 0.2, '#F6E6CF', lw * 0.8, -0.3);
  ellipse(ctx, -r * 0.42, r * 0.32, r * 0.14, r * 0.09, '#D9B99A', 0, -0.3);
  ctx.restore();
}

/** A scallop shell centred at (x, y), about 2r wide, its hinge down and turned by `rot`: pale pink-cream with ribs
 *  fanning out from the hinge. フタバ throws them (the fx_shell sticker), and World 5's beach is strewn with them. */
export function scallopShell(ctx: Ctx, x: number, y: number, r: number, rot = 0): void {
  const lw = Math.max(2, r * 0.11);
  const hy = r * 0.5;
  const R = r * 1.12;
  const n = 8;
  const a0 = -Math.PI * 0.81;
  const a1 = -Math.PI * 0.19;
  const at = (a: number, k = 1): [number, number] => [Math.cos(a) * R * k, hy + Math.sin(a) * R * k];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // The two little ears at the hinge, behind the fan.
  for (const s of [-1, 1]) poly(ctx, [[s * r * 0.06, hy - r * 0.12], [s * r * 0.4, hy - r * 0.1], [s * r * 0.34, hy + r * 0.16], [s * r * 0.04, hy + r * 0.14]], '#F2CDBF', lw);
  const fan = () => {
    ctx.beginPath();
    ctx.moveTo(0, hy);
    ctx.lineTo(...at(a0));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const b = a0 + ((a1 - a0) * (i + 1)) / n;
      ctx.quadraticCurveTo(...at((a + b) / 2, 1.13), ...at(b));
    }
    ctx.closePath();
  };
  fan();
  ctx.fillStyle = '#F8DED3';
  ctx.fill();
  ctx.save();
  fan();
  ctx.clip();
  for (let i = 1; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    stroke(ctx, [[0, hy], at(a, 1.1)], lw * 0.75, '#E4B1A3');
  }
  ctx.globalAlpha = 0.7;
  ellipse(ctx, -r * 0.3, hy - R * 0.62, r * 0.2, r * 0.08, WHITE, 0, -0.5);
  ctx.restore();
  fan();
  line(ctx, lw);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- 星 and the one-use cards (the card face and the gallery)

/** A wish star itself: small and plump, pale yellow with a white shine and, when big enough to show, a little face. */
function wishStarBody(ctx: Ctx, x: number, y: number, r: number, tilt = -0.22): void {
  const a = -Math.PI / 2 + tilt;
  star(ctx, x, y, r, r * 0.55, 5, '#FFF2A6', Math.max(2, r * 0.12), a);
  ctx.save();
  ctx.globalAlpha = 0.85;
  star(ctx, x - r * 0.18, y - r * 0.2, r * 0.3, r * 0.16, 5, WHITE, 0, a);
  ctx.restore();
  if (r < 12) return;
  const fy = y + r * 0.08;
  eyes(ctx, x, fy, r * 0.24, r * 0.085, 'normal');
  blush(ctx, x - r * 0.42, fy + r * 0.15, r * 0.017);
  blush(ctx, x + r * 0.42, fy + r * 0.15, r * 0.017);
  mouth(ctx, x, fy + r * 0.17, 'w', r * 0.021);
}

/** 星 itself: a plump smiling star at (x, y), radius r, in its glow, with a few sparkles about it. Bright and warm, so
 *  it never reads as the 黒い星 (a dark star with a purple glow). */
function wishStar(ctx: Ctx, x: number, y: number, r: number): void {
  glow(ctx, x, y, r * 1.6, '#FFF1A8', 0.9);
  wishStarBody(ctx, x, y, r, 0);
  for (const [ax, ay, k] of [
    [-1.2, -0.8, 0.2],
    [1.22, -0.5, 0.16],
    [1.02, 0.98, 0.13],
    [-1.02, 0.92, 0.11],
  ]) {
    star(ctx, x + ax * r, y + ay * r, r * k, r * k * 0.32, 4, '#FFFBE3', Math.max(1.2, r * 0.05), 0);
  }
}

/** A taiyaki centred at (x, y), head to the left; k = 1 is about 140 long, tilt lifts the head as if swimming. Plain and
 *  golden brown, toasted at the edges. The effect sticker uses it too. */
export function taiyakiShape(ctx: Ctx, x: number, y: number, k: number, tilt = 0): void {
  const gold = '#E9AE5C';
  const toast = '#C98540';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(k, k);
  // Fins behind the body: the tail, the back and the belly.
  ctx.beginPath();
  ctx.moveTo(40, -12);
  ctx.quadraticCurveTo(56, -30, 74, -36);
  ctx.quadraticCurveTo(64, -4, 75, 30);
  ctx.quadraticCurveTo(56, 22, 40, 12);
  ctx.closePath();
  ctx.fillStyle = shade(gold, -10);
  ctx.fill();
  line(ctx, 4);
  ctx.stroke();
  for (const ey of [-22, 0, 20]) stroke(ctx, [[48, ey * 0.3], [68, ey]], 2.5, toast);
  ctx.beginPath();
  ctx.moveTo(-22, -34);
  ctx.quadraticCurveTo(-14, -52, -2, -42);
  ctx.quadraticCurveTo(8, -54, 18, -40);
  ctx.quadraticCurveTo(28, -48, 34, -30);
  ctx.closePath();
  ctx.fillStyle = shade(gold, -10);
  ctx.fill();
  line(ctx, 4);
  ctx.stroke();
  poly(ctx, [[-8, 32], [6, 48], [18, 30]], shade(gold, -10), 4);
  // The body.
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-66, 0);
    ctx.quadraticCurveTo(-62, -36, -22, -38);
    ctx.quadraticCurveTo(24, -40, 46, -10);
    ctx.lineTo(46, 10);
    ctx.quadraticCurveTo(22, 38, -22, 36);
    ctx.quadraticCurveTo(-60, 34, -66, 0);
    ctx.closePath();
  };
  body();
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.save();
  body();
  ctx.clip();
  // Toasted edges, a shine on top, the scales and the gill.
  ctx.globalAlpha = 0.5;
  body();
  line(ctx, 14, toast);
  ctx.stroke();
  ctx.globalAlpha = 0.75;
  ellipse(ctx, -12, -22, 34, 8, '#F8D99A', 0, -0.05);
  ctx.globalAlpha = 0.8;
  for (const [sx, sy] of [
    [-4, -12],
    [10, -14],
    [24, -10],
    [3, 2],
    [17, 2],
    [31, 3],
    [-4, 16],
    [10, 18],
    [24, 15],
  ])
    arc(ctx, sx, sy, 6, Math.PI * 0.15, Math.PI * 0.85, 2.4, toast);
  arc(ctx, -48, 2, 24, -Math.PI * 0.3, Math.PI * 0.3, 3, toast);
  ctx.restore();
  body();
  line(ctx, 4);
  ctx.stroke();
  // The eye and the mouth, pressed in by the mould.
  circle(ctx, -46, -10, 7, shade(gold, 16), 2.5);
  circle(ctx, -46, -10, 3, INK, 0);
  stroke(ctx, [[-66, 3], [-57, 5]], 2.4);
  ctx.restore();
}

// 星: a wish on a star. One plump glowing star with a little face, a few sparkles about it.
const hoshi: Drawer = (ctx) => wishStar(ctx, 0, -84, 50);

// たい焼き, a trap: cooking (its 'cook' picture), pale batter sizzling in a taiyaki iron with steam rising; cooked (at
// rest), a golden-brown taiyaki sitting on its tile, with a few sparkles.
const taiyaki: Drawer = (ctx, p) => {
  if (p.anim === 'cook') {
    // The iron: a dark plate with its wooden handle, the fish-shaped hollow in it full of pale batter.
    stroke(ctx, [[-62, -24], [-104, -34]], 9, INK);
    stroke(ctx, [[-62, -24], [-104, -34]], 5, '#8A5A3C');
    roundRect(ctx, -66, -40, 132, 32, 12, '#4A4650', 4);
    ellipse(ctx, 0, -27, 48, 10, '#2F2C35', 0);
    ellipse(ctx, -4, -29, 42, 8, '#F7E8C4', 2.5);
    for (const [x, y, r] of [
      [-30, -62, 9],
      [2, -76, 12],
      [30, -64, 8],
    ])
      circle(ctx, x, y, r, WHITE, 2.5);
    return;
  }
  ctx.save();
  ctx.globalAlpha = 0.14;
  ellipse(ctx, 0, -10, 44, 6, INK, 0);
  ctx.restore();
  taiyakiShape(ctx, -4, -52, 0.95, 0.08);
  for (const [x, y, r] of [
    [-62, -96, 8],
    [54, -94, 6],
    [64, -24, 5],
  ])
    star(ctx, x, y, r, r * 0.35, 4, '#FFF4C2', 2, 0);
};

// むちゃうマン: the hero of むちゃうまヨーグルト. A stand-in until the owner's picture comes: a caped hero in a white suit,
// a round helmet with a dark visor and a yogurt cup on his chest. His one move is his pose (his 'attack').
const muchauman: Drawer = (ctx, p, o) => {
  const suit = '#FFFFFF';
  const pink = '#F28BA8';
  if (!o.headOnly) {
    poly(ctx, [[-28, -98], [28, -98], [46, -12], [-46, -12]], '#E24A5A', 4);
    feet(ctx, p, pink);
    roundRect(ctx, -30, -88, 60, 76, 22, suit, 4);
    roundRect(ctx, -30, -40, 60, 10, 4, pink, 3);
    // The yogurt cup on his chest, its lid on top.
    roundRect(ctx, -12, -80, 24, 26, 5, '#F7F3EA', 3);
    roundRect(ctx, -14, -84, 28, 7, 3, pink, 2.5);
    arms(ctx, p, suit, -70, 34);
  }
  ellipse(ctx, 0, -126, 38, 34, suit, 4.5);
  roundRect(ctx, -28, -136, 56, 20, 10, '#3D4A66', 3.5);
  stroke(ctx, [[-18, -130], [-6, -130]], 3, 'rgba(255,255,255,0.8)');
  poly(ctx, [[-6, -158], [0, -172], [6, -158]], pink, 3);
};

// ---------------------------------------------------------------- enemies

const mushiLegs = (ctx: Ctx, p: Pose, y0: number, spread: number): void => {
  for (const s of [-1, 1]) {
    const lift = s * p.legs > 0 ? 7 : 0;
    stroke(ctx, [[s * spread * 0.6, y0], [s * spread, -8 - lift]], 3.5);
    ellipse(ctx, s * (spread + 4), -5 - lift, 8, 4, WHITE, 3);
  }
};

function antennae(ctx: Ctx, y: number, spread: number, color: string): void {
  for (const s of [-1, 1]) {
    stroke(ctx, [[s * 6, y], [s * spread, y - 30]], 3);
    circle(ctx, s * spread, y - 34, 8, color, 3);
  }
}

/** The two-legged bug, in its colour (the pink boss bug is the same bug, much bigger). */
const twoLegged = (purple: string): Drawer => (ctx, p, o) => {
  const lunge = p.anim === 'attack' ? p.extend * 6 : 0;
  ctx.save();
  ctx.translate(0, lunge);
  if (!o.headOnly) mushiLegs(ctx, p, -30, 20);
  antennae(ctx, -112, 30, WHITE);
  if (!o.headOnly) {
    ctx.beginPath();
    ctx.ellipse(0, -52, 42, 32, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = purple;
    ctx.fill();
    line(ctx, 4);
    ctx.stroke();
  }
  circle(ctx, 0, -76, 32, WHITE, 4);
  ctx.beginPath();
  ctx.arc(0, -86, 33, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = purple;
  ctx.fill();
  line(ctx, 4);
  ctx.stroke();
  eyes(ctx, FX, -76, 11, 4.5, p.mood ?? 'normal');
  mouth(ctx, FX, -62, p.mouthOpen ? 'open' : 'o');
  ctx.restore();
};
const mushiTwolegs = twoLegged('#C69AD6');

/** The two-legged mermaid (the owner's design, セイレーン's follower on land): a round white head with a little red fin
 *  on top, a red bowl of a body with dark wave stripes, and two thin legs. */
const mermaidTwolegs: Drawer = (ctx, p, o) => {
  const red = '#EF6450';
  if (!o.headOnly) {
    const step = p.legs * 7;
    stroke(ctx, [[-12, -40], [-12 - step, 0]], 4.5);
    stroke(ctx, [[12, -40], [12 + step, 0]], 4.5);
  }
  circle(ctx, 0, -84, 32, WHITE, 4);
  poly(ctx, [[-6, -113], [8, -128], [16, -112]], red, 3.5);
  eyes(ctx, FX, -88, 11, 4.5, p.mood ?? 'normal');
  mouth(ctx, FX, -74, p.mouthOpen ? 'open' : 'o');
  if (!o.headOnly) {
    ctx.beginPath();
    ctx.ellipse(0, -58, 40, 26, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = red;
    ctx.fill();
    line(ctx, 4);
    ctx.stroke();
    for (const y of [-50, -41]) stroke(ctx, [[-24, y], [-12, y - 4], [0, y], [12, y - 4], [24, y]], 2.5);
  }
};
const mushiPink = twoLegged('#E9B8DF');

const mushiSixlegs: Drawer = (ctx, p, o) => {
  const lime = '#C2DA7C';
  if (!o.headOnly) {
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const lift = (k % 2 === 0 ? p.legs : -p.legs) * s > 0 ? 6 : 0;
        stroke(ctx, [[s * (20 + k * 8), -36], [s * (34 + k * 12), -4 - lift]], 3.5);
      }
    }
    ellipse(ctx, 0, -54, 48, 42, WHITE, 4.5);
    clipEllipse(ctx, 0, -54, 48, 42, () => {
      for (let y = -92; y < -10; y += 20) roundRect(ctx, -60, y, 120, 10, 0, lime, 0);
    });
    ellipse(ctx, 0, -54, 48, 42, null, 4.5);
  }
  antennae(ctx, -122, 26, WHITE);
  circle(ctx, 0, -100, 24, WHITE, 4);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, -108, 25, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = WHITE;
  ctx.fillRect(-30, -140, 60, 40);
  for (let x = -30; x < 30; x += 14) roundRect(ctx, x, -140, 7, 40, 0, lime, 0);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, -108, 25, Math.PI, Math.PI * 2);
  line(ctx, 4);
  ctx.stroke();
  eyes(ctx, FX, -98, 9, 4, p.mood ?? 'normal');
  mouth(ctx, FX, -86, p.mouthOpen ? 'open' : 'o');
};

const mushiHorned: Drawer = (ctx, p, o) => {
  const red = '#E3607E';
  const skin = '#F5DEC9';
  if (!o.headOnly) {
    for (const s of [-1, 1]) {
      const lift = s * p.legs > 0 ? 6 : 0;
      ellipse(ctx, s * 18, -26 - lift, 13, 22, skin, 4);
      ellipse(ctx, s * 22, -5 - lift, 12, 6, skin, 3.5);
    }
    for (const s of [-1, 1]) stroke(ctx, [[s * 46, -66], [s * 58 - p.armUp * s * 6, -48 - p.armUp * 30], [s * 52, -34]], 4);
    ctx.beginPath();
    ctx.ellipse(0, -64, 50, 36, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = red;
    ctx.fill();
    line(ctx, 4.5);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.7;
    ellipse(ctx, 26, -48, 6, 10, WHITE, 0, -0.5);
    ctx.restore();
  }
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 18, -116);
    ctx.quadraticCurveTo(s * 56, -130, s * 44, -164);
    ctx.quadraticCurveTo(s * 40, -138, s * 10, -126);
    ctx.closePath();
    ctx.fillStyle = WHITE;
    ctx.fill();
    line(ctx, 3.5);
    ctx.stroke();
  }
  circle(ctx, 0, -96, 27, WHITE, 4);
  ctx.beginPath();
  ctx.arc(0, -104, 28, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = red;
  ctx.fill();
  line(ctx, 4);
  ctx.stroke();
  eyes(ctx, FX, -94, 10, 4, p.mood ?? 'normal');
  mouth(ctx, FX, -82, p.mouthOpen ? 'open' : 'o');
};

const goblin: Drawer = (ctx, p, o) => {
  const g = '#A9CB93';
  if (!o.headOnly) {
    feet(ctx, p, g, 16, 13);
    torso(ctx, g, 28, 26, -36);
    ctx.beginPath();
    ctx.moveTo(-30, -36);
    ctx.lineTo(30, -36);
    for (let x = 30; x >= -30; x -= 10) ctx.lineTo(x - 5, -16 - ((x / 10) % 2 === 0 ? 0 : 6));
    ctx.closePath();
    ctx.fillStyle = '#A38E77';
    ctx.fill();
    line(ctx, 3.5);
    ctx.stroke();
    // Bone club.
    const ang = -0.4 - p.armUp * 1.1 + (p.impact ? 1.0 : 0);
    ctx.save();
    ctx.translate(-34, -46);
    ctx.rotate(ang);
    roundRect(ctx, -6, -46, 12, 46, 6, '#E5B98A', 3);
    circle(ctx, -6, -48, 8, '#E5B98A', 3);
    circle(ctx, 6, -48, 8, '#E5B98A', 3);
    ctx.restore();
    arms(ctx, p, g, -42, 28);
  }
  poly(ctx, [[-48, -96], [-74, -108], [-46, -116]], g, 4);
  poly(ctx, [[48, -96], [74, -108], [46, -116]], g, 4);
  ctx.beginPath();
  ctx.moveTo(-50, -90);
  ctx.quadraticCurveTo(-52, -132, -14, -140);
  ctx.quadraticCurveTo(2, -158, 12, -164);
  ctx.quadraticCurveTo(14, -146, 26, -136);
  ctx.quadraticCurveTo(54, -124, 50, -90);
  ctx.quadraticCurveTo(48, -52, 0, -50);
  ctx.quadraticCurveTo(-48, -52, -50, -90);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  line(ctx, 4.5);
  ctx.stroke();
  eyes(ctx, FX, -92, 16, 5, p.mood ?? 'happy');
  blushPair(ctx, -80, 30);
  mouth(ctx, FX, -76, p.mouthOpen ? 'open' : 'w');
};

const chushidesu: Drawer = (ctx, p, o) => {
  const c = '#E4EE9C';
  if (!o.headOnly) {
    for (let i = 0; i < 7; i++) {
      const x = -30 + i * 12;
      const lift = (i % 2 === 0 ? p.legs : -p.legs) > 0 ? 5 : 0;
      stroke(ctx, [[x, -24], [x + 3, -4 - lift]], 4);
    }
    ellipse(ctx, 14, -54, 52, 38, c, 4.5);
  }
  ellipse(ctx, -14, -66, 38, 32, c, 4.5);
  const snoutY = p.anim === 'attack' ? p.extend * 10 : 0;
  ctx.beginPath();
  ctx.moveTo(-40, -58);
  ctx.quadraticCurveTo(-70, -48 + snoutY, -64, -20 + snoutY);
  line(ctx, 14, INK);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-40, -58);
  ctx.quadraticCurveTo(-70, -48 + snoutY, -64, -20 + snoutY);
  line(ctx, 8, c);
  ctx.stroke();
  circle(ctx, -64, -18 + snoutY, 10, '#C3477A', 3.5);
  for (const [x, y, r] of [
    [-34, -80, 14],
    [-4, -76, 13],
  ] as const) {
    circle(ctx, x, y, r, WHITE, 3.5);
    circle(ctx, x + 2, y + 2, r * 0.42, INK, 0);
  }
};

const fugu: Drawer = (ctx, p, o) => {
  const blue = '#86ADCD';
  const puff = p.anim === 'attack' && p.frame < 2 ? 1.1 : 1;
  ctx.save();
  ctx.scale(puff, puff);
  if (!o.headOnly) {
    for (let i = 0; i < 5; i++) {
      const x = -16 + i * 8;
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.quadraticCurveTo(x + 6 + p.legs * 3, -10, x, -2);
      line(ctx, 4, '#5D86A8');
      ctx.stroke();
    }
    ellipse(ctx, -46, -52, 10, 14, WHITE, 3.5, 0.6);
    ellipse(ctx, 46, -52, 10, 14, WHITE, 3.5, -0.6);
  }
  circle(ctx, 0, -62, 46, blue, 4.5);
  clipEllipse(ctx, 0, -62, 46, 46, () => {
    ellipse(ctx, 0, -30, 46, 30, WHITE, 0);
    for (const [x, y] of [
      [-16, -36],
      [0, -28],
      [16, -36],
      [-8, -44],
      [10, -46],
    ])
      circle(ctx, x, y, 3, '#6E98BD', 0);
  });
  circle(ctx, 0, -62, 46, null, 4.5);
  for (let i = 0; i < 7; i++) circle(ctx, -18 + i * 6, -100 + Math.abs(i - 3) * 2, 1.6, '#4D769A', 0);
  eyes(ctx, FX, -74, 16, 5, p.mood ?? 'normal');
  circle(ctx, 0, -58, p.mouthOpen ? 10 : 8, WHITE, 3.5);
  circle(ctx, 0, -58, 3.5, null, 2.5);
  ctx.restore();
};

const majyo: Drawer = (ctx, p, o) => {
  const cloak = '#2C2A2E';
  const skin = '#A9C47E';
  if (!o.headOnly) {
    ellipse(ctx, -16 + p.legs * 4, -4, 12, 6, skin, 3);
    ellipse(ctx, 16 - p.legs * 4, -4, 12, 6, skin, 3);
  }
  ctx.beginPath();
  ctx.moveTo(-50, -6);
  ctx.quadraticCurveTo(-56, -90, -40, -128);
  ctx.quadraticCurveTo(0, -176, 40, -128);
  ctx.quadraticCurveTo(56, -90, 50, -6);
  ctx.closePath();
  ctx.fillStyle = cloak;
  ctx.fill();
  line(ctx, 4.5);
  ctx.stroke();
  ellipse(ctx, 0, -104, 26, 24, skin, 3.5);
  poly(ctx, [[-4, -110], [10, -92], [-8, -94]], shade(skin, -14), 3);
  for (const s of [-1, 1]) {
    circle(ctx, s * 12, -114, 7, WHITE, 3);
    circle(ctx, s * 12 + 1, -113, 3, INK, 0);
  }
  mouth(ctx, FX, -88, p.mouthOpen ? 'open' : 'teeth', 0.8);
  if (!o.headOnly) {
    const up = p.armUp;
    for (const s of [-1, 1]) {
      const hx = s * (34 + up * 8);
      const hy = -58 - up * 56 + (p.impact ? 30 : 0);
      ellipse(ctx, hx, hy, 10, 9, skin, 3);
      for (let k = -1; k <= 1; k++) stroke(ctx, [[hx + k * 5, hy + 4], [hx + k * 7, hy + 18]], 3, INK);
    }
  }
};

const kimera: Drawer = (ctx, p, o) => {
  const pink = '#F4AAC3';
  if (!o.headOnly) {
    ctx.beginPath();
    ctx.moveTo(30, -30);
    ctx.quadraticCurveTo(80, -20, 70, -70);
    ctx.quadraticCurveTo(64, -92, 82, -100);
    line(ctx, 12, INK);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(30, -30);
    ctx.quadraticCurveTo(80, -20, 70, -70);
    ctx.quadraticCurveTo(64, -92, 82, -100);
    line(ctx, 7, '#9A82CC');
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 46, -66);
      ctx.rotate(s * 0.5);
      ellipse(ctx, 0, 0, 22, 36, WHITE, 4);
      for (let k = -1; k <= 1; k++) arc(ctx, s * 4, k * 14, 10, Math.PI * 0.2, Math.PI * 0.8, 2.5);
      ctx.restore();
    }
    feet(ctx, p, pink, 18, 15);
    for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) stroke(ctx, [[s * 18 + k * 6, -2], [s * 18 + k * 7, 6]], 3, '#E04F6E');
    ellipse(ctx, 0, -48, 40, 36, pink, 4.5);
    const up = p.armUp;
    for (const s of [-1, 1]) {
      const hx = s * 40;
      const hy = -56 - up * 40 + (p.impact ? 26 : 0);
      ellipse(ctx, hx, hy, 9, 12, pink, 3);
      for (let k = -1; k <= 1; k++) stroke(ctx, [[hx + k * 5, hy + 8], [hx + k * 6, hy + 20]], 3, '#E04F6E');
    }
  }
  for (const s of [-1, 1]) {
    circle(ctx, s * 34, -130, 14, pink, 4);
    circle(ctx, s * 34, -132, 7, '#3F3438', 0);
  }
  ellipse(ctx, 0, -100, 44, 36, pink, 4.5);
  for (const s of [-1, 1]) for (const k of [-1, 1]) stroke(ctx, [[s * 30, -94 + k * 5], [s * 52, -96 + k * 8]], 2);
  eyes(ctx, FX, -102, 16, 6, p.mood ?? 'tears');
  blushPair(ctx, -90, 28);
  mouth(ctx, FX, -84, p.mouthOpen ? 'open' : 'w');
};

const kuroiNagareboshi: Drawer = (ctx, p) => {
  glow(ctx, 0, -72, 70, '#8E6CCF', 0.55 + p.glow * 0.45);
  ctx.save();
  ctx.globalAlpha = 0.6;
  for (const x of [-16, 0, 16]) stroke(ctx, [[x, -112], [x * 1.5, -160]], 4, '#6A5A8E');
  ctx.restore();
  star(ctx, 0, -72, 40, 19, 5, '#2C2A3B', 4.5);
  ctx.save();
  ctx.globalAlpha = 0.45;
  star(ctx, -6, -80, 14, 7, 5, '#6E6A86', 0);
  ctx.restore();
  if (p.glow > 0.5) {
    ctx.save();
    ctx.globalAlpha = p.glow * 0.8;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      stroke(ctx, [[Math.cos(a) * 52, -72 + Math.sin(a) * 52], [Math.cos(a) * 64, -72 + Math.sin(a) * 64]], 3, '#9EE07A');
    }
    ctx.restore();
  }
};

const gitaigata: Drawer = (ctx, p, o) => {
  const pink = '#F7BBCB';
  if (!o.headOnly) {
    for (const s of [-1, 1]) {
      circle(ctx, s * 26 + p.legs * 2, -24, 24, '#5C5E66', 4);
      ctx.save();
      ctx.globalAlpha = 0.35;
      circle(ctx, s * 26 - 8, -32, 7, WHITE, 0);
      ctx.restore();
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      poly(ctx, [[56 + Math.cos(a) * 18, -44 + Math.sin(a) * 18], [56 + Math.cos(a + 0.3) * 26, -44 + Math.sin(a + 0.3) * 26], [56 + Math.cos(a + 0.6) * 18, -44 + Math.sin(a + 0.6) * 18]], '#B08A68', 2.5);
    }
    circle(ctx, 56, -44, 18, '#C9A27E', 3.5);
    poly(ctx, [[-50, -88], [-74, -112], [-62, -84]], '#B9C0CC', 3);
    poly(ctx, [[-50, -88], [-78, -96], [-60, -78]], '#B9C0CC', 3);
  }
  for (const s of [-1, 1]) {
    roundRect(ctx, s * 18 - 9, -174, 18, 58, 9, pink, 4);
    roundRect(ctx, s * 18 - 4, -166, 8, 40, 4, '#F28FAB', 0);
  }
  ellipse(ctx, 0, -78, 46, 44, pink, 4.5);
  eyes(ctx, FX, -86, 15, 5, p.mood ?? 'normal');
  blushPair(ctx, -74, 30);
  mouth(ctx, FX, -66, p.mouthOpen ? 'wide' : 'w');
};

const zou: Drawer = (ctx, p, o) => {
  const g = '#7D7F8E';
  const cream = '#F2E7CB';
  if (!o.headOnly) {
    ctx.beginPath();
    ctx.moveTo(40, -46);
    ctx.quadraticCurveTo(62, -40, 60, -16);
    line(ctx, 4);
    ctx.stroke();
    ellipse(ctx, 61, -12, 6, 8, '#B9A68A', 3);
    const lift = p.anim === 'attack' ? p.armUp * 14 - (p.impact ? 14 : 0) : 0;
    ellipse(ctx, -22, -24 - lift, 17, 26, g, 4.5);
    ellipse(ctx, 22, -24, 17, 26, g, 4.5);
    ellipse(ctx, 0, -58, 44, 38, g, 4.5);
    ellipse(ctx, 0, -48, 24, 22, cream, 0);
  }
  for (const s of [-1, 1]) {
    ellipse(ctx, s * 48, -106, 26, 32, g, 4.5);
    ellipse(ctx, s * 48, -104, 15, 20, '#9A9CAB', 0);
  }
  ellipse(ctx, 0, -106, 38, 34, g, 4.5);
  ellipse(ctx, 0, -100, 26, 22, cream, 0);
  ctx.beginPath();
  ctx.moveTo(-4, -98);
  ctx.quadraticCurveTo(-40, -96, -42, -70);
  ctx.quadraticCurveTo(-42, -58, -32, -60);
  line(ctx, 14, INK);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4, -98);
  ctx.quadraticCurveTo(-40, -96, -42, -70);
  ctx.quadraticCurveTo(-42, -58, -32, -60);
  line(ctx, 8.5, cream);
  ctx.stroke();
  eyes(ctx, 4, -112, 14, 5, p.mood ?? 'happy');
  ellipse(ctx, 14, -88, 5, 4, '#E77E95', 2);
};

const chiikabuSmall: Drawer = (ctx, p, o) => {
  const shell = '#9C6B47';
  if (!o.headOnly) {
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) stroke(ctx, [[s * (14 + k * 8), -26], [s * (24 + k * 9), -4 - ((k + (s > 0 ? 1 : 0)) % 2 === 0 && p.legs !== 0 ? 4 : 0)]], 3);
    ellipse(ctx, 0, -46, 38, 32, shell, 4.5);
    stroke(ctx, [[0, -76], [0, -16]], 3);
    ctx.save();
    ctx.globalAlpha = 0.45;
    ellipse(ctx, -16, -58, 7, 12, WHITE, 0, 0.3);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(-4, -96);
  ctx.quadraticCurveTo(0, -122, 14, -126);
  ctx.quadraticCurveTo(6, -110, 6, -96);
  ctx.closePath();
  ctx.fillStyle = '#6E4630';
  ctx.fill();
  line(ctx, 3);
  ctx.stroke();
  ellipse(ctx, 0, -82, 28, 20, '#C08A61', 4);
  eyes(ctx, FX, -82, 11, 5, p.mood ?? 'sparkle');
  blushPair(ctx, -74, 19);
};

const chiikabuTrue: Drawer = (ctx, p, o) => {
  const shell = '#3E2B28';
  if (!o.headOnly) {
    for (const s of [-1, 1])
      for (let k = 0; k < 3; k++) {
        const x0 = s * (20 + k * 10);
        stroke(ctx, [[x0, -40], [x0 + s * 16, -22], [x0 + s * 10, -2 - (k % 2 === 0 && p.legs * s > 0 ? 5 : 0)]], 4.5);
      }
    ellipse(ctx, 0, -62, 48, 42, shell, 5);
    stroke(ctx, [[0, -102], [0, -22]], 3.5, '#6B4B44');
    ctx.save();
    ctx.globalAlpha = 0.5;
    ellipse(ctx, -20, -78, 9, 16, '#A07F76', 0, 0.3);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(-8, -118);
  ctx.quadraticCurveTo(-14, -156, 8, -170);
  ctx.lineTo(18, -158);
  ctx.quadraticCurveTo(10, -150, 14, -140);
  ctx.lineTo(28, -150);
  ctx.quadraticCurveTo(22, -130, 8, -118);
  ctx.closePath();
  ctx.fillStyle = '#2A1E1C';
  ctx.fill();
  line(ctx, 3.5);
  ctx.stroke();
  ellipse(ctx, 0, -106, 32, 24, '#5A3E38', 4.5);
  eyes(ctx, FX, -106, 13, 6, p.mood === 'closed' ? 'closed' : 'glare');
  if (p.mouthOpen) mouth(ctx, FX, -92, 'open');
};

/** Fish scales: rows of little arcs, for clipping into a tail. */
function scales(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, r: number, color: string): void {
  let row = 0;
  for (let y = y0; y <= y1; y += r * 1.1, row++) {
    for (let x = x0 + (row % 2) * r; x <= x1; x += r * 2) arc(ctx, x, y, r, Math.PI * 0.15, Math.PI * 0.85, 2.2, color);
  }
}

/** A goldfish-like fan fin from its base at (x, y), opening to the left: two lobes with streaks. */
function fanFin(ctx: Ctx, x: number, y: number, k: number, fill: string, lw = 4): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.moveTo(2, -4);
  ctx.quadraticCurveTo(-8, -40, -30, -50);
  ctx.quadraticCurveTo(-24, -26, -18, -18);
  ctx.quadraticCurveTo(-34, -10, -36, 16);
  ctx.quadraticCurveTo(-14, 12, 2, 4);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  line(ctx, lw / k);
  ctx.stroke();
  ctx.globalAlpha = 0.65;
  for (const [ex, ey] of [
    [-24, -42],
    [-18, -28],
    [-24, -6],
    [-28, 10],
  ])
    stroke(ctx, [[-2, 0], [ex, ey]], 2 / k, WHITE);
  ctx.restore();
}

// 小さい人魚: a small island mermaid, Chiikawa-folk sized, with a fish tail instead of feet; hops along on it.
const ningyo: Drawer = (ctx, p, o) => {
  const red = '#EF7B63';
  if (!o.headOnly) {
    fanFin(ctx, -52, -22, 0.9, '#F7A594', 3.5);
    ellipse(ctx, 0, -50, 27, 23, WHITE, 4);
    const tail = () => {
      ctx.beginPath();
      ctx.moveTo(-26, -44);
      ctx.quadraticCurveTo(0, -35, 27, -44);
      ctx.quadraticCurveTo(38, -6, 6, -3);
      ctx.quadraticCurveTo(-30, -1, -50, -17);
      ctx.lineTo(-54, -27);
      ctx.quadraticCurveTo(-36, -26, -26, -44);
      ctx.closePath();
    };
    tail();
    ctx.fillStyle = red;
    ctx.fill();
    ctx.save();
    tail();
    ctx.clip();
    ctx.globalAlpha = 0.55;
    scales(ctx, -50, -36, 34, -4, 6, shade(red, -50));
    ctx.restore();
    tail();
    line(ctx, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(18, -24);
    ctx.quadraticCurveTo(34, -32, 40, -18);
    ctx.quadraticCurveTo(32, -18, 30, -10);
    ctx.quadraticCurveTo(24, -18, 18, -24);
    ctx.closePath();
    ctx.fillStyle = '#F7A594';
    ctx.fill();
    line(ctx, 3);
    ctx.stroke();
    arms(ctx, p, WHITE, -50, 30);
  }
  // Little fins where ears would be (a guess: check the island arc), so the head reads as a mermaid's on its own.
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    fanFin(ctx, -40, -104, 0.5, '#F7A594', 3);
    ctx.restore();
  }
  head(ctx, WHITE, 47, 40, -98);
  face(ctx, p, 'normal', { y: -96, gap: 15, r: 5.5, mouthKind: 'o', blushGap: 30 });
};

// 山姥: an old woman in a worn kimono, hunched, her long white hair hanging loose; she played a kind granny to trap the
// trio. Her eyes, nose and mouth are said to look like the green witch's, so the nose is the witch's hook.
const yamanba: Drawer = (ctx, p, o) => {
  const skin = '#EFE1CB';
  const hair = '#F7F5F0';
  const hairDark = '#C2BCB2';
  const kimono = '#7F87A7';
  // The hair (part of the head): long and loose, falling over her hunched back.
  const mass = () => {
    ctx.beginPath();
    ctx.moveTo(18, -128);
    ctx.quadraticCurveTo(8, -146, -14, -144);
    ctx.quadraticCurveTo(-42, -140, -48, -112);
    ctx.quadraticCurveTo(-54, -82, -52, -56);
    ctx.quadraticCurveTo(-47, -50, -42, -56);
    ctx.quadraticCurveTo(-37, -49, -32, -55);
    ctx.quadraticCurveTo(-27, -50, -22, -58);
    ctx.quadraticCurveTo(-24, -82, -12, -96);
    ctx.quadraticCurveTo(2, -100, 14, -100);
    ctx.closePath();
  };
  mass();
  ctx.fillStyle = hair;
  ctx.fill();
  ctx.save();
  mass();
  ctx.clip();
  for (const [x0, y0, cx, cy, x1, y1] of [
    [-10, -138, -36, -128, -40, -96],
    [-24, -132, -44, -110, -44, -70],
    [-30, -112, -36, -86, -32, -62],
    [-16, -120, -26, -100, -24, -76],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    line(ctx, 2, hairDark);
    ctx.stroke();
  }
  ctx.restore();
  mass();
  line(ctx, 3.5);
  ctx.stroke();
  if (!o.headOnly) {
    const sleeve = (sx: number, sy: number, rot: number, fill: string) => {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(rot);
      roundRect(ctx, -11, -4, 22, 44, 10, fill, 3.5);
      stroke(ctx, [[-9, 30], [9, 30]], 2, shade(fill, -24));
      ctx.restore();
    };
    sleeve(-16, -94, 0.32, shade(kimono, -16));
    for (const fx of [-16, 14]) {
      ellipse(ctx, fx + 2, -4, 14, 5, '#D9C089', 3);
      ellipse(ctx, fx + 3, -9, 10, 5.5, skin, 3);
    }
    // The kimono: a hunched back, the front falling to a frayed hem.
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(32, -8);
      ctx.quadraticCurveTo(24, -36, 22, -64);
      ctx.quadraticCurveTo(20, -100, 0, -112);
      ctx.quadraticCurveTo(-26, -124, -38, -96);
      ctx.quadraticCurveTo(-50, -60, -42, -8);
      for (let x = -42, i = 0; x < 32; x += 9, i++) ctx.lineTo(x + 4.5, i % 2 ? -8 : -2);
      ctx.closePath();
    };
    body();
    ctx.fillStyle = kimono;
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    // The obi, a patch on the back, the collar crossing at the chest.
    ctx.save();
    ctx.translate(-8, -54);
    ctx.rotate(-0.12);
    roundRect(ctx, -50, -8, 100, 15, 0, '#5E4C58', 0);
    stroke(ctx, [[-50, 0], [50, 0]], 2, '#8A7584');
    ctx.restore();
    ctx.save();
    ctx.translate(-28, -82);
    ctx.rotate(0.12);
    roundRect(ctx, -9, -8, 18, 16, 2, '#BFA07A', 2.5);
    ctx.setLineDash([3, 3]);
    roundRect(ctx, -6, -5, 12, 10, 1, null, 1.4);
    ctx.setLineDash([]);
    ctx.restore();
    stroke(ctx, [[2, -108], [12, -86], [14, -64]], 9, INK);
    stroke(ctx, [[2, -108], [12, -86], [14, -64]], 5, '#ECE5D5');
    ctx.globalAlpha = 0.5;
    for (const [x, y] of [
      [-30, -40],
      [-14, -30],
      [6, -36],
      [18, -22],
    ])
      stroke(ctx, [[x, y], [x + 4, y + 9]], 2, shade(kimono, -30));
    ctx.restore();
    body();
    line(ctx, 4);
    ctx.stroke();
    // The near sleeve, hanging from a shoulder below her chin, a bony hand with long nails reaching out of it.
    for (const [dy, len] of [
      [-6, 15],
      [-1, 17],
      [4, 15],
    ]) {
      stroke(ctx, [[36, -46 + dy], [36 + len, -48 + dy * 1.6]], 6.5, INK);
      stroke(ctx, [[36, -46 + dy], [36 + len, -48 + dy * 1.6]], 2.5, skin);
      stroke(ctx, [[32 + len, -48 + dy * 1.5], [37 + len, -48 + dy * 1.7]], 3, '#4C4A3E');
    }
    ellipse(ctx, 34, -46, 8, 7, skin, 3);
    sleeve(2, -82, -0.72, kimono);
  }
  // The head: white hair parted in the middle over the top, a kindly squint, the witch's hooked nose, one tooth.
  ellipse(ctx, 0, -112, 27, 25, skin, 4);
  clipEllipse(ctx, 0, -112, 27, 25, () => {
    ctx.beginPath();
    ctx.moveTo(-34, -142);
    ctx.lineTo(34, -142);
    ctx.lineTo(34, -112);
    ctx.quadraticCurveTo(24, -126, 6, -131);
    ctx.quadraticCurveTo(-14, -128, -34, -108);
    ctx.closePath();
    ctx.fillStyle = hair;
    ctx.fill();
    line(ctx, 2.5);
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(6, -138);
      ctx.quadraticCurveTo(6 + s * 12, -134, 6 + s * 20, -124);
      line(ctx, 1.8, hairDark);
      ctx.stroke();
    }
  });
  ellipse(ctx, 0, -112, 27, 25, null, 4);
  const fx = FX * 0.6;
  eyes(ctx, fx, -112, 10, 4.5, p.mood ?? 'happy');
  for (const s of [-1, 1]) arc(ctx, fx + s * 10, -105, 5, Math.PI * 0.25, Math.PI * 0.75, 1.6, shade(skin, -50));
  ctx.save();
  ctx.globalAlpha = 0.45;
  for (const s of [-1, 1]) ellipse(ctx, fx + s * 17, -102, 6, 3.5, '#F2A3A8', 0);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(fx - 1, -113);
  ctx.quadraticCurveTo(fx + 12, -108, fx + 9, -98);
  ctx.quadraticCurveTo(fx + 3, -97, fx - 3, -101);
  ctx.closePath();
  ctx.fillStyle = shade(skin, -14);
  ctx.fill();
  line(ctx, 2.5);
  ctx.stroke();
  mouth(ctx, fx, -93, p.mouthOpen ? 'open' : 'smile', 0.9);
  roundRect(ctx, fx + 1, -92, 3.4, 4, 1, WHITE, 1.4);
};

// セイレーン: the island's giant. Half beast, half fish: a black-and-white dog above (modelled on a 犬張子, the
// papier-mâché dog toy) and a red goldfish below. Its song makes plants grow and bind. Floats along on its tail.
const seiren: Drawer = (ctx, p, o) => {
  const red = '#E8553F';
  const fin = '#F6A08F';
  const black = '#2F2A2C';
  if (!o.headOnly) {
    fanFin(ctx, -54, -26, 1.75, fin, 4.5);
    ellipse(ctx, 2, -86, 40, 32, WHITE, 4.5);
    // A red bib under the chin, as a 犬張子 is painted.
    clipEllipse(ctx, 2, -86, 40, 32, () => {
      ellipse(ctx, 4, -86, 38, 16, '#D9473B', 0);
      for (const x of [-20, -6, 8, 22]) circle(ctx, x, -76, 2.6, WHITE, 0);
    });
    ellipse(ctx, 2, -86, 40, 32, null, 4.5);
    const tail = () => {
      ctx.beginPath();
      ctx.moveTo(-36, -70);
      ctx.quadraticCurveTo(2, -57, 40, -72);
      ctx.quadraticCurveTo(58, -26, 22, -5);
      ctx.quadraticCurveTo(-14, 5, -46, -14);
      ctx.lineTo(-56, -30);
      ctx.quadraticCurveTo(-40, -40, -36, -70);
      ctx.closePath();
    };
    tail();
    ctx.fillStyle = red;
    ctx.fill();
    ctx.save();
    tail();
    ctx.clip();
    ctx.globalAlpha = 0.5;
    scales(ctx, -56, -60, 56, -6, 8, shade(red, -60));
    ctx.globalAlpha = 0.4;
    ellipse(ctx, 18, -24, 26, 12, '#FFD2C2', 0, -0.4);
    ctx.restore();
    tail();
    line(ctx, 4.5);
    ctx.stroke();
    // A frilly fin at the belly.
    ctx.beginPath();
    ctx.moveTo(30, -42);
    ctx.quadraticCurveTo(54, -52, 62, -34);
    ctx.quadraticCurveTo(52, -32, 54, -20);
    ctx.quadraticCurveTo(44, -24, 40, -16);
    ctx.quadraticCurveTo(34, -28, 30, -42);
    ctx.closePath();
    ctx.fillStyle = fin;
    ctx.fill();
    line(ctx, 3.5);
    ctx.stroke();
    stroke(ctx, [[34, -38], [54, -34]], 1.8, WHITE);
    // Forelegs: a dog's paws.
    for (const s of [-1, 1] as const) {
      const ax = s * 40 + 2;
      ellipse(ctx, ax, -72, 12, 19, WHITE, 4, -s * 0.45);
      for (const k of [-1, 1]) stroke(ctx, [[ax + s * 7 + k * 4, -58], [ax + s * 8 + k * 4, -54]], 2.2);
    }
  }
  // The head: a 犬張子 dog, white with black and red markings: black floppy ears and a black patch, a red flower painted
  // on top, black brows, a little muzzle.
  for (const s of [-1, 1]) ellipse(ctx, s * 44, -150, 14, 21, black, 4, -s * 0.75);
  head(ctx, WHITE, 50, 42, -126);
  clipEllipse(ctx, 0, -126, 50, 42, () => ellipse(ctx, 30, -158, 18, 12, black, 0, 0.3));
  ellipse(ctx, 0, -126, 50, 42, null, 4.5);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    circle(ctx, -22 + Math.cos(a) * 5.5, -153 + Math.sin(a) * 5.5, 4.2, '#D9473B', 0);
  }
  circle(ctx, -22, -153, 2.4, '#FFE7A8', 0);
  const fx = FX;
  for (const s of [-1, 1]) ellipse(ctx, fx + s * 19, -149, 6, 3.4, black, 0);
  eyes(ctx, fx, -134, 19, 6.5, p.mood ?? 'normal');
  blushPair(ctx, -118, 36);
  ellipse(ctx, fx * 1.2, -112, 21, 15, WHITE, 3.5);
  ellipse(ctx, fx * 1.2, -121, 7, 5, black, 0);
  stroke(ctx, [[fx * 1.2, -116], [fx * 1.2, -110]], 2.4);
  mouth(ctx, fx * 1.2, -108, p.mouthOpen ? 'open' : 'w', 0.9);
};

// あのこ: Chiikawa's old sticker-job friend, become a chimera many times its size. White and fluffy (beige below), a
// small yellow horn on the forehead, a cat-like face with fluffy cheeks, big yellow claws and a long dragon-like tail
// (the tail that knocked Hachiware flat on the big hunt).
const anoko: Drawer = (ctx, p, o) => {
  const beige = '#EADAB6';
  const yellow = '#F2CC4E';
  // Long yellow claws.
  const claws = (x: number, y: number, dir: number) => {
    for (const k of [-1, 0, 1]) poly(ctx, [[x + k * 6 - 3, y], [x + k * 6 + 3, y], [x + k * 8 + dir * 8, y + 19]], yellow, 2.5);
  };
  if (!o.headOnly) {
    const ridge = taperedTail(ctx, [[-20, -42], [-70, -6], [-98, -40], [-76, -104]], 30, 7, beige, 4);
    ctx.save();
    ctx.globalAlpha = 0.6;
    for (let i = 6; i < ridge.length - 3; i += 4) {
      const [x, y] = ridge[i];
      stroke(ctx, [[x, y], [(x + ridge[i + 1][0]) / 2 + 4, (y + ridge[i + 1][1]) / 2 + 4]], 2, shade(beige, -50));
    }
    ctx.restore();
    for (let i = 5; i < ridge.length - 2; i += 4) {
      const [x0, y0] = ridge[i];
      const [x1, y1] = ridge[i + 2];
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      poly(ctx, [[x0, y0], [(x0 + x1) / 2 - ((y1 - y0) / len) * 9, (y0 + y1) / 2 + ((x1 - x0) / len) * 9], [x1, y1]], yellow, 2.5);
    }
    for (const fx of [-28, 30]) {
      ellipse(ctx, fx, -9, 22, 11, beige, 4);
      for (const k of [-1, 0, 1]) poly(ctx, [[fx + 16, -12 + k * 5], [fx + 31, -9 + k * 6], [fx + 17, -6 + k * 5]], yellow, 2.2);
    }
    ellipse(ctx, 2, -56, 48, 44, WHITE, 4.5);
    clipEllipse(ctx, 2, -56, 48, 44, () => ellipse(ctx, 2, -20, 54, 30, beige, 0));
    ellipse(ctx, 2, -56, 48, 44, null, 4.5);
    // Fluffy chest: a white bib whose lower edge is a row of tufts.
    const tufts: [number, number][] = [];
    for (let i = 0; i <= 6; i++) tufts.push([-30 + i * 11, -82 + Math.sin((i / 6) * Math.PI) * 16]);
    const bib = (closed: boolean) => {
      ctx.beginPath();
      if (closed) {
        ctx.moveTo(-34, -100);
        ctx.lineTo(...tufts[0]);
      } else ctx.moveTo(...tufts[0]);
      for (let i = 1; i < tufts.length; i++) {
        const [x0, y0] = tufts[i - 1];
        const [x1, y1] = tufts[i];
        ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 8, x1, y1);
      }
      if (closed) {
        ctx.lineTo(40, -100);
        ctx.closePath();
      }
    };
    bib(true);
    ctx.fillStyle = WHITE;
    ctx.fill();
    bib(false);
    line(ctx, 3);
    ctx.stroke();
    for (const s of [-1, 1] as const) {
      const ax = s * 50 + 2;
      ellipse(ctx, ax, -64, 14, 22, WHITE, 4, -s * 0.45);
      claws(ax + s * 9.6, -45, s);
    }
  }
  // Cat ears, fluffy cheeks, the head, the horn.
  for (const s of [-1, 1]) {
    poly(ctx, [[s * 18, -146], [s * 42, -170], [s * 48, -132]], WHITE, 4);
    poly(ctx, [[s * 26, -146], [s * 41, -162], [s * 44, -140]], '#F6B9C6', 0);
    poly(ctx, [[s * 44, -116], [s * 62, -110], [s * 50, -102], [s * 64, -94], [s * 48, -88], [s * 56, -78], [s * 40, -82]], WHITE, 3.5);
  }
  head(ctx, WHITE, 50, 42, -114);
  const fx = FX;
  poly(ctx, [[fx * 0.4 - 7, -152], [fx * 0.4 + 1, -176], [fx * 0.4 + 7, -152]], yellow, 3.5);
  eyes(ctx, fx, -112, 17, 6, p.mood ?? 'normal');
  blushPair(ctx, -100, 30);
  for (const s of [-1, 1]) for (const k of [-1, 1]) stroke(ctx, [[fx + s * 34, -96 + k * 4], [fx + s * 48, -97 + k * 7]], 2);
  mouth(ctx, fx, -97, p.mouthOpen ? 'open' : 'w');
};

/** Shaggy fur: pointed tufts along an ellipse from angle a0 to a1. With `fan`, the outline also runs to the centre, so
 *  an arc of tufts can sit behind a body that covers the rest. */
function shaggy(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, n: number, a0: number, a1: number, fill: string, fan = false): void {
  const pts: [number, number][] = fan ? [[cx, cy]] : [];
  for (let i = 0; i <= n * 2; i++) {
    const a = a0 + ((a1 - a0) * i) / (n * 2);
    const rr = i % 2 ? 0.84 : 1;
    pts.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]);
  }
  poly(ctx, pts, fill, 3.5);
}

// でかつよ: much bigger than the Chiikawa folk. A big face framed by a shaggy yellow mane, a shaggy yellow body, and four
// long black legs (said to look like an insect's). The face looks a little scary, like the demon of a lion dance (獅子舞).
const dekatsuyo: Drawer = (ctx, p, o) => {
  const yellow = '#F2C94C';
  const face = '#FBE6A8';
  const leg = '#48424A';
  // A long leg: up to a high knee, down to a hooked tip.
  const insectLeg = (hip: [number, number], knee: [number, number], foot: [number, number], fill: string) => {
    const dir = Math.sign(foot[0] - hip[0]);
    tube(ctx, [hip, knee, foot, [foot[0] + dir * 9, foot[1] + 2]], 5, fill);
    circle(ctx, knee[0], knee[1], 5, fill, 2.5);
  };
  if (!o.headOnly) {
    insectLeg([-56, -70], [-80, -128], [-82, -6], shade(leg, -14));
    insectLeg([-36, -58], [-56, -112], [-56, -6], shade(leg, -14));
    // The big shaggy yellow body, reaching back behind the head.
    shaggy(ctx, -14, -82, 80, 52, 12, Math.PI * 0.95, Math.PI * 2.05, yellow, true);
    ellipse(ctx, -14, -82, 72, 44, yellow, 4.5);
    clipEllipse(ctx, -14, -82, 72, 44, () => {
      ellipse(ctx, -14, -40, 76, 18, shade(yellow, -26), 0);
      ctx.globalAlpha = 0.5;
      for (const [x, y] of [
        [-62, -96],
        [-52, -80],
        [-70, -72],
        [-40, -104],
        [44, -74],
      ])
        stroke(ctx, [[x, y], [x + 6, y + 5]], 2.2, shade(yellow, -60));
    });
    ellipse(ctx, -14, -82, 72, 44, null, 4.5);
    insectLeg([22, -58], [46, -112], [54, -6], leg);
    insectLeg([40, -70], [68, -128], [80, -6], leg);
  }
  // The shaggy mane around the face, then the face: heavy brows, staring eyes, a big nose, a toothy mouth.
  shaggy(ctx, 0, -112, 64, 56, 18, 0, Math.PI * 2, yellow);
  head(ctx, face, 46, 40, -112);
  const fx = FX * 0.9;
  for (const s of [-1, 1]) {
    ellipse(ctx, fx + s * 20, -136, 15, 6, '#5B3F27', 2.5, -s * 0.32);
    circle(ctx, fx + s * 19, -119, 10.5, WHITE, 3.5);
    circle(ctx, fx + s * 19 + 2, -118, 4.5, INK, 0);
  }
  ellipse(ctx, fx, -103, 10, 7, shade(face, -40), 3);
  mouth(ctx, fx, -88, p.mouthOpen ? 'open' : 'teeth', 1.5);
};

// でかい鳥: the only flier. A big round white bird: a wide, flat pale-yellow bill, two short antennae with round yellow
// tips, small dot eyes under worried brows, long white wing feathers and yellow feet. It swoops down, grabs a friend and
// flies off with it (the game hangs the friend under its feet).
const dekaiTori: Drawer = (ctx, p, o) => {
  const grey = '#D9DDE5';
  const yellow = '#F4CC4A';
  // A wing spread out behind it, gliding, with long flight feathers along its trailing edge. The attack lifts it
  // straight up and beats it down.
  const wing = (dx: number, dy: number, fill: string) => {
    const tips: [number, number][] = [
      [-94, -112],
      [-86, -100],
      [-76, -88],
      [-62, -78],
      [-46, -72],
    ];
    const pts = (): void => {
      ctx.beginPath();
      ctx.moveTo(-2 + dx, -94 + dy);
      ctx.quadraticCurveTo(-40 + dx, -130 + dy, -94 + dx, -126 + dy);
      let [px, py] = [-94, -126];
      for (const [tx, ty] of tips) {
        // A notch between feathers, then the next feather's rounded tip.
        ctx.quadraticCurveTo((px + tx) / 2 + 8 + dx, (py + ty) / 2 + 2 + dy, tx + 6 + dx, ty - 3 + dy);
        ctx.quadraticCurveTo(tx + dx, ty + 4 + dy, tx - 2 + dx, ty + 2 + dy);
        [px, py] = [tx, ty];
      }
      ctx.quadraticCurveTo(-24 + dx, -76 + dy, -2 + dx, -94 + dy);
      ctx.closePath();
    };
    pts();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.save();
    pts();
    ctx.clip();
    for (const [tx, ty] of tips) stroke(ctx, [[tx + 6 + dx, ty - 3 + dy], [tx * 0.5 + 6 + dx, ty * 0.5 - 62 + dy]], 2, grey);
    ctx.restore();
    pts();
    line(ctx, 4);
    ctx.stroke();
  };
  const foot = (x: number) => {
    tube(ctx, [[x, -44], [x + 1, -10]], 5, yellow);
    for (const k of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + k * 6, -9);
      ctx.quadraticCurveTo(x + k * 9 + 4, -6, x + k * 8 + 4, 1);
      line(ctx, 7, INK);
      ctx.stroke();
      line(ctx, 3, yellow);
      ctx.stroke();
    }
  };
  if (!o.headOnly) {
    wing(2, -16, '#F1F2F5');
    for (const [x, y, r] of [
      [-56, -78, 0.35],
      [-60, -64, 0.75],
      [-54, -52, 1.1],
    ])
      ellipse(ctx, x - 10, y, 24, 8, WHITE, 3.5, r);
    foot(-16);
    ellipse(ctx, -6, -80, 56, 48, WHITE, 4.5);
    clipEllipse(ctx, -6, -80, 56, 48, () => {
      ellipse(ctx, -6, -34, 62, 18, grey, 0);
      for (const [x, y] of [
        [2, -66],
        [16, -70],
        [8, -54],
        [22, -56],
      ])
        stroke(ctx, [[x - 4, y - 3], [x, y], [x + 4, y - 3]], 2, grey);
    });
    ellipse(ctx, -6, -80, 56, 48, null, 4.5);
    foot(12);
  }
  // The head: two short antennae with round yellow tips, small dot eyes under worried brows, a wide flat bill.
  for (const s of [-1, 1]) {
    stroke(ctx, [[s * 9, -148], [s * 13, -164]], 3);
    circle(ctx, s * 13, -167, 5.5, yellow, 3);
  }
  circle(ctx, 0, -120, 34, WHITE, 4.5);
  const fx = FX * 0.7;
  eyes(ctx, fx, -126, 12, 3.6, p.mood ?? 'worried');
  ellipse(ctx, fx + 10, -109, 22, 8, '#F7E7A3', 3.5);
  stroke(ctx, [[fx - 8, -109], [fx + 28, -109]], 2.2);
  if (!o.headOnly) {
    wing(0, 0, WHITE);
  }
};

export const SUBJECTS: Record<string, Drawer> = {
  chiikawa,
  chiikawa_island: chiikawaIsland,
  hachiware,
  hachiware_pajama: hachiwarePajama,
  usagi,
  usagi_cool: usagiCool,
  momonga,
  kurimanju,
  shisa,
  yoroi,
  yoroi_erai: yoroiErai,
  ode,
  rakko,
  yoroi_rodo: yoroiRodo,
  yoroi_pochette: yoroiPochette,
  yoroi_ramen: yoroiRamen,
  furuhonya,
  futaba,
  hitoha,
  shimajiro,
  mushi_twolegs: mushiTwolegs,
  mermaid_twolegs: mermaidTwolegs,
  mushi_pink: mushiPink,
  mushi_sixlegs: mushiSixlegs,
  mushi_horned: mushiHorned,
  goblin,
  chushidesu,
  fugu,
  majyo,
  kimera,
  kuroi_nagareboshi: kuroiNagareboshi,
  guchokipanogitaigata: gitaigata,
  zou,
  chiikabu: chiikabuSmall,
  chiikabu_true: chiikabuTrue,
  pajama_parties: pajamaParties,
  hoshi,
  taiyaki,
  muchauman,
  ningyo,
  yamanba,
  seiren,
  anoko,
  dekatsuyo,
  dekai_tori: dekaiTori,
};

Object.assign(HEAD_CENTER, {
  yoroi: { y: -104, r: 52 },
  yoroi_erai: { y: -110, r: 56 },
  // The hood and its cat ears.
  hachiware_pajama: { y: -100, r: 66 },
  usagi_cool: { y: -104, r: 72 },
  muchauman: { y: -128, r: 50 },
  yoroi_rodo: { y: -104, r: 52 },
  yoroi_pochette: { y: -104, r: 52 },
  yoroi_ramen: { y: -104, r: 52 },
  ode: { y: -122, r: 52 },
  mushi_twolegs: { y: -84, r: 62 },
  mermaid_twolegs: { y: -84, r: 50 },
  mushi_pink: { y: -84, r: 62 },
  mushi_sixlegs: { y: -104, r: 52 },
  mushi_horned: { y: -110, r: 60 },
  goblin: { y: -100, r: 66 },
  chushidesu: { y: -66, r: 62 },
  fugu: { y: -64, r: 58 },
  majyo: { y: -110, r: 56 },
  kimera: { y: -106, r: 60 },
  kuroi_nagareboshi: { y: -76, r: 60 },
  guchokipanogitaigata: { y: -100, r: 70 },
  zou: { y: -104, r: 66 },
  chiikabu: { y: -88, r: 46 },
  usagi: { y: -104, r: 72 },
  shisa: { y: -94, r: 68 },
  momonga: { y: -96, r: 64 },
  furuhonya: { y: -104, r: 66 },
  // The whole round islander and its leaves (the boat is the body).
  futaba: { y: -80, r: 58 },
  hitoha: { y: -80, r: 58 },
  // His head and the swirl of hair on top.
  shimajiro: { y: -122, r: 50 },
  // The four idols' heads, close together.
  pajama_parties: { y: -96, r: 60 },
  hoshi: { y: -84, r: 62 },
  taiyaki: { y: -56, r: 62 },
  ningyo: { y: -98, r: 58 },
  // Her hair falls down her back, so the frame reaches down to its ends.
  yamanba: { y: -108, r: 54 },
  seiren: { y: -128, r: 58 },
  anoko: { y: -118, r: 58 },
  dekatsuyo: { y: -114, r: 60 },
  dekai_tori: { y: -124, r: 52 },
});

export function headOf(subject: string): { y: number; r: number } {
  return HEAD_CENTER[subject] ?? DEFAULT_HEAD;
}
