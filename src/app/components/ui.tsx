import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { art } from '../../art/store';
import { audio } from '../../audio/audio';
import { t } from '../../i18n/i18n';
import { save } from '../../save/save';
import { closeOnBack } from '../router';
import { Icon } from './Icon';
import { PlatePaper } from './Plate';

// ---------------------------------------------------------------- toast

/** What a notice says about what just happened: `bad`, it could not be done (a red !); `ok`, it was (a green tick). Plain
 *  news has neither. */
type NoticeTone = 'bad' | 'ok';

const toastMsg = signal<{ key: number; text: string; tone?: NoticeTone } | null>(null);
let toastTimer = 0;

export function toast(text: string, tone?: NoticeTone): void {
  toastMsg.value = { key: Date.now(), text, tone };
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastMsg.value = null), 1800);
}

/** A short notice on a small name plate, the same on every screen and in battle. */
export function Notice({ text, tone }: { text: string; tone?: NoticeTone }) {
  return (
    <div class="toast ink-plate" role="status">
      <PlatePaper />
      {tone === 'bad' ? (
        <span class="toast-mark bad" aria-hidden="true">
          !
        </span>
      ) : tone === 'ok' ? (
        <span class="toast-mark ok" aria-hidden="true">
          <Icon name="check" size={12} />
        </span>
      ) : null}
      {text}
    </div>
  );
}

export function Toast() {
  const m = toastMsg.value;
  return m ? <Notice key={m.key} text={m.text} tone={m.tone} /> : null;
}

// ---------------------------------------------------------------- buttons

export function tap(fn?: () => void, sfx = 'sfx_tap') {
  return () => {
    audio.unlock();
    audio.sfx(sfx);
    fn?.();
  };
}

/** Every back button in the game: the owner's 「← もどる」 tag (art/ui/back.png), shown as drawn, in both languages. */
export function BackButton({ onClick, small, class: extra }: { onClick: () => void; small?: boolean; class?: string }) {
  return (
    <button type="button" class={['back-btn', small ? 'small' : '', extra ?? ''].join(' ').trim()} onClick={tap(onClick, 'sfx_cancel')} aria-label={t('common.back')}>
      <img src={art.imageUrl('ui/back')} alt="" draggable={false} />
    </button>
  );
}

export function Header({ title, sub, onBack, right }: { title: string; sub?: string; onBack?: () => void; right?: ComponentChildren }) {
  return (
    <header class="header">
      {onBack ? <BackButton onClick={onBack} /> : null}
      <div class="grow">
        <h1>{title}</h1>
        {sub ? <div class="sub">{sub}</div> : null}
      </div>
      {right}
    </header>
  );
}

export function MoneyPill() {
  return (
    <div class="pill money" aria-label={t('res.money')}>
      <span class="dot">
        <Icon name="coin" size={18} />
      </span>
      {save.value.money.toLocaleString()}
    </div>
  );
}

// ---------------------------------------------------------------- sheets & dialogs

/** The pop-ups open now, the top one last: only the top one answers the keyboard. */
const openPopUps: HTMLElement[] = [];

/**
 * What a pop-up does for the keyboard (2026-11-10 audit: none of them did): focus moves into it as it opens (to its first
 * button, so a phone's keyboard does not jump up for a text field), Tab and Shift+Tab go round inside it, Escape closes
 * it when `close` is given, and focus goes back to where it was once it closes. Only the top pop-up answers, and an
 * Escape it takes goes no further (a battle under it does not also take it).
 */
