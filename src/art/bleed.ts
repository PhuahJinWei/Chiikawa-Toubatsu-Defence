import { WORLD_FIELD } from './spec';

/** How far the game stretches each cut edge of a scene piece, in stage pixels: slack for the moments between
 *  two camera positions, and for screens a little wider than the picture. */
export const BLEED_PX = 48;
/** The same for a battle world's pieces, at the least. */
export const WORLD_BLEED = { r: BLEED_PX, t: 130, b: 130 };
/** How far a world's `h`-tall picture has to carry on above and below for a screen showing `seen` field pixels top to
 *  bottom (a squarish screen shows more than the picture, which stands centred on it). */
export const pictureBleed = (seen: number, h: number): number => Math.max(WORLD_BLEED.t, Math.ceil((seen - h) / 2) + 8);
/** All four sides, for a world whose field is at `fieldX` in its picture, `tall` above and below. A picture of the planned
 *  width reaches past the left of every screen; one narrower than planned is stretched the rest of the way, under the
 *  card column. */
export const worldBleed = (fieldX: number, tall: number = WORLD_BLEED.t) => ({ ...WORLD_BLEED, t: tall, b: tall, l: Math.max(BLEED_PX, WORLD_FIELD.x - fieldX) });
