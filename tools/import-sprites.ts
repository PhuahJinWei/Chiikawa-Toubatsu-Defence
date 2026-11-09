// Brings battle characters in as frame animations (the owner's sprites).
//
//   npm run art:sprites -- <folder> [--only <name,…>] [--dry]
//
// <folder> holds one folder per character (like image/sprite), or is one character's folder. Frames are PNGs named
// <name>_<motion>_<n>.png ("enemy_" in front is fine), the motions being idle, walk, attack, death, ability,
// transform, spawn (coming up when called), cook (たい焼き's stages), weed_search and weed_found (ちいかわ) and a wall's
// damaged1–3; ちいかぶ's true form is chiikabu_true_<motion>_<n>.png, and its transform (chiikabu_transform_<n>) belongs
// to the true form. A motion's frames share one canvas size, but motions may differ: a bigger canvas grows evenly on
// both sides, or only toward the front, and the character keeps the same margin under its feet. Every motion is cut
// down to the box its frames share and written to art/sprites/<character id>/<motion>_<n>.png, with a sprite.json
// saying where the feet are and how tall the character stands (the game scales that to its size on the field).
//
// A character stands by on one picture, the first of its idle frames, which the game makes breathe: any others are
// left out and listed.
//
// Friends have no defeat frames (they just fade away): only enemies need death. パジャマパーティーズ come one member at a
// time (pajamas_party_<colour>_…, each a character of its own: ally_pajama_parties_<colour>).
//
// A character missing a motion its part needs (any of idle, walk, attack, death, by what it does) is skipped and
// listed; give it the missing frames and run this again. Frames for a move a character does not make (any more:
// 六足の虫 no longer attacks) are left out and listed. --only takes folder names (e.g. --only goblin,zou).
//
// キメラ comes in two sets (the owner's layout): her first look, claws hidden, in kimera/claws_retracted/, and with
// her claws out (the game's enemy_kimera_claws, its ability her drawing them) beside that folder, both named like the
// rest (enemy_kimera_<motion>_<n>.png).
//
// A person in the gallery's people pages (the three 鎧さん) only stands there: their idle picture (e.g.
// yoroi_ramen_idle_1.png) becomes art/sprites/people_<id>/, drawn standing on the book's right page. Rakko's car and
// boat are one picture each, the same way (rakko_car_idle_1.png, rakko_boat_idle_1.png).

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { SpriteAnimLayout, SpriteLayout } from '../src/art/sprite';
import { PAJAMA_MEMBERS, characterSpec, SPRITE_MOTIONS, spriteIdFor, type SpriteMotionName, spriteNeeds, teamSpec } from '../src/art/spec';
import { alphaBox, type Box, crop, type RGBA, unionBox } from './lib/layers';

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
const only = flag('--only')?.split(',').map((s) => s.trim().toLowerCase());
const folder = args[0];

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (!folder) fail('Usage: npm run art:sprites -- <folder> [--only <name,…>] [--dry]');
const root = resolve(folder);
if (!existsSync(root)) fail(`No folder at ${root}`);

/** Folder or file names that are not the game's own: what they are in the game. */
const NAMES: Record<string, string> = {
  seiren: 'enemy_seiren',
  siren: 'enemy_seiren',
  black_star: 'enemy_kuroi_nagareboshi',
  dekaitori: 'enemy_dekai_tori',
  star: 'ally_hoshi',
  yoroi_rodou: 'people_yoroi_rodo',
  ...Object.fromEntries(PAJAMA_MEMBERS.map((m) => [`pajamas_party_${m}`, `ally_pajama_parties_${m}`])),
};
/** The people in the gallery's people pages: they come in as standing pictures. */
const PEOPLE = new Set(
  (JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'gallery.json'), 'utf8')) as { entries: { id: string; tab: string }[] }).entries
    .filter((e) => e.tab === 'people')
    .map((e) => e.id),
);
const MOTIONS = Object.keys(SPRITE_MOTIONS) as SpriteMotionName[];
type Motion = SpriteMotionName;
const FILE = new RegExp(`^(?:enemy_|ally_|people_|rescue_)?(.+?)_(true_)?(${MOTIONS.join('|')})(?:_(\\d+))?\\.png$`, 'i');
/** Where the feet are across a motion's canvas, for a friend whose body is not in the middle of its picture (a long
 *  さすまた or a tail takes up one side): from the art's own notes (its pivots), or measured where it has none. A motion
 *  not listed goes by the idle's. */
