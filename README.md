# ちいかわ討伐ディフェンス — Chiikawa Tobatsu Defense

A Plants-vs-Zombies-style lane defense game set in Nagano's ちいかわ world, built for phones in a
browser. The whole game is played in landscape, like PvZ. Japanese first, English included. Works offline once loaded, saves locally, and deploys to
GitHub Pages as static files.

> **Unofficial, non-commercial fan game.** ちいかわ is the work of ナガノ. This project has no
> connection to the creator, the publisher or any rights holders. The art is the owner's own; the
> sounds are synthesised by code until recorded ones arrive.

The design lives in [GDD.md](GDD.md). Every image and sound the game needs is listed in
[ASSET_CHECKLIST.md](ASSET_CHECKLIST.md).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable from a phone on the same Wi-Fi)
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with live reload |
| `npm run build` | Type-check and build to `dist/` (with the offline service worker) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit tests, content validation, and a bot that plays every level |
| `npm run balance` | Difficulty table: a good and a casual bot play every level on three seeds |
| `npm run art:import -- <folder or picture> --as <id>` | Bring a layered scene or a battle world's picture into `art/` (see below) |
| `npm run checklist` | Regenerate `ASSET_CHECKLIST.md` from the art spec |
| `npm run levels` | Regenerate `src/data/levels/*.json` from `tools/levelgen.py` (needs Python 3) |

## Bringing in art

The whole game is flat paper pieces that the game layers, borders, shades and moves. There are three kinds:

- **Battle worlds**: one flat picture, painted edge to edge, brought in with `npm run art:import -- <picture.png> --as world2`.
- **Menu scenes**: paint the whole picture in one document with a layer per piece, export the layers (numbered
  back to front) plus a composited `preview.png` into a folder, then run

  ```
  npm run art:import -- <folder> --as <scene or character id>
  ```

  It matches each layer to its piece, measures where it sits, and writes the pieces and a `layout.json` into
  `art/scenes/<id>/`. Add `--dry` to see the result first. **Characters** are frames: `npm run art:sprites -- <folder>`.
- **Stickers, faces and logos**: save the PNG into `art/stickers/`, `art/portraits/` or `art/ui/` under its name.

Never paint white borders, shadows or glow: the game adds them. What to draw, at what size, and which parts each
character needs: `ASSET_CHECKLIST.md`, or **設定 → アートキット** in the game (characters move there; its ZIP holds a
size template for every picture). Turn on **設定 → アートガイド** to see every piece outlined in place (and, in
menus, the pieces pulled apart in 3D). A picture with no file shows as a plain card with its name and size; sounds
stay synthesised until a file with the right name is in `art/audio/`. See [art/README.md](art/README.md).

## Editing the game

All content is data:

| File | Contents |
|---|---|
| `src/data/units.json` | Ally stats (cost, cooldown, HP, attack) |
| `src/data/enemies.json` | Enemy stats and abilities |
| `src/data/levels/world*.json` | The 40 campaign levels (Worlds 1–4) and their waves |
| `src/data/shop.json` | Deck slots, upgrades, prices and rewards |
| `src/data/gallery.json` | Gallery entries, sources and confidence tags |
| `src/i18n/ja.json`, `en.json` | Every piece of text, including lore and briefings |
| `src/art/spec/` | Every picture the game needs: scenes (pieces, depths, slots), characters (parts, motions) and stickers |

Levels were authored with the compact notation in `tools/levelgen.py`; either edit that and run
`npm run levels`, or edit the JSON directly (then don't re-run the generator without porting your
changes). After changing balance, run `npm run balance` and `npm test`.

## Deploying to GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`: install, test, build, publish.
   The site appears at `https://<user>.github.io/<repo>/`.

The build uses relative paths, so it works under any repository name. Players can add the game to
their home screen; that keeps it playable offline and protects the save from Safari's storage
eviction. Settings → セーブを書き出す exports the save as a code for moving between devices.

## Project layout

```
src/
  game/sim/      simulation (pure TypeScript, deterministic, runs headless in tests)
  game/render/   Canvas 2D renderer for the battlefield
  game/controller.ts   loop, input, audio, tips and HUD state for a battle
  art/           art spec, sprite frames, sticker look, the art loader (and the plain stand-in for a missing picture)
  audio/         Web Audio: synth placeholder sounds and music, real-file override
  app/           Preact UI: screens, components, progression rules, styles
  save/          versioned localStorage save and export/import codes
  i18n/          Japanese and English strings
tools/           balance runner, art importers, checklist, level generator
tests/           Vitest suites
art/             put real art and sound here
```

## Debugging

Add `?dev` to the URL (e.g. `http://localhost:5173/?dev`, or the deployed site's address with `?dev`) for **dev mode**:
the game plays from a save of its own (`chiikawa-td.save.dev`) with everything unlocked on every start: every job
cleared with three stars, every friend, 2× speed and endless mode, every gallery entry, and at least 99,999 money. The
shop's goods are left to buy. Your own save is not touched; open the URL without `?dev` to get it back.

Run with `?debug` in the URL (always on in `npm run dev` and in dev mode) to get `window.__ctd` in the console:
`unlockAll()`, `upTo('2-1')`, `money(5000)`, `weeds(1000)`, `skip(10)`, `win()`.

## Credits

Game design and code for this fan project. Fonts: [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic)
(SIL Open Font License) via Fontsource. The sounds are synthesised by code in this repository until recorded ones arrive.
