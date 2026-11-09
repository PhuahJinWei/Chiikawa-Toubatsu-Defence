import { describe, expect, it } from 'vitest';
import { WORLD_FIELD } from '../src/art/spec';
import { arrivalMs, CAR_DRIVE_MS, CAR_STAGGER_MS, CAR_START_BEHIND, carBehind, PARKED_X } from '../src/game/render/arrival';

describe("Rakko's cars arriving before a battle", () => {
  it('set off from beyond anything a screen shows on the left', () => {
    // The picture's left edge is 600 field pixels left of the field, and carries on under the cards; a car is about 150 wide.
    expect(PARKED_X - CAR_START_BEHIND + 90).toBeLessThan(-WORLD_FIELD.x);
  });

  it('come one lane after another and are all parked when the time is up', () => {
    const n = 5;
    const end = arrivalMs(n);
    for (let i = 0; i < n; i++) {
      expect(carBehind(i, 0)).toBe(CAR_START_BEHIND);
      expect(carBehind(i, end)).toBe(0);
    }
    // The first is on its way while the second has yet to set off.
    expect(carBehind(0, CAR_STAGGER_MS / 2)).toBeLessThan(CAR_START_BEHIND);
    expect(carBehind(1, CAR_STAGGER_MS / 2)).toBe(CAR_START_BEHIND);
  });

  it('slow to a stop without going past the parking spot', () => {
    let last = CAR_START_BEHIND;
    let lastStep = Infinity;
    for (let ms = 40; ms <= CAR_DRIVE_MS; ms += 40) {
      const now = carBehind(0, ms);
      expect(now).toBeGreaterThanOrEqual(0);
      expect(now).toBeLessThan(last);
      expect(last - now).toBeLessThan(lastStep);
      lastStep = last - now;
      last = now;
    }
  });

  it('take no time when there are none (World 6)', () => {
    expect(arrivalMs(0)).toBe(0);
  });
});