const FEET_X: Record<string, Partial<Record<Motion, number>>> = {
  ally_hachiware: { idle: 105, attack: 113 },
  ally_hachiware_pajama: { idle: 136, attack: 136 },
  ally_chiikawa_island: { idle: 144, attack: 144 },
  ally_usagi: { idle: 146, attack: 154 },
  ally_usagi_cool: { idle: 131 },
  ally_momonga: { idle: 176, attack: 176 },
  ally_rakko: { idle: 154, attack: 166 },
  ally_shimajiro: { idle: 124 },
  ally_yoroi_erai: { idle: 127 },
};
/** Where the ground is in a motion's canvas, for frames that do not stand on the idle's margin: パジャマパーティーズ' dance
 *  frames stand well above the bottom of their taller canvas. */
const FEET_Y: Record<string, Partial<Record<Motion, number>>> = Object.fromEntries(PAJAMA_MEMBERS.map((m) => [`ally_pajama_parties_${m}`, { ability: 292 }]));
/** Pixels at least this opaque decide where the feet are. */
const SOLID = 128;
/** Empty room kept round the frames when they are cut down (source pixels). */
const PAD = 2;

function idOf(name: string, trueForm: boolean, motion: Motion): string | undefined {
  // ちいかぶ: the small form walks and waits; everything else (and the transform that leads to it) is the true form.
  if (name === 'chiikabu') return trueForm || motion === 'transform' ? 'enemy_chiikabu_true' : 'enemy_chiikabu';
  if (trueForm) return undefined;
  if (NAMES[name]) return NAMES[name];
  for (const g of ['enemy', 'ally', 'rescue']) if (characterSpec(`${g}_${name}`)) return `${g}_${name}`;
  if (PEOPLE.has(name)) return spriteIdFor('people', name);
  return undefined;
}

/** The motions a character needs, by what it does in the game (星 only waits and turns). */
const needs = (id: string): Motion[] => spriteNeeds(characterSpec(id) ?? teamSpec(id), id).need;

/** Which way a character faces: its art's front edge is on that side. */
const facesLeft = (id: string) => id.startsWith('enemy_');

