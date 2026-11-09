// The gallery: 古本屋 reads at the table, and the open gallery book lies beside them, kept like a sticker book.
// Bookmark tabs pick the part of the book; the left page, headed by that part's name and how many of its pages are
// filled in, has everyone's face cut out as a sticker (empty dashed spots for those not met yet); the right page shows the chosen one standing on the page, cut out like the
// rest of the game, moving as in battle (tap it for its other moves) and true to its size beside the others (every
// character on one stage at one scale: art/figure.ts), a stamp saying how well its facts are
// sourced, and notes on ruled lines: what the stories say, what it does in this game, and where that comes from.

import { useEffect, useRef, useState } from 'preact/hooks';
import galleryJson from '../../data/gallery.json';
import { figureLayout } from '../../art/figure';
import { spriteFor } from '../../art/sprite';
import { BOOK_SCENE, GALLERY_MOTIONS, fighterId, characterSpec, spriteIdFor, STAR_SPRITE, teamSpec } from '../../art/spec';
import { art } from '../../art/store';
import shopJson from '../../data/shop.json';
import { ENEMIES, LEVEL_LIST, UNITS } from '../../game/sim/defs';
import { headingNameOf, nameOf, shortNameOf, t } from '../../i18n/i18n';
import { save } from '../../save/save';
import { CutOut, warmCutOut } from '../components/CutOut';
import { Icon } from '../components/Icon';
import { DARK_SHAPE, MoreBelow, PenLoop } from '../components/PaperMarks';
import { Figure, releaseFigures, warmFigure } from '../components/Figure';
import { StatChips } from '../components/Stats';
import { BackButton, tap } from '../components/ui';
import { whenIdle } from '../idle';
import { galleryKnown, noteMet } from '../progress';
import { up } from '../router';
import { Diorama } from '../scene/Diorama';

type Tab = 'allies' | 'enemies' | 'people';

interface Entry {
  id: string;
  tab: Tab;
  unlock: string;
  confidence: 'high' | 'medium' | 'original';
  badge?: string;
  /** Left out of the book (owner's call: 人魚（二足）), though the game still notes when it is seen and defeated, so
   *  taking the mark away brings its page back as the player knows it. */
  hidden?: boolean;
}
const G = galleryJson as unknown as { entries: Entry[] };

const TABS: Tab[] = ['allies', 'enemies', 'people'];

/** Who the right page shows standing: a fighter's battle character, or a person's standing
 *  picture (art/sprites/people_<id>) once there is one. */
function figureOf(e: Entry): string | undefined {
  if (e.tab !== 'people') {
    // A team stands for all of it: one member, picked at random the first time its page is asked for.
    const members = UNITS[e.id]?.members;
    if (UNITS[e.id]?.wish) return STAR_SPRITE;
    if (!members) return fighterId(e.id);
    if (!SHOWN_MEMBER.has(e.id)) SHOWN_MEMBER.set(e.id, members[Math.floor(Math.random() * members.length)]);
    return spriteIdFor('ally', e.id, SHOWN_MEMBER.get(e.id));
  }
  const id = spriteIdFor('people', e.id);
  return spriteFor(id) ? id : undefined;
}

/** Which member of a team its page shows. */
const SHOWN_MEMBER = new Map<string, string>();

/** The moves a figure shows in turn: every one opens at rest, even a character that never stands still in battle
 *  (黒い星 floats), then the moves it makes there. A person's standing picture only stands; 星 stands by, then casts. */
