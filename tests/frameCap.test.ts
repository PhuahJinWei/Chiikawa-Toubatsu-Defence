import { describe, expect, it } from 'vitest';
import { FrameCap } from '../src/game/frameCap';

/** Which of four seconds of a screen's refreshes get drawn, once the cap has had a second to get used to it. */
function drawn(hz: number): boolean[] {
  const cap = new FrameCap();
  const gap = 1000 / hz;
  let t = 1000;
  for (let i = 0; i < hz; i++) cap.due((t += gap));
  return Array.from({ length: Math.round(hz * 4) }, () => cap.due((t += gap)));
}

/** How many refreshes apart the pictures came. */
function spacing(marks: boolean[]): number[] {
  const at = marks.flatMap((d, i) => (d ? [i] : []));
  return at.slice(1).map((i, k) => i - at[k]);
}

describe('FrameCap', () => {
  it('draws every refresh of a screen up to about 100 Hz, and of anything slower', () => {
    for (const hz of [24, 30, 50, 59.94, 60, 60.02, 61, 75, 90, 100]) expect(drawn(hz).every(Boolean), `${hz} Hz`).toBe(true);
  });

  it('draws a faster screen evenly, a whole number of refreshes apart, as near 60 a second as that allows', () => {
    for (const [hz, every] of [
      [120, 2],
      [144, 2],
      [165, 3],
      [240, 4],
      [360, 6],
    ]) {
      expect(new Set(spacing(drawn(hz))), `${hz} Hz`).toEqual(new Set([every]));
    }
  });

  it('draws as soon as it can after a refresh missed on a busy frame, then evenly again', () => {
    const cap = new FrameCap();
    const gap = 1000 / 144;
    let t = 1000;
    for (let i = 0; i < 300; i++) cap.due((t += gap));
    expect(cap.due((t += 3 * gap))).toBe(true);
    expect(Array.from({ length: 6 }, () => cap.due((t += gap)))).toEqual([false, true, false, true, false, true]);
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
    // Soon back to every other refresh, with nothing to make up for.
    for (let i = 0; i < 30; i++) cap.due((t += 1000 / 120));
    expect(spacing(Array.from({ length: 120 }, () => cap.due((t += 1000 / 120))))).toEqual(Array(59).fill(2));
  });
});
