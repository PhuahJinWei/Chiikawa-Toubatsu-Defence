// A friend's or an enemy's details, popped up over the screen from a job notice (tap an enemy's face; hold a friend's,
// since their tap picks them for the team): a small line-art card like the yes/no pop-ups, with the name on its plate,
// the face sticker, what it does in this game and its numbers. What has not been learned yet stays hidden, as in the
// gallery book: an enemy never met is 「？？？」 as a dark shape, and one met but not defeated yet shows only its face
// and name. It closes with ×, a tap outside it, Escape or the system back gesture (which leaves the notice up).

import { signal } from '@preact/signals';
import { useLayoutEffect } from 'preact/hooks';
import { art } from '../../art/store';
import { UNITS } from '../../game/sim/defs';
import { nameOf, t } from '../../i18n/i18n';
import { galleryKnown } from '../progress';
import { closeOnBack, route, type Route } from '../router';
import { CutOut } from './CutOut';
import { Icon } from './Icon';
import { BOSS_STAMP, DARK_SHAPE } from './PaperMarks';
import { StatChips } from './Stats';
import { Dialog, tap } from './ui';

/** The card that is up: whose it is, whether they are the boss here, and the screen it was opened on. */
const shown = signal<{ id: string; boss: boolean; on: Route } | null>(null);

/** Show a friend's or an enemy's details card; `boss` stamps the face 「ボス」, as on the notice. */
export function showDetails(id: string, boss = false): void {
  shown.value = { id, boss, on: route.value };
}

export function DetailsHost() {
  const d = shown.value;
  // The card belongs to the screen it was opened on, and goes if that screen does.
  const up = !!d && d.on === route.value;
  const close = () => (shown.value = null);
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
  return d && up ? <DetailsCard key={d.id} id={d.id} boss={d.boss} onClose={close} /> : null;
}

function DetailsCard({ id, boss, onClose }: { id: string; boss: boolean; onClose: () => void }) {
  const unit = UNITS[id];
  // A friend on a notice is on the team, so all about them is known; an enemy as far as the gallery book knows it.
  const known = unit ? 'full' : galleryKnown(id);
  return (
    <Dialog title={known === 'none' ? t('gallery.unknown') : nameOf(id)} onClose={onClose} class="details">
      <button type="button" class="card-x" aria-label={t('common.close')} onClick={tap(onClose, 'sfx_cancel')}>
        <Icon name="close" size={18} />
      </button>
      <div class="dt-body">
        <span class="dt-face">
          <CutOut src={art.portraitUrl(id)} px={110} fill={known === 'none' ? DARK_SHAPE : undefined} />
          {boss ? (
            <span class="red-stamp dt-boss" role="img" aria-label={t('map.boss')}>
              {BOSS_STAMP}
            </span>
          ) : null}
        </span>
        <div class="dt-notes">
          {known === 'full' ? (
            <>
              <p class="dt-ability">{t(unit ? `card.${id}.ability` : `enemy.${id}.ability`)}</p>
              <StatChips id={id} />
            </>
          ) : (
            <p class="dt-hint">{t(known === 'none' ? 'gallery.unseen' : 'gallery.seenOnly')}</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
