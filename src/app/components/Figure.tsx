// A battle character moving through one of its motions, drawn the way the battle draws it, from its frames. Every
// character stands on the same stage at the same scale (art/figure.ts), so a preview keeps the size the character has
// in battle beside every other: nothing is fitted to its box. The Art Kit shows every character with it; the gallery
// shows the chosen entry.

import { useEffect, useRef } from 'preact/hooks';
import { figureLayout, shadowOf } from '../../art/figure';
import { drawSpriteFrame, frameOf, jumpFrameAt, jumpHop, motionKeys, spriteFor, spriteFrame, type SpriteLayout, spriteScale, spriteSticker, transformAdjust, WALK_FRAME_MS } from '../../art/sprite';
import { characterSpec } from '../../art/spec';
import { StickerCache } from '../../art/sticker';
import { art } from '../../art/store';
import { ALLY_ATTACK_MS } from '../../game/sim/constants';
import { ENEMIES, UNITS } from '../../game/sim/defs';
import { clawsOf, deathMsOf, fallMsOf, healPauseOf, type JumpParts, jumpAt, jumpMsOf, moveSpeedMulOf, spawnMsOf, swingOf, tempoOf } from '../../game/sim/tempo';
import { save } from '../../save/save';
import { whenIdle } from '../idle';

/** How long a motion that plays once takes before it starts again (ms); the others loop on their own. */
const PERIOD: Record<string, number> = { collapse: 1300, attack: 900, pull: 900, heal: 1400, transform: 2200, weed_found: 1500, pose: 1700, cast: 1300 };

/** Cutting a character's stickers (each frame's white edge and shadow) takes a moment, more on a phone, so previews
 *  keep them by character, size and screen density: flipping back to a gallery entry, or to another of its motions,
 *  draws at once. Enough are kept for every fighter in the game at once (the
 *  gallery warms a whole tab's, and a smaller store had them cut again at every change of tab), and the gallery lets
 *  them all go when it closes. */
const STICKERS = new Map<string, StickerCache>();
const KEEP = 36;
function stickersFor(id: string, width: number, dpr: number): StickerCache {
  const key = `${id}|${width}|${dpr}`;
  const hit = STICKERS.get(key);
  if (hit) STICKERS.delete(key);
  const cache = hit ?? new StickerCache();
  STICKERS.set(key, cache);
  while (STICKERS.size > KEEP) STICKERS.delete(STICKERS.keys().next().value as string);
  return cache;
}

/** Let every kept sticker go (leaving the gallery). */
export function releaseFigures(): void {
  STICKERS.clear();
}

/** Screen pixels per CSS pixel a preview is drawn at: no more than 1.5, since every sticker is cut and kept at this
 *  density, and a paper cut-out reads fine a little soft. */
const density = () => Math.min(window.devicePixelRatio || 1, 1.5);

/** A character's pace in battle, for its sprite (see game/sim/tempo.ts): its tempo, walk frame, swing and fall, and
 *  how long its heal, jump (六足の虫), pick-up (ゴブリン) and claw-drawing (キメラ) take. */
function paceOf(id: string): { tempo: number; walkMs?: number; swingMs?: number; fallMs?: number; deathMs?: number; healMs?: number; jump?: JumpParts; stealMs?: number; clawsMs?: number; spawnMs?: number } {
  const subject = characterSpec(id)?.subject ?? '';
  const form = id === 'enemy_chiikabu_true' ? 'true' : id === 'enemy_kimera_claws' ? 'claws' : undefined;
  const e = ENEMIES[subject];
  if (e && id.startsWith('enemy_')) {
    const tempo = tempoOf(e, form);
    const boss = !!e.boss;
    return {
      tempo,
      walkMs: (WALK_FRAME_MS[e.speed] * tempo) / Math.sqrt(moveSpeedMulOf({ def: e, form })),
      swingMs: swingOf(e, form).swingMs,
      fallMs: fallMsOf(e, form, boss),
      deathMs: deathMsOf(e, form, boss),
      healMs: healPauseOf(e) || undefined,
      jump: e.abilities.find((a) => a.kind === 'jump'),
      stealMs: ((m) => (m ? m * tempo : undefined))(e.abilities.find((a) => a.kind === 'steal')?.ms),
      clawsMs: clawsOf(e)?.ms,
      spawnMs: spawnMsOf(e, form),
    };
  }
  const u = UNITS[subject];
  return { tempo: u ? tempoOf(u) : 1, swingMs: u ? ALLY_ATTACK_MS : undefined };
}

