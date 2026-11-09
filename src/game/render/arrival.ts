// Rakko's cars arriving before a battle. Pure maths, so the tests can check it and the opening can be timed by it.

/** Where a parked car (or boat) stands, in field pixels: just left of the field. */
export const PARKED_X = -84;
/** How far short of its parking spot a car sets off (field pixels): beyond what any screen shows on the left. */
export const CAR_START_BEHIND = 920;
/** How long one car takes to drive in, and how soon after it the next one sets off (ms). */
export const CAR_DRIVE_MS = 560;
export const CAR_STAGGER_MS = 110;

/** How long all the cars take to arrive (ms). World 6 has none. */
export const arrivalMs = (cars: number): number => (cars > 0 ? CAR_DRIVE_MS + (cars - 1) * CAR_STAGGER_MS : 0);

/** How far short of its parking spot car `i` still is, `ms` after the first one set off: it eases to a stop. */
export function carBehind(i: number, ms: number): number {
  const k = (ms - i * CAR_STAGGER_MS) / CAR_DRIVE_MS;
  if (k <= 0) return CAR_START_BEHIND;
  if (k >= 1) return 0;
  return CAR_START_BEHIND * (1 - k) ** 3;
}
