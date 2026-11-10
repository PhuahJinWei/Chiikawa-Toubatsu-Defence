// The owner's hand stamp (判子, seen from above) pressing a red stamp onto the paper the moment it is earned: it slides
// in from the right, stops over the spot, presses down, holds, and lifts away fading, leaving the ink. Each stamp is
// pressed once, the first time it is well in view (the save remembers it once the ink is on); after that it is simply
// there. With reduced motion the ink just appears. The hand moves with the paper (see HandStampHost), and goes when
// the paper does.

import { signal } from '@preact/signals';
import type { ComponentChildren, RefObject } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { art } from '../../art/store';
import { audio } from '../../audio/audio';
import { save, updateSave } from '../../save/save';

/** The press in progress: its stamp, where (in the app's own coordinates) and how wide the hand stamp is drawn, and
 *  how far away (to the right, off the screen) it comes in from. */
const pressing = signal<{ key: number; el: HTMLElement; x: number; y: number; size: number; fromX: number; fromY: number } | null>(null);
/** The presses whose ink has not landed yet: their stamp, and the timer that lands it. */
const pending = new Map<HTMLElement, number>();

/** How long a screen takes to settle before a stamp is pressed on it (ms). */
const SETTLE_MS = 500;
/** When the ink lands, from the start of the press, and how long the whole press takes (ms); see hand-press: in from
 *  the right 0.4 s, a little aim, down at 0.62 s, held, then lifted away fading. */
const INK_AT = 620;
const PRESS_MS = 1150;
/** The hand stamp is a little wider than the mark it leaves. */
const HAND_SIZE = 1.45;

const calm = () => save.value.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function remember(id: string): void {
  updateSave((d) => {
    if (!d.stamped.includes(id)) d.stamped.push(id);
  });
}

/** Wait for whatever is still carrying the stamp in (a card sliding in, the board zooming) to stop, so the hand
 *  lands where the stamp ends up. Looping motions (a gentle bob) are ignored; never waits more than a second. */
async function settled(el: HTMLElement): Promise<void> {
  const moving = document.getAnimations().filter((a) => {
    const target = (a.effect as KeyframeEffect | null)?.target;
    return target instanceof Element && target !== el && target.contains(el) && a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity;
  });
  if (!moving.length) return;
  await Promise.race([Promise.all(moving.map((a) => a.finished.catch(() => undefined))), new Promise((r) => window.setTimeout(r, 1000))]);
}

/** Press a red stamp now: the hand comes down on `el` and leaves the ink (with reduced motion the ink just appears),
 *  and `onInk` runs as it lands. For a stamp pressed every time rather than earned once, like 「受注」 on a job notice. */
export function pressNow(el: HTMLElement, onInk?: () => void): void {
  el.classList.remove('unstamped');
  if (calm()) {
    onInk?.();
    return;
  }
  const app = el.closest('.app') ?? document.body;
  const a = app.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * HAND_SIZE;
  const x = r.left + r.width / 2 - a.left;
  // It comes in from just past the right edge of the screen, a little higher than the spot.
  pressing.value = { key: Date.now(), el, x, y: r.top + r.height / 2 - a.top, size, fromX: a.width + size * 0.6 - x, fromY: -size * 0.3 };
  el.classList.add('inking');
  window.clearTimeout(pending.get(el));
  pending.set(
    el,
    window.setTimeout(() => {
      pending.delete(el);
      audio.sfx('sfx_stamp');
      onInk?.();
    }, INK_AT),
  );
}

/** `el`'s paper is going (the screen changes, the page turns) before the hand has come down on it: the hand goes with
 *  it, and an earned stamp is left for next time. Once the ink is on, the hand just lifts away as usual. */
export function callOff(el: HTMLElement): void {
  const ink = pending.get(el);
  if (ink === undefined) return;
  window.clearTimeout(ink);
  pending.delete(el);
  if (pressing.value?.el === el) pressing.value = null;
}

/** An earned stamp is remembered once its ink is on the paper. */
function press(el: HTMLElement, id: string): void {
  pressNow(el, () => remember(id));
}

/** Press the red stamp in `ref` with the hand stamp the first time it is well in view (once per `id`). Until then it
 *  is hidden: the ink is not on the paper yet. */
function useHandStamp(ref: RefObject<HTMLElement | null>, id: string | null): void {
  // Before the first paint, so an unpressed stamp never flashes up.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !id || save.value.stamped.includes(id)) return;
    if (calm()) {
      remember(id);
      return;
    }
    el.classList.add('unstamped');
    void art.load(['ui/hand_stamp']);
    let alive = true;
    let timer = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        timer = window.setTimeout(async () => {
          await settled(el);
          if (alive && el.isConnected) press(el, id);
        }, 120);
      },
      { threshold: 0.6 },
    );
    const start = window.setTimeout(() => io.observe(el), SETTLE_MS);
    return () => {
      alive = false;
      window.clearTimeout(start);
      window.clearTimeout(timer);
      io.disconnect();
      callOff(el);
      el.classList.remove('unstamped', 'inking');
    };
  }, [id]);
}

/** A red stamp that the hand stamp presses the first time it is seen. `label` is what it means, read out in the
 *  player's language (the stamp itself is always Japanese). */
export function EarnedStamp({ id, class: cls, label, title, children }: { id: string; class: string; label: string; title?: string; children: ComponentChildren }) {
  const ref = useRef<HTMLSpanElement>(null);
  useHandStamp(ref, id);
  return (
    <span ref={ref} class={cls} role="img" aria-label={label} title={title}>
      {children}
    </span>
  );
}

/** The boxes that clip what `el` shows (scrolling lists, pages with hidden overflow), between it and the app. */
function clippers(el: HTMLElement, app: Element): Element[] {
  const out: Element[] = [];
  for (let n = el.parentElement; n && n !== app; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (s.overflowX !== 'visible' || s.overflowY !== 'visible') out.push(n);
  }
  return out;
}

/** Where the hand stamp is drawn, over everything (once, at the app's top level). It follows its stamp every frame,
 *  so a list scrolling, a page turning or the camera gliding carries the hand along with the paper; it hides while
 *  the stamp is scrolled out of its box, and goes at once if the stamp leaves the screen (a screen change). */
export function HandStampHost() {
  const p = pressing.value;
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!p) return;
    const done = () => {
      if (pressing.value?.key === p.key) pressing.value = null;
    };
    const id = window.setTimeout(done, PRESS_MS);
    const app = p.el.closest('.app') ?? document.body;
    const clips = clippers(p.el, app);
    let raf = 0;
    const follow = () => {
      if (!p.el.isConnected) return done();
      const img = ref.current;
      if (img) {
        const a = app.getBoundingClientRect();
        const r = p.el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const shown = r.width > 0 && clips.every((c) => {
          const b = c.getBoundingClientRect();
          return cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom;
        });
        img.style.left = `${cx - a.left}px`;
        img.style.top = `${cy - a.top}px`;
        if (r.width > 0) img.style.width = `${Math.max(r.width, r.height) * HAND_SIZE}px`;
        img.style.visibility = shown ? '' : 'hidden';
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => {
      window.clearTimeout(id);
      cancelAnimationFrame(raf);
    };
  }, [p?.key]);
  if (!p) return null;
  return (
    <img
      key={p.key}
      ref={ref}
      class="hand-stamp"
      src={art.imageUrl('ui/hand_stamp')}
      alt=""
      draggable={false}
      style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${p.size}px`, '--from-x': `${p.fromX}px`, '--from-y': `${p.fromY}px` }}
    />
  );
}
