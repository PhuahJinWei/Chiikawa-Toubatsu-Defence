// Brings the quest board's pictures into the game from a folder of exported pictures.
//
//   npm run art:quests -- <folder> [--dry]
//
// The folder holds the blank quest paper (a file with "paper" in its name), the 「準備中」 stamp (a file with
// "stamp" in its name), one picture per world, numbered 01-… to 06-… in world order, and the last paper's picture
// (the 討伐ランキング: numbered 07-…, or with "ranking", "endless" or "rakko" in its name). Anything else (the board
// background, a preview) is left alone: the board is a scene piece, art/scenes/quests/board.png. Each picture is
// scaled down to its size in the spec (never up, the shape kept) and written to art/quests/ as paper.png,
// stamp_soon.png, world1.png … world6.png and ranking.png, so phones decode small files.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { QUEST_IMAGES } from '../src/art/spec';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const folder = args.find((a) => !a.startsWith('--'));

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (!folder) fail('Usage: npm run art:quests -- <folder> [--dry]');
const dir = resolve(folder);
if (!existsSync(dir)) fail(`No folder at ${dir}`);

const files = readdirSync(dir).filter((f) => /\.(png|webp|jpe?g)$/i.test(f) && !/^(preview|composite)/i.test(f));
const want = new Map<string, string>();
const paper = files.find((f) => /paper/i.test(f));
if (paper) want.set('quests/paper', paper);
const stamp = files.find((f) => /stamp/i.test(f));
if (stamp) want.set('quests/stamp_soon', stamp);
for (const f of files) {
  if (f === paper || f === stamp || /background|board/i.test(f)) continue;
  const n = Number(/^(\d+)/.exec(f)?.[1]);
  if (n === 7 || /ranking|endless|rakko/i.test(f)) want.set('quests/ranking', f);
  else if (n >= 1 && n <= 6) want.set(`quests/world${n}`, f);
}
if (!want.size) fail('No quest pictures in the folder (a "…paper…" or "…stamp…" file, pictures numbered 01- to 07-, or a "…ranking…" one).');

const out = join(process.cwd(), 'art', 'quests');
if (!dry) mkdirSync(out, { recursive: true });
console.log('');
for (const spec of QUEST_IMAGES) {
  const file = want.get(spec.key);
  if (!file) {
    console.log(`  ${spec.key.padEnd(18)} —  (none in the folder; keeps its current picture)`);
    continue;
  }
  const img = await loadImage(readFileSync(join(dir, file)));
  const k = Math.min(1, spec.w / img.width, spec.h / img.height);
  const w = Math.round(img.width * k);
  const h = Math.round(img.height * k);
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  if (!dry) writeFileSync(join(out, `${spec.key.split('/')[1]}.png`), c.toBuffer('image/png'));
  console.log(`  ${spec.key.padEnd(18)} ←  ${file}  (${img.width} × ${img.height} → ${w} × ${h})`);
}
console.log(dry ? '\n(dry run: nothing written)\n' : `\n✓ Wrote the quest pictures to ${out}\n`);
