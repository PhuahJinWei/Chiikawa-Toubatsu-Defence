// The stand-in for a picture that has no file, or whose file failed to load. Every picture the game ships is the
// owner's, so this only ever shows where one is missing, and it shows it plainly: a paper card with the picture's
// name and size, which is also what the Art Kit's ZIP of templates holds. An effect sticker is the one exception: it
// is drawn over the characters in battle, so a missing one shows as a soft ring rather than a card, and never hides
// anyone (the owner's rule: effects never hide the enemies).

import { FONT_STACK, INK } from './kit';
import { type ImageSpec, stickerSpec } from './spec';

const PAPER = '#F3EBDD';

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** Draw the stand-in for one picture into a context sized for its spec. */
export function drawImage(ctx: CanvasRenderingContext2D, spec: ImageSpec): void {
  const { w, h } = spec;
  ctx.save();
  if (spec.kind === 'sticker' && stickerSpec(spec.key.split('/')[1] ?? '')?.group === 'effect') {
    const r = Math.min(w, h) * 0.36;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.06);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const inset = Math.max(2, Math.min(w, h) * 0.03);
  roundedPath(ctx, inset, inset, w - 2 * inset, h - 2 * inset, Math.min(w, h) * 0.16);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.setLineDash([Math.max(4, w * 0.04), Math.max(3, w * 0.03)]);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.02);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  const name = spec.key.split('/').pop() ?? spec.key;
  const size = Math.max(9, Math.min(h * 0.22, (w * 1.6) / Math.max(6, name.length), 30));
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${FONT_STACK}`;
  ctx.fillText(name, w / 2, h / 2 - size * 0.45, w - 4 * inset);
  ctx.font = `500 ${Math.max(8, size * 0.7)}px ${FONT_STACK}`;
  ctx.fillText(`${w}×${h}`, w / 2, h / 2 + size * 0.6, w - 4 * inset);
  ctx.restore();
}
