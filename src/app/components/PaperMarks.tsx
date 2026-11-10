// Marks made by hand on the game's paper screens (the gallery book, the level sheet): the pink pen loop that circles
// "this one", star stickers for stars earned (pencil outlines for those not yet), the ink ▼ at the foot of a page with
// more below, and the flat colour of something not known yet, cut out as a dark shape. The highlighter stroke is CSS
// only (class `hl`).

import type { RefObject } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { save } from '../../save/save';
import { tap } from './ui';

/** The flat colour of a character not known yet (only sighted, or a boss not beaten), cut out as a shape. */
export const DARK_SHAPE = '#6B5646';

/** The red stamp on a boss (the level sheet, the job notice and its details card): Japanese in either language. */
export const BOSS_STAMP = 'ボス';

/** A loop drawn round something with a pink pen, clockwise from the top and a little past where it began; it draws
 *  itself each time it appears. It means "this one" (the chosen sticker, the level to play), never decoration. */
export function PenLoop({ class: cls }: { class?: string }) {
  return (
    <svg class={cls ? `pen-loop ${cls}` : 'pen-loop'} viewBox="0 0 100 100" aria-hidden="true">
      <path pathLength="100" d="M54 5C80 6 97 25 95 52C93 79 72 96 46 95C19 93 4 73 6 47C8 22 28 4 58 9" />
    </svg>
  );
}

/** A five-pointed star in a 24 × 24 box. */
const STAR = 'M12 2.6l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.66l-5.5 2.9 1.05-6.13L3.1 9.1l6.15-.9z';

/** A star, sized by the font size: a sticker (white edge, ink outline) when earned, a pencil outline when not. */
export function StarMark({ on }: { on: boolean }) {
  return (
    <svg class={on ? 'star-mark on' : 'star-mark'} viewBox="0 0 24 24" aria-hidden="true">
      {on ? <path class="edge" d={STAR} /> : null}
      <path class="body" d={STAR} />
    </svg>
  );
}

/** How much of a page's writing must still be below the view for the ▼ to show (CSS pixels; the page's empty padding
 *  at its foot does not count). */
const MORE_SLACK = 4;

/** An ink ▼ at the foot of a page that scrolls, while there is more of it below (the "more" mark of a text box in a
 *  Japanese game): it hops now and then, goes once the page is read to its end and comes back if it is scrolled up.
 *  Tapping it scrolls on by most of a page. Put it beside the scrolling element (`scroller`), in a positioned box, and
 *  key it with the page so it measures the new one. */
export function MoreBelow({ scroller, label }: { scroller: RefObject<HTMLElement | null>; label: string }) {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => setMore(el.scrollHeight - el.clientHeight - el.scrollTop - (parseFloat(getComputedStyle(el).paddingBottom) || 0) > MORE_SLACK);
    check();
    el.addEventListener('scroll', check, { passive: true });
    // The page grows as its pictures and fonts arrive, and with the screen.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    const late = window.setTimeout(check, 500);
    return () => {
      el.removeEventListener('scroll', check);
      ro?.disconnect();
      window.clearTimeout(late);
    };
  }, [scroller]);
  if (!more) return null;
  const calm = save.value.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <button
      type="button"
      class="more-below"
      aria-label={label}
      onClick={tap(() => scroller.current?.scrollBy({ top: scroller.current.clientHeight * 0.7, behavior: calm ? 'auto' : 'smooth' }))}
    >
      <svg viewBox="0 0 24 16" aria-hidden="true">
        <path d="M3.2 3.3Q12 1.9 20.9 3.2Q22.6 3.5 21.6 5.1L13.4 14.1Q12 15.6 10.6 14.1L2.4 5.2Q1.5 3.6 3.2 3.3Z" />
      </svg>
    </button>
  );
}
