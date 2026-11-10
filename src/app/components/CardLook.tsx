// A friend's battle card, as the card column shows it: their figure close up on a colour of their own (art/spec/cards.ts
// frames each one), the price big in the corner. The column draws its cards with CardFigure; a friend who has just
// joined, and so is in no team yet, gets a whole card from CardLook (the card dropped on the field, and their page).

import { CARD_LOOKS, spriteIdFor } from '../../art/spec';
import { art } from '../../art/store';
import { UNITS } from '../../game/sim/defs';

/** The friend on a card: what will appear on the field, close up (art/spec/cards.ts frames each one). `sprite`: who
 *  it shows, for a team the member who comes next. */
export function CardFigure({ id, sprite }: { id: string; sprite: string }) {
  const { zoom, x, y } = CARD_LOOKS[id];
  return <img class="figure" src={art.imageUrl(`sprites/${sprite}/idle_1`)} style={{ '--zoom': zoom, '--x': x, '--y': y } as Record<string, number>} alt="" draggable={false} />;
}

/** Who a friend's card shows when it is not in a team: for a team (パジャマパーティーズ), its first member. */
export const cardSprite = (id: string) => spriteIdFor('ally', id, UNITS[id]?.members?.[0]);

/** Fetch a card's picture ahead, so that it is there as the card drops. */
export function warmCard(id: string): void {
  new Image().src = art.imageUrl(`sprites/${cardSprite(id)}/idle_1`);
}

/** A friend's card as it looks in the column, for a friend not in the team: the one who has just joined. */
export function CardLook({ id, class: extra }: { id: string; class?: string }) {
  return (
    <span class={extra ? `card ${extra}` : 'card'} style={{ '--tint': CARD_LOOKS[id].tint } as Record<string, string>}>
      <span class="face">
        <CardFigure id={id} sprite={cardSprite(id)} />
        <span class="cost">{UNITS[id].cost}</span>
      </span>
    </span>
  );
}
