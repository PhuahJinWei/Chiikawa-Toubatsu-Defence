// Single pictures used by the menus: faces for cards, the gallery and dialogue, and the title logo.

import { CHARACTERS } from './characters';
import type { ImageSpec, Text } from './types';

export const PORTRAIT_SUBJECTS = [
  'chiikawa',
  'chiikawa_island',
  'hachiware',
  'hachiware_pajama',
  'yoroi',
  'yoroi_erai',
  'usagi',
  'usagi_cool',
  'momonga',
  'kurimanju',
  'shisa',
  'ode',
  'pajama_parties',
  'futaba',
  'hitoha',
  'shimajiro',
  'taiyaki',
  'muchauman',
  'hoshi',
  'rakko',
  'mushi_twolegs',
  'goblin',
  'mushi_sixlegs',
  'chushidesu',
  'fugu',
  'majyo',
  'kimera',
  'mushi_horned',
  'mushi_pink',
  'mermaid_twolegs',
  'kuroi_nagareboshi',
  'guchokipanogitaigata',
  'zou',
  'chiikabu',
  'ningyo',
  'yamanba',
  'seiren',
  'dekai_tori',
  'anoko',
  'dekatsuyo',
  'yoroi_rodo',
  'yoroi_pochette',
  'yoroi_ramen',
  'furuhonya',
];

/** Cards whose picture is the thing itself, not a face: the taiyaki and 星. */
const CARD_PICTURES: Record<string, Text> = {
  taiyaki: {
    ja: 'たい焼きのカードと図鑑の絵：泳ぐ魚のように宙に浮かぶ、ふつうのきつね色のたい焼き（顔はなくてもよい）。透明背景。',
    en: 'The たい焼き card’s picture, for the card and the gallery: a plain golden-brown taiyaki hanging in mid-air like a swimming fish (a face is optional). Transparent background.',
  },
  hoshi: {
    ja: '星のカードと図鑑の絵：小さな顔のある、ふっくら光る五角の星。まわりに小さなきらきら。明るく暖かい色で、黒い星とひと目でちがうように。透明背景。',
    en: 'The 星 card’s picture, for the card and the gallery: a plump glowing five-pointed star with a little face and a few sparkles about it, bright and warm so it is told apart from the 黒い星 at a glance. Transparent background.',
  },
};

/** A gameplay subject's character id (its first form), if the subject fights. */
export function fighterId(subject: string): string | undefined {
  return CHARACTERS.find((r) => r.subject === subject && r.group !== 'rescue' && r.id !== 'enemy_chiikabu_true' && r.id !== 'enemy_kimera_claws')?.id;
}

export const PORTRAITS: ImageSpec[] = PORTRAIT_SUBJECTS.map((s) => ({
  key: `portraits/portrait_${s}`,
  kind: 'portrait',
  w: 256,
  h: 256,
  note:
    CARD_PICTURES[s] ??
    (fighterId(s)
      ? {
          ja: '顔のアップ（チームえらび・図鑑・会話用）。透明背景。',
          en: 'Face close-up for picking the team, the gallery and dialogue. Transparent background.',
        }
      : { ja: '顔のアップ（図鑑・会話用）。透明背景。', en: 'Face close-up for the gallery and dialogue. Transparent background.' }),
}));

export const LOGOS: ImageSpec[] = [
  {
    key: 'ui/logo_ja',
    kind: 'logo',
    w: 775,
    h: 360,
    note: {
      ja: 'ゲームのタイトル「ちいかわ 討伐ディフェンス」。ロビーの左上に出る（英語のときもこの日本語のロゴ）。白いふちはゲームが付ける。透明背景。',
      en: 'The game’s title, 「ちいかわ 討伐ディフェンス」, shown at the top left of the lobby (in English too: there is only the Japanese logo). The game adds a white cut-out edge. Transparent background.',
    },
  },
];

/** Buttons drawn whole, lettering and all (the same pictures in English). The back button is shown as drawn, on every
 *  screen; the lobby's four big buttons, picture and name plate in one, are cut out by the game as stickers (white
 *  edge and shadow) and float over the counter. */
