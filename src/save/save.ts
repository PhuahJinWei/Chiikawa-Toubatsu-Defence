// Offline save: one versioned JSON document in localStorage, plus export/import codes
// (the only cross-device path on a static host).

import { signal } from '@preact/signals';
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

export const SAVE_KEY = 'chiikawa-td.save';
/** Dev mode's own save (?dev in the address), so testing never touches the player's. */
export const DEV_SAVE_KEY = 'chiikawa-td.save.dev';
/** The save in use: the player's, or dev mode's. */
let slot = SAVE_KEY;
export const SAVE_VERSION = 8;
/** The friend every new save starts with. */
export const FIRST_FRIEND = 'usagi';

export interface Settings {
  lang: 'ja' | 'en';
  bgm: number;
  sfx: number;
  autoCollect: boolean;
  reducedMotion: boolean;
  guides: boolean;
  speed: 1 | 2;
}

export interface SaveData {
  v: number;
  createdAt: string;
  updatedAt: string;
  cleared: Record<string, { stars: number; clears: number }>;
  attempts: Record<string, number>;
  cards: string[];
  features: { endless: boolean; speed: boolean };
  gallery: { seen: string[]; defeated: string[]; met: string[] };
  money: number;
  /** Pochettes bought (each one more friend) and ラーメン券 bought (each +25 草 at the start of every job). */
  upgrades: { slots: number; ramen: number };
  /** ぶた入りラーメン券 held (one use: every friend ready from the start). */
  items: { buta: number };
  best: { endless: number };
  settings: Settings;
  /** Red stamps already pressed (the hand stamp shows only the first time each is seen): cleared:world1, soldout:slot1,
   *  source:<gallery entry>… */
  stamped: string[];
  stats: { wins: number; losses: number; weeds: number; defeated: number; playMs: number };
  lastDeck: string[];
  /** The friend 星 last turned into (its wish, picked when it joins the team), kept with the team. */
  wish: string | null;
  installDismissed: boolean;
  /** Questions asked once already: shop:<world>, whether to stop by the shop as that world starts (app/shopping.ts). */
  asked: string[];
}

export function defaultSave(lang: 'ja' | 'en' = 'ja'): SaveData {
  const now = new Date().toISOString();
  return {
    v: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    cleared: {},
    attempts: {},
    cards: [FIRST_FRIEND],
    features: { endless: false, speed: false },
    gallery: { seen: [], defeated: [], met: [] },
    money: 0,
    upgrades: { slots: 0, ramen: 0 },
    items: { buta: 0 },
    best: { endless: 0 },
    settings: { lang, bgm: 0.6, sfx: 0.8, autoCollect: false, reducedMotion: false, guides: false, speed: 1 },
    stamped: [],
    stats: { wins: 0, losses: 0, weeds: 0, defeated: 0, playMs: 0 },
    lastDeck: [],
    wish: null,
    installDismissed: false,
    asked: [],
  };
}

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
/** A deep copy of plain save data. Not structuredClone, which browsers before Safari 15.4 and Chrome 98 lack: there
 *  every start took the save for a broken one (2026-11-10 audit). */
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
/** The longest export code taken, and the most save data one may hold (a save is a few KB; a crafted code once
 *  inflated to 64 MB: 2026-11-10 audit). */
const MAX_CODE_CHARS = 16_000;
const MAX_SAVE_BYTES = 256_000;

