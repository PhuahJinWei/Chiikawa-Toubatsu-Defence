// Battle worlds: the backdrop of each battle, one flat 3360 × 1500 picture per world. The 5 × 9 field (1530 × 850)
// sits at x 900–2430, y 360–1210 of the picture; one field pixel is one picture pixel. The game draws the picture whole,
// with no white edge of its own, and lays the lane grid over the field. Right of the field, x 2430–3360 is
// the road the enemies come along: before a battle they wait there and the camera glides over to look at them;
// in battle it only shows on very wide screens. Left of x 300 is only ever seen under the card column and beside it, on
// narrow and notched phones. A picture narrower than planned is missing width on the left: the game measures the field
// from the picture's right edge and stretches its left edge outward.

import type { SceneSpec, Text } from '../types';
import { back } from './common';

export const WORLD_W = 3360;
export const WORLD_H = 1500;
/** Where the field's top-left corner sits in a world picture. */
export const WORLD_FIELD = { x: 900, y: 360 };

const NOTE = {
  ja: 'の戦場の背景（3360×1500の1枚の絵。パーツに分けず、全部を1枚に描く。白いふちはつかない）。x 900〜2430・y 360〜1210 が5×9マスの戦場：大きな物は置かず、平らな地面に（マス目はゲームが重ねる）。その左のx 730〜900はラッコのくるまが止まる地面。左に守る場所：カードの列がx 400ほどまでかかるので、入口や顔はx 400より右に（x 0〜300は、カードの下やそのわきに少し見えるだけなので、かんたんな続きの絵でよい）。右のx 2430〜3360は相手が来る道：戦いの前に相手がここ（y 360〜1210）に並んで待つので、歩ける地面のままにする。上は空、下は手前の地面で、どちらも画面の形によって少し見える。',
  en: ' battle backdrop: one flat 3360 × 1500 picture, everything painted together, not in pieces (it gets no white edge). x 900–2430, y 360–1210 is the 5 × 9 field: keep it flat ground with nothing big on it (the game lays the grid over it). Just left of it, x 730–900 is plain ground where Rakko’s cars park. The protected place stands at the left: the card column covers up to about x 400 of it, so keep a doorway or face right of x 400 (x 0–300 only shows a little, under the cards and beside them, so a simple continuation of the picture is enough). On the right, x 2430–3360 is the road the enemies come along: before a battle they line up there (y 360–1210) to be looked at, so keep it open ground. The sky above and the near ground below show a little, depending on the screen.',
};

/** What a world asks beyond its picture: `more` adds to the note, `closedLane` is what covers the field's closed lanes,
 *  `paintedWater` says the picture has the world's water lanes painted in, `fieldLine` is the colour of the stitched lines
 *  between its tiles, and `forLanes` makes it a second picture of the world, for the jobs with only those lanes open (`name`
 *  ends its id). */
interface WorldExtras {
  more?: Text;
  closedLane?: string;
  paintedWater?: boolean;
  fieldLine?: string;
  forLanes?: { name: string; open: number[] };
}

/** The tile lines on a dark ground: cream, where dark ink would not show. */
const LINE_ON_DARK = 'rgba(255, 250, 235, 0.26)';

/** A battle world. `drawn` says what its picture shows, `backdrop` is the colour of the picture's top edge (it shows above the
 *  stretched edge on the squarest screens). */
function world(n: number, ja: string, en: string, backdrop: string, drawn: Text, { more, closedLane, paintedWater, fieldLine, forLanes }: WorldExtras = {}): SceneSpec {
  return {
    id: forLanes ? `world${n}_${forLanes.name}` : `world${n}`,
    kind: 'world',
    w: WORLD_W,
    h: WORLD_H,
    safe: { x0: WORLD_FIELD.x, y0: WORLD_FIELD.y, x1: WORLD_FIELD.x + 1530, y1: WORLD_FIELD.y + 850 },
    anchor: { x: 0.5, y: 0.5 },
    field: WORLD_FIELD,
    backdrop,
    closedLane,
    paintedWater,
    fieldLine,
    forLanes: forLanes && { world: n, open: forLanes.open },
    note: { ja: `${ja}${NOTE.ja}${more?.ja ?? ''}`, en: `${en}${NOTE.en}${more ? ` ${more.en}` : ''}` },
    layers: [back('picture', WORLD_W, WORLD_H, 1, drawn.ja, drawn.en)],
    slots: [],
    effects: [],
  };
}

