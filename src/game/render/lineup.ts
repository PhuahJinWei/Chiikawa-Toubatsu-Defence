// Before a battle, the level's enemies wait on the road right of the field while the camera looks at them, a crowd in
// proportion to who is coming. Pure maths in field pixels, shared by the renderer and the tests.

import { FIELD_W, LANE_FEET, LANES, TILE } from '../sim/constants';

export interface LineupSpot {
  /** Where its feet stand, in field pixels. */
  x: number;
  y: number;
}

/** A figure's visible box standing at rest, around the point its feet stand on (field pixels): `l` and `r` across
 *  (l < 0 < r), `t` its top (negative, above the feet). */
export interface Body {
  l: number;
  r: number;
  t: number;
}

/** Who is waiting, as far as where they stand goes. */
export interface Waiter {
  swims: boolean;
  giant: boolean;
  body: Body;
}

/** Lanes filled in this order, so a short line stands in the middle. */
const LANE_ORDER = [2, 1, 3, 0, 4];
/** Space between the columns of the crowd (field pixels). */
const COLUMN_GAP = 250;
/** The least space between columns, when more columns are tried to keep everyone in sight (field pixels). */
const TIGHTEST_GAP = 170;
/** How far in from each end of the road the outer columns stay at least (field pixels): half the widest figure that
 *  isn't a giant (セイレーン), and a little. */
const ROAD_ENDS = 180;
/** The lane a giant's feet are in, the nearest of the middle three: it waits as it will come. */
const GIANT_LANE = Math.floor(LANES / 2) + 1;
/** The lanes its body doesn't reach. */
const CLEAR_OF_GIANT = [0, LANES - 1];
/** How far down the road the column standing clear of a giant waits (field pixels). */
const NEAR_COLUMN = 95;
/** How far in from the picture's right edge the last one along a lane clear of a giant stands (field pixels). */
const PAST_EDGE = 150;
/** How much picture shows above the field while the camera rests on the road (field pixels): 140 or more on phones,
 *  80 on a 21:9 monitor. A figure reaching higher than this loses its head on a phone. */
const HEAD_ROOM = -120;
/** The pause button's corner of the picture there: from 150 px in from its right edge, everything higher than 10 px
 *  above the field (field pixels; a Galaxy Z Fold's cover screen reaches furthest). Nobody's head goes in it. */
const CORNER_W = 150;
const CORNER_LOW = -10;
/** The most of a figure's box that whoever stands in front of it may cover. */
const MOST_HIDDEN = 0.25;
/** One figure on the road for every this many of a kind that come. */
const PER_FIGURE = 5;
/** The most figures on the road, a giant among them, so everyone can be seen (6-5's giant leaves room for ten more). */
export const MOST_WAITING = 11;

/** One kind of enemy a job sends: how many of it come over the whole job, and whether it is a giant. */
interface Kind {
  id: string;
  count: number;
  giant: boolean;
}

/** Who waits on the road before a job: one figure for every five of a kind that come, at least one, and a giant once
 *  (owner's call, 2026-11-10: they come in numbers, so the road shows a crowd; a job of eight two-legged bugs shows
 *  one, a job of thirteen two). PvZ's look at the street shares out its figures the same way. Kinds keep their order,
 *  each kind's figures together. More than the road takes: fewer of the most numerous, never none of a kind. */
export function crowdOf(kinds: Kind[]): string[] {
  const n = kinds.map((k) => (k.giant ? 1 : Math.max(1, Math.floor(k.count / PER_FIGURE))));
  for (let total = n.reduce((a, b) => a + b, 0); total > MOST_WAITING; total--) {
    // The kind with the most figures gives one up; between equals, the one with fewer coming.
    let at = -1;
    for (let i = 0; i < n.length; i++) {
      if (n[i] > 1 && (at < 0 || n[i] > n[at] || (n[i] === n[at] && kinds[i].count < kinds[at].count))) at = i;
    }
    if (at < 0) break;
    n[at]--;
  }
  return kinds.flatMap((k, i) => Array<string>(n[i]).fill(k.id));
}

