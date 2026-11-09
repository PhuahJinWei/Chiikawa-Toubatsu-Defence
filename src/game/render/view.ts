// Where the battle's camera stands on a given screen. Pure maths, so the tests can check it on every screen shape.

import { WORLD_BLEED } from '../../art/bleed';
import { FIELD_H, FIELD_W } from '../sim/constants';

interface BattleView {
  /** CSS pixels per field pixel. */
  scale: number;
  /** Where the field's top-left corner is on the screen, in CSS pixels. */
  ox: number;
  oy: number;
}

/** Slow, quick, slow (0 → 1). */
export const easeInOut = (k: number): number => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** What must stay in view top to bottom and at the far end, in field pixels: the field, a little beyond it. */
const CORE = { y0: -12, x1: FIELD_W + 24, y1: FIELD_H + 14 };
/** How far left of the field the screen shows, from the card column's right edge (field pixels): the parked cars and
 *  nearly all of the protected place. */
export const SEEN_LEFT = 500;

/**
 * The camera for a W × H screen, the HUD covering `left` CSS pixels (the card column), `top` (its strip) and `right` (the
 * testing ground's panel); the scenery runs underneath them, stretched outward where the view runs past the picture
 * (worldBleed). It shows from SEEN_LEFT left of the field to the field's far end. Spare width goes to the road and spare
 * height is split evenly.
 */
export function battleView(W: number, H: number, inset: { left: number; top: number; right: number }, picture: { h: number; field: { x: number; y: number } }): BattleView {
  const { field, h } = picture;
  const ax = Math.min(inset.left, W * 0.3);
  const ay = Math.min(inset.top, H * 0.3);
  const aw = Math.max(1, W - ax - Math.min(inset.right, W * 0.45));
  const ah = Math.max(1, H - ay);
  const coreH = CORE.y1 - CORE.y0;
  const scale = Math.min(aw / (SEEN_LEFT + CORE.x1), ah / coreH);
  // Where the screen's top edge falls in the picture, kept on the picture (and, on a squarish screen, its stretched edges).
  const seen = H / scale;
  const wanted = field.y - (ay + (ah - coreH * scale) / 2 - CORE.y0 * scale) / scale;
  const lowest = Math.min(0, h + WORLD_BLEED.b - seen);
  const highest = Math.max(lowest, h - seen);
  const picTop = Math.max(lowest, Math.min(highest, wanted));
  return { scale, ox: ax + SEEN_LEFT * scale, oy: (field.y - picTop) * scale };
}
