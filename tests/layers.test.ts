import { describe, expect, it } from 'vitest';
import { drawKey } from '../src/game/render/layers';

describe('the battle draw order', () => {
  it('puts a nearer lane in front, friend or enemy, and within a lane every enemy over every friend', () => {
    // A tall friend's head comes in front of an enemy in the lane behind it, wherever each stands along the lanes.
    expect(drawKey(3, false, 0)).toBeGreaterThan(drawKey(2, true, 9000));
    // An enemy in a nearer lane comes in front of a friend further back.
    expect(drawKey(3, true, 0)).toBeGreaterThan(drawKey(2, false, 9000));
    // Whoever bites a friend stays in view.
    expect(drawKey(2, true, 0)).toBeGreaterThan(drawKey(2, false, 9000));
    // Among the enemies of a lane, whoever's feet are lower is in front.
    expect(drawKey(2, true, 11)).toBeGreaterThan(drawKey(2, true, 10));
  });
});
