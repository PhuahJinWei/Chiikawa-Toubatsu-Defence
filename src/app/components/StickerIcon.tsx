// A game picture shown as a sticker: the picture (the owner's, or its placeholder) cut out with the same white
// die-cut edge and shadow the game gives scene pieces. It fills its box, which takes the picture's shape; the edge and
// shadow spill past it.

import { useEffect, useRef, useState } from 'preact/hooks';
import { paperize, type StickerLook } from '../../art/paper';
import { imageSpec } from '../../art/spec';
import { art } from '../../art/store';

/** The sticker edge for a picture 360 across; a bigger picture (the lobby's buttons are 600 tall) gets it scaled up, so
 *  the edge keeps its share of the picture. */
const ICON_LOOK: StickerLook = { border: 14, bridge: 10, pad: 44, shadow: 0.75 };

/** A look made for pictures 360 across, for a picture `s` times that. */
function scaled(l: StickerLook, s: number): StickerLook {
  return s === 1 ? l : { border: l.border * s, bridge: l.bridge * s, pad: Math.round(l.pad * s), shadow: l.shadow * s };
}

/** `px` is the most the picture's longer side shows at on screen. */
export function StickerIcon({ k, px }: { k: string; px: number }) {
  const box = useRef<HTMLSpanElement>(null);
  const [el, setEl] = useState<HTMLCanvasElement | null>(null);
  const spec = imageSpec(k);
  const side = spec ? Math.max(spec.w, spec.h) : 360;
  const look = scaled(ICON_LOOK, side / 360);
  useEffect(() => {
    if (!spec) return;
    let alive = true;
    art.load([k]).then(() => {
      if (!alive) return;
      // Drawn at the size it will show at on this screen, never bigger than 2×.
      const q = Math.min(2, Math.max(0.3, (px * Math.min(window.devicePixelRatio || 1, 3)) / side));
      // Drawn in main memory: the cut reads its pixels for the outline, and reading a GPU-backed canvas back costs
      // tens of milliseconds a time.
      const c = document.createElement('canvas');
      c.width = Math.round(spec.w * q);
      c.height = Math.round(spec.h * q);
      const src = art.loaded(k) ?? art.placeholder(k);
      if (src) {
        // The picture as drawn, fitted into the spot and centred: a wide ticket keeps its shape in a square spot.
        const sw = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
        const sh = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
        const fit = sw > 0 && sh > 0 ? Math.min(c.width / sw, c.height / sh) : 1;
        const dw = sw > 0 ? sw * fit : c.width;
        const dh = sh > 0 ? sh * fit : c.height;
        c.getContext('2d', { willReadFrequently: true })?.drawImage(src, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
      }
      setEl(paperize(c, spec.w, spec.h, q, true, look).el);
    });
    return () => {
      alive = false;
    };
  }, [k, px]);
  useEffect(() => {
    const b = box.current;
    if (b && el && el.parentNode !== b) b.replaceChildren(el);
  }, [el]);
  if (!spec) return null;
  return <span class="sticker-icon" ref={box} style={{ '--pad-x': look.pad / spec.w, '--pad-y': look.pad / spec.h }} aria-hidden="true" />;
}
