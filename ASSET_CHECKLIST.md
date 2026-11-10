# Asset Checklist — ちいかわ討伐ディフェンス

> Generated from `src/art/spec` by `npm run checklist`. Do not edit by hand; change the spec instead.

Every picture and sound the game uses. The whole game is stacked paper cut-outs: flat pictures that the game layers,
borders, shades and moves. Until a file exists the game shows a plain card with the picture name and size in its place.
In the game's dev mode (`?dev` in the address), **設定 → アートキット** shows the same list with live previews (characters move) and a ZIP of size templates.

## Rules for every picture

| Rule | Value |
|---|---|
| Format | PNG with transparency (WebP and JPEG also load). The build turns everything into WebP for players |
| Style | Flat, straight on, with outlines. No white border, no shadow, no soft glow: the game adds the sticker border and the shadows. Any paper texture is part of your art; the game lays nothing over it |
| Battle side view | Characters on the battlefield face sideways: friends and Rakko’s car face right (toward the enemies), enemies face left |
| Menus | Characters in menu scenes face the viewer |

## How to deliver

1. **Battle worlds** are one flat picture, painted edge to edge: run `npm run art:import -- <picture.png> --as <world id>`.
   **Menu scenes**: paint the whole picture in one document, each piece on its own layer.
   Export every layer as a PNG named with its stacking order and its piece name from the tables below
   (`00-wall.png`, `01-…`), plus one composited picture named `preview.png`, into one folder. Layers may be exported
   at the full canvas size or cropped; cropped layers are found by matching them against the preview.
2. Run `npm run art:import -- <folder> --as <scene id>`. It matches each layer to its piece (by name,
   else by order when the counts agree; a `map.json` can name them), measures where it sits and which sides run off
   the picture, and writes the pieces and a `layout.json` into `art/scenes/<id>/`.
   Add `--dry` to see the result without writing.
3. **Characters**: frames, brought in with `npm run art:sprites` (see Characters below).
   **Stickers, faces and logos**: save the PNG straight into `art/stickers/`, `art/portraits/` or `art/ui/` with the
   listed name.
   **Quest board pictures**: put the blank paper (a file with `paper` in its name), the 準備中 stamp (`stamp` in its
   name) and the world pictures numbered `01-…` to `06-…` in one folder and run `npm run art:quests -- <folder>`;
   it scales them to the listed size.
4. Open the game in dev mode (`npm run dev`, then `?dev` in the address); turn on 設定 → アートガイド to see every piece outlined, the safe area, and (in scenes)
   the pieces pulled apart in 3D.

## Scenes

A menu scene is one picture split into pieces that stand at different depths, seen through a 3D camera: straight on
at rest (the pieces line up exactly like the picture), swinging toward a character when one is tapped, and drifting a
little all the time, so near pieces slide past far ones. A battle world is not split: it is one flat picture, drawn whole behind the field with no white edge (the camera only glides sideways to the road before a battle). A picture may run
off the picture’s edge (“Runs off”): the game stretches that edge a little and the camera never shows it. Slots are
places where the game puts live buttons and text: leave them clear in the art.

A piece can be an idle loop: frames of one size drawn in one place, `<id>.png` then `<id>_2.png` …, which the game
shows in turn (menus only). Export them as `name_1.png`, `name_2.png` … beside the other layers; the importer makes
the loop, and a still layer with the same leading number (`02-character.png` beside `02-character-idle_1.png` …) is the
picture it replaces, so the loop stands where the still stood.

### lobby — menu

- Picture: **1620 × 972** (or 3240 × 1944 at 2×). Delivered art: 1620 × 972, 3 pieces.
- Always visible at rest, on screens from 4:3 to 21:9: x 228–1392, y 8–690. Wide phones crop a little off the bottom, 4:3 tablets off the sides.
- ロビー（ゲームの最初の画面）：受付のカウンターと、その向こうの鎧さん。ゲームが大きなボタン（あそぶ・図鑑・お店・設定）を左右にうかべるので、鎧さんの左右は少しあけておく。
- The lobby, the game's first screen: the reception counter with the 鎧さん behind it. The game floats its big buttons (Play, Gallery, Shop, Settings) on the left and right, so keep a little room on both sides of the 鎧さん.

| ✔ | File | Size | Position | Depth | Runs off | Border | What to draw |
|---|---|---|---|---|---|---|---|
| [x] | `art/scenes/lobby/wall.png` | 1620 × 972 | 0, 0 | 4.2 | left, right, top, bottom | none (backdrop) | 受付の壁（はり・壁・腰板）。透明部分なし（絵の全体をぬる）。<br>The wall behind the counter: a beam, plaster and the wainscot. No transparency: fills the whole picture. |
| [x] | `art/scenes/lobby/counter.png` | 1619 × 427 | 0, 545 | 2.8 | left, right, bottom | added by the game | 手前の受付カウンター（書類の束つき）。白いふちと影はゲームが付けるので描かない。透明背景。<br>The reception counter in front, with a stack of papers on it. The game adds the white cut edge and shadow; do not paint them. Transparent background. |
| [x] | `art/scenes/lobby/yoroi.png` … `yoroi_4.png` (idle loop: 4 frames, 900 ms each) | 952 × 696 | 214, 1 | 2.75 | — | added by the game | 受付の鎧さん。正面向き、カウンターに手をついている（下のふちはカウンターの上で切れる）。息をする待ちアニメのコマ4枚（同じ大きさ・同じ位置、手はカウンターから動かさない）。白いふちと影はゲームが付けるので描かない。透明背景。<br>The 鎧さん at the counter, facing the viewer with both hands on it (cut off where the counter top hides the rest). Drawn as a 4-frame breathing loop, every frame the same size and place, the hands staying put on the counter. The game adds the white cut edge and shadow; do not paint them. Transparent background. |

### quests — menu

- Picture: **1620 × 972** (or 3240 × 1944 at 2×).
- Always visible at rest, on screens from 4:3 to 21:9: x 228–1392, y 8–690. Wide phones crop a little off the bottom, 4:3 tablets off the sides.
- クエストの掲示板：クラフト紙の板だけ。クエストの紙（ワールドの絵つき）、見出し、もどるボタンはゲームが貼る。
- The quest board: only the kraft paper of the board. The game pins on the quest papers (each with its world picture), the heading and the back button.

| ✔ | File | Size | Position | Depth | Runs off | Border | What to draw |
|---|---|---|---|---|---|---|---|
| [x] | `art/scenes/quests/board.png` | 1620 × 972 | 0, 0 | 4.2 | left, right, top, bottom | none (backdrop) | 掲示板のクラフト紙。透明部分なし（絵の全体をぬる）。<br>The kraft paper of the board. No transparency: fills the whole picture. |

### shop — menu

- Picture: **1620 × 972** (or 3240 × 1944 at 2×). Delivered art: 1620 × 972, 5 pieces.
- Always visible at rest, on screens from 4:3 to 21:9: x 228–1392, y 8–690. Wide phones crop a little off the bottom, 4:3 tablets off the sides.
- The camera comes in on: shop_master, shop_pochette, shop_shisa.
- ラーメン屋「郎」の店内（お店の画面）。1620×972の1枚の絵を5つのパーツに分けたもの。人物をタップするとカメラがその人に寄り、反対側に品物の紙が出る。どのパーツも平らに・正面から描く（奥行き、カメラの角度、白いふち、影はゲームが付ける）。絵のはしで切れているパーツは、ゲームがはしを少しのばし、カメラが切れ目を見せない。横長のスマホでは下が、4:3のタブレットでは左右が少し切れる。
- Inside ラーメン屋「郎」 (the shop screen): one 1620 × 972 picture split into five pieces. Tapping someone zooms the camera to them and opens their goods on the other side. Paint every piece flat and straight on: the game adds the depth, the camera angle, the white border and the shadows. Where a piece runs off the edge of the picture, the game stretches that edge a little and the camera never shows the cut. Wide phones crop a little off the bottom, 4:3 tablets a little off the sides.

| ✔ | File | Size | Position | Depth | Runs off | Border | What to draw |
|---|---|---|---|---|---|---|---|
| [x] | `art/scenes/shop/shop_wall.png` | 1620 × 972 | 0, 0 | 4.2 | left, right, top, bottom | none (backdrop) | いちばん奥の背景：水色のレンガの壁、「郎」の黄色いのれん、どんぶりを積んだ棚、おたまとざる。絵の全体をぬる。透明部分なし。<br>The farthest piece: the mint brick wall, the yellow 郎 noren, the shelf of stacked bowls, the ladle and the strainer. Fills the whole picture, no transparency. |
| [x] | `art/scenes/shop/shop_master.png` | 565 × 884 | 12, -7 | 3.6 | — | added by the game | ラーメンの鎧さん（郎の店主）。金色のよろい、頭にバンダナ、腕組み。カウンターのうしろ、左はしに立つ。頭のてっぺんは絵の上はしより少し上まであるので、切らずに全部描く。白いふちと影はゲームが付けるので描かない。透明背景。<br>ラーメンの鎧さん, the owner of 郎: gold armour, a bandana, arms folded. Stands behind the counter at the left. The top of the head reaches a little above the picture; draw it whole. The game adds the white cut edge and shadow; do not paint them. Transparent background. |
| [x] | `art/scenes/shop/shop_counter.png` | 1619 × 381 | 1, 591 | 3.3 | left, right, bottom | added by the game | カウンター：ピンクの天板が右の奥へ細くなる。右はしは店の中で終わり、左はしと下は絵の外へ続く。白いふちと影はゲームが付けるので描かない。透明背景。<br>The counter: a pink top narrowing toward the back at the right. It ends inside the shop at the right and runs off the left and bottom of the picture. The game adds the white cut edge and shadow; do not paint them. Transparent background. |
| [x] | `art/scenes/shop/shop_pochette.png` | 518 × 904 | 1102, 68 | 3 | right, bottom | added by the game | ポシェットの鎧さん。銀色のよろい、くまのポシェットをななめがけ、どんぶりを持つ。カウンターの前、右はし。右ひじと足は絵の外へ切れる。白いふちと影はゲームが付けるので描かない。透明背景。<br>ポシェットの鎧さん: silver armour, the bear pochette worn across the body, holding a bowl. In front of the counter at the right; the right elbow and the legs run off the picture. The game adds the white cut edge and shadow; do not paint them. Transparent background. |
| [x] | `art/scenes/shop/shop_shisa.png` | 634 × 510 | 480, 462 | 2.7 | bottom | added by the game | シーサー（郎で働いている）。頭に手ぬぐい、両手に白いふきん。いちばん手前のまん中で、体の下は絵の下はしで切れる。白いふちと影はゲームが付けるので描かない。透明背景。<br>シーサー, who works at 郎: a towel round the head, a white cloth in both hands. Nearest, in the middle; the body runs off the bottom of the picture. The game adds the white cut edge and shadow; do not paint them. Transparent background. |

Slots (keep clear): `tag_ramen` 300×64 at 410, 430 · `tag_shisa` 240×64 at 800, 430 · `tag_pochette` 260×64 at 1252, 470

### book — menu

- Picture: **1620 × 972** (or 3240 × 1944 at 2×). Delivered art: 1619 × 971, 2 pieces.
- Always visible at rest, on screens from 4:3 to 21:9: x 24–464, y 300–700. Wide phones crop a little off the bottom, 4:3 tablets off the sides.
- 図鑑：古本屋の机。左に本を読む古本屋（積んだ本つき）。右にはゲームが開いた図鑑の本を置いて中身を書くので、ほかは机と壁だけでよい。
- The gallery: a table at 古本屋's, with 古本屋 reading on the left beside a stack of books. The game lays the open gallery book on the right and writes in it, so the rest is just the table and the wall.

| ✔ | File | Size | Position | Depth | Runs off | Border | What to draw |
|---|---|---|---|---|---|---|---|
| [x] | `art/scenes/book/wall.png` | 1619 × 971 | 0, 0 | 4.2 | left, right, top, bottom | none (backdrop) | 上に壁、下に机（机のふちはゆるいカーブ）。透明部分なし（絵の全体をぬる）。<br>The wall above and the table below (its edge a gentle curve). No transparency: fills the whole picture. |
| [x] | `art/scenes/book/furuhonya.png` | 409 × 394 | 30, 306 | 3 | — | added by the game | 本を読む古本屋と、横に積んだ本（机の上、左はし）。ゲームが左右に6°ずつカクッと傾ける（下のまんなかを軸に）。白いふちと影はゲームが付けるので描かない。透明背景。<br>古本屋 reading, with a stack of books beside (on the table, at the left). The game snaps it 6° left and right, turning about the middle of its bottom edge. The game adds the white cut edge and shadow; do not paint them. Transparent background. |

### world1 — battle world

