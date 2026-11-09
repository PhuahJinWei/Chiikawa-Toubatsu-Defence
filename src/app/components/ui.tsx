import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { art } from '../../art/store';
import { audio } from '../../audio/audio';
import { t } from '../../i18n/i18n';
import { save } from '../../save/save';
import { closeOnBack } from '../router';
import { Icon } from './Icon';
import { PlatePaper } from './Plate';

// ---------------------------------------------------------------- toast

export const toastMsg = signal<{ key: number; text: string } | null>(null);
let toastTimer = 0;

export function toast(text: string): void {
  toastMsg.value = { key: Date.now(), text };
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastMsg.value = null), 1800);
}

export function Toast() {
  const m = toastMsg.value;
  return m ? (
    <div class="toast" key={m.key} role="status">
      {m.text}
    </div>
  ) : null;
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

/** A pop-up panel: a line-art card (like .ink-card) in the middle of the screen over a dimmed backdrop, its name on a
 *  plate across its top when it has a `title` (`tone` is the plate's colour). */
export function Sheet({
  onClose,
  children,
  actions,
  label,
  title,
  tone,
}: {
  onClose?: () => void;
  children: ComponentChildren;
  actions?: ComponentChildren;
  label?: string;
  title?: string;
  tone?: string;
}) {
  return (
    <>
      <div class="backdrop" onClick={onClose} />
      <div class={title ? 'sheet titled' : 'sheet'} role="dialog" aria-modal="true" aria-label={label ?? title}>
        {title ? (
          <div class="ink-plate sheet-plate" style={tone ? { '--plate': tone } : undefined}>
            <PlatePaper />
            {title}
          </div>
        ) : null}
        <div class="grip" />
        <div class="sheet-body">{children}</div>
        {actions ? <div class="sheet-actions">{actions}</div> : null}
      </div>
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
  return (
    <>
      <div class="backdrop" onClick={onClose} />
      <div class={extra ? `dialog ${extra}` : 'dialog'} role="dialog" aria-modal="true" aria-label={title}>
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

export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <span class="stars" aria-label={`${n}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} class={i < n ? '' : 'off'}>
          ★
        </span>
      ))}
    </span>
  );
}
