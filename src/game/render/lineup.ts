// Before a battle, the level's enemies wait on the road right of the field, one of each kind, while the camera
// looks at them. Pure layout maths in field pixels, shared by the renderer and the tests.

import { FIELD_W, LANE_FEET, LANES, TILE } from '../sim/constants';

interface LineupSpot {
  /** Where its feet stand, in field pixels. */
  x: number;
  y: number;
}

/** Lanes filled in this order, so a short line stands in the middle. */
const LANE_ORDER = [2, 1, 3, 0, 4];
/** Space between the columns of the crowd (field pixels). */
const COLUMN_GAP = 250;
/** The lane a giant's feet are in, the nearest of the middle three: it waits as it will come. */
const GIANT_LANE = Math.floor(LANES / 2) + 1;
/** The lanes its body doesn't reach. */
const CLEAR_OF_GIANT = [0, LANES - 1];
/** How far down the road the column standing clear of a giant waits (field pixels). */
const NEAR_COLUMN = 95;

/** Who is waiting, as far as where they stand goes. */
interface Waiter {
  swims: boolean;
  giant: boolean;
}

/** Where everyone waits, in the order given. A lone giant with few enough others has them stand clear of it, so nobody
 *  is lost behind its body; a crowd too big for that (endless mode) stays as it is, the giants on their lane. */
export function lineupLayout(who: Waiter[], right: number, water: number[]): LineupSpot[] {
  const giants = who.filter((w) => w.giant).length;
  if (giants === 1 && !water.length && who.length - 1 <= LANE_ORDER.length + CLEAR_OF_GIANT.length) return standingClear(who, right);
  const feet = GIANT_LANE * TILE + LANE_FEET;
  return lineupSpotsWet(who.map((w) => w.swims), right, water).map((s, i) => (who[i].giant ? { ...s, y: feet } : s));
}

/** The order to draw them in, as in a battle: whoever's feet are further back first, giants too. */
export const byFeet = (a: LineupSpot, b: LineupSpot): number => a.y - b.y || b.x - a.x;

/** A lone giant in the far column, and the others (small ones first) out of its way: up to five in a column at the near
 *  end of the road, then any more in the lanes beside the giant that its body doesn't reach. The column goes smallest at
 *  the back, where the top strip leaves the least head room, so whoever is nearer hides as little as it can. */
function standingClear(who: Waiter[], right: number): LineupSpot[] {
  const far = (FIELD_W + right + COLUMN_GAP) / 2;
  const column = Math.min(who.length - 1, LANES);
  const back = Math.floor((LANES - column) / 2);
  let others = 0;
  return who.map((w) => {
    if (w.giant) return { x: far, y: GIANT_LANE * TILE + LANE_FEET };
    const i = others++;
    return i < column ? spotAt(FIELD_W + NEAR_COLUMN, back + i, i) : spotAt(far - 30, CLEAR_OF_GIANT[i - column], i);
  });
}

/** A spot in a lane, near `x`. Small fixed offsets (different for each `i`) keep it a crowd rather than a grid. */
function spotAt(x: number, lane: number, i: number): LineupSpot {
  const jitter = ((i * 37) % 7) - 3;
  return { x: x + (lane % 2 ? 40 : -10) + jitter * 6, y: lane * TILE + LANE_FEET + jitter * 2 };
}

/** Where `n` waiting enemies stand: five to a column, one per lane, the columns centred on the road between the
 *  field's right edge and the picture's right edge (`right`, in field pixels). The first spots are the front
 *  column, nearest the field. */
export function lineupSpots(n: number, right: number): LineupSpot[] {
  return spotsIn(n, right, LANE_ORDER, 0);
}

/** The same with water about (World 5): the swimmers (`swims[i]`) wait in the water lanes and everyone
 *  else on the land lanes, each group in its own lanes, column by column. */
export function lineupSpotsWet(swims: boolean[], right: number, water: number[]): LineupSpot[] {
  if (!water.length || water.length >= LANES) return lineupSpots(swims.length, right);
  const wet = LANE_ORDER.filter((l) => water.includes(l));
  const dry = LANE_ORDER.filter((l) => !water.includes(l));
  const wetSpots = spotsIn(swims.filter(Boolean).length, right, wet, 0);
  const drySpots = spotsIn(swims.filter((s) => !s).length, right, dry, 3);
  return swims.map((s) => (s ? wetSpots.shift()! : drySpots.shift()!));
}

/** `n` spots over these lanes (in this order), one per lane to a column, the columns centred on the road. `seed`
 *  shifts the little offsets so two groups do not jitter alike. */
function spotsIn(n: number, right: number, lanes: number[], seed: number): LineupSpot[] {
  const per = Math.max(1, lanes.length);
  const cols = Math.max(1, Math.ceil(n / per));
  const mid = (FIELD_W + right) / 2;
  const out: LineupSpot[] = [];
  for (let i = 0; i < n; i++) {
    const col = Math.floor(i / per);
    out.push(spotAt(mid + (col - (cols - 1) / 2) * COLUMN_GAP, lanes[i % per], i + seed));
  }
  return out;
}