/** Draw a sprite's frame for a motion `t` ms in, its feet at (0, 0) (ちいかぶ's transform grows out of the small form,
 *  as in battle; 六足の虫's jump, drawn on the spot, is lifted in an arc, as in battle). `still`: standing by, it holds
 *  still instead of breathing (reduced motion). */
function drawSpriteAt(ctx: CanvasRenderingContext2D, s: SpriteLayout, anim: string, t: number, stickers: StickerCache, still: boolean): void {
  const pace = paceOf(s.id);
  const onceMs = { attack: pace.swingMs, collapse: pace.deathMs, heal: pace.healMs, steal: pace.stealMs, claws: pace.clawsMs, spawn: pace.spawnMs }[anim];
  // 六足の虫's jump goes by its parts: getting ready, in the air (lifted in an arc), landing.
  const part = anim === 'jump' && pace.jump ? jumpAt(pace.jump, t) : null;
  const f = spriteFrame(s, anim, t, { tempo: pace.tempo, walkMs: pace.walkMs, onceMs, at: part ? jumpFrameAt(part.phase, part.k) : undefined, still });
  if (!f) return;
  const unit = spriteScale(s);
  const adj = f.motion === 'transform' ? transformAdjust(spriteFor('enemy_chiikabu'), s, f) : { k: 1, dx: 0 };
  const hop = part?.phase === 'air' ? jumpHop(part.k) : 0;
  drawSpriteFrame(ctx, f, adj.dx, -hop, unit * adj.k, stickers, unit);
}

/** Cut a character's resting stickers ahead of time, one frame per spare moment, so the page about to show it draws at
 *  once (the gallery warms the entries next to the open one). Only its resting frames are fetched: the rest come
 *  when a motion is shown. Stops as soon as `alive()` is false. */
export async function warmFigure(id: string, width: number, alive: () => boolean): Promise<void> {
  const { k } = figureLayout(id, width);
  const sprite = spriteFor(id);
  if (!sprite) return;
  await art.load(motionKeys(sprite, 'idle'));
  const dpr = density();
  const stickers = stickersFor(id, width, dpr);
  stickers.setDeviceScale(k * dpr);
  const unit = spriteScale(sprite);
  for (let i = 0; i < (sprite.anims.idle?.frames ?? 0); i++) {
    await whenIdle();
    if (!alive()) return;
    const f = frameOf(sprite, 'idle', i);
    if (f) spriteSticker(f, unit, stickers);
  }
}

/** A canvas sized like another, for drawing in steps. */
function scratch(like: HTMLCanvasElement): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = like.width;
  c.height = like.height;
  return [c, c.getContext('2d')!];
}

/** `width` is the stage's width in CSS pixels at the drawing's resolution, the height the character's preview
 *  (figureLayout: the stage's, taller for a giant). `bleed` adds canvas beyond the stage on either side (shares of
 *  `width`), where a giant runs on until the canvas ends (the gallery's paper margins). With `fill` the canvas takes its
 *  size from CSS instead, which must keep that shape, bleed and all. `shape` draws it as a flat shape of that colour
 *  inside a white cut edge (a character only sighted). */
