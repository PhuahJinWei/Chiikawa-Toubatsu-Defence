// The app installs light: pictures and sounds load when a screen needs them. A while after start-up, every
// delivered file is fetched once in the background (one at a time, when the browser is idle, online only),
// so the service worker's cache ends up holding the whole game for offline play.

import { audioUrls } from '../audio/audio';
import { art } from './store';

export function warmCaches(): void {
  if (!('serviceWorker' in navigator)) return;
  const urls = [...art.allRealUrls(), ...audioUrls()];
  let i = 0;
  // Older Safari has no requestIdleCallback.
  const ric = (window as { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const idle = (fn: () => void) => {
    if (ric) ric(fn, { timeout: 4000 });
    else setTimeout(fn, 250);
  };
  const next = () => {
    if (i >= urls.length || !navigator.onLine) return;
    fetch(urls[i++])
      .catch(() => undefined)
      .finally(() => idle(next));
  };
  window.setTimeout(() => idle(next), 6000);
}
