// Placeholder pictures for the game's buttons and the shop's goods, drawn like the line art: chocolate outlines, pastel
// fills, a little shine. The owner's pictures replace them (art/ui/*.png, art/shop/*.png). The battle's icons and the
// goods have no text; the lobby's buttons carry their name plate, as the owner draws them. The game adds the sticker
// edge either way.

import type { ImageSpec } from '../spec';
import { type Ctx, FONT_STACK } from './kit';

const LINE = '#4A2A12';
const BLUSH = '#F6AFC0';

function ink(ctx: Ctx, lw = 11, color = LINE): void {
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

/** Fill the current path, then outline it. */
function paint(ctx: Ctx, fill: string, lw = 11): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ink(ctx, lw);
  ctx.stroke();
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A soft white glint, like light on a sticker. */
function shine(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number): void {
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function dot(ctx: Ctx, x: number, y: number, r: number, fill = LINE): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** 図鑑: a fat picture book with a little face on the cover and a ribbon bookmark. */
function book(ctx: Ctx): void {
  ctx.save();
  ctx.translate(184, 180);
  ctx.rotate(-0.14);
  // The pages, peeking out at the side and the bottom.
  rr(ctx, -104, -116, 222, 246, 22);
  paint(ctx, '#FFF6DF');
  ink(ctx, 6, 'rgba(74, 42, 18, 0.35)');
  for (const y of [-70, -20, 30, 80]) {
    ctx.beginPath();
    ctx.moveTo(98, y);
    ctx.lineTo(110, y);
    ctx.stroke();
  }
  // The ribbon hanging out below.
  ctx.beginPath();
  ctx.moveTo(26, 104);
  ctx.lineTo(26, 168);
  ctx.lineTo(42, 154);
  ctx.lineTo(58, 168);
  ctx.lineTo(58, 104);
  ctx.closePath();
  paint(ctx, '#EE7C83', 9);
  // The cover, with a darker spine.
  rr(ctx, -126, -132, 214, 248, 26);
  paint(ctx, '#BFE08C');
  ctx.save();
  rr(ctx, -126, -132, 214, 248, 26);
  ctx.clip();
  ctx.fillStyle = '#9CC867';
  ctx.fillRect(-140, -140, 58, 270);
  ctx.restore();
  ink(ctx, 9);
  ctx.beginPath();
  ctx.moveTo(-82, -128);
  ctx.lineTo(-82, 112);
  ctx.stroke();
  rr(ctx, -126, -132, 214, 248, 26);
  ink(ctx, 11);
  ctx.stroke();
  // A round label with a small happy face.
  ctx.beginPath();
  ctx.ellipse(6, -14, 60, 56, 0, 0, Math.PI * 2);
  paint(ctx, '#FFFBF0', 9);
  dot(ctx, -16, -22, 7.5);
  dot(ctx, 28, -22, 7.5);
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.ellipse(-30, -2, 11, 6.5, 0, 0, Math.PI * 2);
  ctx.ellipse(42, -2, 11, 6.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = BLUSH;
  ctx.fill();
  ctx.restore();
  ink(ctx, 6);
  ctx.beginPath();
  ctx.arc(1, -10, 7, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.arc(15, -10, 7, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  shine(ctx, -44, -104, 30, 9, -0.25);
  ctx.restore();
}

/** お店: the ポシェット, a round shoulder pouch with a flap and a clasp. */
function pochette(ctx: Ctx): void {
  ctx.save();
  ctx.translate(180, 200);
  ctx.rotate(0.1);
  // The strap, behind.
  ctx.beginPath();
  ctx.arc(0, -40, 116, Math.PI * 1.06, Math.PI * 1.94);
  ink(ctx, 32);
  ctx.stroke();
  ink(ctx, 16, '#F7B7C4');
  ctx.stroke();
  // The pouch.
  ctx.beginPath();
  ctx.moveTo(-128, -46);
  ctx.quadraticCurveTo(-142, 112, 0, 120);
  ctx.quadraticCurveTo(142, 112, 128, -46);
  ctx.closePath();
  paint(ctx, '#F9C99B');
  // Stitches along the bottom.
  ctx.save();
  ctx.setLineDash([10, 13]);
  ink(ctx, 5, 'rgba(74, 42, 18, 0.4)');
  ctx.beginPath();
  ctx.moveTo(-104, 66);
  ctx.quadraticCurveTo(0, 104, 104, 66);
  ctx.stroke();
  ctx.restore();
  // The flap and its clasp.
  ctx.beginPath();
  ctx.moveTo(-132, -48);
  ctx.quadraticCurveTo(0, 74, 132, -48);
  ctx.closePath();
  paint(ctx, '#F2AB74');
  ctx.beginPath();
  ctx.arc(0, 14, 21, 0, Math.PI * 2);
  paint(ctx, '#FDE49C', 9);
  shine(ctx, -70, -14, 26, 9, 0.5);
  ctx.restore();
}

/** 設定: a chunky gear. */
function gear(ctx: Ctx): void {
  ctx.save();
  ctx.translate(180, 180);
  ctx.rotate(0.12);
  const n = 8;
  const ro = 146;
  const ri = 114;
  const step = (Math.PI * 2) / n;
  const P = (r: number, a: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = i * step;
    const [x1, y1] = P(ri, a - step * 0.27);
    if (i === 0) ctx.moveTo(x1, y1);
    else ctx.lineTo(x1, y1);
    ctx.lineTo(...P(ro, a - step * 0.17));
    ctx.lineTo(...P(ro, a + step * 0.17));
    ctx.lineTo(...P(ri, a + step * 0.27));
    ctx.arc(0, 0, ri, a + step * 0.27, a + step * 0.73);
  }
  ctx.closePath();
  paint(ctx, '#BFDDF3');
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  paint(ctx, '#FFFBF0');
  shine(ctx, -54, -78, 28, 10, -0.6);
  ctx.restore();
}

/** あそぶ: a quest paper pinned up, with a さすまた ready behind it. */
function quest(ctx: Ctx): void {
  ctx.save();
  ctx.translate(180, 184);
  // The さすまた: a wooden pole with a U-shaped metal fork.
  ctx.save();
  ctx.rotate(0.78);
  ctx.beginPath();
  ctx.moveTo(0, 232);
  ctx.lineTo(0, -112);
  ink(ctx, 30);
  ctx.stroke();
  ink(ctx, 16, '#E2B47A');
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-46, -186);
  ctx.lineTo(-46, -150);
  ctx.quadraticCurveTo(-46, -116, 0, -116);
  ctx.quadraticCurveTo(46, -116, 46, -150);
  ctx.lineTo(46, -186);
  ink(ctx, 28);
  ctx.stroke();
  ink(ctx, 14, '#D3D6E0');
  ctx.stroke();
  ctx.restore();
  // The paper, with a torn bottom edge (a little smaller than the icon, so the さすまた shows round it).
  ctx.save();
  ctx.translate(-12, 6);
  ctx.rotate(-0.08);
  ctx.scale(0.88, 0.88);
  ctx.beginPath();
  ctx.moveTo(-110, -124);
  ctx.lineTo(110, -124);
  ctx.lineTo(112, 100);
  for (let x = 112, k = 0; x > -112; x -= 28, k++) ctx.lineTo(x - 14, 100 + (k % 2 ? 9 : -6));
  ctx.lineTo(-112, 100);
  ctx.closePath();
  paint(ctx, '#FFF3D6');
  ink(ctx, 9, 'rgba(74, 42, 18, 0.55)');
  for (const [y, w] of [
    [-52, 140],
    [-14, 140],
    [24, 96],
  ]) {
    ctx.beginPath();
    ctx.moveTo(-70, y);
    ctx.lineTo(-70 + w, y);
    ctx.stroke();
  }
  // A star sticker in the corner, and the red pin.
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 15 : 34;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = 70 + Math.cos(a) * r;
    const y = 62 + Math.sin(a) * r;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  paint(ctx, '#FDE49C', 8);
  ctx.beginPath();
  ctx.arc(0, -120, 22, 0, Math.PI * 2);
  paint(ctx, '#E8656C', 9);
  dot(ctx, -7, -127, 6, '#FFFFFF');
  ctx.restore();
  ctx.restore();
}

/** シャベル: a garden trowel, wooden handle up and to the right, the blade down and to the left. */
function shovel(ctx: Ctx): void {
  ctx.save();
  ctx.translate(180, 180);
  ctx.rotate(-Math.PI / 4);
  // The handle, with a round grip at the end.
  rr(ctx, -30, -168, 60, 170, 28);
  paint(ctx, '#E2B47A', 14);
  ink(ctx, 7, 'rgba(74, 42, 18, 0.35)');
  for (const y of [-130, -100, -70]) {
    ctx.beginPath();
    ctx.moveTo(-16, y);
    ctx.lineTo(16, y);
    ctx.stroke();
  }
  // The metal collar and the blade.
  rr(ctx, -22, -10, 44, 34, 10);
  paint(ctx, '#B9BDCB', 12);
  ctx.beginPath();
  ctx.moveTo(-74, 20);
  ctx.quadraticCurveTo(-80, 120, 0, 172);
  ctx.quadraticCurveTo(80, 120, 74, 20);
  ctx.closePath();
  paint(ctx, '#D3D6E0', 14);
  shine(ctx, -34, 70, 12, 40, 0.15);
  ctx.restore();
}

/** はやおくり: two chunky arrows pointing right, with speed lines behind. */
function speed(ctx: Ctx): void {
  ctx.save();
  ctx.translate(180, 182);
  ink(ctx, 14, 'rgba(74, 42, 18, 0.55)');
  for (const [y, x0] of [
    [-62, -170],
    [0, -178],
    [62, -170],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + 34, y);
    ctx.stroke();
  }
  const arrow = (x: number, fill: string) => {
    ctx.beginPath();
    ctx.moveTo(x - 70, -110);
    ctx.quadraticCurveTo(x - 82, -118, x - 82, -96);
    ctx.lineTo(x - 82, 96);
    ctx.quadraticCurveTo(x - 82, 118, x - 70, 110);
    ctx.lineTo(x + 58, 14);
    ctx.quadraticCurveTo(x + 72, 0, x + 58, -14);
    ctx.closePath();
    paint(ctx, fill, 14);
  };
  arrow(-30, '#FDE49C');
  arrow(78, '#F9C2CE');
  shine(ctx, -76, -52, 9, 30, 0);
  ctx.restore();
}

/** 一時停止: two fat rounded bars. */
function pauseBars(ctx: Ctx): void {
  ctx.save();
  ctx.translate(180, 180);
  ctx.rotate(-0.08);
  rr(ctx, -112, -132, 84, 264, 36);
  paint(ctx, '#CDE3F5', 14);
  rr(ctx, 28, -132, 84, 264, 36);
  paint(ctx, '#CDE3F5', 14);
  shine(ctx, -84, -78, 10, 34, 0);
  shine(ctx, 56, -78, 10, 34, 0);
  ctx.restore();
}

/** ラーメン券: a meal ticket from the ticket machine, with a bowl of ramen drawn on it. */
function ramenTicket(ctx: Ctx, paper = '#FFF4DA', pork = false): void {
  ctx.save();
  ctx.translate(180, 184);
  ctx.rotate(-0.14);
  // The ticket, with a dotted line to tear the stub off at the right, and a little red ring on the stub.
  rr(ctx, -156, -100, 312, 200, 20);
  paint(ctx, paper);
  ctx.save();
  ink(ctx, 6, 'rgba(74, 42, 18, 0.4)');
  ctx.setLineDash([2, 16]);
  ctx.beginPath();
  ctx.moveTo(86, -84);
  ctx.lineTo(86, 84);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(124, 0, 22, 0, Math.PI * 2);
  ink(ctx, 6, '#E26A5A');
  ctx.stroke();
  // The noodles, lifted out of the bowl.
  for (const x of [-100, -68, -36]) {
    ctx.beginPath();
    ctx.moveTo(x, 6);
    ctx.bezierCurveTo(x - 16, -24, x + 16, -42, x, -70);
    ink(ctx, 22);
    ctx.stroke();
    ink(ctx, 11, '#F5CD5B');
    ctx.stroke();
  }
  // The bowl, with a cream band round it.
  ctx.beginPath();
  ctx.moveTo(-140, 0);
  ctx.lineTo(16, 0);
  ctx.bezierCurveTo(12, 58, -26, 80, -62, 80);
  ctx.bezierCurveTo(-98, 80, -136, 58, -140, 0);
  ctx.closePath();
  paint(ctx, '#E9775B');
  ink(ctx, 8, '#FFF4DA');
  ctx.beginPath();
  ctx.moveTo(-128, 24);
  ctx.lineTo(4, 24);
  ctx.stroke();
  shine(ctx, -112, 46, 8, 16, 0.3);
  if (pork) {
    // A thick slice of ぶた laid over the noodles, its fat curling round the edge.
    ctx.beginPath();
    ctx.ellipse(-36, -14, 46, 30, -0.2, 0, Math.PI * 2);
    paint(ctx, '#E9A79C');
    ctx.beginPath();
    ctx.ellipse(-36, -14, 30, 18, -0.2, 0, Math.PI * 2);
    ink(ctx, 7, '#F8DCD3');
    ctx.stroke();
  }
  ctx.restore();
}

/** 判子 seen from above: a round peach body, its knob on top, the red ink peeking out at the bottom rim. */
function handStamp(ctx: Ctx): void {
  ctx.save();
  ctx.translate(180, 176);
  ctx.beginPath();
  ctx.arc(0, 10, 150, 0, Math.PI * 2);
  paint(ctx, '#E26A5A');
  ctx.beginPath();
  ctx.arc(0, 0, 150, 0, Math.PI * 2);
  paint(ctx, '#F7C6A0');
  ctx.beginPath();
  ctx.arc(0, -36, 88, 0, Math.PI * 2);
  paint(ctx, '#FAD6B6');
  shine(ctx, -38, -86, 28, 9, -0.6);
  shine(ctx, 60, 70, 30, 7, -0.5);
  ctx.restore();
}

const DRAW: Record<string, (ctx: Ctx) => void> = {
  hand_stamp: handStamp,
  item_slot: pochette,
  item_ramen: (ctx) => ramenTicket(ctx),
  item_buta: (ctx) => ramenTicket(ctx, '#FCE4E4', true),
  icon_shovel: shovel,
  icon_speed: speed,
  // Until it is drawn, 2× speed shows the same arrows (the button adds its 「2×」 tag; see Battle.tsx).
  icon_speed_active: speed,
  icon_pause: pauseBars,
};

interface MenuButton {
  draw: (ctx: Ctx) => void;
  name: string;
  fill: string;
  /** A round badge behind the icon (あそぶ). */
  circle?: string;
}

/** The lobby's four buttons: the icon, with a name plate in the button's colour across the bottom. */
const MENU: Record<string, MenuButton> = {
  button_play: { draw: quest, name: 'あそぶ', fill: '#F9C2CE', circle: '#F9C2CE' },
  button_book: { draw: book, name: '図鑑', fill: '#D5E9A4' },
  button_shop: { draw: pochette, name: 'お店', fill: '#FBD5AB' },
  button_settings: { draw: gear, name: '設定', fill: '#CDE3F5' },
};

function drawMenuButton(ctx: Ctx, w: number, h: number, m: MenuButton): void {
  // The icon in the top 80%, as the painters draw it (360 square).
  const s = Math.min(w, h * 0.8) / 360;
  ctx.save();
  ctx.translate((w - 360 * s) / 2, h * 0.01);
  ctx.scale(s, s);
  if (m.circle) {
    ctx.beginPath();
    ctx.arc(180, 180, 166, 0, Math.PI * 2);
    paint(ctx, m.circle);
  }
  m.draw(ctx);
  ctx.restore();
  // The name plate.
  const lw = h * 0.02;
  const ph = h * 0.2;
  const pw = w * 0.84;
  rr(ctx, (w - pw) / 2, h - ph - lw, pw, ph, ph / 2);
  paint(ctx, m.fill, lw);
  ctx.fillStyle = LINE;
  ctx.font = `700 ${Math.round(ph * 0.55)}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(m.name, w / 2, h - lw - ph * 0.48);
}

/** Draw the placeholder for a button picture: one of the lobby's four, or the back button (a cream tag with an arrow
 *  and its word). */
export function drawButton(ctx: Ctx, spec: ImageSpec): void {
  const { w, h } = spec;
  const menu = MENU[spec.key.split('/')[1]];
  if (menu) {
    drawMenuButton(ctx, w, h, menu);
    return;
  }
  const lw = h * 0.06;
  rr(ctx, lw, lw, w - 2 * lw, h - 2 * lw, (h - 2 * lw) / 2);
  paint(ctx, '#FBEFD2', lw);
  // The arrow.
  ink(ctx, h * 0.1);
  ctx.beginPath();
  ctx.moveTo(w * 0.31, h * 0.5);
  ctx.lineTo(w * 0.15, h * 0.5);
  ctx.moveTo(w * 0.22, h * 0.32);
  ctx.lineTo(w * 0.145, h * 0.5);
  ctx.lineTo(w * 0.22, h * 0.68);
  ctx.stroke();
  ctx.fillStyle = LINE;
  ctx.font = `700 ${Math.round(h * 0.42)}px "Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('もどる', w * 0.62, h * 0.53);
}

/** Draw the placeholder for a battle icon or one of the shop's goods into a canvas of its spec size. */
export function drawIcon(ctx: Ctx, spec: ImageSpec): void {
  const id = spec.key.split('/')[1];
  const scale = Math.min(spec.w, spec.h) / 360;
  ctx.save();
  ctx.scale(scale, scale);
  DRAW[id]?.(ctx);
  ctx.restore();
}
