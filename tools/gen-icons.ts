// Generates the placeholder PWA icons, favicon and link-preview image into public/icons.
//   npm run icons
// Replace these files with real art whenever you like; nothing else needs to change.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Canvas, createCanvas } from '@napi-rs/canvas';
import { drawPortrait } from '../src/art/placeholders/render';
import { FONT_STACK } from '../src/art/placeholders/kit';

const OUT = join(process.cwd(), 'public', 'icons');
mkdirSync(OUT, { recursive: true });

type Ctx = CanvasRenderingContext2D;

function icon(size: number, pad: number, rounded: boolean): Canvas {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d') as unknown as Ctx;
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#FFF6E9');
  g.addColorStop(1, '#FDE4EA');
  ctx.fillStyle = g;
  if (rounded) {
    const r = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(size, 0, size, size, r);
    ctx.arcTo(size, size, 0, size, r);
    ctx.arcTo(0, size, 0, 0, r);
    ctx.arcTo(0, 0, size, 0, r);
    ctx.closePath();
    ctx.fill();
  } else ctx.fillRect(0, 0, size, size);
  // Grass at the bottom.
  ctx.fillStyle = '#BFE3A1';
  ctx.beginPath();
  ctx.ellipse(size / 2, size * 1.05, size * 0.8, size * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  const inner = size - pad * 2;
  ctx.save();
  ctx.translate(pad, pad + inner * 0.02);
  drawPortrait(ctx, 'chiikawa', inner, inner);
  ctx.restore();
  return c;
}

const files: [string, Canvas][] = [
  ['icon-192.png', icon(192, 18, true)],
  ['icon-512.png', icon(512, 48, true)],
  ['icon-maskable-512.png', icon(512, 110, false)],
  ['apple-touch-icon.png', icon(180, 16, false)],
  ['favicon-64.png', icon(64, 4, true)],
];
for (const [name, c] of files) writeFileSync(join(OUT, name), c.toBuffer('image/png'));

// Link preview.
const og = createCanvas(1200, 630);
const o = og.getContext('2d') as unknown as Ctx;
const g = o.createLinearGradient(0, 0, 0, 630);
g.addColorStop(0, '#E3F3FF');
g.addColorStop(0.62, '#FFF6E9');
g.addColorStop(0.62, '#BFE3A1');
g.addColorStop(1, '#B2DA92');
o.fillStyle = g;
o.fillRect(0, 0, 1200, 630);
for (const [i, s] of ['hachiware', 'chiikawa', 'usagi'].entries()) {
  o.save();
  o.translate(150 + i * 300, 250);
  drawPortrait(o, s, 300, 300);
  o.restore();
}
o.font = `900 76px ${FONT_STACK}`;
o.textAlign = 'center';
o.lineJoin = 'round';
o.lineWidth = 14;
o.strokeStyle = '#FFFFFF';
o.strokeText('ちいかわ討伐ディフェンス', 600, 150);
o.fillStyle = '#3B2F2F';
o.fillText('ちいかわ討伐ディフェンス', 600, 150);
writeFileSync(join(OUT, 'og-image.png'), og.toBuffer('image/png'));

console.log(`icons → ${OUT}`);
