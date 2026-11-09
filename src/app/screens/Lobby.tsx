import { useEffect, useState } from 'preact/hooks';
import { imageSpec, LOBBY_SCENE } from '../../art/spec';
import { art } from '../../art/store';
import { DEV_MODE } from '../../dev';
import { t } from '../../i18n/i18n';
import { save, updateSave } from '../../save/save';
import { Icon } from '../components/Icon';
import { StickerIcon } from '../components/StickerIcon';
import { MoneyPill, tap } from '../components/ui';
import { installState, promptInstall } from '../install';
import { clearedCount, noteMet } from '../progress';
import { boardMemory, go } from '../router';
import { Diorama } from '../scene/Diorama';
import { openSettings } from './Settings';

/** How long the camera takes to turn from the counter to the quest board. */
const TURN_MS = 420;

const calm = () => save.value.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A lobby button's box takes its picture's shape (the pictures are 600 tall, each its own width); CSS sets the height. */
function shape(k: string): Record<string, number> | undefined {
  const s = imageSpec(k);
  return s ? { '--ar': s.w / s.h } : undefined;
}

/** The lobby, where the game starts: the reception counter with the 鎧さん behind it and four big buttons floating
 *  over it. あそぶ turns the camera to the quest board. */
export function Lobby() {
  const s = save.value;
  const [turning, setTurning] = useState(false);
  // The 鎧さん at the job counter is 労働の鎧さん, who hands out the jobs (and pays for them).
  useEffect(() => noteMet('yoroi_rodo'), []);
  useEffect(() => {
    if (!turning) return;
    boardMemory.paper = null;
    const id = window.setTimeout(() => go({ name: 'quests' }), calm() ? 0 : TURN_MS);
    return () => window.clearTimeout(id);
  }, [turning]);
  // The owner's Japanese title, in every language (there is no English logo).
  const logoKey = 'ui/logo_ja';
  const showInstall = clearedCount() > 0 && !s.installDismissed && installState.value !== 'installed';
  const open = (name: 'book' | 'shop') => tap(() => go({ name }));
  return (
    <div class={`screen lobby-screen${turning ? ' turning' : ''}`}>
      <div class="scene-area">
        <Diorama scene={LOBBY_SCENE} focus={null} guides={s.settings.guides} />
        <div class="lobby-top">
          <div class="lobby-logo">
            {art.isReal(logoKey) ? (
              <img src={art.imageUrl(logoKey)} alt={t('app.title')} />
            ) : (
              <h1 aria-label={t('app.title')}>
                <span class="l1">{t('app.line1')}</span>
                <span class="l2">{t('app.line2')}</span>
              </h1>
            )}
          </div>
          <div class="grow" />
          {/* The top-right corner: the money, then 設定 small in the very corner (opened rarely, so it does not compete
              with the big buttons). */}
          <div class="lobby-corner">
            <MoneyPill />
            <button
              type="button"
              class="game-btn settings"
              style={shape('ui/button_settings')}
              aria-label={t('lobby.settings')}
              aria-haspopup="dialog"
              onClick={tap(openSettings)}
            >
              <StickerIcon k="ui/button_settings" px={100} />
            </button>
          </div>
        </div>
        {/* The owner's button pictures carry their names (in Japanese, in both languages); screen readers get them in the
            player's language. */}
        <nav class="lobby-menu" aria-label={t('lobby.menu')}>
          <button type="button" class="game-btn gallery" style={shape('ui/button_book')} aria-label={t('lobby.gallery')} onClick={open('book')}>
            <StickerIcon k="ui/button_book" px={180} />
          </button>
          <button type="button" class="game-btn shop" style={shape('ui/button_shop')} aria-label={t('lobby.shop')} onClick={open('shop')}>
            <StickerIcon k="ui/button_shop" px={180} />
          </button>
          <button
            type="button"
            class="game-btn play"
            style={shape('ui/button_play')}
            aria-label={t('lobby.play')}
            disabled={turning}
            onClick={tap(() => setTurning(true), 'sfx_card')}
          >
            <StickerIcon k="ui/button_play" px={270} />
          </button>
        </nav>
        {showInstall ? (
          <div class="ink-card install-card">
            <div class="row">
              <Icon name="download" />
              <p class="small bold grow">{t('map.install')}</p>
            </div>
            {installState.value === 'ios' ? <p class="small muted">{t('map.installIos')}</p> : null}
            <div class="row">
              {installState.value === 'available' ? (
                <button class="btn blue small" onClick={tap(promptInstall)}>
                  {t('map.installBtn')}
                </button>
              ) : null}
              <button
                class="btn ghost small"
                onClick={tap(() =>
                  updateSave((d) => {
                    d.installDismissed = true;
                  }),
                )}
              >
                {t('map.later')}
              </button>
            </div>
          </div>
        ) : null}
        {/* In dev mode, a reminder that this is its own save, with everything unlocked, and the way into the testing
            ground. */}
        {DEV_MODE ? (
          <div class="lobby-dev">
            <p>{t('app.dev')}</p>
            <button type="button" class="lobby-dev-btn" onClick={tap(() => go({ name: 'battle', mode: 'sandbox', world: 1, cars: true, nonce: Date.now() }))}>
              {t('sandbox.enter')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
