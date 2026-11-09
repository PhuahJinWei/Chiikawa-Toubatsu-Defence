import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARD_LOOKS, spriteIdFor } from '../src/art/spec';
import { UNIT_LIST } from '../src/game/sim/defs';

describe('battle cards', () => {
  // 星 never has a card of its own: its card is the friend wished for.
  const friends = UNIT_LIST.filter((u) => !u.wish);

  it('frames exactly the friends who can have a card', () => {
    expect(Object.keys(CARD_LOOKS).sort()).toEqual(friends.map((u) => u.id).sort());
  });

  it('shows pictures that exist, for every member of a team', () => {
    for (const u of friends) {
      for (const member of u.members ?? [undefined]) {
        const id = spriteIdFor('ally', u.id, member);
        expect(existsSync(`art/sprites/${id}/idle_1.png`), id).toBe(true);
      }
    }
  });
});