- Picture: **3360 × 1500** (or 6720 × 3000 at 2×). Delivered art: 3360 × 1500.
- The 5 × 9 field (1530 × 850) sits at x 900–2430, y 360–1210: keep it flat ground.
- x 2430–3360 is the road the enemies come along: before each battle they wait there (y 360–1210) and the camera glides over to look at them, so keep its middle open ground.
- World 1 野原（ハチワレの洞窟）の戦場の背景（3360×1500の1枚の絵。パーツに分けず、全部を1枚に描く。白いふちはつかない）。x 900〜2430・y 360〜1210 が5×9マスの戦場：大きな物は置かず、平らな地面に（マス目はゲームが重ねる）。その左のx 730〜900はラッコのくるまが止まる地面。左に守る場所：カードの列がx 400ほどまでかかるので、入口や顔はx 400より右に（x 0〜300は、カードの下やそのわきに少し見えるだけなので、かんたんな続きの絵でよい）。右のx 2430〜3360は相手が来る道：戦いの前に相手がここ（y 360〜1210）に並んで待つので、歩ける地面のままにする。上は空、下は手前の地面で、どちらも画面の形によって少し見える。
- World 1, the meadow (Hachiware’s cave): battle backdrop: one flat 3360 × 1500 picture, everything painted together, not in pieces (it gets no white edge). x 900–2430, y 360–1210 is the 5 × 9 field: keep it flat ground with nothing big on it (the game lays the grid over it). Just left of it, x 730–900 is plain ground where Rakko’s cars park. The protected place stands at the left: the card column covers up to about x 400 of it, so keep a doorway or face right of x 400 (x 0–300 only shows a little, under the cards and beside them, so a simple continuation of the picture is enough). On the right, x 2430–3360 is the road the enemies come along: before a battle they line up there (y 360–1210) to be looked at, so keep it open ground. The sky above and the near ground below show a little, depending on the screen.

| ✔ | File | Size | Position | Depth | Runs off | Border | What to draw |
|---|---|---|---|---|---|---|---|
| [x] | `art/scenes/world1/picture.png` | 3360 × 1500 | 0, 0 | 1 | left, right, top, bottom | none (backdrop) | 空と雲。地平線の丘。野原の地面（戦場もこの上）。相手が来る右の小道（戦いの前に相手がここで待つ）。守る場所：ハチワレの洞窟（入口は右＝戦場向き）。手前の草と花（下のふち）。透明部分なし（絵の全体をぬる）。<br>Sky and clouds; hills on the horizon; the meadow ground (the field lies on it); the path on the right the enemies come along (they wait on it before a battle); the protected place, Hachiware’s cave, its mouth facing right toward the field; grass and flowers along the bottom edge. No transparency: fills the whole picture. |

### world1_one_lane — battle world

- Picture: **3360 × 1500** (or 6720 × 3000 at 2×). Delivered art: 3360 × 1500.
- The 5 × 9 field (1530 × 850) sits at x 900–2430, y 360–1210: keep it flat ground.
- x 2430–3360 is the road the enemies come along: before each battle they wait there (y 360–1210) and the camera glides over to look at them, so keep its middle open ground.
- World 1 野原、レーン1本のジョブ（1-1）の戦場の背景（3360×1500の1枚の絵。パーツに分けず、全部を1枚に描く。白いふちはつかない）。x 900〜2430・y 360〜1210 が5×9マスの戦場：大きな物は置かず、平らな地面に（マス目はゲームが重ねる）。その左のx 730〜900はラッコのくるまが止まる地面。左に守る場所：カードの列がx 400ほどまでかかるので、入口や顔はx 400より右に（x 0〜300は、カードの下やそのわきに少し見えるだけなので、かんたんな続きの絵でよい）。右のx 2430〜3360は相手が来る道：戦いの前に相手がここ（y 360〜1210）に並んで待つので、歩ける地面のままにする。上は空、下は手前の地面で、どちらも画面の形によって少し見える。
- World 1, the meadow, for the job with one open lane (1-1): battle backdrop: one flat 3360 × 1500 picture, everything painted together, not in pieces (it gets no white edge). x 900–2430, y 360–1210 is the 5 × 9 field: keep it flat ground with nothing big on it (the game lays the grid over it). Just left of it, x 730–900 is plain ground where Rakko’s cars park. The protected place stands at the left: the card column covers up to about x 400 of it, so keep a doorway or face right of x 400 (x 0–300 only shows a little, under the cards and beside them, so a simple continuation of the picture is enough). On the right, x 2430–3360 is the road the enemies come along: before a battle they line up there (y 360–1210) to be looked at, so keep it open ground. The sky above and the near ground below show a little, depending on the screen.

| ✔ | File | Size | Position | Depth | Runs off | Border | What to draw |
|---|---|---|---|---|---|---|---|
| [x] | `art/scenes/world1_one_lane/picture.png` | 3360 × 1500 | 0, 0 | 1 | left, right, top, bottom | none (backdrop) | World 1 の絵と同じ野原で、草があるのは開いているレーン（y 700〜870）だけ。閉じたレーンは砂地で、そのまま右の小道につづく。透明部分なし（絵の全体をぬる）。<br>The same meadow as World 1’s picture, with grass only on the open lane (y 700–870). The closed lanes are bare ground, the same sand as the road they run on into. No transparency: fills the whole picture. |

### world1_three_lanes — battle world

- Picture: **3360 × 1500** (or 6720 × 3000 at 2×). Delivered art: 3360 × 1500.
- The 5 × 9 field (1530 × 850) sits at x 900–2430, y 360–1210: keep it flat ground.
- x 2430–3360 is the road the enemies come along: before each battle they wait there (y 360–1210) and the camera glides over to look at them, so keep its middle open ground.
- World 1 野原、レーン3本のジョブ（1-2、1-3）の戦場の背景（3360×1500の1枚の絵。パーツに分けず、全部を1枚に描く。白いふちはつかない）。x 900〜2430・y 360〜1210 が5×9マスの戦場：大きな物は置かず、平らな地面に（マス目はゲームが重ねる）。その左のx 730〜900はラッコのくるまが止まる地面。左に守る場所：カードの列がx 400ほどまでかかるので、入口や顔はx 400より右に（x 0〜300は、カードの下やそのわきに少し見えるだけなので、かんたんな続きの絵でよい）。右のx 2430〜3360は相手が来る道：戦いの前に相手がここ（y 360〜1210）に並んで待つので、歩ける地面のままにする。上は空、下は手前の地面で、どちらも画面の形によって少し見える。
- World 1, the meadow, for the jobs with three open lanes (1-2, 1-3): battle backdrop: one flat 3360 × 1500 picture, everything painted together, not in pieces (it gets no white edge). x 900–2430, y 360–1210 is the 5 × 9 field: keep it flat ground with nothing big on it (the game lays the grid over it). Just left of it, x 730–900 is plain ground where Rakko’s cars park. The protected place stands at the left: the card column covers up to about x 400 of it, so keep a doorway or face right of x 400 (x 0–300 only shows a little, under the cards and beside them, so a simple continuation of the picture is enough). On the right, x 2430–3360 is the road the enemies come along: before a battle they line up there (y 360–1210) to be looked at, so keep it open ground. The sky above and the near ground below show a little, depending on the screen.

| ✔ | File | Size | Position | Depth | Runs off | Border | What to draw |
|---|---|---|---|---|---|---|---|
| [x] | `art/scenes/world1_three_lanes/picture.png` | 3360 × 1500 | 0, 0 | 1 | left, right, top, bottom | none (backdrop) | World 1 の絵と同じ野原で、草があるのは開いているレーン（y 530〜1040）だけ。閉じたレーンは砂地で、そのまま右の小道につづく。透明部分なし（絵の全体をぬる）。<br>The same meadow as World 1’s picture, with grass only on the open lanes (y 530–1040). The closed lanes are bare ground, the same sand as the road they run on into. No transparency: fills the whole picture. |

### world2 — battle world

- Picture: **3360 × 1500** (or 6720 × 3000 at 2×). Delivered art: 3360 × 1500.
- The 5 × 9 field (1530 × 850) sits at x 900–2430, y 360–1210: keep it flat ground.
- x 2430–3360 is the road the enemies come along: before each battle they wait there (y 360–1210) and the camera glides over to look at them, so keep its middle open ground.
- World 2 森（森の出口）の戦場の背景（3360×1500の1枚の絵。パーツに分けず、全部を1枚に描く。白いふちはつかない）。x 900〜2430・y 360〜1210 が5×9マスの戦場：大きな物は置かず、平らな地面に（マス目はゲームが重ねる）。その左のx 730〜900はラッコのくるまが止まる地面。左に守る場所：カードの列がx 400ほどまでかかるので、入口や顔はx 400より右に（x 0〜300は、カードの下やそのわきに少し見えるだけなので、かんたんな続きの絵でよい）。右のx 2430〜3360は相手が来る道：戦いの前に相手がここ（y 360〜1210）に並んで待つので、歩ける地面のままにする。上は空、下は手前の地面で、どちらも画面の形によって少し見える。
- World 2, the forest (the forest exit): battle backdrop: one flat 3360 × 1500 picture, everything painted together, not in pieces (it gets no white edge). x 900–2430, y 360–1210 is the 5 × 9 field: keep it flat ground with nothing big on it (the game lays the grid over it). Just left of it, x 730–900 is plain ground where Rakko’s cars park. The protected place stands at the left: the card column covers up to about x 400 of it, so keep a doorway or face right of x 400 (x 0–300 only shows a little, under the cards and beside them, so a simple continuation of the picture is enough). On the right, x 2430–3360 is the road the enemies come along: before a battle they line up there (y 360–1210) to be looked at, so keep it open ground. The sky above and the near ground below show a little, depending on the screen.

| ✔ | File | Size | Position | Depth | Runs off | Border | What to draw |
|---|---|---|---|---|---|---|---|
| [x] | `art/scenes/world2/picture.png` | 3360 × 1500 | 0, 0 | 1 | left, right, top, bottom | none (backdrop) | 木もれ日の空。奥の木々。森の地面（戦場もこの上）。相手が出てくる右の茂みと小道（木は右はしと上下に寄せ、まん中は相手が待つ地面）。守る場所：森の出口（木々のあいだが明るい）。手前の草と木の根（下のふち）。透明部分なし（絵の全体をぬる）。<br>Sky through the canopy; trees in the distance; the forest floor (the field lies on it); the thicket on the right the enemies come out of, with a path through it (trees along the far edge and the top and bottom; the middle is open ground where they wait); the protected place, the forest exit, bright between the trees; grass and roots along the bottom edge. No transparency: fills the whole picture. |

### world3 — battle world

- Picture: **3360 × 1500** (or 6720 × 3000 at 2×). Delivered art: 3360 × 1500.
- The 5 × 9 field (1530 × 850) sits at x 900–2430, y 360–1210: keep it flat ground.
- x 2430–3360 is the road the enemies come along: before each battle they wait there (y 360–1210) and the camera glides over to look at them, so keep its middle open ground.
- World 3 街（ラーメン屋「郎」）の戦場の背景（3360×1500の1枚の絵。パーツに分けず、全部を1枚に描く。白いふちはつかない）。x 900〜2430・y 360〜1210 が5×9マスの戦場：大きな物は置かず、平らな地面に（マス目はゲームが重ねる）。その左のx 730〜900はラッコのくるまが止まる地面。左に守る場所：カードの列がx 400ほどまでかかるので、入口や顔はx 400より右に（x 0〜300は、カードの下やそのわきに少し見えるだけなので、かんたんな続きの絵でよい）。右のx 2430〜3360は相手が来る道：戦いの前に相手がここ（y 360〜1210）に並んで待つので、歩ける地面のままにする。上は空、下は手前の地面で、どちらも画面の形によって少し見える。
- World 3, the town (ラーメン屋「郎」): battle backdrop: one flat 3360 × 1500 picture, everything painted together, not in pieces (it gets no white edge). x 900–2430, y 360–1210 is the 5 × 9 field: keep it flat ground with nothing big on it (the game lays the grid over it). Just left of it, x 730–900 is plain ground where Rakko’s cars park. The protected place stands at the left: the card column covers up to about x 400 of it, so keep a doorway or face right of x 400 (x 0–300 only shows a little, under the cards and beside them, so a simple continuation of the picture is enough). On the right, x 2430–3360 is the road the enemies come along: before a battle they line up there (y 360–1210) to be looked at, so keep it open ground. The sky above and the near ground below show a little, depending on the screen.