export function Figure({ id, anim, width, bleed, fill, shape, class: extra }: { id: string; anim: string; width: number; bleed?: { left: number; right: number }; fill?: boolean; shape?: string; class?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { height } = figureLayout(id, width);
  const left = (bleed?.left ?? 0) * width;
  const full = width + left + (bleed?.right ?? 0) * width;
  useEffect(() => {
    const sprite = spriteFor(id);
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!sprite || !c || !ctx) return;
    const dpr = density();
    // Every character at the one scale, its feet on the stage's ground (art/figure.ts); the stage starts after the
    // bleed on the left.
    const { k, x: onStage, y } = figureLayout(id, width);
    const x = onStage + left;
    c.width = Math.round(full * dpr);
    c.height = Math.round(height * dpr);
    const stickers = stickersFor(id, width, dpr);
    const shadow = shadowOf(id);
    let raf = 0;
    let alive = true;
    const t0 = performance.now();
    const still = save.value.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Only the frames this motion plays are waited for (a page shows one motion at a time).
    art.load(motionKeys(sprite, anim)).then(() => {
      if (!alive) return;
      const paint = (cc: CanvasRenderingContext2D, tt: number) => drawSpriteAt(cc, sprite, anim, tt, stickers, still);
      stickers.setDeviceScale(k * dpr);
      // A shape: the character drawn off screen, then laid down as a white edge (the shape grown a little) and the
      // flat colour on top.
      const [off, offCtx] = shape ? scratch(c) : [null, null];
      const [edge, edgeCtx] = shape ? scratch(c) : [null, null];
      const grow = Math.max(2, Math.round(width * 0.008 * dpr));
      // One-off motions last as long as in battle (a giant's swing, a big one's fall), with a pause after.
      const pace = paceOf(id);
      const once =
        anim === 'attack' && pace.swingMs
          ? pace.swingMs + 700
          : anim === 'collapse' && pace.fallMs
            ? pace.fallMs + 500
            : anim === 'heal' && pace.healMs
              ? pace.healMs + 600
              : anim === 'jump' && pace.jump
                ? jumpMsOf(pace.jump) + 600
                : anim === 'steal' && pace.stealMs
                  ? pace.stealMs + 600
                  : anim === 'claws' && pace.clawsMs
                    ? pace.clawsMs + 600
                    : anim === 'spawn' && pace.spawnMs
                      ? pace.spawnMs + 600
                      : 0;
      const place = (cc: CanvasRenderingContext2D) => cc.setTransform(k * dpr, 0, 0, k * dpr, x * dpr, y * dpr);
      const tick = (now: number) => {
        const period = once || (PERIOD[anim] ?? 0);
        const tt = period ? (now - t0) % period : now - t0;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        place(ctx);
        // Its shadow, as wide as in battle.
        ctx.fillStyle = 'rgba(43,36,32,0.14)';
        ctx.beginPath();
        ctx.ellipse(shadow.dx, -4, shadow.rx, shadow.rx * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
        if (off && offCtx && edge && edgeCtx && shape) {
          offCtx.setTransform(1, 0, 0, 1, 0, 0);
          offCtx.globalCompositeOperation = 'source-over';
          offCtx.clearRect(0, 0, off.width, off.height);
          place(offCtx);
          paint(offCtx, tt);
          offCtx.setTransform(1, 0, 0, 1, 0, 0);
          edgeCtx.globalCompositeOperation = 'source-over';
          edgeCtx.clearRect(0, 0, edge.width, edge.height);
          edgeCtx.drawImage(off, 0, 0);
          edgeCtx.globalCompositeOperation = 'source-in';
          edgeCtx.fillStyle = '#FFFDF7';
          edgeCtx.fillRect(0, 0, edge.width, edge.height);
          offCtx.globalCompositeOperation = 'source-in';
          offCtx.fillStyle = shape;
          offCtx.fillRect(0, 0, off.width, off.height);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          for (const [dx, dy] of [[grow, 0], [-grow, 0], [0, grow], [0, -grow], [grow * 0.7, grow * 0.7], [-grow * 0.7, grow * 0.7], [grow * 0.7, -grow * 0.7], [-grow * 0.7, -grow * 0.7]]) ctx.drawImage(edge, dx, dy);
          ctx.drawImage(off, 0, 0);
        } else paint(ctx, tt);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [id, anim, width, height, left, full, shape]);
  return <canvas ref={ref} class={['figure-preview', extra ?? ''].join(' ').trim()} style={fill ? undefined : { width: `${full}px`, height: `${height}px` }} />;
}
