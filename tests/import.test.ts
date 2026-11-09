import { describe, expect, it } from 'vitest';
import { alphaBox, cutSides, frameGroups, layerName, layerOrder, leadingNumber, locate, mapLayers, type RGBA, unionBox } from '../tools/lib/layers';

/** A blank picture. */
function blank(w: number, h: number): RGBA {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

/** Paint a filled ellipse with a dark outline and a few stripes, so the shape has features to match on. */
function blob(img: RGBA, cx: number, cy: number, rx: number, ry: number, rgb: [number, number, number]): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d > 1) continue;
      const edge = d > 0.82 || (x + y) % 23 < 3;
      const i = (y * img.w + x) * 4;
      img.data.set(edge ? [60, 47, 47, 255] : [...rgb, 255], i);
    }
  }
}

/** Composite layers (back to front) at their places. */
function composite(w: number, h: number, layers: { img: RGBA; x: number; y: number }[]): RGBA {
  const out = blank(w, h);
  for (const { img, x, y } of layers) {
    for (let ly = 0; ly < img.h; ly++) {
      for (let lx = 0; lx < img.w; lx++) {
        const s = (ly * img.w + lx) * 4;
        if (img.data[s + 3] < 128) continue;
        const px = lx + x;
        const py = ly + y;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        out.data.set(img.data.subarray(s, s + 4), (py * w + px) * 4);
      }
    }
  }
  return out;
}

describe('layer import', () => {
  it('finds cropped layers in the preview, even where nearer layers cover them', () => {
    const W = 420;
    const H = 260;
    const back = blank(W, H);
    for (let i = 0; i < back.data.length; i += 4) back.data.set([200 + ((i / 4) % 7), 230, 225, 255], i);
    const a = blank(160, 140);
    blob(a, 80, 70, 76, 66, [250, 210, 90]);
    const b = blank(120, 120);
    blob(b, 60, 60, 56, 56, [240, 150, 170]);
    // A piece cut off by the picture's right and bottom edges, as an editor exports it.
    const c = blank(90, 70);
    blob(c, 50, 40, 46, 36, [150, 200, 120]);
    const truth = [
      { img: back, x: 0, y: 0 },
      { img: a, x: 40, y: 60 },
      { img: b, x: 150, y: 90 },
      { img: c, x: 330, y: 190 },
    ];
    const preview = composite(W, H, truth);
    const found = locate(
      preview,
      truth.map((t) => t.img),
    );
    found.forEach((p, i) => {
      expect([p.x, p.y]).toEqual([truth[i].x, truth[i].y]);
      expect(p.match).toBeGreaterThan(0.9);
    });
    // The last blob runs off the right and bottom of the picture.
    expect(cutSides(c, 330, 190, W, H)).toEqual(['r', 'b']);
    expect(cutSides(back, 0, 0, W, H)).toEqual(['l', 'r', 't', 'b']);
    expect(cutSides(a, 40, 60, W, H)).toEqual([]);
  });

  it('finds the visible box of a full-canvas layer', () => {
    const img = blank(200, 200);
    blob(img, 100, 120, 40, 60, [255, 255, 255]);
    expect(alphaBox(img)).toEqual({ x: 60, y: 60, w: 81, h: 121 });
  });

  it('names layers by their spec piece: by name first, else by order when the counts agree', () => {
    expect(layerName('03-character-silver-customer.png')).toBe('character-silver-customer');
    expect(['10-b.png', '2-a.png', '00-z.png'].sort(layerOrder)).toEqual(['00-z.png', '2-a.png', '10-b.png']);
    const byOrder = mapLayers(['00-background.png', '01-cook.png'], ['shop_wall', 'shop_master']);
    expect(byOrder.map((m) => [m.id, m.how])).toEqual([
      ['shop_wall', 'order'],
      ['shop_master', 'order'],
    ]);
    const byName = mapLayers(['00-wall.png', '01-cook.png', '02-lamp.png'], ['shelf', 'wall', 'cook']);
    expect(byName.map((m) => [m.id, m.how])).toEqual([
      ['wall', 'name'],
      ['cook', 'name'],
      ['lamp', 'new'],
    ]);
    expect(mapLayers(['00-x.png'], ['wall'], { '00-x.png': 'wall' })[0]).toEqual({ file: '00-x.png', id: 'wall', how: 'map' });
  });

  it('groups numbered frames into idle loops, and only full runs from _1', () => {
    const files = ['00-wall.png', '02-character.png', '02-character-idle_2.png', '02-character-idle_1.png', '02-character-idle_4.png', '02-character-idle_3.png', '03-lamp_2.png', '04-sign_1.png'];
    expect(frameGroups(files)).toEqual([{ stem: '02-character-idle', files: ['02-character-idle_1.png', '02-character-idle_2.png', '02-character-idle_3.png', '02-character-idle_4.png'] }]);
    // A gap, or a lone frame, is not a loop.
    expect(frameGroups(['a_1.png', 'a_3.png'])).toEqual([]);
    expect(leadingNumber('02-character-idle')).toBe('02');
    expect(leadingNumber('character.png')).toBeUndefined();
  });

  it('measures a loop in one box around every frame', () => {
    expect(
      unionBox([
        { x: 16, y: 15, w: 952, h: 687 },
        { x: 17, y: 6, w: 951, h: 695 },
      ]),
    ).toEqual({ x: 16, y: 6, w: 952, h: 696 });
    expect(unionBox([])).toBeNull();
  });
});