| ✔ | File | Size | Position | Depth | Runs off | Border | What to draw |
|---|---|---|---|---|---|---|---|
| [x] | `art/scenes/world3/picture.png` | 3360 × 1500 | 0, 0 | 1 | left, right, top, bottom | none (backdrop) | 夕方の空。奥の街並み。石だたみの通り（戦場もこの上）。相手が来る右の路地（戦いの前に相手がここで待つ）。守る場所：ラーメン屋「郎」の店先（のれんは右＝戦場向き）。手前の石だたみと植木鉢（下のふち）。透明部分なし（絵の全体をぬる）。<br>Evening sky; the town in the distance; the paved street (the field lies on it); the side street on the right the enemies come down (they wait in it before a battle); the protected place, the front of ラーメン屋「郎」, its noren facing right toward the field; paving stones and flowerpots along the bottom edge. No transparency: fills the whole picture. |

### world4 — battle world

- Picture: **3360 × 1500** (or 6720 × 3000 at 2×). Delivered art: 3360 × 1500.
- The 5 × 9 field (1530 × 850) sits at x 900–2430, y 360–1210: keep it flat ground.
- x 2430–3360 is the road the enemies come along: before each battle they wait there (y 360–1210) and the camera glides over to look at them, so keep its middle open ground.
- World 4 夜（ちいかわの家）の戦場の背景（3360×1500の1枚の絵。パーツに分けず、全部を1枚に描く。白いふちはつかない）。x 900〜2430・y 360〜1210 が5×9マスの戦場：大きな物は置かず、平らな地面に（マス目はゲームが重ねる）。その左のx 730〜900はラッコのくるまが止まる地面。左に守る場所：カードの列がx 400ほどまでかかるので、入口や顔はx 400より右に（x 0〜300は、カードの下やそのわきに少し見えるだけなので、かんたんな続きの絵でよい）。右のx 2430〜3360は相手が来る道：戦いの前に相手がここ（y 360〜1210）に並んで待つので、歩ける地面のままにする。上は空、下は手前の地面で、どちらも画面の形によって少し見える。
- World 4, night (Chiikawa’s home): battle backdrop: one flat 3360 × 1500 picture, everything painted together, not in pieces (it gets no white edge). x 900–2430, y 360–1210 is the 5 × 9 field: keep it flat ground with nothing big on it (the game lays the grid over it). Just left of it, x 730–900 is plain ground where Rakko’s cars park. The protected place stands at the left: the card column covers up to about x 400 of it, so keep a doorway or face right of x 400 (x 0–300 only shows a little, under the cards and beside them, so a simple continuation of the picture is enough). On the right, x 2430–3360 is the road the enemies come along: before a battle they line up there (y 360–1210) to be looked at, so keep it open ground. The sky above and the near ground below show a little, depending on the screen.

| ✔ | File | Size | Position | Depth | Runs off | Border | What to draw |
|---|---|---|---|---|---|---|---|
| [x] | `art/scenes/world4/picture.png` | 3360 × 1500 | 0, 0 | 1 | left, right, top, bottom | none (backdrop) | 星の夜空。地平線の青い茂みと、遠くのとなりの家（丸い屋根、窓に明かり）。夜の草地（戦場もこの上）。相手が来る右の暗い夜道（戦いの前に相手がここで待つ）。守る場所：ちいかわの家（白い丸い家、窓に明かり。入口は右＝戦場向き）。手前の夜の草（下のふち）。透明部分なし（絵の全体をぬる）。<br>The night sky with stars; blue bushes on the horizon, with the neighbours’ dome homes far off (lit windows); the grass at night (the field lies on it); the dark path on the right the enemies come along (they wait on it before a battle); the protected place, Chiikawa’s home (the white dome, its window lit), the door facing right toward the field; grass at night along the bottom edge. No transparency: fills the whole picture. |

### world5 — battle world

- Picture: **3360 × 1500** (or 6720 × 3000 at 2×). Delivered art: 3360 × 1500.
- The 5 × 9 field (1530 × 850) sits at x 900–2430, y 360–1210: keep it flat ground.
- x 2430–3360 is the road the enemies come along: before each battle they wait there (y 360–1210) and the camera glides over to look at them, so keep its middle open ground.
- World 5 島（浜辺の洞窟）の戦場の背景（3360×1500の1枚の絵。パーツに分けず、全部を1枚に描く。白いふちはつかない）。x 900〜2430・y 360〜1210 が5×9マスの戦場：大きな物は置かず、平らな地面に（マス目はゲームが重ねる）。その左のx 730〜900はラッコのくるまが止まる地面。左に守る場所：カードの列がx 400ほどまでかかるので、入口や顔はx 400より右に（x 0〜300は、カードの下やそのわきに少し見えるだけなので、かんたんな続きの絵でよい）。右のx 2430〜3360は相手が来る道：戦いの前に相手がここ（y 360〜1210）に並んで待つので、歩ける地面のままにする。上は空、下は手前の地面で、どちらも画面の形によって少し見える。水のレーン：いちばん下（5番目）のレーンは、World 5 のどのジョブでも海なので、絵の中に描く。波打ちぎわを y 1040 あたりに絵の左はしから右はしまで通して、y 1040〜1210 をすべて水にする。海はそのまま絵の下のはしまで続ける。マス目はゲームが重ねる。ヒトハ・フタバとラッコのボートがこの上に浮かぶ。
- World 5, the island (the beach cave): battle backdrop: one flat 3360 × 1500 picture, everything painted together, not in pieces (it gets no white edge). x 900–2430, y 360–1210 is the 5 × 9 field: keep it flat ground with nothing big on it (the game lays the grid over it). Just left of it, x 730–900 is plain ground where Rakko’s cars park. The protected place stands at the left: the card column covers up to about x 400 of it, so keep a doorway or face right of x 400 (x 0–300 only shows a little, under the cards and beside them, so a simple continuation of the picture is enough). On the right, x 2430–3360 is the road the enemies come along: before a battle they line up there (y 360–1210) to be looked at, so keep it open ground. The sky above and the near ground below show a little, depending on the screen. The water lane: the bottom lane (the fifth) is sea in every World 5 job, so paint it into the picture: run the surf along y 1040 from edge to edge, so that y 1040–1210 is all water, and carry the sea on down to the bottom of the picture. The game lays the tile grid over it. ヒトハ, フタバ and Rakko’s boat float on it.

| ✔ | File | Size | Position | Depth | Runs off | Border | What to draw |
|---|---|---|---|---|---|---|---|
| [x] | `art/scenes/world5/picture.png` | 3360 × 1500 | 0, 0 | 1 | left, right, top, bottom | none (backdrop) | 月夜の空と、砂浜のうしろに続く島の森（ヤシの木）。浜の砂（戦場もこの上）。相手が来る右の砂浜（戦いの前に相手がここで待つので、ひらけた砂のままに）。守る場所：浜辺の洞窟（岩がけに青い葉、暗い洞窟の口は右＝戦場向き）。いちばん下は海で、波打ちぎわが絵の左はしから右はしまで続く。透明部分なし（絵の全体をぬる）。<br>The moonlit sky, and the island’s forest of palms behind the beach; the sand (the field lies on it); the open beach on the right the enemies come along (they wait on it before a battle, so keep it open sand); the protected place, the beach cave, rocky cliffs with leafy plants on top, the dark cave mouth facing right toward the field; along the bottom the sea, its surf running from edge to edge of the picture. No transparency: fills the whole picture. |

### world6 — battle world

- Picture: **3360 × 1500** (or 6720 × 3000 at 2×). Delivered art: 3360 × 1500.
- The 5 × 9 field (1530 × 850) sits at x 900–2430, y 360–1210: keep it flat ground.
- x 2430–3360 is the road the enemies come along: before each battle they wait there (y 360–1210) and the camera glides over to look at them, so keep its middle open ground.
- World 6 おっきい討伐（着地したところ）の戦場の背景（3360×1500の1枚の絵。パーツに分けず、全部を1枚に描く。白いふちはつかない）。x 900〜2430・y 360〜1210 が5×9マスの戦場：大きな物は置かず、平らな地面に（マス目はゲームが重ねる）。その左のx 730〜900はラッコのくるまが止まる地面。左に守る場所：カードの列がx 400ほどまでかかるので、入口や顔はx 400より右に（x 0〜300は、カードの下やそのわきに少し見えるだけなので、かんたんな続きの絵でよい）。右のx 2430〜3360は相手が来る道：戦いの前に相手がここ（y 360〜1210）に並んで待つので、歩ける地面のままにする。上は空、下は手前の地面で、どちらも画面の形によって少し見える。ラッコはこの討伐に来ないので、くるまは止まらない（x 730〜900 もふつうの地面のままに）。
- World 6, the big hunt (the landing spot): battle backdrop: one flat 3360 × 1500 picture, everything painted together, not in pieces (it gets no white edge). x 900–2430, y 360–1210 is the 5 × 9 field: keep it flat ground with nothing big on it (the game lays the grid over it). Just left of it, x 730–900 is plain ground where Rakko’s cars park. The protected place stands at the left: the card column covers up to about x 400 of it, so keep a doorway or face right of x 400 (x 0–300 only shows a little, under the cards and beside them, so a simple continuation of the picture is enough). On the right, x 2430–3360 is the road the enemies come along: before a battle they line up there (y 360–1210) to be looked at, so keep it open ground. The sky above and the near ground below show a little, depending on the screen. Rakko is not on this hunt, so no car parks here: x 730–900 stays plain ground too.

| ✔ | File | Size | Position | Depth | Runs off | Border | What to draw |
|---|---|---|---|---|---|---|---|
| [x] | `art/scenes/world6/picture.png` | 3360 × 1500 | 0, 0 | 1 | left, right, top, bottom | none (backdrop) | やわらかい色の空（森の上に少し見える）。奥の森：大きなうすいピンクの幹と、やわらかい緑の木のかたまり、木のあいだは青緑のかげ（たて長のうすい光のつぶ）、そのふもとに小さな芽の出たまるい緑の茂み。森の中のひらけた地面（戦場もこの上）：うすいクリーム色に、短い線と小さな草のたば、戦場の外には野の草のかたまりも。大きいのが出てくる、右の背の高い草むら：草は右はしと上下だけで、まん中（x 2430〜3360・y 360〜1210）は、戦いの前に相手が並んで待つひらけた地面のまま。守る場所：着地したところ（ちいかわたちがおりてきた、森のひらけた場所）。まるい茂みの前に、見たことのないキノコ（ピンクとむらさきのしまのかさ、くねくねした白い柄）が大小いくつも。手前に草の先と、小さなしまのキノコ、カエル（下のふち）。透明部分なし（絵の全体をぬる）。<br>A soft pale sky, showing a little over the forest. The far forest: big pale-pink trunks and soft green crowns, a teal shade between the trees (with long pale glints), and round green bushes with little sprouts along its foot. The clearing (the field lies on it): pale cream ground with little dash marks and small grass tufts, and clumps of wild grass off the field. The tall grass on the right, where the big ones come out: grass only down the far right edge and along the top and bottom, the middle (x 2430–3360, y 360–1210) staying open ground where the enemies line up before a battle. The protected place, the landing spot, the clearing where the team came down: several of the mushrooms they had never seen (pink-and-purple striped caps on wavy white stems), big and small, in front of round bushes. Grass tips, little striped mushrooms and a frog along the bottom edge. No transparency: fills the whole picture. |

## Characters (frame animations)

Each battle character is a few short frame animations: PNG frames named `<name>_<motion>_<n>.png` (`enemy_` in front is
fine; ちいかぶ’s true form is `chiikabu_true_<motion>_<n>.png`, and キメラ’s first look, claws hidden, goes in
`kimera/claws_retracted/` named like the rest), one folder per character, like `image/sprite/goblin/`.
Bring them in with `npm run art:sprites -- <folder>` (one character’s folder, or a folder of them; add `--dry` to look
first). A motion’s frames share one canvas. Motions may differ in canvas size as long as the character keeps the same
margin under its feet: a bigger canvas grows evenly on both sides, or toward the front only. Side view, as below: friends
face right, enemies left. The game scales each character to its height on the field (S 150, M 195, L 262, XL 338,
XXL 480 px from feet to head; one tile is 170; a long one is kept to 1.25 times that in length; XXL is a giant three
lanes tall), adds the white cut edge and the shadow, and plays the frames. Rakko’s car and boat are one picture each
(`rakko_car_idle_1.png`, `rakko_boat_idle_1.png`), which holds still:

