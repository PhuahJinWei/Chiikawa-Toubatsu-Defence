// Where a new friend's dropped card comes to rest on the field (owner's call, 2026-11-10: the last enemy to fall drops the
// card, as PvZ's last zombie drops a seed packet; see CardDropLayer in screens/Battle.tsx).

export interface Pt {
  x: number;
  y: number;
}

/** A box on the screen: the open field (clear of the card column and the top strip), or one to keep off. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** How far toward the base (left) and down the card lands from where it popped out (px). */
const LAND_DX = 70;
const LAND_DY = 24;
/** The least room between the card and the open field's edge, or what it keeps off (px). */
const MARGIN = 12;

/** Where a card of `size` that popped out at `from` comes to rest: a little nearer the base, always wholly in the open
 *  field `box`, and below `avoid` (the win's banner, 「討伐完了！」, while it is up), or above it where there is no room
 *  below. With nowhere to pop out from (null), the middle of the field. */
export function dropLanding(from: Pt | null, box: Box, size: { w: number; h: number }, avoid: Box | null = null): Pt {
  const want = from ? { x: from.x - LAND_DX, y: from.y + LAND_DY } : { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
  // A field too small for the card centres it.
  const fit = (v: number, lo: number, hi: number) => (hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  const lowest = box.bottom - size.h / 2 - MARGIN;
  const highest = box.top + size.h / 2 + MARGIN;
  const at = { x: fit(want.x, box.left + size.w / 2 + MARGIN, box.right - size.w / 2 - MARGIN), y: fit(want.y, highest, lowest) };
  if (avoid) {
    const on =
      at.x + size.w / 2 + MARGIN > avoid.left &&
      at.x - size.w / 2 - MARGIN < avoid.right &&
      at.y + size.h / 2 + MARGIN > avoid.top &&
      at.y - size.h / 2 - MARGIN < avoid.bottom;
    const below = avoid.bottom + MARGIN + size.h / 2;
    const above = avoid.top - MARGIN - size.h / 2;
    if (on && below <= lowest) at.y = below;
    else if (on && above >= highest) at.y = above;
  }
  return at;
}
