// Brings a painted scene into the game: a battle world from its one flat picture, a menu scene from a folder of
// exported layers.
//
//   npm run art:import -- <picture.png> --as <world id> [--dry]
//   npm run art:import -- <folder> [--as <scene id>] [--dry]
//
// A menu scene's folder holds one PNG per layer, numbered back to front (00-…, 01-…), plus a composited preview of the
// whole picture (a file whose name starts with "preview"). Layers may be exported at the full canvas size or
// cropped to their contents; cropped layers are found by matching them against the preview. Each layer is
// matched to a piece of the spec by its name, or by its place in the stack when the counts agree (a map.json
// in the folder can name them explicitly: { "03-knight.png": "shop_pochette" }). The tool writes the pieces to
// art/scenes/<id>/ under the game's names, with a layout.json of their sizes, positions and
// the sides where they run off the picture. Pictures painted at twice the scene's size are measured back to
// stage pixels and keep their sharpness.
//
// A scene piece can be an idle loop: export its frames as name_1.png, name_2.png … on one canvas size. They become
// <id>.png, <id>_2.png … in one shared box and the game plays them in turn. A still layer with the same leading
// number (02-character.png beside 02-character-idle_1.png …) is the picture they replace: frame 1 takes its place,
// standing on the same bottom edge. Without one, frame 1 is matched against the preview.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { LayoutPiece, SceneLayout } from '../src/art/layout';
import { SCENES, sceneSpec } from '../src/art/spec';
import { alphaBox, type Box, crop, cutSides, frameGroups, isOpaque, layerOrder, leadingNumber, locate, mapLayers, readable, type RGBA, unionBox } from './lib/layers';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const dry = args.includes('--dry');
if (dry) args.splice(args.indexOf('--dry'), 1);
const as = flag('--as');
const folder = args[0];

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (!folder) fail('Usage: npm run art:import -- <world picture or scene folder> [--as <scene id>] [--dry]');
const given = resolve(folder);
if (!existsSync(given)) fail(`Nothing at ${given}`);
// A file is a battle world's one picture; a folder holds a scene's layers.
const single = statSync(given).isFile();
const dir = single ? dirname(given) : given;

async function read(path: string): Promise<RGBA> {
  const img = await loadImage(readable(readFileSync(path)));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height);
  return { w: img.width, h: img.height, data: new Uint8ClampedArray(d.data) };
}

function writePng(path: string, img: RGBA): void {
  const c = createCanvas(img.w, img.h);
  const ctx = c.getContext('2d');
  const id = ctx.createImageData(img.w, img.h);
  id.data.set(img.data);
  ctx.putImageData(id, 0, 0);
  writeFileSync(path, c.toBuffer('image/png'));
}

const id = as ?? basename(dir);
const scene = sceneSpec(id);
if (!scene) fail(`"${id}" is not a scene. Use --as with one of:\n  ${SCENES.map((s) => s.id).join(', ')}`);

if (single && scene.kind !== 'world') fail(`"${id}" is a menu scene: it comes as a folder of layers, not one picture.`);

const files = single ? [basename(given)] : readdirSync(dir).filter((f) => /\.(png|webp|jpe?g)$/i.test(f));
const previewFile = single ? undefined : files.find((f) => /^(preview|composite)/i.test(f));
const pictures = files.filter((f) => f !== previewFile);
// The frames of an idle loop (name_1.png, name_2.png …) are one piece. A still with the same leading number
// (02-character.png beside 02-character-idle_1…4.png) is the picture the loop replaces.
const loops = frameGroups(pictures);
const inLoop = new Set(loops.flatMap((g) => g.files));
const stillOf = (stem: string) => pictures.find((f) => !inLoop.has(f) && leadingNumber(stem) !== undefined && leadingNumber(f) === leadingNumber(stem));
const replaced = loops.map((g) => stillOf(g.stem)).filter((f): f is string => !!f);
const entries: { name: string; label: string; files: string[]; still?: string }[] = [
  ...pictures.filter((f) => !inLoop.has(f) && !replaced.includes(f)).map((f) => ({ name: f, label: f, files: [f] })),
  ...loops.map((g) => {
    const ext = g.files[0].slice(g.files[0].lastIndexOf('.'));
    return { name: `${g.stem}${ext}`, label: `${g.stem}_1…${g.files.length}${ext}`, files: g.files, still: stillOf(g.stem) };
  }),
].sort((a, b) => layerOrder(a.name, b.name));
const layerFiles = entries.map((e) => e.name);
if (!layerFiles.length) fail('No layer pictures in the folder.');
if (scene.kind === 'world' && layerFiles.length !== 1) fail(`A battle world is one flat picture, but the folder holds ${layerFiles.length}. Name the picture itself, or stack them into one first.`);
const explicit = existsSync(join(dir, 'map.json')) ? (JSON.parse(readFileSync(join(dir, 'map.json'), 'utf-8')) as Record<string, string>) : {};
// map.json may name a loop by its stem or by any of its frames.
for (const e of entries) {
  const named = [e.name, e.name.replace(/\.\w+$/, ''), ...e.files].map((f) => explicit[f]).find(Boolean);
  if (named) explicit[e.name] = named;
}