export const WORLD_SCENES: SceneSpec[] = [
  // Closed lanes (the first jobs) are the same sand as the road in the delivered picture.
  world(
    1,
    'World 1 野原（ハチワレの洞窟）',
    'World 1, the meadow (Hachiware’s cave):',
    '#B2E6FC',
    {
      ja: '空と雲。地平線の丘。野原の地面（戦場もこの上）。相手が来る右の小道（戦いの前に相手がここで待つ）。守る場所：ハチワレの洞窟（入口は右＝戦場向き）。手前の草と花（下のふち）。',
      en: 'Sky and clouds; hills on the horizon; the meadow ground (the field lies on it); the path on the right the enemies come along (they wait on it before a battle); the protected place, Hachiware’s cave, its mouth facing right toward the field; grass and flowers along the bottom edge.',
    },
    { closedLane: '#F5E8D9' },
  ),
  // The first jobs have their own pictures, the same meadow with grass only on their open lanes (the owner's; the lanes open
  // once, in World 1). A closed lane is bare ground running on into the road, painted in, so nothing covers it.
  world(
    1,
    'World 1 野原、レーン1本のジョブ（1-1）',
    'World 1, the meadow, for the job with one open lane (1-1):',
    '#B2E6FC',
    {
      ja: 'World 1 の絵と同じ野原で、草があるのは開いているレーン（y 700〜870）だけ。閉じたレーンは砂地で、そのまま右の小道につづく。',
      en: 'The same meadow as World 1’s picture, with grass only on the open lane (y 700–870). The closed lanes are bare ground, the same sand as the road they run on into.',
    },
    { closedLane: 'transparent', forLanes: { name: 'one_lane', open: [2] } },
  ),
  world(
    1,
    'World 1 野原、レーン3本のジョブ（1-2、1-3）',
    'World 1, the meadow, for the jobs with three open lanes (1-2, 1-3):',
    '#B2E6FC',
    {
      ja: 'World 1 の絵と同じ野原で、草があるのは開いているレーン（y 530〜1040）だけ。閉じたレーンは砂地で、そのまま右の小道につづく。',
      en: 'The same meadow as World 1’s picture, with grass only on the open lanes (y 530–1040). The closed lanes are bare ground, the same sand as the road they run on into.',
    },
    { closedLane: 'transparent', forLanes: { name: 'three_lanes', open: [1, 2, 3] } },
  ),
  world(2, 'World 2 森（森の出口）', 'World 2, the forest (the forest exit):', '#C5EDF7', {
    ja: '木もれ日の空。奥の木々。森の地面（戦場もこの上）。相手が出てくる右の茂みと小道（木は右はしと上下に寄せ、まん中は相手が待つ地面）。守る場所：森の出口（木々のあいだが明るい）。手前の草と木の根（下のふち）。',
    en: 'Sky through the canopy; trees in the distance; the forest floor (the field lies on it); the thicket on the right the enemies come out of, with a path through it (trees along the far edge and the top and bottom; the middle is open ground where they wait); the protected place, the forest exit, bright between the trees; grass and roots along the bottom edge.',
  }),
  world(3, 'World 3 街（ラーメン屋「郎」）', 'World 3, the town (ラーメン屋「郎」):', '#C6E8FD', {
    ja: '夕方の空。奥の街並み。石だたみの通り（戦場もこの上）。相手が来る右の路地（戦いの前に相手がここで待つ）。守る場所：ラーメン屋「郎」の店先（のれんは右＝戦場向き）。手前の石だたみと植木鉢（下のふち）。',
    en: 'Evening sky; the town in the distance; the paved street (the field lies on it); the side street on the right the enemies come down (they wait in it before a battle); the protected place, the front of ラーメン屋「郎」, its noren facing right toward the field; paving stones and flowerpots along the bottom edge.',
  }),
  // Night: no 草 sprouts here (only ちいかわ makes it). The home follows the owner's World 4 quest picture: a white
  // dome with a lit window, a round-topped door and a face plate, neighbours' domes and blue bushes under the stars.
  world(4, 'World 4 夜（ちいかわの家）', 'World 4, night (Chiikawa’s home):', '#313B48', {
    ja: '星の夜空。地平線の青い茂みと、遠くのとなりの家（丸い屋根、窓に明かり）。夜の草地（戦場もこの上）。相手が来る右の暗い夜道（戦いの前に相手がここで待つ）。守る場所：ちいかわの家（白い丸い家、窓に明かり。入口は右＝戦場向き）。手前の夜の草（下のふち）。',
    en: 'The night sky with stars; blue bushes on the horizon, with the neighbours’ dome homes far off (lit windows); the grass at night (the field lies on it); the dark path on the right the enemies come along (they wait on it before a battle); the protected place, Chiikawa’s home (the white dome, its window lit), the door facing right toward the field; grass at night along the bottom edge.',
  }, { fieldLine: LINE_ON_DARK }),
  // The owner's moonlit beach, after the film 『人魚の島のひみつ』: the island's forest behind the sand, the cave on the left
  // and the sea along the bottom of the picture. The sea's edge is the bottom lane, water in every World 5 job. Field and
  // road are the same sand, so a closed lane needs no cover: it is bare sand with no tiles.
  world(
    5,
    'World 5 島（浜辺の洞窟）',
    'World 5, the island (the beach cave):',
    '#012396',
    {
      ja: '月夜の空と、砂浜のうしろに続く島の森（ヤシの木）。浜の砂（戦場もこの上）。相手が来る右の砂浜（戦いの前に相手がここで待つので、ひらけた砂のままに）。守る場所：浜辺の洞窟（岩がけに青い葉、暗い洞窟の口は右＝戦場向き）。いちばん下は海で、波打ちぎわが絵の左はしから右はしまで続く。',
      en: 'The moonlit sky, and the island’s forest of palms behind the beach; the sand (the field lies on it); the open beach on the right the enemies come along (they wait on it before a battle, so keep it open sand); the protected place, the beach cave, rocky cliffs with leafy plants on top, the dark cave mouth facing right toward the field; along the bottom the sea, its surf running from edge to edge of the picture.',
    },
    {
      paintedWater: true,
      closedLane: 'transparent',
      fieldLine: LINE_ON_DARK,
      more: {
        ja: '水のレーン：いちばん下（5番目）のレーンは、World 5 のどのジョブでも海なので、絵の中に描く。波打ちぎわを y 1040 あたりに絵の左はしから右はしまで通して、y 1040〜1210 をすべて水にする。海はそのまま絵の下のはしまで続ける。マス目はゲームが重ねる。ヒトハ・フタバとラッコのボートがこの上に浮かぶ。',
        en: 'The water lane: the bottom lane (the fifth) is sea in every World 5 job, so paint it into the picture: run the surf along y 1040 from edge to edge, so that y 1040–1210 is all water, and carry the sea on down to the bottom of the picture. The game lays the tile grid over it. ヒトハ, フタバ and Rakko’s boat float on it.',
      },
    },
  ),
  // The big hunt, after the owner's World 6 quest picture: a forest clearing in soft pastels with dark brown outlines.
  // Big pale-pink trunks and soft green crowns at the back with a teal shade between the trees, round green bushes with
  // little sprouts, pale cream ground, and the striped mushrooms the trio had never seen where they landed. Tall grass
  // on the right, where the big ones come out. Rakko is not on this hunt, so no car parks here.
  world(
    6,
    'World 6 おっきい討伐（着地したところ）',
    'World 6, the big hunt (the landing spot):',
    '#BDD79F',
    {
      ja: 'やわらかい色の空（森の上に少し見える）。奥の森：大きなうすいピンクの幹と、やわらかい緑の木のかたまり、木のあいだは青緑のかげ（たて長のうすい光のつぶ）、そのふもとに小さな芽の出たまるい緑の茂み。森の中のひらけた地面（戦場もこの上）：うすいクリーム色に、短い線と小さな草のたば、戦場の外には野の草のかたまりも。大きいのが出てくる、右の背の高い草むら：草は右はしと上下だけで、まん中（x 2430〜3360・y 360〜1210）は、戦いの前に相手が並んで待つひらけた地面のまま。守る場所：着地したところ（ちいかわたちがおりてきた、森のひらけた場所）。まるい茂みの前に、見たことのないキノコ（ピンクとむらさきのしまのかさ、くねくねした白い柄）が大小いくつも。手前に草の先と、小さなしまのキノコ、カエル（下のふち）。',
      en: 'A soft pale sky, showing a little over the forest. The far forest: big pale-pink trunks and soft green crowns, a teal shade between the trees (with long pale glints), and round green bushes with little sprouts along its foot. The clearing (the field lies on it): pale cream ground with little dash marks and small grass tufts, and clumps of wild grass off the field. The tall grass on the right, where the big ones come out: grass only down the far right edge and along the top and bottom, the middle (x 2430–3360, y 360–1210) staying open ground where the enemies line up before a battle. The protected place, the landing spot, the clearing where the team came down: several of the mushrooms they had never seen (pink-and-purple striped caps on wavy white stems), big and small, in front of round bushes. Grass tips, little striped mushrooms and a frog along the bottom edge.',
    },
    {
      more: {
        ja: 'ラッコはこの討伐に来ないので、くるまは止まらない（x 730〜900 もふつうの地面のままに）。',
        en: 'Rakko is not on this hunt, so no car parks here: x 730–900 stays plain ground too.',
      },
    },
  ),
];