| Motion | Plays |
|---|---|
| `idle` | 待機。絵は1枚だけ（1枚めを使う）。足もとはそのままで、ゲームが息をさせる（約1秒で2%のびて、もどる） / Standing by: one picture (only the first is used). The game makes it breathe, feet planted (2% taller and back, about once a second) |
| `walk` | 歩く・泳ぐ・飛ぶ。ループ（速さで1コマ0.075〜0.14秒） / Walking, swimming or flying, looping (0.075–0.14 s a frame, by speed) |
| `attack` | 攻撃。1回0.52秒（0.22秒で当たる）。星は攻撃せず、ねがいをかなえる動きになる（1回0.6秒。さいごのコマが始まるときに、えらんだなかまに変わる） / Attacking, once in 0.52 s (the blow lands 0.22 s in). 星 never attacks: its frames are its cast instead, once in 0.6 s (the friend picked takes its place as the last frame begins) |
| `death` | たおれる。1回0.56秒、消えながら / Falling, once in 0.56 s while fading out |
| `ability` | とくいわざ。歌・呪文はループ。むちゃうマンの決めポーズは1回0.75秒で、さいごのコマのまま止まる（パジャマパーティーズのダンスは、コマ数にかかわらず1回6.33秒。24コマなら1コマ0.26秒）。六足の虫のジャンプは1回2.3秒：1コマめでかまえて0.8秒、2〜4コマめで空中1秒、5〜6コマめで着地0.5秒（その場でとぶ絵で。前と上へは、ゲームが運ぶ）。ゴブリンの草ひろいは1回0.5秒（足もとでかがむ。まん中で草が消える）。キメラが爪を出すのは1回1秒（爪のある姿の ability。爪をかくした姿から始めて、さいごのコマで出そろう） / A special move. A song or a spell loops, and むちゃうマン’s pose plays once in 0.75 s and holds its last frame (パジャマパーティーズ’ dance lasts 6.33 s however many frames it has: 0.26 s a frame for 24); the six-legged bug’s jump plays once in 2.3 s: its first frame crouches ready for 0.8 s, frames 2–4 are in the air for 1 s, frames 5–6 land in 0.5 s (drawn on the spot: the game carries it up and over); the goblin’s pick-up plays once in 0.5 s (bending down at its feet; the 草 vanishes halfway); the chimera drawing her claws plays once in 1 s (her clawed form’s ability: starting with them hidden, out by the last frame) |
| `transform` | 変身。1回1.5秒 / Transforming, once in 1.5 s |
| `spawn` | セイレーンに呼ばれて出てくる（地面からはい出す）。1回0.9秒 / Coming up when セイレーン calls (climbing out of the ground), once in 0.9 s |
| `cook` | たい焼きが焼けていく段階の絵（生から焼きあがりまで）。さいごの1枚をのぞいた絵が焼けるあいだに順に出て、さいごの絵（焼きあがり）は焼けたときに一瞬出る。そのあとは待機（idle） / The taiyaki’s cooking stages, raw to done. All but the last share out the time it cooks; the last (done) shows for a moment as it comes ready, and then it stands by (idle) |
| `weed_search` | ちいかわが草をさがす（すわって左右を見る）。ループ1回1.6秒 / Chiikawa searching for 草 (seated, looking left and right), a 1.6 s loop |
| `weed_found` | ちいかわが草を見つけて、かかげる（草は絵に描きこむ）。1回0.64秒で、さいごのコマのまま少し止まる（さいごのコマで草が手に入る） / Chiikawa finding 草 and holding it up (the 草 is part of the picture), once in 0.64 s, holding the last frame a moment (the 草 is hers on the last frame) |
| `damaged1` | 壁のきず1（待機のかわり）。1枚なら待機と同じく息をする。2枚以上ならループ / A wall’s first wear, in place of standing by: one picture breathes like idle, several loop |
| `damaged2` | 壁のきず2。1枚なら息をする。2枚以上ならループ / A wall’s second wear: one picture breathes, several loop |
| `damaged3` | 壁のきず3。1枚なら息をする。2枚以上ならループ / A wall’s third wear: one picture breathes, several loop |

A character needs its frames before it can appear on the field: the tests name any that has none.

| Character | Size | Faces | Frames it needs | Can also have | Delivered |
|---|---|---|---|---|---|
| `ally_chiikawa` | S | right | idle, weed_search, weed_found | — | ✓ idle ×1, weed_search ×8, weed_found ×4 |
| `ally_chiikawa_island` | S | right | idle, attack | — | ✓ idle ×1, attack ×5 |
| `ally_hachiware` | S | right | idle, attack | — | ✓ idle ×1, attack ×5 |
| `ally_hachiware_pajama` | S | right | idle, attack | — | ✓ idle ×1, attack ×5 |
| `ally_yoroi` | M | right | idle | damaged1, damaged2 | ✓ idle ×1, damaged1 ×1, damaged2 ×1 |
| `ally_yoroi_erai` | M | right | idle | damaged1, damaged2 | ✓ idle ×1, damaged1 ×1, damaged2 ×1 |
| `ally_usagi` | S (196 px) | right | idle, attack | — | ✓ idle ×1, attack ×5 |
| `ally_usagi_cool` | S (196 px) | right | idle | — | ✓ idle ×1 |
| `ally_momonga` | S | right | idle, attack | — | ✓ idle ×1, attack ×4 |
| `ally_kurimanju` | S | right | idle, attack | — | ✓ idle ×1, attack ×5 |
| `ally_shisa` | S | right | idle, attack | — | ✓ idle ×1, attack ×5 |
| `ally_ode` | L | right | idle, walk | — | ✓ idle ×1, walk ×6 |
| `ally_pajama_parties_green` | S | right | idle | ability | ✓ idle ×1, ability ×24 |
| `ally_pajama_parties_pink` | S | right | idle | ability | ✓ idle ×1, ability ×24 |
| `ally_pajama_parties_purple` | S | right | idle | ability | ✓ idle ×1, ability ×23 |
| `ally_pajama_parties_white` | S | right | idle | ability | ✓ idle ×1, ability ×24 |
| `ally_furuhonya` | S (176 px) | right | idle, attack | — | ✓ idle ×1, attack ×4 |
| `ally_futaba` | S | right | idle, attack | — | ✓ idle ×1, attack ×5 |
| `ally_hitoha` | S | right | idle, attack | — | ✓ idle ×1, attack ×5 |
| `ally_rakko` | S | right | idle, attack | — | ✓ idle ×1, attack ×4 |
| `ally_shimajiro` | L | right | idle | damaged1, damaged2 | ✓ idle ×1, damaged1 ×1, damaged2 ×1 |
| `ally_taiyaki` | S (100 px) | right | idle, cook | — | ✓ idle ×1, cook ×3 |
| `ally_muchauman` | M | right | idle, ability | — | ✓ idle ×1, ability ×5 |
| `enemy_mushi_twolegs` | S | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×5, attack ×4, death ×4 |
| `enemy_goblin` | S (135 px) | left | idle, walk, attack, death | ability | ✓ idle ×1, walk ×4, attack ×4, death ×4, ability ×6 |
| `enemy_mushi_sixlegs` | M | left | idle, walk, death | ability | ✓ idle ×1, walk ×6, death ×4, ability ×6 |
| `enemy_chushidesu` | M | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×6, attack ×4, death ×4 |
| `enemy_fugu` | S | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×6, attack ×4, death ×4 |
| `enemy_majyo` | L | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×4, attack ×4, death ×4 |
| `enemy_kimera` | S | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×5, attack ×4, death ×4 |
| `enemy_kimera_claws` | S | left | idle, walk, attack, death | ability | ✓ idle ×1, walk ×5, attack ×4, death ×4, ability ×4 |
| `enemy_mushi_horned` | L | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×11, attack ×4, death ×4 |
| `enemy_mushi_pink` | XL | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×6, attack ×6, death ×4 |
| `enemy_kuroi_nagareboshi` | S (128 px) | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×6, attack ×4, death ×4 |
| `enemy_guchokipanogitaigata` | L | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×6, attack ×4, death ×4 |
| `enemy_zou` | XL | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×6, attack ×4, death ×4 |
| `enemy_chiikabu` | S | left | idle, walk | — | ✓ idle ×1, walk ×6 |
| `enemy_chiikabu_true` | XL | left | idle, walk, attack, death, transform | — | ✓ idle ×1, walk ×4, attack ×7, death ×4, transform ×5 |
| `enemy_ningyo` | S (120 px) | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×6, attack ×4, death ×4 |
| `enemy_mermaid_twolegs` | S | left | idle, walk, attack, death, spawn | — | ✓ idle ×1, walk ×5, attack ×4, death ×4, spawn ×7 |
| `enemy_yamanba` | L | left | idle, walk, attack, death | ability | ✓ idle ×1, walk ×6, attack ×4, death ×4, ability ×6 |
| `enemy_seiren` | XL (480 px) | left | idle, walk, attack, death | ability | ✓ idle ×1, walk ×6, attack ×7, death ×4, ability ×8 |
| `enemy_anoko` | XXL | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×4, attack ×8, death ×4 |
| `enemy_dekatsuyo` | XXL | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×8, attack ×8, death ×4 |
| `enemy_dekai_tori` | M (170 px) | left | idle, walk, attack, death | — | ✓ idle ×1, walk ×5, attack ×4, death ×4 |
| `rescue_rakko_car` | M (130 px) | right | idle | — | ✓ idle ×1 |
| `rescue_rakko_boat` | M (96 px) | right | idle | — | ✓ idle ×1 |

<details><summary>What each character is like</summary>

**ally_chiikawa** — ふだんはすわって草をさがしていて（weed_search）、ときどき草を見つけて、かかげる（weed_found：草は絵に描きこむ）。手に入った草は、その手から草の数へとんでいく。となりに生えた草は、自分でぬく。攻撃しない。 / Sits searching for 草 (weed_search), now and then finds some and holds it up (weed_found: the 草 is part of the picture), and it flies from her hand to the count. Pulls up weeds that sprout beside her too. Never attacks.

**ally_chiikawa_island** — ちいかわ（人魚の島）：オーナーの絵のとおり、ピンクの花かんむりと緑のこしみのをつけた、島すがたのちいかわ（原作8巻の表紙の姿）。手前の手に火のついたたいまつを持ち、前へつき出して炎をひとつ飛ばす（たいまつと炎は、このゲームでの動き）。炎はいちばん近い1体に強く当たり、燃えうつらない。 / ちいかわ（人魚の島）: as in the owner’s picture, Chiikawa in island dress, with a pink flower crown and a green grass skirt (as on the cover of manga volume 8). Holds a lit torch in the near hand and thrusts it forward to send one flame flying (the torch and the flame are this game’s own). The flame hits the nearest enemy hard; nothing catches fire.

**ally_hachiware** — さすまたで前3マスを突く。 / Jabs 3 tiles ahead with the さすまた.

**ally_hachiware_pajama** — ハチワレ（パジャマ）：オーナーの絵のとおり、ネコ耳のフードがついた水色のパジャマ（ポシェットの鎧さんのパジャマ）を着たハチワレ。手前の手にデッキブラシ（パジャマパーティーズの代わりにステージに立つことになったとき、うさぎがもってきたデッキブラシで大きな鳥に立ち向かった）。ブラシで前3マスまでの相手をつき、うしろへおし返す（おし返しは、このゲームでの動き）。 / ハチワレ（パジャマ）: as in the owner’s picture, Hachiware in pale-blue pajamas with a cat-eared hood (Pochette 鎧さん’s pajamas). Holds a deck brush in the near hand (standing in for the Pajama Parties, the trio faced the giant bird with the deck brushes Usagi brought). Pokes enemies up to 3 tiles ahead with the brush and pushes them back (the push is this game’s own).

**ally_yoroi** — 壁。攻撃しない。HPが減ると、絵が「へこみ（damaged1）」「ひび（damaged2）」に替わる。 / Wall. Never attacks. As HP drops, it swaps to its dented (damaged1) and cracked (damaged2) pictures.

**ally_yoroi_erai** — 偉い鎧さん：金色のよろいを着た、鎧さんたちの上司みたいな鎧さん。頭に王冠のようなかざり。ふつうの鎧さんと同じ背の高さで、ずっとじょうぶな壁（このゲームでの動き）。攻撃しない。HPが減ると、絵が「へこみ（damaged1）」「ひび（damaged2）」に替わる。 / 偉い鎧さん: a 鎧さん in gold armour, like a boss to the others, with a crown-like ornament on the head. As tall as the ordinary 鎧さん, and a far tougher wall (this game’s own). Never attacks. As HP drops, it swaps to its dented (damaged1) and cracked (damaged2) pictures.

**ally_usagi** — 討伐棒を振り下ろして、爆風を飛ばす（いちばん近い1体に当たる）。 / Swings the 討伐棒 down and sends a blast flying (it hits the nearest enemy).

**ally_usagi_cool** — うさぎ（クール）：オーナーの絵のとおり、黒いサングラスをかけたうさぎ（この見た目は、このゲームのオリジナル）。置かれたら、ポーズをきめたままじっとしていて、攻撃の動きはない。そのあいだ、相手のいるレーンに空からミサイルが落ちてきて、落ちたところのまわりの相手に当たる（このゲームでの動き。ミサイルは fx_missile、爆発は fx_boom）。 / うさぎ（クール）: as in the owner’s picture, Usagi in black sunglasses (this look is this game’s own). Once placed it just holds its pose, with no attack motion; meanwhile missiles fall from the sky on every lane with an enemy and hit the enemies round where they land (this game’s own; the missile is fx_missile, the blast fx_boom).

