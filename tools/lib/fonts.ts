// A Japanese font arrives cut into some 120 pieces per weight, each declared with its own @font-face, so a browser only
// fetches the pieces the text on screen needs. The stylesheet still has to declare every piece, which made it mostly
// font declarations, and the page waits for the stylesheet. The build keeps only the pieces the game's own text can reach.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TEXT_FILE = /\.(ts|tsx|json)$/;

/** Every character in the game's source: its text, its data and, harmlessly, its comments (written out or escaped). */
export function gameCharacters(root: string): Set<number> {
  const found = new Set<number>();
  const add = (file: string): void => {
    const text = readFileSync(file, 'utf8');
    for (const ch of text) found.add(ch.codePointAt(0)!);
    for (const m of text.matchAll(/\\u([0-9a-fA-F]{4})/g)) found.add(parseInt(m[1], 16));
  };
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, e.name);
      if (e.isDirectory()) walk(path);
      else if (TEXT_FILE.test(e.name)) add(path);
    }
  };
  walk(join(root, 'src'));
  add(join(root, 'index.html'));
  return found;
}

/** The first and last code point of each part of a `unicode-range`. */
export function unicodeRanges(list: string): [number, number][] {
  return list.split(',').map((part) => {
    const [first, last] = part.trim().replace(/^u\+/i, '').split('-');
    return [parseInt(first.replace(/\?/g, '0'), 16), parseInt((last ?? first).replace(/\?/g, 'f'), 16)];
  });
}

/** A font's stylesheet with only the pieces that hold a character in `used`, and no WOFF fallback: every browser the
 *  game runs on (the build targets ES2020) reads WOFF2. A piece that is no longer declared is not shipped either. */
export function trimFontFaces(css: string, used: ReadonlySet<number>): string {
  return css.replace(/(?:\/\*[^*]*\*\/\s*)?@font-face\s*\{[^}]*\}\s*/g, (block) => {
    const range = /unicode-range:\s*([^;}]+)/.exec(block);
    if (range) {
      const parts = unicodeRanges(range[1]);
      let needed = false;
      for (const c of used) {
        if (parts.some(([a, b]) => a <= c && c <= b)) {
          needed = true;
          break;
        }
      }
      if (!needed) return '';
    }
    return block.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '');
  });
}
