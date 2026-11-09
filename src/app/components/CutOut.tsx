// A picture cut out as a sticker: the same white die-cut edge and soft shadow the game gives every piece of its
// paper art, around whatever is drawn. Takes any picture URL (a face, say); it fills its box and the edge and
// shadow spill past it. `fill` turns the drawing into a flat shape of that colour first (a character only
// sighted), keeping the white edge around it.

import { useEffect, useRef, useState } from 'preact/hooks';
import { paperize, type StickerLook } from '../../art/paper';

interface Made {
  el: HTMLCanvasElement;
  /** The edge and shadow's room around the picture, as a share of its size. */
  pad: number;
}

/** Cut-outs already made, by picture, size and shape colour (a face shows in more than one place). */
const MADE = new Map<string, Made>();
const keyOf = (src: string, px: number, fill?: string) => `${src}|${px}|${fill ?? ''}`;

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** The cut-out of a loaded picture at a size and shape colour, made once. */
function cutOutOf(img: HTMLImageElement, src: string, px: number, fill?: string): Made {
  const key = keyOf(src, px, fill);
  const hit = MADE.get(key);
  if (hit) return hit;
  const w = img.naturalWidth || 256;
  const h = img.naturalHeight || 256;
  // The edge in the picture's own pixels, the same share of its size whatever size it was drawn at.
  const s = Math.max(w, h);
  const look: StickerLook = { border: s * 0.045, bridge: s * 0.03, pad: s * 0.13, shadow: 0.7 };
  // Drawn at the size it shows at on this screen, never bigger than 2×.
  const q = Math.min(2, Math.max(0.25, (px * Math.min(window.devicePixelRatio || 1, 3)) / s));
  let pic: CanvasImageSource = img;
  if (fill) {
    // The flat shape: the picture's pixels in its colour. Drawn in main memory, where the cut (which reads the pixels
    // for the outline) is quick: reading a GPU-backed canvas back costs tens of milliseconds a time.
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * q));
    c.height = Math.max(1, Math.round(h * q));
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    pic = c;
  }
  const made = { el: paperize(pic, w, h, q, true, look).el, pad: look.pad / s };
  MADE.set(key, made);
  return made;
}

/** Make a picture's cut-out ahead of time (the gallery does it for its other tabs in spare moments), so it shows at
 *  once when it is needed. */
export async function warmCutOut(src: string, px: number, fill?: string): Promise<void> {
  if (MADE.has(keyOf(src, px, fill))) return;
  try {
    cutOutOf(await load(src), src, px, fill);
  } catch {
    /* a picture that does not load just shows later */
  }
}

/** A copy of a cut-out's canvas (one canvas can be in one place only). */
function copyOf(el: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = el.width;
  c.height = el.height;
  c.getContext('2d')?.drawImage(el, 0, 0);
  return c;
}

export function CutOut({ src, px, fill }: { src: string; px: number; fill?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  // One already made shows at once, with no round trip through the picture (the gallery's faces come back as its
  // tabs change).
  const [made, setMade] = useState<Made | null>(() => MADE.get(keyOf(src, px, fill)) ?? null);
  useEffect(() => {
    const hit = MADE.get(keyOf(src, px, fill));
    if (hit) {
      setMade(hit);
      return;
    }
    let alive = true;
    load(src)
      .then((img) => {
        if (alive) setMade(cutOutOf(img, src, px, fill));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [src, px, fill]);
  useEffect(() => {
    const b = box.current;
    if (!b || !made || made.el.parentNode === b) return;
    b.replaceChildren(made.el.isConnected ? copyOf(made.el) : made.el);
  }, [made]);
  return <span class="cut-out" ref={box} style={{ '--pad': made?.pad ?? 0 }} aria-hidden="true" />;
}