**ally_momonga** — 自分と左右のレーンにどんぐりを投げる。動かない。 / Throws acorns into its own and both neighbouring lanes. Never moves.

**ally_kurimanju** — 缶を山なりに投げる。壁を越え、落ちたところで3×3マスにしぶきが広がる（しぶきの絵：fx_can_splash）。 / Lobs a can over walls; it splashes over the 3×3 tiles where it lands (the splash: fx_can_splash).

**ally_shisa** — ゴーヤを投げて相手を遅くする。 / Throws ゴーヤ that slow the enemy.

**ally_ode** — 1回だけ使える。置いたレーンのはしから大男のオデが走ってきて、レーンを右はしまでかけぬけ、ぶつかった相手をみんな倒す（ラッコのくるまと同じ。このゲームでの動き）。走る（walk）の絵を使う：右向きに全力で走る。 / One use. The big man オデ comes running in from the base end of the lane and sprints all the way along it, knocking down every enemy he runs into (as Rakko’s car does; this game’s own). His run is his walk: sprinting to the right, flat out.

**ally_pajama_parties** — アイドルグループ。カードを使うと4人のうちのだれか1人がランダムで来る（オーナーの絵は1人ずつ：ally_pajama_parties_green・pink・purple・white）。攻撃しない。おどって歌うと（ability）、同じレーンのなかまの攻撃が速くなる。 / The idol group. Each time the card is used one of the four comes, at random (the owner’s frames are one member each: ally_pajama_parties_green, pink, purple and white). Never attacks: while dancing and singing (ability), friends in their lane attack faster.

**ally_furuhonya** — 古本屋（カニちゃん）。うすいピンク色の小さなちいかわ族で、丸い耳。モモンガにもらったカニのカチューシャ（上にカニが乗って、はさみを上げている）。本を2冊つづけて投げる（このゲームでの動き。本は fx_book）。 / 古本屋 (カニちゃん): a small pale-pink Chiikawa-folk with round ears, wearing the crab headband Momonga gave it (the crab sits on top, claws up). Throws books, two in a row (this game’s own; the book is fx_book).

**ally_futaba** — フタバ：島の子（映画『人魚の島のひみつ』）。いつもヒトハといっしょ。小さな木のボートに乗って、水のレーンにだけ置ける。貝がらを水切りのように投げ、貝がらはレーンの相手みんなをつきぬける。ヒトハがとなりにいると、投げるのが速くなる。 / フタバ: an islander from the film 『人魚の島のひみつ』, always with ヒトハ. Sits in a little wooden rowboat and goes only on the water lane. Skims seashells that go through every enemy in the lane, faster with ヒトハ beside it.

**ally_hitoha** — ヒトハ：島の子（映画『人魚の島のひみつ』）。いつもフタバといっしょ。小さな木のボートに乗って、水のレーンにだけ置ける。大きな巻き貝を投げて、いちばん近い1体に強く当てる。フタバがとなりにいると、投げるのが速くなる。 / ヒトハ: an islander from the film 『人魚の島のひみつ』, always with フタバ. Sits in a little wooden rowboat and goes only on the water lane. Throws a big spiral shell that hits the nearest enemy hard, faster with フタバ beside it.

**ally_rakko** — ラッコ：討伐ランキング1位の「先生」。オーナーのくるまとボートの絵のとおり、クリーム色のまるい顔（ふちはツンツンした毛）、横に小さな黒い耳、額に星形の傷あと、首に白いマフラー。体も同じクリーム色。手前の前足に剣を持つ（剣で討伐するのは原作どおり）。最前線に立って剣を前にふりはらい、自分のレーンと上下のレーンの、前の2マスにいる相手を斬る（上下のレーンまでとどくひとふりは、このゲームでの動き：ふり上げて、上から下へふりはらう）。 / Rakko, the top-ranked hunter Chiikawa and Hachiware call 先生: as in the owner’s car and boat pictures, a round cream face with a spiky furry edge, small black ears at the sides, a star-shaped scar on the forehead and a white muffler; the body the same cream. Holds his sword in his near paw (he hunts with a sword in the original). Stands at the front and sweeps it through his own lane and the lanes above and below, cutting every enemy within two tiles ahead of him in each (a swing that reaches the lanes either side is this game’s own: it swings up, then sweeps down).

**ally_shimajiro** — 島二郎：島の森の奥の食堂「島二郎」の店主（映画『人魚の島のひみつ』）。ちいかわたちよりずっと大きなおじさんで、たくましい体に口ひげ、腰にはエプロンだけ。貝汁の貝を自分で海に潜ってとるほど泳ぎが得意なので、ボートなしで水のレーンに入って壁になる（水のレーンにだけ置ける）。攻撃しない。HPが減ると、絵が「すり傷と冷や汗（damaged1）」「ばんそうこう（damaged2）」に替わる。 / 島二郎: the owner of 「島二郎」, the diner deep in the island’s forest (the film 『人魚の島のひみつ』). A big man next to Chiikawa and friends: brawny, with a moustache and nothing but an apron at his waist. He dives for the shellfish in his 貝汁, so he swims into the water lane with no boat and holds it as a wall (he goes only on the water lane). Never attacks. As HP drops, it swaps to its scraped-and-sweating (damaged1) and plastered (damaged2) pictures.

**ally_taiyaki** — わな（このゲームでの動き）。置くとまず焼きはじめる（cook：生から焼きあがりまでの段階の絵）。焼きあがると準備ができて（idle：きつね色のたい焼き）、さいしょにたどりついた相手のところで、あつあつのあんこがはじける（fx_taiyaki_pop）。焼けるまでは、相手にかじられる。 / A trap (this game’s own). Put down, it starts cooking (cook: its stages, raw to done); once cooked it is ready (idle: a golden-brown taiyaki), and the first enemy to reach it sets it off in a burst of piping-hot red-bean paste (fx_taiyaki_pop). Until it is cooked, enemies can bite it.

**ally_muchauman** — むちゃうマン：「むちゃうまヨーグルト」のヒーロー（ちいかわは大ファン）。1回だけ使える：置いたマスにあらわれて決めポーズ（ability：さいごのコマのまま止まる）をとると、フィールドの相手がみんなこおりつく。そのあと消える（このゲームでの動き）。 / むちゃうマン: the hero of むちゃうまヨーグルト (Chiikawa is a big fan). One use: he appears on the tile and strikes his pose (ability, its last frame held), and every enemy on the field freezes; then he is gone (this game’s own).

**enemy_mushi_twolegs** — 基本の相手。 / The basic enemy.

**enemy_goblin** — World 2 の相手。こん棒で殴る。通り道に生えている草を、足もとでかがんでひろう（ability：手がとどいたところで草が消える）。ちいかわより少し小さい。 / World 2. Hits with a club. Bends down at its feet to pick up 草 growing where it walks (ability: the 草 vanishes as its hand reaches it). A little shorter than Chiikawa.

**enemy_mushi_sixlegs** — 攻撃しない。行く手のなかまを、ぜんぶとびこえて進む（ability：その場でとぶ絵。前と上へは、ゲームが運ぶ）。 / Never attacks: it jumps over every friend in its way (ability: drawn jumping on the spot; the game carries it up and over).

**enemy_chushidesu** — 攻撃が2倍速い。なかまの1マス手前で、攻撃の1コマめのまま一瞬かまえてから、攻撃の動きでとびかかる（ふりかぶるあいだに前へ出る）。 / Attacks twice as fast, and pounces from a tile away on its attack frames: it holds its first attack frame for a moment, then moves in during the wind-up.

**enemy_fugu** — 跳ねて進み、ふくらんで3マス先へ吐く。 / Hops along, puffs up and spits from 3 tiles away.

**enemy_majyo** — とても速い（前かがみで走る、唯一の速い相手）。山姥と同じくらいの大きさ。 / Very fast: runs hunched over, the only fast enemy. As big as 山姥.

**enemy_kimera** — 地上を歩く。高HP。ピンクのキメラで、ちいかわと同じくらいの大きさ。はじめの姿：爪をかくしている（image/sprite/kimera/claws_retracted/ に、ほかと同じ名前で）。体力がのこり3割になると爪を出し、爪のある姿 enemy_kimera_claws になる。 / Walks on the ground. High HP. The pink chimera, as big as Chiikawa. Her first look, claws hidden (in image/sprite/kimera/claws_retracted/, named like the rest). At 30% HP she draws them out and takes her clawed form, enemy_kimera_claws.

**enemy_kimera_claws** — キメラの爪を出した姿（image/sprite/kimera/ の絵）。体力がのこり3割になると、その場で止まって1秒で爪を出し（ability：爪をかくした姿から始めて、さいごのコマで爪が出そろう）、そこからはこの姿で、歩くのもひっかくのも2倍速くなる（歩きの絵も速く回る）。 / The chimera with her claws out (the frames in image/sprite/kimera/). At 30% HP she stops where she stands and draws them out in 1 s (ability: starting with them hidden, out by the last frame), then stays like this, moving and clawing twice as fast (her walk frames play faster too).

**enemy_mushi_horned** — 硬い（固定ダメージ軽減）。攻撃も重い。 / Armoured (flat damage reduction). Hits hard.

**enemy_mushi_pink** — ボス：二本足の虫をうんと大きくしたような、ピンクの虫（このゲームのオリジナル。オーナーの絵）。虫たちのボスで、とくべつな技はなく、体力と一撃がとても大きい。 / Boss: a pink bug like the two-legged one, only far bigger (this game’s own, from the owner’s pictures). The boss of the bugs: no special move, just a great deal of HP and heavy blows.

**enemy_kuroi_nagareboshi** — ふわふわ浮かび、周りの相手を少し回復する。攻撃しない（回復の光は fx_heal_black）。ちいかわより少し小さい。 / Drifts along and heals nearby enemies a little. Never attacks (the healing pulse is fx_heal_black). A little smaller than Chiikawa.

**enemy_guchokipanogitaigata** — ボス。歩きながら歌い、同じレーンのなかまを3人まで動けなくする（歌の絵はいらない：音符はゲームが出す。止まったなかまは山姥の呪文にかかったのと同じ見た目）。動けないなかまへの一撃は2倍。 / Boss. It sings as it goes, and up to three friends in its lane are frozen (no singing frames needed: the game adds the notes, and the frozen friends look as 山姥’s spell leaves them). Its blows land twice as hard on a frozen friend.

**enemy_zou** — ボス級。体を持ち上げてふみつけ、一撃でなかまを倒す。 / Boss-class. Rears up and stomps, defeating an ally in one blow.

**enemy_chiikabu** — ボス。擬態中の小さな姿（攻撃されない）。 / Boss. The small disguised form (cannot be targeted).

**enemy_chiikabu_true** — ボス。真の姿。変身のコマ（transform）で、小さな姿から大きくなる。 / Boss. The true form. Its transform frames grow it out of the small form.

**enemy_ningyo** — 島の小さい人魚（ちいかわ族より小さい：島民が袋に入れて運べるくらい）。シンプルでかわいく。足がなく、しっぽで跳ねて進む。3匹ずつ来る（セイレーンに呼ばれて、その場に出てくることもある：出てくる絵はいらない）。色や頭の形は原作・映画で確認。 / A small island mermaid, smaller than the Chiikawa folk (an islander could carry one off in a bag): keep it simple and cute. No feet: it hops along on its tail. Comes in threes (and also comes up where it stands when セイレーン calls: no frames needed for that). Check its colours and head in the manga or the film.

**enemy_mermaid_twolegs** — 二本足の人魚（このゲームのオリジナル。オーナーの絵）：白いまるい頭に小さな赤いひれ、波のもようの赤いおわんのような体、細い二本の足。セイレーンに呼ばれて、地面からはい出してくる（spawn のコマ）。強さは二本足の虫と同じくらい。 / The two-legged mermaid (this game’s own, from the owner’s pictures): a round white head with a little red fin, a red bowl of a body with wave stripes, and two thin legs. Called up by セイレーン, it climbs out of the ground (its spawn frames). About as tough as the two-legged bug.

**enemy_yamanba** — 山姥（単行本7巻）。着物のおばあさんで、長い白髪をおろしている。マロングラッセの森でわなにかかったちいかわたちを助けて、手当てやごはんでもてなした（わなをしかけたところは描かれていない）。おそいが、HPが高い。手でつかみかかり、立ち止まって呪文をとなえる（ability のコマ）。 / The yamanba (volume 7): an old woman in a kimono, her long white hair worn loose, who freed Chiikawa and friends from traps in the マロングラッセの森 and looked after them (nothing shows she set the traps). Slow but tough. Grabs with her hands, and stops to chant a spell (her ability frames).

