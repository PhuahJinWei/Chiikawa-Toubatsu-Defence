import { describe, expect, it } from 'vitest';
import galleryJson from '../src/data/gallery.json';
import { figureIds, figureLayout, frontOf, isGiant, reachOf, restOf, shadowOf, stage } from '../src/art/figure';
import { frameOf, fullBreath, spriteBox, spriteFor, type SpriteMotion, spriteScale, transformAdjust } from '../src/art/sprite';
import { PEOPLE_SIZE, fighterId, characterSpec, spriteIdFor, TIER_HEIGHT } from '../src/art/spec';
import { ENEMY_LIST, UNIT_LIST } from '../src/game/sim/defs';

// Previews (the gallery's right page, the art kit) show every character on one stage at one scale, so each keeps the
// size it has in battle beside the others. Fitting each one to its own box once made でかつよ look smaller than キメラ.
// The giants are too big for the stage (the user's call, so the small ones show twice as big): they run off its back.

const WIDTHS = [76, 300, 400];
/** How tall a character stands at rest (field pixels, as in battle). */
const tall = (id: string) => -restOf(id)!.y0;
type Box = { x0: number; y0: number; x1: number; y1: number };

/** Every box a preview draws for a character (field pixels, feet at 0, 0): each frame of each motion as the preview
 *  draws it (standing by, at the top of its breath); and its shadow. */
function drawn(id: string): { what: string; b: Box; still: boolean }[] {
  const out: { what: string; b: Box; still: boolean }[] = [];
  const s = spriteFor(id)!;
  const k = spriteScale(s);
  for (const [motion, a] of Object.entries(s.anims)) {
    for (let i = 0; i < (a?.frames ?? 0); i++) {
      const f = frameOf(s, motion as SpriteMotion, i)!;
      // ちいかぶ's transform grows out of the small form, as the preview draws it.
      const adj = f.motion === 'transform' ? transformAdjust(spriteFor('enemy_chiikabu'), s, f) : { k: 1, dx: 0 };
      out.push({ what: `${motion} ${i + 1}`, b: spriteBox(fullBreath(f), adj.dx, 0, k * adj.k), still: motion === 'idle' || motion === 'walk' });
    }
  }
  const sh = shadowOf(id);
  out.push({ what: 'shadow', b: { x0: sh.dx - sh.rx, y0: -4 - sh.rx * 0.24, x1: sh.dx + sh.rx, y1: -4 + sh.rx * 0.24 }, still: false });
  return out;
}

