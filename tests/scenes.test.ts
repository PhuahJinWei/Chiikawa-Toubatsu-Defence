import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import shop from '../src/data/shop.json';
import en from '../src/i18n/en.json';
import ja from '../src/i18n/ja.json';
import { WORLD_BLEED, worldBleed } from '../src/art/bleed';
import { mergeScene, type SceneLayout } from '../src/art/layout';
import { ALL_IMAGES, LOBBY_SCENE, pieceFiles, QUEST_IMAGES, type SceneLayer, SCENES, type SceneSpec, SHOP_ITEMS, SHOP_SCENE, SOUNDS, STICKER_DETAIL, STICKER_VARIANTS, STICKERS, UI_BUTTONS, UI_ICONS, UI_PROPS, WORLD_SCENES } from '../src/art/spec';
import { LEVEL_LIST, WORLDS } from '../src/game/sim/defs';
import { FIELD_H, FIELD_W, TILE } from '../src/game/sim/constants';
import { lineupSpots, lineupSpotsWet } from '../src/game/render/lineup';
import { battleView, SEEN_LEFT } from '../src/game/render/view';
import { resolveScene } from '../src/art/store';
import {
  BLEED,
  between,
  bottomCrop,
  cutShowing,
  EYES,
  fitScale,
  FOCUS,
  focusCamera,
  focusPoint,
  focusSide,
  hiddenWhileFocused,
  panToward,
  pivotScale,
  project,
  restCamera,
  risen,
  type Viewport,
  Z_REF,
} from '../src/app/scene/camera';
import { SHOP_SPOTS, SHOP_TAGS } from '../src/app/scene/shop';

// Container sizes the menus see: phones (full width, and with a notch's safe areas taken off), a desktop
// window, a 4:3 tablet, an ultrawide.
const SCREENS = [
  { w: 844, h: 390 },
  { w: 760, h: 390 },
  { w: 932, h: 430 },
  { w: 848, h: 430 },
  { w: 1196, h: 720 },
  { w: 940, h: 768 },
  { w: 1836, h: 800 },
];
const MENUS = SCENES.filter((s) => s.kind === 'menu').map(resolveScene);
const viewport = (sc: SceneSpec, { w, h }: { w: number; h: number }): Viewport => ({ w, h, fit: fitScale(sc, w, h) });
/** A menu as the game shows it on this screen: its viewport, and the scene with anything that rises raised. */
const staged = (sc: SceneSpec, scr: { w: number; h: number }) => {
  const vp = viewport(sc, scr);
  return { vp, st: risen(sc, vp) };
};
const corners = (l: { x: number; y: number; w: number; h: number }) => [
  [l.x, l.y],
  [l.x + l.w, l.y],
  [l.x + l.w, l.y + l.h],
  [l.x, l.y + l.h],
];
const shownWith = (sc: SceneSpec, focus: SceneLayer) => sc.layers.filter((o) => !hiddenWhileFocused(o, focus.z));
const people = (sc: SceneSpec) => sc.layers.filter((l) => l.character);
/** Every pan position worth checking: both ends and the middle for wide scenes, rest for the others. */
const restPans = (sc: SceneSpec) => (sc.pan ? [0, 0.5, 1] : [undefined]);

