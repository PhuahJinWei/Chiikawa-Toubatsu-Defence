// The UI's hand-lettered font (one weight), with Zen Maru Gothic behind it for any character it lacks and for the
// placeholder art's labels.
import '@fontsource/yusei-magic/400.css';
import '@fontsource/zen-maru-gothic/500.css';
import '@fontsource/zen-maru-gothic/700.css';
import '@fontsource/zen-maru-gothic/900.css';
import './app/styles/global.css';
import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { initUpdate, updateReady } from './app/update';
import { warmCaches } from './art/warm';
import { whenIdle } from './app/idle';
import { initFullscreen } from './app/fullscreen';
import { initInstall } from './app/install';
import { initRouter, route } from './app/router';
import { toast } from './app/components/ui';
import { installDebug } from './debug';
import { audio } from './audio/audio';
import { DEBUG_ON, DEV_MODE, unlockEverything } from './dev';
import { detectLang, setLang, t } from './i18n/i18n';
import { initSave, save, storageOk, updateSave } from './save/save';
import { payOwedFriends } from './app/progress';

// Dev mode (?dev in the address) plays from a save of its own, with everything unlocked on every start.
initSave(detectLang(), DEV_MODE);
if (DEV_MODE) updateSave(unlockEverything);
payOwedFriends();
setLang(save.value.settings.lang);
initRouter();
initInstall();
initFullscreen();
// Saving stopped working (storage full, or switched off): said on whatever screen, each time it does.
storageOk.subscribe((ok) => {
  if (!ok) toast(t('settings.saveFailed'), 'bad');
});

// Audio may only start after a user gesture (iOS). The context itself is opened ahead of that, in a spare moment
// while the game loads: opening it takes a moment, better spent there than in the first tap.
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock, { capture: true });
window.addEventListener('keydown', unlock, { capture: true });
void whenIdle().then(() => audio.prepare());
document.addEventListener('visibilitychange', () => (document.hidden ? audio.suspend() : audio.resume()));
// No pinch-zoom on iOS (the viewport meta is not always honoured).
document.addEventListener('gesturestart', (e) => e.preventDefault());

if (import.meta.env.PROD) {
  // New versions are looked for on coming back to the game and every half hour, and taken in when no battle can be cut
  // short, or at once from the lobby's notice (see app/update.ts).
  initUpdate(registerSW, () => route.value.name === 'battle');
  warmCaches(() => updateReady.value);
}
if (DEBUG_ON) installDebug();

// Make sure Japanese glyphs are ready before the first canvas text is drawn.
void document.fonts?.load('400 16px "Yusei Magic"', 'ちいかわ討伐');

render(<App />, document.getElementById('app')!);