async function read(path: string): Promise<RGBA> {
  const img = await loadImage(readFileSync(path));
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

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

interface Frame {
  file: string;
  n: number;
  img: RGBA;
  box: Box;
}

// ---------------------------------------------------------------- gather

/** A character whose folder holds a second set of its frames in a folder of its own, named like the rest (the
 *  owner's layout, 2026-11-07): キメラ's first look, claws hidden (the game's enemy_kimera), is in
 *  kimera/claws_retracted/; the frames beside that folder have her claws out (enemy_kimera_claws), their ability her
 *  drawing them. */
const SECOND_SETS: Record<string, { folder: string; inside: string; beside: string }> = {
  kimera: { folder: 'claws_retracted', inside: 'enemy_kimera', beside: 'enemy_kimera_claws' },
};

const isDir = (p: string) => statSync(p).isDirectory();
// One character's folder holds frames; a folder of characters holds their folders.
const dirs = readdirSync(root).some((f) => /\.png$/i.test(f)) ? ['.'] : readdirSync(root).filter((f) => isDir(join(root, f)));
/** Every folder of frames to read: each character's, and its second set's (see SECOND_SETS). */
const sources: { dir: string; label: string; name: string; inside?: boolean }[] = [];
for (const d of dirs) {
  const dir = d === '.' ? root : join(root, d);
  const label = d === '.' ? basename(root) : d;
  const name = label.toLowerCase();
  if (only && !only.includes(name)) continue;
  sources.push({ dir, label, name });
  const second = SECOND_SETS[name];
  const sub = second && join(dir, second.folder);
  if (sub && existsSync(sub) && isDir(sub)) sources.push({ dir: sub, label: `${label}/${second.folder}`, name, inside: true });
}
/** Character id → motion → frames. */
const found = new Map<string, Map<Motion, Frame[]>>();
const from = new Map<string, string>();
const notes: string[] = [];

for (const { dir, label, name, inside } of sources) {
  const files = readdirSync(dir).filter((f) => /\.png$/i.test(f));
  if (!files.length) continue;
  const numbered = new Set<string>();
  const parsed: { file: string; id: string; motion: Motion; n: number | null }[] = [];
  for (const file of files) {
    const m = FILE.exec(file);
    if (!m) {
      notes.push(`${label}/${file}: not a frame name, left out`);
      continue;
    }
    const motion = m[3].toLowerCase() as Motion;
    let id = idOf(m[1].toLowerCase(), !!m[2], motion);
    // A second set's frames are named like the rest: the folder says which set they are.
    const second = SECOND_SETS[name];
    if (second && id === second.inside && !inside) id = second.beside;
    if (!id) {
      notes.push(`${label}/${file}: "${m[1]}" is no character in the game, left out`);
      continue;
    }
    const n = m[4] ? Number(m[4]) : null;
    if (n !== null) numbered.add(`${id}|${motion}`);
    parsed.push({ file, id, motion, n });
  }
  for (const p of parsed) {
    // A single picture with no number beside numbered frames of the same motion is a spare: left out.
    if (p.n === null && numbered.has(`${p.id}|${p.motion}`)) {
      notes.push(`${label}/${p.file}: an unnumbered extra beside its numbered frames, left out`);
      continue;
    }
    const img = await read(join(dir, p.file));
    const box = alphaBox(img);
    if (!box) {
      notes.push(`${label}/${p.file}: empty, left out`);
      continue;
    }
    const byMotion = found.get(p.id) ?? new Map<Motion, Frame[]>();
    found.set(p.id, byMotion);
    const list = byMotion.get(p.motion) ?? [];
    byMotion.set(p.motion, list);
    list.push({ file: `${label}/${p.file}`, n: p.n ?? 1, img, box });
    from.set(p.id, join(folder, relative(root, dir)).replaceAll('\\', '/'));
  }
}

if (!found.size) fail(`No frames found in ${root}`);

// ---------------------------------------------------------------- lay out each character

/** The lowest row of solid pixels, plus one: where the feet stand. */
function feetLine(img: RGBA): number {
  for (let y = img.h - 1; y >= 0; y--) {
    for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3] >= SOLID) return y + 1;
  }
  return img.h;
}

const written: string[] = [];
const skipped: string[] = [];
/** Files written per character this run: anything else in its folder is an old frame, removed at the end (only then,
 *  so a running dev server never finds the folder half empty). */
const files = new Map<string, Set<string>>();
const out = (id: string, file: string) => {
  const dir = join(process.cwd(), 'art', 'sprites', id);
  mkdirSync(dir, { recursive: true });
  const set = files.get(id) ?? new Set<string>();
  files.set(id, set);
  set.add(file);
  return join(dir, file);
};

