// Regenerates ASSET_CHECKLIST.md from src/art/spec (the same spec the game, the placeholders and the art kit
// use), so the checklist can never drift from the code. Delivered files are ticked.
//   npm run checklist

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SceneLayout } from '../src/art/layout';
import type { SpriteLayout } from '../src/art/sprite';
import {
  ALLY_CHARACTERS,
  PAJAMA_MEMBERS,
  BASELINE,
  ENEMY_CHARACTERS,
  FRAME_MS,
  GALLERY_IMAGES,
  LOGOS,
  VEHICLES,
  pieceFiles,
  PORTRAITS,
  QUEST_IMAGES,
  CHARACTERS,
  SCENES,
  SHOP_ITEMS,
  SOUNDS,
  SPRITE_MOTIONS,
  spriteNeeds,
  STICKER_DETAIL,
  STICKERS,
  TIER_HEIGHT,
  UI_BUTTONS,
  UI_ICONS,
  UI_PROPS,
} from '../src/art/spec';

const lines: string[] = [];
const push = (...l: string[]) => lines.push(...l);
const root = process.cwd();
const has = (key: string) => ['png', 'webp', 'jpg', 'jpeg'].some((ext) => existsSync(join(root, 'art', `${key}.${ext}`)));
const tick = (key: string) => (has(key) ? '[x]' : '[ ]');
const layout = <T,>(path: string): T | undefined => (existsSync(join(root, path)) ? (JSON.parse(readFileSync(join(root, path), 'utf-8')) as T) : undefined);
const SIDE = { l: 'left', r: 'right', t: 'top', b: 'bottom' } as const;

const pieceCount = SCENES.reduce((n, s) => n + s.layers.length, 0);
/** Extra pictures for pieces drawn as idle loops (frames after the first). */
const loopFrames = SCENES.reduce((n, s) => n + s.layers.reduce((m, l) => m + pieceFiles(l).length - 1, 0), 0);

push(
  '# Asset Checklist — ちいかわ討伐ディフェンス',
  '',
  '> Generated from `src/art/spec` by `npm run checklist`. Do not edit by hand; change the spec instead.',
  '',
  'Every picture and sound the game uses. The whole game is stacked paper cut-outs: flat pictures that the game layers,',
  'borders, shades and moves. Until a file exists the game draws a placeholder in its place. In the game, **設定 → アートキット**',
  'shows the same list with live previews (characters move) and a ZIP of every placeholder; `npm run art:kit` writes them',
  'to `art-kit/` with contact sheets.',
  '',
  '## Rules for every picture',
  '',
  '| Rule | Value |',
  '|---|---|',
  '| Format | PNG with transparency (WebP and JPEG also load). The build turns everything into WebP for players |',
  '| Style | Flat, straight on, with outlines. No white border, no shadow, no soft glow: the game adds the sticker border and the shadows. Any paper texture is part of your art; the game lays nothing over it |',
  '| Battle side view | Characters on the battlefield face sideways: friends and Rakko’s car face right (toward the enemies), enemies face left |',
  '| Menus | Characters in menu scenes face the viewer |',
  '',
  '## How to deliver',
  '',
  '1. **Battle worlds** are one flat picture, painted edge to edge: run `npm run art:import -- <picture.png> --as <world id>`.',
  '   **Menu scenes**: paint the whole picture in one document, each piece on its own layer.',
  '   Export every layer as a PNG named with its stacking order and its piece name from the tables below',
  '   (`00-wall.png`, `01-…`), plus one composited picture named `preview.png`, into one folder. Layers may be exported',
  '   at the full canvas size or cropped; cropped layers are found by matching them against the preview.',
  '2. Run `npm run art:import -- <folder> --as <scene id>`. It matches each layer to its piece (by name,',
  '   else by order when the counts agree; a `map.json` can name them), measures where it sits and which sides run off',
  '   the picture, and writes the pieces and a `layout.json` into `art/scenes/<id>/`.',
  '   Add `--dry` to see the result without writing.',
  '3. **Characters**: frames, brought in with `npm run art:sprites` (see Characters below).',
  '   **Stickers, faces and logos**: save the PNG straight into `art/stickers/`, `art/portraits/` or `art/ui/` with the',
  '   listed name.',
  '   **Quest board pictures**: put the blank paper (a file with `paper` in its name), the 準備中 stamp (`stamp` in its',
  '   name) and the world pictures numbered `01-…` to `06-…` in one folder and run `npm run art:quests -- <folder>`;',
  '   it scales them to the listed size.',
  '4. Open the game (`npm run dev`); turn on 設定 → アートガイド to see every piece outlined, the safe area, and (in scenes)',
  '   the pieces pulled apart in 3D.',
  '',
);

