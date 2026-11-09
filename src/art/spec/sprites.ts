// Battle characters as frame animations (sprites): which motions a character's frames come in and which it needs,
// by what it does in the game. The importer, the checklist and the tests read this; the drawing is in
// src/art/sprite.ts.

import { PAJAMA_MEMBERS } from './characters';
import type { CharacterSpec, Text } from './types';

/** The motions a character's frames can come in, as named in the files (<name>_<motion>_<n>.png), with what each
 *  is for. */
export const SPRITE_MOTIONS = {
  idle: { ja: '待機。絵は1枚だけ（1枚めを使う）。足もとはそのままで、ゲームが息をさせる（約1秒で2%のびて、もどる）', en: 'Standing by: one picture (only the first is used). The game makes it breathe, feet planted (2% taller and back, about once a second)' },
  walk: { ja: '歩く・泳ぐ・飛ぶ。ループ（速さで1コマ0.075〜0.14秒）', en: 'Walking, swimming or flying, looping (0.075–0.14 s a frame, by speed)' },
  attack: {
    ja: '攻撃。1回0.52秒（0.22秒で当たる）。星は攻撃せず、ねがいをかなえる動きになる（1回0.6秒。さいごのコマが始まるときに、えらんだなかまに変わる）',
    en: 'Attacking, once in 0.52 s (the blow lands 0.22 s in). 星 never attacks: its frames are its cast instead, once in 0.6 s (the friend picked takes its place as the last frame begins)',
  },
  death: { ja: 'たおれる。1回0.56秒、消えながら', en: 'Falling, once in 0.56 s while fading out' },
  ability: {
    ja: 'とくいわざ。歌・呪文はループ。むちゃうマンの決めポーズは1回0.75秒で、さいごのコマのまま止まる（パジャマパーティーズのダンスは、コマ数にかかわらず1回6.33秒。24コマなら1コマ0.26秒）。六足の虫のジャンプは1回2.3秒：1コマめでかまえて0.8秒、2〜4コマめで空中1秒、5〜6コマめで着地0.5秒（その場でとぶ絵で。前と上へは、ゲームが運ぶ）。ゴブリンの草ひろいは1回0.5秒（足もとでかがむ。まん中で草が消える）。キメラが爪を出すのは1回1秒（爪のある姿の ability。爪をかくした姿から始めて、さいごのコマで出そろう）',
    en: 'A special move. A song or a spell loops, and むちゃうマン’s pose plays once in 0.75 s and holds its last frame (パジャマパーティーズ’ dance lasts 6.33 s however many frames it has: 0.26 s a frame for 24); the six-legged bug’s jump plays once in 2.3 s: its first frame crouches ready for 0.8 s, frames 2–4 are in the air for 1 s, frames 5–6 land in 0.5 s (drawn on the spot: the game carries it up and over); the goblin’s pick-up plays once in 0.5 s (bending down at its feet; the 草 vanishes halfway); the chimera drawing her claws plays once in 1 s (her clawed form’s ability: starting with them hidden, out by the last frame)',
  },
  transform: { ja: '変身。1回1.5秒', en: 'Transforming, once in 1.5 s' },
  spawn: { ja: 'セイレーンに呼ばれて出てくる（地面からはい出す）。1回0.9秒', en: 'Coming up when セイレーン calls (climbing out of the ground), once in 0.9 s' },
  cook: {
    ja: 'たい焼きが焼けていく段階の絵（生から焼きあがりまで）。さいごの1枚をのぞいた絵が焼けるあいだに順に出て、さいごの絵（焼きあがり）は焼けたときに一瞬出る。そのあとは待機（idle）',
    en: 'The taiyaki’s cooking stages, raw to done. All but the last share out the time it cooks; the last (done) shows for a moment as it comes ready, and then it stands by (idle)',
  },
  weed_search: { ja: 'ちいかわが草をさがす（すわって左右を見る）。ループ1回1.6秒', en: 'Chiikawa searching for 草 (seated, looking left and right), a 1.6 s loop' },
  weed_found: {
    ja: 'ちいかわが草を見つけて、かかげる（草は絵に描きこむ）。1回0.64秒で、さいごのコマのまま少し止まる（さいごのコマで草が手に入る）',
    en: 'Chiikawa finding 草 and holding it up (the 草 is part of the picture), once in 0.64 s, holding the last frame a moment (the 草 is hers on the last frame)',
  },
  damaged1: { ja: '壁のきず1（待機のかわり）。1枚なら待機と同じく息をする。2枚以上ならループ', en: 'A wall’s first wear, in place of standing by: one picture breathes like idle, several loop' },
  damaged2: { ja: '壁のきず2。1枚なら息をする。2枚以上ならループ', en: 'A wall’s second wear: one picture breathes, several loop' },
  damaged3: { ja: '壁のきず3。1枚なら息をする。2枚以上ならループ', en: 'A wall’s third wear: one picture breathes, several loop' },
} as const satisfies Record<string, Text>;

export type SpriteMotionName = keyof typeof SPRITE_MOTIONS;

/** The moves the gallery's photo cycles through, in this order (falling over is left to the battle). */
export const GALLERY_MOTIONS = ['idle', 'cook', 'weed_search', 'weed_found', 'walk', 'float', 'attack', 'cast', 'pose', 'spawn', 'jump', 'steal', 'song', 'heal', 'damaged1', 'damaged2', 'damaged3'];

/** Loops that last a set time (ms) whatever their number of frames, by character and motion: the time is shared out
 *  evenly among the frames, and stays the same at every size (in battle and in the gallery). パジャマパーティーズ' dance
 *  (their song: ability frames) lasts as long as the dance it follows (owner's call, 2026-11-08). */
export const SPRITE_LOOP_MS: Record<string, Partial<Record<SpriteMotionName, number>>> = {
  ally_chiikawa: { weed_search: 1600 },
  ...Object.fromEntries(PAJAMA_MEMBERS.map((m) => [`ally_pajama_parties_${m}`, { ability: 6330 }])),
};

/** 星's frames: it stands by on its tile, then casts, and the friend it wished for takes over. */
export const STAR_SPRITE = 'ally_hoshi';

/** The frames a character needs (`need`) and can also have (`extra`), by its moves. 星 stands by and then casts. */
export function spriteNeeds(r: CharacterSpec | undefined, id = r?.id): { need: SpriteMotionName[]; extra: SpriteMotionName[] } {
  if (id === STAR_SPRITE) return { need: ['idle', 'attack'], extra: [] };
  const m = r?.motions ?? [];
  const need = new Set<SpriteMotionName>(['idle']);
  const extra = new Set<SpriteMotionName>();
  if (m.includes('walk') || m.includes('float')) need.add('walk');
  if (m.includes('attack') || m.includes('heal')) need.add('attack');
  if (m.includes('collapse')) need.add('death');
  if (m.includes('transform')) need.add('transform');
  if (m.includes('spawn')) need.add('spawn');
  if (m.includes('cook')) need.add('cook');
  if (m.includes('pose')) need.add('ability');
  if (m.includes('weed_search')) need.add('weed_search');
  if (m.includes('weed_found')) need.add('weed_found');
  // A special move: a song, a spell, pulling weeds, 六足の虫's jump, a goblin picking up 草, キメラ drawing her claws.
  if (m.includes('song') || m.includes('jump') || m.includes('steal') || m.includes('claws') || r?.subject === 'yamanba') extra.add('ability');
  for (const d of ['damaged1', 'damaged2', 'damaged3'] as const) if (m.includes(d)) extra.add(d);
  return { need: [...need], extra: [...extra] };
}
