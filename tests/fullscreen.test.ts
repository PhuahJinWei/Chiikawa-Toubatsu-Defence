import { afterEach, describe, expect, it, vi } from 'vitest';

/** A page as the full-screen switch sees it: whether full screen is allowed, and what going in and out does. */
function page(allowed: boolean, refuse = false) {
  const doc = Object.assign(new EventTarget(), {
    fullscreenEnabled: allowed,
    fullscreenElement: null as unknown,
    documentElement: {
      requestFullscreen: vi.fn(async (_options?: unknown) => {
        if (refuse) throw new TypeError('Permissions check failed');
        doc.fullscreenElement = doc.documentElement;
        doc.dispatchEvent(new Event('fullscreenchange'));
      }),
    },
    exitFullscreen: vi.fn(async () => {
      doc.fullscreenElement = null;
      doc.dispatchEvent(new Event('fullscreenchange'));
    }),
  });
  const lock = vi.fn(async (_orientation: string) => {});
  vi.stubGlobal('document', doc);
  vi.stubGlobal('screen', { orientation: { lock } });
  return { doc, lock };
}

/** A fresh copy of the switch's module, for a fresh page. */
const load = () => import('../src/app/fullscreen');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('full screen', () => {
  it('is offered only where the browser allows it (never on iPhone Safari, which has no full screen for a page)', async () => {
    expect((await load()).canFullscreen()).toBe(false);
    page(false);
    expect((await load()).canFullscreen()).toBe(false);
    page(true);
    expect((await load()).canFullscreen()).toBe(true);
  });

  it('goes full screen from a tap, holds the screen in landscape, and follows the browser in and out', async () => {
    const { doc, lock } = page(true);
    const fs = await load();
    fs.initFullscreen();
    expect(fs.isFullscreen.value).toBe(false);
    await fs.toggleFullscreen();
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });
    expect(lock).toHaveBeenCalledWith('landscape');
    expect(fs.isFullscreen.value).toBe(true);
    // Left another way (Esc, a swipe, Android's back gesture): the switch follows.
    doc.fullscreenElement = null;
    doc.dispatchEvent(new Event('fullscreenchange'));
    expect(fs.isFullscreen.value).toBe(false);
    // In again, then out with the switch itself.
    await fs.toggleFullscreen();
    await fs.toggleFullscreen();
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(fs.isFullscreen.value).toBe(false);
  });

  it('changes nothing when the browser refuses (not from a tap)', async () => {
    const { lock } = page(true, true);
    const fs = await load();
    fs.initFullscreen();
    await expect(fs.toggleFullscreen()).resolves.toBeUndefined();
    expect(fs.isFullscreen.value).toBe(false);
    expect(lock).not.toHaveBeenCalled();
  });
});
