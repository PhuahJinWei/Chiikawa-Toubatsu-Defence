// Who is who in the 郎 shop scene: tapping a character opens that seller's goods.

export interface ShopSpot {
  /** Seller id in src/data/shop.json. */
  seller: string;
  /** Character speaking, for the name on the goods panel. */
  speaker: string;
  /** i18n key of what they say. */
  line: string;
}

/** Scene layer id → seller. Shisa works at 郎 but keeps a counter of her own, the なかま屋, where friends join the
 *  team (she is the first). */
export const SHOP_SPOTS: Record<string, ShopSpot> = {
  shop_master: { seller: 'ramen', speaker: 'yoroi_ramen', line: 'shop.sellers.ramen.line' },
  shop_shisa: { seller: 'shisa', speaker: 'shisa', line: 'shop.sellers.shisa.line' },
  shop_pochette: { seller: 'pochette', speaker: 'yoroi_pochette', line: 'shop.sellers.pochette.line' },
};

/** Name tags pinned in the scene: slot id → seller. */
export const SHOP_TAGS: Record<string, string> = {
  tag_ramen: 'ramen',
  tag_shisa: 'shisa',
  tag_pochette: 'pochette',
};