// ---------------------------------------------------------------- scenes
push(
  '## Scenes',
  '',
  'A menu scene is one picture split into pieces that stand at different depths, seen through a 3D camera: straight on',
  'at rest (the pieces line up exactly like the picture), swinging toward a character when one is tapped, and drifting a',
  'little all the time, so near pieces slide past far ones. A battle world is not split: it is one flat picture, drawn whole behind the field with no white edge (the camera only glides sideways to the road before a battle). A picture may run',
  'off the picture’s edge (“Runs off”): the game stretches that edge a little and the camera never shows it. Slots are',
  'places where the game puts live buttons and text: leave them clear in the art.',
  '',
  'A piece can be an idle loop: frames of one size drawn in one place, `<id>.png` then `<id>_2.png` …, which the game',
  'shows in turn (menus only). Export them as `name_1.png`, `name_2.png` … beside the other layers; the importer makes',
  'the loop, and a still layer with the same leading number (`02-character.png` beside `02-character-idle_1.png` …) is the',
  'picture it replaces, so the loop stands where the still stood.',
  '',
);
for (const sc of SCENES) {
  const lay = layout<SceneLayout>(`art/scenes/${sc.id}/layout.json`);
  push(`### ${sc.id} — ${sc.kind === 'world' ? 'battle world' : 'menu'}`, '');
  push(`- Picture: **${sc.w} × ${sc.h}** (or ${sc.w * 2} × ${sc.h * 2} at 2×).${lay ? ` Delivered art: ${lay.w} × ${lay.h}${sc.kind === 'world' ? '' : `, ${lay.pieces.length} pieces`}.` : ''}`);
  if (sc.kind === 'menu' && !sc.pan) push(`- Always visible at rest, on screens from 4:3 to 21:9: x ${sc.safe.x0}–${sc.safe.x1}, y ${sc.safe.y0}–${sc.safe.y1}. Wide phones crop a little off the bottom, 4:3 tablets off the sides.`);
  if (sc.pan) push(`- The player drags across it sideways; always visible: y ${sc.safe.y0}–${sc.safe.y1}.`);
  if (sc.field) {
    push(`- The 5 × 9 field (1530 × 850) sits at x ${sc.field.x}–${sc.field.x + 1530}, y ${sc.field.y}–${sc.field.y + 850}: keep it flat ground.`);
    push(`- x ${sc.field.x + 1530}–${sc.w} is the road the enemies come along: before each battle they wait there (y ${sc.field.y}–${sc.field.y + 850}) and the camera glides over to look at them, so keep its middle open ground.`);
  }
  if (lay && sc.field && lay.w < sc.w) {
    const more = sc.w - lay.w;
    push(`- **The delivered picture is ${more} px narrower than planned**, so the game stretches its left edge. To finish it, add ${more} px of canvas on the left, carry the picture on into it (the protected place matters most; the rest only needs a rough fill), and bring it in again.`);
  }
  const focus = sc.layers.filter((l) => l.character);
  if (focus.length) push(`- The camera comes in on: ${focus.map((l) => l.id).join(', ')}.`);
  push(`- ${sc.note.ja}`, `- ${sc.note.en}`, '');
  push('| ✔ | File | Size | Position | Depth | Runs off | Border | What to draw |', '|---|---|---|---|---|---|---|---|');
  for (const l of sc.layers) {
    const key = `scenes/${sc.id}/${l.id}`;
    const real = lay?.pieces.find((p) => p.id === l.id);
    const g = real ?? l;
    const cut = (real?.cut ?? l.cut ?? []).map((s) => SIDE[s]).join(', ') || '—';
    const files = pieceFiles({ ...l, frames: real?.frames ?? l.frames });
    const done = files.every((f) => has(`scenes/${sc.id}/${f}`)) ? '[x]' : '[ ]';
    const file = files.length > 1 ? `\`art/${key}.png\` … \`${files[files.length - 1]}.png\` (idle loop: ${files.length} frames, ${l.frameMs ?? FRAME_MS} ms each)` : `\`art/${key}.png\``;
    push(`| ${done} | ${file} | ${g.w} × ${g.h} | ${g.x}, ${g.y} | ${l.z} | ${cut} | ${l.edge ? 'added by the game' : 'none (backdrop)'} | ${l.note.ja}<br>${l.note.en} |`);
  }
  if (sc.slots.length) {
    push('', `Slots (keep clear): ${sc.slots.length > 8 ? `${sc.slots.length} — ` : ''}${sc.slots.slice(0, 8).map((s) => `\`${s.id}\` ${s.w}×${s.h} at ${s.x}, ${s.y}`).join(' · ')}${sc.slots.length > 8 ? ' · …' : ''}`);
  }
  push('');
}

// ---------------------------------------------------------------- characters
const FIGHTERS = [...ALLY_CHARACTERS, ...ENEMY_CHARACTERS];
const spriteOf = (id: string) => layout<SpriteLayout>(`art/sprites/${id}/sprite.json`);
// パジャマパーティーズ come one member at a time: a row each.
const ROWS = [...FIGHTERS, ...VEHICLES].flatMap((f) => (f.id === 'ally_pajama_parties' ? PAJAMA_MEMBERS.map((m) => ({ ...f, id: `${f.id}_${m}` })) : [f]));
const delivered = ROWS.filter((r) => spriteOf(r.id)).length;
push(
  '## Characters (frame animations)',
  '',
  'Each battle character is a few short frame animations: PNG frames named `<name>_<motion>_<n>.png` (`enemy_` in front is',
  'fine; ちいかぶ’s true form is `chiikabu_true_<motion>_<n>.png`, and キメラ’s first look, claws hidden, goes in',
  '`kimera/claws_retracted/` named like the rest), one folder per character, like `image/sprite/goblin/`.',
  'Bring them in with `npm run art:sprites -- <folder>` (one character’s folder, or a folder of them; add `--dry` to look',
  'first). A motion’s frames share one canvas. Motions may differ in canvas size as long as the character keeps the same',
  'margin under its feet: a bigger canvas grows evenly on both sides, or toward the front only. Side view, as below: friends',
  `face right, enemies left. The game scales each character to its height on the field (S ${TIER_HEIGHT.S}, M ${TIER_HEIGHT.M}, L ${TIER_HEIGHT.L}, XL ${TIER_HEIGHT.XL},`,
  `XXL ${TIER_HEIGHT.XXL} px from feet to head; one tile is 170; a long one is kept to 1.25 times that in length; XXL is a giant three`,
  'lanes tall), adds the white cut edge and the shadow, and plays the frames. Rakko’s car and boat are one picture each',
  '(`rakko_car_idle_1.png`, `rakko_boat_idle_1.png`), which holds still:',
  '',
  '| Motion | Plays |',
  '|---|---|',
  ...Object.entries(SPRITE_MOTIONS).map(([m, t]) => `| \`${m}\` | ${t.ja} / ${t.en} |`),
  '',
  'A character needs its frames before it can appear on the field: the tests name any that has none.',
  '',
  '| Character | Size | Faces | Frames it needs | Can also have | Delivered |',
  '|---|---|---|---|---|---|',
);
for (const r of ROWS) {
  const sp = spriteOf(r.id);
  const { need, extra } = spriteNeeds(r);
  const got = sp ? Object.entries(sp.anims).map(([m, a]) => `${m} ×${a.frames}`).join(', ') : '';
  const missing = need.filter((m) => !sp?.anims[m as keyof SpriteLayout['anims']]);
  const status = !sp ? '—' : missing.length ? `${got} (no ${missing.join(', ')} yet)` : `✓ ${got}`;
  push(`| \`${r.id}\` | ${r.tier}${r.height ? ` (${r.height} px)` : ''} | ${r.facing > 0 ? 'right' : 'left'} | ${need.join(', ')} | ${extra.join(', ') || '—'} | ${status} |`);
}
push('', '<details><summary>What each character is like</summary>', '');
for (const r of CHARACTERS) push(`**${r.id}** — ${r.note.ja} / ${r.note.en}`, '');
push('</details>', '');

