// The lobby, where the game starts: the job counter with the 鎧さん behind it. The game floats its four big
// buttons (あそぶ, 図鑑, お店, 設定) over the picture as screen controls, so they need no room painted for them.
// あそぶ turns the camera to the quest board: kraft paper the game pins its quest papers on.

import type { SceneSpec } from '../types';
import { back, piece } from './common';

const SAFE = { x0: 228, y0: 8, x1: 1392, y1: 690 };

export const LOBBY_SCENE: SceneSpec = {
  id: 'lobby',
  kind: 'menu',
  w: 1620,
  h: 972,
  safe: SAFE,
  anchor: { x: 0.5, y: 0 },
  backdrop: '#F3DFD0',
  note: {
    ja: 'ロビー（ゲームの最初の画面）：受付のカウンターと、その向こうの鎧さん。ゲームが大きなボタン（あそぶ・図鑑・お店・設定）を左右にうかべるので、鎧さんの左右は少しあけておく。',
    en: "The lobby, the game's first screen: the reception counter with the 鎧さん behind it. The game floats its big buttons (Play, Gallery, Shop, Settings) on the left and right, so keep a little room on both sides of the 鎧さん.",
  },
  layers: [
    back('wall', 1620, 972, 4.2, '受付の壁（はり・壁・腰板）。', 'The wall behind the counter: a beam, plaster and the wainscot.'),
    piece('counter', 0, 545, 1620, 427, 2.8, '手前の受付カウンター（書類の束つき）。', 'The reception counter in front, with a stack of papers on it.', { cut: ['l', 'r', 'b'] }),
    // A slow breath (owner's call): 1-2-3-2, 0.9 s a frame.
    piece(
      'yoroi',
      214,
      1,
      952,
      696,
      2.75,
      '受付の鎧さん。正面向き、カウンターに手をついている（下のふちはカウンターの上で切れる）。息をする待ちアニメのコマ4枚（同じ大きさ・同じ位置、手はカウンターから動かさない）。',
      'The 鎧さん at the counter, facing the viewer with both hands on it (cut off where the counter top hides the rest). Drawn as a 4-frame breathing loop, every frame the same size and place, the hands staying put on the counter.',
      { frames: 4, frameMs: 900 },
    ),
  ],
  slots: [],
  effects: [],
};

export const QUESTS_SCENE: SceneSpec = {
  id: 'quests',
  kind: 'menu',
  w: 1620,
  h: 972,
  safe: SAFE,
  anchor: { x: 0.5, y: 0 },
  backdrop: '#EDB991',
  note: {
    ja: 'クエストの掲示板：クラフト紙の板だけ。クエストの紙（ワールドの絵つき）、見出し、もどるボタンはゲームが貼る。',
    en: 'The quest board: only the kraft paper of the board. The game pins on the quest papers (each with its world picture), the heading and the back button.',
  },
  layers: [back('board', 1620, 972, 4.2, '掲示板のクラフト紙。', 'The kraft paper of the board.')],
  slots: [],
  effects: [],
};
