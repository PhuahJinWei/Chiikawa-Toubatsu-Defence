import { describe, expect, it } from 'vitest';
import { glide, glideTime } from '../src/game/render/glide';

describe('how a melee picture moves', () => {
  it('starts and ends exactly where it should, whatever the time', () => {
    expect(glide(0)).toBe(0);
    expect(glide(1)).toBe(1);
    expect(glide(-1)).toBe(0);
    expect(glide(2)).toBe(1);
  });

  it('starts gently: its first frame moves it only a little of the way', () => {
    expect(glide(17 / 190)).toBeLessThan(0.08);
  });

  it('only ever moves forward', () => {
    for (let i = 1; i <= 100; i++) expect(glide(i / 100)).toBeGreaterThan(glide((i - 1) / 100));
  });

  it('knows when it reaches any point on its way, and never gives a nonsense time', () => {
    for (let i = 0; i <= 20; i++) expect(glide(glideTime(i / 20))).toBeCloseTo(i / 20, 6);
    expect(glideTime(-1)).toBeCloseTo(0, 6);
    expect(glideTime(2)).toBeCloseTo(1, 6);
  });
});
