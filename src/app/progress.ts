// Progression rules: what is unlocked, decks, rewards. All state lives in the save.

import galleryJson from '../data/gallery.json';
import shopJson from '../data/shop.json';
import type { BattleEnd } from '../game/controller';
import { ENEMIES, ENEMY_LIST, fitsJob, LEVEL_LIST, LEVELS, levelsOfWorld, UNIT_LIST, UNITS, waterOf } from '../game/sim/defs';
import type { LevelDef } from '../game/sim/types';
import { FIRST_FRIEND, save, updateSave } from '../save/save';

export const SHOP = shopJson as {
  slotsBase: number;
  /** Extra 草 at the start of every job for each ラーメン券 bought. */
  ramenWeeds: number;
  rewards: { rescueLeft: number; endlessPerWave: number };
  /** Each item: how many can be bought (or held, if consumable) and the price of each. An item with a `card` is a
   *  friend who joins the team when it is bought (シーサー's なかま屋), once. An item with an `upgrade` is that
   *  upgrade's `tier`th step (a bigger pochette, a ラーメン券), bought in order, all under one name and picture (`pic`,
   *  also its words). */
  sellers: {
    id: string;
    npc: string;
    items: { id: string; max: number; prices: number[]; consumable?: boolean; card?: string; upgrade?: 'slots' | 'ramen'; tier?: number; pic?: string }[];
  }[];
};

export const CARD_ORDER = UNIT_LIST.map((u) => u.id);

export function isCleared(id: string): boolean {
  return !!save.value.cleared[id];
}

export function worldUnlocked(world: number): boolean {
  if (world <= 1) return true;
  const prev = levelsOfWorld(world - 1);
  return prev.length > 0 && isCleared(prev[prev.length - 1].id);
}

export function levelUnlocked(id: string): boolean {
  const i = LEVEL_LIST.findIndex((l) => l.id === id);
  if (i < 0) return false;
  if (i === 0) return true;
  return isCleared(LEVEL_LIST[i - 1].id);
}

/** The level the player should play next (first unlocked, uncleared), or the last level. */
export function nextLevel(): LevelDef {
  return LEVEL_LIST.find((l) => levelUnlocked(l.id) && !isCleared(l.id)) ?? LEVEL_LIST[LEVEL_LIST.length - 1];
}

export function clearedCount(): number {
  return LEVEL_LIST.filter((l) => isCleared(l.id)).length;
}

/** Extra 草 every job starts with, from the ラーメン券 bought. */
export function startBonus(): number {
  return SHOP.ramenWeeds * save.value.upgrades.ramen;
}

export function deckSize(): number {
  return SHOP.slotsBase + save.value.upgrades.slots;
}

export function ownedCards(): string[] {
  return CARD_ORDER.filter((id) => save.value.cards.includes(id));
}

/** 星's card: it grants a wish, turning into a friend picked for it (see WishDef). */
export const isWishCard = (id: string): boolean => !!UNITS[id]?.wish;

/** The friends the player has who can go on this job: ヒトハ, フタバ and 島二郎 only where there is water (see fitsJob). */
export function jobCards(level?: LevelDef): string[] {
  return ownedCards().filter((id) => fitsJob(id, level));
}

/** The friends 星 can turn into on this job: every friend the player has but 星, and only those who can go there. */
export function wishable(level?: LevelDef): string[] {
  return jobCards(level).filter((id) => !isWishCard(id));
}

/** The friend 星 turned into last time, while the player still has them and they can go on this job (else none: it
 *  is picked again). */
export function wishFor(level?: LevelDef): string | null {
  const w = save.value.wish;
  return w && wishable(level).includes(w) ? w : null;
}

/** Whether the team is picked by hand: when the player has more friends than fit, and always once 星 is among them (it
 *  only comes along with a wish, picked as it joins). A job with a set team has nothing to pick. */
export function needsDeckChoice(level?: LevelDef): boolean {
  if (level?.deck.forced?.length) return false;
  const owned = jobCards(level);
  return owned.length > deckSize() || owned.some(isWishCard);
}

export function defaultDeck(level?: LevelDef): string[] {
  if (level?.deck.forced?.length) return [...level.deck.forced];
  // 星 comes along only with a wish, and the islanders (ヒトハ, フタバ, 島二郎) only where there is water (where they come
  // first).
  const wish = wishFor(level);
  const owned = jobCards(level).filter((id) => wish || !isWishCard(id));
  const size = deckSize();
  if (owned.length <= size) return owned;
  const water = waterOf(level).length ? owned.filter((id) => UNITS[id]?.aquatic) : [];
  const last = save.value.lastDeck.filter((id) => owned.includes(id) && !water.includes(id));
  const out = [...water, ...last];
  for (const id of ['chiikawa', 'usagi', 'yoroi', 'hachiware', 'rakko', 'momonga', 'kurimanju', 'shisa', 'ode', 'taiyaki']) {
    if (out.length >= size) break;
    if (owned.includes(id) && !out.includes(id)) out.push(id);
  }
  return CARD_ORDER.filter((id) => out.slice(0, size).includes(id));
}

/** Enemies allowed in endless mode: everything the player has met in the campaign, but for those that only come when called. */
export function endlessPool(): string[] {
  const seen = new Set(save.value.gallery.seen);
  const pool = ENEMY_LIST.filter((e) => seen.has(e.id) && !e.summonOnly).map((e) => e.id);
  return pool.length ? pool : ['mushi_twolegs'];
}

