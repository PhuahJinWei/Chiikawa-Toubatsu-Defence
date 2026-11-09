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
  tips: string[];
  /** Red stamps already pressed (the hand stamp shows only the first time each is seen): cleared:world1, soldout:slot1,
   *  source:<gallery entry>… */
  stamped: string[];
  stats: { wins: number; losses: number; weeds: number; defeated: number; playMs: number };
  lastDeck: string[];
  /** The friend 星 last turned into (its wish, picked when it joins the team), kept with the team. */
  wish: string | null;
  installDismissed: boolean;
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
    tips: [],
    stamped: [],
    stats: { wins: 0, losses: 0, weeds: 0, defeated: 0, playMs: 0 },
    lastDeck: [],
    wish: null,
    installDismissed: false,
  };
}

type Json = Record<string, unknown>;

/** Fill in anything missing so older or partial saves keep working. */
function mergeDefaults(raw: Json, fallback: SaveData): SaveData {
  const out = structuredClone(fallback) as unknown as Json;
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
  const merged = mergeDefaults(d, fallback);
  merged.v = SAVE_VERSION;
  // うさぎ is everyone's first friend (she was ハチワレ until 2026-11-08: a save from before keeps him too).
  if (!Array.isArray(merged.cards) || !merged.cards.includes(FIRST_FRIEND)) merged.cards = [FIRST_FRIEND, ...(merged.cards ?? [])];
  merged.money = Math.max(0, Math.floor(Number(merged.money) || 0));
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

export function loadSave(lang: 'ja' | 'en'): SaveData {
  const raw = readStorage();
  if (!raw) return defaultSave(lang);
  try {
    return migrate(JSON.parse(raw) as Json, defaultSave(lang));
  } catch {
    // Never throw away a save we could not read: keep a copy and start fresh.
    try {
      localStorage.setItem(`${slot}.broken.${Date.now()}`, raw);
    } catch {
      /* storage unavailable */
    }
    return defaultSave(lang);
  }
}

export const save = signal<SaveData>(defaultSave());
export const storageOk = signal(true);

/** Load the save (dev mode's own one with `dev`) and keep using that one. */
export function initSave(lang: 'ja' | 'en', dev = false): void {
  slot = dev ? DEV_SAVE_KEY : SAVE_KEY;
  save.value = loadSave(lang);
  storageOk.value = writeStorage(JSON.stringify(save.value));
}

/** Change the save immutably and persist it. */
export function updateSave(fn: (d: SaveData) => void): void {
  const d = structuredClone(save.value);
  fn(d);
  d.updatedAt = new Date().toISOString();
  save.value = d;
  storageOk.value = writeStorage(JSON.stringify(d));
}

export function resetSave(): void {
  const lang = save.value.settings.lang;
  save.value = defaultSave(lang);
  writeStorage(JSON.stringify(save.value));
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

export function importCode(code: string, lang: 'ja' | 'en' = 'ja'): SaveData | null {
  try {
    const clean = code.trim().replace(/\s+/g, '');
    const [tag, body, sum] = clean.split('.');
    if (tag !== 'CTD1' || !body || !sum) return null;
    const json = inflateSync(fromBase64Url(body));
    if (crc32(json).toString(16).padStart(8, '0') !== sum.toLowerCase()) return null;
    const data = JSON.parse(strFromU8(json)) as Json;
    if (!data || typeof data !== 'object') return null;
    return migrate(data, defaultSave(lang));
  } catch {
    return null;
  }
}

export function applyImported(d: SaveData): void {
  save.value = d;
  writeStorage(JSON.stringify(d));
}
