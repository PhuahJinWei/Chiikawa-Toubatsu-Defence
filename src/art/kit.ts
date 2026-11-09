// The little the game still draws by hand: its ink colour, its font stack, and a seeded random for decoration that has
// to come out the same every time (paper edges, name plates). The code-drawn placeholder art that used to live beside
// these was retired on 2026-11-09, once every picture had the owner's art (it is in the repository's first commit).

export const INK = '#3B2F2F';

export const FONT_STACK = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", "Meiryo", system-ui, sans-serif';

/** Deterministic pseudo-random for decoration (same output every time). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