**enemy_seiren** — ボス（島編。映画『人魚の島のひみつ』）。まるくてかわいいのに不気味な、とても大きな怪物。頭は犬張子がモデル、下半身は金魚のように赤く、人魚のような尾びれ。しっぽで浮かんで進む（泳ぐあいだは歌わない）。ときどき止まって歌い（歌の絵：ability のコマ）、まわりに小さな手下を呼び出す（水のレーンには人魚、陸には二本足の人魚。呼び出すのはこのゲームでの動き）。セイレーンがいるあいだ、人魚たちはみんな速く進む。なかまの前に来ると前足でノックして攻撃する。怒ると目が真っ赤になる。 / Boss of the island arc (the film 『人魚の島のひみつ』). Huge and rounded, cute but eerie: the head modelled on a 犬張子, the lower body red like a goldfish, ending in a mermaid-like tail fin. Floats along on its tail (no singing as it swims). Now and then it stops to sing (its singing frames: ability) and calls up small followers round it: mermaids on the water lane, two-legged mermaids on land (the calling is this game’s own). While it is about, all mermaids move faster. In front of a friend it knocks with its forelegs. Its eyes turn bright red when it is angry.

**enemy_anoko** — 最後のボス。ちいかわとシール貼りの仕事をした「あのこ」が、キメラになった姿。ちいかわ族の何倍も大きく、白くてもふもふ。額に小さな黄色い角が1本、ほおと胸にふさふさの毛、黄色い長いつめ、下のほうはベージュ、ヘビか竜のような長いしっぽ。おっきい討伐では、このしっぽでハチワレをたおした。3レーンぶんの高さの巨大な相手で、まん中の3レーンをいっぺんに進み（足は手前のレーンに）、ひとふりで3レーンをなぎはらう。 / The final boss: あのこ, Chiikawa’s friend from the sticker job, become a chimera many times Chiikawa’s size. White and fluffy, with one small yellow horn on the forehead, fluffy cheeks and chest, long yellow claws, a beige lower body and a long snake- or dragon-like tail. On the big hunt that tail knocked Hachiware flat. A giant three lanes tall: it comes down the middle three lanes at once, its feet on the nearest, and sweeps all three as it strikes.

**enemy_dekatsuyo** — ボス。ちいかわ族よりずっと大きい。黄色いぼさぼさのたてがみに囲まれた大きな顔、黄色い体、黒く長い4本の足。モモンガを「返せッ」と追いかけていた。3レーンぶんの高さの巨大な相手で、まん中の3レーンをいっぺんに進み（足は手前のレーンに）、ひとふりで3レーンをなぎはらう。 / Boss, much bigger than the Chiikawa folk: a big face framed by a shaggy yellow mane, a yellow body, four long black legs. Chased Momonga crying 「返せッ」. A giant three lanes tall: it comes down the middle three lanes at once, its feet on the nearest, and sweeps all three as it strikes.

**enemy_dekai_tori** — ただ1羽の、空を飛ぶ相手。大きくて丸い白い鳥。いつも浮かんでいて、壁を飛びこえ、基地にいちばん近いなかまの上で止まると、つかんで連れ去る（かみつかない）。攻撃の動きが「つかむ」。パジャマパーティーズのメンバーをさらった鳥。 / The only flier: a big round white bird. Always in the air: it flies over walls, hovers over the friend nearest the base, then grabs it and carries it off (it never bites). Its attack motion is the grab. The bird that carried off members of パジャマパーティーズ.

**rescue_rakko_car** — ラッコのくるま1枚の絵（タイヤごと）。運転席にラッコ。右向き。各レーン1回だけ相手をまとめて倒してくれる。 / Rakko's car as one picture, wheels and all, with Rakko at the wheel, facing right. Clears its lane once.

**rescue_rakko_boat** — ラッコの小さなモーターボート1枚の絵。運転席にラッコ（肩から上が見える）、うしろに船外機。右向き。水面（喫水線）は足の高さで、そこに白い短い波の線を少し（ボートのまわりに水を少し描いてもよい）。水面より下は描かない。水のレーン（World 5 のいちばん下のレーン）には、くるまのかわりにこのボートで来て、同じように相手をまとめて倒してくれる。 / Rakko's little motorboat as one picture, with Rakko at the wheel (seen from the shoulders up) and an outboard motor on the stern, facing right. Its waterline is at the feet line, with a couple of short white ripple strokes along it (a little water around the boat is fine); nothing below the water. On a water lane (World 5's bottom lane) he comes by boat instead of the car, and clears the lane the same way.

</details>

## Stickers

Single pictures the game pops, spins, grows and fades. Deliver each at the size below, 2× the size the game
draws it on the field, so it stays sharp on tablets and laptops; phones show it at about half that size, so keep it
bold. Pickups and terrain stand on their feet, 24 px above the bottom edge in the middle; the rest are placed by
their centre. Projectiles fly right (the fugu’s spit flies left).

| ✔ | File | Size | What to draw |
|---|---|---|---|
| [x] | `art/stickers/fx_blast.png` | 180 × 180 | うさぎの爆風弾。右へ飛ぶ。<br>Usagi's blast shot, flying right. |
| [x] | `art/stickers/fx_acorn.png` | 100 × 100 | モモンガのどんぐり。<br>Momonga's acorn. |
| [x] | `art/stickers/fx_can.png` | 128 × 128 | 栗まんじゅうのカップ酒の缶（ゲームが回す）。<br>Kurimanju's cup-sake can (the game spins it). |
| [x] | `art/stickers/fx_goya.png` | 140 × 140 | シーサーのゴーヤ（ゲームが回す）。<br>Shisa's ゴーヤ (the game spins it). |
| [x] | `art/stickers/fx_shell.png` | 120 × 120 | フタバが水切りのように投げる貝がら（うすいピンクがかったクリーム色のホタテ貝）。右へ飛び、相手をつきぬける。<br>The seashell フタバ skims: a pale pink-cream scallop, flying right and through every enemy. |
| [x] | `art/stickers/fx_conch.png` | 128 × 128 | ヒトハが投げる大きな巻き貝（サザエのような、とげのある茶色い巻き貝。口はクリーム色。ゲームが回す）。<br>The big spiral shell ヒトハ throws: a knobbly brown turban shell like a サザエ, with a cream mouth (the game spins it). |
| [x] | `art/stickers/fx_book_1.png` | 120 × 120 | 古本屋が2冊つづけて投げる本（3種類の1つめ。投げるたびにこの中からばらばらに出る。ゲームが回す）。<br>A book 古本屋 throws, two at a time (1 of 3: each book thrown is one of them, picked at random; the game spins it). |
| [x] | `art/stickers/fx_book_2.png` | 120 × 120 | 古本屋が2冊つづけて投げる本（3種類の2つめ。投げるたびにこの中からばらばらに出る。ゲームが回す）。<br>A book 古本屋 throws, two at a time (2 of 3: each book thrown is one of them, picked at random; the game spins it). |
| [x] | `art/stickers/fx_book_3.png` | 120 × 120 | 古本屋が2冊つづけて投げる本（3種類の3つめ。投げるたびにこの中からばらばらに出る。ゲームが回す）。<br>A book 古本屋 throws, two at a time (3 of 3: each book thrown is one of them, picked at random; the game spins it). |
| [x] | `art/stickers/fx_flame.png` | 160 × 120 | ちいかわ（人魚の島）のたいまつから飛ぶ炎。右へ飛ぶ、ひとつの大きな火の玉（燃えうつらない）。<br>The flame from ちいかわ（人魚の島）’s torch: one big fireball flying right (nothing catches fire). |
| [x] | `art/stickers/fx_missile.png` | 120 × 220 | うさぎ（クール）のミサイル。空から先を下にして落ちてくる（ゲームが落とす）。<br>うさぎ（クール）’s missile, falling nose first out of the sky (the game drops it). |
| [x] | `art/stickers/fx_spit.png` | 100 × 100 | フグの吐き出し弾。左へ飛ぶ。<br>Fugu's spit, flying left. |
| [x] | `art/stickers/fx_hit_1.png` | 200 × 200 | 命中の火花（3種類の1つめ。当たるたびにこの中からばらばらに出る）。<br>Hit spark (1 of 3: each hit shows one of them, picked at random). |
| [x] | `art/stickers/fx_hit_2.png` | 200 × 200 | 命中の火花（3種類の2つめ。当たるたびにこの中からばらばらに出る）。<br>Hit spark (2 of 3: each hit shows one of them, picked at random). |
| [x] | `art/stickers/fx_hit_3.png` | 200 × 200 | 命中の火花（3種類の3つめ。当たるたびにこの中からばらばらに出る）。<br>Hit spark (3 of 3: each hit shows one of them, picked at random). |
| [x] | `art/stickers/fx_clink_1.png` | 200 × 200 | 硬い相手に弾かれた「カン」（3種類の1つめ。弾かれるたびにこの中からばらばらに出る）。<br>Deflected by armour, "カン" (1 of 3: each clink shows one of them, picked at random). |
| [x] | `art/stickers/fx_clink_2.png` | 200 × 200 | 硬い相手に弾かれた「カン」（3種類の2つめ。弾かれるたびにこの中からばらばらに出る）。<br>Deflected by armour, "カン" (2 of 3: each clink shows one of them, picked at random). |
| [x] | `art/stickers/fx_clink_3.png` | 200 × 200 | 硬い相手に弾かれた「カン」（3種類の3つめ。弾かれるたびにこの中からばらばらに出る）。<br>Deflected by armour, "カン" (3 of 3: each clink shows one of them, picked at random). |
| [x] | `art/stickers/fx_boom.png` | 340 × 340 | うさぎの爆発。うさぎ（クール）のミサイルが落ちたところにも出る。<br>Usagi's explosion, also where うさぎ（クール）'s missiles land. |
| [x] | `art/stickers/fx_taiyaki_pop.png` | 400 × 340 | たい焼きがはじけたところ：あつあつのあんこと湯気がはじける（ゲームがはじけさせる）。<br>The taiyaki going off: piping-hot red-bean paste and steam bursting out (the game bursts it). |
| [x] | `art/stickers/fx_splat.png` | 200 × 200 | 吐き出しが当たったしぶき。<br>Spit splash. |
| [x] | `art/stickers/fx_can_splash_1.png` | 200 × 200 | 栗まんじゅうの缶のしぶき（3種類の1つめ。出るたびにこの中からばらばらに出る）。缶が落ちたところと、しぶきが当たったほかの相手ひとりひとりの上に出る。相手が見えるように小さめに出す。<br>Kurimanju's can splash (1 of 3: each splash shows one of them, picked at random), where the can lands and over every other enemy it splashes. Drawn small, so the enemies stay in view. |
| [x] | `art/stickers/fx_can_splash_2.png` | 200 × 200 | 栗まんじゅうの缶のしぶき（3種類の2つめ。出るたびにこの中からばらばらに出る）。缶が落ちたところと、しぶきが当たったほかの相手ひとりひとりの上に出る。相手が見えるように小さめに出す。<br>Kurimanju's can splash (2 of 3: each splash shows one of them, picked at random), where the can lands and over every other enemy it splashes. Drawn small, so the enemies stay in view. |
| [x] | `art/stickers/fx_can_splash_3.png` | 200 × 200 | 栗まんじゅうの缶のしぶき（3種類の3つめ。出るたびにこの中からばらばらに出る）。缶が落ちたところと、しぶきが当たったほかの相手ひとりひとりの上に出る。相手が見えるように小さめに出す。<br>Kurimanju's can splash (3 of 3: each splash shows one of them, picked at random), where the can lands and over every other enemy it splashes. Drawn small, so the enemies stay in view. |
| [x] | `art/stickers/fx_heal.png` | 340 × 340 | 回復したしるし：「＋HP」と、下から立ちのぼる緑の光。回復したなかま（と、黒い星に回復された相手）ひとりひとりの上に一瞬だけ出る。光がすけているので白いふちは付けない。<br>The healed mark: “+HP” with green light rising. It shows for a moment over each one healed (friends, and the enemies the Black Star heals). Its light is see-through, so the game adds no white edge. |
| [x] | `art/stickers/fx_heal_1.png` | 340 × 340 | 回復の波紋（3コマの1つめ）。なかまが回復したところで 1→2→3 の順に出る。広がって消えていく絵なので、白いふちは付けない。<br>Healing pulse (frame 1 of 3), played 1→2→3 where friends are healed. It spreads and fades in its frames, so the game adds no white edge. |
| [x] | `art/stickers/fx_heal_2.png` | 340 × 340 | 回復の波紋（3コマの2つめ）。なかまが回復したところで 1→2→3 の順に出る。広がって消えていく絵なので、白いふちは付けない。<br>Healing pulse (frame 2 of 3), played 1→2→3 where friends are healed. It spreads and fades in its frames, so the game adds no white edge. |
| [x] | `art/stickers/fx_heal_3.png` | 340 × 340 | 回復の波紋（3コマの3つめ）。なかまが回復したところで 1→2→3 の順に出る。広がって消えていく絵なので、白いふちは付けない。<br>Healing pulse (frame 3 of 3), played 1→2→3 where friends are healed. It spreads and fades in its frames, so the game adds no white edge. |
| [ ] | `art/stickers/fx_heal_black_1.png` | 340 × 340 | 黒い星の回復の波紋（黒、3コマの1つめ）。黒い星がまわりの相手を回復するとき、1→2→3 の順に出る。白いふちは付けない。<br>The Black Star's healing pulse (black, frame 1 of 3), played 1→2→3 when it heals the enemies round it. No white edge. |
| [ ] | `art/stickers/fx_heal_black_2.png` | 340 × 340 | 黒い星の回復の波紋（黒、3コマの2つめ）。黒い星がまわりの相手を回復するとき、1→2→3 の順に出る。白いふちは付けない。<br>The Black Star's healing pulse (black, frame 2 of 3), played 1→2→3 when it heals the enemies round it. No white edge. |
| [ ] | `art/stickers/fx_heal_black_3.png` | 340 × 340 | 黒い星の回復の波紋（黒、3コマの3つめ）。黒い星がまわりの相手を回復するとき、1→2→3 の順に出る。白いふちは付けない。<br>The Black Star's healing pulse (black, frame 3 of 3), played 1→2→3 when it heals the enemies round it. No white edge. |
| [x] | `art/stickers/fx_spell.png` | 340 × 340 | 山姥の呪文と、ちいかぶの変身のときに出る光（ゲームがはじけさせる）。<br>A burst of light for 山姥's spell and ちいかぶ's transformation (the game bursts it). |
| [x] | `art/stickers/fx_freeze.png` | 240 × 240 | むちゃうマンのポーズでこおった相手ひとりひとりの上に一瞬出る、氷のきらめき。相手が見えるように小さめに出す。<br>A glint of ice that shows for a moment over each enemy むちゃうマン’s pose freezes, drawn small so the enemy stays in view. |
| [x] | `art/stickers/fx_note_1.png` | 100 × 100 | 歌の音符（5種類の1つめ。音符はこの中からばらばらに出る）。<br>A song note (1 of 5: each note that floats up is one of them, picked at random). |
| [x] | `art/stickers/fx_note_2.png` | 100 × 100 | 歌の音符（5種類の2つめ。音符はこの中からばらばらに出る）。<br>A song note (2 of 5: each note that floats up is one of them, picked at random). |
| [x] | `art/stickers/fx_note_3.png` | 100 × 100 | 歌の音符（5種類の3つめ。音符はこの中からばらばらに出る）。<br>A song note (3 of 5: each note that floats up is one of them, picked at random). |
| [x] | `art/stickers/fx_note_4.png` | 100 × 100 | 歌の音符（5種類の4つめ。音符はこの中からばらばらに出る）。<br>A song note (4 of 5: each note that floats up is one of them, picked at random). |
| [x] | `art/stickers/fx_note_5.png` | 100 × 100 | 歌の音符（5種類の5つめ。音符はこの中からばらばらに出る）。<br>A song note (5 of 5: each note that floats up is one of them, picked at random). |
| [x] | `art/stickers/fx_sweep.png` | 420 × 1080 | ラッコの剣のひとふり：右にふくらんだ三日月形の斬撃。ゲームが、剣の先から間合いの端まで飛ばし、斬るレーンの高さまでのばして、キャラクターの下に出す。<br>Rakko’s sword sweep: a crescent slash bulging to the right. The game sends it from the sword to the end of the reach, as tall as the lanes it cuts, under the characters. |
| [x] | `art/stickers/fx_thrust.png` | 1160 × 240 | さすまたのひと突き：右へ向かって細くとがる突きの線。ゲームが、間合いの端までのばして、キャラクターの下に出す。<br>A thrust of the さすまた: a long, slim stab coming to a point on the right. The game runs it out to the end of the reach, under the characters. |
| [x] | `art/stickers/fx_dust.png` | 480 × 240 | ふみつけの土ぼこり（ゲームがはじけさせる）。<br>Stomp dust (the game bursts it). |
| [x] | `art/stickers/fx_trail.png` | 480 × 240 | ラッコの車とボートが走るときに、うしろにのびる土ぼこり・けむり。右はしが車のうしろで、左へいくほど小さくなる（車とボートだけに使う）。<br>The dust and smoke trailing behind Rakko's car and boat as they drive: its right end is at the back of the car, the puffs getting smaller to the left (used for the car and the boat only). |
| [x] | `art/stickers/fx_place.png` | 340 × 160 | 置いたときの足元のきらきら。<br>Sparkles at the feet when placed. |
| [x] | `art/stickers/pickup_weed.png` | 240 × 240 | 草のアイコン。草の数と、カードやなかまのコストに出る。集めた草はこの絵になって草の数へ飛んでいく。<br>The 草 icon: shown by the 草 count and every cost. A collected weed flies to the count as this picture. |
| [x] | `art/stickers/pickup_drop.png` | 240 × 240 | 戦場に生えてくる草（タップで集める）。ちいかわが見つけた草もこの絵で出てきて、自動で集まる。生える・ゆれる・抜ける・しおれるはゲームが動かす。<br>The weed that grows on the field (tap to collect). The weeds ちいかわ finds come up as this picture too, and collect themselves. The game makes it sprout, wobble, pop out and wilt. |
| [x] | `art/stickers/terrain_stump_1.png` | 340 × 340 | 切り株（3段階の1つめ：無傷）。このマスには置けない。まっすぐ飛ぶものはここで止まって、切り株を傷つける（山なりの缶とミサイルは越える）。こわれるとマスがあく。<br>Stump (1 of 3: whole). Nothing can be placed on this tile. Whatever flies straight along the lane stops at it and hurts it (a lobbed can and a missile go over). When it breaks the tile is free. |
| [x] | `art/stickers/terrain_stump_2.png` | 340 × 340 | 切り株（3段階の2つめ：ひびが入った）。このマスには置けない。まっすぐ飛ぶものはここで止まって、切り株を傷つける（山なりの缶とミサイルは越える）。こわれるとマスがあく。<br>Stump (2 of 3: cracked). Nothing can be placed on this tile. Whatever flies straight along the lane stops at it and hurts it (a lobbed can and a missile go over). When it breaks the tile is free. |
| [x] | `art/stickers/terrain_stump_3.png` | 340 × 340 | 切り株（3段階の3つめ：大きく割れた）。このマスには置けない。まっすぐ飛ぶものはここで止まって、切り株を傷つける（山なりの缶とミサイルは越える）。こわれるとマスがあく。<br>Stump (3 of 3: split). Nothing can be placed on this tile. Whatever flies straight along the lane stops at it and hurts it (a lobbed can and a missile go over). When it breaks the tile is free. |
| [x] | `art/stickers/terrain_bush.png` | 340 × 340 | 茂み。このマスには置けない。中に入った相手はこの絵のうしろに隠れて、ねらわれない。<br>Bush. Nothing can be placed on this tile. An enemy walking into it hides behind this picture and cannot be aimed at. |

