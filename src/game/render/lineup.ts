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

/** Where `n` waiting enemies stand: five to a column, one per lane, the columns centred on the road between the
 *  field's right edge and the picture's right edge (`right`, in field pixels). The first spots are the front
 *  column, nearest the field. Small fixed offsets keep it a crowd rather than a grid. */
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
    const lane = lanes[i % per];
    const jitter = (((i + seed) * 37) % 7) - 3;
    out.push({
      x: mid + (col - (cols - 1) / 2) * COLUMN_GAP + (lane % 2 ? 40 : -10) + jitter * 6,
      y: lane * TILE + LANE_FEET + jitter * 2,
    });
  }
  return out;
}
