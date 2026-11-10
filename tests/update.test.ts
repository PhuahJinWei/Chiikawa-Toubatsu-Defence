import { afterEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

/** A page as the updater sees it: whether it is out of sight, whether it is online, reloading it, and the service
 *  worker's registration (vite-plugin-pwa's registerSW, faked). */
function page() {
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const nav = { onLine: true };
  const loc = { reload: vi.fn() };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('navigator', nav);
  vi.stubGlobal('location', loc);
  const registration = { update: vi.fn(async () => {}) };
  const reload = vi.fn(async (_reload?: boolean) => {});
  let options: Parameters<Parameters<typeof import('../src/app/update').initUpdate>[0]>[0] = {};
  const register = vi.fn((o: typeof options) => {
    options = o;
    return reload;
  });
  return {
    nav,
    registration,
    /** Taking the new version in (registerSW's updateSW). */
    reload,
    /** The page reloading itself into the new version once it has taken over. */
    pageReload: loc.reload,
    register,
    options: () => options,
    /** The game goes out of sight (`hidden`) or comes back to the front. */
    show: (hidden: boolean) => {
      doc.hidden = hidden;
      doc.dispatchEvent(new Event('visibilitychange'));
    },
  };
}

/** A fresh copy of the updater, for a fresh page. */
const load = () => import('../src/app/update');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.useRealTimers();
});

describe('new versions (owner’s call, 2026-11-10)', () => {
  it('are looked for whenever the game comes back to the front, once a minute at most, and every half hour', async () => {
    vi.useFakeTimers();
    const p = page();
    const m = await load();
    m.initUpdate(p.register, () => false);
    p.options().onRegisteredSW?.('sw.js', p.registration as unknown as ServiceWorkerRegistration);
    // Registering has just looked.
    p.show(true);
    p.show(false);
    expect(p.registration.update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(m.CHECK_GAP_MS);
    p.show(true);
    p.show(false);
    expect(p.registration.update).toHaveBeenCalledTimes(1);
    p.show(true);
    p.show(false);
    expect(p.registration.update).toHaveBeenCalledTimes(1);
    // Left open, it looks every half hour.
    vi.advanceTimersByTime(m.CHECK_EVERY_MS);
    expect(p.registration.update).toHaveBeenCalledTimes(2);
    // Offline, it does not.
    p.nav.onLine = false;
    vi.advanceTimersByTime(m.CHECK_EVERY_MS);
    expect(p.registration.update).toHaveBeenCalledTimes(2);
  });

  it('take themselves in only out of sight and not in a battle, or at once from the lobby’s notice', async () => {
    const p = page();
    const m = await load();
    let battle = true;
    m.initUpdate(p.register, () => battle);
    expect(m.updateReady.value).toBe(false);
    m.applyUpdate();
    expect(p.reload).not.toHaveBeenCalled();
    p.options().onNeedRefresh?.();
    expect(m.updateReady.value).toBe(true);
    // On screen it waits; out of sight in a battle too.
    expect(p.reload).not.toHaveBeenCalled();
    p.show(true);
    expect(p.reload).not.toHaveBeenCalled();
    p.show(false);
    battle = false;
    p.show(true);
    expect(p.reload).toHaveBeenCalledWith(true);
    // The lobby's 更新する takes it in at once, and says so (更新しています…) until the game reloads.
    const q = page();
    const n = await (vi.resetModules(), load());
    n.initUpdate(q.register, () => false);
    q.options().onNeedRefresh?.();
    expect(q.reload).not.toHaveBeenCalled();
    expect(n.updating.value).toBe(false);
    n.applyUpdate();
    expect(q.reload).toHaveBeenCalledWith(true);
    expect(n.updating.value).toBe(true);
  });

  it('reload the game once they have taken over, though never in the middle of a battle', async () => {
    const p = page();
    const m = await load();
    const battle = signal(true);
    m.initUpdate(p.register, () => battle.value);
    p.options().onNeedRefresh?.();
    p.options().onNeedReload?.();
    expect(p.pageReload).not.toHaveBeenCalled();
    // The battle ends: now it reloads.
    battle.value = false;
    expect(p.pageReload).toHaveBeenCalledTimes(1);
  });
});

describe('the cache warm-up', () => {
  it('stops once a new version waits, which can take over only when the old service worker has gone quiet', async () => {
    const { warmCaches } = await import('../src/art/warm');
    vi.useFakeTimers();
    let stop = false;
    const fetch = vi.fn(async (_url: string) => new Response());
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('navigator', { serviceWorker: {}, onLine: true });
    vi.stubGlobal('window', { setTimeout, requestIdleCallback: (fn: () => void) => setTimeout(fn, 1) });
    warmCaches(() => stop);
    await vi.advanceTimersByTimeAsync(6000 + 40);
    const before = fetch.mock.calls.length;
    expect(before).toBeGreaterThan(10);
    stop = true;
    await vi.advanceTimersByTimeAsync(5000);
    // At most the one already on its way.
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(before + 1);
    // Loading every picture's and sound's address takes a few seconds the first time.
  }, 30000);
});