function motionsOf(id: string): string[] {
  const moves = id === STAR_SPRITE ? ['cast'] : ((characterSpec(id) ?? teamSpec(id))?.motions ?? []);
  return GALLERY_MOTIONS.filter((m) => m === 'idle' || moves.includes(m));
}
/** Each friend's own colour, for their badge, photo and name (others take their part of the book's colour). */
const ACCENT: Record<string, string> = {
  chiikawa: '#F8C4CF',
  chiikawa_island: '#CFE6B4',
  hachiware: '#C6E0F5',
  hachiware_pajama: '#CDEAF7',
  usagi: '#FDE49C',
  usagi_cool: '#E8DFC4',
  momonga: '#DCE3F7',
  kurimanju: '#F3D2A8',
  shisa: '#F9CF8E',
  ode: '#E4D8C6',
  yoroi: '#DCDEE4',
  yoroi_erai: '#E8DDB5',
  yoroi_pochette: '#F7C1CF',
  pajama_parties: '#F6D3E6',
  futaba: '#E2D6DA',
  hitoha: '#E2D6DA',
  shimajiro: '#F3DCC6',
  taiyaki: '#F2D2A4',
  muchauman: '#F6D0C2',
  hoshi: '#FFF0B8',
  rakko: '#E9D4BF',
};
const TAB_ACCENT: Record<Tab, string> = { allies: '#FDE49C', enemies: '#E4D7F3', people: '#CDEBDC' };
/** How wide the right page's figure is drawn (CSS pixels; it fills the page's width). Every character is drawn on the
 *  one stage at this width, so each keeps its size beside the others (art/figure.ts). */
const FIGURE_WIDTH = 400;
/** How far the paper runs past the right page's text column on each side, as shares of the column's width: a giant
 *  runs on to the paper's edge before it is cut off. In book.png the paper spans 50.5–96.4% of the book's width and the
 *  column 54.5–92%, less 1.2% of the book's height a side; the book is 1.405 times as wide as tall (see .gb-page.right,
 *  whose box reaches the paper's edges). */
const BLEED = { left: 0.1356, right: 0.1468 };
/** The size the left page's face stickers are cut at. */
const PIN_SIZE = 130;
/** Stickers go on a little crooked, each its own way. */
const TILT = [-4, 3, -2, 5, -3, 2, -5, 4, -1, 3, -4, 2];

const accentOf = (e: Entry) => ACCENT[e.id] ?? TAB_ACCENT[e.tab];
/** The source stamp is a Japanese rubber stamp in either language, like the 「準備中」 one (its label is read out
 *  in the player's language). */
const STAMP = { high: ['原作', '確認'], medium: ['資料', '確認'], original: ['本作', '創作'] } as const;

/** Enemies that come in some job, and friends who can join: from a job, from the shop, or from the start (うさぎ). */
const IN_JOBS = new Set(LEVEL_LIST.flatMap((l) => l.waves.flatMap((w) => w.spawns.map((s) => s.enemy))));
const JOINABLE = new Set([
  'usagi',
  ...LEVEL_LIST.map((l) => l.rewards.unlockCard).filter((c): c is string => !!c),
  ...(shopJson as unknown as { sellers: { items: { card?: string }[] }[] }).sellers.flatMap((s) => s.items.map((i) => i.card)).filter((c): c is string => !!c),
]);

/** A page is in the book once what it is about can be met in the game as it is, or has been already: the ones from
 *  worlds still to come stay out until their world is there (then they turn up on their own). A hidden one never is. */
function inBook(e: Entry): boolean {
  if (e.hidden) return false;
  if (galleryKnown(e.id) !== 'none') return true;
  if (e.unlock === 'seen') return IN_JOBS.has(e.id);
  if (e.unlock === 'card') return JOINABLE.has(e.id);
  return true;
}

/** The entry a tab opens at: the first one fully known, else the first one seen, else the first. */
function firstOf(tab: Tab): string {
  const list = G.entries.filter((e) => e.tab === tab && inBook(e));
  return (list.find((e) => galleryKnown(e.id) === 'full') ?? list.find((e) => galleryKnown(e.id) === 'seen') ?? list[0]).id;
}

/** Names already measured: text \u2192 width in ems. */
const EMS = new Map<string, number>();
let measurer: CanvasRenderingContext2D | null = null;

/** How wide a piece of text is, in ems of the font the names are set in: measured once the font has loaded (cheaply,
 *  on a canvas, with no layout), else estimated (a Japanese character 1, a Latin letter 0.62, a space 0.3). */
