import { signal, type Signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { QUEST_IMAGES, QUESTS_SCENE } from '../../art/spec';
import { art } from '../../art/store';
import { nameOf, shortNameOf, t } from '../../i18n/i18n';
import { levelArtKeys } from '../../game/controller';
import { ENDLESS_WORLD, ENEMIES, enemiesInLevel, fitsJob, homeReason, LEVELS, levelsOfWorld, UNITS, WORLDS } from '../../game/sim/defs';
import type { LevelDef } from '../../game/sim/types';
import { save } from '../../save/save';
import { CutOut } from '../components/CutOut';
import { callOff, EarnedStamp, pressNow } from '../components/HandStamp';
import { Icon } from '../components/Icon';
import { showDetails } from '../components/Details';
import { BOSS_STAMP, DARK_SHAPE, PenLoop, StarMark } from '../components/PaperMarks';
import { PlatePaper } from '../components/Plate';
import { StickerIcon } from '../components/StickerIcon';
import { BackButton, tap, toast } from '../components/ui';
import { askWish } from '../components/Wish';
import {
  deckSize,
  defaultDeck,
  galleryKnown,
  isCleared,
  isWishCard,
  levelUnlocked,
  needsDeckChoice,
  nextLevel,
  ownedCards,
  wishFor,
  worldUnlocked,
} from '../progress';
import { boardMemory, ENDLESS_PAPER, go, route, type Route, up } from '../router';
import { Diorama } from '../scene/Diorama';

/** One paper per world (World 4–6 show as coming soon until they are built), then endless mode. */
const PAPERS = [...QUEST_IMAGES.filter((i) => i.key.startsWith('quests/world')).map((_, i) => i + 1), ENDLESS_PAPER];
/** The place a paper is for, written big on it: its world's place, or the ranking. */
const placeOf = (n: number) => (n === ENDLESS_PAPER ? t('map.endlessTitle') : t(`world.${n}.place`));

type PaperState = 'open' | 'locked' | 'soon';

function paperState(n: number): PaperState {
  if (n === ENDLESS_PAPER) return save.value.features.endless ? 'open' : 'locked';
  if (!WORLDS[n] || levelsOfWorld(n).length === 0) return 'soon';
  return worldUnlocked(n) ? 'open' : 'locked';
}

const calm = () => save.value.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const two = (n: number) => String(n).padStart(2, '0');
const starsOf = (levels: LevelDef[]) => levels.reduce((a, l) => a + (save.value.cleared[l.id]?.stars ?? 0), 0);
/** Each level's number is written a little crooked, by its number (degrees). */
const WRITE_TILT = [-3, 2, -1, 3, -2, 1, -3, 2, 2, -2];
/** The red stamps are Japanese in either language, like the gallery's (what they mean is read out in the player's
 *  language): the boss level (BOSS_STAMP, with the paper marks), a world all cleared, and Rakko at the top of the 討伐
 *  ranking. */
const CLEARED_STAMP = '討伐\n完了';
const RANK_STAMP = '1位';
/** Pressed on a job notice when the job is taken (出発), every time: the word Japanese quest games use for it. */
const TAKEN_STAMP = '受注';
/** From 出発 to the battle (ms): the hand stamp has pressed 「受注」, held it, and is lifting away (a tap goes at once). */
const TAKE_MS = 850;
/** Holding a friend's face on a job notice this long shows their details (ms); moving further than HOLD_SLOP (px)
 *  before then lets go. */
const HOLD_MS = 450;
const HOLD_SLOP = 10;

/** The boss waiting at the end of a level, if it has one: the last to come, so that a ゾウ met on the way is not taken
 *  for the one the level ends with. */
function bossOf(l: LevelDef): string | undefined {
  return l.waves.flatMap((w) => w.spawns).reverse().find((s) => s.boss || ENEMIES[s.enemy]?.boss)?.enemy;
}

/** The heading along the top of the board: the back button on the left, the board's name on a plate in the middle
 *  (pink, like the plate on the lobby's 「あそぶ」 button). Just its name: the paper up close says which quest it is. */
function BoardTop({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div class="board-top">
      <BackButton onClick={onBack} />
      <div class="ink-plate board-title">
        <PlatePaper />
        <h1>{title}</h1>
      </div>
    </div>
  );
}

/** A quest pinned on the board: the blank paper with the world's number, name and picture written on it. */
function QuestPaper({ n, onOpen, still }: { n: number; onOpen?: () => void; still?: boolean }) {
  const state = paperState(n);
  const endless = n === ENDLESS_PAPER;
  const levels = endless ? [] : levelsOfWorld(n);
  const done = levels.filter((l) => isCleared(l.id)).length;
  const place = placeOf(n);
  const best = save.value.best.endless;
  const lockText = endless ? t('map.unlockAfter', { n: ENDLESS_WORLD }) : n > 1 ? t('map.lockedWorld', { world: t(`world.${n - 1}.name`) }) : '';
  const pick = () => {
    if (state === 'open') onOpen?.();
    else if (state === 'soon') toast(t('quests.soon'));
    else toast(lockText, 'bad');
  };
  return (
    <article class={`quest-paper ${state}${endless ? ' endless' : ''}${still ? ' still' : ''}`}>
      <img class="qp-sheet" src={art.imageUrl('quests/paper')} alt="" draggable={false} />
      <div class="qp-head">
        <span class="qp-no">{endless ? 'EX' : two(n)}</span>
        <span class="qp-world">{endless ? t('endless.ranking') : t(`world.${n}.name`)}</span>
      </div>
      <h2 class="qp-place">
        <span class="hl">{place}</span>
      </h2>
      <div class="qp-pic">
        {endless && art.isReal('quests/ranking') ? (
          // The owner's picture of Rakko, with the ranking's first line on a label and the 「1位」 stamp.
          <>
            <img src={art.imageUrl('quests/ranking')} alt="" draggable={false} />
            {state === 'open' ? (
              <>
                <span class="qp-progress">
                  1. {t('endless.rakko')} · {t('endless.rakkoScore')}
                </span>
                <span class="red-stamp qp-stamp rank" aria-hidden="true">
                  {RANK_STAMP}
                </span>
              </>
            ) : null}
          </>
        ) : endless ? (
          // Until it is drawn: Rakko's face as a sticker.
          <div class="qp-rank">
            <span class="qp-rank-face">
              <CutOut src={art.portraitUrl('rakko')} px={220} />
              <span class="red-stamp qp-rank-stamp" aria-hidden="true">
                {RANK_STAMP}
              </span>
            </span>
            <span class="qp-rank-line">
              1. {t('endless.rakko')} · {t('endless.rakkoScore')}
            </span>
          </div>
        ) : (
          <img src={art.imageUrl(`quests/world${n}`)} alt="" draggable={false} />
        )}
        {state === 'open' && levels.length ? (
          <span class="qp-progress">
            <StarMark on />
            {starsOf(levels)}/{levels.length * 3}
          </span>
        ) : null}
        {state === 'open' && levels.length && done === levels.length ? (
          <EarnedStamp id={`cleared:world${n}`} class="red-stamp qp-stamp" label={t('quests.cleared')}>
            {CLEARED_STAMP}
          </EarnedStamp>
        ) : null}
      </div>
      <div class="qp-foot">
        {state === 'open' ? (
          <>
            <p class="qp-protect">
              <Icon name={endless ? 'trophy' : 'shield'} />
              {endless ? (best ? `${t('endless.best')} ${t('endless.waves', { n: best })}` : t('map.endlessSub')) : t('quests.protect')}
            </p>
            {still ? null : (
              <p class="qp-go">
                {endless ? t('quests.challenge') : t('quests.choose')}
                <Icon name="next" />
              </p>
            )}
          </>
        ) : state === 'locked' ? (
          <p class="qp-lock">
            <Icon name="lock" /> {lockText}
          </p>
        ) : null}
      </div>
      {state === 'open' ? null : (
        <img
          class="qp-stamp-soon"
          src={art.imageUrl('quests/stamp_soon')}
          alt={t('quests.soon')}
          draggable={false}
        />
      )}
      {still ? null : <button type="button" class="qp-hit" aria-label={`${endless ? 'EX' : two(n)} ${place}`} onClick={tap(pick, state === 'open' ? 'sfx_card' : 'sfx_tap')} />}
    </article>
  );
}

/** The world a new visit to the board starts at: the one with the next level to play. */
function startPaper(): number {
  return nextLevel().world;
}

/** The quest board's row: one notice paper per world, side by side; drag or swipe along them, tap one to choose it.
 *  `flown` is the paper standing up close (its twin is in the focus), hidden here meanwhile. */
function BoardRow({ focus, flown, onOpen }: { focus?: number; flown: number | null; onOpen: (n: number, from: DOMRect) => void }) {
  const row = useRef<HTMLDivElement>(null);
  /** How far along the row is scrolled (0…1), how much of it shows at once, and the papers on screen. */
  const [scroll, setScroll] = useState<{ at: number; size: number; seen: number[] }>({ at: 0, size: 1, seen: [] });
  const measure = () => {
    const el = row.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const box = el.getBoundingClientRect();
    // A paper is on screen when at least half of it shows.
    const seen = [...el.querySelectorAll<HTMLElement>('.quest-slot')]
      .filter((slot) => {
        const r = slot.getBoundingClientRect();
        return Math.min(r.right, box.right) - Math.max(r.left, box.left) >= r.width / 2;
      })
      .map((slot) => Number(slot.dataset.paper));
    const next = { at: max > 0 ? el.scrollLeft / max : 0, size: Math.min(1, el.clientWidth / Math.max(1, el.scrollWidth)), seen };
    setScroll((s) => (s.at === next.at && s.size === next.size && s.seen.join() === seen.join() ? s : next));
  };
  // Bring the paper in view that the player came for (or came back from).
  useLayoutEffect(() => {
    const el = row.current;
    const n = focus ?? boardMemory.paper ?? startPaper();
    const card = el?.querySelector<HTMLElement>(`[data-paper="${n}"]`);
    if (el && card) el.scrollLeft = Math.max(0, card.offsetLeft - el.offsetWidth * 0.03);
    measure();
    const ro = el ? new ResizeObserver(measure) : null;
    if (el) ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const page = (dir: 1 | -1) => {
    const el = row.current;
    const card = el?.querySelector<HTMLElement>('.quest-slot');
    if (!el || !card) return;
    el.scrollBy({ left: dir * (card.offsetWidth + 22), behavior: calm() ? 'auto' : 'smooth' });
  };
  // A pin below the row slides it to that pin's paper.
  const slideTo = (n: number) => {
    const el = row.current;
    const card = el?.querySelector<HTMLElement>(`[data-paper="${n}"]`);
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetWidth * 0.03, behavior: calm() ? 'auto' : 'smooth' });
  };
  const open = (n: number) => {
    boardMemory.paper = n;
    if (n === ENDLESS_PAPER) {
      go({ name: 'battle', mode: 'endless', nonce: Date.now() });
      return;
    }
    // Where the paper is pinned, so it can fly from here to its place up close.
    const paper = row.current?.querySelector<HTMLElement>(`[data-paper="${n}"] .quest-paper`);
    onOpen(n, paper?.getBoundingClientRect() ?? new DOMRect());
  };
  return (
    <>
        <div class="quest-row" ref={row} onScroll={measure}>
          {PAPERS.map((n) => (
            <div key={n} class={n === flown ? 'quest-slot flown' : 'quest-slot'} data-paper={n}>
              <QuestPaper n={n} onOpen={() => open(n)} />
            </div>
          ))}
        </div>
        {scroll.at > 0.01 ? (
          <button type="button" class="board-arrow prev" aria-label={t('quests.prev')} onClick={tap(() => page(-1))}>
            <Icon name="back" />
          </button>
        ) : null}
        {scroll.at < 0.99 && scroll.size < 1 ? (
          <button type="button" class="board-arrow next" aria-label={t('quests.next')} onClick={tap(() => page(1))}>
            <Icon name="next" />
          </button>
        ) : null}
        {scroll.size < 1 ? (
          <div class="board-pins">
            {PAPERS.map((n) => (
              <button
                key={n}
                type="button"
                class={scroll.seen.includes(n) ? 'board-pin on' : 'board-pin'}
                aria-label={t('quests.pin', { place: placeOf(n) })}
                onClick={tap(() => slideTo(n))}
              >
                <i />
              </button>
            ))}
          </div>
        ) : null}
    </>
  );
}

/** A level's job, opened by tapping the level: the quest paper and the level sheet both turn over, like the two pages
 *  of a notice. The quest paper's back is the job page (JobPage): 労働の鎧さん's note, who is coming and the ramen
 *  ticket. The sheet's back is the team page (TeamPage): the friends to take, and 出発. The battle then only glances at
 *  the enemies on the road and starts. */
interface Job {
  level: LevelDef;
  /** The friends going (the pink pen circles them). */
  deck: Signal<string[]>;
  /** The friend 星 turns into, picked as it joins the team. */
  wish: Signal<string | null>;
  /** Whether a ぶた入りラーメン券 is used. */
  ramen: Signal<boolean>;
  /** Set once 出発 is pressed, while 「受注」 is being stamped. */
  taking: Signal<boolean>;
  /** The 「受注」 stamp on the job page, pressed by the hand stamp when the job is taken. */
  stamp: { current: HTMLSpanElement | null };
}

function newJob(level: LevelDef): Job {
  return { level, deck: signal(defaultDeck(level)), wish: signal(wishFor(level)), ramen: signal(false), taking: signal(false), stamp: { current: null } };
}

/** The rows a page lays this many faces out in, as square a grid as suits its band (which sizes the faces to fit, see
 *  .jn-band): enemies in wider rows, above their names; friends in a squarer grid. */
const foeRows = (n: number) => (n <= 3 ? 1 : n <= 10 ? 2 : 3);
const friendRows = (n: number) => (n <= 3 ? 1 : n <= 8 ? 2 : n <= 12 ? 3 : 4);
const gridOf = (n: number, rows: number) => ({ '--rows': rows, '--cols': Math.max(1, Math.ceil(n / rows)) });

/** The job page, on the back of the quest paper: the level and 労働の鎧さん's note for it, who is coming (face stickers
 *  over their names, dark shapes for those never seen, the boss stamped; each tapped for its details card), and the
 *  ramen ticket to use. 「受注」 is pressed on its corner when the job is taken. */
function JobPage({ job }: { job: Job }) {
  const { level } = job;
  const foes = enemiesInLevel(level);
  const boss = bossOf(level);
  const tickets = save.value.items.buta;
  const ramen = job.ramen.value;
  return (
    <section class="job-notice job-page" aria-label={`${level.id} ${t('notice.title')}`}>
      <img class="qp-sheet" src={art.imageUrl('quests/paper')} alt="" draggable={false} />
      <div class="jn-body">
        <h2 class="jn-title">
          <span class="jn-id">{level.id}</span>
          <span class="hl">{t('notice.title')}</span>
        </h2>
        <p class="jn-note">
          {t(`job.lines.${level.id}`)}
          <span class="jn-from">— {t('job.from')}</span>
        </p>
        <h3 class="jn-head">{t('notice.enemies')}</h3>
        <div class="jn-band jn-foes" style={gridOf(foes.length, foeRows(foes.length))}>
          <div class="jn-grid">
            {foes.map((id) => {
              const known = galleryKnown(id) !== 'none';
              const name = known ? nameOf(id) : t('gallery.unknown');
              // Under the face, the short name (the details card and the label read out have it whole).
              const label = known ? shortNameOf(id) : name;
              return (
                <button
                  key={id}
                  type="button"
                  class="jn-foe"
                  aria-haspopup="dialog"
                  aria-label={id === boss ? `${name} ${t('map.boss')}` : name}
                  onClick={tap(() => showDetails(id, id === boss))}
                >
                  <span class="jn-face">
                    <CutOut src={art.portraitUrl(id)} px={90} fill={known ? undefined : DARK_SHAPE} />
                    {id === boss ? (
                      <span class="red-stamp jn-boss" aria-hidden="true">
                        {BOSS_STAMP}
                      </span>
                    ) : null}
                  </span>
                  <span class="jn-name" aria-hidden="true">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {/* The ramen ticket (while there are any), at the foot of the job page, level with 出発 on the team page. */}
        {tickets > 0 ? (
          <button
            type="button"
            class={ramen ? 'jn-ramen on' : 'jn-ramen'}
            aria-pressed={ramen}
            onClick={tap(() => (job.ramen.value = !ramen), ramen ? 'sfx_cancel' : 'sfx_card')}
          >
            <span class="jn-ticket">
              <StickerIcon k="shop/item_buta" px={64} />
              {ramen ? <PenLoop class="jn-loop" /> : null}
            </span>
            <span class="jn-ramen-text">
              {t('prep.ramen')}
              <small>{t('prep.ramenLeft', { n: tickets })}</small>
            </span>
          </button>
        ) : null}
      </div>
      <span
        ref={(el) => {
          job.stamp.current = el;
        }}
        class="red-stamp jn-taken unstamped"
        aria-hidden="true"
      >
        {TAKEN_STAMP}
      </span>
    </section>
  );
}

/** The team page, on the back of the level sheet: the friends to take (tap a face to pick or drop them, hold it for
 *  their details card; on a set team a tap shows the details), and 出発. 星 joins with a wish: tapped, it asks which
 *  friend it turns into, and goes with that friend's face pinned to its corner and their cost. */
function TeamPage({ job }: { job: Job }) {
  const { level } = job;
  const forced = !!level.deck.forced?.length;
  const choose = needsDeckChoice(level);
  const owned = ownedCards();
  const size = deckSize();
  const tickets = save.value.items.buta;
  const deck = job.deck.value;
  const wish = job.wish.value;
  const taking = job.taking.value;
  const leaving = useRef<{ el: HTMLElement; timer: number; skip: (e: Event) => void } | null>(null);
  // Leaving the screen another way while 「受注」 is being pressed cancels setting off (and the hand, if it is not down).
  useEffect(
    () => () => {
      const l = leaving.current;
      if (!l) return;
      window.clearTimeout(l.timer);
      window.removeEventListener('pointerdown', l.skip, true);
      callOff(l.el);
    },
    [],
  );
  const team = choose ? owned : deck;
  // The team is kept in the order its friends were picked: the battle's cards go in that order (owner's call,
  // 2026-11-10), numbered on their faces here.
  const toggle = (id: string) => {
    if (deck.includes(id)) job.deck.value = deck.filter((x) => x !== id);
    else if (!fitsJob(id, level)) toast(t(homeReason(id, level)!), 'bad');
    else if (deck.length >= size) toast(t('prep.choose', { n: size }), 'bad');
    else if (isWishCard(id)) {
      askWish(
        wish,
        (w) => {
          job.wish.value = w;
          if (!job.deck.value.includes(id)) job.deck.value = [...job.deck.value, id];
        },
        level,
      );
    } else job.deck.value = [...deck, id];
  };
  // Holding a friend's face shows their details instead of picking them (so do a right click and the menu key); the
  // tap that ends a hold does nothing more. Moving off the face first lets go.
  const hold = useRef<{ timer: number; x: number; y: number; done: boolean } | null>(null);
  const letGo = () => {
    const h = hold.current;
    if (h && !h.done) {
      window.clearTimeout(h.timer);
      hold.current = null;
    }
  };
  const press = (id: string) => (e: PointerEvent) => {
    letGo();
    hold.current = null;
    if (e.button !== 0) return;
    const h = { timer: 0, x: e.clientX, y: e.clientY, done: false };
    h.timer = window.setTimeout(() => {
      h.done = true;
      tap(() => showDetails(id))();
    }, HOLD_MS);
    hold.current = h;
  };
  const drag = (e: PointerEvent) => {
    const h = hold.current;
    if (h && !h.done && Math.hypot(e.clientX - h.x, e.clientY - h.y) > HOLD_SLOP) letGo();
  };
  const menu = (id: string) => (e: Event) => {
    e.preventDefault();
    if (hold.current?.done) return;
    letGo();
    hold.current = { timer: 0, x: 0, y: 0, done: true };
    tap(() => showDetails(id))();
  };
  // A friend's face tapped: picked for the team or dropped (on a set team, their details instead); nothing after a
  // hold, unless it comes from the keyboard.
  const pick = (id: string, on: boolean) => (e: MouseEvent) => {
    const held = !!hold.current?.done && e.detail !== 0;
    hold.current = null;
    if (held) return;
    if (choose) tap(() => toggle(id), on ? 'sfx_cancel' : 'sfx_card')();
    else tap(() => showDetails(id))();
  };
  // 出発: the battle's pictures start loading, the hand stamp presses 「受注」 on the job page, and the battle follows.
  const depart = () => {
    if (!deck.length || taking) return;
    const wishing = deck.some(isWishCard) ? (wish ?? undefined) : undefined;
    const battle = { name: 'battle', mode: 'level', levelId: level.id, nonce: Date.now(), team: deck, wish: wishing, ramen: job.ramen.value && tickets > 0 } as const;
    void art.load(levelArtKeys(level, deck, wishing));
    const el = job.stamp.current;
    if (!el || calm()) {
      go(battle);
      return;
    }
    job.taking.value = true;
    pressNow(el);
    let gone = false;
    const set = () => {
      if (gone) return;
      gone = true;
      const l = leaving.current;
      if (l) {
        window.clearTimeout(l.timer);
        window.removeEventListener('pointerdown', l.skip, true);
      }
      leaving.current = null;
      // The hand goes with the notice, before or after its ink is on (it follows its stamp, and the stamp leaves).
      callOff(el);
      // Gone back while the stamp came down (the system back gesture): no battle after all (it started regardless:
      // 2026-11-10 audit), and the notice can be set off from again.
      const now = route.value;
      if (now.name !== 'quest' || now.level !== level.id) {
        job.taking.value = false;
        return;
      }
      go(battle);
    };
    const skip = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      set();
    };
    leaving.current = { el, timer: window.setTimeout(set, TAKE_MS), skip };
    // The tap that pressed 出発 has already landed; the next one skips the rest.
    window.setTimeout(() => {
      if (!gone) window.addEventListener('pointerdown', skip, true);
    }, 0);
  };
  return (
    <section class="job-notice team-page" aria-label={`${level.id} ${t('prep.title')}`}>
      <img class="qp-sheet" src={art.imageUrl('quests/paper')} alt="" draggable={false} />
      <div class="jn-body">
        <h3 class="jn-head">
          {t('prep.title')}
          {choose ? <span class="jn-count">{t('prep.count', { n: deck.length, m: size })}</span> : null}
        </h3>
        {forced ? <p class="jn-forced">{t('prep.forced')}</p> : null}
        <div class="jn-band jn-team" style={gridOf(team.length, friendRows(team.length))}>
          <div class="jn-grid">
            {team.map((id) => {
              const on = deck.includes(id);
              // 星 going shows the friend it turns into, and costs what they cost; left home, its cost is unknown.
              const star = isWishCard(id);
              const as = star && on ? wish : null;
              const cost = UNITS[as ?? id]?.cost ?? 0;
              // Who stays home, faded right down: the islanders (ヒトハ, フタバ, 島二郎) on a job without water, Rakko on
              // a hunt without his car.
              const home = homeReason(id, level);
              const dry = home !== null;
              return (
                <button
                  key={id}
                  type="button"
                  class={`jn-ally${on ? ' on' : ''}${dry ? ' dry' : ''}`}
                  title={home ? t(home) : undefined}
                  aria-pressed={choose ? on : undefined}
                  aria-haspopup={choose && !(star && !on) ? undefined : 'dialog'}
                  aria-label={
                    home
                      ? `${nameOf(id)} ${t(home)}`
                      : as
                        ? `${t('wish.as', { name: nameOf(as) })} ${t('battle.cost', { n: cost })}`
                        : star
                          ? nameOf(id)
                          : `${nameOf(id)} ${t('battle.cost', { n: cost })}`
                  }
                  onPointerDown={press(id)}
                  onPointerMove={drag}
                  onPointerUp={letGo}
                  onPointerCancel={letGo}
                  onPointerLeave={letGo}
                  onContextMenu={menu(id)}
                  onClick={pick(id, on)}
                >
                  <span class="jn-face">
                    <CutOut src={art.portraitUrl(id)} px={90} />
                    {on ? <PenLoop class="jn-loop" /> : null}
                    {on && choose ? (
                      <span class="jn-order" aria-hidden="true">
                        {deck.indexOf(id) + 1}
                      </span>
                    ) : null}
                    {as ? (
                      <span class="jn-wish">
                        <CutOut src={art.portraitUrl(as)} px={56} />
                      </span>
                    ) : null}
                  </span>
                  <span class="jn-cost">
                    <Icon name="leaf" />
                    {star && !as ? '?' : cost}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <button type="button" class="ink-plate jn-go" disabled={!deck.length || taking} onClick={tap(depart, 'sfx_card')}>
          <PlatePaper />
          {t('prep.go')}
        </button>
      </div>
    </section>
  );
}

/** A world's quest up close: the camera comes in on its paper, and the sheet of its ten levels is pinned beside it,
 *  written by hand like the gallery book: each level's number in ink (faint pencil while locked) with its stars as
 *  stickers, the boss as its face sticker (a dark shape until beaten) with a red stamp. The pink pen circles the level
 *  to play next; tapping a level turns both papers over to that level's job (see Job): the job page on the quest
 *  paper's back, the team page on the sheet's. */
function QuestFocus({ world, level: openId, flyFrom, closing }: { world: number; level?: string; flyFrom: DOMRect | null; closing: boolean }) {
  const levels = levelsOfWorld(world);
  const ok = levels.length > 0 && worldUnlocked(world);
  useEffect(() => {
    if (ok) boardMemory.paper = world;
    else go({ name: 'quests', focus: world }, { replace: true });
  }, [ok]);
  const open = ok && openId && LEVELS[openId]?.world === world && levelUnlocked(openId) ? LEVELS[openId] : null;
  // A closed notice stays on the board a moment, lifting off while the camera pans back; tapping another level while
  // one is up presses the new notice on straight away (there is no pan to wait for).
  // Turning the sheet back over, its back keeps showing the notice until the turn is done; every turn (either way)
  // lifts the sheet a little off the board.
  const before = useRef<LevelDef | null>(open);
  const [leaving, setLeaving] = useState<LevelDef | null>(null);
  const [turning, setTurning] = useState(false);
  useEffect(() => {
    const was = before.current;
    before.current = open;
    if ((was?.id ?? null) === (open?.id ?? null) || calm()) {
      setLeaving(null);
      return;
    }
    setTurning(true);
    setLeaving(open ? null : was);
    const id = window.setTimeout(() => {
      setTurning(false);
      setLeaving(null);
    }, TURN_MS);
    return () => window.clearTimeout(id);
  }, [open?.id]);
  // While the papers turn back over, their backs still show the job they had (the same one: its team stays picked).
  const shown = open ?? leaving ?? before.current;
  const job = useMemo(() => (shown ? newJob(shown) : null), [shown?.id]);
  const paperRef = useRef<HTMLDivElement>(null);
  // Flown in from the board: the quest paper starts where it was pinned on the board and moves into its place.
  useLayoutEffect(() => {
    const el = paperRef.current;
    if (!el || !flyFrom?.width || calm()) return;
    const to = el.getBoundingClientRect();
    el.animate(
      [
        {
          translate: `${flyFrom.left + flyFrom.width / 2 - (to.left + to.width / 2)}px ${flyFrom.top + flyFrom.height / 2 - (to.top + to.height / 2)}px`,
          scale: String(flyFrom.height / el.offsetHeight),
          rotate: '0deg',
        },
        { translate: '0px 0px', scale: '1', rotate: '-2deg' },
      ],
      { duration: FLY_MS, easing: FLY_EASE },
    );
  }, []);
  // Back to the board: the quest paper flies back to its place there (the level sheet lifts off meanwhile).
  useLayoutEffect(() => {
    const el = paperRef.current;
    const target = closing ? document.querySelector<HTMLElement>(`.quest-slot[data-paper="${world}"] .quest-paper`) : null;
    if (!el || !target || calm()) return;
    const row = target.closest<HTMLElement>('.quest-row');
    if (row) {
      const box = row.getBoundingClientRect();
      const at = target.getBoundingClientRect();
      if (at.left < box.left || at.right > box.right) row.scrollLeft += at.left - box.left - row.clientWidth * 0.03;
    }
    const to = target.getBoundingClientRect();
    const from = el.getBoundingClientRect();
    el.animate(
      [
        { translate: '0px 0px', scale: '1', rotate: '-2deg' },
        {
          translate: `${to.left + to.width / 2 - (from.left + from.width / 2)}px ${to.top + to.height / 2 - (from.top + from.height / 2)}px`,
          scale: String(target.offsetHeight / el.offsetHeight),
          rotate: '0deg',
        },
      ],
      { duration: FLY_MS, easing: FLY_EASE, fill: 'forwards' },
    );
  }, [closing]);
  if (!ok) return null;
  const next = nextLevel();
  const last = levels.slice(-2);
  const upNext = next.world === world && levelUnlocked(next.id) && !isCleared(next.id) ? next : null;
  const circled = open?.id ?? upNext?.id;
  const level = (l: LevelDef) => {
    const unlocked = levelUnlocked(l.id);
    const boss = l.index === levels.length ? bossOf(l) : undefined;
    const stars = save.value.cleared[l.id]?.stars ?? 0;
    return (
      <button
        key={l.id}
        type="button"
        class={['ls-level', boss ? 'boss' : '', unlocked ? '' : 'locked'].filter(Boolean).join(' ')}
        style={{ '--tilt': `${WRITE_TILT[(l.index - 1) % WRITE_TILT.length]}deg` }}
        disabled={!unlocked}
        aria-label={[l.id, boss ? t('map.boss') : '', unlocked ? t('quests.stars', { n: stars, m: 3 }) : ''].filter(Boolean).join(' ')}
        onClick={tap(() => go({ name: 'quest', world, level: l.id }), 'sfx_card')}
      >
        {boss ? (
          <span class="ls-boss">
            <CutOut src={art.portraitUrl(boss)} px={110} fill={galleryKnown(boss) === 'full' ? undefined : DARK_SHAPE} />
            <span class="red-stamp ls-stamp">{BOSS_STAMP}</span>
          </span>
        ) : null}
        <span class="n">{l.index}</span>
        {unlocked ? (
          <span class="ls-stars">
            {[0, 1, 2].map((i) => (
              <StarMark key={i} on={i < stars} />
            ))}
          </span>
        ) : null}
        {/* Keyed by who drew it, so the loop draws again when a level is tapped. */}
        {l.id === circled ? <PenLoop key={open ? `open-${open.id}` : 'next'} class={open ? 'ls-loop' : 'ls-loop late'} /> : null}
      </button>
    );
  };
  return (
        <div class={closing ? 'quest-focus closing' : 'quest-focus'}>
          {/* The quest paper is a card too: the world's picture on its front, the job page on its back. It turns over
              with the level sheet. */}
          <div class="qf-slot" style={{ '--slot': 0 }}>
            <div class={flyFrom ? 'qf-paper flying' : 'qf-paper'} ref={paperRef}>
              <div class={['qp-flip', open ? 'over' : '', turning ? 'turning' : ''].filter(Boolean).join(' ')}>
                <div class="qp-face front" inert={!!open}>
                  <QuestPaper n={world} still />
                </div>
                <div class="qp-face back" inert={!open}>
                  {job ? <JobPage key={job.level.id} job={job} /> : null}
                </div>
              </div>
            </div>
          </div>
          {/* The level sheet is a card: the levels on its front; tapping a level turns it over to the team page for that
              level's job on its back, and もどる turns it back. The hidden side cannot be used meanwhile. */}
          <div class="qf-slot" style={{ '--slot': 1 }}>
            <div class={['ls-card', flyFrom ? 'posted' : '', closing ? 'lifting' : ''].filter(Boolean).join(' ')}>
              <div class={['ls-flip', open ? 'over' : '', turning ? 'turning' : ''].filter(Boolean).join(' ')}>
          <section class="level-sheet ls-face front" aria-label={t('quests.levels')} inert={!!open}>
            <img class="qp-sheet" src={art.imageUrl('quests/paper')} alt="" draggable={false} />
            <div class="ls-body">
              <h2 class="ls-title">
                <span class="ls-spark" aria-hidden="true">
                  ✦
                </span>
                <span class="hl">{t('quests.levels')}</span>
              </h2>
              <div class="level-grid">{levels.slice(0, -2).map(level)}</div>
              <div class="level-last">{last.map(level)}</div>
              <p class="ls-total">
                <StarMark on />
                {starsOf(levels)}/{levels.length * 3}
              </p>
            </div>
          </section>
                <div class="ls-face back" inert={!open}>
                  {job ? <TeamPage key={job.level.id} job={job} /> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
  );
}

/** How long a quest paper takes to fly between the board and its place up close (ms), and how it moves. */
const FLY_MS = 560;
/** How long the papers take to turn over (ms); see .ls-flip and .qp-flip. */
const TURN_MS = 620;
const FLY_EASE = 'cubic-bezier(0.45, 0, 0.2, 1)';

type QuestRoute = Extract<Route, { name: 'quests' } | { name: 'quest' }>;

/** The quest board, a quest up close and a level's notice, as one scene the camera moves through: tapping a paper
 *  zooms in while that paper flies to its place, and its level sheet is pressed on beside it as it lands; tapping a
 *  level turns the sheet over to its job notice; going back retraces the same moves (the sheet turns back, then lifts
 *  off while the paper flies back to its place on the board). */
export function QuestScene({ r }: { r: QuestRoute }) {
  const world = r.name === 'quest' ? r.world : null;
  const view = world === null ? 'board' : r.name === 'quest' && r.level ? 'notice' : 'quest';
  const flight = useRef<{ world: number; from: DOMRect } | null>(null);
  // Going back to the board, the quest stays up a moment while its paper flies back to the board.
  const last = useRef<number | null>(world);
  if (world !== null) last.current = world;
  const [settled, setSettled] = useState(world === null);
  useEffect(() => {
    if (world !== null) {
      setSettled(false);
      return;
    }
    if (calm()) {
      setSettled(true);
      return;
    }
    const id = window.setTimeout(() => setSettled(true), FLY_MS);
    return () => window.clearTimeout(id);
  }, [world]);
  const shown = world ?? (settled ? null : last.current);
  const back = () => {
    if (world === null) up({ name: 'lobby' });
    else if (view === 'notice') up({ name: 'quest', world });
    else up({ name: 'quests', focus: world });
  };
  return (
    <div class={`screen quest-scene view-${view}`}>
      <div class="scene-area">
        <div class="board-cam">
          <Diorama scene={QUESTS_SCENE} focus={null} guides={save.value.settings.guides} />
        </div>
        <BoardTop title={t('quests.title')} onBack={back} />
        <BoardRow
          focus={r.name === 'quests' ? r.focus : undefined}
          flown={shown}
          onOpen={(n, from) => {
            flight.current = { world: n, from };
            go({ name: 'quest', world: n });
          }}
        />
        {shown !== null ? (
          <QuestFocus
            key={shown}
            world={shown}
            level={r.name === 'quest' ? r.level : undefined}
            flyFrom={flight.current?.world === shown ? flight.current.from : null}
            closing={world === null}
          />
        ) : null}
      </div>
    </div>
  );
}
