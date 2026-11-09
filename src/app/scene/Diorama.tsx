// A paper diorama in real 3D: flat sticker pieces standing at different depths. At rest the camera looks
// straight on, so the pieces line up exactly like the flat picture; focusing on someone swings the camera
// toward them as it zooms in. The viewpoint drifts a little (an idle sway, plus a lean toward the mouse on
// desktop or the way the phone is tilted), which slides near pieces against far ones. Wide scenes (the map)
// can be dragged sideways. Live content (buttons, signs, name tags) sits in the scene's slots. Real art from
// /art replaces each placeholder piece automatically, with its own layout when one was imported.

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { paperGrainUrl } from '../../art/paper';
import { type BuiltPiece, buildPiece } from '../../art/pieces';
import { FRAME_MS, pieceFiles, type SceneEffect, type SceneLayer, type SceneSpec } from '../../art/spec';
import { art, resolveScene } from '../../art/store';
import { t } from '../../i18n/i18n';
import { save } from '../../save/save';
import { LoadingScreen } from '../components/LoadingScreen';
import {
  type Camera,
  cameraCss,
  cardDepth,
  fitScale,
  focusCamera,
  hiddenWhileFocused,
  LEAN,
  panCss,
  panSpan,
  panToward,
  PERSPECTIVE,
  pivotScale,
  REST_CAMERA,
  restCamera,
  risen,
  SWAY,
} from './camera';

/** The exploded view (art guides): the stack seen from the side with the pieces pulled apart, moved
 *  back from the camera so even the nearest piece stays small enough to read. */
const EXPLODED: Camera = { ...REST_CAMERA, rx: 10, ry: 30, dolly: -1100 };
const SPREAD = 2;
/** How often a scene's idle drift moves (ms). It creeps, a fraction of a pixel between moves at this rate, so every other
 *  frame of a usual screen looks the same, and a menu left open costs a phone less. */
const DRIFT_TICK_MS = 30;

/** Puts already-painted canvases into the DOM: a piece's picture, or the frames of its idle loop stacked and shown
 *  one after another every `ms`. Calm (reduced motion) holds the first frame. */
function Mount({ frames, ms, snap }: { frames: HTMLCanvasElement[]; ms: number; snap?: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  // Before paint, so a piece never shows empty while its loop takes over from its still.
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    if (box.children.length !== frames.length || frames.some((f, i) => box.children[i] !== f)) box.replaceChildren(...frames);
    const show = (i: number) => frames.forEach((f, k) => (f.style.visibility = k === i ? '' : 'hidden'));
    show(0);
    if (frames.length < 2) return;
    let at = 0;
    const id = window.setInterval(() => {
      const next = calmWanted() ? 0 : (at + 1) % frames.length;
      if (next !== at) show((at = next));
    }, ms);
    return () => window.clearInterval(id);
  }, [frames, ms]);
  return <div class={snap ? 'd-art snap' : 'd-art'} style={snap} ref={ref} />;
}

/** The style for a piece that snaps between two leans: the angle, how long each lean holds, and the pivot in the
 *  piece's box (which includes the room for its sticker edge and shadow). */
function snapStyle(l: SceneLayer, b: BuiltPiece): Record<string, string> | undefined {
  const s = l.snap;
  if (!s) return undefined;
  const [px, py] = s.pivot ?? [0.5, 1];
  return {
    '--snap-deg': `${s.deg}deg`,
    '--snap-ms': `${s.ms}ms`,
    transformOrigin: `${-b.left + l.w * px}px ${-b.top + l.h * py}px`,
  };
}

