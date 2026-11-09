// The single source of truth for every picture the game uses. Placeholders, the in-game Art Kit, the
// exported art kit, the checklist and the real-art loader all read from here. Real files go in /art (see
// art/README.md) and replace their placeholders.

import { GALLERY_IMAGES, LOGOS, PORTRAITS, QUEST_IMAGES, SHOP_ITEMS, UI_BUTTONS, UI_ICONS, UI_PROPS } from './images';
import { SCENES } from './scenes';
import { STICKER_DETAIL, STICKERS } from './stickers';
import type { ImageSpec, SceneLayer } from './types';

export * from './types';
export { GALLERY_IMAGES, LOGOS, PORTRAIT_SUBJECTS, PORTRAITS, fighterId, QUEST_IMAGES, QUEST_PLACES, SHOP_ITEMS, UI_BUTTONS, UI_ICONS, UI_PROPS } from './images';
export { ALLY_CHARACTERS, ENEMY_CHARACTERS, VEHICLES, PAJAMA_MEMBERS, PEOPLE_SIZE, CHARACTERS, characterSpec, sizeSpec, spriteIdFor, teamSpec } from './characters';
export { CARD_LOOKS, type CardLook } from './cards';
export { BOOK_SCENE, LOBBY_SCENE, QUESTS_SCENE, SCENES, sceneSpec, SHOP_SCENE, WORLD_FIELD, WORLD_H, WORLD_SCENES, WORLD_W } from './scenes';
export { SOUNDS } from './sounds';
export { GALLERY_MOTIONS, SPRITE_LOOP_MS, SPRITE_MOTIONS, type SpriteMotionName, spriteNeeds, STAR_SPRITE } from './sprites';
export { STICKER_DETAIL, STICKER_VARIANTS, STICKERS, stickerSpec } from './stickers';

/** A sticker standing on its feet stands this far above the bottom of its picture. */
export const BASELINE = 12;

/** A piece's picture files: <id> alone, or <id>, <id>_2 … <id>_<frames> for an idle loop. */
export function pieceFiles(l: SceneLayer): string[] {
  const n = Math.max(1, l.frames ?? 1);
  return [l.id, ...Array.from({ length: n - 1 }, (_, i) => `${l.id}_${i + 2}`)];
}

export const SCENE_IMAGES: ImageSpec[] = SCENES.flatMap((sc) =>
  sc.layers.flatMap((l) =>
    pieceFiles(l).map((file, i) => ({
      key: `scenes/${sc.id}/${file}`,
      kind: 'piece' as const,
      w: l.w,
      h: l.h,
      note: i ? { ja: `${l.note.ja}（アニメのコマ ${i + 1}/${l.frames}）`, en: `${l.note.en} (idle frame ${i + 1} of ${l.frames})` } : l.note,
    })),
  ),
);

export const STICKER_IMAGES: ImageSpec[] = STICKERS.map((s) => ({ key: `stickers/${s.id}`, kind: 'sticker' as const, w: s.w, h: s.h, note: s.note }));

export const ALL_IMAGES: ImageSpec[] = [...SCENE_IMAGES, ...STICKER_IMAGES, ...PORTRAITS, ...LOGOS, ...UI_ICONS, ...UI_BUTTONS, ...UI_PROPS, ...SHOP_ITEMS, ...QUEST_IMAGES, ...GALLERY_IMAGES];

const BY_KEY = new Map(ALL_IMAGES.map((i) => [i.key, i]));

export function imageSpec(key: string): ImageSpec | undefined {
  return BY_KEY.get(key);
}

/**
 * How big to draw a picture: its planned size, but STICKER_DETAIL times it for a sticker (the game draws a sticker at
 * its planned size on the field, and tablets and laptops show it bigger than that). For a single picture it is also
 * the most the game keeps: npm run art:picture scales a bigger one down to it.
 */
export function pictureSize(spec: Pick<ImageSpec, 'kind' | 'w' | 'h'>): { w: number; h: number } {
  const k = spec.kind === 'sticker' ? STICKER_DETAIL : 1;
  return { w: spec.w * k, h: spec.h * k };
}
