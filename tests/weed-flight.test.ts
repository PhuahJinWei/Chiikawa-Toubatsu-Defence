import { describe, expect, it } from 'vitest';
import { flightFrames } from '../src/game/render/weedFlight';

describe('a collected 草 flying to the counter', () => {
  const from = { x: 560, y: 286 };
  const to = { x: 23.5, y: 21 };
  const frames = flightFrames(from, to, 57, 38);

  it('takes off where it was picked and lands exactly on the badge, at the size of the picture there', () => {
    expect(frames[0]).toEqual({ ...from, size: 57 });
    const last = frames[frames.length - 1];
    expect(last.x).toBeCloseTo(to.x, 6);
    expect(last.y).toBeCloseTo(to.y, 6);
    expect(last.size).toBeCloseTo(38, 6);
  });

  it('bows upward on the way and only ever shrinks', () => {
    const mid = frames[Math.floor(frames.length / 2)];
    expect(mid.y).toBeLessThan((from.y + to.y) / 2);
    for (let i = 1; i < frames.length; i++) expect(frames[i].size).toBeLessThanOrEqual(frames[i - 1].size);
  });
});
