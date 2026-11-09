import type { SceneLayer, Side, Text } from '../types';

const CUT: Text = { ja: '白いふちと影はゲームが付けるので描かない。透明背景。', en: 'The game adds the white cut edge and shadow; do not paint them. Transparent background.' };
const BACK: Text = { ja: '透明部分なし（絵の全体をぬる）。', en: 'No transparency: fills the whole picture.' };

/** A cut-out piece's note, with the reminder that the game draws the border. */
export const cutNote = (ja: string, en: string): Text => ({ ja: `${ja}${CUT.ja}`, en: `${en} ${CUT.en}` });
/** The backmost piece's note. */
export const backNote = (ja: string, en: string): Text => ({ ja: `${ja}${BACK.ja}`, en: `${en} ${BACK.en}` });

/** The backmost piece: the whole picture, no border, running off every side. */
export function back(id: string, w: number, h: number, z: number, ja: string, en: string): SceneLayer {
  return { id, x: 0, y: 0, w, h, z, edge: false, cut: ['l', 'r', 't', 'b'], note: backNote(ja, en) };
}

/** A cut-out piece. */
export function piece(id: string, x: number, y: number, w: number, h: number, z: number, ja: string, en: string, extra: Partial<SceneLayer> & { cut?: Side[] } = {}): SceneLayer {
  return { id, x, y, w, h, z, edge: true, note: cutNote(ja, en), ...extra };
}
