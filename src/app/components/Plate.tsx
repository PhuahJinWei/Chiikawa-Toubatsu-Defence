// A name plate's paper, drawn behind its words the way the owner's buttons are drawn: a pastel pill whose outline
// is inked by hand (it wobbles a little, and swells and thins like a pen line), with paper grain, and the white cut
// edge everything cut out in the game has, with its shadow. Put it first inside an element of class `ink-plate`;
// the plate keeps its size, padding and colour (--plate), and a plain pill stands in until this is drawn.
// It stands in for the owner's own drawing of a blank plate: when that arrives, it is drawn here instead.

import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { paperGrainUrl } from '../../art/paper';
import { seeded } from '../../art/placeholders/kit';

/** The four shapes of a plate, as SVG path data in the plate's own pixels (its top-left corner at 0, 0). */
export interface PlatePaths {
  /** The shadow under the cut edge. */
  drop: string;
  /** The white cut edge round the outside. */
  cut: string;
  /** The paper inside the outline (and under it). */
  paper: string;
  /** The ink outline: a ring, filled even-odd. */
  ink: string;
}

/** A smooth wobble along a closed line of length `len`: a few waves that each fit round it a whole number of times. */
function wobble(rnd: () => number, len: number, waves: [number, number][]): (s: number) => number {
  const terms = waves.map(([wavelength, amp]) => ({
    k: Math.max(1, Math.round(len / wavelength)),
    amp: amp * (0.75 + rnd() * 0.5),
    phase: rnd() * Math.PI * 2,
  }));
  return (s) => terms.reduce((sum, w) => sum + w.amp * Math.sin((2 * Math.PI * w.k * s) / len + w.phase), 0);
}

/**
 * A plate w × h pixels inked by hand: the outline (`ink` pixels on average, centred where a CSS border that wide
 * would be) wobbles a little, swells and thins, and is a touch heavier along the bottom, the way a pen line is.
 * Round it is the white cut edge (`rim` wide) and, `drop` pixels lower, its shadow. The same seed draws the same plate.
 */
export function platePaths(w: number, h: number, ink: number, rim: number, drop: number, seed: number): PlatePaths {
  const rnd = seeded(seed);
  const c = ink / 2;
  const r = Math.max(1, Math.min(w, h) / 2 - c);
  const flat = Math.max(0, w - 2 * c - 2 * r);
  const len = 2 * flat + 2 * Math.PI * r;
  // A point on the outline's middle and the way out from there, s pixels along it clockwise from the top left.
  const at = (s: number): [number, number, number, number] => {
    s = ((s % len) + len) % len;
    const left = c + r;
    const right = w - c - r;
    if (s < flat) return [left + s, c, 0, -1];
    s -= flat;
    if (s < Math.PI * r) {
      const a = -Math.PI / 2 + s / r;
      return [right + Math.cos(a) * r, h / 2 + Math.sin(a) * r, Math.cos(a), Math.sin(a)];
    }
    s -= Math.PI * r;
    if (s < flat) return [right - s, h - c, 0, 1];
    s -= flat;
    const a = Math.PI / 2 + s / r;
    return [left + Math.cos(a) * r, h / 2 + Math.sin(a) * r, Math.cos(a), Math.sin(a)];
  };
  // The whole line drifts in and out a little (the plate is not quite even), and its two edges each wander on their
  // own, so the line swells and thins.
  const drift = wobble(rnd, len, [
    [len, ink * 0.22],
    [len / 2.6, ink * 0.1],
    [70, ink * 0.07],
  ]);
  const outer = wobble(rnd, len, [
    [52, ink * 0.13],
    [21, ink * 0.06],
  ]);
  const inner = wobble(rnd, len, [
    [44, ink * 0.11],
    [17, ink * 0.05],
  ]);
  const n = Math.max(48, Math.round(len / 3));
  const out: string[] = [];
  const inn: string[] = [];
  const cut: string[] = [];
  const shade: string[] = [];
  const f = (v: number) => Math.round(v * 100) / 100;
  for (let i = 0; i < n; i++) {
    const s = (i / n) * len;
    const [x, y, nx, ny] = at(s);
    const d = drift(s);
    // A pen pressed a little harder along the bottom.
    const heavy = ink * 0.08 * Math.max(0, ny);
    const o = c + outer(s) + d + heavy / 2;
    const k = -c - inner(s) + d - heavy / 2;
    const e = c + rim + d + outer(s) * 0.5 + heavy / 2;
    out.push(`${f(x + nx * o)},${f(y + ny * o)}`);
    inn.push(`${f(x + nx * k)},${f(y + ny * k)}`);
    cut.push(`${f(x + nx * e)},${f(y + ny * e)}`);
    shade.push(`${f(x + nx * e)},${f(y + ny * e + drop)}`);
  }
  const path = (pts: string[]) => `M${pts.join('L')}Z`;
  return { drop: path(shade), cut: path(cut), paper: path(out), ink: `${path(out)}${path(inn.reverse())}` };
}

