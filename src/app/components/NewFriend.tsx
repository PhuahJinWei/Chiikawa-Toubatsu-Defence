// Who has just joined, shown once the card dropped by the last enemy to fall is picked up (owner's calls, 2026-11-10: a
// new friend was a part of the report, which casual players skip; then their page looked plain beside the report and
// the shop's question, which each have someone standing beside them). The friend stands on a little stage in front of
// a paper burst, breathing, drawn from their battle frames on one scale for every friend, so each shows true to size
// beside the others; beside them their card, their name, all of what they do and their numbers; and the hand stamp
// presses 「なかま入り」 onto the page, as the shop does for a friend who joins there. 「図鑑で見る」 opens the gallery book
// at their entry, over the battle, and closing it comes back here.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { figureLayout, reachOf, stage } from '../../art/figure';
import { spriteIdFor } from '../../art/spec';
import { audio } from '../../audio/audio';
import { UNIT_LIST, UNITS } from '../../game/sim/defs';
import { nameOf, t } from '../../i18n/i18n';
import { CardLook } from './CardLook';
import { Figure, warmFigure } from './Figure';
import { closeOnBack } from '../router';
import { Gallery } from '../screens/Gallery';
import { EarnedStamp } from './HandStamp';
import { Icon } from './Icon';
import { JOINED_STAMP } from './PaperMarks';
import { StatChips } from './Stats';
import { Sheet, tap, usePopUpKeys } from './ui';

/** How tall the tallest friend (オデ, 島二郎, in all they do) stands on the page (CSS px): every friend is drawn at the
 *  scale that gives, so ちいかわ is about 100 px tall and たい焼き about 60. */
const TALLEST = 172;
/** The stage: its size, and where the friend's feet stand (CSS px down from its top). */
const STAGE_W = 220;
const STAGE_H = 196;
const GROUND = 182;
/** A team (パジャマパーティーズ) stands all four in a row on a wider stage, each the next's width × this apart (so they
 *  overlap a little), and drawn a little smaller if the row would not fit it. */
const TEAM_STAGE_W = 270;
const TEAM_STEP = 0.62;
/** How far the members standing behind (every other one) are raised (CSS px). */
const TEAM_BACK = 10;
/** The paper burst's least size (CSS px), so its rays show round the smallest friends. */
const BURST_MIN = 150;

/** The battle frames a friend is drawn from: a team's members, one each. */
const spritesOf = (id: string) => (UNITS[id]?.members ?? [undefined]).map((m) => spriteIdFor('ally', id, m));

let scale = 0;
/** CSS px per field px for every friend on the page: the tallest friend stands TALLEST px tall. */
function friendScale(): number {
  if (scale) return scale;
  let tallest = 0;
  for (const u of UNIT_LIST) {
    for (const s of spritesOf(u.id)) {
      const r = reachOf(s);
      if (r) tallest = Math.max(tallest, -r.y0);
    }
  }
  return (scale = tallest ? TALLEST / tallest : 1);
}

interface Placed {
  sprite: string;
  /** The Figure's stage width at the friend's scale (art/figure.ts draws every character on one stage). */
  width: number;
  /** Where its canvas goes on the page's stage (CSS px), and whether it stands behind. */
  left: number;
  top: number;
  back: boolean;
}

/** Where everyone on a friend's stage stands, its width, and the paper burst behind them (centre and size, CSS px). */
function layOut(id: string): { placed: Placed[]; stageW: number; burst: { x: number; y: number; d: number } } {
  const sprites = spritesOf(id);
  const team = sprites.length > 1;
  const stageW = team ? TEAM_STAGE_W : STAGE_W;
  const reach = sprites.map((s) => reachOf(s));
  const wide = Math.max(1, ...reach.map((r) => (r ? r.x1 - r.x0 : 0)));
  const tall = Math.max(1, ...reach.map((r) => (r ? -r.y0 : 0)));
  const k = team ? Math.min(friendScale(), stageW / (wide * (1 + TEAM_STEP * (sprites.length - 1)))) : friendScale();
  const width = stage().w * k;
  const placed = sprites.map((sprite, i) => {
    const back = team && i % 2 === 1;
    // Each canvas has its character's middle at its own middle (art/figure.ts), its ground `y` down from its top.
    const centre = stageW / 2 + (team ? (i - (sprites.length - 1) / 2) * wide * TEAM_STEP * k : 0);
    return { sprite, width, left: centre - width / 2, top: GROUND - (back ? TEAM_BACK : 0) - figureLayout(sprite, width).y, back };
  });
  // The burst rings whoever stands there, never smaller than BURST_MIN, and sits on the stage's floor or above it.
  const h = tall * k;
  const w = team ? stageW : wide * k;
  const d = Math.min(STAGE_H - 6, Math.max(BURST_MIN, Math.max(h, w) * 1.2));
  return { placed, stageW, burst: { x: stageW / 2, y: Math.min(GROUND - h / 2, GROUND + 14 - d / 2), d } };
}

