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

/** The picture a battle in this world is fought on: one painted for exactly these open lanes, if there is one, else the world's own. */
export function worldScene(world: number, lanes: readonly number[]): SceneSpec {
  const open = [...lanes].sort().join();
  return WORLD_SCENES.find((s) => s.forLanes?.world === world && s.forLanes.open.join() === open) ?? sceneSpec(`world${world}`) ?? sceneSpec('world1')!;
}
