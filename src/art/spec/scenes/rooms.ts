// The gallery: a table at 古本屋's, with 古本屋 reading on the left. The game lays the open gallery book (a picture
// of its own, art/gallery/book.png) on the right of the screen and writes the list and the entries in it.

import type { SceneSpec } from '../types';
import { back, piece } from './common';

export const BOOK_SCENE: SceneSpec = {
  id: 'book',
  kind: 'menu',
  w: 1620,
  h: 972,
  // 古本屋 stays in view on every screen; the rest is the table the book lies on.
  safe: { x0: 24, y0: 300, x1: 464, y1: 700 },
  anchor: { x: 0, y: 0.5 },
  backdrop: '#F0AB7C',
  note: {
    ja: '図鑑：古本屋の机。左に本を読む古本屋（積んだ本つき）。右にはゲームが開いた図鑑の本を置いて中身を書くので、ほかは机と壁だけでよい。',
    en: "The gallery: a table at 古本屋's, with 古本屋 reading on the left beside a stack of books. The game lays the open gallery book on the right and writes in it, so the rest is just the table and the wall.",
  },
  layers: [
    back('wall', 1620, 972, 4.2, '上に壁、下に机（机のふちはゆるいカーブ）。', 'The wall above and the table below (its edge a gentle curve).'),
    // Wiggled like a cut-out tilted by hand (owner's call): it snaps between leaning 6° each way, 1.6 s a lean, about
    // the middle of its bottom edge, where it sits.
    piece(
      'furuhonya',
      30,
      306,
      409,
      394,
      3.0,
      '本を読む古本屋と、横に積んだ本（机の上、左はし）。ゲームが左右に6°ずつカクッと傾ける（下のまんなかを軸に）。',
      '古本屋 reading, with a stack of books beside (on the table, at the left). The game snaps it 6° left and right, turning about the middle of its bottom edge.',
      { snap: { deg: 6, ms: 1600 } },
    ),
  ],
  slots: [],
  effects: [],
};
