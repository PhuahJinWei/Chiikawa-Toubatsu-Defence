// 星's wish: the friend it turns into, picked as it joins the team (on the job notice's team page, or on the field
// before an endless run). A small line-art card like the details card: every friend the player has as a face sticker
// with their cost, the one wished for last time circled by the pink pen. Tapping a face makes the wish; the card closes
// with ×, a tap outside it, Escape or the system back gesture instead (and 星 stays home).

import { signal } from '@preact/signals';
import { useLayoutEffect } from 'preact/hooks';
import { art } from '../../art/store';
import { UNITS } from '../../game/sim/defs';
import type { LevelDef } from '../../game/sim/types';
import { nameOf, t } from '../../i18n/i18n';
import { wishable } from '../progress';
import { closeOnBack, route, type Route } from '../router';
import { CutOut } from './CutOut';
import { Icon } from './Icon';
import { PenLoop } from './PaperMarks';
import { Dialog, tap } from './ui';

/** The question that is up: the wish made last time, what to do with the answer, the job it is for (only friends who
 *  can go on it are offered) and the screen it was asked on. */
const asked = signal<{ last: string | null; onWish: (id: string) => void; level?: LevelDef; on: Route } | null>(null);

/** Ask which friend 星 turns into on this job. `onWish` gets the answer; nothing happens if the card is closed instead. */
export function askWish(last: string | null, onWish: (id: string) => void, level?: LevelDef): void {
  asked.value = { last, onWish, level, on: route.value };
}

export function WishHost() {
  const a = asked.value;
  // The card belongs to the screen it was asked on, and goes if that screen does.
  const up = !!a && a.on === route.value;
  const close = () => (asked.value = null);
  useLayoutEffect(() => {
    if (!up) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    const letGo = closeOnBack(close);
    return () => {
      window.removeEventListener('keydown', onKey);
      letGo();
    };
  }, [up]);
  if (!a || !up) return null;
  const wish = (id: string) => {
    close();
    a.onWish(id);
  };
  return <WishCard last={a.last} level={a.level} onWish={wish} onClose={close} />;
}

function WishCard({ last, level, onWish, onClose }: { last: string | null; level?: LevelDef; onWish: (id: string) => void; onClose: () => void }) {
  const friends = wishable(level);
  // As square a grid as suits the card: up to five across.
  const cols = Math.min(5, Math.max(3, Math.ceil(friends.length / 2)));
  return (
    <Dialog title={t('wish.title')} onClose={onClose} class="wish">
      <button type="button" class="card-x" aria-label={t('common.close')} onClick={tap(onClose, 'sfx_cancel')}>
        <Icon name="close" size={18} />
      </button>
      <p class="wish-line">{t('wish.line')}</p>
      <div class="wish-grid" style={{ '--cols': cols }}>
        {friends.map((id) => {
          const cost = UNITS[id]?.cost ?? 0;
          return (
            <button
              key={id}
              type="button"
              class={id === last ? 'wish-face on' : 'wish-face'}
              aria-label={`${nameOf(id)} ${t('battle.cost', { n: cost })}`}
              onClick={tap(() => onWish(id), 'sfx_card')}
            >
              <span class="wish-pic">
                <CutOut src={art.portraitUrl(id)} px={80} />
                {id === last ? <PenLoop class="wish-loop" /> : null}
              </span>
              <span class="wish-cost">
                <Icon name="leaf" />
                {cost}
              </span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