export function usePopUpKeys(ref: { current: HTMLElement | null }, close?: () => void): void {
  const latest = useRef(close);
  latest.current = close;
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openPopUps.push(box);
    const stops = () => [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
    if (!box.contains(document.activeElement)) (stops().find((el) => el.tagName === 'BUTTON') ?? box).focus({ preventScroll: true });
    const onKey = (ev: KeyboardEvent) => {
      if (openPopUps[openPopUps.length - 1] !== box) return;
      if (ev.key === 'Escape') {
        if (!latest.current) return;
        ev.preventDefault();
        ev.stopPropagation();
        latest.current();
        return;
      }
      if (ev.key !== 'Tab') return;
      const all = stops();
      if (!all.length) {
        ev.preventDefault();
        return;
      }
      const first = all[0];
      const last = all[all.length - 1];
      const at = document.activeElement;
      if (!box.contains(at) || at === (ev.shiftKey ? first : last)) {
        ev.preventDefault();
        (ev.shiftKey ? last : first).focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const i = openPopUps.lastIndexOf(box);
      if (i >= 0) openPopUps.splice(i, 1);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A pop-up panel: a line-art card (like .ink-card) in the middle of the screen over a dimmed backdrop, its name on a
 *  plate across its top when it has a `title` (`tone` is the plate's colour). `closer`: a close button (×) in its corner,
 *  for a panel with no other button that closes it. */
export function Sheet({
  onClose,
  children,
  actions,
  label,
  title,
  tone,
  aside,
  class: extra,
  closer,
}: {
  onClose?: () => void;
  children: ComponentChildren;
  actions?: ComponentChildren;
  label?: string;
  title?: string;
  tone?: string;
  /** Someone standing beside the panel (see .sheet-stage). */
  aside?: ComponentChildren;
  class?: string;
  closer?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  usePopUpKeys(ref, onClose);
  const sheet = (
    <div ref={ref} tabIndex={-1} class={`${title ? 'sheet titled' : 'sheet'}${extra ? ` ${extra}` : ''}`} role="dialog" aria-modal="true" aria-label={label ?? title}>
      {title ? (
        <div class="ink-plate sheet-plate" style={tone ? { '--plate': tone } : undefined}>
          <PlatePaper />
          {title}
        </div>
      ) : null}
      {closer && onClose ? (
        <button type="button" class="card-x" aria-label={t('common.close')} onClick={tap(onClose, 'sfx_cancel')}>
          <Icon name="close" size={18} />
        </button>
      ) : null}
      <div class="grip" />
      <div class="sheet-body">{children}</div>
      {actions ? <div class="sheet-actions">{actions}</div> : null}
    </div>
  );
  return (
    <>
      <div class="backdrop" onClick={onClose} />
      {aside ? (
        <div class="sheet-stage">
          {aside}
          {sheet}
        </div>
      ) : (
        sheet
      )}
    </>
  );
}

/** A pop-up: a card drawn like the Chiikawa line art (see .ink-card) in the middle of the screen over a dimmed
 *  backdrop, with what it is about on a name plate across its top. */
export function Dialog({
  title,
  onClose,
  children,
  class: extra,
}: {
  title?: string;
  onClose?: () => void;
  children: ComponentChildren;
  class?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  usePopUpKeys(ref, onClose);
  return (
    <>
      <div class="backdrop dialog-backdrop" onClick={onClose} />
      <div ref={ref} tabIndex={-1} class={extra ? `dialog ${extra}` : 'dialog'} role="dialog" aria-modal="true" aria-label={title}>
        <div class={title ? 'ink-card dialog-card titled' : 'ink-card dialog-card'}>
          {title ? (
            <div class="ink-plate dialog-plate">
              <PlatePaper />
              <span class="plate-words">{title}</span>
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </>
  );
}

export const confirmState = signal<{ text: string; onYes: () => void; title?: string; yes?: string; danger?: boolean } | null>(null);

/** Ask a yes/no question. `title` names what it is about (the thing to buy, the button pressed) on the pop-up's plate. */
export function confirm(text: string, onYes: () => void, opts: { title?: string; yes?: string; danger?: boolean } = {}): void {
  confirmState.value = { text, onYes, ...opts };
}

export function ConfirmHost() {
  const c = confirmState.value;
  const close = () => (confirmState.value = null);
  // While a question is up, the system back gesture answers no (closes it) instead of leaving the screen under it.
  useLayoutEffect(() => (c ? closeOnBack(close) : undefined), [c]);
  if (!c) return null;
  return (
    <Dialog title={c.title} onClose={close}>
      <p class="dialog-text">{c.text}</p>
      <div class="dialog-actions">
        <button class="btn grow" onClick={tap(close, 'sfx_cancel')}>
          {t('common.cancel')}
        </button>
        <button
          class={`btn grow ${c.danger ? 'danger' : 'primary'}`}
          onClick={tap(() => {
            close();
            c.onYes();
          })}
        >
          {c.yes ?? t('common.yes')}
        </button>
      </div>
    </Dialog>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button class={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={tap(() => onChange(!on))} />;
}