/** Width and height of a PNG, from its header. */
function pngSize(path: string): [number, number] {
  const b = readFileSync(path);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('scene specs', () => {
  it('lists every piece as a picture under art/scenes/<scene>/', () => {
    for (const sc of SCENES) {
      const ids = sc.layers.map((l) => l.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const l of sc.layers) {
        // A loop's frames too: <id>, <id>_2 … all at the piece's size.
        for (const f of pieceFiles(l)) {
          const img = ALL_IMAGES.find((i) => i.key === `scenes/${sc.id}/${f}`);
          expect(img?.kind).toBe('piece');
          expect([img?.w, img?.h]).toEqual([l.w, l.h]);
        }
      }
      expect(new Set(sc.slots.map((s) => s.id)).size).toBe(sc.slots.length);
    }
  });

  it('plays the lobby 鎧さん as a slow 4-frame breathing loop', () => {
    const yoroi = LOBBY_SCENE.layers.find((l) => l.id === 'yoroi')!;
    expect(pieceFiles(yoroi)).toEqual(['yoroi', 'yoroi_2', 'yoroi_3', 'yoroi_4']);
    expect(yoroi.frameMs).toBe(900);
    // The delivered layout keeps the loop.
    expect(resolveScene(LOBBY_SCENE).layers.find((l) => l.id === 'yoroi')?.frames).toBe(4);
  });

  it('orders pieces far to near, with the backmost covering the whole picture', () => {
    for (const sc of SCENES) {
      const zs = sc.layers.map((l) => l.z);
      expect([...zs].sort((a, b) => b - a)).toEqual(zs);
      const back = sc.layers[0];
      expect([back.x, back.y, back.w, back.h, back.edge]).toEqual([0, 0, sc.w, sc.h, false]);
    }
  });

  it('only marks a side as cut where the piece reaches the edge of the picture', () => {
    for (const sc of SCENES) {
      for (const l of sc.layers) {
        for (const side of l.cut ?? []) {
          if (side === 'l') expect(l.x).toBeLessThanOrEqual(2);
          if (side === 'r') expect(l.x + l.w).toBeGreaterThanOrEqual(sc.w - 2);
          if (side === 't') expect(l.y).toBeLessThanOrEqual(2);
          if (side === 'b') expect(l.y + l.h).toBeGreaterThanOrEqual(sc.h - 2);
        }
      }
    }
  });

  it('makes every battle world one flat picture, the field at its planned place', () => {
    for (const spec of WORLD_SCENES) {
      expect([spec.field!.x, spec.field!.y], spec.id).toEqual([900, 360]);
      // Delivered or placeholder: the whole canvas, no cut edge of its own, and stretched past any side of it.
      const sc = resolveScene(spec);
      expect(
        sc.layers.map((l) => [l.id, l.x, l.y, l.w, l.h, l.edge]),
        sc.id,
      ).toEqual([['picture', 0, 0, sc.w, sc.h, false]]);
      expect([...sc.layers[0].cut!].sort(), sc.id).toEqual(['b', 'l', 'r', 't']);
    }
  });

  it('expects a world with water lanes to have the water painted in its picture', () => {
    for (const sc of WORLD_SCENES) expect(!!sc.paintedWater, sc.id).toBe((WORLDS[Number(sc.id.replace('world', ''))]?.water ?? []).length > 0);
  });

  it('gives the quest board its blank paper, a picture for every world in order, the ranking paper’s and the 準備中 stamp', () => {
    expect(QUEST_IMAGES.map((i) => i.key)).toEqual(['quests/paper', ...[1, 2, 3, 4, 5, 6].map((n) => `quests/world${n}`), 'quests/ranking', 'quests/stamp_soon']);
    for (const l of LEVEL_LIST) expect(QUEST_IMAGES.some((i) => i.key === `quests/world${l.world}`)).toBe(true);
    for (const i of QUEST_IMAGES) expect(i.kind).toBe('card');
  });

  it('plans the battle buttons as square game icons with no text, one per button', () => {
    expect(UI_ICONS.map((i) => i.key)).toEqual(['ui/icon_shovel', 'ui/icon_speed', 'ui/icon_speed_active', 'ui/icon_pause']);
    for (const i of UI_ICONS) {
      expect(i.kind).toBe('icon');
      expect(i.w).toBe(i.h);
      expect(ALL_IMAGES.some((x) => x.key === i.key)).toBe(true);
    }
  });

  it('plans the hand stamp that presses each red stamp, with its sound', () => {
    expect(UI_PROPS.map((i) => i.key)).toEqual(['ui/hand_stamp']);
    for (const i of UI_PROPS) expect(ALL_IMAGES.some((x) => x.key === i.key)).toBe(true);
    expect(SOUNDS.some((s) => s.id === 'sfx_stamp')).toBe(true);
  });

  it('plans one square sticker picture for each of the shop’s goods (the steps of an upgrade share one)', () => {
    const pics = shop.sellers.flatMap((s) => s.items.map((i) => `shop/item_${(i as { pic?: string }).pic ?? i.id}`));
    const goods = [...new Set(pics)];
    expect(SHOP_ITEMS.map((i) => i.key)).toEqual(goods);
    for (const i of SHOP_ITEMS) {
      expect(i.kind).toBe('icon');
      expect(i.w).toBe(i.h);
      expect(ALL_IMAGES.some((x) => x.key === i.key)).toBe(true);
    }
  });

  it('has the back button and the lobby buttons as whole pictures, kept within their planned size and shape', () => {
    expect(UI_BUTTONS.map((i) => i.key)).toEqual(['ui/back', 'ui/button_play', 'ui/button_book', 'ui/button_shop', 'ui/button_settings']);
    for (const i of UI_BUTTONS) {
      expect(i.kind).toBe('button');
      expect(ALL_IMAGES.some((x) => x.key === i.key)).toBe(true);
      const png = `art/${i.key}.png`;
      if (!existsSync(png)) continue;
      const [w, h] = pngSize(png);
      expect(w).toBeLessThanOrEqual(i.w);
      expect(h).toBeLessThanOrEqual(i.h);
      // The lobby gives each button the spec's shape, so the picture must have it too.
      expect(Math.abs(w / h - i.w / i.h)).toBeLessThan(0.01);
    }
  });

  it('keeps delivered quest pictures within their planned size (phones decode them small)', () => {
    for (const i of QUEST_IMAGES) {
      const png = `art/${i.key}.png`;
      if (!existsSync(png)) continue;
      const [w, h] = pngSize(png);
      expect(w).toBeLessThanOrEqual(i.w);
      expect(h).toBeLessThanOrEqual(i.h);
    }
  });

  it('has delivered stickers at twice their planned size (sharp on tablets and laptops), in their planned shape', () => {
    for (const s of STICKERS) {
      const png = `art/stickers/${s.id}.png`;
      if (!existsSync(png)) continue;
      const [w, h] = pngSize(png);
      // The game draws a sticker into its planned box, so a picture of another shape would come out stretched.
      expect(Math.abs(w / h - s.w / s.h), png).toBeLessThan(0.01);
      expect(w, png).toBeGreaterThanOrEqual(s.w * STICKER_DETAIL);
    }
  });

  it('knows every picture in art/stickers (a misnamed one would never show)', () => {
    const known = new Set(STICKERS.map((s) => s.id));
    for (const f of readdirSync('art/stickers')) {
      const id = f.replace(/\.(png|webp|jpe?g)$/i, '');
      expect(known.has(id), `art/stickers/${f} is no sticker in src/art/spec/stickers.ts`).toBe(true);
    }
  });

  it('draws hit sparks, clinks, can splashes and 古本屋’s books in versions, each a sticker of its own in place of the one picture', () => {
    for (const [fx, ids] of Object.entries(STICKER_VARIANTS)) {
      expect(ids.length, fx).toBeGreaterThan(1);
      expect(STICKERS.some((s) => s.id === fx), `${fx} is drawn from its versions`).toBe(false);
      for (const id of ids) expect(STICKERS.some((s) => s.id === id), id).toBe(true);
    }
    expect(STICKER_VARIANTS.fx_hit).toEqual(['fx_hit_1', 'fx_hit_2', 'fx_hit_3']);
    expect(STICKER_VARIANTS.fx_clink).toEqual(['fx_clink_1', 'fx_clink_2', 'fx_clink_3']);
    expect(STICKER_VARIANTS.fx_can_splash).toEqual(['fx_can_splash_1', 'fx_can_splash_2', 'fx_can_splash_3']);
    // 古本屋's books: each one thrown is one of the three (the renderer keeps it all the way).
    expect(STICKER_VARIANTS.fx_book).toEqual(['fx_book_1', 'fx_book_2', 'fx_book_3']);
    for (const id of STICKER_VARIANTS.fx_book) expect(STICKERS.find((s) => s.id === id)?.group, id).toBe('projectile');
    // The car's and the boat's trail is a picture of its own; the stomp keeps the dust.
    expect(STICKERS.some((s) => s.id === 'fx_trail')).toBe(true);
    expect(STICKERS.some((s) => s.id === 'fx_dust')).toBe(true);
  });
});

describe('delivered scene art', () => {
  it('has a picture for every piece in each layout.json, at the size it says (or twice it)', () => {
    for (const sc of SCENES) {
      const path = `art/scenes/${sc.id}/layout.json`;
      if (!existsSync(path)) continue;
      const lay = JSON.parse(readFileSync(path, 'utf-8')) as SceneLayout;
      for (const p of lay.pieces) {
        const png = `art/scenes/${sc.id}/${p.id}.png`;
        expect(existsSync(png)).toBe(true);
        const [w, h] = pngSize(png);
        const k = w / p.w;
        expect(k === 1 || k === 2).toBe(true);
        expect(Math.abs(h - p.h * k)).toBeLessThan(1.5);
        // Every frame of a loop, at the first frame's size.
        for (let n = 2; n <= (p.frames ?? 1); n++) {
          const frame = `art/scenes/${sc.id}/${p.id}_${n}.png`;
          expect(existsSync(frame), frame).toBe(true);
          expect(pngSize(frame)).toEqual([w, h]);
        }
      }
    }
  });

  it('scales slots and the safe area with a picture of another size', () => {
    const layout: SceneLayout = { kind: 'scene', w: 3240, h: 1944, pieces: [{ id: 'shop_wall', x: 0, y: 0, w: 3240, h: 1944 }] };
    const sc = mergeScene(SHOP_SCENE, layout);
    expect(sc.slots[0].x).toBeCloseTo(SHOP_SCENE.slots[0].x * 2);
    expect(sc.safe.x1).toBeCloseTo(SHOP_SCENE.safe.x1 * 2);
  });
});

describe('menu cameras', () => {
  it('look exactly like the flat picture at rest, on every screen', () => {
    for (const sc of MENUS) {
      for (const scr of SCREENS) {
        const { vp, st } = staged(sc, scr);
        for (const k of restPans(st)) {
          const cam = restCamera(st, vp, k);
          for (const l of st.layers) {
            for (const [x, y] of corners(l)) {
              const p = project(st, l.z, cam, x, y, vp)!;
              expect(p.x).toBeCloseTo(vp.w / 2 + vp.fit * (x - st.w / 2 + cam.ox), 6);
              expect(p.y).toBeCloseTo(vp.h / 2 + vp.fit * (y - st.h / 2 + cam.oy), 6);
            }
          }
        }
      }
    }
  });

  it('show the whole safe area at rest on every screen, with every character aimed inside it', () => {
    for (const sc of MENUS.filter((s) => !s.pan)) {
      const s = sc.safe;
      for (const scr of SCREENS) {
        const { vp, st } = staged(sc, scr);
        const cam = restCamera(st, vp);
        for (const [x, y] of corners({ x: s.x0, y: s.y0, w: s.x1 - s.x0, h: s.y1 - s.y0 })) {
          const p = project(st, Z_REF, cam, x, y, vp)!;
          expect(p.x).toBeGreaterThanOrEqual(-0.5);
          expect(p.x).toBeLessThanOrEqual(scr.w + 0.5);
          expect(p.y).toBeGreaterThanOrEqual(-0.5);
          expect(p.y).toBeLessThanOrEqual(scr.h + 0.5);
        }
      }
      for (const l of people(sc)) {
        const q = focusPoint(l);
        expect(q.x).toBeGreaterThanOrEqual(s.x0);
        expect(q.x).toBeLessThanOrEqual(s.x1);
        expect(q.y).toBeGreaterThanOrEqual(s.y0);
        expect(q.y).toBeLessThanOrEqual(s.y1);
      }
    }
  });

  it('show every slot at rest (wide scenes: once panned to it)', () => {
    for (const sc of MENUS) {
      for (const scr of SCREENS) {
        const { vp, st } = staged(sc, scr);
        for (const s of st.slots) {
          const cam = restCamera(st, vp, st.pan ? panToward(st, vp, s.x) : undefined);
          for (const [x, y] of corners({ x: s.x - s.w / 2, y: s.y - s.h / 2, w: s.w, h: s.h })) {
            const p = project(st, Z_REF, cam, x, y, vp)!;
            expect(p.x).toBeGreaterThanOrEqual(-1);
            expect(p.x).toBeLessThanOrEqual(scr.w + 1);
            expect(p.y).toBeGreaterThanOrEqual(-1);
            expect(p.y).toBeLessThanOrEqual(scr.h + 1);
          }
        }
      }
    }
  });

  it('never show a cut edge, at rest, panned or close up, however the view sways and leans', () => {
    for (const sc of MENUS) {
      for (const scr of SCREENS) {
        const { vp, st } = staged(sc, scr);
        for (const k of restPans(st)) expect(cutShowing(st, restCamera(st, vp, k), vp)).toBeLessThanOrEqual(1e-6);
        for (const l of people(st)) {
          const cam = focusCamera(st, l, focusSide(st, l), vp);
          expect(cutShowing(st, cam, vp, shownWith(st, l))).toBeLessThanOrEqual(1e-6);
        }
      }
    }
  });

  it('keep the stretched edges covering the screen all the way through every camera move', () => {
    for (const sc of MENUS) {
      for (const scr of SCREENS) {
        const { vp, st } = staged(sc, scr);
        const rest = restCamera(st, vp);
        for (const l of people(st)) {
          const cam = focusCamera(st, l, focusSide(st, l), vp);
          for (let t = 0.05; t < 1; t += 0.05) expect(cutShowing(st, between(rest, cam, t), vp, st.layers, EYES, BLEED)).toBeLessThanOrEqual(1e-6);
        }
      }
    }
  });

  it('zoom each character to its own side, clear of the paper sheet, with everything in front of the camera', () => {
    for (const sc of MENUS) {
      for (const scr of SCREENS) {
        const { vp, st } = staged(sc, scr);
        for (const l of people(st)) {
          const side = focusSide(st, l);
          const cam = focusCamera(st, l, side, vp);
          const q = focusPoint(l);
          const c = project(st, l.z, cam, q.x, q.y, vp)!;
          expect((side === 'left' ? c.x : scr.w - c.x) / scr.w).toBeLessThanOrEqual(FOCUS.band);
          expect(c.y).toBeGreaterThan(0);
          expect(c.y).toBeLessThan(scr.h);
          // Not zoomed much past what the character asks for.
          expect(pivotScale(cam.dolly) * (l.z / Z_REF)).toBeLessThanOrEqual(l.character!.zoom * 1.12);
          for (const o of shownWith(st, l)) for (const [x, y] of corners(o)) for (const e of EYES) expect(project(st, o.z, cam, x, y, vp, e)).not.toBeNull();
        }
      }
    }
  });
});

describe('the shop', () => {
  it('pins each name tag where it is seen at rest on every screen', () => {
    const sc = resolveScene(SHOP_SCENE);
    expect(Object.keys(SHOP_TAGS).sort()).toEqual(sc.slots.map((s) => s.id).sort());
    // Tag width in stage pixels: 28 px type (Latin about 16 px a letter) plus padding and border.
    const width = (text: string) => [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2000 ? 28 : 16), 0) + 46;
    for (const scr of SCREENS) {
      const { vp, st } = staged(sc, scr);
      const cam = restCamera(st, vp);
      for (const s of st.slots) {
        const seller = SHOP_TAGS[s.id] as 'ramen' | 'pochette' | 'shisa';
        const half = Math.max(width(ja.shop.sellers[seller].name), width(en.shop.sellers[seller].name)) / 2;
        for (const [dx, dy] of [
          [-half, -s.h / 2],
          [half, s.h / 2],
        ]) {
          const p = project(st, Z_REF, cam, s.x + dx, s.y + dy, vp)!;
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(scr.w);
          expect(p.y).toBeLessThanOrEqual(scr.h);
        }
      }
    }
  });

  it('raises Shisa on screens that crop the bottom, enough to show her face, with the tag over her head', () => {
    const sc = resolveScene(SHOP_SCENE);
    const before = sc.layers.find((l) => l.id === 'shop_shisa')!;
    let raised = 0;
    for (const scr of SCREENS) {
      const { vp, st } = staged(sc, scr);
      const her = st.layers.find((l) => l.id === 'shop_shisa')!;
      const tag = st.slots.find((s) => s.id === 'tag_shisa')!;
      if (bottomCrop(sc, vp) <= 0) {
        // The whole height fits (desktop windows, tablets): she stands where she was drawn.
        expect(her.y).toBe(before.y);
        continue;
      }
      raised++;
      expect(her.y).toBeLessThan(before.y);
      // Her whole face, down past her mouth (about 60% of the way down her piece), is on screen at rest.
      const cam = restCamera(st, vp);
      const chin = project(st, her.z, cam, her.x + her.w / 2, her.y + her.h * 0.62, vp)!;
      expect(chin.y).toBeLessThanOrEqual(scr.h);
      // Her shop's tag over her head moves up with her and never sits on her.
      expect(tag.y + tag.h / 2).toBeLessThanOrEqual(her.y);
    }
    expect(raised).toBeGreaterThan(0);
  });

  it('every shop character opens a real seller, and every seller can be reached', () => {
    const sellers = new Set(shop.sellers.map((s) => s.id));
    for (const [id, spot] of Object.entries(SHOP_SPOTS)) {
      expect(SHOP_SCENE.layers.find((l) => l.id === id)?.character).toBeTruthy();
      expect(sellers.has(spot.seller)).toBe(true);
    }
    expect(new Set(Object.values(SHOP_SPOTS).map((s) => s.seller))).toEqual(sellers);
  });
});