/** Cut the new friend's stickers while the card is still on the field, so their page shows them at once. */
export function warmNewFriend(id: string): void {
  for (const p of layOut(id).placed) void warmFigure(p.sprite, p.width, () => true);
}

/** The friend on their stage, in front of the paper burst; those standing behind are drawn first. */
function FriendStage({ id }: { id: string }) {
  const { placed, stageW, burst } = layOut(id);
  const order = [...placed].sort((a, b) => Number(b.back) - Number(a.back));
  return (
    <div class="nf-stage" style={{ width: `${stageW}px`, height: `${STAGE_H}px`, '--bx': `${burst.x}px`, '--by': `${burst.y}px`, '--bd': `${burst.d}px` } as Record<string, string>}>
      {order.map((p) => (
        <div key={p.sprite} class="nf-fig" style={{ left: `${p.left}px`, top: `${p.top}px` }}>
          <Figure id={p.sprite} anim="idle" width={p.width} />
        </div>
      ))}
    </div>
  );
}

/** The gallery book over the battle, open at the new friend's entry. Its もどる, Escape and the system back gesture close
 *  it, back to their page; the keyboard stays inside it while it is up. */
function BookOver({ id, onClose }: { id: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  usePopUpKeys(ref, onClose);
  useLayoutEffect(() => closeOnBack(onClose), []);
  return (
    <div ref={ref} tabIndex={-1} class="book-over" role="dialog" aria-modal="true" aria-label={t('gallery.title')}>
      <Gallery entry={id} onClose={onClose} />
    </div>
  );
}

/** Who has just joined: their stage, their card beside their name, all of what they do and their numbers, and
 *  「なかま入り」 pressed on by the hand stamp. 「図鑑で見る」 opens the gallery book at their entry, over the battle. 次へ (or the
 *  system back gesture, through `onBack`) goes on to the report; a tap beside the page does not, so it is not skipped by
 *  mistake. */
export function NewFriendSheet({ id, onNext, onBack }: { id: string; onNext: () => void; onBack: { current: (() => void) | null } }) {
  const [book, setBook] = useState(false);
  useEffect(() => {
    audio.sfx('sfx_unlock');
    onBack.current = onNext;
    return () => {
      if (onBack.current === onNext) onBack.current = null;
    };
  }, []);
  return (
    <>
      <Sheet
        class="new-friend"
        title={t('result.newCard')}
        tone="#f9c2ce"
        actions={
          <>
            <button class="btn nf-book" onClick={tap(() => setBook(true), 'sfx_card')}>
              <Icon name="book" /> {t('drop.book')}
            </button>
            <button class="btn primary nf-next" onClick={tap(onNext)}>
              {t('drop.next')}
            </button>
          </>
        }
      >
        <div class="nf-body">
          {/* 「なかま入り」 goes on the picture's corner, clear of any name however long. */}
          <div class="nf-photo">
            <FriendStage id={id} />
            <EarnedStamp id={`joined:${id}`} class="red-stamp nf-stamp" label={t('shop.joinedStamp')}>
              {JOINED_STAMP}
            </EarnedStamp>
          </div>
          <div class="nf-notes">
            <div class="nf-head">
              <CardLook id={id} class="nf-card" />
              <div class="nf-name">{nameOf(id)}</div>
            </div>
            <p class="nf-does">{t(`card.${id}.ability`)}</p>
            <StatChips id={id} />
          </div>
        </div>
      </Sheet>
      {book ? <BookOver id={id} onClose={() => setBook(false)} /> : null}
    </>
  );
}
