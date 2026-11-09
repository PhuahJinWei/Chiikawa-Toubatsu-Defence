import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { gameCharacters, trimFontFaces } from './tools/lib/fonts';

/**
 * Pictures in /art stay as the artist delivered them (lossless PNG); the production build ships them as WebP,
 * several times smaller. Alpha stays lossless, so the sticker borders the game draws from it stay clean. A
 * picture that would not get smaller ships as it is.
 */
function artToWebp(): Plugin {
  return {
    name: 'art-to-webp',
    apply: 'build',
    enforce: 'pre',
    async load(id) {
      const m = /^(.*\/art\/.+\.(png|jpe?g))\?url$/i.exec(id);
      if (!m) return null;
      const file = m[1];
      const src = readFileSync(file);
      const img = await loadImage(src);
      const c = createCanvas(img.width, img.height);
      c.getContext('2d').drawImage(img, 0, 0);
      const webp = await c.encode('webp', 88);
      const smaller = webp.length < src.length * 0.92;
      const ref = this.emitFile({
        type: 'asset',
        name: smaller ? basename(file).replace(/\.(png|jpe?g)$/i, '.webp') : basename(file),
        source: smaller ? webp : src,
      });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    },
  };
}

/** The fonts' stylesheets shrink to the pieces the game's own text can reach (see tools/lib/fonts.ts); a piece no longer
 *  declared is not emitted either. Builds only: the dev server keeps every piece. */
function trimFonts(): Plugin {
  let used: Set<number>;
  return {
    name: 'trim-fonts',
    apply: 'build',
    enforce: 'pre',
    buildStart() {
      used = gameCharacters(fileURLToPath(new URL('.', import.meta.url)));
    },
    transform(css, id) {
      return /\/@fontsource\/[^/]+\/[^/]+\.css$/.test(id) ? trimFontFaces(css, used) : null;
    },
  };
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig({
  // Relative base so the build works from any GitHub Pages path (user.github.io/<repo>/).
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    assetsInlineLimit: 0,
  },
  server: { host: true, port: 5173 },
  plugins: [
    artToWebp(),
    trimFonts(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'ちいかわ討伐ディフェンス',
        short_name: '討伐ディフェンス',
        description: 'ちいかわの世界を舞台にしたレーン防衛ゲーム（非公式ファンゲーム）',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#FFF6E9',
        theme_color: '#FFF6E9',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app itself installs up front; art and sound are cached as they are first used (and warmed in the
        // background after start-up, see src/art/warm.ts), so the first visit stays light.
        globPatterns: ['**/*.{js,css,html,svg,json}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/assets\/.+\.(webp|png|jpe?g)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'ctd-art', expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: ({ url }) => /\/assets\/.+\.(ogg|mp3|m4a|wav)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'ctd-audio', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.woff2') || url.pathname.endsWith('.woff'),
            handler: 'CacheFirst',
            options: { cacheName: 'ctd-fonts', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