export const UI_BUTTONS: ImageSpec[] = [
  {
    key: 'ui/back',
    kind: 'button',
    w: 600,
    h: 200,
    note: {
      ja: '「← もどる」ボタン。すべての画面のもどるボタンになる（英語のときも同じ絵）。横3：縦1くらいのクリーム色の札、こげ茶のふち、透明背景。',
      en: 'The 「← もどる」 button, used for every back button (the same picture in English). A cream tag about 3 wide by 1 tall with a dark-brown outline, transparent background.',
    },
  },
  // The lobby's four, each in its own shape, about 600 tall.
  {
    key: 'ui/button_play',
    kind: 'button',
    w: 556,
    h: 600,
    note: {
      ja: 'ロビーの「あそぶ」ボタン：ピンクの丸に、クエストの紙とさすまた。下に「あそぶ」の札。透明背景（白いふちと影はゲームが付ける）。',
      en: 'The lobby’s Play button: a quest paper and a さすまた on a pink circle, with an 「あそぶ」 name plate below. Transparent background (the game adds the white edge and shadow).',
    },
  },
  {
    key: 'ui/button_book',
    kind: 'button',
    w: 475,
    h: 600,
    note: {
      ja: 'ロビーの「図鑑」ボタン：本。下に「図鑑」の札。透明背景。',
      en: 'The lobby’s Gallery button: a book, with a 「図鑑」 name plate below. Transparent background.',
    },
  },
  {
    key: 'ui/button_shop',
    kind: 'button',
    w: 436,
    h: 600,
    note: {
      ja: 'ロビーの「お店」ボタン：くまの顔のピンクのポーチ（輪っかの持ち手つき）。下に「お店」の札。透明背景。',
      en: 'The lobby’s Shop button: a pink bear-face pouch with a ring handle, with an 「お店」 name plate below. Transparent background.',
    },
  },
  {
    key: 'ui/button_settings',
    kind: 'button',
    w: 476,
    h: 600,
    note: {
      ja: 'ロビーの「設定」ボタン：歯車。下に「設定」の札。透明背景。',
      en: 'The lobby’s Settings button: a gear, with a 「設定」 name plate below. Transparent background.',
    },
  },
];

/** The battle's buttons along the top are game icons: one square picture each, shown as drawn on a round coloured face.
 *  They show small (about 30 px), so keep them bold and simple, with no text. */
export const UI_ICONS: ImageSpec[] = [
  {
    key: 'ui/icon_shovel',
    kind: 'icon',
    w: 360,
    h: 360,
    note: {
      ja: 'バトルの「シャベル」ボタンの絵（なかまを戻す道具）。小さく出るので、太くはっきり。正方形、透明背景、文字なし。',
      en: "The battle's shovel button (takes a friend back off the field). Shown small, so bold and simple. Square, transparent background, no text.",
    },
  },
  {
    key: 'ui/icon_speed',
    kind: 'icon',
    w: 360,
    h: 360,
    note: {
      ja: 'バトルの「はやおくり」ボタンの絵（2倍速）。小さく出るので、太くはっきり。正方形、透明背景、文字なし。',
      en: "The battle's fast-forward button (2× speed). Shown small, so bold and simple. Square, transparent background, no text.",
    },
  },
  {
    key: 'ui/icon_speed_active',
    kind: 'icon',
    w: 360,
    h: 360,
    note: {
      ja: 'バトルの「はやおくり」ボタンが入っているとき（2倍速中）の絵。「×2」を絵に描きこんでよい。正方形、透明背景。',
      en: "The battle's fast-forward button while 2× speed is on. It may carry its own “×2”. Square, transparent background.",
    },
  },
  {
    key: 'ui/icon_pause',
    kind: 'icon',
    w: 360,
    h: 360,
    note: {
      ja: 'バトルの「一時停止」ボタンの絵。小さく出るので、太くはっきり。正方形、透明背景、文字なし。',
      en: "The battle's pause button. Shown small, so bold and simple. Square, transparent background, no text.",
    },
  },
];

/** Things the game shows for a moment: the hand stamp (判子) seen from above, which presses a red stamp onto the paper
 *  the moment one is earned (and is then taken away), and 労働の鎧さん standing beside the report at the end of a job. */
