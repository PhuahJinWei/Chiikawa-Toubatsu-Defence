import { describe, expect, it } from 'vitest';
import { StickerCache } from '../src/art/sticker';

/** Something cut, standing in for a sticker (the cache is private, and cutting a real one needs a canvas). */
function cut(stickers: StickerCache, key: string): { width: number; height: number } {
  const el = { width: 64, height: 64 };
  (stickers as unknown as { cache: Map<string, unknown> }).cache.set(key, { el, pad: 0 });
  return el;
}
const size = (stickers: StickerCache) => (stickers as unknown as { cache: Map<string, unknown> }).cache.size;

describe('StickerCache', () => {
  it('cuts again once the screen has grown enough, however little at a time it grew', () => {
    const stickers = new StickerCache();
    expect(stickers.setDeviceScale(1)).toBe(false);
    const el = cut(stickers, 'a picture');
    expect([1.04, 1.08, 1.1, 1.13].map((k) => stickers.setDeviceScale(k))).toEqual([false, false, false, true]);
    expect(size(stickers)).toBe(0);
    // The old sticker's canvas is let go of at once.
    expect(el).toEqual({ width: 0, height: 0 });
  });

  it('keeps what it cut through small changes, and takes the size it is first given', () => {
    const stickers = new StickerCache();
    expect(stickers.setDeviceScale(2)).toBe(false);
    cut(stickers, 'a picture');
    expect(stickers.setDeviceScale(2.1)).toBe(false);
    expect(size(stickers)).toBe(1);
    // Measured from 2, not from 1: 2.3 is 15% larger.
    expect(stickers.setDeviceScale(2.3)).toBe(true);
  });

  it('lets go of every canvas when the battle is over', () => {
    const stickers = new StickerCache();
    const els = [cut(stickers, 'a'), cut(stickers, 'b')];
    stickers.dispose();
    expect(size(stickers)).toBe(0);
    for (const el of els) expect(el).toEqual({ width: 0, height: 0 });
  });
});
