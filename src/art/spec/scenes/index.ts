import type { SceneSpec } from '../types';
import { LOBBY_SCENE, QUESTS_SCENE } from './lobby';
import { BOOK_SCENE } from './rooms';
import { SHOP_SCENE } from './shop';
import { WORLD_SCENES } from './worlds';

export { LOBBY_SCENE, QUESTS_SCENE } from './lobby';
export { BOOK_SCENE } from './rooms';
export { SHOP_SCENE } from './shop';
export { WORLD_FIELD, WORLD_H, WORLD_SCENES, WORLD_W } from './worlds';

/** Menu scenes in the order a player meets them, then the battle worlds. */
export const SCENES: SceneSpec[] = [LOBBY_SCENE, QUESTS_SCENE, SHOP_SCENE, BOOK_SCENE, ...WORLD_SCENES];

export function sceneSpec(id: string): SceneSpec | undefined {
  return SCENES.find((s) => s.id === id);
}
