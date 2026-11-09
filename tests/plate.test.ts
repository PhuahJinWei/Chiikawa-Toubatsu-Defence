import { describe, expect, it } from 'vitest';
import { plateMargin, platePaths } from '../src/app/components/Plate';

/** The loops of a path written as "Mx,yLx,y…Z", each as its points. */
const loops = (d: string) =>
  d
    .split('Z')
    .filter(Boolean)
    .map((loop) => loop.slice(1).split('L').map((p) => p.split(',').map(Number) as [number, number]));

/** The smallest box round some points. */
const bounds = (pts: [number, number][]) => ({
  x0: Math.min(...pts.map(([x]) => x)),
  x1: Math.max(...pts.map(([x]) => x)),
  y0: Math.min(...pts.map(([, y]) => y)),
  y1: Math.max(...pts.map(([, y]) => y)),
});

/** Plates as the game draws them: the quest board's name, a long sheet title, a seller's tag in the shop (stage
 *  pixels, thicker ink), and a short one. Width, height, ink, cut edge, its shadow. */
const PLATES = [
  [130, 41.5, 3, 3, 3],
  [262, 32, 3, 3, 3],
  [318, 61, 4, 5, 6],
  [64, 30, 3, 3, 3],
] as const;
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);

describe('hand-drawn name plates', () => {
  it('draw the same plate for the same words, and another for other words', () => {
    expect(platePaths(200, 40, 3, 3, 3, 12)).toEqual(platePaths(200, 40, 3, 3, 3, 12));
    expect(platePaths(200, 40, 3, 3, 3, 12).ink).not.toBe(platePaths(200, 40, 3, 3, 3, 13).ink);
  });

  it('ink a line that swells and thins but never breaks, where the plain border was', () => {
    for (const [w, h, ink, rim, drop] of PLATES) {
      for (const seed of SEEDS) {
        const [outer, inner] = loops(platePaths(w, h, ink, rim, drop, seed).ink);
        expect(inner.length).toBe(outer.length);
        // The inner edge is written the other way round, so the ring closes.
        const widths = outer.map(([ox, oy], i) => {
          const [ix, iy] = inner[outer.length - 1 - i];
          return Math.hypot(ox - ix, oy - iy);
        });
        const thinnest = Math.min(...widths);
        const thickest = Math.max(...widths);
        expect(thinnest).toBeGreaterThan(ink * 0.5);
        expect(thickest).toBeLessThan(ink * 1.6);
        expect(thickest - thinnest).toBeGreaterThan(ink * 0.2);
        // Never far from the plate's own box (the border it replaces ran round its edge).
        const b = bounds(outer);
        expect(b.x0).toBeGreaterThan(-ink);
        expect(b.x1).toBeLessThan(w + ink);
        expect(b.y0).toBeGreaterThan(-ink);
        expect(b.y1).toBeLessThan(h + ink);
      }
    }
  });

  it('keep the cut edge and its shadow inside the room the drawing has round the plate', () => {
    for (const [w, h, ink, rim, drop] of PLATES) {
      const m = plateMargin(ink, rim, drop);
      for (const seed of SEEDS) {
        const p = platePaths(w, h, ink, rim, drop, seed);
        const b = bounds([...loops(p.cut)[0], ...loops(p.drop)[0]]);
        expect(b.x0).toBeGreaterThan(-m);
        expect(b.x1).toBeLessThan(w + m);
        expect(b.y0).toBeGreaterThan(-m);
        expect(b.y1).toBeLessThan(h + m);
        // The cut edge stands out past the ink all round: each of its points lies further out along the same line
        // across the outline (measured from the outline's inner edge) than the ink's outer edge does.
        const [outer, inner] = loops(p.ink);
        const cut = loops(p.cut)[0];
        const n = outer.length;
        const margins = outer.map(([ox, oy], i) => {
          const [ix, iy] = inner[n - 1 - i];
          const [cx, cy] = cut[i];
          return Math.hypot(cx - ix, cy - iy) - Math.hypot(ox - ix, oy - iy);
        });
        expect(Math.min(...margins)).toBeGreaterThan(rim * 0.5);
      }
    }
  });
});
