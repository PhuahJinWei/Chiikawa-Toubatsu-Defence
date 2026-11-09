import { signal } from '@preact/signals';
import en from './en.json';
import ja from './ja.json';

export type Lang = 'ja' | 'en';
type Dict = { [k: string]: string | Dict };

const DICTS: Record<Lang, Dict> = { ja: ja as unknown as Dict, en: en as unknown as Dict };

export function detectLang(): Lang {
  try {
    const l = (navigator.languages?.[0] ?? navigator.language ?? 'ja').toLowerCase();
    return l.startsWith('ja') ? 'ja' : 'en';
  } catch {
    return 'ja';
  }
}

export const lang = signal<Lang>('ja');

export function setLang(l: Lang): void {
  lang.value = l;
  try {
    document.documentElement.lang = l;
  } catch {
    /* not in a browser */
  }
}

function lookup(dict: Dict, key: string): string | undefined {
  let cur: string | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (cur === undefined || typeof cur === 'string') return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** Translate a key; falls back to Japanese, then to the key itself. `{name}` placeholders are filled from params. */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = lookup(DICTS[lang.value], key) ?? lookup(DICTS.ja, key) ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

export function has(key: string): boolean {
  return lookup(DICTS[lang.value], key) !== undefined || lookup(DICTS.ja, key) !== undefined;
}

/** Name of any subject: ally card, enemy or NPC. */
export function nameOf(id: string): string {
  if (has(`card.${id}.name`)) return t(`card.${id}.name`);
  if (has(`enemy.${id}.name`)) return t(`enemy.${id}.name`);
  if (has(`npc.${id}.name`)) return t(`npc.${id}.name`);
  return id;
}

/** The name under a face in a grid (the gallery, who's coming): a shorter one where the full name would run to more
 *  than two lines ("RPS Mimic"), with an invisible break point where a Japanese name may wrap; else the name. */
export function shortNameOf(id: string): string {
  for (const sec of ['card', 'enemy', 'npc']) if (has(`${sec}.${id}.short`)) return t(`${sec}.${id}.short`);
  return nameOf(id);
}

/** A full name as a heading sets it, with an invisible break point so a long Japanese name wraps between its words:
 *  its short form's, where that is the same name, else after its の (グーチョキパーの擬態型, whose short form is shorter). */
export function headingNameOf(id: string): string {
  const name = nameOf(id);
  const short = shortNameOf(id);
  return short !== name && short.replace(/​/g, '') === name ? short : name.replace('の', 'の​');
}

/** All keys of a dictionary (for tests: both languages must define the same keys). */
export function keysOf(l: Lang): string[] {
  const out: string[] = [];
  const walk = (d: Dict, prefix: string) => {
    for (const [k, v] of Object.entries(d)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') out.push(key);
      else walk(v, key);
    }
  };
  walk(DICTS[l], '');
  return out;
}
