import { WORLD_FIELD } from './spec';

/** How far the game stretches each cut edge of a scene piece, in stage pixels: slack for the moments between
 *  two camera positions, and for screens a little wider than the picture. */
export const BLEED_PX = 48;
/** The same for a battle world's pieces: on a squarish screen the picture carries on above and below. */
export const WORLD_BLEED = { r: BLEED_PX, t: 130, b: 130 };
/** All four sides, for a world whose field is at `fieldX` in its picture. A picture of the planned width reaches past the
 *  left of every screen; one narrower than planned is stretched the rest of the way, under the card column. */
export const worldBleed = (fieldX: number) => ({ ...WORLD_BLEED, l: Math.max(BLEED_PX, WORLD_FIELD.x - fieldX) });
