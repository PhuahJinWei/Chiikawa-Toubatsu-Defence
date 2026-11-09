// Field geometry and timing constants. All distances are logical pixels.
//
// The field is landscape, like PvZ: LANES horizontal lanes stacked top to bottom, each COLS tiles long.
// Enemies enter from the right and walk left toward the protected place at the left edge.
// Column 0 is nearest the base (left); column COLS-1 is where enemies enter (right).
//
// Inside the simulation the travel axis is called `y`: the distance an enemy has walked from the spawn
// side, growing as it approaches the base. The renderer draws y along screen x (right to left) and the
// lane index along screen y, so the simulation never needs to know which way the screen points.

export const LANES = 5;
export const COLS = 9;
export const TILE = 170;
/** Length of one lane (the travel axis). */
export const LANE_LEN = COLS * TILE; // 1530
/** Field size on screen: lanes run left-right, so width is the lane length. */
export const FIELD_W = LANE_LEN;
export const FIELD_H = LANES * TILE; // 850

/** Fixed simulation step (60 Hz). */
export const STEP_MS = 1000 / 60;

/** How far into an ally's tile (from the tile's enemy-side edge) an enemy's feet go before it stops to attack. */
export const CONTACT = Math.round(TILE * 0.1);
/** Ally feet position along the travel axis, measured from its tile's enemy-side edge (centred). */
export const ALLY_FEET = Math.round(TILE * 0.5);
/** How far ahead of an enemy's feet (toward the allies) projectiles connect. */
export const HIT_LINE = Math.round(TILE * 0.3);
/** How far ahead of an ally's feet (toward the enemies) projectiles appear. */
export const MUZZLE = Math.round(TILE * 0.4);
/** Height above the ground at which projectiles fly (screen pixels, for the renderer). */
export const PROJECTILE_HEIGHT = Math.round(TILE * 0.5);

/** Where enemies appear (feet y), beyond the field's enemy-side edge. */
export const SPAWN_Y = -80;
/** Enemies become targetable once their feet pass this line. */
export const FIELD_ENTRY_Y = 20;
/** Crossing this line in a lane triggers that lane's rescue, or loses the level. */
export const BASE_Y = LANE_LEN + Math.round(TILE * 0.15);

export const SPEED_PX_PER_S = {
  slow: TILE / 9,
  normal: TILE / 6,
  fast: TILE / 3,
} as const;

export const PROJECTILE_SPEED = 900;
export const SPIT_SPEED = 520;
export const RESCUE_SPEED = 1300;
/** A rescue car defeats ordinary enemies outright but only deals this much to bosses. */
export const RESCUE_BOSS_DAMAGE = 1500;
/** オデ's sprint along his lane (px/s): about two seconds from end to end, slower than Rakko's car, so he can be seen
 *  running. */
export const ODE_SPEED = 800;

/** Damage or release lands on frame 3 of the standard 4-frame attack (120 + 100 ms). */
export const ATTACK_RELEASE_MS = 220;
/** A friend's attack, wind-up to follow-through (ms): a mode of its own, which the next attack waits for. Its frames
 *  are shared out over this. */
export const ALLY_ATTACK_MS = 500;
export const COLLAPSE_MS = 500;
export const FADE_MS = 300;

/** Sprouted weed timings. */
export const WEED_SPROUT_MS = 600;
export const WEED_WILT_MS = 500;
export const WEED_PULLED_MS = 450;
export const CHIIKAWA_PULL_MS = 600;
export const AUTO_COLLECT_MS = 1500;

/** A wave may start early once the field is clear and at least this long (and 60% of its gap) has passed. */
export const EARLY_WAVE_MIN_MS = 8000;
/** Big, final and boss waves are announced this long before they spawn. */
export const BANNER_LEAD_MS = 3000;

export const WEEDS_CAP = 9990;

/** Travel-axis coordinate of a column's enemy-side edge. */
export const colY = (col: number): number => (COLS - 1 - col) * TILE;
/** Across-axis coordinate of a lane's centre. */
export const laneX = (lane: number): number => lane * TILE + TILE / 2;
export const allyFeetY = (col: number): number => colY(col) + ALLY_FEET;
/** Column index whose tile contains travel coordinate y, clamped to the field. */
export const colOfY = (y: number): number => Math.max(0, Math.min(COLS - 1, COLS - 1 - Math.floor(y / TILE)));
export const laneOfX = (x: number): number => Math.floor(x / TILE);

// ---------------------------------------------------------------- screen mapping (used by the renderer)

/** Feet line inside a lane: sprites stand near the lane's lower edge so their bodies fill the lane. */
export const LANE_FEET = TILE - 22;
/** Travel coordinate → screen x (enemies come from the right). */
export const screenX = (y: number): number => LANE_LEN - y;
/** Across coordinate (lane centre = laneX) → screen y of the feet. */
export const screenY = (x: number): number => x + (LANE_FEET - TILE / 2);
/** Screen x → travel coordinate. */
export const travelOfScreenX = (sx: number): number => LANE_LEN - sx;
/** Screen feet y → across coordinate. */
export const acrossOfScreenY = (sy: number): number => sy - (LANE_FEET - TILE / 2);
/** Screen x of a column's left (base-side) edge. */
export const colLeft = (col: number): number => col * TILE;
