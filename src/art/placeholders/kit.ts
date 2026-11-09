// Small vector toolkit for procedural placeholder art. Only standard Canvas 2D calls, so it
// runs in the browser and in Node (@napi-rs/canvas) for the exported art kit.

export type Ctx = CanvasRenderingContext2D;

export const INK = '#3B2F2F';
export const BLUSH = '#F6AFC0';
export const WHITE = '#FFFFFF';

export const FONT_STACK = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", "Meiryo", system-ui, sans-serif';

export function line(ctx: Ctx, w = 4, color = INK): void {
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string | null, lw = 4, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (lw > 0) {
    line(ctx, lw);
    ctx.stroke();
  }
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string | null, lw = 4): void {
  ellipse(ctx, x, y, r, r, fill, lw);
}

export function poly(ctx: Ctx, pts: [number, number][], fill: string | null, lw = 4, close = true): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (lw > 0) {
    line(ctx, lw);
    ctx.stroke();
  }
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | null, lw = 4): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (lw > 0) {
    line(ctx, lw);
    ctx.stroke();
  }
}

export function stroke(ctx: Ctx, pts: [number, number][], lw = 4, color = INK): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  line(ctx, lw, color);
  ctx.stroke();
}

export function arc(ctx: Ctx, x: number, y: number, r: number, a0: number, a1: number, lw = 4, color = INK): void {
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a1);
  line(ctx, lw, color);
  ctx.stroke();
}

/** Chiikawa-style blush: soft pink oval with three diagonal hatch marks. */
export function blush(ctx: Ctx, x: number, y: number, s = 1): void {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ellipse(ctx, x, y, 10 * s, 6 * s, BLUSH, 0);
  ctx.globalAlpha = 1;
  for (let i = -1; i <= 1; i++) stroke(ctx, [[x + i * 5 * s - 2 * s, y + 3 * s], [x + i * 5 * s + 2 * s, y - 3 * s]], 1.6 * s, '#E07A92');
  ctx.restore();
}

export type Mood = 'normal' | 'closed' | 'happy' | 'wince' | 'worried' | 'angry' | 'tears' | 'sparkle' | 'glare';

/** A pair of eyes. gap = distance from centre to each eye. */
export function eyes(ctx: Ctx, x: number, y: number, gap: number, r: number, mood: Mood): void {
  for (const side of [-1, 1]) {
    const ex = x + side * gap;
    switch (mood) {
      case 'closed':
        stroke(ctx, [[ex - r, y], [ex + r, y]], 2.6);
        break;
      case 'happy':
        arc(ctx, ex, y + r * 0.6, r, Math.PI * 1.15, Math.PI * 1.85, 2.8);
        break;
      case 'wince':
        stroke(ctx, [[ex - r, y - r * 0.7], [ex + r * 0.6, y], [ex - r, y + r * 0.7]].map(([a, b]) => [side < 0 ? a : 2 * ex - a, b]) as [number, number][], 2.6);
        break;
      case 'glare':
        ellipse(ctx, ex, y, r * 1.1, r * 0.75, INK, 0);
        circle(ctx, ex, y, r * 0.35, '#FF8A4C', 0);
        break;
      default: {
        ellipse(ctx, ex, y, r * 0.85, r, INK, 0);
        circle(ctx, ex - r * 0.25, y - r * 0.35, r * 0.32, WHITE, 0);
        if (mood === 'sparkle') circle(ctx, ex + r * 0.3, y + r * 0.3, r * 0.18, WHITE, 0);
        if (mood === 'worried') stroke(ctx, [[ex - side * r * 1.2, y - r * 2.1], [ex + side * r * 0.9, y - r * 1.5]], 2.2);
        if (mood === 'angry') stroke(ctx, [[ex - side * r * 1.2, y - r * 1.5], [ex + side * r * 0.9, y - r * 2.1]], 2.4);
        if (mood === 'tears') {
          ctx.save();
          ctx.globalAlpha = 0.85;
          ellipse(ctx, ex + side * r * 0.4, y + r * 1.8, r * 0.45, r * 0.9, '#8FD0F2', 0);
          ctx.restore();
        }
      }
    }
  }
}

export type MouthKind = 'w' | 'o' | 'open' | 'wide' | 'smile' | 'flat' | 'grin' | 'teeth';

export function mouth(ctx: Ctx, x: number, y: number, kind: MouthKind, s = 1): void {
  switch (kind) {
    case 'w':
      ctx.beginPath();
      ctx.moveTo(x - 6 * s, y - 1 * s);
      ctx.quadraticCurveTo(x - 3 * s, y + 4 * s, x, y);
      ctx.quadraticCurveTo(x + 3 * s, y + 4 * s, x + 6 * s, y - 1 * s);
      line(ctx, 2.4 * s);
      ctx.stroke();
      break;
    case 'o':
      ellipse(ctx, x, y + 1 * s, 3.2 * s, 4 * s, INK, 0);
      break;
    case 'open':
      ellipse(ctx, x, y + 2 * s, 6 * s, 5 * s, '#C8505A', 2.4 * s);
      break;
    case 'wide':
      ctx.beginPath();
      ctx.moveTo(x - 10 * s, y - 2 * s);
      ctx.quadraticCurveTo(x, y + 14 * s, x + 10 * s, y - 2 * s);
      ctx.closePath();
      ctx.fillStyle = '#C8505A';
      ctx.fill();
      line(ctx, 2.4 * s);
      ctx.stroke();
      break;
    case 'smile':
      arc(ctx, x, y - 3 * s, 6 * s, Math.PI * 0.15, Math.PI * 0.85, 2.4 * s);
      break;
    case 'grin':
      ctx.beginPath();
      ctx.moveTo(x - 12 * s, y - 3 * s);
      ctx.quadraticCurveTo(x, y + 9 * s, x + 12 * s, y - 3 * s);
      line(ctx, 2.6 * s);
      ctx.stroke();
      break;
    case 'teeth':
      roundRect(ctx, x - 11 * s, y - 4 * s, 22 * s, 9 * s, 3 * s, WHITE, 2.4 * s);
      for (let i = -1; i <= 1; i++) stroke(ctx, [[x + i * 5.5 * s, y - 4 * s], [x + i * 5.5 * s, y + 5 * s]], 1.6 * s);
      break;
    default:
      stroke(ctx, [[x - 4 * s, y], [x + 4 * s, y]], 2.4 * s);
  }
}

export function star(ctx: Ctx, x: number, y: number, r: number, inner: number, points: number, fill: string | null, lw = 4, rot = -Math.PI / 2): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? inner : r;
    const a = rot + (i * Math.PI) / points;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  poly(ctx, pts, fill, lw);
}

/** #RRGGBB → rgba() with the given alpha. Fading to the same colour at alpha 0 avoids muddy gradients. */
export function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Soft radial glow. */
export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number): void {
  if (alpha <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color.startsWith('#') ? withAlpha(color, 0) : 'rgba(255,255,255,0)');
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function label(ctx: Ctx, text: string, x: number, y: number, size: number, color = INK, align: CanvasTextAlign = 'center', weight = 700): void {
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT_STACK}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Deterministic pseudo-random for decoration (same output every time). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
