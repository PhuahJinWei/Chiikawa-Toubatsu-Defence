import { describe, expect, it } from 'vitest';
import { shopAsk, shopAskKey, shopOffer } from '../src/app/shopping';
import { defaultSave } from '../src/save/save';

const saveWith = (money: number, upgrades = { slots: 0, ramen: 0 }) => ({ ...defaultSave('ja'), money, upgrades });

describe('what the shop has to buy now (owner’s call, 2026-11-10)', () => {
  it('is nothing without the money for it', () => {
    expect(shopOffer(saveWith(0))).toBeNull();
    expect(shopOffer(saveWith(599))).toBeNull();
  });

  it('puts the pochettes first, one step at a time, at their seller', () => {
    const first = shopOffer(saveWith(1500));
    expect(first?.item.id).toBe('slot1');
    expect(first?.price).toBe(750);
    expect(first?.spot).toBe('shop_pochette');
    expect(shopOffer(saveWith(1500, { slots: 1, ramen: 0 }))?.item.id).toBe('slot2');
  });

  it('comes to the ラーメン券 and the friends once the pochettes are out of reach or bought', () => {
    expect(shopOffer(saveWith(700))?.item.id).toBe('ramen1');
    expect(shopOffer(saveWith(1000, { slots: 3, ramen: 2 }))?.item.card).toBe('shisa');
  });

  it('never counts the ぶた入りラーメン券, which is used up', () => {
    const d = { ...saveWith(200, { slots: 3, ramen: 2 }), cards: ['usagi', 'shisa', 'hoshi'] };
    expect(shopOffer(d)).toBeNull();
  });
});

describe('the question about the shop', () => {
  it('comes only as a new world starts, with something to buy', () => {
    expect(shopAsk('1-5', '2-1', saveWith(800))?.item.id).toBe('slot1');
    expect(shopAsk('1-4', '1-5', saveWith(800))).toBeNull();
    expect(shopAsk('1-5', '2-1', saveWith(100))).toBeNull();
  });

  it('is asked once a world', () => {
    const d = saveWith(800);
    d.asked = [shopAskKey(2)];
    expect(shopAsk('1-5', '2-1', d)).toBeNull();
    expect(shopAsk('2-5', '3-1', d)?.item.id).toBe('slot1');
  });
});