export function starsFor(rescuesUsed: number): number {
  return rescuesUsed === 0 ? 3 : rescuesUsed === 1 ? 2 : 1;
}

export interface Reward {
  total: number;
  firstClear: boolean;
  stars: number;
  newCard?: string;
  features: string[];
  bestEndless?: boolean;
}

export function rewardFor(end: BattleEnd): Reward {
  if (end.mode === 'endless') {
    return {
      total: end.wavesCleared * SHOP.rewards.endlessPerWave,
      firstClear: false,
      stars: 0,
      features: [],
      bestEndless: end.wavesCleared > save.value.best.endless,
    };
  }
  const level = LEVELS[end.levelId ?? ''];
  if (!level || !end.won) return { total: 0, firstClear: false, stars: 0, features: [] };
  const firstClear = !isCleared(level.id);
  const total = (firstClear ? level.rewards.firstClear : level.rewards.replay) + end.rescuesLeft * SHOP.rewards.rescueLeft;
  const newCard = firstClear && level.rewards.unlockCard && !save.value.cards.includes(level.rewards.unlockCard) ? level.rewards.unlockCard : undefined;
  const features = firstClear ? (level.rewards.unlockFeatures ?? []).filter((f) => !save.value.features[f as keyof typeof save.value.features]) : [];
  return { total, firstClear, stars: starsFor(end.stats.rescuesUsed), newCard, features };
}

export function applyResult(end: BattleEnd, reward: Reward): void {
  updateSave((d) => {
    d.money += reward.total;
    d.stats.playMs += Math.round(end.timeMs);
    d.stats.weeds += end.stats.weedsCollected;
    d.stats.defeated += end.stats.enemiesDefeated;
    if (end.mode === 'endless') {
      d.best.endless = Math.max(d.best.endless, end.wavesCleared);
      return;
    }
    const id = end.levelId!;
    d.attempts[id] = (d.attempts[id] ?? 0) + 1;
    if (!end.won) {
      d.stats.losses++;
      return;
    }
    d.stats.wins++;
    const prev = d.cleared[id];
    d.cleared[id] = { stars: Math.max(prev?.stars ?? 0, reward.stars), clears: (prev?.clears ?? 0) + 1 };
    if (reward.newCard && !d.cards.includes(reward.newCard)) d.cards.push(reward.newCard);
    for (const f of reward.features) (d.features as Record<string, boolean>)[f] = true;
  });
}

export function recordAttemptStart(levelId: string): number {
  return save.value.attempts[levelId] ?? 0;
}

// ---------------------------------------------------------------- gallery

let pendingSeen = new Set<string>();
let pendingDefeated = new Set<string>();
let pendingMet = new Set<string>();
let flushTimer = 0;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = window.setTimeout(flushGallery, 600);
}

export function flushGallery(): void {
  window.clearTimeout(flushTimer);
  flushTimer = 0;
  if (!pendingSeen.size && !pendingDefeated.size && !pendingMet.size) return;
  const seen = pendingSeen;
  const defeated = pendingDefeated;
  const met = pendingMet;
  pendingSeen = new Set();
  pendingDefeated = new Set();
  pendingMet = new Set();
  updateSave((d) => {
    for (const id of seen) if (!d.gallery.seen.includes(id)) d.gallery.seen.push(id);
    for (const id of defeated) if (!d.gallery.defeated.includes(id)) d.gallery.defeated.push(id);
    for (const id of met) if (!d.gallery.met.includes(id)) d.gallery.met.push(id);
  });
}

export function noteSeen(id: string): void {
  if (!save.value.gallery.seen.includes(id)) {
    pendingSeen.add(id);
    scheduleFlush();
  }
}

export function noteDefeated(id: string): void {
  if (!save.value.gallery.defeated.includes(id)) {
    pendingDefeated.add(id);
    scheduleFlush();
  }
}

export function noteMet(id: string): void {
  if (!save.value.gallery.met.includes(id)) {
    pendingMet.add(id);
    scheduleFlush();
  }
}

/** New entries since the battle started, for the result screen. */
export function galleryKnown(id: string): 'none' | 'seen' | 'full' {
  const g = save.value.gallery;
  const entryIsEnemy = !!ENEMIES[id];
  if (entryIsEnemy) return g.defeated.includes(id) ? 'full' : g.seen.includes(id) ? 'seen' : 'none';
  // A friend is a 「？」 until they have been seen, a dark shape with their name once they have been met somewhere but
  // have not joined (シーサー at the shop, 古本屋 in the book's room, ラッコ on a rescue), and known in full once they join.
  // The friend everyone starts with has no moment of joining, so a battle with them on the team is what counts.
  // The people (the ひと pages) are known once met.
  const unlock = GALLERY_UNLOCK.get(id) ?? (CARD_ORDER.includes(id) ? 'card' : 'met');
  const met = g.met.includes(id);
  if (unlock !== 'card') return met ? 'full' : 'none';
  if (save.value.cards.includes(id) && (id !== FIRST_FRIEND || met)) return 'full';
  return met ? 'seen' : 'none';
}

/** How each gallery page's subject becomes known (`card`, `met` or `seen`), from data/gallery.json. */
const GALLERY_UNLOCK = new Map((galleryJson as unknown as { entries: { id: string; unlock: string }[] }).entries.map((e) => [e.id, e.unlock]));
