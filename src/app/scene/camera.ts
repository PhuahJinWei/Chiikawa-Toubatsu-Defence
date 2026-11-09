// Camera for paper dioramas, in real 3D. Each layer is a flat card standing at its depth z; cards are
// pre-scaled so that, seen straight on from the rest position, they line up exactly like the flat
// picture. Tapping someone swings the camera toward them as it zooms in, so the cards slide apart like
// a pop-up book. The picture has nothing beyond its edges, so every camera is panned (and zoomed a
// little more if it must) until no cut edge can show, even with the idle sway and the lean on top.
// Pure maths (also used by the tests).
//
// World units are stage pixels, centred on the stage. The rig, from the outside in:
//   .pan   translate(o · fit)                        a flat shift of the finished picture (no parallax)
//   .eye   translate(e · fit), perspective P · fit   the viewpoint drift of the sway and the lean
//   .rig   translate3d(−e / kd · fit)                keeps the plane at the pivot still while the eye drifts
//   .cam   scale3d(fit) translate3d(0, 0, dolly) rotateZ(rz) rotateX(rx) rotateY(ry) translate3d(−pivot)
//   card   translateZ(depth) scale(z / Z_REF)
// where kd = P / (P − dolly) is how much perspective magnifies the pivot's plane.

import { BLEED_PX } from '../../art/bleed';
import type { SceneLayer, SceneSpec, Side } from '../../art/spec';

/** The depth that keeps its drawn size when the camera turns (the pivot of the resting camera). */
export const Z_REF = 3;
/** Stage pixels between depth 3 and depth 4. */
export const UNIT = 340;
/** Camera distance from the Z_REF plane, in stage pixels. */
export const PERSPECTIVE = Z_REF * UNIT;

export interface Viewport {
  /** Container size in CSS pixels. */
  w: number;
  h: number;
  /** CSS pixels per stage pixel. */
  fit: number;
}

/** A camera: a flat pan (ox, oy), how far it has moved in (dolly), its angles, and the pivot it turns around. */
export interface Camera {
  ox: number;
  oy: number;
  dolly: number;
  rx: number;
  ry: number;
  rz: number;
  px: number;
  py: number;
  pz: number;
}

/** How far the viewpoint has drifted from straight on, in stage pixels. */
export interface Eye {
  x: number;
  y: number;
}

/** Resting view: straight on, so the scene looks exactly like its flat picture. */
export const REST_CAMERA: Camera = { ox: 0, oy: 0, dolly: 0, rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0 };
/** Close-up view: the camera swings round toward the goods panel's side and looks back at the character, a
 *  little from above (mirrored for the right side). The character stays within `band` of the screen width from
 *  its own side, clear of the goods. */
export const FOCUS = { rx: 3, ry: -10, rz: -1.2, band: 0.42 };

/** Viewpoint drift of the idle sway, and of the lean toward the mouse or the phone's tilt (stage pixels, at most).
 *  Mostly sideways: pictures often run right up to their top edge (the shop's 郎 does). */
export const SWAY: Eye = { x: 26, y: 6 };
export const LEAN: Eye = { x: 26, y: 10 };
/** No drift, and the four extremes of sway plus lean. */
export const EYES: Eye[] = [
  { x: 0, y: 0 },
  { x: SWAY.x + LEAN.x, y: SWAY.y + LEAN.y },
  { x: SWAY.x + LEAN.x, y: -(SWAY.y + LEAN.y) },
  { x: -(SWAY.x + LEAN.x), y: SWAY.y + LEAN.y },
  { x: -(SWAY.x + LEAN.x), y: -(SWAY.y + LEAN.y) },
];
/** Cut edges stay at least this far outside the screen, in CSS pixels (the stretched edges are the real safety net). */
const MARGIN = 0.5;
/** How far the game stretches each cut edge, in stage pixels: slack for the moments between two camera positions. */
export const BLEED = BLEED_PX;

/** Depth offset (toward the viewer is positive) and the scale that cancels its perspective at rest. */
export function cardDepth(z: number, spread = 1): { tz: number; s: number } {
  return { tz: -(z - Z_REF) * UNIT * spread, s: z / Z_REF };
}

/** The point the camera aims at on a character card. */
export function focusPoint(layer: SceneLayer): { x: number; y: number } {
  return { x: layer.x + layer.w / 2, y: layer.y + layer.h * (layer.character?.focusY ?? 0.4) };
}

