// New versions of the game (owner's call, 2026-11-10: an iPhone's home-screen copy stayed a version or two behind).
// The service worker is asked to look for one whenever the game comes back to the front, and every half hour while it
// stays open: a phone usually resumes a home-screen app rather than starting it again, and only a start used to look.
// A new version found is taken in by itself when no battle can be interrupted (the game out of sight, and not in a
// battle), or at once from the lobby's notice; failing both, it comes with the next start. Taking it in reloads the
// game once the new version has taken over, and that reload waits for a battle under way to end.

import { effect, signal } from '@preact/signals';

/** A new version is downloaded and waiting to be taken in. */
export const updateReady = signal(false);
/** The lobby's notice was put off (あとで) for as long as the game stays open. */
export const updateLater = signal(false);
/** The new version is being taken in: the game reloads as soon as it has taken over. */
export const updating = signal(false);
/** The new version has taken over, and the page waits to reload into it. */
const reloadWanted = signal(false);

/** How often to look while the game stays open (ms). */
export const CHECK_EVERY_MS = 30 * 60 * 1000;
/** The least time between two looks (ms): coming back to the front again and again looks once. */
export const CHECK_GAP_MS = 60 * 1000;

/** vite-plugin-pwa's registerSW, as far as it is used here. */
type Register = (options: {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onNeedReload?: () => void;
  onRegisteredSW?: (url: string, registration: ServiceWorkerRegistration | undefined) => void;
}) => (reload?: boolean) => Promise<void>;

let apply: ((reload?: boolean) => Promise<void>) | null = null;

/** Registers the service worker and keeps looking for new versions. `inBattle`: whether a reload would cut one short
 *  (read inside an effect, so a signal it reads lets a held-back reload happen when the battle ends). */
export function initUpdate(register: Register, inBattle: () => boolean): void {
  let registration: ServiceWorkerRegistration | undefined;
  let lastLook = -Infinity;
  const look = () => {
    if (!registration || navigator.onLine === false) return;
    const now = Date.now();
    if (now - lastLook < CHECK_GAP_MS) return;
    lastLook = now;
    void Promise.resolve(registration.update()).catch(() => {});
  };
  const quietly = () => {
    if (updateReady.value && document.hidden && !inBattle()) applyUpdate();
  };
  apply = register({
    immediate: true,
    onNeedRefresh() {
      updateReady.value = true;
      quietly();
    },
    onNeedReload() {
      reloadWanted.value = true;
    },
    onRegisteredSW(_url, r) {
      registration = r;
      // Registering has just looked.
      lastLook = Date.now();
      if (r) setInterval(look, CHECK_EVERY_MS);
    },
  });
  document.addEventListener('visibilitychange', () => (document.hidden ? quietly() : look()));
  effect(() => {
    if (reloadWanted.value && !inBattle()) location.reload();
  });
}

/** Takes in the new version now: the game reloads, the save kept. */
export function applyUpdate(): void {
  if (!updateReady.value || !apply) return;
  updating.value = true;
  void apply(true);
}