/** A place to try: across, the lane, and which little offsets it gets. */
interface Slot {
  x: number;
  lane: number;
  i: number;
}

/** A figure standing on the road. */
interface Standing extends LineupSpot {
  b: Body;
}

/** Where everyone waits, in the order given (the renderer gives small ones first). Giants stand at the far end on the
 *  nearest of the middle lanes; a lone one has the others out of its way, in a column at the near end of the road and
 *  along the lanes its body doesn't reach. Otherwise they stand in columns, swimmers in the water lanes when there is
 *  any and everyone else on the land. Each takes the first place, nearest the field first, where it is wholly in sight:
 *  inside the picture, under the top of the screen and out of the pause button's corner, hiding no more than a quarter
 *  of anyone and no more hidden itself. When someone has no such place, more columns are tried, closer together; a
 *  crowd that still doesn't fit (endless mode) has each of the rest stand where it hides and is hidden least. */
export function lineupLayout(who: Waiter[], right: number, water: number[]): LineupSpot[] {
  const road = new Road(right);
  const spots: LineupSpot[] = new Array(who.length);
  const far = (FIELD_W + right + COLUMN_GAP) / 2;
  const giants = who.flatMap((w, i) => (w.giant ? [i] : []));
  // Giants first, at the far end; a second one (endless mode only) further up the road.
  giants.forEach((g, k) => {
    spots[g] = { x: far - k * 2 * COLUMN_GAP, y: GIANT_LANE * TILE + LANE_FEET };
    road.stand(who[g].body, spots[g]);
  });
  const rest = who.flatMap((w, i) => (w.giant ? [] : [i]));
  if (giants.length === 1 && !water.length) {
    settle(road, rest, who, clearSlots(rest.length, right, far), spots, true);
    return spots;
  }
  const wet = water.length && water.length < LANES ? LANE_ORDER.filter((l) => water.includes(l)) : null;
  const groups = wet
    ? [
        { ids: rest.filter((i) => who[i].swims), lanes: wet, seed: 0 },
        { ids: rest.filter((i) => !who[i].swims), lanes: LANE_ORDER.filter((l) => !wet.includes(l)), seed: 3 },
      ]
    : [{ ids: rest, lanes: LANE_ORDER, seed: 0 }];
  for (const g of groups) {
    if (!g.ids.length) continue;
    const first = Math.ceil(g.ids.length / g.lanes.length);
    let done = false;
    for (let cols = first; !done && (cols === first || gapFor(cols, right) >= TIGHTEST_GAP); cols++) {
      const mark = road.mark();
      done = settle(road, g.ids, who, columnSlots(cols, right, g.lanes, g.seed), spots, false);
      if (!done) road.back(mark);
    }
    if (!done) settle(road, g.ids, who, columnSlots(first, right, g.lanes, g.seed), spots, true);
  }
  return spots;
}

/** The order to draw them in, as in a battle: whoever's feet are further back first, giants too. */
export const byFeet = (a: LineupSpot, b: LineupSpot): number => a.y - b.y || b.x - a.x;

/** Where `n` waiting enemies would stand in plain columns: five to a column, one per lane, the columns centred on the
 *  road between the field's right edge and the picture's right edge (`right`, in field pixels). The first spots are
 *  the front column, nearest the field. */
export function lineupSpots(n: number, right: number): LineupSpot[] {
  return columnSlots(Math.max(1, Math.ceil(n / LANE_ORDER.length)), right, LANE_ORDER, 0).slice(0, n).map(spotOf);
}

/** The space between `cols` columns on the road: the usual gap, closer when the road is too short for it. */
function gapFor(cols: number, right: number): number {
  return cols > 1 ? Math.min(COLUMN_GAP, (right - FIELD_W - 2 * ROAD_ENDS) / (cols - 1)) : COLUMN_GAP;
}

/** `cols` columns of places over these lanes (in this order, one each to a column), centred on the road, nearest the
 *  field first. `seed` shifts the little offsets so two groups do not jitter alike. */