/** Which side of the screen a character goes to when focused: its own choice, or the side it already stands on. */
export function focusSide(scene: SceneSpec, layer: SceneLayer): 'left' | 'right' {
  return layer.character?.side ?? (layer.x + layer.w / 2 < scene.w / 2 ? 'left' : 'right');
}

/** Layers that step aside while the camera is focused on a card at depth zf: people nearer than the one in
 *  focus, and props much nearer than it. */
export function hiddenWhileFocused(layer: SceneLayer, zf: number): boolean {
  return layer.character ? layer.z < zf - 0.01 : layer.z < zf - 0.3 && layer.z < Z_REF - 0.4;
}

/** The 3D transform of the camera element (everything but the flat pan). */
export function cameraCss(cam: Camera, fit: number): string {
  return `scale3d(${fit}, ${fit}, ${fit}) translate3d(0px, 0px, ${cam.dolly}px) rotateZ(${cam.rz}deg) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg) translate3d(${-cam.px}px, ${-cam.py}px, ${-cam.pz}px)`;
}

/** The flat pan, applied to the finished picture. */
export function panCss(cam: Camera, fit: number): string {
  return `translate(${cam.ox * fit}px, ${cam.oy * fit}px)`;
}

/** How much perspective magnifies the plane at the camera's pivot, `dolly` in front of the screen. */
export function pivotScale(dolly: number): number {
  return PERSPECTIVE / (PERSPECTIVE - dolly);
}

type V3 = [number, number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const rotX = ([x, y, z]: V3, a: number): V3 => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rotY = ([x, y, z]: V3, a: number): V3 => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const rotZ = ([x, y, z]: V3, a: number): V3 => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];

/** Where a stage point on a card of depth z appears on screen (CSS pixels in the container), or null behind the
 *  camera. `eye` adds the sway and the lean. */
export function project(scene: SceneSpec, z: number, cam: Camera, x: number, y: number, vp: Viewport, eye?: Eye): { x: number; y: number } | null {
  const { tz, s } = cardDepth(z);
  let v: V3 = [(x - scene.w / 2) * s - cam.px, (y - scene.h / 2) * s - cam.py, tz - cam.pz];
  v = rotY(v, rad(cam.ry));
  v = rotX(v, rad(cam.rx));
  v = rotZ(v, rad(cam.rz));
  const dz = v[2] + cam.dolly;
  if (dz >= PERSPECTIVE) return null;
  const k = PERSPECTIVE / (PERSPECTIVE - dz);
  const ex = eye?.x ?? 0;
  const ey = eye?.y ?? 0;
  const kd = pivotScale(cam.dolly);
  return {
    x: vp.w / 2 + vp.fit * (cam.ox + ex + (v[0] - ex / kd) * k),
    y: vp.h / 2 + vp.fit * (cam.oy + ey + (v[1] - ey / kd) * k),
  };
}

/** The two ends of a layer's cut edge, moved outward by `grow` stage pixels (with its stretched neighbours). */
function edgeEnds(l: SceneLayer, side: Side, grow: number): [number, number][] {
  const g = (s: Side) => (l.cut?.includes(s) ? grow : 0);
  const x0 = l.x - g('l');
  const x1 = l.x + l.w + g('r');
  const y0 = l.y - g('t');
  const y1 = l.y + l.h + g('b');
  if (side === 'l') return [[x0, y0], [x0, y1]];
  if (side === 'r') return [[x1, y0], [x1, y1]];
  if (side === 't') return [[x0, y0], [x1, y0]];
  return [[x0, y1], [x1, y1]];
}

interface Probe {
  side: Side;
  x: number;
  y: number;
}

/** Every cut edge's ends on screen for each viewpoint drift. Null if any is behind the camera. */
function probes(scene: SceneSpec, cam: Camera, vp: Viewport, layers: SceneLayer[], eyes: Eye[], grow: number): Probe[] | null {
  const out: Probe[] = [];
  for (const l of layers) {
    for (const side of l.cut ?? []) {
      for (const [x, y] of edgeEnds(l, side, grow)) {
        for (const e of eyes) {
          const p = project(scene, l.z, cam, x, y, vp, e);
          if (!p) return null;
          out.push({ side, x: p.x, y: p.y });
        }
      }
    }
  }
  return out;
}

/** How far (CSS pixels) one cut edge end reaches into the screen; zero or less means it stays outside. */
function reach(p: Probe, vp: Viewport): number {
  if (p.side === 'l') return p.x + MARGIN;
  if (p.side === 'r') return vp.w + MARGIN - p.x;
  if (p.side === 't') return p.y + MARGIN;
  return vp.h + MARGIN - p.y;
}

