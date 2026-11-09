// The shop: the inside of ラーメン屋「郎」, in the owner's own art (one 1620 × 972 picture in five pieces).

import type { SceneSpec, Text } from '../types';

const CUT: Text = { ja: '白いふちと影はゲームが付けるので描かない。透明背景。', en: 'The game adds the white cut edge and shadow; do not paint them. Transparent background.' };
const cut = (ja: string, en: string): Text => ({ ja: `${ja}${CUT.ja}`, en: `${en} ${CUT.en}` });

export const SHOP_SCENE: SceneSpec = {
  id: 'shop',
  kind: 'menu',
  w: 1620,
  h: 972,
  safe: { x0: 228, y0: 8, x1: 1392, y1: 690 },
  anchor: { x: 0.5, y: 0 },
  backdrop: '#CEE8E3',
  note: {
    ja: 'ラーメン屋「郎」の店内（お店の画面）。1620×972の1枚の絵を5つのパーツに分けたもの。人物をタップするとカメラがその人に寄り、反対側に品物の紙が出る。どのパーツも平らに・正面から描く（奥行き、カメラの角度、白いふち、影はゲームが付ける）。絵のはしで切れているパーツは、ゲームがはしを少しのばし、カメラが切れ目を見せない。横長のスマホでは下が、4:3のタブレットでは左右が少し切れる。',
    en: 'Inside ラーメン屋「郎」 (the shop screen): one 1620 × 972 picture split into five pieces. Tapping someone zooms the camera to them and opens their goods on the other side. Paint every piece flat and straight on: the game adds the depth, the camera angle, the white border and the shadows. Where a piece runs off the edge of the picture, the game stretches that edge a little and the camera never shows the cut. Wide phones crop a little off the bottom, 4:3 tablets a little off the sides.',
  },
  layers: [
    {
      id: 'shop_wall',
      x: 0,
      y: 0,
      w: 1620,
      h: 972,
      z: 4.2,
      edge: false,
      cut: ['l', 'r', 't', 'b'],
      note: {
        ja: 'いちばん奥の背景：水色のレンガの壁、「郎」の黄色いのれん、どんぶりを積んだ棚、おたまとざる。絵の全体をぬる。透明部分なし。',
        en: 'The farthest piece: the mint brick wall, the yellow 郎 noren, the shelf of stacked bowls, the ladle and the strainer. Fills the whole picture, no transparency.',
      },
    },
    {
      id: 'shop_master',
      x: 12,
      y: -7,
      w: 565,
      h: 884,
      z: 3.6,
      edge: true,
      character: { focusY: 0.3, zoom: 1.35 },
      note: cut(
        'ラーメンの鎧さん（郎の店主）。金色のよろい、頭にバンダナ、腕組み。カウンターのうしろ、左はしに立つ。頭のてっぺんは絵の上はしより少し上まであるので、切らずに全部描く。',
        'ラーメンの鎧さん, the owner of 郎: gold armour, a bandana, arms folded. Stands behind the counter at the left. The top of the head reaches a little above the picture; draw it whole.',
      ),
    },
    {
      id: 'shop_counter',
      x: 1,
      y: 591,
      w: 1619,
      h: 381,
      z: 3.3,
      edge: true,
      cut: ['l', 'b'],
      note: cut(
        'カウンター：ピンクの天板が右の奥へ細くなる。右はしは店の中で終わり、左はしと下は絵の外へ続く。',
        'The counter: a pink top narrowing toward the back at the right. It ends inside the shop at the right and runs off the left and bottom of the picture.',
      ),
    },
    {
      id: 'shop_pochette',
      x: 1102,
      y: 68,
      w: 518,
      h: 904,
      z: 3,
      edge: true,
      cut: ['r', 'b'],
      character: { focusY: 0.42, zoom: 1.25 },
      note: cut(
        'ポシェットの鎧さん。銀色のよろい、くまのポシェットをななめがけ、どんぶりを持つ。カウンターの前、右はし。右ひじと足は絵の外へ切れる。',
        'ポシェットの鎧さん: silver armour, the bear pochette worn across the body, holding a bowl. In front of the counter at the right; the right elbow and the legs run off the picture.',
      ),
    },
    {
      id: 'shop_shisa',
      x: 480,
      y: 462,
      w: 634,
      h: 510,
      z: 2.7,
      edge: true,
      cut: ['b'],
      character: { focusY: 0.42, zoom: 1.35 },
      // She stands at the bottom edge, so a wide phone (which crops the bottom) would cut her off at the mouth: there
      // she is raised by 30% of what is cropped, enough to show her whole face.
      rise: 0.3,
      note: cut(
        'シーサー（郎で働いている）。頭に手ぬぐい、両手に白いふきん。いちばん手前のまん中で、体の下は絵の下はしで切れる。',
        'シーサー, who works at 郎: a towel round the head, a white cloth in both hands. Nearest, in the middle; the body runs off the bottom of the picture.',
      ),
    },
  ],
  slots: [
    // On the ramen knight's chest, the way the pochette shop's tag sits on the other knight's shoulder.
    { id: 'tag_ramen', x: 410, y: 430, w: 300, h: 64, note: { ja: 'ラーメン屋の名札（鎧さんの胸）。', en: "The ramen seller's name tag, on the knight's chest." } },
    // Right over Shisa's head, so it rises with her (onto the shelf's front) and stays clear of her ears.
    { id: 'tag_shisa', x: 800, y: 430, w: 240, h: 64, rise: 0.3, note: { ja: 'シーサーのなかま屋の名札（頭の上のかべ）。', en: "The name tag of Shisa's friend shop, on the wall over her head." } },
    { id: 'tag_pochette', x: 1252, y: 470, w: 260, h: 64, note: { ja: 'ポシェット屋の名札（鎧さんの肩）。', en: "The pochette seller's name tag, on the knight's shoulder." } },
  ],
  effects: [],
};