## Faces and logos

| ✔ | File | Size | Use |
|---|---|---|---|
| [x] | `art/portraits/portrait_chiikawa.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_chiikawa_island.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_hachiware.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_hachiware_pajama.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_yoroi.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_yoroi_erai.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_usagi.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_usagi_cool.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_momonga.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_kurimanju.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_shisa.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_ode.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_pajama_parties.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_futaba.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_hitoha.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_shimajiro.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_taiyaki.png` | 256 × 256 | The たい焼き card’s picture, for the card and the gallery: a plain golden-brown taiyaki hanging in mid-air like a swimming fish (a face is optional). Transparent background. |
| [x] | `art/portraits/portrait_muchauman.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_hoshi.png` | 256 × 256 | The 星 card’s picture, for the card and the gallery: a plump glowing five-pointed star with a little face and a few sparkles about it, bright and warm so it is told apart from the 黒い星 at a glance. Transparent background. |
| [x] | `art/portraits/portrait_rakko.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_mushi_twolegs.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_goblin.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_mushi_sixlegs.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_chushidesu.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_fugu.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_majyo.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_kimera.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_mushi_horned.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_mushi_pink.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_mermaid_twolegs.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_kuroi_nagareboshi.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_guchokipanogitaigata.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_zou.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_chiikabu.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_ningyo.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_yamanba.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_seiren.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_dekai_tori.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_anoko.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_dekatsuyo.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_yoroi_rodo.png` | 256 × 256 | Face close-up for the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_yoroi_pochette.png` | 256 × 256 | Face close-up for the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_yoroi_ramen.png` | 256 × 256 | Face close-up for the gallery and dialogue. Transparent background. |
| [x] | `art/portraits/portrait_furuhonya.png` | 256 × 256 | Face close-up for picking the team, the gallery and dialogue. Transparent background. |
| [x] | `art/ui/logo_ja.png` | 775 × 360 | ゲームのタイトル「ちいかわ 討伐ディフェンス」。ロビーの左上に出る（英語のときもこの日本語のロゴ）。白いふちはゲームが付ける。透明背景。 / The game’s title, 「ちいかわ 討伐ディフェンス」, shown at the top left of the lobby (in English too: there is only the Japanese logo). The game adds a white cut-out edge. Transparent background. |

## Button icons

The battle’s three buttons (send home, speed, pause) are game icons: one square picture each, which the game shows as drawn
on a round coloured face. They show at about 30 px: keep them bold and simple, with no text. Save them straight
into `art/ui/`.

| ✔ | File | Size | What to draw |
|---|---|---|---|
| [x] | `art/ui/icon_send_home.png` | 360 × 360 | バトルの「帰ってもらう」ボタンの絵（なかまにフィールドから帰ってもらう道具）。小さく出るので、太くはっきり。正方形、透明背景、文字なし。<br>The battle's send-home button (a friend leaves the field and goes home). Shown small, so bold and simple. Square, transparent background, no text. |
| [x] | `art/ui/icon_speed.png` | 360 × 360 | バトルの「はやおくり」ボタンの絵（2倍速）。小さく出るので、太くはっきり。正方形、透明背景、文字なし。<br>The battle's fast-forward button (2× speed). Shown small, so bold and simple. Square, transparent background, no text. |
| [x] | `art/ui/icon_speed_active.png` | 360 × 360 | バトルの「はやおくり」ボタンが入っているとき（2倍速中）の絵。「×2」を絵に描きこんでよい。正方形、透明背景。<br>The battle's fast-forward button while 2× speed is on. It may carry its own “×2”. Square, transparent background. |
| [x] | `art/ui/icon_pause.png` | 360 × 360 | バトルの「一時停止」ボタンの絵。小さく出るので、太くはっきり。正方形、透明背景、文字なし。<br>The battle's pause button. Shown small, so bold and simple. Square, transparent background, no text. |

## Button pictures

Buttons drawn whole, lettering and all (the same pictures in English). The back button shows as drawn; the lobby’s four
are cut out by the game as stickers (white edge and shadow) and float over the counter, each in its own shape. Bring one
in with `npm run art:picture -- <file> --as <key>`, which scales it down to the size below.

| ✔ | File | Size | What to draw |
|---|---|---|---|
| [x] | `art/ui/back.png` | 600 × 200 | 「← もどる」ボタン。すべての画面のもどるボタンになる（英語のときも同じ絵）。横3：縦1くらいのクリーム色の札、こげ茶のふち、透明背景。<br>The 「← もどる」 button, used for every back button (the same picture in English). A cream tag about 3 wide by 1 tall with a dark-brown outline, transparent background. |
| [x] | `art/ui/button_play.png` | 556 × 600 | ロビーの「あそぶ」ボタン：ピンクの丸に、クエストの紙とさすまた。下に「あそぶ」の札。透明背景（白いふちと影はゲームが付ける）。<br>The lobby’s Play button: a quest paper and a さすまた on a pink circle, with an 「あそぶ」 name plate below. Transparent background (the game adds the white edge and shadow). |
| [x] | `art/ui/button_book.png` | 475 × 600 | ロビーの「図鑑」ボタン：本。下に「図鑑」の札。透明背景。<br>The lobby’s Gallery button: a book, with a 「図鑑」 name plate below. Transparent background. |
| [x] | `art/ui/button_shop.png` | 436 × 600 | ロビーの「お店」ボタン：くまの顔のピンクのポーチ（輪っかの持ち手つき）。下に「お店」の札。透明背景。<br>The lobby’s Shop button: a pink bear-face pouch with a ring handle, with an 「お店」 name plate below. Transparent background. |
| [x] | `art/ui/button_settings.png` | 476 × 600 | ロビーの「設定」ボタン：歯車。下に「設定」の札。透明背景。<br>The lobby’s Settings button: a gear, with a 「設定」 name plate below. Transparent background. |

