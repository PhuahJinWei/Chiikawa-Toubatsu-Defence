# /art — real art goes here

The whole game is stacked paper cut-outs: flat pictures that the game layers, borders, shades and moves.
A picture missing here shows in the game as a plain card with its name and size, so a gap is easy to spot; sounds
stay synthesised until theirs arrive.

```
art/
  scenes/<scene>/<piece>.png        pieces of a menu scene, or a battle world's one picture.png, plus layout.json
  sprites/<character>/<motion>_<n>.png  a battle character's frames, plus sprite.json (npm run art:sprites)
  sprites/people_<id>/idle_1.png    a person's standing picture on the gallery's people pages (the three 鎧さん, who
                                    stand as tall as the 鎧さん who fights): bring <id>_idle_1.png in with
                                    npm run art:sprites too
  sprites/rescue_rakko_car|boat/idle_1.png  Rakko's car and boat, one picture each (rakko_car_idle_1.png and
                                    rakko_boat_idle_1.png, brought in with npm run art:sprites)
  stickers/<id>.png                 projectiles, effects, weeds, terrain; the heal pulses are frames played
                                    in order (fx_heal_1–3, and fx_heal_black_1–3 for the Black Star); hit sparks
                                    and clinks come in versions, one picked at random each time (fx_hit_1–3,
                                    fx_clink_1–3), and so do 古本屋's books (fx_book_1–3: each book thrown is one
                                    of them, never the same twice in a row); fx_trail is the car's and boat's
                                    trail, fx_dust the stomp's
  portraits/portrait_<id>.png       faces
  ui/logo_ja.png                    the game's title in the lobby (shown in English too)
  ui/logo_en.png                    an English logo (optional)
  ui/button_play|book|shop|settings.png  the lobby's four buttons, picture and name plate in one
  ui/icon_shovel|speed|pause.png    the battle's buttons (square, no text)
  shop/item_slot.png, item_ramen.png  the shop's goods, stickers on the sellers' price lists (square, no text)
  ui/hand_stamp.png                 the hand stamp (判子 seen from above) that presses each red stamp once
  ui/back.png                       the 「← もどる」 button, used for every back button, as drawn
  quests/paper.png, world1–6.png    the quest board's blank paper and one picture per world
  quests/ranking.png                the 討伐ランキング paper's picture (Rakko and his car)
  quests/stamp_soon.png             the red 「準備中」 stamp for papers that are not open yet
  gallery/book.png                  the gallery's open book, pages blank (the game writes in it)
  audio/<sound id>.ogg|mp3|m4a|wav  replaces the synth sound
```

## Rules for every picture

