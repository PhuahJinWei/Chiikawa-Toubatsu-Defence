import { useEffect } from 'preact/hooks';
import { audio } from '../audio/audio';
import { t } from '../i18n/i18n';
import { save } from '../save/save';
import { DetailsHost } from './components/Details';
import { WishHost } from './components/Wish';
import { HandStampHost } from './components/HandStamp';
import { ConfirmHost, Toast } from './components/ui';
import { route } from './router';
import { ArtKit } from './screens/ArtKit';
import { Battle } from './screens/Battle';
import { Gallery } from './screens/Gallery';
import { Lobby } from './screens/Lobby';
import { QuestScene } from './screens/Quests';
import { SettingsHost } from './screens/Settings';
import { Shop } from './screens/Shop';

export function App() {
  const r = route.value;
  const s = save.value.settings;

  useEffect(() => {
    audio.setVolumes(s.sfx, s.bgm);
  }, [s.sfx, s.bgm]);

  useEffect(() => {
    if (r.name === 'lobby') audio.playMusic('bgm_title');
    else if (r.name !== 'battle') audio.playMusic('bgm_map');
  }, [r.name]);

  let screen;
  switch (r.name) {
    case 'lobby':
      screen = <Lobby />;
      break;
    case 'quests':
    case 'quest':
      // The board, a quest up close and a level's notice are one scene the camera moves through.
      screen = <QuestScene key="quests" r={r} />;
      break;
    case 'battle':
      screen = <Battle key={r.nonce} r={r} />;
      break;
    case 'book':
      screen = <Gallery />;
      break;
    case 'shop':
      screen = <Shop r={r} />;
      break;
    case 'artkit':
      screen = <ArtKit />;
      break;
  }

  return (
    <div class={`app ${s.reducedMotion ? 'reduce-motion' : ''}`}>
      {screen}
      <SettingsHost />
      <Toast />
      <ConfirmHost />
      <DetailsHost />
      <WishHost />
      <HandStampHost />
      <div class="rotate" aria-live="polite">
        <div class="phone" />
        <p class="bold">{t('common.rotate')}</p>
        <p class="small muted">{t('common.rotateSub')}</p>
      </div>
    </div>
  );
}
