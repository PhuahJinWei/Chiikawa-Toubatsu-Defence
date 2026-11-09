// Runtime art: real files from /art when present, a plain stand-in (fallback.ts) otherwise.
// Vite resolves the globs at build time, so dropping a picture into /art and rebuilding (or saving while
// `npm run dev` runs) is all it takes to replace a placeholder. Pictures load when a screen needs them, not
// up front; the production build turns them into WebP (see vite.config.ts).

import { mergeScene, type SceneLayout } from './layout';
import { drawImage } from './fallback';
import { ALL_IMAGES, imageSpec, PORTRAITS, type SceneSpec } from './spec';

const IMAGE_URLS = import.meta.glob('/art/**/*.{png,webp,jpg,jpeg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const LAYOUTS = import.meta.glob('/art/scenes/*/layout.json', { eager: true, import: 'default' }) as Record<string, SceneLayout>;

export type Picture = HTMLCanvasElement | HTMLImageElement;

/** URL of the real file for a picture key ('scenes/shop/shop_wall'), if one was delivered. */
function realUrl(key: string): string | undefined {
  const base = `/art/${key}`;
  return IMAGE_URLS[`${base}.webp`] ?? IMAGE_URLS[`${base}.png`] ?? IMAGE_URLS[`${base}.jpg`] ?? IMAGE_URLS[`${base}.jpeg`];
}

function sceneLayout(id: string): SceneLayout | undefined {
  const l = LAYOUTS[`/art/scenes/${id}/layout.json`];
  return l?.kind === 'scene' ? l : undefined;
}

/** A scene with its delivered art's layout applied. */
export function resolveScene(spec: SceneSpec): SceneSpec {
  return mergeScene(spec, sceneLayout(spec.id));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}

class ArtStore {
  private real = new Map<string, HTMLImageElement>();
  private pending = new Map<string, Promise<void>>();
  private placeholders = new Map<string, HTMLCanvasElement>();
  private urls = new Map<string, string>();

  isReal(key: string): boolean {
    return !!realUrl(key);
  }

  /** Load the real files among these keys (the rest stay placeholders). Safe to call again. */
  load(keys: Iterable<string>): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (const key of keys) {
      if (this.real.has(key)) continue;
      const url = realUrl(key);
      if (!url) continue;
      let job = this.pending.get(key);
      if (!job) {
        job = loadImage(url)
          .then((img) => void this.real.set(key, img))
          .catch((err) => console.warn(err))
          .finally(() => this.pending.delete(key));
        this.pending.set(key, job);
      }
      jobs.push(job);
    }
    return Promise.all(jobs).then(() => undefined);
  }

  /** The loaded real picture, if any. */
  loaded(key: string): HTMLImageElement | undefined {
    return this.real.get(key);
  }

  /** The placeholder for a key, painted once. */
  placeholder(key: string): HTMLCanvasElement | undefined {
    const hit = this.placeholders.get(key);
    if (hit) return hit;
    const spec = imageSpec(key);
    if (!spec) return undefined;
    const c = document.createElement('canvas');
    c.width = spec.w;
    c.height = spec.h;
    // Kept in main memory: a placeholder is cut into a sticker by reading its pixels (paper.ts), and reading a
    // GPU-backed canvas back costs tens of milliseconds a time, whatever its size.
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (ctx) drawImage(ctx, spec);
    this.placeholders.set(key, c);
    return c;
  }

  /** The picture to draw for a key: the real one if it has loaded, else its placeholder. */
  image(key: string): Picture | undefined {
    return this.real.get(key) ?? this.placeholder(key);
  }

  /** URL usable in <img src>: the real file, or a data URL of the placeholder. */
  imageUrl(key: string): string {
    const cached = this.urls.get(key);
    if (cached) return cached;
    let url = realUrl(key) ?? '';
    if (!url) url = this.placeholder(key)?.toDataURL('image/png') ?? '';
    this.urls.set(key, url);
    return url;
  }

  /** A face for picking the team, the gallery and dialogue: the portrait file, else the placeholder portrait. */
  portraitUrl(subject: string): string {
    return this.imageUrl(`portraits/portrait_${subject}`);
  }

  /** Drop loaded pictures that are not needed any more (keeps phone memory low between screens). */
  release(keep: (key: string) => boolean = () => false): void {
    for (const key of [...this.real.keys()]) if (!keep(key)) this.real.delete(key);
  }

  realCounts(): { real: number; total: number } {
    return { real: ALL_IMAGES.filter((s) => !!realUrl(s.key)).length, total: ALL_IMAGES.length };
  }

  /** Every real file's URL, for warming the offline cache in the background. */
  allRealUrls(): string[] {
    return Object.values(IMAGE_URLS);
  }
}

export const art = new ArtStore();

/** Portrait keys, for screens that list many faces. */
export const PORTRAIT_KEYS = PORTRAITS.map((p) => p.key);
