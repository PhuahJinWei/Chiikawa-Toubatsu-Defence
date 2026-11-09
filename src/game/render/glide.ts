// How a melee blow's picture moves: it starts gently, quickens and settles, so it never jumps on its first frame.

/** How far along it is (0 to 1), `k` of the way through its time. */
export const glide = (k: number): number => {
  const x = Math.min(1, Math.max(0, k)) ** 0.8;
  return x * x * (3 - 2 * x);
};

/** The other way round: how far through its time (0 to 1) it has come `q` of the way. */
export const glideTime = (q: number): number => Math.max(0, 0.5 - Math.sin(Math.asin(1 - 2 * Math.min(1, Math.max(0, q))) / 3)) ** 1.25;