const frameSets = await Promise.all(entries.map((e) => Promise.all(e.files.map((f) => read(join(dir, f))))));
frameSets.forEach((set, i) => {
  if (set.some((f) => f.w !== set[0].w || f.h !== set[0].h)) fail(`The frames ${entries[i].label} are not all the same size. Export every frame on the same canvas.`);
});
const layers = frameSets.map((set) => set[0]);
const stills = await Promise.all(entries.map((e) => (e.still ? read(join(dir, e.still)) : undefined)));
let canvas: RGBA;
if (previewFile) canvas = await read(join(dir, previewFile));
else {
  const { w, h } = layers[0];
  if (!layers.every((l) => l.w === w && l.h === h)) fail('Layers are cropped to different sizes, so the tool needs a composited preview of the whole picture (a file named preview….png).');
  canvas = { w, h, data: new Uint8ClampedArray(w * h * 4) };
}
const atCanvasSize = (img: RGBA) => img.w === canvas.w && img.h === canvas.h;

// Where every layer goes: full-canvas layers by their visible box, cropped ones by matching the preview. A loop
// of cropped frames that replaces a still is measured by the still, which the preview shows exactly (redrawn
// frames match it only roughly).
console.log(`\nMeasuring ${layerFiles.length} layer${layerFiles.length === 1 ? '' : 's'} against ${previewFile ?? 'the canvas'} (${canvas.w} × ${canvas.h})…`);
const t0 = Date.now();
const probes = layers.map((img, i) => (stills[i] && !atCanvasSize(img) ? stills[i]! : img));
const places = previewFile ? locate(canvas, probes) : layers.map(() => ({ x: 0, y: 0, match: 1 }));
const placed = layers.map((img, i) => {
  const set = frameSets[i];
  if (set.length > 1) {
    // Every frame cut to one box, around what any of them shows, so the frames stay lined up.
    const whole = { x: 0, y: 0, w: img.w, h: img.h };
    const b = unionBox(set.map((f) => alphaBox(f)).filter((x): x is Box => !!x)) ?? whole;
    const frames = set.map((f) => crop(f, b));
    let x = places[i].x;
    let y = places[i].y;
    if (probes[i] !== img) {
      // Frame 1 stands where the still stood: the same bottom edge (hands on the counter, feet on the floor) and
      // the same middle. The pose may change above it.
      const s = alphaBox(probes[i]) ?? { x: 0, y: 0, w: probes[i].w, h: probes[i].h };
      const f1 = alphaBox(img) ?? whole;
      x = Math.round(places[i].x + s.x + s.w / 2 - (f1.x + f1.w / 2));
      y = places[i].y + s.y + s.h - (f1.y + f1.h);
    }
    return { img: frames[0], frames, x: x + b.x, y: y + b.y, match: places[i].match };
  }
  if (img.w === canvas.w && img.h === canvas.h) {
    const b = alphaBox(img) ?? { x: 0, y: 0, w: img.w, h: img.h };
    const c = crop(img, b);
    return { img: c, frames: [c], x: b.x, y: b.y, match: places[i].match };
  }
  return { img, frames: [img], x: places[i].x, y: places[i].y, match: places[i].match };
});
console.log(`  done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// Which piece each layer is.
const mapped = mapLayers(
  layerFiles,
  scene.layers.map((l) => l.id),
  explicit,
);
const dup = mapped.map((m) => m.id).filter((x, i, a) => a.indexOf(x) !== i);
if (dup.length) fail(`Two layers would both be "${dup[0]}". Rename one, or add a map.json.`);

const out = join(process.cwd(), 'art', 'scenes', id);
const rows: string[][] = [];
const warn: string[] = [];
const notes = entries.filter((e) => e.still).map((e) => `${e.still} is left out: the loop ${e.label} replaces it${atCanvasSize(layers[entries.indexOf(e)]) ? '' : ' and stands where it stood'}.`);

// A picture painted at about twice the scene's size is measured back to stage pixels.
const k = Math.abs(canvas.w / scene.w - 2) < 0.04 ? 0.5 : 1;
const W = Math.round(canvas.w * k);
const H = Math.round(canvas.h * k);
if (Math.abs(W / H - scene.w / scene.h) > 0.01) warn.push(`The picture is ${canvas.w} × ${canvas.h}; the scene was planned at ${scene.w} × ${scene.h}. ${scene.kind === 'world' ? 'The field keeps its distance from the right edge, and the game stretches the left edge to fill any shortfall' : 'Slots and the safe area are scaled to fit'}, but check them with the art guides.`);
if (scene.kind === 'world' && !isOpaque(layers[0])) warn.push('The picture has see-through parts: a battle world should be painted edge to edge, so check that this is the finished picture and not one layer.');
const pieces: LayoutPiece[] = placed.map((p, i) => {
  const m = mapped[i];
  const known = scene.layers.find((l) => l.id === m.id);
  // A loop runs off a side if any of its frames does.
  const sides = new Set(p.frames.flatMap((f) => cutSides(f, p.x, p.y, canvas.w, canvas.h)));
  const cut = (['l', 'r', 't', 'b'] as const).filter((s) => sides.has(s));
  const piece: LayoutPiece = { id: m.id, x: round(p.x * k), y: round(p.y * k), w: round(p.img.w * k), h: round(p.img.h * k) };
  if (cut.length) piece.cut = cut;
  if (!known) piece.edge = !(i === 0 && isOpaque(p.img));
  const n = p.frames.length;
  if (n > 1) {
    piece.frames = n;
    if ((known?.frames ?? 1) !== n) warn.push(`"${m.id}" arrived as a loop of ${n} frames; its spec plans ${known?.frames ?? 1}. The game plays the ${n} delivered; set frames: ${n} in the spec so the checklist lists them.`);
  } else if ((known?.frames ?? 1) > 1) warn.push(`"${m.id}" is planned as a loop of ${known!.frames} frames but arrived as one picture; it stays still.`);
  rows.push([entries[i].label, n > 1 ? `${m.id} (${n} frames)` : m.id, m.how, `${piece.w}×${piece.h}`, `${piece.x}, ${piece.y}`, cut.join('') || '—', `${Math.round(p.match * 100)}%`]);
  if (p.match < 0.6 && previewFile) warn.push(`${layerFiles[i]} matched the preview poorly (${Math.round(p.match * 100)}%); check where it landed.`);
  return piece;
});
for (const l of scene.layers) if (!mapped.some((m) => m.id === l.id)) warn.push(`No layer for "${l.id}"; it keeps its placeholder.`);
const layout: SceneLayout = { kind: 'scene', w: W, h: H, pieces };
if (!dry) {
  mkdirSync(out, { recursive: true });
  // A loop's first frame is the piece's own file; the rest are <id>_2.png, <id>_3.png …
  const written = new Set<string>();
  placed.forEach((p, i) =>
    p.frames.forEach((f, j) => {
      const name = `${mapped[i].id}${j ? `_${j + 1}` : ''}.png`;
      writePng(join(out, name), f);
      written.add(name);
    }),
  );
  // Frames left from an earlier, longer loop of a piece written now.
  for (const f of readdirSync(out)) {
    const stale = /^(.+)_\d+\.png$/.exec(f);
    if (stale && !written.has(f) && pieces.some((p) => p.id === stale[1])) {
      rmSync(join(out, f));
      notes.push(`Removed ${f}, a frame left from an earlier loop.`);
    }
  }
  writeFileSync(join(out, 'layout.json'), pretty(layout));
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/** JSON with short lists on one line. */
function pretty(v: unknown): string {
  return JSON.stringify(v, null, 2).replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, inner: string) => `[${inner.split(/,\s*/).join(', ')}]`) + '\n';
}

const head = ['layer', 'piece', 'matched by', 'size', 'position', 'runs off', 'fit'];
const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
const line = (r: string[]) => r.map((c, i) => c.padEnd(widths[i])).join('  ');
console.log(`\n${line(head)}\n${widths.map((w) => '-'.repeat(w)).join('  ')}\n${rows.map(line).join('\n')}`);
for (const n of notes) console.log(`\n· ${n}`);
for (const w of warn) console.log(`\n! ${w}`);
const pictureCount = placed.reduce((n, p) => n + p.frames.length, 0);
console.log(dry ? '\n(dry run: nothing written)\n' : `\n✓ Wrote ${placed.length} piece${placed.length === 1 ? '' : 's'}${pictureCount > placed.length ? ` (${pictureCount} pictures with the loop frames)` : ''} and layout.json to ${out}\n`);
