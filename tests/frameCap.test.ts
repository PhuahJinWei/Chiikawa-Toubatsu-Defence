import { describe, expect, it } from 'vitest';
import { FrameCap } from '../src/game/frameCap';

/** The share of a screen's refreshes that get drawn, once the cap has had a second to get used to it. */
function drawn(hz: number): { perSecond: number; share: number } {
  const cap = new FrameCap();
  const gap = 1000 / hz;
  let t = 1000;
  for (let i = 0; i < hz; i++) cap.due((t += gap));
  const frames = Math.round(hz * 4);
  let n = 0;
  for (let i = 0; i < frames; i++) if (cap.due((t += gap))) n++;
  return { perSecond: n / 4, share: n / frames };
}

describe('FrameCap', () => {
  it('draws every refresh of a screen at 60 Hz or so, and of anything slower', () => {
    for (const hz of [24, 30, 50, 59.94, 60, 60.02, 61, 75]) expect(drawn(hz).share, `${hz} Hz`).toBe(1);
  });

  it('draws about 60 pictures a second on a faster screen', () => {
    for (const hz of [90, 120, 144, 165, 240, 360]) {
      const { perSecond } = drawn(hz);
      expect(perSecond, `${hz} Hz`).toBeGreaterThanOrEqual(58);
      expect(perSecond, `${hz} Hz`).toBeLessThanOrEqual(64);
    }
  });

  it('does not drop a frame of a 60 Hz screen for one refresh that came early', () => {
    const cap = new FrameCap();
    let t = 1000;
    for (let i = 0; i < 120; i++) expect(cap.due((t += 1000 / 60))).toBe(true);
    expect(cap.due((t += 8))).toBe(true);
    expect(cap.due((t += 1000 / 60))).toBe(true);
  });

  it('goes back to drawing every refresh when a fast screen cannot keep up', () => {
    const cap = new FrameCap();
    let t = 1000;
    for (let i = 0; i < 240; i++) cap.due((t += 1000 / 120));
    for (let i = 0; i < 30; i++) cap.due((t += 25));
    for (let i = 0; i < 30; i++) expect(cap.due((t += 25))).toBe(true);
  });

  it('counts a long gap, such as coming back from another tab, as no more than a slow frame', () => {
    const cap = new FrameCap();
    let t = 1000;
    for (let i = 0; i < 240; i++) cap.due((t += 1000 / 120));
    expect(cap.due((t += 60_000))).toBe(true);
    // Straight back to every other refresh, with nothing to make up for.
    let n = 0;
    for (let i = 0; i < 120; i++) if (cap.due((t += 1000 / 120))) n++;
    expect(n).toBeGreaterThanOrEqual(58);
    expect(n).toBeLessThanOrEqual(64);
  });
});
