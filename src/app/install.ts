// "Add to home screen" support. Installing also protects the save from Safari's 7-day storage eviction.

import { signal } from '@preact/signals';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export const installState = signal<'unknown' | 'available' | 'ios' | 'installed'>('unknown');
let deferred: InstallEvent | null = null;

export function initInstall(): void {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) {
    installState.value = 'installed';
    return;
  }
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  if (ios) installState.value = 'ios';
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    installState.value = 'available';
  });
  window.addEventListener('appinstalled', () => {
    installState.value = 'installed';
    deferred = null;
  });
}

/** The browser's own install question. Turned down, the offer goes until the browser makes it again (its
 *  beforeinstallprompt): the button stayed and did nothing (2026-11-10 audit). */
export async function promptInstall(): Promise<void> {
  const offer = deferred;
  if (!offer) return;
  deferred = null;
  try {
    await offer.prompt();
    const choice = await offer.userChoice;
    installState.value = choice.outcome === 'accepted' ? 'installed' : 'unknown';
  } catch {
    installState.value = 'unknown';
  }
}