## Shop goods

Each seller’s price list shows its goods as stickers: one square picture per item, with no text (the game cuts it out
with a white edge and writes the name and the price beside it). Save them straight into `art/shop/`.

| ✔ | File | Size | What to draw |
|---|---|---|---|
| [x] | `art/shop/item_slot.png` | 360 × 360 | ポシェット屋の「ポシェット拡張」（3つとも同じ絵）：ポシェット（鎧さんが下げている、くまの顔のピンクのポシェットなど）。正方形、透明背景、文字なし。<br>The Pochette Shop’s “Bigger pochette” (all three use it): a pochette (the pink bear-face one the 鎧さん wears, say). Square, transparent background, no text. |
| [x] | `art/shop/item_ramen.png` | 360 × 360 | ラーメン屋「郎」の「ラーメン券」（2つとも同じ絵）：ラーメンの食券。横長でもよい（正方形のわくの中に、形のまま収める）。透明背景。<br>Ramen Shop 郎’s “Ramen ticket” (both use it): a ramen meal ticket. May be wide (it is fitted into the square spot as drawn). Transparent background. |
| [x] | `art/shop/item_buta.png` | 360 × 360 | ラーメン屋「郎」の「ぶた入りラーメン券」の絵：ぶた（チャーシュー）が乗ったラーメンの食券。「ラーメン券」と見分けがつくように。横長でもよい。透明背景。ジョブの依頼書でも使う。<br>Ramen Shop 郎’s “Pork ramen ticket”: a meal ticket for ramen topped with pork, told apart from the plain “Ramen ticket” at a glance. May be wide. Transparent background. Also shown on the job notice. |
| [x] | `art/shop/item_shisa.png` | 360 × 360 | なかま屋の「シーサー」の絵：シーサーの顔に、まだなかまでないしるしの錠前。なかまになると「なかま入り」のはんこが押される。正方形、透明背景。<br>The friend shop’s “Shisa”: her face with a padlock, as she has not joined yet. Once she joins, a 「なかま入り」 stamp goes on her line. Square, transparent background. |
| [x] | `art/shop/item_hoshi.png` | 360 × 360 | なかま屋の「星」の絵：光る星に錠前。正方形、透明背景。<br>The friend shop’s “Star”: the glowing star with a padlock. Square, transparent background. |

## Props

Things the game shows for a moment. The hand stamp presses each red stamp the first time it is earned (a world
cleared, the pochette sold out, a gallery entry filled in), then lifts away. Bring it in with
`npm run art:picture -- <file> --as ui/hand_stamp`.

| ✔ | File | Size | What to draw |
|---|---|---|---|
| [x] | `art/ui/hand_stamp.png` | 540 × 566 | 判子（ハンコ）を真上から見た絵：持ち手と、下のふちに見える赤いインク。赤いスタンプが手に入った瞬間に、紙の上に押される（文字は入れない）。透明背景。<br>A hand stamp (判子) seen from straight above: its handle, with the red ink showing at the bottom rim. It presses a red stamp onto the paper the moment one is earned (no text). Transparent background. |
| [x] | `art/ui/report_yoroi_bow.png` | 671 × 768 | 討伐報告のとなりに立つ労働の鎧さん（討伐成功）：胸に手を当てておじぎ。腰から上だけの絵で、腰の線は画面の下にかくれます。背景は透明。<br>Labour 鎧さん beside the job report when a job is done: a hand on his heart, thanking the player. From the waist up (the waist goes below the bottom of the screen). Transparent background. |
| [x] | `art/ui/report_yoroi_concerned.png` | 671 × 768 | 討伐報告のとなりに立つ労働の鎧さん（討伐失敗）：頭をかいて心配そう。腰から上だけの絵で、腰の線は画面の下にかくれます。背景は透明。ゲームが左右反転して使います。<br>Labour 鎧さん beside the report when a job has failed: scratching his head, concerned. From the waist up (the waist goes below the bottom of the screen). Transparent background. The game mirrors it. |

## Quest board pictures

The quest board (the `quests` scene) pins one notice paper per world, then the 討伐ランキング paper (endless mode). The
game writes the number, the names and the buttons on the blank paper and puts the picture in the middle: the world’s,
or Rakko’s on the last paper (it shows his face as a sticker until that is drawn). Sizes are the most the game needs;
bigger pictures are scaled down by `npm run art:quests` (number the ranking picture 07-, or put "ranking" in its name).

| ✔ | File | Size | What to draw |
|---|---|---|---|
| [x] | `art/quests/paper.png` | 900 × 972 | クエストの紙（白紙）。上のまんなかにピン、下のふちは破れた紙。文字と絵はゲームが入れる。透明背景。<br>The blank quest paper: a pin at the top centre, a torn bottom edge. The game writes the text and puts the picture on it. Transparent background. |
| [x] | `art/quests/world1.png` | 1120 × 620 | World 1 のクエストの絵：ハチワレの洞窟。ふちは雲のような丸い形、外は透明。<br>World 1's quest picture: Hachiware's cave. A soft cloud-shaped frame, transparent outside it. |
| [x] | `art/quests/world2.png` | 1120 × 620 | World 2 のクエストの絵：森の出口。ふちは雲のような丸い形、外は透明。<br>World 2's quest picture: the forest exit. A soft cloud-shaped frame, transparent outside it. |
| [x] | `art/quests/world3.png` | 1120 × 620 | World 3 のクエストの絵：ラーメン屋「郎」。ふちは雲のような丸い形、外は透明。<br>World 3's quest picture: ラーメン屋「郎」. A soft cloud-shaped frame, transparent outside it. |
| [x] | `art/quests/world4.png` | 1120 × 620 | World 4 のクエストの絵：夜のちいかわの家。ふちは雲のような丸い形、外は透明。<br>World 4's quest picture: Chiikawa's home at night. A soft cloud-shaped frame, transparent outside it. |
| [x] | `art/quests/world5.png` | 1120 × 620 | World 5 のクエストの絵：浜辺の洞窟。ふちは雲のような丸い形、外は透明。<br>World 5's quest picture: the beach cave. A soft cloud-shaped frame, transparent outside it. |
| [x] | `art/quests/world6.png` | 1120 × 620 | World 6 のクエストの絵：おっきい討伐の着地したところ。ふちは雲のような丸い形、外は透明。<br>World 6's quest picture: the landing spot of the big hunt. A soft cloud-shaped frame, transparent outside it. |
| [x] | `art/quests/ranking.png` | 1120 × 620 | 最後の紙「討伐ランキング」（エンドレス）の絵：ランキング1位のラッコと、ラッコのくるま。狩りから帰ってきたように堂々と立つ（ラッコとくるまの見た目は原作で確認）。夕方の空や、遠くの地平線にならぶ討伐対象のかげを入れると「終わらない」感じが出る（なくてもよい）。文字は入れない（「1位」のスタンプと「1. ラッコ · 測定不能」はゲームが入れる）。ふちは雲のような丸い形、外は透明。<br>The last paper’s picture, the 討伐ランキング (endless mode): Rakko, #1 of the ranking, with his car, standing proud as if just back from a hunt (check the episodes for how he and the car look). An evening sky, or a faint line of monster shadows far off on the horizon, gives the “never ends” feel (optional). No text: the game adds the 「1位」 stamp and writes 「1. ラッコ · 測定不能」. A soft cloud-shaped frame, transparent outside it. |
| [x] | `art/quests/stamp_soon.png` | 900 × 371 | 赤い「準備中」のスタンプ。まだ開いていないクエストの紙の上に押す。透明背景。<br>The red 「準備中」 stamp, pressed over the quest papers that are not open yet. Transparent background. |

## Gallery book

The gallery is the open book on 古本屋’s table (the scene `book` is the table, the wall and 古本屋). The game lays the
book on the right of the screen and adds the tabs, the list and the entries, so its pages stay blank. Bring it in with
`npm run art:picture -- <file> --as gallery/book`.

The right page shows each character on one stage at one scale, true to its size on the field; the art kit does the
same. The two giants are too big for the page: their heads and fronts stay in view and the rest runs off the page’s
edge. A person’s standing picture
(`art/sprites/people_<id>/idle_1.png`) stands as tall as the fighter they are as big as: the three 鎧さん as tall as
the 鎧さん who fights.

| ✔ | File | Size | What to draw |
|---|---|---|---|
| [x] | `art/gallery/book.png` | 1460 × 1040 | 図鑑の本（開いた本、ページは白紙）。正面から、左右のページが同じくらい。文字やしおりはゲームが入れる。透明背景。<br>The gallery book, open, its pages blank: seen straight on, the two pages about the same. The game adds the tabs and writes the pages. Transparent background. |

## Sounds (optional)

Each sound is synthesised until a file exists. Use `.ogg`, `.mp3`, `.m4a` or `.wav`, named by id, in `art/audio/`.

| ✔ | id | Use |
|---|---|---|
| [ ] | `sfx_tap` | ボタン / Any button |
| [ ] | `sfx_card` | カードを選ぶ / Pick a card |
| [ ] | `sfx_cancel` | 選択解除 / Cancel a selection |
| [ ] | `sfx_place` | なかまを置く / Place an ally |
| [ ] | `sfx_send_home` | なかまに帰ってもらう / A friend goes home |
| [ ] | `sfx_sprout` | 草が生える / A weed sprouts |
| [ ] | `sfx_pull` | 草を抜く / Pull a weed |
| [ ] | `sfx_jab` | さすまたの突き / さすまた jab |
| [ ] | `sfx_blast` | うさぎの爆風 / Usagi's blast |
| [ ] | `sfx_throw` | 投げる / Throw |
| [ ] | `sfx_hit` | 命中 / Hit |
| [ ] | `sfx_clink` | 硬い相手に弾かれる / Armour clink |
| [ ] | `sfx_bite` | 相手の攻撃 / Enemy attack |
| [ ] | `sfx_spit` | フグの吐き出し / Fugu spit |
| [ ] | `sfx_splash` | 缶のしぶき / A can splashes |
| [ ] | `sfx_stomp` | ゾウのふみつけ / Zou stomp |
| [ ] | `sfx_collapse_ally` | なかまが倒れる / An ally collapses |
| [ ] | `sfx_collapse_enemy` | 相手が倒れる / An enemy collapses |
| [ ] | `sfx_song` | 歌 / Song |
| [ ] | `sfx_heal` | 回復 / Heal pulse |
| [ ] | `sfx_claws` | キメラが爪を出す / The chimera draws her claws |
| [ ] | `sfx_transform` | ちいかぶの変身 / Chiikabu transforms |
| [ ] | `sfx_car` | ラッコのくるま / Rakko's car |
| [ ] | `sfx_wave` | 大群の合図 / Big-wave horn |
| [ ] | `sfx_boss` | ボス登場 / Boss intro |
| [ ] | `sfx_win` | 討伐完了 / Level cleared |
| [ ] | `sfx_lose` | 討伐失敗 / Level failed |
| [ ] | `sfx_unlock` | 新しいなかま / New card unlocked |
| [ ] | `sfx_coin` | お金 / Money |
| [ ] | `sfx_stamp` | ハンコを押す / A stamp pressed |
| [ ] | `bgm_title` | タイトル / Title |
| [ ] | `bgm_map` | マップ・お店・図鑑 / Map, shop, gallery |
| [ ] | `bgm_world1` | 野原の討伐 / Meadow battles |
| [ ] | `bgm_world2` | 森の討伐 / Forest battles |
| [ ] | `bgm_world3` | 街の討伐 / Town battles |
| [ ] | `bgm_world4` | 夜の討伐 / Night battles |
| [ ] | `bgm_world5` | 島の討伐 / Island battles |
| [ ] | `bgm_world6` | おっきい討伐 / The Big Hunt |
| [ ] | `bgm_boss` | ボス戦 / Boss waves |

## Not needed as pictures

Buttons (the lobby’s floating buttons too), paper panels, cards, the wave and boss bars, banners and icons are drawn by the
game, so they need no art. The PWA icons in `public/icons/` are made from `art/portraits/portrait_rakko.png`; to change them, replace those files directly.

## Totals

| Item | Count |
|---|---|
| Scenes | 12 (19 pieces, plus 3 idle-loop frames) |
| Characters | 47 of 47 delivered as frames (the fighters, パジャマパーティーズ one member at a time, and Rakko’s car and boat) |
| Stickers | 49 |
| Faces and logos | 45 |
| Button icons | 4 |
| Button pictures | 5 |
| Shop goods | 5 |
| Props | 3 |
| Gallery book | 1 |
| Quest board pictures | 9 |
| Sounds | 39 |

Suggested order: the World 1 battle scene → ちいかわ, ハチワレ, 鎧さん → 虫（二足）, 虫（六足） → the stickers they use →
the rest of the World 1 cast → bosses → Worlds 2–3 → the remaining menu scenes.