for (const [id, byMotion] of [...found].sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const list of byMotion.values()) list.sort((a, b) => a.n - b.n);
  const missing = needs(id).filter((m) => !byMotion.get(m)?.length);
  if (missing.length) {
    skipped.push(`${id}: no ${missing.join(', ')} frames yet (has ${[...byMotion.keys()].join(', ')})`);
    continue;
  }
  const idle = byMotion.get('idle')!;
  const spare = idle.splice(1);
  if (spare.length) notes.push(`${id} idle: stands by on its first picture (the game makes it breathe), ${spare.length} more left out`);
  const W0 = idle[0].img.w;
  // The margin under the feet, the same in every motion: measured on the idle picture.
  const margin = median(idle.map((f) => f.img.h - feetLine(f.img)));
  const left = facesLeft(id);
  const anims: Record<string, SpriteAnimLayout> = {};
  const lines: string[] = [];
  const { need, extra } = spriteNeeds(characterSpec(id) ?? teamSpec(id), id);
  const uses = new Set<Motion>([...need, ...extra]);
  for (const motion of MOTIONS) {
    const list = byMotion.get(motion);
    if (!list?.length) continue;
    if (!uses.has(motion)) {
      notes.push(`${id} ${motion}: ${list.length} frames of a move it does not make, left out`);
      continue;
    }
    const { w: Wa, h: Ha } = list[0].img;
    const odd = list.find((f) => f.img.w !== Wa || f.img.h !== Ha);
    if (odd) {
      notes.push(`${id} ${motion}: ${odd.file} is ${odd.img.w} × ${odd.img.h}, the others ${Wa} × ${Ha}; frames of one motion must share a canvas`);
      continue;
    }
    // Where the idle canvas sits across this one: centred, or (a wider canvas grown toward the front only) against
    // the back edge. Decided by which keeps the back of the first frame where the idle's back is.
    let dx = 0;
    if (Wa !== W0) {
      const choices = [0, (Wa - W0) / 2, Wa - W0];
      const back = (b: Box) => (left ? b.x + b.w : b.x);
      dx = choices.reduce((best, c) => (Math.abs(back(list[0].box) - c - back(idle[0].box)) < Math.abs(back(list[0].box) - best - back(idle[0].box)) ? c : best));
    }
    const feet = FEET_X[id];
    const ax0 = feet?.[motion] ?? dx + (feet?.idle ?? W0 / 2);
    const ay0 = FEET_Y[id]?.[motion] ?? Ha - margin;
    const u = unionBox(list.map((f) => f.box))!;
    const x0 = Math.max(0, u.x - PAD);
    const y0 = Math.max(0, u.y - PAD);
    const cut: Box = { x: x0, y: y0, w: Math.min(Wa, u.x + u.w + PAD) - x0, h: Math.min(Ha, u.y + u.h + PAD) - y0 };
    anims[motion] = {
      frames: list.length,
      w: cut.w,
      h: cut.h,
      ax: Math.round((ax0 - cut.x) * 10) / 10,
      ay: ay0 - cut.y,
      boxes: list.map((f) => [f.box.x - cut.x, f.box.y - cut.y, f.box.w, f.box.h]),
    };
    if (!dry) {
      if (!written.includes(id)) written.push(id);
      list.forEach((f, i) => writePng(out(id, `${motion}_${i + 1}.png`), crop(f.img, cut)));
    }
    lines.push(`${motion} ×${list.length} (${Wa} × ${Ha} → ${cut.w} × ${cut.h})${dx !== (Wa - W0) / 2 && Wa !== W0 ? ': a wider canvas, grown toward the front only' : ''}`);
  }
  const a = anims.idle;
  // How tall it stands: from the feet to the top of the idle picture.
  const height = median(a.boxes.map((b) => a.ay - b[1]));
  const layout: SpriteLayout = { kind: 'sprite', id, height, anims, from: from.get(id) };
  // One line per frame box keeps the file readable.
  const json = JSON.stringify(layout, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+),\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2, $3, $4]');
  if (!dry) writeFileSync(out(id, 'sprite.json'), `${json}\n`);
  console.log(`\n  ${id}  ←  ${from.get(id)}  (stands ${height} px tall)`);
  for (const l of lines) console.log(`    ${l}`);
}

for (const [id, keep] of files) {
  const dir = join(process.cwd(), 'art', 'sprites', id);
  for (const f of readdirSync(dir)) if (!keep.has(f)) rmSync(join(dir, f), { force: true });
}
if (skipped.length) console.log(`\nSkipped (incomplete):\n  ${skipped.join('\n  ')}`);
if (notes.length) console.log(`\nNotes:\n  ${notes.join('\n  ')}`);
console.log(dry ? '\n(dry run: nothing written)\n' : `\n✓ Wrote ${written.length} character${written.length === 1 ? '' : 's'} to art/sprites/\n`);