/**
 * How far (CSS pixels) the worst cut edge of these layers reaches into the screen for any viewpoint drift: zero or
 * less means no cut shows. `grow` first moves every cut edge outward by that many stage pixels (the stretched part).
 */
export function cutShowing(scene: SceneSpec, cam: Camera, vp: Viewport, layers: SceneLayer[] = scene.layers, eyes: Eye[] = EYES, grow = 0): number {
  const ps = probes(scene, cam, vp, layers, eyes, grow);
  if (!ps) return Infinity;
  return ps.reduce((m, p) => Math.max(m, reach(p, vp)), -Infinity);
}

/** The pans (stage pixels, relative to this camera's) that keep every cut edge of these layers off the screen for
 *  any viewpoint drift: the pan moves everything on screen by exactly fit per stage pixel. Null if a cut edge is
 *  behind the camera. */
function panRange(scene: SceneSpec, cam: Camera, vp: Viewport, layers: SceneLayer[]): { x0: number; x1: number; y0: number; y1: number } | null {
  const ps = probes(scene, cam, vp, layers, EYES, 0);
  if (!ps) return null;
  let x0 = -Infinity;
  let x1 = Infinity;
  let y0 = -Infinity;
  let y1 = Infinity;
  for (const p of ps) {
    if (p.side === 'l') x1 = Math.min(x1, (-MARGIN - p.x) / vp.fit);
    else if (p.side === 'r') x0 = Math.max(x0, (vp.w + MARGIN - p.x) / vp.fit);
    else if (p.side === 't') y1 = Math.min(y1, (-MARGIN - p.y) / vp.fit);
    else y0 = Math.max(y0, (vp.h + MARGIN - p.y) / vp.fit);
  }
  return { x0, x1, y0, y1 };
}

/**
 * Pan the camera so that no cut edge of these layers shows for any viewpoint drift. With an anchor, place it inside
 * the allowed range by that share (0 keeps the left/top edge of the picture, 1 the right/bottom); without one, move
 * it as little as possible. Null if no pan works at this zoom.
 */
function settle(scene: SceneSpec, cam: Camera, vp: Viewport, layers: SceneLayer[], anchor?: { x: number; y: number }): Camera | null {
  const r = panRange(scene, cam, vp, layers);
  if (!r || r.x0 > r.x1 + 1e-9 || r.y0 > r.y1 + 1e-9) return null;
  const pick = (lo: number, hi: number, a?: number) => (a === undefined || !Number.isFinite(lo) || !Number.isFinite(hi) ? Math.min(Math.max(0, lo), hi) : hi - (hi - lo) * a);
  return { ...cam, ox: cam.ox + pick(r.x0, r.x1, anchor?.x), oy: cam.oy + pick(r.y0, r.y1, anchor?.y) };
}

/** The smallest scale at which the resting camera can keep every cut edge off this screen (a cover fit with a
 *  little room for the sway and the lean). */
export function fitScale(scene: SceneSpec, w: number, h: number): number {
  const cover = Math.max(w / scene.w, h / scene.h);
  const ok = (fit: number) => settle(scene, REST_CAMERA, { w, h, fit }, scene.layers, scene.anchor) !== null;
  let lo = cover;
  let hi = cover * 1.2;
  for (let i = 0; i < 8 && !ok(hi); i++) {
    lo = hi;
    hi *= 1.2;
  }
  if (ok(lo)) return lo;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** The resting camera for this screen: straight on, with any overflow cropped as the scene's anchor says. A wide
 *  scene the player drags across passes its own horizontal position (0 = left end, 1 = right end). */
export function restCamera(scene: SceneSpec, vp: Viewport, panX?: number): Camera {
  const anchor = panX === undefined ? scene.anchor : { x: Math.max(0, Math.min(1, panX)), y: scene.anchor.y };
  return settle(scene, REST_CAMERA, vp, scene.layers, anchor) ?? REST_CAMERA;
}

/** How much of the bottom of the picture the resting camera crops on this screen, in stage pixels: a strip on
 *  wide phones, none where the whole height fits. */
export function bottomCrop(scene: SceneSpec, vp: Viewport): number {
  const p = project(scene, Z_REF, restCamera(scene, vp), scene.w / 2, scene.h, vp);
  return p ? Math.max(0, (p.y - vp.h) / vp.fit) : 0;
}

/**
 * The scene as this screen shows it: where the bottom of the picture is cropped, pieces and slots that rise are
 * raised by their share of the crop (someone standing at the bottom edge, and the name tag over their head). A
 * piece is never raised so far that one of its cut edges could show at rest. Scenes with nothing that rises, and
 * screens that crop nothing off the bottom, get the scene unchanged.
 */
export function risen(scene: SceneSpec, vp: Viewport): SceneSpec {
  if (!scene.layers.some((l) => l.rise) && !scene.slots.some((s) => s.rise)) return scene;
  const crop = bottomCrop(scene, vp);
  if (crop <= 0) return scene;
  const cam = restCamera(scene, vp);
  const up = (l: SceneLayer, r: number): SceneLayer => ({ ...l, y: l.y - r });
  const shows = (l: SceneLayer, r: number) => cutShowing(scene, cam, vp, [up(l, r)]) > 0;
  const layers = scene.layers.map((l) => {
    if (!l.rise) return l;
    let r = l.rise * crop;
    if (shows(l, r)) {
      let lo = 0;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + r) / 2;
        if (shows(l, mid)) r = mid;
        else lo = mid;
      }
      r = lo;
    }
    return up(l, r);
  });
  const slots = scene.slots.map((s) => (s.rise ? { ...s, y: s.y - s.rise * crop } : s));
  return { ...scene, layers, slots };
}

