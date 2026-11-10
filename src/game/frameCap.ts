// A battle's simulation moves 60 times a second, so a screen that refreshes faster than that gains next to nothing from
// a picture on every refresh, and a 120 Hz phone would do twice the drawing for it. This says which refreshes to draw:
// every one on a screen up to about 100 Hz, else every second, third… one, whichever comes nearest 60 a second. Always a
// whole number of refreshes apart, so the pictures come evenly: 60 a second on a 90 Hz screen would come one, then two
// refreshes apart, over and over, which judders (2026-11-10 audit). The renderer draws everything where it is at the
// moment drawn, so 72 pictures a second at 144 Hz move as smoothly as 60.

const FRAME_MS = 1000 / 60;
/** How quickly the measured refresh follows the screen: about a dozen refreshes to notice a change. */
const FOLLOW = 0.1;
/** The longest gap counted (ms): coming back from another tab does not make it a slow screen. */
const LONGEST_MS = 50;
/** Where every other refresh starts, and every third…: from 1.7 times 60 Hz (102 Hz) up, so a 90 or 100 Hz screen draws
 *  every refresh, 120 and 144 Hz every other one (60 and 72 a second), 165 Hz every third (55), 240 Hz every fourth,
 *  and no common rate sits on the edge between two. */
const ROUND_UP = 0.3;

export class FrameCap {
  private last = 0;
  /** When the last picture was drawn. */
  private drawn = -Infinity;
  /** The screen's time from one refresh to the next, as measured (ms). */
  private period = FRAME_MS;

  /** Whether to draw on the animation frame at `ts`. */
  due(ts: number): boolean {
    this.period += (Math.min(ts - this.last, LONGEST_MS) - this.period) * FOLLOW;
    this.last = ts;
    const every = Math.max(1, Math.floor(FRAME_MS / this.period + ROUND_UP));
    // Half a refresh early is on time: a refresh missed on a busy frame does not cost another, and a screen that cannot
    // keep up has every frame it manages drawn.
    if (every > 1 && ts - this.drawn < (every - 0.5) * this.period) return false;
    this.drawn = ts;
    return true;
  }
}
