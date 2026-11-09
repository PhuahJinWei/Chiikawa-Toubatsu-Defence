// Brings one single picture into the game (a button, an icon, a logo, a face, a sticker) under its name in the spec.
//
//   npm run art:picture -- <file> --as <key> [--dry]
//
// e.g. npm run art:picture -- image/buttons/back-button-modoru.png --as ui/back
//
// The picture is scaled down to its size in the spec (never up, the shape kept) and written to art/<key>.png, so
// phones decode small files. Battle stickers keep twice their planned size (STICKER_DETAIL): tablets and laptops show
// them bigger than phones do. Scenes and characters come in as layers instead (npm run art:import), and the quest
// board's pictures as a folder (npm run art:quests).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ALL_IMAGES, imageSpec, pictureSize, STICKER_DETAIL } from '../src/art/spec';
import { readable } from './lib/layers';

/** How much of its square a face fills (see below). */
const PORTRAIT_FILL = 0.86;

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const at = args.indexOf('--as');
const key = at >= 0 ? args[at + 1] : undefined;
const file = args.find((a, i) => !a.startsWith('--') && i !== at + 1);

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (!file || !key) fail('Usage: npm run art:picture -- <file> --as <key>   (e.g. --as ui/back)');
const path = resolve(file);
if (!existsSync(path)) fail(`No file at ${path}`);
const spec = imageSpec(key);
if (!spec) {
  const singles = ALL_IMAGES.filter((i) => i.kind !== 'piece').map((i) => i.key);
  fail(`"${key}" is not a picture in the spec. Single pictures:\n  ${singles.join('\n  ')}`);
}
if (spec.kind === 'piece') fail(`"${key}" is part of a scene: bring those in with npm run art:import.`);

const img = await loadImage(readable(readFileSync(path)));
// The most the game keeps: the planned size, or twice it for a sticker.
const most = pictureSize(spec);
const k = Math.min(1, most.w / img.width, most.h / img.height);
const w = Math.round(img.width * k);
const h = Math.round(img.height * k);
// A face keeps a clear margin round it: drawn at PORTRAIT_FILL of its square, centred, so it sits in the faces' spots
// (cards, notices, the gallery book) at the size those were laid out for, with room for its sticker edge. Owners'
// icons are drawn edge to edge; this keeps every face the same size however tight the picture was cropped.
const face = key.startsWith('portraits/');
const k2 = face ? PORTRAIT_FILL : 1;
const c = createCanvas(face ? spec.w : w, face ? spec.h : h);
const ctx = c.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
if (face) {
  const fw = w * k2;
  const fh = h * k2;
  ctx.drawImage(img, (spec.w - fw) / 2, (spec.h - fh) / 2, fw, fh);
} else ctx.drawImage(img, 0, 0, w, h);
const out = join(process.cwd(), 'art', `${key}.png`);
if (!dry) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, c.toBuffer('image/png'));
}
const shape = Math.abs(img.width / img.height - spec.w / spec.h) > 0.08 ? `  (planned ${spec.w} × ${spec.h}: a different shape, kept as drawn)` : '';
console.log(`\n  ${key}  ←  ${file}  (${img.width} × ${img.height} → ${w} × ${h})${shape}`);
if (spec.kind === 'sticker' && Math.max(w / most.w, h / most.h) < 0.995) {
  console.log(`  ⚠ Smaller than ${most.w} × ${most.h} (${STICKER_DETAIL}× its size on the field): it will look soft on tablets and laptops.`);
}
console.log(dry ? '\n(dry run: nothing written)\n' : `\n✓ Wrote ${out}\n`);
