// Placeholders for the quest board's pictures: the blank notice paper, one world picture per quest and the
// 討伐ランキング's picture (Rakko and his car), each in a soft cloud frame. Briefs, not art; the owner's pictures
// replace them.

import type { ImageSpec } from '../spec';
import { circle, type Ctx, ellipse, INK, label, poly, roundRect, seeded, star, WHITE } from './kit';

const FRAME = '#6B4A3A';
const STAMP = '#C0322B';

/** Sky, ground and what stands in each world's picture. */
const LOOK: { sky: [string, string]; ground: string; mark: (ctx: Ctx, w: number, h: number) => void }[] = [
  // 1 Hachiware's cave
  { sky: ['#9FD3F5', '#E3F3FF'], ground: '#A9DB8C', mark: (ctx, w, h) => {
      ellipse(ctx, w * 0.55, h * 0.62, w * 0.24, h * 0.3, '#C9C2CC', 6);
      ellipse(ctx, w * 0.55, h * 0.7, w * 0.08, h * 0.13, '#5E5560', 5);
    } },
  // 2 the forest exit
  { sky: ['#BFE6F7', '#F0FAFF'], ground: '#9ED17F', mark: (ctx, w, h) => {
      for (const x of [0.16, 0.3, 0.7, 0.84]) {
        roundRect(ctx, w * x - 22, h * 0.32, 44, h * 0.42, 10, '#C98E5E', 5);
        circle(ctx, w * x, h * 0.28, h * 0.17, '#7CC36A', 5);
      }
    } },
  // 3 ラーメン屋「郎」
  { sky: ['#FFD3A8', '#FFF1E0'], ground: '#E8D9C2', mark: (ctx, w, h) => {
      roundRect(ctx, w * 0.22, h * 0.24, w * 0.56, h * 0.5, 12, '#F7E2C2', 6);
      roundRect(ctx, w * 0.2, h * 0.2, w * 0.6, h * 0.14, 8, '#FFD95E', 6);
      label(ctx, '郎', w * 0.5, h * 0.28, h * 0.11, INK, 'center', 900);
    } },
  // 4 Chiikawa's home at night
  { sky: ['#2F4A86', '#5671B0'], ground: '#8E9CC8', mark: (ctx, w, h) => {
      const rnd = seeded(14);
      for (let i = 0; i < 7; i++) star(ctx, w * (0.12 + rnd() * 0.76), h * (0.1 + rnd() * 0.25), 12, 5, 5, '#FFE58A', 0);
      ellipse(ctx, w * 0.5, h * 0.72, w * 0.2, h * 0.32, '#C7CEF0', 6);
      roundRect(ctx, w * 0.42, h * 0.5, 70, 60, 6, '#FFE7A1', 5);
    } },
  // 5 the beach cave
  { sky: ['#7FA4C8', '#C6D8EA'], ground: '#D8D4CF', mark: (ctx, w, h) => {
      roundRect(ctx, 0, h * 0.58, w * 0.42, h * 0.2, 0, '#6E9CC0', 0);
      poly(ctx, [[w * 0.45, h * 0.8], [w * 0.62, h * 0.25], [w * 0.92, h * 0.2], [w, h * 0.8]], '#B8B8C4', 6);
      ellipse(ctx, w * 0.72, h * 0.66, w * 0.1, h * 0.16, '#3E3A4A', 5);
    } },
  // 6 the landing spot of the big hunt
  { sky: ['#8FBF9A', '#CFE7D3'], ground: '#F3E9D2', mark: (ctx, w, h) => {
      for (const x of [0.1, 0.3, 0.72, 0.9]) circle(ctx, w * x, h * 0.36, h * 0.2, '#93C48A', 5);
      roundRect(ctx, w * 0.33 - 10, h * 0.5, 20, h * 0.16, 6, '#F8F2F2', 4);
      ellipse(ctx, w * 0.33, h * 0.5, 60, 34, '#D58BD0', 5);
    } },
];

/** The picture's soft frame: a well-rounded rectangle (path only). */
function frame(ctx: Ctx, w: number, h: number): void {
  const m = 18;
  const r = Math.min(w, h) * 0.18;
  const [x0, y0, x1, y1] = [m, m, w - m, h - m];
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.arcTo(x1, y0, x1, y1, r);
  ctx.arcTo(x1, y1, x0, y1, r);
  ctx.arcTo(x0, y1, x0, y0, r);
  ctx.arcTo(x0, y0, x1, y0, r);
  ctx.closePath();
}