interface DioramaProps {
  /** The scene as specified; delivered art's layout is applied here. */
  scene: SceneSpec;
  /** Piece id of the character in focus, or null for the whole scene. */
  focus: string | null;
  /** Side of the screen the focused character moves to (by default the side it stands on). */
  side?: 'left' | 'right';
  /** Start at rest and then move in on the focus once the scene shows (screens that always focus someone). */
  intro?: boolean;
  /** Piece id → accessible name, for the characters the player can tap. */
  pickable?: Record<string, string>;
  /** Live content for the scene's slots, by slot id. Shown while the whole scene is in view. */
  slots?: Record<string, ComponentChildren>;
  /** Wide scenes: a stage x to bring to the middle of the screen at first. */
  panTo?: number;
  /** Piece id of a character that hops once (after a purchase, say). */
  cheer?: string | null;
  /** Art guides: every piece's box, id, size and depth, the slots, the safe area, and an exploded view. */
  guides?: boolean;
  onPick?: (id: string) => void;
  onBackground?: () => void;
}

type Item = { z: number; layer: SceneLayer; fx?: undefined } | { z: number; fx: SceneEffect; i: number; layer?: undefined };

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));
const calmWanted = () => save.value.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Diorama(p: DioramaProps) {
  const scene = useMemo(() => resolveScene(p.scene), [p.scene]);
  const box = useRef<HTMLDivElement>(null);
  const eyeEl = useRef<HTMLDivElement>(null);
  const rigEl = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [built, setBuilt] = useState<Map<string, BuiltPiece> | null>(null);
  /** Pieces that play an idle loop: piece id → every frame, built in the piece's box. */
  const [loops, setLoops] = useState<Map<string, HTMLCanvasElement[]> | null>(null);
  const [exploded, setExploded] = useState(false);
  const [arrived, setArrived] = useState(!p.intro);
  const [panX, setPanX] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  /** Where the mouse or the phone's tilt asks the view to lean, −1…1 each way. */
  const lean = useRef({ x: 0, y: 0 });
  /** What the drift loop needs from the latest render. */
  const live = useRef({ fit: 1, kd: 1, calm: false });

  useEffect(() => {
    // The grain is for the game's own paper panels; scenes show the art's own texture, nothing laid over it.
    document.documentElement.style.setProperty('--grain', `url(${paperGrainUrl()})`);
    const el = box.current;
    if (!el) return;
    const measure = () => setSize((s) => (s && s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lean toward the mouse, or the way the phone is tilted.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      lean.current = { x: clamp1(((e.clientX - r.left) / r.width - 0.5) * 2), y: clamp1(((e.clientY - r.top) / r.height - 0.5) * 2) };
    };
    const onLeave = () => {
      lean.current = { x: 0, y: 0 };
    };
    let base: { lr: number; fb: number } | null = null;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const angle = screen.orientation?.angle ?? 0;
      // Held sideways, the phone's left–right tilt is beta and its front–back tilt is gamma.
      const lr = angle === 90 ? e.beta : angle === 270 ? -e.beta : e.gamma;
      const fb = angle === 90 ? -e.gamma : angle === 270 ? e.gamma : e.beta;
      if (!base || Math.abs(lr - base.lr) > 40 || Math.abs(fb - base.fb) > 40) base = { lr, fb };
      lean.current = { x: clamp1((lr - base.lr) / 15), y: clamp1((fb - base.fb) / 15) };
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('deviceorientation', onTilt);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, []);

  const ready = !!size && size.w > 0 && size.h > 0;
  const fit = useMemo(() => (ready ? fitScale(scene, size.w, size.h) : 0), [scene, ready, size?.w, size?.h]);
  const vp = useMemo(() => (ready ? { w: size.w, h: size.h, fit } : null), [ready, size?.w, size?.h, fit]);
  // Where a wide phone crops the bottom of the picture, someone standing at the bottom edge is raised into view (with
  // the name tag over their head). Everything from here on places pieces and aims cameras with this.
  const staged = useMemo(() => (vp ? risen(scene, vp) : scene), [scene, vp]);

  // Build every piece once, after the first measurement (the resolution depends on the screen). Idle loops follow
  // in the background once the scene shows: a piece plays its loop when every frame has been delivered and built.
  useEffect(() => {
    if (!ready || built) return;
    let alive = true;
    const key = (file: string) => `scenes/${scene.id}/${file}`;
    const yieldNow = () => new Promise((r) => setTimeout(r, 0));
    (async () => {
      await art.load(scene.layers.map((l) => key(l.id)));
      const map = new Map<string, BuiltPiece>();
      const quality = new Map<string, number>();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      for (const l of scene.layers) {
        if (!alive) return;
        // Characters stay sharp when the camera moves in on them; the back wall needs the least.
        const want = dpr * fit * (l.character ? 1.6 : l.z >= 4 ? 1.1 : 1.3);
        const budget = l.edge ? 3.2e6 : 4e6;
        const q = Math.min(2, Math.max(1, want), Math.sqrt(budget / ((l.w + 140) * (l.h + 140))));
        quality.set(l.id, q);
        map.set(l.id, buildPiece(scene.id, l, q));
        await yieldNow();
      }
      if (!alive) return;
      setBuilt(map);
      const looping = scene.layers.filter((l) => pieceFiles(l).length > 1 && pieceFiles(l).every((f) => art.isReal(key(f))));
      if (!looping.length) return;
      await art.load(looping.flatMap((l) => pieceFiles(l).slice(1).map(key)));
      const out = new Map<string, HTMLCanvasElement[]>();
      for (const l of looping) {
        const frames = [map.get(l.id)!.el];
        for (const f of pieceFiles(l).slice(1)) {
          if (!alive) return;
          if (!art.loaded(key(f))) break;
          frames.push(buildPiece(scene.id, l, quality.get(l.id)!, f).el);
          await yieldNow();
        }
        if (frames.length === pieceFiles(l).length) out.set(l.id, frames);
      }
      if (alive && out.size) setLoops(out);
    })();
    return () => {
      alive = false;
    };
  }, [ready]);

  // Screens that always focus someone come in from the whole scene once it shows.
  useEffect(() => {
    if (!built || arrived) return;
    const id = window.setTimeout(() => setArrived(true), 80);
    return () => window.clearTimeout(id);
  }, [built]);

  // A wide scene starts where the screen asks.
  useEffect(() => {
    if (!scene.pan || !vp || panX !== null) return;
    setPanX(p.panTo === undefined ? 0 : panToward(staged, vp, p.panTo));
  }, [vp]);

  const focusLayer = p.focus && arrived ? (staged.layers.find((l) => l.id === p.focus) ?? null) : null;
  const side = p.side ?? (focusLayer?.character?.side ?? (focusLayer && focusLayer.x + focusLayer.w / 2 < scene.w / 2 ? 'left' : 'right'));
  const cam = useMemo<Camera>(() => {
    if (!vp) return REST_CAMERA;
    if (exploded) return EXPLODED;
    return focusLayer ? focusCamera(staged, focusLayer, side, vp) : restCamera(staged, vp, staged.pan ? (panX ?? 0) : undefined);
  }, [staged, focusLayer, side, vp, exploded, panX]);
  const zf = focusLayer && !exploded ? focusLayer.z : null;
  live.current = { fit, kd: pivotScale(cam.dolly), calm: exploded };

  // The drift: an idle sway plus the lean, eased. The eye moves the viewpoint and the rig slides back by the
  // amount that keeps the plane at the camera's pivot still, so only nearer and farther pieces move.
  useEffect(() => {
    if (!ready || !built) return;
    const eye = eyeEl.current;
    const rig = rigEl.current;
    if (!eye || !rig) return;
    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const cur = { x: 0, y: 0, amp: 0, kd: live.current.kd };
    const tick = (now: number) => {
      const calm = live.current.calm || calmWanted();
      const goal = calm ? { x: 0, y: 0 } : lean.current;
      // Still catching up with a lean or a zoom: every frame. Only drifting: every other one will do.
      const settling = Math.abs(goal.x - cur.x) + Math.abs(goal.y - cur.y) > 0.01 || Math.abs(live.current.kd - cur.kd) > 0.002;
      if (!settling && now - last < DRIFT_TICK_MS) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const ease = (tau: number) => 1 - Math.exp(-dt / tau);
      cur.x += (goal.x - cur.x) * ease(0.45);
      cur.y += (goal.y - cur.y) * ease(0.45);
      cur.amp += ((calm ? 0 : 1) - cur.amp) * ease(0.8);
      cur.kd += (live.current.kd - cur.kd) * ease(0.3);
      const s = (now - t0) / 1000;
      const ex = cur.amp * SWAY.x * Math.sin((s * 2 * Math.PI) / 22) + LEAN.x * cur.x;
      const ey = cur.amp * SWAY.y * Math.sin((s * 2 * Math.PI) / 15 + 1) + LEAN.y * cur.y;
      const f = live.current.fit;
      eye.style.transform = `translate(${(ex * f).toFixed(2)}px, ${(ey * f).toFixed(2)}px)`;
      rig.style.transform = `translate3d(${((-ex / cur.kd) * f).toFixed(2)}px, ${((-ey / cur.kd) * f).toFixed(2)}px, 0px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, built]);

  // Dragging (and wheel-scrolling) a wide scene. A drag swallows the click that ends it.
  const drag = useRef<{ x: number; k: number; moved: boolean } | null>(null);
  const span = staged.pan && vp ? panSpan(staged, vp) : 0;
  const nudge = (dxCss: number) => {
    if (!vp || span <= 0) return;
    setPanX((k) => Math.max(0, Math.min(1, (k ?? 0) - dxCss / (span * vp.fit))));
  };
  const panHandlers = scene.pan
    ? {
        onPointerDown: (e: PointerEvent) => {
          if (e.button !== 0) return;
          drag.current = { x: e.clientX, k: panX ?? 0, moved: false };
        },
        onPointerMove: (e: PointerEvent) => {
          const d = drag.current;
          if (!d || !vp || span <= 0) return;
          const dx = e.clientX - d.x;
          if (!d.moved && Math.abs(dx) > 6) {
            d.moved = true;
            setDragging(true);
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          }
          if (d.moved) setPanX(Math.max(0, Math.min(1, d.k - dx / (span * vp.fit))));
        },
        onPointerUp: () => {
          if (drag.current?.moved) window.setTimeout(() => setDragging(false), 0);
          else drag.current = null;
        },
        onClickCapture: (e: MouseEvent) => {
          if (drag.current?.moved) {
            e.stopPropagation();
            e.preventDefault();
          }
          drag.current = null;
        },
        onWheel: (e: WheelEvent) => {
          const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          if (d) nudge(-d);
        },
      }
    : {};

  /** Each piece's picture as a one-frame list, kept stable so its Mount does not restart. */
  const stills = useMemo(() => new Map([...(built ?? [])].map(([id, b]) => [id, [b.el]])), [built]);
  const items = useMemo<Item[]>(
    () => [...staged.layers.map((layer) => ({ z: layer.z, layer })), ...staged.effects.map((fx, i) => ({ z: fx.z, fx, i }))].sort((a, b) => b.z - a.z),
    [staged],
  );
  // Every card is the stage-sized plane at its depth, centred on the rig and pre-scaled so it lines up at rest.
  const plane = { left: `${-scene.w / 2}px`, top: `${-scene.h / 2}px`, width: `${scene.w}px`, height: `${scene.h}px`, transformOrigin: `${scene.w / 2}px ${scene.h / 2}px` };
  const nearest = Math.min(...staged.layers.map((l) => l.z));
  const showSlots = !p.focus && !exploded;

  let chars = 0;
  return (
    <div
      class={`diorama${exploded ? ' exploded' : ''}${p.guides ? ' guides' : ''}${scene.pan ? ' pannable' : ''}${dragging ? ' dragging' : ''}`}
      ref={box}
      style={{ background: scene.backdrop }}
      onClick={p.onBackground}
      {...panHandlers}
    >
      {ready && built ? (
        // Its own key, so it is a fresh element and not the spinner's restyled (which would animate it into place).
        <div key="scene" class="pan" style={{ transform: panCss(cam, fit) }}>
          <div class="eye" ref={eyeEl} style={{ perspective: `${PERSPECTIVE * fit}px` }}>
            <div class="rig" ref={rigEl}>
              <div class="cam" style={{ transform: cameraCss(cam, fit) }}>
                {items.map((it) => {
                  const d = cardDepth(it.z, exploded ? SPREAD : 1);
                  const style = { ...plane, transform: `translateZ(${d.tz}px) scale(${d.s})` };
                  if (it.fx) {
                    return (
                      <div key={`fx${it.i}`} class="d-layer" style={style}>
                        <div class="steam" style={{ left: `${it.fx.x}px`, top: `${it.fx.y}px` }}>
                          <i />
                          <i />
                          <i />
                        </div>
                      </div>
                    );
                  }
                  const l = it.layer;
                  const b = built.get(l.id);
                  if (!b) return null;
                  const hidden = zf !== null && hiddenWhileFocused(l, zf);
                  const order = l.character ? chars++ : 0;
                  const own = { left: `${-b.left}px`, top: `${-b.top}px`, width: `${l.w}px`, height: `${l.h}px` };
                  return (
                    <div key={l.id} class={`d-layer${hidden ? ' hidden' : ''}`} style={style}>
                      <div
                        class={`d-piece${l.character ? ' char' : ''}${p.cheer === l.id ? ' cheer' : ''}`}
                        style={{
                          left: `${l.x + b.left}px`,
                          top: `${l.y + b.top}px`,
                          width: `${b.width}px`,
                          height: `${b.height}px`,
                          rotate: `${l.tilt ?? 0}deg`,
                          '--delay': `${-order * 0.7}s`,
                        }}
                      >
                        <Mount frames={loops?.get(l.id) ?? stills.get(l.id)!} ms={l.frameMs ?? FRAME_MS} snap={snapStyle(l, b)} />
                        {p.pickable?.[l.id] && !hidden ? (
                          <button
                            type="button"
                            class="d-hot"
                            style={own}
                            aria-label={p.pickable[l.id]}
                            aria-expanded={p.focus === l.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              p.onPick?.(l.id);
                            }}
                          />
                        ) : null}
                        {p.guides ? (
                          <>
                            <span class="d-box" style={own} />
                            <span class="d-guide" style={{ left: own.left, top: own.top }}>
                              {`${l.id} · ${l.w}×${l.h} · z ${Math.round(l.z * 100) / 100}`}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {showSlots
                  ? staged.slots.map((s) => {
                      const content = p.slots?.[s.id];
                      if (content === undefined && !p.guides) return null;
                      const d = cardDepth(s.z ?? nearest - 0.05);
                      return (
                        <div key={`slot-${s.id}`} class="d-layer" style={{ ...plane, transform: `translateZ(${d.tz}px) scale(${d.s})` }}>
                          <div
                            class={`d-slot${p.guides ? ' guided' : ''}`}
                            style={{ left: `${s.x - s.w / 2}px`, top: `${s.y - s.h / 2}px`, width: `${s.w}px`, height: `${s.h}px` }}
                            onFocusIn={staged.pan && vp ? () => setPanX(panToward(staged, vp, s.x)) : undefined}
                          >
                            {content}
                            {p.guides && content === undefined ? <span class="d-guide">{s.id}</span> : null}
                          </div>
                        </div>
                      );
                    })
                  : null}
                {p.guides && !exploded ? (
                  <div class="d-layer" style={{ ...plane, transform: 'translateZ(0px)' }}>
                    <div
                      class="d-safe"
                      style={{ left: `${scene.safe.x0}px`, top: `${scene.safe.y0}px`, width: `${scene.safe.x1 - scene.safe.x0}px`, height: `${scene.safe.y1 - scene.safe.y0}px` }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <LoadingScreen key="loading" />
      )}
      {p.guides ? (
        <button
          type="button"
          class="btn small d-explode"
          onClick={(e) => {
            e.stopPropagation();
            setExploded(!exploded);
          }}
        >
          {exploded ? t('scene.assemble') : t('scene.explode')}
        </button>
      ) : null}
    </div>
  );
}
