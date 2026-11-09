import unitsJson from '../../data/units.json';
import enemiesJson from '../../data/enemies.json';
import worldsJson from '../../data/worlds.json';
import world1 from '../../data/levels/world1.json';
import world2 from '../../data/levels/world2.json';
import world3 from '../../data/levels/world3.json';
import world4 from '../../data/levels/world4.json';
import world5 from '../../data/levels/world5.json';
import world6 from '../../data/levels/world6.json';
import type { EnemyDef, LevelDef, UnitDef, WorldDef } from './types';

export const UNIT_LIST = unitsJson as unknown as UnitDef[];
export const ENEMY_LIST = enemiesJson as unknown as EnemyDef[];
const WORLD_LIST = worldsJson as unknown as WorldDef[];
export const LEVEL_LIST: LevelDef[] = [
  ...(world1 as unknown as LevelDef[]),
  ...(world2 as unknown as LevelDef[]),
  ...(world3 as unknown as LevelDef[]),
  ...(world4 as unknown as LevelDef[]),
  ...(world5 as unknown as LevelDef[]),
  ...(world6 as unknown as LevelDef[]),
];

export const UNITS: Record<string, UnitDef> = Object.fromEntries(UNIT_LIST.map((u) => [u.id, u]));
export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(ENEMY_LIST.map((e) => [e.id, e]));
export const LEVELS: Record<string, LevelDef> = Object.fromEntries(LEVEL_LIST.map((l) => [l.id, l]));
export const WORLDS: Record<number, WorldDef> = Object.fromEntries(WORLD_LIST.map((w) => [w.id, w]));

/** Clearing this world's boss (its level 10) unlocks endless mode, the 討伐ランキング. Until the world exists,
 *  endless mode stays locked. */
export const ENDLESS_WORLD = 6;

export function levelsOfWorld(world: number): LevelDef[] {
  return LEVEL_LIST.filter((l) => l.world === world).sort((a, b) => a.index - b.index);
}

export function nextLevelId(id: string): string | null {
  const i = LEVEL_LIST.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < LEVEL_LIST.length ? LEVEL_LIST[i + 1].id : null;
}

/** The level's active lanes that are water (World 5's sea), or none. */
export function waterOf(level?: LevelDef): number[] {
  if (!level) return [];
  return (WORLDS[level.world]?.water ?? []).filter((l) => level.lanes.includes(l));
}

/** Whether a friend can go on this job: the islanders (ヒトハ, フタバ, 島二郎) only where there is water (never in
 *  endless mode), and Rakko only where his car comes. */
export function fitsJob(id: string, level?: LevelDef): boolean {
  return homeReason(id, level) === null;
}

/** Why a friend stays home on this job, as the i18n key that says so, or null when they can go. */
export function homeReason(id: string, level?: LevelDef): string | null {
  const u = UNITS[id];
  if (u?.aquatic && !waterOf(level).length) return 'prep.waterOnly';
  if (u?.rescuer && level && !level.rescues) return 'prep.notOnHunt';
  return null;
}

/** The friends that cleared jobs bring but a save does not have. A job's reward can change between versions (the
 *  whole campaign was laid out again on 2026-11-09), and a save that had already cleared it would never get them: they
 *  are handed over when the game starts. */
export function rewardsOwed(cleared: Record<string, unknown>, cards: string[]): string[] {
  const out: string[] = [];
  for (const l of LEVEL_LIST) {
    const id = l.rewards.unlockCard;
    if (id && cleared[l.id] && !cards.includes(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Enemy ids that appear in a level, in order of first appearance. */
export function enemiesInLevel(level: LevelDef): string[] {
  const seen: string[] = [];
  for (const w of level.waves) for (const s of w.spawns) if (!seen.includes(s.enemy)) seen.push(s.enemy);
  return seen;
}

/** The enemies one calls up (セイレーン's followers): they come wherever it does, so their pictures load with it. */
export function summonsOf(id: string): string[] {
  return (ENEMIES[id]?.abilities ?? []).flatMap((a) => (a.kind === 'summon' ? [a.water, a.land] : []));
}

/** Enemy ids that first appear in this level (not in any earlier level). */
export function newEnemiesInLevel(level: LevelDef): string[] {
  const before = new Set<string>();
  for (const l of LEVEL_LIST) {
    if (l.id === level.id) break;
    for (const id of enemiesInLevel(l)) before.add(id);
  }
  return enemiesInLevel(level).filter((id) => !before.has(id));
}

/** Validation used by tests and the dev overlay. Returns a list of problems (empty = fine). */
export function validateContent(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const l of LEVEL_LIST) {
    if (ids.has(l.id)) problems.push(`duplicate level id ${l.id}`);
    ids.add(l.id);
    if (!WORLDS[l.world]) problems.push(`${l.id}: unknown world ${l.world}`);
    if (l.lanes.length === 0) problems.push(`${l.id}: no lanes`);
    for (const lane of l.lanes) if (lane < 0 || lane > 4) problems.push(`${l.id}: bad lane ${lane}`);
    for (const c of l.deck.forced ?? []) {
      if (!UNITS[c]) problems.push(`${l.id}: unknown forced card ${c}`);
      else if (!fitsJob(c, l)) problems.push(`${l.id}: forced card ${c} goes only on water, and this job has none`);
    }
    const water = waterOf(l);
    if (l.rewards.unlockCard && !UNITS[l.rewards.unlockCard]) problems.push(`${l.id}: unknown unlock ${l.rewards.unlockCard}`);
    if (l.rewards.unlockFeatures?.includes('endless') && (l.world !== ENDLESS_WORLD || l.index !== levelsOfWorld(l.world).length)) {
      problems.push(`${l.id}: endless mode opens after World ${ENDLESS_WORLD}'s boss, not here`);
    }
    for (const t of l.terrain) {
      if (t.col < 0 || t.col > 8 || !l.lanes.includes(t.lane)) problems.push(`${l.id}: bad terrain ${JSON.stringify(t)}`);
    }
    let prev = -1;
    for (const w of l.waves) {
      if (w.at <= prev) problems.push(`${l.id}: waves not increasing at ${w.at}`);
      prev = w.at;
      for (const s of w.spawns) {
        const e = ENEMIES[s.enemy];
        if (!e) problems.push(`${l.id}: unknown enemy ${s.enemy}`);
        if (typeof s.lane === 'number' && !l.lanes.includes(s.lane)) problems.push(`${l.id}: spawn in inactive lane ${s.lane}`);
        // Swimmers come down the water and only they do, so a job with one needs the other.
        if (e?.aquatic && !water.length) problems.push(`${l.id}: ${e.id} swims, and this job has no water`);
        if (e && !e.aquatic && water.length && water.length === l.lanes.length) problems.push(`${l.id}: ${e.id} walks, and this job is all water`);
        if (e && typeof s.lane === 'number' && water.length && water.includes(s.lane) !== !!e.aquatic) {
          problems.push(`${l.id}: ${e.id} is set to lane ${s.lane}, which is ${water.includes(s.lane) ? 'water' : 'land'}`);
        }
      }
    }
    if (!l.waves.some((w) => w.final)) problems.push(`${l.id}: no final wave`);
  }
  return problems;
}