/** Draw the placeholder for a quest board picture into a canvas of its spec size. */
export function drawCard(ctx: Ctx, spec: ImageSpec): void {
  const { w, h } = spec;
  const id = spec.key.split('/')[1];
  if (id === 'book') {
    // An open book seen from above: the cover peeking out, two cream pages, the spine.
    roundRect(ctx, 6, 30, w - 12, h - 60, 40, '#E59A6B', 6);
    roundRect(ctx, 46, 12, w / 2 - 50, h - 96, 26, '#FBEBD5', 5);
    roundRect(ctx, w / 2 + 4, 12, w / 2 - 50, h - 96, 26, '#FBEBD5', 5);
    poly(ctx, [[w / 2 - 4, 30], [w / 2 + 4, 30], [w / 2 + 4, h - 90], [w / 2 - 4, h - 90]], '#E7C9A7', 0);
    return;
  }
  if (id === 'paper') {
    // A sheet with a torn bottom and a red pin at the top.
    const rnd = seeded(5);
    ctx.beginPath();
    ctx.moveTo(10, 14);
    ctx.lineTo(w - 10, 14);
    ctx.lineTo(w - 12, h - 70);
    for (let x = w - 12; x > 12; x -= 40) ctx.lineTo(x - 20, h - 70 + (rnd() - 0.3) * 34);
    ctx.lineTo(12, h - 70);
    ctx.closePath();
    ctx.fillStyle = '#FCEFC9';
    ctx.fill();
    circle(ctx, w / 2, 46, 20, '#E8656C', 0);
    circle(ctx, w / 2 - 6, 40, 6, WHITE, 0);
    return;
  }
  if (id === 'stamp_soon') {
    // A red rubber stamp, pressed a little crooked.
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-0.1);
    roundRect(ctx, -w * 0.44, -h * 0.36, w * 0.88, h * 0.72, h * 0.08, null, 0);
    ctx.strokeStyle = STAMP;
    ctx.lineWidth = 14;
    ctx.stroke();
    label(ctx, '準備中', 0, 4, h * 0.42, STAMP, 'center', 900);
    ctx.restore();
    return;
  }
  if (id === 'ranking') {
    // Evening, monster shadows far off on the horizon, Rakko (a pale round shape) standing by his car.
    ctx.save();
    frame(ctx, w, h);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#F3A27C');
    sky.addColorStop(1, '#FCE2C3');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#D9C49C';
    ctx.fillRect(0, h * 0.64, w, h * 0.4);
    for (let i = 0; i < 9; i++) ellipse(ctx, w * (0.08 + i * 0.105), h * 0.63, 18, 13, 'rgba(90, 60, 70, 0.35)', 0);
    // The car.
    roundRect(ctx, w * 0.5, h * 0.44, w * 0.32, h * 0.2, 26, '#9CC9E8', 6);
    roundRect(ctx, w * 0.56, h * 0.33, w * 0.17, h * 0.14, 18, '#DDEFFA', 6);
    circle(ctx, w * 0.57, h * 0.66, h * 0.07, '#5E5560', 6);
    circle(ctx, w * 0.75, h * 0.66, h * 0.07, '#5E5560', 6);
    // Rakko.
    ellipse(ctx, w * 0.33, h * 0.56, w * 0.07, h * 0.2, '#F4EFE6', 6);
    circle(ctx, w * 0.33, h * 0.33, h * 0.11, '#F4EFE6', 6);
    circle(ctx, w * 0.31, h * 0.32, 5, INK, 0);
    circle(ctx, w * 0.355, h * 0.32, 5, INK, 0);
    label(ctx, 'Ranking', w - 150, h - 46, 40, INK, 'right', 900);
    ctx.restore();
    frame(ctx, w, h);
    ctx.lineWidth = 8;
    ctx.strokeStyle = FRAME;
    ctx.stroke();
    return;
  }
  const n = Math.max(1, Math.min(6, Number(id.replace('world', '')) || 1));
  const look = LOOK[n - 1];
  ctx.save();
  frame(ctx, w, h);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, look.sky[0]);
  g.addColorStop(1, look.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = look.ground;
  ctx.fillRect(0, h * 0.62, w, h * 0.4);
  look.mark(ctx, w, h);
  label(ctx, `World ${n}`, w - 40, h - 46, 40, n === 4 ? WHITE : INK, 'right', 900);
  ctx.restore();
  frame(ctx, w, h);
  ctx.lineWidth = 8;
  ctx.strokeStyle = FRAME;
  ctx.stroke();
}
