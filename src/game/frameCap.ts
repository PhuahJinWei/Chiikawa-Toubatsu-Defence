// A battle's simulation moves 60 times a second, so a screen that refreshes faster than that gains next to nothing from
// a picture on every refresh, and a 120 Hz phone would do twice the drawing for it. This says which refreshes to draw.

const FRAME_MS = 1000 / 60;
/** A picture may come this much early (ms): a 120 Hz screen's second refresh falls due at almost exactly FRAME_MS. */
const EARLY_MS = 2;
/** Refreshes this close together on average (ms) are a fast screen, 80 Hz or more. Slower ones draw every refresh, so a
 *  60 Hz screen never drops a frame to a wobble in its timing. */
const FAST_SCREEN_MS = 12.5;
/** How quickly the average follows the screen: about a dozen refreshes to notice a change. */
const FOLLOW = 0.1;
/** The longest gap counted (ms): coming back from another tab does not make it a slow screen. */
const LONGEST_MS = 50;

export class FrameCap {
  private last = 0;
  private gap = FRAME_MS;
  /** Time passed that no picture has answered yet (ms). */
  private owed = 0;

  /** Whether to draw on the animation frame at `ts`. */
  due(ts: number): boolean {
    const gap = Math.min(ts - this.last, LONGEST_MS);
    this.last = ts;
    this.gap += (gap - this.gap) * FOLLOW;
    if (this.gap >= FAST_SCREEN_MS) {
      this.owed = 0;
      return true;
    }
    this.owed += gap;
    if (this.owed < FRAME_MS - EARLY_MS) return false;
    // What is left over carries to the next picture (so a 144 Hz screen averages 60), but a hiccup is not made up for.
    this.owed = Math.max(0, Math.min(this.owed - FRAME_MS, FRAME_MS / 2));
    return true;
  }
}