// ---------------------------------------------------------------- stickers and single pictures
push(
  '## Stickers',
  '',
  `Single pictures the game pops, spins, grows and fades. Deliver each at the size below, ${STICKER_DETAIL}× the size the game`,
  'draws it on the field, so it stays sharp on tablets and laptops; phones show it at about half that size, so keep it',
  `bold. Pickups and terrain stand on their feet, ${BASELINE * STICKER_DETAIL} px above the bottom edge in the middle; the rest are placed by`,
  'their centre. Projectiles fly right (the fugu’s spit flies left).',
  '',
  '| ✔ | File | Size | What to draw |',
  '|---|---|---|---|',
);
for (const s of STICKERS) push(`| ${tick(`stickers/${s.id}`)} | \`art/stickers/${s.id}.png\` | ${s.w * STICKER_DETAIL} × ${s.h * STICKER_DETAIL} | ${s.note.ja}<br>${s.note.en} |`);
push('', '## Faces and logos', '', '| ✔ | File | Size | Use |', '|---|---|---|---|');
for (const p of PORTRAITS) {
  push(`| ${tick(p.key)} | \`art/${p.key}.png\` | ${p.w} × ${p.h} | ${p.note.en} |`);
}
for (const l of LOGOS) push(`| ${tick(l.key)} | \`art/${l.key}.png\` | ${l.w} × ${l.h} | ${l.note.ja} / ${l.note.en} |`);
push(
  '',
  '## Button icons',
  '',
  'The battle’s three buttons (shovel, speed, pause) are game icons: one square picture each, which the game shows as drawn',
  'on a round coloured face. They show at about 30 px: keep them bold and simple, with no text. Save them straight',
  'into `art/ui/`.',
  '',
  '| ✔ | File | Size | What to draw |',
  '|---|---|---|---|',
);
for (const i of UI_ICONS) push(`| ${tick(i.key)} | \`art/${i.key}.png\` | ${i.w} × ${i.h} | ${i.note.ja}<br>${i.note.en} |`);
push(
  '',
  '## Button pictures',
  '',
  'Buttons drawn whole, lettering and all (the same pictures in English). The back button shows as drawn; the lobby’s four',
  'are cut out by the game as stickers (white edge and shadow) and float over the counter, each in its own shape. Bring one',
  'in with `npm run art:picture -- <file> --as <key>`, which scales it down to the size below.',
  '',
  '| ✔ | File | Size | What to draw |',
  '|---|---|---|---|',
);
for (const i of UI_BUTTONS) push(`| ${tick(i.key)} | \`art/${i.key}.png\` | ${i.w} × ${i.h} | ${i.note.ja}<br>${i.note.en} |`);
push(
  '',
  '## Shop goods',
  '',
  'Each seller’s price list shows its goods as stickers: one square picture per item, with no text (the game cuts it out',
  'with a white edge and writes the name and the price beside it). Save them straight into `art/shop/`.',
  '',
  '| ✔ | File | Size | What to draw |',
  '|---|---|---|---|',
);
for (const i of SHOP_ITEMS) push(`| ${tick(i.key)} | \`art/${i.key}.png\` | ${i.w} × ${i.h} | ${i.note.ja}<br>${i.note.en} |`);
push(
  '',
  '## Props',
  '',
  'Things the game shows for a moment. The hand stamp presses each red stamp the first time it is earned (a world',
  'cleared, the pochette sold out, a gallery entry filled in), then lifts away. Bring it in with',
  '`npm run art:picture -- <file> --as ui/hand_stamp`.',
  '',
  '| ✔ | File | Size | What to draw |',
  '|---|---|---|---|',
);
for (const i of UI_PROPS) push(`| ${tick(i.key)} | \`art/${i.key}.png\` | ${i.w} × ${i.h} | ${i.note.ja}<br>${i.note.en} |`);
push(
  '',
  '## Quest board pictures',
  '',
  'The quest board (the `quests` scene) pins one notice paper per world, then the 討伐ランキング paper (endless mode). The',
  'game writes the number, the names and the buttons on the blank paper and puts the picture in the middle: the world’s,',
  'or Rakko’s on the last paper (it shows his face as a sticker until that is drawn). Sizes are the most the game needs;',
  'bigger pictures are scaled down by `npm run art:quests` (number the ranking picture 07-, or put "ranking" in its name).',
  '',
  '| ✔ | File | Size | What to draw |',
  '|---|---|---|---|',
);
for (const q of QUEST_IMAGES) push(`| ${tick(q.key)} | \`art/${q.key}.png\` | ${q.w} × ${q.h} | ${q.note.ja}<br>${q.note.en} |`);
push(
  '',
  '## Gallery book',
  '',
  'The gallery is the open book on 古本屋’s table (the scene `book` is the table, the wall and 古本屋). The game lays the',
  'book on the right of the screen and adds the tabs, the list and the entries, so its pages stay blank. Bring it in with',
  '`npm run art:picture -- <file> --as gallery/book`.',
  '',
  'The right page shows each character on one stage at one scale, true to its size on the field; the art kit does the',
  'same. The two giants are too big for the page: their heads and fronts stay in view and the rest runs off the page’s',
  'edge. A person’s standing picture',
  '(`art/sprites/people_<id>/idle_1.png`) stands as tall as the fighter they are as big as: the three 鎧さん as tall as',
  'the 鎧さん who fights.',
  '',
  '| ✔ | File | Size | What to draw |',
  '|---|---|---|---|',
);
for (const i of GALLERY_IMAGES) push(`| ${tick(i.key)} | \`art/${i.key}.png\` | ${i.w} × ${i.h} | ${i.note.ja}<br>${i.note.en} |`);
push('');