/** Fill in anything missing so older or partial saves keep working. */
function mergeDefaults(raw: Json, fallback: SaveData): SaveData {
  const out = clone(fallback) as unknown as Json;
  for (const [k, v] of Object.entries(raw)) {
    const base = out[k];
    if (base && typeof base === 'object' && !Array.isArray(base) && v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = { ...(base as Json), ...(v as Json) };
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as unknown as SaveData;
}

/** `v` in the shape of `def` (a default save, or a part of one): whatever is missing or of the wrong type takes the
 *  default's value, and no number is below zero (none in a save is). A list keeps only its strings; an object keeps any
 *  keys beyond the default's (so a record, like `cleared`, keeps its entries for the caller to check, and a newer
 *  version's fields come through an older copy of the game; import's size limit keeps them small). */
function shaped(v: unknown, def: unknown): unknown {
  if (Array.isArray(def)) return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [...def];
  if (def === null) return typeof v === 'string' ? v : null;
  if (typeof def === 'object') {
    if (!isObj(v)) return clone(def);
    const out: Json = { ...v };
    for (const [k, d] of Object.entries(def as Json)) out[k] = shaped(v[k], d);
    return out;
  }
  if (typeof def === 'number') return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : def;
  return typeof v === typeof def ? v : def;
}

/** Any save, however damaged or edited by hand, in a shape the game runs on: one wrong type gave a blank page on every
 *  start (2026-11-10 audit). Whatever cannot be used goes back to its default. */
function sanitize(d: SaveData, def: SaveData): SaveData {
  const out = shaped(d, def) as SaveData;
  const count = (v: unknown, fallback: number) => Math.floor(shaped(v, fallback) as number);
  out.cleared = Object.fromEntries(
    Object.entries(out.cleared).flatMap(([id, c]) => (isObj(c) ? [[id, { stars: Math.min(3, count(c.stars, 0)), clears: count(c.clears, 1) }]] : [])),
  );
  out.attempts = Object.fromEntries(Object.entries(out.attempts).flatMap(([id, n]) => (typeof n === 'number' && Number.isFinite(n) ? [[id, count(n, 0)]] : [])));
  const s = out.settings;
  if (s.lang !== 'ja' && s.lang !== 'en') s.lang = def.settings.lang;
  if (s.speed !== 1 && s.speed !== 2) s.speed = def.settings.speed;
  s.bgm = Math.min(1, s.bgm);
  s.sfx = Math.min(1, s.sfx);
  out.upgrades.slots = Math.floor(out.upgrades.slots);
  out.upgrades.ramen = Math.floor(out.upgrades.ramen);
  out.items.buta = Math.floor(out.items.buta);
  return out;
}

/** A job that went when the worlds went from ten jobs to five, for migration 6 → 7. */
const GONE_JOB = /^\d+-([6-9]|10)$/;
/** What a one-use +50 ramen ticket cost, for the refund in migration 5 → 6. */
const RAMEN_TICKET_PRICE = 150;
/** What the removed tune-ups cost, per tier, for the refund in migration 2 → 3. */
const TUNE_UP_PRICES: Record<string, number[]> = { sasumata: [500, 1000, 2000], rod: [750, 1500, 3000] };

/** Forward migrations, one per version step. */
const MIGRATIONS: Record<number, (d: Json) => Json> = {
  // 0 → 1: the first public version; nothing to rename yet.
  0: (d) => ({ ...d, v: 1 }),
  // 1 → 2: the weeding exam was removed; drop its records.
  1: (d) => {
    const { examGrades: _grades, ...rest } = d;
    const features = { ...((rest.features as Json) ?? {}) };
    delete features.exam;
    const best = { ...((rest.best as Json) ?? {}) };
    delete best.exam;
    delete best.examGrade;
    return { ...rest, features, best, v: 2 };
  },
  // 2 → 3: the weapon shop and its さすまた / 討伐棒 tune-ups were removed; refund what was spent on them.
  2: (d) => {
    const up = { ...((d.upgrades as Json) ?? {}) };
    let refund = 0;
    for (const [id, prices] of Object.entries(TUNE_UP_PRICES)) {
      const n = Math.max(0, Math.min(prices.length, Math.floor(Number(up[id]) || 0)));
      for (let i = 0; i < n; i++) refund += prices[i];
      delete up[id];
    }
    return { ...d, upgrades: up, money: (Number(d.money) || 0) + refund, v: 3 };
  },
  // 3 → 4: endless mode opens after World 6's boss instead of World 1's; lock it again until 6-10 is cleared.
  // The best run is kept for when it opens.
  3: (d) => {
    const cleared = (d.cleared as Json) ?? {};
    const features = { ...((d.features as Json) ?? {}) };
    if (!cleared['6-10']) features.endless = false;
    return { ...d, features, v: 4 };
  },
  // 4 → 5: the pochette upgrade became three pochettes sold one after another; those already bought count as already
  // stamped 「売り切れ」, so the hand does not press them all again.
  4: (d) => {
    const slots = Math.max(0, Math.min(3, Math.floor(Number(((d.upgrades as Json) ?? {}).slots) || 0)));
    const stamped = (Array.isArray(d.stamped) ? (d.stamped as unknown[]) : []).filter((s): s is string => typeof s === 'string' && s !== 'soldout:slot');
    for (let i = 1; i <= slots; i++) if (!stamped.includes(`soldout:slot${i}`)) stamped.push(`soldout:slot${i}`);
    return { ...d, stamped, v: 5 };
  },
  // 5 → 6: the one-use +50 ramen ticket became two lasting ラーメン券 (+25 草 every job, each) and the one-use ticket is
  // now the ぶた入りラーメン券 (every friend ready from the start): tickets still held are paid back at what they cost.
  5: (d) => {
    const held = Math.max(0, Math.floor(Number(((d.items as Json) ?? {}).ramen) || 0));
    const upgrades = { ...((d.upgrades as Json) ?? {}), ramen: 0 };
    return { ...d, upgrades, items: { buta: 0 }, money: (Number(d.money) || 0) + held * RAMEN_TICKET_PRICE, v: 6 };
  },
  // 6 → 7: the worlds went from ten jobs to five (owner's call, 2026-11-09), so jobs 6 to 10 of each are gone. The jobs
  // left are kept as cleared, and what clearing them now gives comes with them: 2× speed with 1-5 and endless mode with
  // 6-5, added and never taken away. (Friends are handed over at start-up: rewardsOwed.)
  6: (d) => {
    const left = (o: unknown) => Object.fromEntries(Object.entries((o as Json) ?? {}).filter(([id]) => !GONE_JOB.test(id)));
    const cleared = left(d.cleared);
    const features = { ...((d.features as Json) ?? {}) };
    if (cleared['1-5']) features.speed = true;
    if (cleared['6-5']) features.endless = true;
    return { ...d, cleared, attempts: left(d.attempts), features, v: 7 };
  },
  // 7 → 8: the gallery book now counts the friend everyone starts with from their first battle (see galleryKnown), and
  // anyone who has already played has had that.
  7: (d) => {
    const gallery = { ...((d.gallery as Json) ?? {}) };
    const met = Array.isArray(gallery.met) ? (gallery.met as unknown[]) : [];
    const played =
      Object.keys((d.cleared as Json) ?? {}).length > 0 || Object.keys((d.attempts as Json) ?? {}).length > 0 || (Array.isArray(gallery.seen) && gallery.seen.length > 0);
    return { ...d, gallery: { ...gallery, met: played && !met.includes(FIRST_FRIEND) ? [...met, FIRST_FRIEND] : met }, v: 8 };
  },
};

export function migrate(raw: Json, fallback: SaveData): SaveData {
  let d = { ...raw };
  let v = typeof d.v === 'number' ? d.v : 0;
  while (v < SAVE_VERSION && MIGRATIONS[v]) {
    d = MIGRATIONS[v](d);
    v = typeof d.v === 'number' ? d.v : v + 1;
  }
  const merged = sanitize(mergeDefaults(d, fallback), fallback);
  merged.v = SAVE_VERSION;
  // Hints already shown, once planned and never used (2026-11-10 audit): no save needs it.
  delete (merged as unknown as Json).tips;
  // うさぎ is everyone's first friend (she was ハチワレ until 2026-11-08: a save from before keeps him too).
  if (!Array.isArray(merged.cards) || !merged.cards.includes(FIRST_FRIEND)) merged.cards = [FIRST_FRIEND, ...(merged.cards ?? [])];
  merged.money = Math.max(0, Math.floor(Number(merged.money) || 0));
  // The art guides are a tool for making the game, switched in dev mode only: a player who had them on is not left with
  // them and no way to turn them off.
  if (slot !== DEV_SAVE_KEY) merged.settings.guides = false;
  return merged;
}

function readStorage(): string | null {
  try {
    return localStorage.getItem(slot);
  } catch {
    return null;
  }
}

function writeStorage(s: string): boolean {
  try {
    localStorage.setItem(slot, s);
    return true;
  } catch {
    return false;
  }
}

/** Keep a copy of a save under `key`, beside the one in use. Nothing is lost if it cannot be. */
function keepCopy(key: string, raw: string): void {
  try {
    localStorage.setItem(key, raw);
  } catch {
    /* storage unavailable or full */
  }
}

function loadSave(lang: 'ja' | 'en'): SaveData {
  const raw = readStorage();
  if (!raw) return defaultSave(lang);
  try {
    const data = JSON.parse(raw) as unknown;
    if (!isObj(data)) throw new Error('not a save');
    // From a newer version of the game (a copy open in another tab, or an older copy gone back to): this one reads what
    // it knows, and keeps the save as it was beside it, so going forward again loses nothing.
    if (typeof data.v === 'number' && data.v > SAVE_VERSION) keepCopy(`${slot}.v${data.v}`, raw);
    return migrate(data, defaultSave(lang));
  } catch {
    // Never throw away a save we could not read: keep a copy and start fresh.
    keepCopy(`${slot}.broken.${Date.now()}`, raw);
    return defaultSave(lang);
  }
}

export const save = signal<SaveData>(defaultSave());
export const storageOk = signal(true);
let listening = false;

/** Load the save (dev mode's own one with `dev`) and keep using that one. */
export function initSave(lang: 'ja' | 'en', dev = false): void {
  slot = dev ? DEV_SAVE_KEY : SAVE_KEY;
  save.value = loadSave(lang);
  storageOk.value = writeStorage(JSON.stringify(save.value));
  if (!listening && typeof window !== 'undefined') {
    listening = true;
    window.addEventListener('storage', onStorage);
  }
}

/** Another copy of the game (a second tab) saved: this one takes that save when it is newer than its own, so neither
 *  writes its older progress over the other's (2026-11-10 audit). */
function onStorage(ev: StorageEvent): void {
  if (ev.key !== slot || !ev.newValue) return;
  try {
    const data = JSON.parse(ev.newValue) as unknown;
    if (!isObj(data) || typeof data.updatedAt !== 'string' || data.updatedAt <= save.value.updatedAt) return;
    save.value = migrate(data, defaultSave(save.value.settings.lang));
  } catch {
    /* not readable: keep this one */
  }
}

/** Change the save immutably and persist it. */
export function updateSave(fn: (d: SaveData) => void): void {
  const d = clone(save.value);
  fn(d);
  d.updatedAt = new Date().toISOString();
  save.value = d;
  storageOk.value = writeStorage(JSON.stringify(d));
}

/** Start again from a new save. False when it could not be written. */
export function resetSave(): boolean {
  const lang = save.value.settings.lang;
  save.value = defaultSave(lang);
  return (storageOk.value = writeStorage(JSON.stringify(save.value)));
}

// ---------------------------------------------------------------- export codes

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

/** CTD1.<base64url(deflate(json))>.<crc32 hex> */
export function exportCode(d: SaveData): string {
  const json = strToU8(JSON.stringify(d));
  const body = toBase64Url(deflateSync(json, { level: 9 }));
  return `CTD1.${body}.${crc32(json).toString(16).padStart(8, '0')}`;
}

/** What an export code holds: its save, or why it cannot be used (`bad`: not a code, or a damaged one; `newer`: made by a
 *  newer version of the game, which this one could only read in part). */
type CodeRead = { save: SaveData } | { error: 'bad' | 'newer' };

export function importCode(code: string, lang: 'ja' | 'en' = 'ja'): CodeRead {
  try {
    const clean = code.trim().replace(/\s+/g, '');
    if (clean.length > MAX_CODE_CHARS) return { error: 'bad' };
    const [tag, body, sum] = clean.split('.');
    if (tag !== 'CTD1' || !body || !sum) return { error: 'bad' };
    const json = inflateSync(fromBase64Url(body));
    if (json.length > MAX_SAVE_BYTES) return { error: 'bad' };
    if (crc32(json).toString(16).padStart(8, '0') !== sum.toLowerCase()) return { error: 'bad' };
    const data = JSON.parse(strFromU8(json)) as unknown;
    if (!isObj(data)) return { error: 'bad' };
    if (typeof data.v === 'number' && data.v > SAVE_VERSION) return { error: 'newer' };
    return { save: migrate(data, defaultSave(lang)) };
  } catch {
    return { error: 'bad' };
  }
}

/** Replace the save with an imported one. The save it replaces is kept beside it (`<slot>.before-import`), so a code
 *  pasted by mistake loses nothing for good, and it counts as saved now (another tab takes it). False when it could not
 *  be written. */
export function applyImported(d: SaveData): boolean {
  const before = readStorage();
  save.value = { ...d, updatedAt: new Date().toISOString() };
  storageOk.value = writeStorage(JSON.stringify(save.value));
  if (storageOk.value && before) keepCopy(`${slot}.before-import`, before);
  return storageOk.value;
}
