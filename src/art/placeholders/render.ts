// Draws the placeholder for any picture the game uses. Works in the browser and in Node.

import { type ImageSpec, stickerSpec } from '../spec';
import { drawCard } from './cards';
import { drawButton, drawIcon } from './icons';
import { type Ctx, FONT_STACK, INK, label, WHITE } from './kit';
import { poseFor } from './pose';
import { drawScenePiece } from './scenes';
import { drawSticker } from './stickers';
import { headOf, setFacing, SUBJECTS } from './subjects';

/** A face close-up, drawn from the character's procedural head. */
export function drawPortrait(ctx: Ctx, subject: string, w: number, h: number): void {
  const drawer = SUBJECTS[subject];
  ctx.save();
  if (!drawer) {
    label(ctx, '?', w / 2, h / 2, w * 0.4);
    ctx.restore();
    return;
  }
  const hd = headOf(subject);
  const s = (Math.min(w, h) * 0.4) / hd.r;
  ctx.translate(w / 2, h / 2 + 8);
  ctx.scale(s, s);
  ctx.translate(0, -hd.y);
  setFacing(0);
  drawer(ctx, poseFor('idle', 0, 4), { headOnly: true });
  ctx.restore();
}

/** Logo placeholder (the lobby uses styled text unless a real logo exists). */
export function drawLogo(ctx: Ctx, spec: ImageSpec): void {
  const { w, h } = spec;
  const en = spec.key.endsWith('_en');
  ctx.save();
  ctx.font = `900 ${en ? 74 : 92}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 18;
  ctx.strokeStyle = WHITE;
  const top = en ? 'Chiikawa' : 'ちいかわ';
  const bottom = en ? 'Tobatsu Defense' : '討伐ディフェンス';
  ctx.strokeText(top, w / 2, h * 0.36);
  ctx.fillStyle = INK;
  ctx.fillText(top, w / 2, h * 0.36);
  ctx.font = `900 ${en ? 60 : 66}px ${FONT_STACK}`;
  ctx.strokeText(bottom, w / 2, h * 0.72);
  ctx.fillStyle = '#E27792';
  ctx.fillText(bottom, w / 2, h * 0.72);
  ctx.restore();
}

/** Draw the placeholder for one picture into a canvas of its spec size. */
export function drawImage(ctx: Ctx, spec: ImageSpec): void {
  const [folder, a, b] = spec.key.split('/');
  if (spec.kind === 'piece' && folder === 'scenes') drawScenePiece(ctx, a, b);
  else if (spec.kind === 'sticker') {
    const st = stickerSpec(a);
    if (st) drawSticker(ctx, st);
  } else if (spec.kind === 'portrait') drawPortrait(ctx, a.replace(/^portrait_/, ''), spec.w, spec.h);
  else if (spec.kind === 'logo') drawLogo(ctx, spec);
  else if (spec.kind === 'card') drawCard(ctx, spec);
  else if (spec.kind === 'icon') drawIcon(ctx, spec);
  else if (spec.kind === 'button') drawButton(ctx, spec);
}