export const UI_PROPS: ImageSpec[] = [
  {
    key: 'ui/hand_stamp',
    kind: 'icon',
    w: 540,
    h: 566,
    note: {
      ja: '判子（ハンコ）を真上から見た絵：持ち手と、下のふちに見える赤いインク。赤いスタンプが手に入った瞬間に、紙の上に押される（文字は入れない）。透明背景。',
      en: 'A hand stamp (判子) seen from straight above: its handle, with the red ink showing at the bottom rim. It presses a red stamp onto the paper the moment one is earned (no text). Transparent background.',
    },
  },
  {
    key: 'ui/report_yoroi_bow',
    kind: 'icon',
    w: 671,
    h: 768,
    note: {
      ja: '討伐報告のとなりに立つ労働の鎧さん（討伐成功）：胸に手を当てておじぎ。腰から上だけの絵で、腰の線は画面の下にかくれます。背景は透明。',
      en: 'Labour 鎧さん beside the job report when a job is done: a hand on his heart, thanking the player. From the waist up (the waist goes below the bottom of the screen). Transparent background.',
    },
  },
  {
    key: 'ui/report_yoroi_concerned',
    kind: 'icon',
    w: 671,
    h: 768,
    note: {
      ja: '討伐報告のとなりに立つ労働の鎧さん（討伐失敗）：頭をかいて心配そう。腰から上だけの絵で、腰の線は画面の下にかくれます。背景は透明。ゲームが左右反転して使います。',
      en: 'Labour 鎧さん beside the report when a job has failed: scratching his head, concerned. From the waist up (the waist goes below the bottom of the screen). Transparent background. The game mirrors it.',
    },
  },
];

/** The shop's goods, stuck on each seller's price list as stickers: one square picture per item, no text (the game cuts
 *  it out with a white edge and writes the name and the price beside it). */
export const SHOP_ITEMS: ImageSpec[] = [
  {
    key: 'shop/item_slot',
    kind: 'icon',
    w: 360,
    h: 360,
    note: {
      ja: 'ポシェット屋の「ポシェット拡張」（3つとも同じ絵）：ポシェット（鎧さんが下げている、くまの顔のピンクのポシェットなど）。正方形、透明背景、文字なし。',
      en: 'The Pochette Shop’s “Bigger pochette” (all three use it): a pochette (the pink bear-face one the 鎧さん wears, say). Square, transparent background, no text.',
    },
  },
  {
    key: 'shop/item_ramen',
    kind: 'icon',
    w: 360,
    h: 360,
    note: {
      ja: 'ラーメン屋「郎」の「ラーメン券」（2つとも同じ絵）：ラーメンの食券。横長でもよい（正方形のわくの中に、形のまま収める）。透明背景。',
      en: 'Ramen Shop 郎’s “Ramen ticket” (both use it): a ramen meal ticket. May be wide (it is fitted into the square spot as drawn). Transparent background.',
    },
  },
  {
    key: 'shop/item_buta',
    kind: 'icon',
    w: 360,
    h: 360,
    note: {
      ja: 'ラーメン屋「郎」の「ぶた入りラーメン券」の絵：ぶた（チャーシュー）が乗ったラーメンの食券。「ラーメン券」と見分けがつくように。横長でもよい。透明背景。ジョブの依頼書でも使う。',
      en: 'Ramen Shop 郎’s “Pork ramen ticket”: a meal ticket for ramen topped with pork, told apart from the plain “Ramen ticket” at a glance. May be wide. Transparent background. Also shown on the job notice.',
    },
  },
  {
    key: 'shop/item_shisa',
    kind: 'icon',
    w: 360,
    h: 360,
    note: {
      ja: 'なかま屋の「シーサー」の絵：シーサーの顔に、まだなかまでないしるしの錠前。なかまになると「なかま入り」のはんこが押される。正方形、透明背景。',
      en: 'The friend shop’s “Shisa”: her face with a padlock, as she has not joined yet. Once she joins, a 「なかま入り」 stamp goes on her line. Square, transparent background.',
    },
  },
  {
    key: 'shop/item_hoshi',
    kind: 'icon',
    w: 360,
    h: 360,
    note: {
      ja: 'なかま屋の「星」の絵：光る星に錠前。正方形、透明背景。',
      en: 'The friend shop’s “Star”: the glowing star with a padlock. Square, transparent background.',
    },
  },
];