describe('battle worlds', () => {
  it('give every world with jobs its own picture and its own music', () => {
    for (const w of new Set(LEVEL_LIST.map((l) => l.world))) {
      expect(WORLD_SCENES.some((sc) => sc.id === `world${w}`)).toBe(true);
      expect(WORLDS[w].bgm).toBe(`bgm_world${w}`);
      expect(SOUNDS.some((s) => s.id === WORLDS[w].bgm && s.kind === 'bgm')).toBe(true);
    }
  });

  // The battle camera on the HUD's real sizes: W, H and the phone's notch inset. The card column is 72 px wide on phones
  // and 86 on tall screens (past the notch), the top strip 44 and 52.
  const CAMERA_SCREENS = [
    [640, 360, 0],
    [844, 390, 0],
    [844, 390, 47],
    [852, 393, 59],
    [932, 430, 59],
    [667, 375, 0],
    [1024, 768, 0],
    [1366, 1024, 0],
    [1180, 820, 0],
    [1280, 720, 0],
    [1440, 900, 0],
    [2560, 1080, 0],
    [3440, 1440, 0],
  ];
  const visible = (sc: SceneSpec, W: number, H: number, notch: number) => {
    const tall = H >= 560;
    const left = notch + (tall ? 86 : 72);
    const top = tall ? 52 : 44;
    const { scale: s, ox, oy } = battleView(W, H, { left, top, right: 0 }, { h: sc.h, field: sc.field! });
    return { s, ox, oy, left, top, x0: -ox / s, y0: -oy / s, x1: (W - ox) / s, y1: (H - oy) / s };
  };

  it('cover everything the battle camera shows, from phones to 21:9 (with the stretched edges)', () => {
    for (const sc of WORLD_SCENES.map(resolveScene)) {
      const f = sc.field!;
      for (const [W, H, notch] of CAMERA_SCREENS) {
        const v = visible(sc, W, H, notch);
        expect(v.x0 + f.x).toBeGreaterThanOrEqual(-worldBleed(f.x).l);
        expect(v.y0 + f.y).toBeGreaterThanOrEqual(-WORLD_BLEED.t - 1e-6);
        expect(v.x1 + f.x).toBeLessThanOrEqual(sc.w + WORLD_BLEED.r);
        expect(v.y1 + f.y).toBeLessThanOrEqual(sc.h + WORLD_BLEED.b + 1e-6);
      }
    }
  });

  it('reach past the left of every screen when drawn to the planned width, so nothing is stretched there', () => {
    for (const sc of WORLD_SCENES) {
      for (const [W, H, notch] of CAMERA_SCREENS) expect(visible(sc, W, H, notch).x0 + sc.field!.x, `${sc.id} on ${W}×${H}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('keep the field the same distance from the right edge, whatever the width of the delivered picture', () => {
    const spec = WORLD_SCENES[1];
    const pieces = [{ id: 'picture', x: 0, y: 0, w: 1, h: 1 }];
    for (const w of [3060, 3200, spec.w]) {
      const merged = mergeScene(spec, { kind: 'scene', w, h: spec.h, pieces });
      expect(merged.w - merged.field!.x, `${w}`).toBe(2460);
      expect(merged.field!.y).toBe(spec.field!.y);
    }
    // World 1's picture, as delivered, and the road ahead of it.
    for (const sc of WORLD_SCENES.map(resolveScene)) expect(sc.w - sc.field!.x, sc.id).toBe(2460);
  });

  it('show most of the protected place beside the cards, then the cars and the whole field below the strip, on every screen', () => {
    for (const sc of WORLD_SCENES.map(resolveScene)) {
      for (const [W, H, notch] of CAMERA_SCREENS) {
        const v = visible(sc, W, H, notch);
        // The protected place, from the card column's right edge.
        expect((v.left - v.ox) / v.s).toBeLessThanOrEqual(-SEEN_LEFT + 1e-6);
        // The cars, and the field's far end.
        expect(v.ox - 200 * v.s).toBeGreaterThanOrEqual(v.left);
        expect(v.ox + FIELD_W * v.s).toBeLessThanOrEqual(W);
        // Top to bottom, clear of the strip.
        expect(v.oy - 12 * v.s).toBeGreaterThanOrEqual(v.top - 1e-6);
        expect(v.oy + (FIELD_H + 14) * v.s).toBeLessThanOrEqual(H + 1e-6);
      }
    }
  });

  it('line the swimmers up in the water and everyone else on the land, with water about', () => {
    const swims = [false, true, false, false, true, false, false];
    const spots = lineupSpotsWet(swims, 2460, [2]);
    expect(new Set(spots.map((s) => `${Math.round(s.x)},${Math.round(s.y)}`)).size).toBe(swims.length);
    spots.forEach((s, i) => expect(Math.floor(s.y / TILE) === 2).toBe(swims[i]));
    // Without water it is the usual crowd.
    expect(lineupSpotsWet(swims, 2460, [])).toEqual(lineupSpots(swims.length, 2460));
  });

  it('leave a road right of the field wide enough for the enemies waiting before a battle', () => {
    for (const sc of WORLD_SCENES.map(resolveScene)) {
      const right = sc.w - sc.field!.x;
      // Up to every enemy kind there is (endless mode), each on the road and inside the picture.
      for (let n = 1; n <= 12; n++) {
        const spots = lineupSpots(n, right);
        expect(new Set(spots.map((s) => `${Math.round(s.x)},${Math.round(s.y)}`)).size).toBe(n);
        for (const s of spots) {
          // Half the widest enemy (an XL boss) still clears the field and the picture's edge.
          expect(s.x - 170).toBeGreaterThanOrEqual(FIELD_W);
          expect(s.x + 170).toBeLessThanOrEqual(right);
          expect(s.y).toBeGreaterThan(0);
          expect(s.y).toBeLessThanOrEqual(FIELD_H);
        }
      }
    }
  });
});
