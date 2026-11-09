// Stickers at run time: a picture with its white cut edge and shadow, cut once at the resolution the screen needs and
// kept. Every character frame, effect and pickup on the field is drawn from one of these.

import { FIELD_LOOK, paperize, type StickerLook } from './paper';
import { art, type Picture } from './store';

interface Sticker {
  el: HTMLCanvasElement;
  pad: number;
}

/** Sticker canvases (border and shadow added) at the resolution the screen needs, built once per picture. */
export class StickerCache {
  private cache = new Map<string, Sticker>();
  /** Device pixels per field pixel. */
  private device = 1;

  /** The screen's scale changed: stickers cut for the old one are dropped when it differs enough to show. True when
   *  they were, so whoever cuts ahead of time (the battle renderer) can start again. */
  setDeviceScale(k: number): boolean {
    const changed = Math.abs(k - this.device) / this.device > 0.12;
    if (changed) this.cache.clear();
    this.device = k;
    return changed;
  }

  /**
   * The sticker for a picture drawn w × h units big, where one unit is `unit` field pixels (a character's scale for its
   * frames, 1 for things measured in field pixels). The border and shadow keep their field size. `maxQ` caps how many
   * of the sticker's pixels go to one unit (a sprite frame is never cut finer than it was drawn).
   */
  get(key: string, w: number, h: number, unit: number, edge = true, look: StickerLook = FIELD_LOOK, maxQ = 2.5): Sticker | undefined {
    const id = `${key}|${w}x${h}|${unit.toFixed(4)}|${edge ? 1 : 0}|${maxQ}`;
    const hit = this.cache.get(id);
    if (hit) return hit;
    const src: Picture | undefined = art.image(key);
    if (!src) return undefined;
    const q = Math.min(maxQ, 2.5, Math.max(0.25, this.device * unit));
    const scaled: StickerLook = { border: look.border / unit, bridge: look.bridge / unit, pad: look.pad / unit, shadow: look.shadow / unit };
    const out = paperize(src, w, h, q, edge, scaled);
    const st = { el: out.el, pad: out.pad };
    this.cache.set(id, st);
    return st;
  }

  clear(): void {
    this.cache.clear();
  }
}