function ems(s: string): number {
  const text = s.replace(/\u200b/g, '');
  const hit = EMS.get(text);
  if (hit !== undefined) return hit;
  if (document.fonts?.status === 'loaded') {
    measurer ??= document.createElement('canvas').getContext('2d');
    if (measurer) {
      const cs = getComputedStyle(document.body);
      measurer.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
      const w = measurer.measureText(text).width / 100;
      EMS.set(text, w);
      return w;
    }
  }
  let n = 0;
  for (const c of text) n += /[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 1 : c === ' ' ? 0.3 : 0.62;
  return n;
}

/** The widest a name may be, in ems, to stay on one line with its font at least 85% of the full size: a column holds
 *  about 4.8 to 5.1 ems at the full size (the faces and the font both follow the book's size). */
const ONE_LINE_EMS = 5.8;

/** A face's name in the grid, at most two lines and never much wider than its column. A short name stays on one line,
 *  its font coming down a little if need be; a longer one with a break point wraps there instead, at the full size,
 *  the font only fitting its widest word. --w: the widest line it is set to have, in ems (see .gb-pin-name). */
function PinName({ text }: { text: string }) {
  const all = ems(text);
  // Words: between spaces, or at a Japanese name's break point. A hyphenated word stays whole (Ch\u016bshi-desu).
  const pieces = text.split(/[\s\u200b]+/).filter(Boolean);
  const widest = Math.max(...pieces.map(ems));
  const w = all <= ONE_LINE_EMS || pieces.length < 2 ? all : widest;
  return (
    <span class="gb-pin-name" aria-hidden="true" style={{ '--w': Math.max(1, w).toFixed(2) }}>
      {text}
    </span>
  );
}

export function Gallery() {
  const [tab, setTab] = useState<Tab>('allies');
  const [chosen, setChosen] = useState<Record<Tab, string>>(() => ({ allies: firstOf('allies'), enemies: firstOf('enemies'), people: firstOf('people') }));
  useEffect(() => noteMet('furuhonya'), []);
  const book = G.entries.filter(inBook);
  const entries = book.filter((e) => e.tab === tab);
  const open = book.find((e) => e.id === chosen[tab]) ?? entries[0];
  // The left page's head counts the open part of the book: how many of its pages are filled in, of how many.
  const known = entries.filter((e) => galleryKnown(e.id) === 'full').length;
  const pageRef = useRef<HTMLDivElement>(null);
  // While a page is open, spare moments go to what the next taps need: first the faces on the other tabs' pages
  // (quick to cut, so switching tabs shows them at once), then the stickers of this tab's other characters, nearest
  // the open entry first, so flipping to them shows them at once, and last the figure each other tab opens
  // on. Leaving the gallery lets the figures' stickers go.
  useEffect(() => {
    let alive = true;
    const at = entries.findIndex((e) => e.id === open.id);
    const order = entries
      .map((e, i) => ({ e, d: Math.abs(i - at) }))
      .sort((a, b) => a.d - b.d)
      .map(({ e }) => (galleryKnown(e.id) === 'none' ? undefined : figureOf(e)))
      .filter((r): r is string => !!r);
    void (async () => {
      for (const e of book) {
        const k = galleryKnown(e.id);
        if (e.tab === tab || k === 'none') continue;
        await whenIdle();
        if (!alive) return;
        await warmCutOut(art.portraitUrl(e.id), PIN_SIZE, k === 'seen' ? DARK_SHAPE : undefined);
      }
      for (const who of order) {
        if (!alive) return;
        await warmFigure(who, FIGURE_WIDTH, () => alive);
      }
      // Last, the figure each other tab opens on, so the first switch to it draws at once too.
      for (const k of TABS) {
        if (k === tab) continue;
        const e = book.find((x) => x.id === chosen[k]) ?? book.find((x) => x.tab === k);
        const who = e && galleryKnown(e.id) !== 'none' ? figureOf(e) : undefined;
        if (!alive) return;
        if (who) await warmFigure(who, FIGURE_WIDTH, () => alive);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab]);
  useEffect(() => () => releaseFigures(), []);
  return (
    <div class="screen gallery-screen">
      <div class="scene-area">
        <Diorama scene={BOOK_SCENE} focus={null} guides={save.value.settings.guides} />
        <div class="gallery-top">
          <BackButton onClick={() => up({ name: 'lobby' })} />
        </div>
        <section class="gbook" aria-label={t('gallery.title')}>
          {/* The bookmark tabs sit behind the book, each with its own cut edge (an SVG stroke, cheap to move: the
              open one rises). The book is a paper cut-out of its own, still, so its edge is drawn once. */}
          <div class="gb-tabs" role="tablist">
            {TABS.map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} class={`gb-tab ${k}${tab === k ? ' on' : ''}`} onClick={tap(() => setTab(k))}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <path class="edge" d="M4 100 V24 Q4 6 19 5 Q51 1 81 4 Q96 6 96 23 V100 Z" />
                  <path class="fill" d="M4 100 V24 Q4 6 19 5 Q51 1 81 4 Q96 6 96 23 V100 Z" />
                  <path class="line" d="M4 100 V24 Q4 6 19 5 Q51 1 81 4 Q96 6 96 23 V100" />
                </svg>
                <span class="gb-tab-name">{t(`gallery.tabs.${k}`)}</span>
              </button>
            ))}
          </div>
          <div class="gbook-paper">
            <img class="gbook-sheet" src={art.imageUrl('gallery/book')} alt="" draggable={false} />
          </div>
          <div class="gb-page left">
            {/* The page is headed by the part of the book that is open, its bookmark's colour under the name, and the
                count of its pages filled in. */}
            <div class={`gb-head ${tab}`}>
              <span class="gb-spark" aria-hidden="true">
                ✦
              </span>
              <h1>
                <span class="hl">{t(`gallery.tabs.${tab}`)}</span>
              </h1>
              <span class="gb-count">{t('gallery.count', { n: known, m: entries.length })}</span>
            </div>
            <div class="gb-scroll" key={tab}>
              <div class="gb-badges">
                {entries.map((e, i) => {
                  const k = galleryKnown(e.id);
                  const on = e.id === open.id;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      class={`gb-pin ${k}${on ? ' on' : ''}`}
                      aria-label={k === 'none' ? t('gallery.unknown') : nameOf(e.id)}
                      style={{ '--acc': accentOf(e), '--tilt': `${TILT[i % TILT.length]}deg` }}
                      aria-pressed={on}
                      onClick={tap(() => setChosen({ ...chosen, [tab]: e.id }))}
                    >
                      <span class="gb-art">
                        {k === 'none' ? (
                          <span class="gb-q" aria-hidden="true">
                            ？
                          </span>
                        ) : (
                          <CutOut src={art.portraitUrl(e.id)} px={PIN_SIZE} fill={k === 'seen' ? DARK_SHAPE : undefined} />
                        )}
                      </span>
                      {on ? <PenLoop class="gb-loop" /> : null}
                      <PinName text={k === 'none' ? t('gallery.unknown') : shortNameOf(e.id)} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div class="gb-page right">
            <div class="gb-scroll" key={open.id} ref={pageRef}>
              <EntryPage e={open} />
            </div>
            {/* The ▼ while the page has more below it (a giant's notes start out of view). */}
            <MoreBelow key={open.id} scroller={pageRef} label={t('gallery.more')} />
          </div>
        </section>
      </div>
    </div>
  );
}

/** The right page: the name, the photo, then the notes. */
function EntryPage({ e }: { e: Entry }) {
  const k = galleryKnown(e.id);
  const full = k === 'full';
  const who = figureOf(e);
  const motions = who ? motionsOf(who) : [];
  const [step, setStep] = useState(0);
  const motion = motions.length ? motions[step % motions.length] : null;
  const unit = UNITS[e.id];
  const enemy = ENEMIES[e.id];
  const name = k === 'none' ? t('gallery.unknown') : nameOf(e.id);
  const moving = !!(who && motion && k !== 'none');
  const model = moving ? <Figure id={who!} anim={motion!} width={FIGURE_WIDTH} bleed={BLEED} fill shape={full ? undefined : DARK_SHAPE} /> : null;
  const figure = moving ? figureLayout(who!, FIGURE_WIDTH) : null;
  return (
    <article class="gb-entry" style={{ '--acc': k === 'none' ? '#E9E1D3' : accentOf(e) }} aria-label={name}>
      <h2 class={`gb-name${[...name].length > 5 ? ' long' : ''}`}>
        <span class="hl">{k === 'none' ? name : headingNameOf(e.id)}</span>
      </h2>
      {full ? (
        // The source stamp is simply there: the hand stamp presses stamps elsewhere, never in the book (owner's call).
        <span
          key={e.id}
          class={`gb-stamp ${e.confidence}`}
          role="img"
          aria-label={t(`gallery.confidence.${e.confidence}`)}
          title={t(`gallery.confidence.${e.confidence}`)}
        >
          {STAMP[e.confidence].join('\n')}
        </span>
      ) : null}
      {/* A figure stands on the stage every character shares, as wide as the page, so each is true to its size beside
          the others; a giant is too big for it and runs off the page, its preview taller so its head stays in. A face
          keeps its square. */}
      {/* No spot of colour under it (owner's call, 2026-11-07): the character's own sticker shadow is its ground. */}
      <div class={`gb-figure${moving ? ' stage' : ''}`} style={moving ? { '--stage': `${FIGURE_WIDTH} / ${figure!.height}`, '--bleed-l': BLEED.left, '--bleed-r': BLEED.right } : undefined}>
        {moving && motions.length > 1 ? (
          <button type="button" class="gb-model" aria-label={t('gallery.nextMotion')} onClick={tap(() => setStep(step + 1))}>
            {model}
          </button>
        ) : moving ? (
          <div class="gb-model">{model}</div>
        ) : k === 'none' ? (
          <span class="gb-q big" aria-hidden="true">
            ？
          </span>
        ) : (
          <span class="gb-face-cut">
            <CutOut src={art.portraitUrl(e.id)} px={300} fill={k === 'seen' ? DARK_SHAPE : undefined} />
          </span>
        )}
      </div>
      {moving || k === 'none' ? (
        <p class="gb-caption">
          {moving ? t(`gallery.motion.${motion}`) : t('gallery.unseen')}
          {moving && motions.length > 1 ? <Icon name="restart" size={12} /> : null}
        </p>
      ) : (
        <span class="gb-gap" aria-hidden="true" />
      )}
      {k === 'seen' ? <p class="gb-hint">{t(unit ? 'gallery.metOnly' : 'gallery.seenOnly')}</p> : null}
      {full ? (
        <div class="gb-notes">
          {e.badge || enemy?.boss ? (
            <div class="gb-chips">
              {e.badge ? <span class="gb-chip">{t(`gallery.badge.${e.badge}`)}</span> : null}
              {enemy?.boss ? (
                <span class="gb-chip boss">
                  <Icon name="crown" size={12} /> {t('map.boss')}
                </span>
              ) : null}
            </div>
          ) : null}
          {/* What it does in this game comes first, then what the stories say (owner's call). */}
          {unit || enemy ? (
            <>
              <span class="gb-label-tag first">{t('gallery.ability')}</span>
              <p class="gb-ability">{unit ? t(`card.${e.id}.ability`) : t(`enemy.${e.id}.ability`)}</p>
              <StatChips id={e.id} />
              <span class="gb-label-tag">{t('gallery.lore')}</span>
            </>
          ) : null}
          <p class="gb-lore">{t(`lore.${e.id}`)}</p>
        </div>
      ) : null}
    </article>
  );
}
