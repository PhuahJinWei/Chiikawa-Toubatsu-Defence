import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import galleryJson from '../src/data/gallery.json';
import { BREATH_MS, BREATH_RISE, frameOf, frontShift, fullBreath, motionFor, motionKeys, ONCE_MS, REACH, spriteBox, spriteFor, spriteFrame, spriteIds, spriteKeys, spriteScale, spriteStickerBox, type SpriteLayout, transformAdjust } from '../src/art/sprite';
import { GALLERY_MOTIONS, PAJAMA_MEMBERS, characterSpec, sizeSpec, SPRITE_LOOP_MS, spriteIdFor, STAR_SPRITE, teamSpec, TIER_HEIGHT } from '../src/art/spec';
import { ENEMY_LIST, UNIT_LIST } from '../src/game/sim/defs';

const ART = join(process.cwd(), 'art');

describe('sprites (battle characters drawn from frames)', () => {
  it('has every frame file its layout lists, and each frame stands inside its box', () => {
    expect(spriteIds().length).toBeGreaterThan(0);
    for (const id of spriteIds()) {
      const s = spriteFor(id)!;
      expect(s.id).toBe(id);
      expect(s.height).toBeGreaterThan(50);
      for (const [motion, a] of Object.entries(s.anims)) {
        expect(a.frames, `${id} ${motion}`).toBeGreaterThan(0);
        expect(a.boxes).toHaveLength(a.frames);
        expect(a.ax, `${id} ${motion} ax`).toBeGreaterThanOrEqual(0);
        expect(a.ax).toBeLessThanOrEqual(a.w);
        expect(a.ay, `${id} ${motion} ay`).toBeGreaterThan(0);
        // Frames lifted off the ground all through a motion (a flier's flapping, a hop) end above where it stands.
        expect(a.ay).toBeLessThanOrEqual(a.h + 40);
        for (let i = 1; i <= a.frames; i++) {
          const png = join(ART, 'sprites', id, `${motion}_${i}.png`);
          expect(existsSync(png), `${id}/${motion}_${i}.png`).toBe(true);
          // Cut to the layout's box: a redrawn frame copied in without npm run art:sprites is drawn squeezed and
          // cropped (ちいかぶ's fall, 魔女's idle on 2026-11-07).
          const head = readFileSync(png).subarray(16, 24);
          expect([head.readUInt32BE(0), head.readUInt32BE(4)], `${id}/${motion}_${i}.png: bring it in with npm run art:sprites`).toEqual([a.w, a.h]);
        }
      }
    }
  });

  it('gives every enemy delivered as frames each motion it uses in the game', () => {
    for (const id of spriteIds()) {
      const r = characterSpec(id);
      if (!r) continue;
      const s = spriteFor(id)!;
      const need = new Set(['idle']);
      if (r.motions.includes('walk') || r.motions.includes('float')) need.add('walk');
      if (r.motions.includes('attack') || r.motions.includes('heal')) need.add('attack');
      if (r.motions.includes('collapse')) need.add('death');
      if (r.motions.includes('transform')) need.add('transform');
      for (const m of need) expect(s.anims[m as 'idle'], `${id} needs ${m}`).toBeDefined();
    }
  });

  it('knows every folder in art/sprites: each was brought in (has its sprite.json) and is a character or a person', () => {
    const people = (galleryJson as { entries: { id: string; tab: string }[] }).entries.filter((e) => e.tab === 'people').map((e) => spriteIdFor('people', e.id));
    const known = new Set([
      ...UNIT_LIST.flatMap((u) => (u.members ? u.members.map((m) => spriteIdFor('ally', u.id, m)) : [spriteIdFor('ally', u.id)])),
      ...ENEMY_LIST.map((e) => spriteIdFor('enemy', e.id)),
      spriteIdFor('enemy', 'chiikabu', 'true'),
      ...people,
    ]);
    for (const dir of readdirSync(join(ART, 'sprites'))) {
      expect(existsSync(join(ART, 'sprites', dir, 'sprite.json')), `art/sprites/${dir} has no sprite.json: bring its frames in with npm run art:sprites`).toBe(true);
      // A folder copied from another character's still names that character, and so draws that character's pictures.
      expect(JSON.parse(readFileSync(join(ART, 'sprites', dir, 'sprite.json'), 'utf8')).id, `art/sprites/${dir}/sprite.json names someone else: bring its frames in with npm run art:sprites`).toBe(dir);
      expect(known.has(dir) || !!characterSpec(dir), `art/sprites/${dir} is no character in the game, nor a person in the gallery`).toBe(true);
    }
    // The three 鎧さん stand on the gallery's people pages: one still picture each.
    for (const id of ['yoroi_ramen', 'yoroi_rodo', 'yoroi_pochette']) expect(spriteFor(spriteIdFor('people', id))?.anims.idle, id).toBeDefined();
  });

  it('draws Rakko’s car and boat from one picture each: as tall as they were given, holding still', () => {
    for (const [id, tall] of [
      ['rescue_rakko_car', 130],
      ['rescue_rakko_boat', 96],
    ] as const) {
      const s = spriteFor(id)!;
      expect(Object.keys(s.anims), id).toEqual(['idle']);
      expect(s.anims.idle!.frames, id).toBe(1);
      // The boat is longer than a long character may be, and keeps its height all the same.
      expect(s.height * spriteScale(s), id).toBeCloseTo(tall, 6);
      for (const anim of ['parked', 'drive']) expect(spriteFrame(s, anim, 300)!.sy, `${id} ${anim}`).toBe(1);
    }
  });

  it('has frames for every enemy', () => {
    const missing = ENEMY_LIST.map((e) => spriteIdFor('enemy', e.id)).filter((id) => !spriteFor(id));
    expect(missing).toEqual([]);
    expect(spriteFor('enemy_chiikabu_true')?.anims.transform).toBeDefined();
    // キメラ with her claws out.
    expect(spriteFor('enemy_kimera_claws')?.anims.attack).toBeDefined();
  });

  it('loops travel and waiting, plays strikes, falls and transforms once, and holds the last frame', () => {
    const s = spriteFor('enemy_goblin')!;
    const walk = s.anims.walk!.frames;
    expect(spriteFrame(s, 'walk', 0, { walkMs: 100 })!.i).toBe(0);
    expect(spriteFrame(s, 'walk', 100 * walk + 150, { walkMs: 100 })!.i).toBe(1);
    expect(spriteFrame(s, 'attack', 0)!.motion).toBe('attack');
    expect(spriteFrame(s, 'attack', 519)!.i).toBe(s.anims.attack!.frames - 1);
    expect(spriteFrame(s, 'attack', 5000)!.i).toBe(s.anims.attack!.frames - 1);
    expect(spriteFrame(s, 'collapse', 5000)!.motion).toBe('death');
    expect(spriteFrame(s, 'collapse', 5000)!.i).toBe(s.anims.death!.frames - 1);
    // 黒い星 floats on its walk frames and heals with its ♪ frames; 山姥 chants with hers.
    const star = spriteFor('enemy_kuroi_nagareboshi')!;
    expect(spriteFrame(star, 'float', 0)!.motion).toBe('walk');
    expect(spriteFrame(star, 'heal', 0)!.motion).toBe('attack');
    expect(spriteFrame(spriteFor('enemy_yamanba')!, 'spell', 0)!.motion).toBe('ability');
    // Without frames for a motion, it waits.
    expect(spriteFrame(spriteFor('enemy_guchokipanogitaigata')!, 'song', 0)!.motion).toBe('idle');
  });

  it('has frames for every friend: each member of a team on its own, sized and moving like the team', () => {
    const missing = UNIT_LIST.flatMap((u) => (u.members ? u.members.map((m) => spriteIdFor('ally', u.id, m)) : [spriteIdFor('ally', u.id)])).filter((id) => !spriteFor(id));
    expect(missing).toEqual([]);
    expect(UNIT_LIST.find((u) => u.id === 'pajama_parties')?.members).toEqual([...PAJAMA_MEMBERS]);
    for (const m of PAJAMA_MEMBERS) {
      const id = spriteIdFor('ally', 'pajama_parties', m);
      expect(id).toBe(`ally_pajama_parties_${m}`);
      expect(teamSpec(id)?.id).toBe('ally_pajama_parties');
      expect(sizeSpec(id)?.tier).toBe('S');
      expect(spriteFrame(spriteFor(id)!, 'song', 0)!.motion).toBe('ability');
    }
  });

  it('plays ちいかわ’s search as a loop and her find once, her hand up by its last frame', () => {
    const s = spriteFor('ally_chiikawa')!;
    expect(spriteFrame(s, 'weed_search', 0)!.motion).toBe('weed_search');
    expect(spriteFrame(s, 'weed_search', 1599)!.i).toBe(s.anims.weed_search!.frames - 1);
    expect(spriteFrame(s, 'weed_search', 1600)!.i).toBe(0);
    const last = s.anims.weed_found!.frames - 1;
    expect(spriteFrame(s, 'weed_found', 479)!.i).toBeLessThan(last);
    expect(spriteFrame(s, 'weed_found', 480)!.i).toBe(last);
    expect(spriteFrame(s, 'weed_found', 5000)!.i).toBe(last);
    // Pulling up a weed beside her is the same picture.
    expect(spriteFrame(s, 'pull', 0)!.motion).toBe('weed_found');
  });

  it('plays むちゃうマン’s pose once, holding its last frame', () => {
    const s = spriteFor('ally_muchauman')!;
    expect(spriteFrame(s, 'pose', 0)!.motion).toBe('ability');
    expect(spriteFrame(s, 'pose', 5000)!.i).toBe(s.anims.ability!.frames - 1);
  });

  it('plays 星’s cast through its attack frames once, holding the last, and the gallery can show it', () => {
    const s = spriteFor(STAR_SPRITE)!;
    expect(motionFor(s, 'cast')).toBe('attack');
    const n = s.anims.attack!.frames;
    expect(Array.from({ length: n }, (_, i) => spriteFrame(s, 'cast', ((i + 0.5) / n) * ONCE_MS.cast)!.i)).toEqual(Array.from({ length: n }, (_, i) => i));
    expect(spriteFrame(s, 'cast', ONCE_MS.cast * 3)!.i).toBe(n - 1);
    expect(motionKeys(s, 'cast')).toHaveLength(n);
    expect(GALLERY_MOTIONS).toContain('cast');
  });

  it('shows たい焼き’s cooking stages by how far along it is, as the battle asks for them', () => {
    const s = spriteFor('ally_taiyaki')!;
    const n = s.anims.cook!.frames;
    expect(spriteFrame(s, 'cook', 0, { at: 0 })!.i).toBe(0);
    expect(spriteFrame(s, 'cook', 0, { at: 0.999 * ((n - 1) / n) })!.i).toBe(n - 2);
    expect(spriteFrame(s, 'cook', 0, { at: 1 })!.i).toBe(n - 1);
  });

  it('plays パジャマパーティーズ’ dance in its 6.33 s however many frames it has, in battle and in the gallery alike', () => {
    for (const m of PAJAMA_MEMBERS) expect(SPRITE_LOOP_MS[`ally_pajama_parties_${m}`]?.ability).toBe(6330);
    const box: [number, number, number, number] = [0, 0, 300, 240];
    for (const frames of [24, 48, 100]) {
      const dancers: SpriteLayout = {
        kind: 'sprite',
        id: 'ally_pajama_parties_green',
        height: 230,
        anims: {
          idle: { frames: 4, w: 300, h: 240, ax: 150, ay: 230, boxes: [box, box, box, box] },
          ability: { frames, w: 300, h: 240, ax: 150, ay: 230, boxes: Array.from({ length: frames }, () => box) },
        },
      };
      // Their song is their dance: from its first frame to its last within the 6.33 s, then round again.
      expect(spriteFrame(dancers, 'song', 0)!.motion).toBe('ability');
      expect(spriteFrame(dancers, 'song', 0)!.i).toBe(0);
      expect(spriteFrame(dancers, 'song', 6329)!.i).toBe(frames - 1);
      expect(spriteFrame(dancers, 'song', 6330)!.i).toBe(0);
      // The gallery draws a bigger friend at a slower tempo, the battle at none: the dance keeps its length in both.
      for (const tempo of [1, 1.15]) expect(spriteFrame(dancers, 'song', 3166, { tempo })!.i).toBe(frames / 2);
      // Their other loops still go at the usual pace (a frame every 0.26 s standing by).
      expect(spriteFrame(dancers, 'idle', 261)!.i).toBe(1);
    }
  });

  it('stands every character by on one picture, nothing left of any other idle frame', () => {
    for (const id of spriteIds()) {
      expect(spriteFor(id)!.anims.idle?.frames, id).toBe(1);
      expect(readdirSync(join(ART, 'sprites', id)).filter((f) => f.startsWith('idle_') && !f.startsWith('idle_1.')), id).toEqual([]);
    }
  });

  it('makes one picture standing by breathe: as drawn, 2% taller halfway through, back again, its feet where they are', () => {
    const s = spriteFor('enemy_goblin')!;
    const at = (t: number, tempo?: number) => spriteFrame(s, 'idle', t, { tempo })!;
    expect(BREATH_RISE).toBe(0.02);
    expect(at(0).sy).toBe(1);
    expect(at(BREATH_MS / 2).sy).toBeCloseTo(1.02, 9);
    expect(at(BREATH_MS).sy).toBeCloseTo(1, 9);
    expect(at(BREATH_MS / 2).i).toBe(0);
    // A bigger character takes longer over each breath.
    expect(at(BREATH_MS / 2, 1.5).sy).toBeLessThan(1.02);
    expect(at((BREATH_MS * 1.5) / 2, 1.5).sy).toBeCloseTo(1.02, 9);
    // Its head rises and its feet stay, and everything drawn off screen first (a fade, a flash) has room for the rise.
    const k = spriteScale(s);
    const rest = spriteBox(at(0), 0, 0, k);
    const top = spriteBox(at(BREATH_MS / 2), 0, 0, k);
    expect(top.y0).toBeCloseTo(rest.y0 * 1.02, 9);
    expect(Math.abs(top.y1 - rest.y1)).toBeLessThan(0.1);
    expect([top.x0, top.x1]).toEqual([rest.x0, rest.x1]);
    expect(spriteStickerBox(at(BREATH_MS / 2), 0, 0, k).y0).toBeLessThan(spriteStickerBox(at(0), 0, 0, k).y0 - s.height * k * 0.019);
    expect(spriteBox(fullBreath(frameOf(s, 'idle', 0)!), 0, 0, k).y0).toBeCloseTo(top.y0, 9);
    // Reduced motion holds it still; moving frames are never stretched.
    expect(spriteFrame(s, 'idle', BREATH_MS / 2, { still: true })!.sy).toBe(1);
    expect(spriteFrame(s, 'walk', BREATH_MS / 2)!.sy).toBe(1);
    expect(fullBreath(frameOf(s, 'walk', 0)!).sy).toBe(1);
  });

  it('breathes a wall’s wear too when it is one picture; several pictures are played as frames', () => {
    const one = { frames: 1, w: 100, h: 100, ax: 50, ay: 95, boxes: [[0, 0, 100, 95]] as [number, number, number, number][] };
    const two = { ...one, frames: 2, boxes: [...one.boxes, ...one.boxes] };
    const wall = { kind: 'sprite', id: 'ally_yoroi', height: 95, anims: { idle: one, damaged1: one, damaged2: two } } as unknown as SpriteLayout;
    expect(spriteFrame(wall, 'damaged1', BREATH_MS / 2)!.sy).toBeCloseTo(1.02, 9);
    expect(spriteFrame(wall, 'damaged2', BREATH_MS / 2)!.sy).toBe(1);
  });

  it('names just the frames one motion plays, so a preview loads those and not every frame of every motion', () => {
    const s = spriteFor('enemy_goblin')!;
    expect(motionFor(s, 'collapse')).toBe('death');
    expect(motionKeys(s, 'idle')).toEqual(['sprites/enemy_goblin/idle_1']);
    expect(motionKeys(s, 'collapse')).toHaveLength(s.anims.death!.frames);
    expect(motionKeys(s, 'collapse')[0]).toBe('sprites/enemy_goblin/death_1');
    // A motion it has no frames for falls back to resting, as spriteFrame does.
    expect(motionKeys(spriteFor('enemy_guchokipanogitaigata')!, 'song')).toEqual(motionKeys(spriteFor('enemy_guchokipanogitaigata')!, 'idle'));
    for (const key of motionKeys(s, 'attack')) expect(spriteKeys(s)).toContain(key);
    expect(spriteKeys(s).length).toBeGreaterThan(motionKeys(s, 'attack').length);
  });

  it('stands each character its size’s height, a giant three lanes tall, a long one no longer than 1.25 times that', () => {
    const bug = spriteFor('enemy_mushi_twolegs')!;
    expect(bug.height * spriteScale(bug)).toBeCloseTo(TIER_HEIGHT.S, 5);
    // A character whose spec gives its height stands that tall instead: as in the stories, a goblin a little shorter
    // than Chiikawa, a mermaid smaller still, セイレーン as tall as the giants (in her one lane).
    for (const [id, h] of [
      ['enemy_goblin', 135],
      ['enemy_kuroi_nagareboshi', 128],
      ['enemy_ningyo', 120],
      ['enemy_seiren', TIER_HEIGHT.XXL],
    ] as const) {
      const s = spriteFor(id)!;
      expect(characterSpec(id)?.height, id).toBe(h);
      expect(s.height * spriteScale(s), id).toBeCloseTo(h, 5);
    }
    const giant = spriteFor('enemy_dekatsuyo')!;
    expect(giant.height * spriteScale(giant)).toBeCloseTo(TIER_HEIGHT.XXL, 5);
    const long = spriteFor('enemy_chushidesu')!;
    const k = spriteScale(long);
    expect(long.anims.idle!.boxes[0][2] * k).toBeLessThanOrEqual(TIER_HEIGHT.M * 1.25 + 1e-6);
    expect(long.height * k).toBeLessThan(TIER_HEIGHT.M);
  });

  it('draws every enemy with its front just ahead of where it stands, its body behind; friends stay on their middles', () => {
    for (const id of ['enemy_goblin', 'enemy_mushi_twolegs', 'enemy_chushidesu', 'enemy_zou', 'enemy_dekatsuyo']) {
      const s = spriteFor(id)!;
      const k = spriteScale(s);
      const shift = frontShift(s, k);
      expect(shift, id).toBeGreaterThan(0);
      expect(spriteBox(frameOf(s, 'idle', 0)!, shift, 0, k).x0, id).toBeCloseTo(-REACH, 5);
    }
    expect(frontShift(spriteFor('ally_hoshi')!, 1)).toBe(0);
  });

  it('grows ちいかぶ from the size and place of its small form into the true one', () => {
    const small = spriteFor('enemy_chiikabu')!;
    const big = spriteFor('enemy_chiikabu_true')!;
    const n = big.anims.transform!.frames;
    const first = frameOf(big, 'transform', 0)!;
    const a0 = transformAdjust(small, big, first);
    const b0 = spriteBox(first, a0.dx, 0, spriteScale(big) * a0.k);
    expect(-b0.y0).toBeCloseTo(small.height * spriteScale(small), 0);
    const sb = spriteBox(frameOf(small, 'idle', 0)!, 0, 0, spriteScale(small));
    expect((b0.x0 + b0.x1) / 2).toBeCloseTo((sb.x0 + sb.x1) / 2, 0);
    const last = transformAdjust(small, big, frameOf(big, 'transform', n - 1)!);
    expect(last.k).toBe(1);
    expect(Math.abs(last.dx)).toBeLessThan(1e-9);
  });
});
