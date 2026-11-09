import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameCharacters, trimFontFaces, unicodeRanges } from '../tools/lib/fonts';

const face = (name: string, range: string) =>
  `/* ${name} */\n@font-face {\n  font-family: 'F';\n  src: url(./files/${name}.woff2) format('woff2'), url(./files/${name}.woff) format('woff');\n  unicode-range: ${range};\n}\n\n`;

/** Every range a stylesheet declares, and whether one of them holds a character. */
const rangesIn = (css: string) => [...css.matchAll(/unicode-range:\s*([^;}]+)/g)].flatMap((m) => unicodeRanges(m[1]));
const covered = (ranges: [number, number][], c: number): boolean => ranges.some(([a, b]) => a <= c && c <= b);

describe('trimFontFaces', () => {
  const used = new Set([0x3042, 0x4e00]);

  it('keeps a piece holding a character the game uses and drops one holding none', () => {
    const out = trimFontFaces(face('kana', 'U+3041-3096') + face('rare', 'U+9f00-9fff'), used);
    expect(out).toContain('kana.woff2');
    expect(out).not.toContain('rare.woff2');
  });

  it('drops the old WOFF fallback, so only WOFF2 is shipped', () => {
    const out = trimFontFaces(face('kana', 'U+3041-3096'), used);
    expect(out).toContain("url(./files/kana.woff2) format('woff2')");
    expect(out).not.toMatch(/\.woff\)/);
  });

  it('reads single code points, ranges and wildcards', () => {
    expect(unicodeRanges('U+4e00, U+3041-3096,u+30??')).toEqual([
      [0x4e00, 0x4e00],
      [0x3041, 0x3096],
      [0x3000, 0x30ff],
    ]);
  });

  it('keeps a face that declares no range', () => {
    const css = "@font-face { font-family: 'F'; src: url(./a.woff2) format('woff2'); }";
    expect(trimFontFaces(css, used)).toContain('a.woff2');
  });

  it('still declares every character of the game that the real fonts hold', () => {
    const root = resolve(__dirname, '..');
    const chars = gameCharacters(root);
    // Text the player reads, so the list is sure to reach it.
    for (const c of 'ちいかわ討伐ディフェンス草') expect(chars.has(c.codePointAt(0)!), c).toBe(true);
    for (const sheet of ['zen-maru-gothic/500.css', 'zen-maru-gothic/700.css', 'zen-maru-gothic/900.css', 'yusei-magic/400.css']) {
      const css = readFileSync(resolve(root, 'node_modules/@fontsource', sheet), 'utf8');
      const out = trimFontFaces(css, chars);
      expect(out.length, sheet).toBeLessThan(css.length);
      const before = rangesIn(css);
      const after = rangesIn(out);
      const lost = [...chars].filter((c) => covered(before, c) && !covered(after, c)).map((c) => `U+${c.toString(16)}`);
      expect(lost, sheet).toEqual([]);
    }
  });
});
