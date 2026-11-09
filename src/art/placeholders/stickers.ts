// Placeholder stickers: one still picture each for projectiles, effects, badges, pickups and terrain.
// The game moves them (pops, spins, grows, fades), so each is drawn at rest, centred or standing on its feet.

import { BASELINE, type StickerSpec } from '../spec';
import { arc, circle, type Ctx, ellipse, glow, INK, label, line, poly, roundRect, shade, star, stroke, WHITE } from './kit';
import { conchShell, scallopShell } from './subjects';

function weedShape(ctx: Ctx, x: number, y: number, s: number, color = '#76BF63'): void {
  for (const a of [-0.9, -0.42, 0, 0.42, 0.9]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ellipse(ctx, 0, -22 * s, 8 * s, 24 * s, a === 0 ? shade(color, 12) : color, 3);
    stroke(ctx, [[0, -6 * s], [0, -38 * s]], 1.6, shade(color, -40));
    ctx.restore();
  }
}

export function drawSticker(ctx: Ctx, spec: StickerSpec): void {
  const { w, h } = spec;
  ctx.save();
  if (spec.anchor === 'feet') ctx.translate(w / 2, h - BASELINE);
  else ctx.translate(w / 2, h / 2);
  switch (spec.id) {
    case 'fx_blast':
      glow(ctx, 0, 0, 40, '#FFC15A', 1);
      star(ctx, 0, 0, 24, 10, 7, '#FFE08A', 3);
      break;
    case 'fx_acorn':
      ellipse(ctx, 0, 4, 13, 15, '#A46C42', 3);
      ellipse(ctx, 0, -8, 15, 8, '#6E4A33', 3);
      stroke(ctx, [[0, -16], [3, -22]], 3);
      break;
    case 'fx_can':
      roundRect(ctx, -12, -18, 24, 34, 5, '#EEF5FA', 3);
      roundRect(ctx, -12, -6, 24, 11, 0, '#6FA6D6', 0);
      roundRect(ctx, -12, -18, 24, 34, 5, null, 3);
      break;
    case 'fx_goya':
      ellipse(ctx, 0, 0, 14, 28, '#7CBC57', 3, 0.5);
      for (let i = -2; i <= 2; i++) circle(ctx, i * 4, i * 9, 2.6, '#5E9C40', 0);
      break;
    case 'fx_shell':
      // Tipped forward a little, the way it flies.
      scallopShell(ctx, 0, 3, 22, 0.28);
      break;
    case 'fx_conch':
      conchShell(ctx, 0, 2, 24, 0.5);
      break;
    case 'fx_book_1':
    case 'fx_book_2':
    case 'fx_book_3': {
      // A little hardback, tipped over: its cover (red, blue or green, one for each version), the pages' edge and
      // two lines on the cover.
      const cover = ['#C9625B', '#5B86C9', '#6FA55B'][Number(spec.id.slice(-1)) - 1];
      ctx.rotate(-0.3);
      roundRect(ctx, -18, -13, 38, 28, 4, '#F3E6C8', 3);
      roundRect(ctx, -21, -16, 38, 28, 5, cover, 3);
      stroke(ctx, [[-14, -16], [-14, 12]], 3, shade(cover, -30));
      for (const y of [-6, 2]) stroke(ctx, [[-6, y], [10, y]], 2.4, '#F8E9C9');
      break;
    }
    case 'fx_flame': {
      // One big fireball flying right: a bright round head, its fire streaming out behind it.
      glow(ctx, 8, 0, 34, '#FFB347', 0.9);
      ctx.beginPath();
      ctx.moveTo(-36, 0);
      ctx.quadraticCurveTo(-10, -26, 14, -16);
      ctx.quadraticCurveTo(32, 0, 14, 16);
      ctx.quadraticCurveTo(-10, 26, -36, 0);
      ctx.closePath();
      ctx.fillStyle = '#F47A35';
      ctx.fill();
      line(ctx, 3);
      ctx.stroke();
      ellipse(ctx, 10, 0, 13, 10, '#FFD45E', 0);
      ellipse(ctx, 14, 0, 6, 5, '#FFF6CF', 0);
      break;
    }
    case 'fx_missile':
      // A little cartoon missile falling nose first: fins up top, a red stripe and a red nose.
      poly(ctx, [[-13, -28], [-25, -48], [-13, -42]], '#8C9AB2', 3);
      poly(ctx, [[13, -28], [25, -48], [13, -42]], '#8C9AB2', 3);
      roundRect(ctx, -14, -44, 28, 58, 10, '#E3E8F0', 3.5);
      stroke(ctx, [[-13, -8], [13, -8]], 5, '#E05A4E');
      ctx.beginPath();
      ctx.moveTo(-14, 10);
      ctx.quadraticCurveTo(0, 50, 14, 10);
      ctx.closePath();
      ctx.fillStyle = '#E05A4E';
      ctx.fill();
      line(ctx, 3.5);
      ctx.stroke();
      break;
    case 'fx_spit':
      circle(ctx, 0, 0, 13, '#9FD3F0', 3);
      circle(ctx, -4, -4, 4, WHITE, 0);
      break;
    case 'fx_hit_1':
    case 'fx_hit_2':
    case 'fx_hit_3': {
      // Three sparks: eight, six and ten points.
      const n = Number(spec.id.slice(-1)) - 1;
      star(ctx, 0, 0, [30, 33, 28][n], [11, 9, 13][n], [8, 6, 10][n], WHITE, 3, [-Math.PI / 2, 0.4, 0.15][n]);
      break;
    }
    case 'fx_clink_1':
    case 'fx_clink_2':
    case 'fx_clink_3': {
      // A glint and 「カン」, each version with them in another place.
      const n = Number(spec.id.slice(-1)) - 1;
      star(ctx, [0, -6, 4][n], [0, 4, -2][n], [24, 20, 26][n], 5, 4, '#E6EBF2', 3, [0.3, 0, 0.6][n]);
      label(ctx, 'カン', [22, 18, -20][n], [-22, -26, 26][n], 18, INK);
      break;
    }
    case 'fx_boom':
      glow(ctx, 0, 0, 74, '#FFB24D', 0.9);
      star(ctx, 0, 0, 56, 26, 9, '#FFD873', 4);
      circle(ctx, 0, 0, 24, '#FFF3C4', 0);
      break;
    case 'fx_taiyaki_pop':
      // Hot red-bean paste bursting out in blobs, with puffs of steam over it.
      glow(ctx, 0, 6, 80, '#FFC877', 0.75);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        ellipse(ctx, Math.cos(a) * 56, 10 + Math.sin(a) * 40, 15 - (i % 3) * 3, 12 - (i % 3) * 2, '#7A3E35', 3);
      }
      ellipse(ctx, 0, 10, 34, 26, '#8A4A3E', 3.5);
      ellipse(ctx, -9, 2, 10, 6, '#B0675A', 0);
      for (const [x, y, r] of [[-30, -48, 18], [6, -60, 22], [38, -44, 16]]) circle(ctx, x, y, r, WHITE, 3);
      break;
    case 'fx_splat':
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        circle(ctx, Math.cos(a) * 24, Math.sin(a) * 24, 7, '#9FD3F0', 2.5);
      }
      circle(ctx, 0, 0, 12, '#9FD3F0', 2.5);
      break;
    case 'fx_heal':
      // Green light rising on either side, and 「+HP」.
      for (const [x, y0, y1] of [[-70, -78, 60], [-50, 6, 82], [50, -60, 78], [70, -82, 0]]) stroke(ctx, [[x, y0], [x, y1]], 12, 'rgba(158,224,122,0.65)');
      label(ctx, '+HP', 20, -48, 28, '#5A3A2A');
      break;
    case 'fx_heal_1':
    case 'fx_heal_2':
    case 'fx_heal_3':
    case 'fx_heal_black_1':
    case 'fx_heal_black_2':
    case 'fx_heal_black_3': {
      // A ring that spreads and fades over the three frames.
      const n = Number(spec.id.slice(-1)) - 1;
      ctx.globalAlpha = [1, 0.7, 0.3][n];
      arc(ctx, 0, 0, [38, 58, 76][n], 0, Math.PI * 2, 7, spec.id.includes('black') ? '#3B3346' : '#9EE07A');
      break;
    }
    case 'fx_spell':
      glow(ctx, 0, 0, 70, '#D9B8FF', 0.8);
      star(ctx, 0, 0, 44, 20, 8, '#F4E9FF', 3);
      break;
    case 'fx_freeze':
      // A snowflake of ice, with small crystals glinting round it.
      glow(ctx, 0, 0, 46, '#CDEFFF', 0.8);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const tip: [number, number] = [Math.cos(a) * 34, Math.sin(a) * 34];
        stroke(ctx, [[0, 0], tip], 9, INK);
        stroke(ctx, [[0, 0], tip], 5, '#BFE6FA');
      }
      circle(ctx, 0, 0, 9, '#EAF8FF', 3);
      for (const [x, y] of [[-40, -30], [42, -24], [30, 40]]) star(ctx, x, y, 8, 3, 4, '#EAF8FF', 2, 0);
      break;
    case 'fx_note_1':
    case 'fx_note_2':
    case 'fx_note_3':
    case 'fx_note_4':
    case 'fx_note_5':
      label(ctx, '♪♫♬♩♪'[Number(spec.id.slice(-1)) - 1], 0, 0, 40, ['#C35A8C', '#5E8BD6', '#E0913A', '#5DA86A', '#9A6CC9'][Number(spec.id.slice(-1)) - 1]);
      break;
    case 'fx_dust':
      for (let i = 0; i < 6; i++) circle(ctx, -90 + i * 36, 12 - (i % 2) * 14, 20, '#E6DCC8', 2.5);
      break;
    case 'fx_trail':
      // Puffs getting smaller away from the car, which is on the right.
      for (let i = 0; i < 6; i++) circle(ctx, 92 - i * 34, 8 - (i % 2) * 6, 26 - i * 4, '#E6DCC8', 2.5);
      break;
    case 'fx_place':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        star(ctx, Math.cos(a) * 46, 4 + Math.sin(a) * 14, 9, 4, 4, '#FFF2A6', 2, 0);
      }
      break;
    case 'pickup_weed':
      // The icon, centred.
      weedShape(ctx, 0, 34, 1);
      break;
    case 'pickup_drop':
      // The field weed, standing on its feet, with a sparkle.
      weedShape(ctx, 0, -4, 1);
      star(ctx, 30, -66, 7, 3, 4, '#FFF7B8', 0, 0);
      break;
    case 'terrain_stump': {
      const y = -10;
      roundRect(ctx, -56, y - 74, 112, 74, 16, '#B5835A', 4);
      for (let i = -2; i <= 2; i++) stroke(ctx, [[i * 20, y - 50], [i * 20 + 3, y - 12]], 2.5, '#8E6142');
      ellipse(ctx, 0, y - 74, 56, 20, '#DDB78C', 4);
      arc(ctx, 0, y - 74, 30, 0, Math.PI * 2, 2.5, '#B5835A');
      arc(ctx, 0, y - 74, 14, 0, Math.PI * 2, 2.5, '#B5835A');
      break;
    }
    case 'terrain_bush': {
      const y = -10;
      for (const [dx, dy, r] of [
        [-38, -40, 36],
        [36, -40, 36],
        [0, -66, 44],
        [0, -30, 46],
      ] as const)
        circle(ctx, dx, y + dy, r, '#7FB86A', 4);
      for (const [dx, dy] of [
        [-30, -60],
        [24, -76],
        [10, -36],
      ] as const) {
        for (let k = 0; k < 5; k++) circle(ctx, dx + Math.cos(k * 1.26) * 5, y + dy + Math.sin(k * 1.26) * 5, 3.5, WHITE, 0);
        circle(ctx, dx, y + dy, 2.5, '#FFD86B', 0);
      }
      break;
    }
  }
  ctx.restore();
}
