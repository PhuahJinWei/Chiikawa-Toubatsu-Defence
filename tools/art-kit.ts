// Exports every placeholder as a PNG under the name the game expects, plus contact sheets: each scene assembled
// with its safe area and slots, and the stickers. Paint over these (or from scratch), then bring the art in (see
// ASSET_CHECKLIST.md).
//   npm run art:kit            → writes ./art-kit/

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { FONT_STACK, INK } from '../src/art/placeholders/kit';
import { drawImage } from '../src/art/placeholders/render';
import { drawScenePiece } from '../src/art/placeholders/scenes';
import { drawSticker } from '../src/art/placeholders/stickers';
import { ALL_IMAGES, pictureSize, SCENES, SOUNDS, STICKER_DETAIL, STICKERS } from '../src/art/spec';

const OUT = join(process.cwd(), 'art-kit');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

type Ctx = CanvasRenderingContext2D;
const asCtx = (c: SKRSContext2D) => c as unknown as Ctx;

function save(path: string, canvas: Canvas) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, canvas.toBuffer('image/png'));
}

function tag(ctx: Ctx, text: string, x: number, y: number, size = 20) {
  ctx.font = `700 ${size}px ${FONT_STACK}`;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(x - 4, y - size, ctx.measureText(text).width + 8, size + 8);
  ctx.fillStyle = INK;
  ctx.fillText(text, x, y);
}

let files = 0;

// ---------------------------------------------------------------- every picture's placeholder
for (const spec of ALL_IMAGES) {
  // Each placeholder at the size to draw it (twice the planned size for a sticker).
  const size = pictureSize(spec);
  const c = createCanvas(size.w, size.h);
  const ctx = asCtx(c.getContext('2d'));
  ctx.scale(size.w / spec.w, size.h / spec.h);
  drawImage(ctx, spec);
  save(join(OUT, `${spec.key}.png`), c);
  files++;
}

// ---------------------------------------------------------------- scenes, assembled, with the safe area and slots
for (const sc of SCENES) {
  const k = Math.min(1, 2400 / sc.w);
  const sheet = createCanvas(Math.round(sc.w * k), Math.round(sc.h * k));
  const ctx = asCtx(sheet.getContext('2d'));
  ctx.scale(k, k);
  ctx.fillStyle = sc.backdrop;
  ctx.fillRect(0, 0, sc.w, sc.h);
  for (const l of [...sc.layers].sort((a, b) => b.z - a.z)) {
    const c = createCanvas(Math.max(1, Math.round(l.w)), Math.max(1, Math.round(l.h)));
    drawScenePiece(asCtx(c.getContext('2d')), sc.id, l.id);
    ctx.drawImage(c as unknown as CanvasImageSource, l.x, l.y, l.w, l.h);
  }
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = 'rgba(74, 144, 198, 0.95)';
  if (sc.kind === 'menu') ctx.strokeRect(sc.safe.x0, sc.safe.y0, sc.safe.x1 - sc.safe.x0, sc.safe.y1 - sc.safe.y0);
  if (sc.field) {
    ctx.strokeStyle = 'rgba(40, 170, 120, 0.95)';
    ctx.strokeRect(sc.field.x, sc.field.y, 1530, 850);
    for (let i = 1; i < 5; i++) ctx.strokeRect(sc.field.x, sc.field.y + i * 170, 1530, 0);
    for (let i = 1; i < 9; i++) ctx.strokeRect(sc.field.x + i * 170, sc.field.y, 0, 850);
    ctx.strokeStyle = 'rgba(226, 90, 120, 0.9)';
    ctx.strokeRect(sc.field.x - 170, sc.field.y, 170, 850);
  }
  ctx.strokeStyle = 'rgba(226, 90, 120, 0.95)';
  for (const s of sc.slots) {
    ctx.strokeRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h);
    if (sc.slots.length < 12) tag(ctx, s.id, s.x - s.w / 2 + 6, s.y - s.h / 2 + 24, 18);
  }
  ctx.setLineDash([]);
  tag(ctx, `scene ${sc.id} · ${sc.w}×${sc.h} · ${sc.kind === 'world' ? 'green = the field, pink = parking strip' : 'blue = always visible, pink = slots'}`, 14, 34, 24);
  save(join(OUT, '_sheets', `scene_${sc.id}.png`), sheet);
}

// ---------------------------------------------------------------- stickers
{
  const cell = 200;
  const cols = 6;
  const sheet = createCanvas(16 + cols * (cell + 12), 60 + Math.ceil(STICKERS.length / cols) * (cell + 34));
  const ctx = asCtx(sheet.getContext('2d'));
  ctx.fillStyle = '#FFF8EE';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  tag(ctx, `stickers · shown at their size on the field · labels: the size to draw them (${STICKER_DETAIL}×)`, 16, 32, 20);
  STICKERS.forEach((s, i) => {
    const x0 = 16 + (i % cols) * (cell + 12);
    const y0 = 52 + Math.floor(i / cols) * (cell + 34);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x0, y0, cell, cell);
    const c = createCanvas(s.w, s.h);
    drawSticker(asCtx(c.getContext('2d')), s);
    const k = Math.min(1, (cell - 20) / Math.max(s.w, s.h));
    ctx.drawImage(c as unknown as CanvasImageSource, x0 + (cell - s.w * k) / 2, y0 + (cell - s.h * k) / 2, s.w * k, s.h * k);
    tag(ctx, `${s.id} ${s.w * STICKER_DETAIL}×${s.h * STICKER_DETAIL}`, x0 + 4, y0 + cell + 22, 14);
  });
  save(join(OUT, '_sheets', 'stickers.png'), sheet);
}

writeFileSync(
  join(OUT, 'README.md'),
  `# Placeholder art kit

Every placeholder, saved under the path and name the game expects inside \`/art\`, plus contact sheets in \`_sheets/\`.

- \`scenes/<scene>/<piece>.png\`: one picture per piece of a menu scene, and a battle world's one picture (\`picture.png\`). \`_sheets/scene_<scene>.png\` shows the scene
  assembled: blue = always visible, pink boxes = slots the game fills (keep them clear), and for battle worlds the field
  in green with the parking strip in pink.
- \`stickers/\`, \`portraits/\`, \`ui/\`: single pictures, each at the size to draw it. Stickers are ${STICKER_DETAIL}× the size the
  game draws them on the field, so they stay sharp on tablets and laptops; \`_sheets/stickers.png\` shows them at their
  size on the field, labelled with the size to draw them.

A battle world is one flat picture: run \`npm run art:import -- <picture.png> --as <id>\`. Paint a menu scene as one
picture with a layer per piece, export the layers plus a composited \`preview.png\` into a folder, and run
\`npm run art:import -- <folder> --as <id>\`. Characters are frames (see ASSET_CHECKLIST.md). Stickers, faces and
logos go straight into their folder under \`/art\`. No white border, shadow or glow: the game adds them.

Sounds (${SOUNDS.length}) are listed in ASSET_CHECKLIST.md.
`,
);

console.log(`art kit: ${files} placeholder files, ${SCENES.length + 1} contact sheets → ${OUT}`);