/** Room left round a plate for its cut edge, the edge's shadow and the wobble, in pixels. */
export function plateMargin(ink: number, rim: number, drop: number): number {
  return Math.ceil(ink + rim + drop + 3);
}

/** A number from a plate's words, so the same words always get the same hand-drawn plate. */
function seedOf(text: string): number {
  let s = 7;
  for (let i = 0; i < text.length; i++) s = (Math.imul(s, 31) + text.charCodeAt(i)) >>> 0;
  return s;
}

let plates = 0;

/** The plate drawn behind the words of the `ink-plate` element it is the first child of, sized to it. */
export function PlatePaper() {
  const ref = useRef<SVGSVGElement>(null);
  const [grain] = useState(() => `plate-grain-${++plates}`);
  const [box, setBox] = useState<{ w: number; h: number; ink: number; rim: number; drop: number; seed: number } | null>(null);
  useLayoutEffect(() => {
    const plate = ref.current?.parentElement;
    if (!plate) return;
    const measure = () => {
      const w = plate.offsetWidth;
      const h = plate.offsetHeight;
      if (!w || !h) return;
      const cs = getComputedStyle(plate);
      const next = {
        w,
        h,
        ink: parseFloat(cs.borderTopWidth) || 3,
        rim: parseFloat(cs.getPropertyValue('--rim')) || 3,
        drop: parseFloat(cs.getPropertyValue('--drop')) || 3,
        seed: seedOf(plate.textContent ?? ''),
      };
      setBox((b) => (b && Object.keys(next).every((k) => b[k as keyof typeof b] === next[k as keyof typeof next]) ? b : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(plate);
    return () => ro.disconnect();
  }, []);
  // Drawn again only when the plate's size or words change, not whenever what holds it is drawn again.
  const p = useMemo(() => (box ? platePaths(box.w, box.h, box.ink, box.rim, box.drop, box.seed) : null), [box]);
  if (!box || !p) return <svg ref={ref} class="plate-paper-wait" aria-hidden="true" />;
  // The SVG has room round the plate, and is placed from the plate's padding edge, inside its (see-through) border.
  const m = plateMargin(box.ink, box.rim, box.drop);
  const W = box.w + 2 * m;
  const H = box.h + 2 * m;
  return (
    <svg
      ref={ref}
      class="plate-paper"
      aria-hidden="true"
      width={W}
      height={H}
      viewBox={`${-m} ${-m} ${W} ${H}`}
      style={{ left: `${-box.ink - m}px`, top: `${-box.ink - m}px` }}
    >
      <defs>
        <pattern id={grain} patternUnits="userSpaceOnUse" width="160" height="160">
          <image href={paperGrainUrl()} width="160" height="160" />
        </pattern>
      </defs>
      <path class="p-drop" d={p.drop} />
      <path class="p-cut" d={p.cut} />
      <path class="p-paper" d={p.paper} />
      <path class="p-grain" d={p.paper} fill={`url(#${grain})`} />
      <path class="p-ink" d={p.ink} />
    </svg>
  );
}
