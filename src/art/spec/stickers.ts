// Single pictures the game moves on its own: projectiles, hit effects, pickups and terrain.
// Each is one flat sticker; the game pops, spins, scales and fades it.

import type { StickerSpec } from './types';

const s = (id: string, group: StickerSpec['group'], w: number, h: number, anchor: StickerSpec['anchor'], ja: string, en: string, edge = true): StickerSpec => ({
  id,
  group,
  w,
  h,
  anchor,
  edge,
  note: { ja, en },
});

/** Effects and shots drawn in a few versions: each time one shows (or is thrown), one of its versions is picked at
 *  random (never the one it showed last), so a run of hits does not repeat one spark, nor 古本屋 one book; a shot keeps
 *  its picture all the way. Effect or shot id → its versions' sticker ids. */
export const STICKER_VARIANTS: Record<string, string[]> = {
  fx_hit: [1, 2, 3].map((n) => `fx_hit_${n}`),
  fx_clink: [1, 2, 3].map((n) => `fx_clink_${n}`),
  fx_can_splash: [1, 2, 3].map((n) => `fx_can_splash_${n}`),
  fx_book: [1, 2, 3].map((n) => `fx_book_${n}`),
};

export const STICKERS: StickerSpec[] = [
  // Projectiles: drawn flying to the right (allies' shots) or to the left (the fugu's spit).
  s('fx_blast', 'projectile', 90, 90, 'center', 'うさぎの爆風弾。右へ飛ぶ。', "Usagi's blast shot, flying right."),
  s('fx_acorn', 'projectile', 50, 50, 'center', 'モモンガのどんぐり。', "Momonga's acorn."),
  s('fx_can', 'projectile', 64, 64, 'center', '栗まんじゅうのカップ酒の缶（ゲームが回す）。', "Kurimanju's cup-sake can (the game spins it)."),
  s('fx_goya', 'projectile', 70, 70, 'center', 'シーサーのゴーヤ（ゲームが回す）。', "Shisa's ゴーヤ (the game spins it)."),
  s('fx_shell', 'projectile', 60, 60, 'center', 'フタバが水切りのように投げる貝がら（うすいピンクがかったクリーム色のホタテ貝）。右へ飛び、相手をつきぬける。', 'The seashell フタバ skims: a pale pink-cream scallop, flying right and through every enemy.'),
  s('fx_conch', 'projectile', 64, 64, 'center', 'ヒトハが投げる大きな巻き貝（サザエのような、とげのある茶色い巻き貝。口はクリーム色。ゲームが回す）。', 'The big spiral shell ヒトハ throws: a knobbly brown turban shell like a サザエ, with a cream mouth (the game spins it).'),
  // 古本屋's books, in three versions (owner's call, 2026-11-08): each book thrown is one of them, picked at random.
  ...STICKER_VARIANTS.fx_book.map((id, i) =>
    s(
      id,
      'projectile',
      60,
      60,
      'center',
      `古本屋が2冊つづけて投げる本（3種類の${i + 1}つめ。投げるたびにこの中からばらばらに出る。ゲームが回す）。`,
      `A book 古本屋 throws, two at a time (${i + 1} of 3: each book thrown is one of them, picked at random; the game spins it).`,
    ),
  ),
  s(
    'fx_flame',
    'projectile',
    80,
    60,
    'center',
    'ちいかわ（人魚の島）のたいまつから飛ぶ炎。右へ飛ぶ、ひとつの大きな火の玉（燃えうつらない）。',
    'The flame from ちいかわ（人魚の島）’s torch: one big fireball flying right (nothing catches fire).',
  ),
  s(
    'fx_missile',
    'projectile',
    60,
    110,
    'center',
    'うさぎ（クール）のミサイル。空から先を下にして落ちてくる（ゲームが落とす）。',
    'うさぎ（クール）’s missile, falling nose first out of the sky (the game drops it).',
  ),
  s('fx_spit', 'projectile', 50, 50, 'center', 'フグの吐き出し弾。左へ飛ぶ。', "Fugu's spit, flying left."),
  // Effects: the game pops, grows and fades them. Hit sparks and armour clinks come in three versions each, one picked
  // at random every time.
  ...STICKER_VARIANTS.fx_hit.map((id, i) =>
    s(id, 'effect', 100, 100, 'center', `命中の火花（3種類の${i + 1}つめ。当たるたびにこの中からばらばらに出る）。`, `Hit spark (${i + 1} of 3: each hit shows one of them, picked at random).`),
  ),
  ...STICKER_VARIANTS.fx_clink.map((id, i) =>
    s(
      id,
      'effect',
      100,
      100,
      'center',
      `硬い相手に弾かれた「カン」（3種類の${i + 1}つめ。弾かれるたびにこの中からばらばらに出る）。`,
      `Deflected by armour, "カン" (${i + 1} of 3: each clink shows one of them, picked at random).`,
    ),
  ),
  s('fx_boom', 'effect', 170, 170, 'center', 'うさぎの爆発。うさぎ（クール）のミサイルが落ちたところにも出る。', "Usagi's explosion, also where うさぎ（クール）'s missiles land."),
  s(
    'fx_taiyaki_pop',
    'effect',
    200,
    170,
    'center',
    'たい焼きがはじけたところ：あつあつのあんこと湯気がはじける（ゲームがはじけさせる）。',
    'The taiyaki going off: piping-hot red-bean paste and steam bursting out (the game bursts it).',
  ),
  s('fx_splat', 'effect', 100, 100, 'center', '吐き出しが当たったしぶき。', 'Spit splash.'),
  // 栗まんじゅう's can splash, in three versions (one picked at random each time, like the hit sparks): where the can
  // lands and over every other enemy it splashes, drawn small so the enemies stay in view.
  ...STICKER_VARIANTS.fx_can_splash.map((id, i) =>
    s(
      id,
      'effect',
      100,
      100,
      'center',
      `栗まんじゅうの缶のしぶき（3種類の${i + 1}つめ。出るたびにこの中からばらばらに出る）。缶が落ちたところと、しぶきが当たったほかの相手ひとりひとりの上に出る。相手が見えるように小さめに出す。`,
      `Kurimanju's can splash (${i + 1} of 3: each splash shows one of them, picked at random), where the can lands and over every other enemy it splashes. Drawn small, so the enemies stay in view.`,
    ),
  ),
  // The healed mark: shows for a moment over everyone healed. Its light is see-through, so it has no white edge.
  s(
    'fx_heal',
    'effect',
    170,
    170,
    'center',
    '回復したしるし：「＋HP」と、下から立ちのぼる緑の光。回復したなかま（と、黒い星に回復された相手）ひとりひとりの上に一瞬だけ出る。光がすけているので白いふちは付けない。',
    'The healed mark: “+HP” with green light rising. It shows for a moment over each one healed (friends, and the enemies the Black Star heals). Its light is see-through, so the game adds no white edge.',
    false,
  ),
  // The heal pulse: frames played in order (1, 2, 3), and a black one from 黒い星 when it heals the enemies round it.
  // The frames spread and fade on their own, so they are drawn as painted, with no white edge. Since 2026-11-08 no
  // friend heals (古本屋 throws books, the taiyaki is a trap), so the light one waits for a healer to come.
  ...[1, 2, 3].map((n) =>
    s(
      `fx_heal_${n}`,
      'effect',
      170,
      170,
      'center',
      `回復の波紋（3コマの${n}つめ）。なかまが回復したところで 1→2→3 の順に出る。広がって消えていく絵なので、白いふちは付けない。`,
      `Healing pulse (frame ${n} of 3), played 1→2→3 where friends are healed. It spreads and fades in its frames, so the game adds no white edge.`,
      false,
    ),
  ),
  ...[1, 2, 3].map((n) =>
    s(
      `fx_heal_black_${n}`,
      'effect',
      170,
      170,
      'center',
      `黒い星の回復の波紋（黒、3コマの${n}つめ）。黒い星がまわりの相手を回復するとき、1→2→3 の順に出る。白いふちは付けない。`,
      `The Black Star's healing pulse (black, frame ${n} of 3), played 1→2→3 when it heals the enemies round it. No white edge.`,
      false,
    ),
  ),
  s('fx_spell', 'effect', 170, 170, 'center', '山姥の呪文と、ちいかぶの変身のときに出る光（ゲームがはじけさせる）。', "A burst of light for 山姥's spell and ちいかぶ's transformation (the game bursts it)."),
  s(
    'fx_freeze',
    'effect',
    120,
    120,
    'center',
    'むちゃうマンのポーズでこおった相手ひとりひとりの上に一瞬出る、氷のきらめき。相手が見えるように小さめに出す。',
    'A glint of ice that shows for a moment over each enemy むちゃうマン’s pose freezes, drawn small so the enemy stays in view.',
  ),
  // Song notes: five different ones, each floating note picked at random.
  ...[1, 2, 3, 4, 5].map((n) => s(`fx_note_${n}`, 'effect', 50, 50, 'center', `歌の音符（5種類の${n}つめ。音符はこの中からばらばらに出る）。`, `A song note (${n} of 5: each note that floats up is one of them, picked at random).`)),
  s('fx_dust', 'effect', 240, 120, 'center', 'ふみつけの土ぼこり（ゲームがはじけさせる）。', 'Stomp dust (the game bursts it).'),
  s(
    'fx_trail',
    'effect',
    240,
    120,
    'center',
    'ラッコの車とボートが走るときに、うしろにのびる土ぼこり・けむり。右はしが車のうしろで、左へいくほど小さくなる（車とボートだけに使う）。',
    "The dust and smoke trailing behind Rakko's car and boat as they drive: its right end is at the back of the car, the puffs getting smaller to the left (used for the car and the boat only).",
  ),
  s('fx_place', 'effect', 170, 80, 'center', '置いたときの足元のきらきら。', 'Sparkles at the feet when placed.'),
  // Pickups and terrain stand on the ground.
  // 草 itself: its icon (the counter, every cost) and the weed that grows on the field (also what ちいかわ finds).
  s('pickup_weed', 'pickup', 120, 120, 'center', '草のアイコン。草の数と、カードやなかまのコストに出る。集めた草はこの絵になって草の数へ飛んでいく。', 'The 草 icon: shown by the 草 count and every cost. A collected weed flies to the count as this picture.'),
  s('pickup_drop', 'pickup', 120, 120, 'feet', '戦場に生えてくる草（タップで集める）。ちいかわが見つけた草もこの絵で出てきて、自動で集まる。生える・ゆれる・抜ける・しおれるはゲームが動かす。', 'The weed that grows on the field (tap to collect). The weeds ちいかわ finds come up as this picture too, and collect themselves. The game makes it sprout, wobble, pop out and wilt.'),
  s('terrain_stump', 'terrain', 170, 170, 'feet', '切り株。このマスには置けない。投げたものはここで止まる（山なりの缶は越える）。', 'Stump. Nothing can be placed on this tile, and shots stop at it (a lobbed can flies over).'),
  s('terrain_bush', 'terrain', 170, 170, 'feet', '茂み。このマスには置けない。中に入った相手はこの絵のうしろに隠れて、ねらわれない。', 'Bush. Nothing can be placed on this tile. An enemy walking into it hides behind this picture and cannot be aimed at.'),
];

/**
 * Sticker pictures are delivered at this many times their planned size. The game draws each one at its planned size
 * on the field, and on phones that is about one screen pixel per field pixel; tablets and laptops show the field at
 * 1.25 to 2 screen pixels per field pixel (the game never cuts a sticker finer than 2.5), where a picture drawn at
 * the planned size looks soft.
 */
export const STICKER_DETAIL = 2;

export function stickerSpec(id: string): StickerSpec | undefined {
  return STICKERS.find((x) => x.id === id);
}
