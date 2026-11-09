import { describe, expect, it } from 'vitest';
import { CHARACTERS, characterSpec, PAJAMA_MEMBERS, PORTRAIT_SUBJECTS, spriteIdFor, STAR_SPRITE } from '../src/art/spec';
import { spriteFor } from '../src/art/sprite';
import { ENEMY_LIST, UNIT_LIST } from '../src/game/sim/defs';

const MOTIONS = ['idle', 'cook', 'weed_search', 'weed_found', 'pose', 'walk', 'attack', 'collapse', 'pull', 'song', 'float', 'heal', 'transform', 'spawn', 'jump', 'steal', 'claws', 'damaged1', 'damaged2', 'damaged3', 'parked', 'drive'];

describe('characters', () => {
  it('have unique ids and motions the game knows', () => {
    const ids = CHARACTERS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of CHARACTERS) for (const m of r.motions) expect(MOTIONS, r.id).toContain(m);
  });

  it('give every friend and enemy a face for the cards, the notices and the gallery', () => {
    for (const { id } of [...UNIT_LIST, ...ENEMY_LIST]) expect(PORTRAIT_SUBJECTS, id).toContain(id);
  });

  it('cover every friend and enemy in the game, with the motions the battle asks for', () => {
    // 星 has frames but no entry here: it stands by on its tile, casts, and the friend it wished for takes over. One-use
    // friends show on the field only for their moment (below).
    for (const u of UNIT_LIST.filter((x) => !x.oneUse && !x.wish)) {
      const r = characterSpec(spriteIdFor('ally', u.id));
      expect(r, u.id).toBeTruthy();
      expect(r!.motions).toContain('idle');
      // Friends have no defeat frames: beaten, they just fade away.
      expect(r!.motions, u.id).not.toContain('collapse');
      // うさぎ（クール） only poses: her missiles come from the sky.
      if (u.attack.kind !== 'none' && u.attack.kind !== 'missiles') expect(r!.motions, u.id).toContain('attack');
      // Friends who help instead of attacking: パジャマパーティーズ sing. A trap (たい焼き) cooks first.
      if (u.support?.kind === 'aura_attackspeed') expect(r!.motions, u.id).toContain('song');
      if (u.mine) expect(r!.motions, u.id).toContain('cook');
    }
    // One-use friends show on the field for their moment: オデ runs his lane, むちゃうマン strikes his pose.
    for (const u of UNIT_LIST.filter((x) => x.oneUse)) {
      const r = characterSpec(spriteIdFor('ally', u.id));
      expect(r, u.id).toBeTruthy();
      expect(r!.motions, u.id).toContain(u.oneUse!.kind === 'charge' ? 'walk' : 'pose');
    }
    for (const e of ENEMY_LIST) {
      const r = characterSpec(spriteIdFor('enemy', e.id));
      expect(r, e.id).toBeTruthy();
      expect(r!.facing).toBe(-1);
      // 擬態型's song is a voice it sings as it goes: it needs no frames of its own.
      // A giant (でかつよ, あのこ) is drawn three lanes tall.
      expect(r!.tier === 'XXL', e.id).toBe(!!e.giant);
      // A flier floats the whole time, and grabs with its attack.
      if (e.abilities.some((a) => a.kind === 'flier')) expect(r!.motions, e.id).toEqual(expect.arrayContaining(['float', 'attack', 'collapse']));
    }
    expect(characterSpec('enemy_chiikabu_true')?.motions).toContain('transform');
    // キメラ: her first look has her claws hidden; with them out she is drawn from a second set, whose move is the drawing.
    expect(spriteIdFor('enemy', 'kimera', 'claws')).toBe('enemy_kimera_claws');
    expect(characterSpec('enemy_kimera_claws')?.subject).toBe('kimera');
    expect(characterSpec('enemy_kimera_claws')?.motions).toContain('claws');
  });

  it('all have their frames: a character without any cannot appear on the field', () => {
    const everyone = [...CHARACTERS.flatMap((r) => (r.id === 'ally_pajama_parties' ? PAJAMA_MEMBERS.map((m) => `${r.id}_${m}`) : [r.id])), STAR_SPRITE];
    expect(everyone.filter((id) => !spriteFor(id))).toEqual([]);
  });
});