- Flat, straight on, with outlines, on a transparent background (a scene's backmost piece fills its picture).
- **No white border, no shadow, no soft glow**: the game adds the sticker border and the shadows. Paper texture is
  yours to paint (or leave out): the game lays nothing over the art.
- Battle characters are side views: friends and Rakko's car face right, enemies face left. Menu characters face
  the viewer.
- Stickers come at **twice** the size the game draws them on the field (the sizes in ASSET_CHECKLIST.md already are),
  so they stay sharp on tablets and laptops. Phones show them at about half that size, so keep them bold.
- PNG is best (WebP and JPEG also load). Keep the originals here: the build ships WebP to players.

## Battle characters: frames

Every battle character is a few short motions of frames, in its side view (friends face right, enemies left). Name
them `<name>_<motion>_<n>.png` (`enemy_` in front is fine), one folder per character, and run
`npm run art:sprites -- <folder>` on that folder or a folder of them (like `image/sprite`; `--dry` looks first,
`--only goblin,zou` picks some). The motions: `idle` is one picture, `walk` loops, `attack` plays once in 0.52 s (the
blow lands 0.22 s in), `death` plays once while the character fades, plus `ability` (a special move: a song, a spell,
pulling weeds, 六足の虫's jump, the goblin's pick-up, キメラ drawing her claws), `transform` (ちいかぶ; its true form is
`chiikabu_true_<motion>_<n>.png`) and a wall's `damaged1`–`3`. パジャマパーティーズ' dance (their `ability`) always
lasts 6.33 s, however many frames it has: 24 frames is plenty (0.26 s each). Which ones each character needs is in
ASSET_CHECKLIST.md; a character missing one is skipped and listed, and frames for a move a character does not make
are left out (listed too).

- **Standing by takes one picture.** Draw `<name>_idle_1.png` and the game makes it breathe: its feet stay planted and
  it stands 2% taller and back, about once a second (big enemies more slowly), holding still when motion is reduced. Only the first idle picture is brought in; any others in the folder are left out and listed. A wall's
  `damaged1`–`3` breathe the same way when each is one picture.

- 六足の虫's `ability` is its jump over a friend, 2.3 s in three parts: its first frame crouches ready (0.8 s), the
  next three take off, fly and reach down (1 s, while the game lifts it in an arc and carries it over the friend's
  tile), and the last two land and steady it (0.5 s). Draw it on the spot.
- The goblin's `ability` is picking up 草, once in 0.5 s: it bends down at its feet, and the 草 under its hand simply
  vanishes halfway through (there is no walk with the 草).
- キメラ comes in two sets. Her first look has her claws hidden: its frames (idle, walk, attack, death) go in
  `kimera/claws_retracted/`, named like the rest. The frames in `kimera/` have them out, and their `ability` is her
  drawing them, once in 1 s on the spot, starting with them hidden and out by the last frame: she does it the first
  time she is down to 30% of her HP, then stays clawed, moving and clawing twice as fast.

- One canvas size per motion. Motions may differ (a wider attack), as long as the character keeps the same margin
  under its feet; the wider canvas grows evenly on both sides, or toward the front only.
- Draw them at any size: the game scales the character to its height on the field (a long one stands lower) and adds
  the white cut edge and shadow. Big ones (XL and the giants) are drawn 1.5–2.3 times their frames' size on a phone,
  so frames drawn larger stay sharper.
- The importer cuts each motion to the box its frames share and writes `sprite.json` (where the feet stand, how tall
  the character is). Turn on 設定 → アートガイド in the game's dev mode (`?dev`) to see each frame's box and feet point.
- The gallery and the art kit show every character on one stage at one scale, true to its size on the field, so a
  character that looks too big or too small there is too big or too small in battle. The stage fits everyone but the
  two giants, who are too big for the page: their heads and fronts stay in view and the rest runs off its edge. A
  bigger character arriving (not a giant) makes every preview a little smaller (src/art/figure.ts).
- A character needs its frames before it can appear on the field: the tests name any that has none.

## Scenes: paint one picture

**A battle world is not split.** Paint it as one flat picture, edge to edge, and run
`npm run art:import -- <picture.png> --as world2` (add `--dry` to look first). The game draws it whole, with no white edge.
World 5's water lane (the bottom lane, y 1040–1210) is painted in the picture, and the sea runs on to its bottom edge.

**A menu scene comes in layers:**

1. Paint the whole scene in one document, each piece on its own layer.
2. Export every layer as a PNG named with its stacking order and its piece name from ASSET_CHECKLIST.md
   (`00-wall.png`, `01-…`), plus one composited picture named `preview.png`, into a folder. Layers may be exported at
   the full canvas size or cropped.
3. Run `npm run art:import -- <folder> --as <scene id>` (add `--dry` to look first). It matches each
   layer to its piece (by name, else by order when the counts agree; a `map.json` in the folder can name them),
   measures where it sits against the preview, notes the sides that run off the picture, and writes everything here
   with a `layout.json`.
4. Open the game in dev mode (`npm run dev`, then `?dev` in the address) and turn on 設定 → アートガイド to see every
   piece outlined in place.

Scenes keep their planned size (menus 1620 × 972, battle worlds 3360 × 1500 with the field at x 900–2430,
y 360–1210; 2× is fine). In a battle world, x 0–300 on the left only shows a little, under the cards and beside them (a
narrower picture is measured from its right edge, and its left edge is stretched to fill), and x 2430–3360 on the right
is the road the enemies come along: before
each battle they wait there and the camera glides over to look at them, so keep its middle open ground.

**Idle loops (menu scenes).** A scene piece can move by frames, like the lobby's 鎧さん breathing. Export the frames
beside the other layers as `name_1.png`, `name_2.png` … on one canvas size. The importer cuts them to one shared box
and writes `<id>.png`, `<id>_2.png` … with `"frames"` in `layout.json`. The game shows them in turn (the spec sets how
long each frame shows; the 鎧さん's is 0.9 s) and holds frame 1 when motion is reduced. A still layer with the same
leading number (`02-character.png` beside `02-character-idle_1.png` …) is the picture the loop replaces: frame 1
takes its place on the same bottom edge, so hands stay on the counter. A frame repeated in the loop (1-2-3-2) costs
nothing extra in the build.

## Quest board pictures

The quest board (`scenes/quests/board.png` is its kraft paper) pins one notice paper per world. Put the blank paper
(a file with `paper` in its name), the 「準備中」 stamp (a file with `stamp` in its name) and the world pictures
numbered `01-…` to `06-…` in a folder and run `npm run art:quests -- <folder>`: it scales each one down to the size
phones need and saves it here as `quests/paper.png`, `quests/stamp_soon.png` and `quests/world1.png` … `world6.png`.
The game writes the text and buttons on the paper, and presses the stamp on every paper that is not open yet.

## Single pictures

A button, an icon, a logo, a face or a sticker is one picture: run `npm run art:picture -- <file> --as <name>`
(for example `--as ui/back` for the back button) and it is scaled down to its size in `ASSET_CHECKLIST.md` and saved
here under that name. Saving a file of the right name straight into this folder works too, just at full size.

Everything to draw, with sizes, positions and depths: `ASSET_CHECKLIST.md` (regenerate with
`npm run checklist`), or 設定 → アートキット in the game's dev mode (`?dev`; characters move there; its ZIP holds a size
template for every picture).
