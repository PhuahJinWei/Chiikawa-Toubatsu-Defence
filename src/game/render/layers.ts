// The order the battle draws its characters in.

/** One lane's worth of draw order, and the step that puts a lane's enemies (and the bushes they hide in) over its
 *  friends. Both are far bigger than any `fine` value. */
const LANE_STEP = 1e7;
const ENEMY_STEP = 1e6;

/** Where something goes in the battle's draw order (owner's call, 2026-11-08): a nearer lane is always in front of one
 *  further back, friend or enemy, and within a lane every enemy is over every friend, so whoever bites a friend stays in
 *  view. `fine` orders the ones of a kind within a lane (whoever's feet are lower in front). A giant counts as standing
 *  in the lane its feet are in. */
export function drawKey(lane: number, enemy: boolean, fine: number): number {
  return lane * LANE_STEP + (enemy ? ENEMY_STEP : 0) + fine;
}
