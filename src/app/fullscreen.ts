// Full screen, where the browser allows it (owner's call, 2026-11-10): more of a small screen for the game, the Galaxy
// Z Fold's cover screen above all, with no address bar or system bars in the way. Switched from the lobby's top-right
// corner or the pause panel. A browser goes full screen only from a tap, and forgets it on every reload. iPhone Safari
// never lets a page go full screen (only a video): there the button is not shown, and Add to Home Screen, which the
// lobby offers on iOS, gives the game the same room.

import { signal } from '@preact/signals';

type Doc = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type Root = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type Turnable = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

const doc = (): Doc | null => (typeof document === 'undefined' ? null : (document as Doc));

const fullscreenNow = (): Element | null => {
  const d = doc();
  return d ? (d.fullscreenElement ?? d.webkitFullscreenElement ?? null) : null;
};

/** Whether this browser lets the game go full screen (false on iPhone Safari). */
export function canFullscreen(): boolean {
  const d = doc();
  return !!d && !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

/** Whether the game is full screen now. Kept in step with the browser: Esc, the back gesture or a swipe can end it. */
export const isFullscreen = signal(false);

let watching = false;

export function initFullscreen(): void {
  const d = doc();
  if (!d || watching) return;
  watching = true;
  const sync = () => (isFullscreen.value = !!fullscreenNow());
  d.addEventListener('fullscreenchange', sync);
  d.addEventListener('webkitfullscreenchange', sync);
  sync();
}

/** Go full screen, or leave it. Only from a tap (a browser refuses otherwise, and then nothing changes). Going in, an
 *  Android phone also lets the game hold the screen in landscape, so the turn-your-phone prompt cannot come up while
 *  it lasts; leaving lets go of that. */
export async function toggleFullscreen(): Promise<void> {
  const d = doc();
  if (!d) return;
  try {
    if (fullscreenNow()) {
      await (d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.());
      return;
    }
    const root = d.documentElement as Root;
    await (root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen?.());
    const orientation = typeof screen === 'undefined' ? undefined : (screen.orientation as Turnable | undefined);
    await orientation?.lock?.('landscape').catch(() => {});
  } catch {
    /* refused: not from a tap, or not allowed here */
  }
}