/** The gallery's open book, its pages blank: the game lays it on 古本屋's table and writes in it (the tabs, the list
 *  on the left page, the chosen entry on the right). */
export const GALLERY_IMAGES: ImageSpec[] = [
  {
    key: 'gallery/book',
    kind: 'card',
    w: 1460,
    h: 1040,
    note: {
      ja: '図鑑の本（開いた本、ページは白紙）。正面から、左右のページが同じくらい。文字やしおりはゲームが入れる。透明背景。',
      en: 'The gallery book, open, its pages blank: seen straight on, the two pages about the same. The game adds the tabs and writes the pages. Transparent background.',
    },
  },
];

/** The places the quests protect, one per world (World 4–6 come with v2). */
export const QUEST_PLACES: { ja: string; en: string }[] = [
  { ja: 'ハチワレの洞窟', en: "Hachiware's cave" },
  { ja: '森の出口', en: 'the forest exit' },
  { ja: 'ラーメン屋「郎」', en: 'ラーメン屋「郎」' },
  { ja: '夜のちいかわの家', en: "Chiikawa's home at night" },
  { ja: '浜辺の洞窟', en: 'the beach cave' },
  { ja: 'おっきい討伐の着地したところ', en: 'the landing spot of the big hunt' },
];

/** The quest board's pictures: the blank notice paper every quest is printed on, one picture per world, and the
 *  last paper's (the 討伐ランキング). The game pins the paper, writes the text and puts the picture in its frame. */
export const QUEST_IMAGES: ImageSpec[] = [
  {
    key: 'quests/paper',
    kind: 'card',
    w: 900,
    h: 972,
    note: {
      ja: 'クエストの紙（白紙）。上のまんなかにピン、下のふちは破れた紙。文字と絵はゲームが入れる。透明背景。',
      en: 'The blank quest paper: a pin at the top centre, a torn bottom edge. The game writes the text and puts the picture on it. Transparent background.',
    },
  },
  ...QUEST_PLACES.map(
    (p, i): ImageSpec => ({
      key: `quests/world${i + 1}`,
      kind: 'card',
      w: 1120,
      h: 620,
      note: {
        ja: `World ${i + 1} のクエストの絵：${p.ja}。ふちは雲のような丸い形、外は透明。`,
        en: `World ${i + 1}'s quest picture: ${p.en}. A soft cloud-shaped frame, transparent outside it.`,
      },
    }),
  ),
  // The last paper, the 討伐ランキング (endless mode), shows Rakko, #1 of the ranking, rather than a place. Until it
  // is drawn the paper shows Rakko's face as a sticker instead.
  {
    key: 'quests/ranking',
    kind: 'card',
    w: 1120,
    h: 620,
    note: {
      ja: '最後の紙「討伐ランキング」（エンドレス）の絵：ランキング1位のラッコと、ラッコのくるま。狩りから帰ってきたように堂々と立つ（ラッコとくるまの見た目は原作で確認）。夕方の空や、遠くの地平線にならぶ討伐対象のかげを入れると「終わらない」感じが出る（なくてもよい）。文字は入れない（「1位」のスタンプと「1. ラッコ · 測定不能」はゲームが入れる）。ふちは雲のような丸い形、外は透明。',
      en: 'The last paper’s picture, the 討伐ランキング (endless mode): Rakko, #1 of the ranking, with his car, standing proud as if just back from a hunt (check the episodes for how he and the car look). An evening sky, or a faint line of monster shadows far off on the horizon, gives the “never ends” feel (optional). No text: the game adds the 「1位」 stamp and writes 「1. ラッコ · 測定不能」. A soft cloud-shaped frame, transparent outside it.',
    },
  },
  {
    key: 'quests/stamp_soon',
    kind: 'card',
    w: 900,
    h: 371,
    note: {
      ja: '赤い「準備中」のスタンプ。まだ開いていないクエストの紙の上に押す。透明背景。',
      en: 'The red 「準備中」 stamp, pressed over the quest papers that are not open yet. Transparent background.',
    },
  },
];