push(
  '## Sounds (optional)',
  '',
  'Each sound is synthesised until a file exists. Use `.ogg`, `.mp3`, `.m4a` or `.wav`, named by id, in `art/audio/`.',
  '',
  '| ✔ | id | Use |',
  '|---|---|---|',
  ...SOUNDS.map((s) => `| ${['ogg', 'mp3', 'm4a', 'wav'].some((e) => existsSync(join(root, 'art', 'audio', `${s.id}.${e}`))) ? '[x]' : '[ ]'} | \`${s.id}\` | ${s.note.ja} / ${s.note.en} |`),
  '',
  '## Not needed as pictures',
  '',
  'Buttons (the lobby’s floating buttons too), paper panels, cards, the wave and boss bars, banners and icons are drawn by the',
  'game, so they need no art. The PWA icons in `public/icons/` are generated placeholders (`npm run icons`); replace those files directly.',
  '',
  '## Totals',
  '',
  '| Item | Count |',
  '|---|---|',
  `| Scenes | ${SCENES.length} (${pieceCount} pieces${loopFrames ? `, plus ${loopFrames} idle-loop frames` : ''}) |`,
  `| Characters | ${delivered} of ${ROWS.length} delivered as frames (the fighters, パジャマパーティーズ one member at a time, and Rakko’s car and boat) |`,
  `| Stickers | ${STICKERS.length} |`,
  `| Faces and logos | ${PORTRAITS.length + LOGOS.length} |`,
  `| Button icons | ${UI_ICONS.length} |`,
  `| Button pictures | ${UI_BUTTONS.length} |`,
  `| Shop goods | ${SHOP_ITEMS.length} |`,
  `| Props | ${UI_PROPS.length} |`,
  `| Gallery book | ${GALLERY_IMAGES.length} |`,
  `| Quest board pictures | ${QUEST_IMAGES.length} |`,
  `| Sounds | ${SOUNDS.length} |`,
  '',
  'Suggested order: the World 1 battle scene → ちいかわ, ハチワレ, 鎧さん → 虫（二足）, 虫（六足） → the stickers they use →',
  'the rest of the World 1 cast → bosses → Worlds 2–3 → the remaining menu scenes.',
  '',
);

writeFileSync(join(root, 'ASSET_CHECKLIST.md'), lines.join('\n'));
console.log(
  `ASSET_CHECKLIST.md: ${SCENES.length} scenes (${pieceCount} pieces${loopFrames ? ` + ${loopFrames} loop frames` : ''}), ${ROWS.length} characters, ${STICKERS.length} stickers, ${PORTRAITS.length + LOGOS.length} faces and logos, ${UI_ICONS.length} button icons, ${UI_BUTTONS.length} button picture${UI_BUTTONS.length === 1 ? '' : 's'}, ${SHOP_ITEMS.length} shop goods, ${UI_PROPS.length} prop, ${QUEST_IMAGES.length} quest pictures, ${SOUNDS.length} sounds`,
);
