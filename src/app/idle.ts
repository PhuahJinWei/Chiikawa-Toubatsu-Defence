// Waiting for a moment the browser has to spare, for work done ahead of time (cutting stickers before a page shows
// them) without getting in the way of taps and animation.

/** Resolves when the browser is next idle (or after half a second at most). */
export function whenIdle(): Promise<void> {
  return new Promise((done) => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => done(), { timeout: 500 });
    else setTimeout(done, 40);
  });
}