/** How far a wide scene can pan sideways at rest, in stage pixels (0 when the whole width fits). */
export function panSpan(scene: SceneSpec, vp: Viewport): number {
  const r = panRange(scene, REST_CAMERA, vp, scene.layers);
  return r && Number.isFinite(r.x0) && Number.isFinite(r.x1) ? Math.max(0, r.x1 - r.x0) : 0;
}

/** The pan position (0–1) that brings a stage x to the middle of the screen, for scrolling a wide scene to a spot. */
export function panToward(scene: SceneSpec, vp: Viewport, x: number): number {
  const span = panSpan(scene, vp);
  if (span <= 0) return 0;
  const left = restCamera(scene, vp, 0);
  // At pan 0 the stage point x sits at screen x = w/2 + fit·(x − w_stage/2 + ox); shifting by span·k moves it left.
  const off = x - scene.w / 2 + left.ox;
  return Math.max(0, Math.min(1, off / span));
}

/** Zoom toward a character so its focus point sits about a quarter of the way in from its side of the screen and a
 *  little below the middle, while the camera swings round toward it. */
function aim(scene: SceneSpec, layer: SceneLayer, side: 'left' | 'right', vp: Viewport, zoom: number): Camera {
  const { tz, s } = cardDepth(layer.z);
  const q = focusPoint(layer);
  const m = side === 'left' ? 1 : -1;
  return {
    ox: (((side === 'left' ? 0.27 : 0.73) - 0.5) * vp.w) / vp.fit,
    oy: (0.1 * vp.h) / vp.fit,
    // The pivot ends up `dolly` in front of the screen, where perspective magnifies it by P / (P − dolly).
    dolly: PERSPECTIVE * (1 - s / zoom),
    rx: FOCUS.rx,
    ry: FOCUS.ry * m,
    rz: FOCUS.rz * m,
    px: (q.x - scene.w / 2) * s,
    py: (q.y - scene.h / 2) * s,
    pz: tz,
  };
}

/** The close-up of a character: aimed as above, then panned so that no cut edge of what stays in view can show,
 *  zooming in a little more whenever the pan would push the character over toward the goods panel. */
export function focusCamera(scene: SceneSpec, layer: SceneLayer, side: 'left' | 'right', vp: Viewport): Camera {
  const shown = scene.layers.filter((l) => !hiddenWhileFocused(l, layer.z));
  const q = focusPoint(layer);
  let zoom = layer.character?.zoom ?? 1.5;
  for (let i = 0; i < 40; i++, zoom *= 1.025) {
    const c = settle(scene, aim(scene, layer, side, vp, zoom), vp, shown);
    if (!c) continue;
    const p = project(scene, layer.z, c, q.x, q.y, vp);
    const from = p ? (side === 'left' ? p.x : vp.w - p.x) / vp.w : 1;
    if (from <= FOCUS.band) return c;
  }
  return aim(scene, layer, side, vp, zoom);
}

/** The camera part way (t from 0 to 1) through a move, as CSS animates it: every number in the transforms in step. */
export function between(a: Camera, b: Camera, t: number): Camera {
  const out = { ...a };
  for (const k of Object.keys(a) as (keyof Camera)[]) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}
