// Where delivered art says its pieces go. `npm run art:import` measures a folder of layers against its
// composited preview and writes art/scenes/<scene>/layout.json; the game reads that so real art keeps its own sizes
// and positions, while the spec keeps the behaviour (depths, taps, slots).
// Pure data and maths: no browser APIs, so tools and tests use it too.

import type { SceneLayer, SceneSpec, Side } from './spec';

export interface LayoutPiece {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
  edge?: boolean;
  cut?: Side[];
  /** Delivered as an idle loop of this many frames (<id>.png, <id>_2.png …). */
  frames?: number;
  frameMs?: number;
}

export interface SceneLayout {
  kind: 'scene';
  /** Stage size of the picture. Pictures painted at 2× are measured back to stage pixels. */
  w: number;
  h: number;
  /** Back to front. */
  pieces: LayoutPiece[];
}

/** Depth for a piece that the spec does not know, from its place in the stack. */
function defaultZ(i: number, n: number): number {
  return n <= 1 ? 4.2 : 4.2 - (1.6 * i) / (n - 1);
}

/** A scene as the game shows it: the spec, with the size and positions of the delivered art when there is some.
 *  If the picture is not the size the spec planned, its slots and safe area are scaled to match. */
export function mergeScene(spec: SceneSpec, layout?: SceneLayout): SceneSpec {
  if (!layout || !layout.pieces.length) return spec;
  const byId = new Map(spec.layers.map((l) => [l.id, l]));
  const n = layout.pieces.length;
  const layers: SceneLayer[] = layout.pieces.map((p, i) => {
    const base = byId.get(p.id);
    return {
      note: base?.note ?? { ja: '', en: '' },
      character: base?.character,
      tilt: base?.tilt,
      id: p.id,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      z: p.z ?? base?.z ?? defaultZ(i, n),
      edge: p.edge ?? base?.edge ?? i > 0,
      cut: p.cut ?? base?.cut,
      frames: p.frames ?? base?.frames,
      frameMs: p.frameMs ?? base?.frameMs,
      snap: base?.snap,
      rise: base?.rise,
    };
  });
  layers.sort((a, b) => b.z - a.z);
  const sx = layout.w / spec.w;
  const sy = layout.h / spec.h;
  const same = Math.abs(sx - 1) < 1e-6 && Math.abs(sy - 1) < 1e-6;
  // A battle world's field keeps its distance from the picture's right edge, so a world picture narrower than planned is
  // simply missing width on the left. Anything else scales with the picture.
  const across = (x: number) => (spec.kind === 'world' ? x + layout.w - spec.w : x * sx);
  return {
    ...spec,
    w: layout.w,
    h: layout.h,
    layers,
    safe: same ? spec.safe : { x0: across(spec.safe.x0), y0: spec.safe.y0 * sy, x1: across(spec.safe.x1), y1: spec.safe.y1 * sy },
    field: spec.field && !same ? { x: across(spec.field.x), y: spec.field.y * sy } : spec.field,
    slots: same ? spec.slots : spec.slots.map((s) => ({ ...s, x: across(s.x), y: s.y * sy, w: s.w * sx, h: s.h * sy })),
  };
}