function columnSlots(cols: number, right: number, lanes: number[], seed: number): Slot[] {
  const mid = (FIELD_W + right) / 2;
  const gap = gapFor(cols, right);
  const out: Slot[] = [];
  for (let c = 0; c < cols; c++) for (const lane of lanes) out.push({ x: mid + (c - (cols - 1) / 2) * gap, lane, i: out.length + seed });
  return out;
}

/** The places out of a lone giant's way: a column at the near end of the road (the smallest at the back, where the
 *  top of the screen leaves the least head room), then along the two lanes its body doesn't reach: beside it, between
 *  it and the column, past it. */
function clearSlots(others: number, right: number, far: number): Slot[] {
  const near = FIELD_W + NEAR_COLUMN;
  const column = Math.min(others, LANES);
  const back = Math.floor((LANES - column) / 2);
  const out: Slot[] = [];
  for (let k = 0; k < column; k++) out.push({ x: near, lane: back + k, i: out.length });
  for (const x of [far - 30, (near + far - 30) / 2, right - PAST_EDGE]) for (const lane of CLEAR_OF_GIANT) out.push({ x, lane, i: out.length });
  return out;
}

/** A place's spot. Small fixed offsets (different for each place) keep it a crowd rather than a grid. */
function spotOf(s: Slot): LineupSpot {
  const jitter = ((s.i * 37) % 7) - 3;
  return { x: s.x + (s.lane % 2 ? 40 : -10) + jitter * 6, y: s.lane * TILE + LANE_FEET + jitter * 2 };
}

/** Puts each of `ids` in turn on the first of `slots` still free where it is wholly in sight; with `anyhow`, one with
 *  no such place stands where it hides and is hidden least. Says whether everyone found a place in sight. */
function settle(road: Road, ids: number[], who: Waiter[], slots: Slot[], spots: LineupSpot[], anyhow: boolean): boolean {
  const free = [...slots];
  let all = true;
  for (const id of ids) {
    const b = who[id].body;
    let k = free.findIndex((s) => road.fits(b, spotOf(s)));
    if (k < 0) {
      all = false;
      if (!anyhow || !free.length) return false;
      let least = Infinity;
      free.forEach((s, j) => {
        const worst = road.worst(b, spotOf(s));
        if (worst < least) [least, k] = [worst, j];
      });
    }
    spots[id] = spotOf(free[k]);
    road.stand(b, spots[id]);
    free.splice(k, 1);
  }
  return all;
}

/** Everyone standing on the road so far. */
class Road {
  private stood: Standing[] = [];

  constructor(private readonly right: number) {}

  /** Whether a figure can stand here wholly in sight (see lineupLayout). */
  fits(b: Body, s: LineupSpot): boolean {
    const top = s.y + b.t;
    if (s.x <= FIELD_W || s.x + b.r > this.right || top < HEAD_ROOM) return false;
    if (s.x + b.r > this.right - CORNER_W && top < CORNER_LOW) return false;
    return this.worst(b, s) <= MOST_HIDDEN;
  }

  /** The most of anyone it would hide, or be hidden, standing here. */
  worst(b: Body, s: LineupSpot): number {
    const me = { ...s, b };
    return this.stood.reduce((most, o) => Math.max(most, hides(me, o)), 0);
  }

  stand(b: Body, s: LineupSpot): void {
    this.stood.push({ ...s, b });
  }

  mark(): number {
    return this.stood.length;
  }

  /** Takes everyone stood since `mark` off the road again. */
  back(mark: number): void {
    this.stood.length = mark;
  }
}

/** How much of whichever of the two is drawn first (further back by its feet; level, the one further down the road)
 *  the other covers: a share of its box. */
function hides(a: Standing, b: Standing): number {
  const aFirst = a.y < b.y || (a.y === b.y && a.x > b.x);
  const back = aFirst ? a : b;
  const front = aFirst ? b : a;
  const w = Math.min(back.x + back.b.r, front.x + front.b.r) - Math.max(back.x + back.b.l, front.x + front.b.l);
  const h = Math.min(back.y, front.y) - Math.max(back.y + back.b.t, front.y + front.b.t);
  return w > 0 && h > 0 ? (w * h) / ((back.b.r - back.b.l) * -back.b.t) : 0;
}
