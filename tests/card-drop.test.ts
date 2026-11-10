import { describe, expect, it } from 'vitest';
import { dropLanding } from '../src/app/cardDrop';

const field = { left: 100, top: 60, right: 900, bottom: 400 };
const card = { w: 88, h: 66 };

describe('a new friend’s card, dropped by the last enemy to fall (owner’s call, 2026-11-10)', () => {
  it('lands a little nearer the base than the enemy that dropped it', () => {
    const at = dropLanding({ x: 500, y: 200 }, field, card);
    expect(at.x).toBeLessThan(500);
    expect(at.y).toBeGreaterThan(200);
  });

  it('always lands wholly in the open field, clear of the card column and the top strip', () => {
    for (const from of [
      { x: 2000, y: 1000 },
      { x: -50, y: -50 },
      { x: 110, y: 70 },
      { x: 899, y: 399 },
    ]) {
      const at = dropLanding(from, field, card);
      expect(at.x - card.w / 2).toBeGreaterThanOrEqual(field.left);
      expect(at.x + card.w / 2).toBeLessThanOrEqual(field.right);
      expect(at.y - card.h / 2).toBeGreaterThanOrEqual(field.top);
      expect(at.y + card.h / 2).toBeLessThanOrEqual(field.bottom);
    }
  });

  it('waits in the middle of the field when the field cannot say where the last enemy fell', () => {
    expect(dropLanding(null, field, card)).toEqual({ x: 500, y: 230 });
  });

  it('keeps off the win’s banner: below it, or above it where there is no room below', () => {
    const banner = { left: 380, top: 180, right: 620, bottom: 240 };
    const off = (at: { x: number; y: number }) => at.y - card.h / 2 >= banner.bottom || at.y + card.h / 2 <= banner.top;
    const below = dropLanding({ x: 520, y: 190 }, field, card, banner);
    expect(off(below)).toBe(true);
    expect(below.y).toBeGreaterThan(banner.bottom);
    const low = { left: 380, top: 290, right: 620, bottom: 380 };
    const above = dropLanding({ x: 520, y: 300 }, field, card, low);
    expect(above.y + card.h / 2).toBeLessThanOrEqual(low.top);
    // Clear of it already: where it would land anyway.
    expect(dropLanding({ x: 820, y: 330 }, field, card, banner)).toEqual(dropLanding({ x: 820, y: 330 }, field, card));
  });
});
