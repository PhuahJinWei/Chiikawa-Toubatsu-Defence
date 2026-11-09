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
import { warmCaches } from './art/warm';
import { whenIdle } from './app/idle';
import { initInstall } from './app/install';
import { initRouter } from './app/router';
import { installDebug } from './debug';
import { audio } from './audio/audio';
import { DEV_MODE, unlockEverything } from './dev';
import { rewardsOwed } from './game/sim/defs';
import { detectLang, setLang } from './i18n/i18n';
import { initSave, save, updateSave } from './save/save';

// Dev mode (?dev in the address) plays from a save of its own, with everything unlocked on every start.
initSave(detectLang(), DEV_MODE);
if (DEV_MODE) updateSave(unlockEverything);
// Friends owed for jobs cleared before they became those jobs' rewards.
const owed = rewardsOwed(save.value.cleared, save.value.cards);
if (owed.length) updateSave((d) => void d.cards.push(...owed.filter((id) => !d.cards.includes(id))));
setLang(save.value.settings.lang);
initRouter();
initInstall();

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
  registerSW({ immediate: true });
  warmCaches();
}
if (import.meta.env.DEV || DEV_MODE || location.search.includes('debug')) installDebug();

// Make sure Japanese glyphs are ready before the first canvas text is drawn.
void document.fonts?.load('400 16px "Yusei Magic"', 'ちいかわ討伐');

render(<App />, document.getElementById('app')!);