describe('previews: every character true to its size', () => {
  it('can show everyone the gallery stands up, each from its frames', () => {
    const ids = new Set(figureIds());
    for (const e of ENEMY_LIST) expect(ids.has(spriteIdFor('enemy', e.id)), e.id).toBe(true);
    // The gallery's figures: a fighter's battle character, a person's standing picture once there is one.
    for (const e of (galleryJson as { entries: { id: string; tab: string }[] }).entries) {
      // A team stands for all of it: its page shows one member.
      const members = UNIT_LIST.find((u) => u.id === e.id)?.members;
      const id = e.tab === 'people' ? (spriteFor(spriteIdFor('people', e.id)) ? spriteIdFor('people', e.id) : undefined) : members ? spriteIdFor('ally', e.id, members[0]) : fighterId(e.id);
      if (id) expect(ids.has(id), e.id).toBe(true);
    }
    expect(UNIT_LIST.filter((u) => ids.has(spriteIdFor('ally', u.id))).length).toBeGreaterThan(10);
    for (const id of figureIds()) expect(restOf(id), id).not.toBeNull();
  });

  it('draws them all at one scale; everyone but a giant on one ground in one frame', () => {
    for (const w of WIDTHS) {
      const k = w / stage().w;
      for (const id of figureIds()) {
        const l = figureLayout(id, w);
        expect(l.k, id).toBe(k);
        if (isGiant(id)) {
          expect(l.y, id).toBeGreaterThanOrEqual(stage().ground * k);
          expect(l.height, id).toBeGreaterThan(stage().h * k);
        } else {
          expect(l.y, id).toBe(stage().ground * k);
          expect(l.height, id).toBeCloseTo((stage().h * w) / stage().w, 9);
        }
      }
    }
  });

  it('shows でかつよ as much taller than キメラ as on the field (it once looked smaller), and a goblin smaller still', () => {
    const w = 300;
    const shown = (id: string) => tall(id) * figureLayout(id, w).k;
    const dekatsuyo = 'enemy_dekatsuyo';
    const kimera = 'enemy_kimera';
    const goblin = 'enemy_goblin';
    expect(shown(dekatsuyo) / shown(kimera)).toBeCloseTo(tall(dekatsuyo) / tall(kimera), 9);
    expect(shown(dekatsuyo) / shown(kimera)).toBeGreaterThan(1.5);
    expect(shown(kimera) / shown(goblin)).toBeCloseTo(tall(kimera) / tall(goblin), 9);
    expect(tall(dekatsuyo)).toBeCloseTo(TIER_HEIGHT.XXL, -1);
  });

  it('keeps everything everyone but a giant does inside the preview: every frame of every motion, and the shadow', () => {
    const w = 300;
    const eps = 1e-6;
    for (const id of figureIds().filter((x) => !isGiant(x))) {
      const l = figureLayout(id, w);
      for (const { what, b } of drawn(id)) {
        expect(l.x + b.x0 * l.k, `${id} ${what} left`).toBeGreaterThanOrEqual(-eps);
        expect(l.x + b.x1 * l.k, `${id} ${what} right`).toBeLessThanOrEqual(w + eps);
        expect(l.y + b.y0 * l.k, `${id} ${what} top`).toBeGreaterThanOrEqual(-eps);
        expect(l.y + b.y1 * l.k, `${id} ${what} bottom`).toBeLessThanOrEqual(l.height + eps);
      }
    }
  });

  it('lets the giants run off the back of the preview, their heads and fronts in view', () => {
    const w = 300;
    const eps = 1e-6;
    const giants = figureIds().filter(isGiant);
    // Anyone taller than the biggest ordinary size: the three-lane giants, and セイレーン, as tall in her one lane.
    expect(giants).toEqual(expect.arrayContaining(['enemy_dekatsuyo', 'enemy_anoko', 'enemy_seiren']));
    for (const id of giants) {
      const l = figureLayout(id, w);
      const r = reachOf(id)!;
      // Too big for the stage: the stage was measured without them.
      expect(r.x1 - r.x0, id).toBeGreaterThan(stage().w);
      for (const { what, b, still } of drawn(id)) {
        // Never a head cut off, never feet or shadow below the preview.
        expect(l.y + b.y0 * l.k, `${id} ${what} top`).toBeGreaterThanOrEqual(-eps);
        expect(l.y + b.y1 * l.k, `${id} ${what} bottom`).toBeLessThanOrEqual(l.height + eps);
        // An enemy faces left: standing or walking, its front stays in view; its back runs off the right.
        if (still) expect(l.x + b.x0 * l.k, `${id} ${what} front`).toBeGreaterThanOrEqual(-eps);
      }
      expect(l.x + frontOf(id) * l.k, id).toBeGreaterThan(0);
      // One longer than the stage runs off its back; セイレーン, tall but not that long, stands whole.
      const rest = restOf(id)!;
      if (rest.x1 - rest.x0 > stage().w) expect(l.x + rest.x1 * l.k, `${id} runs off`).toBeGreaterThan(w);
    }
    for (const id of ['enemy_dekatsuyo', 'enemy_anoko']) expect(figureLayout(id, w).x + restOf(id)!.x1 * figureLayout(id, w).k, `${id} runs off`).toBeGreaterThan(w);
  });

  it('stands each person on the people pages as tall as the fighter they are as big as (the 鎧さん)', () => {
    for (const [person, like] of Object.entries(PEOPLE_SIZE)) {
      const s = spriteFor(spriteIdFor('people', person));
      if (!s) continue;
      const r = characterSpec(like)!;
      expect(s.height * spriteScale(s), person).toBeCloseTo(r.height ?? TIER_HEIGHT[r.tier], 6);
    }
    expect(Object.keys(PEOPLE_SIZE)).toEqual(expect.arrayContaining(['yoroi_ramen', 'yoroi_rodo']));
  });
});
