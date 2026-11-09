import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { DEV_MODE } from '../../dev';
import { lang, setLang, t } from '../../i18n/i18n';
import { applyImported, exportCode, importCode, resetSave, save, storageOk, updateSave } from '../../save/save';
import { Icon } from '../components/Icon';
import { PlatePaper } from '../components/Plate';
import { Sheet, Switch, tap, toast } from '../components/ui';
import { installState, promptInstall } from '../install';
import { closeOnBack, go, route, up } from '../router';

/** The settings panels' plates are light blue, like the plate on the lobby's 「設定」 button. */
const TONE = '#CDE3F5';

/** The settings pop-up: a panel over the lobby (from 設定), not a screen of its own, but a step of its own (`settings` on
 *  the lobby's route), so the system back gesture closes it, and coming back from the Art Kit finds it open again. */
export function SettingsHost() {
  const r = route.value;
  return r.name === 'lobby' && r.settings ? <SettingsDialog onClose={closeSettings} /> : null;
}

/** Open the settings pop-up over the lobby. */
export function openSettings(): void {
  go({ name: 'lobby', settings: true });
}

function closeSettings(): void {
  up({ name: 'lobby' });
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = save.value.settings;
  const [sheet, setSheet] = useState<'export' | 'import' | 'reset' | 'about' | null>(null);
  // The system back gesture closes a sheet open on top of the pop-up first (the pop-up itself is a route step).
  useLayoutEffect(() => (sheet ? closeOnBack(() => setSheet(null)) : undefined), [sheet]);
  // Escape closes the pop-up (or first the sheet open on top of it, which handles its own backdrop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (sheet) setSheet(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);
  const set = (fn: (d: typeof s) => void) =>
    updateSave((d) => {
      fn(d.settings);
    });
  return (
    <>
      <div class="backdrop" onClick={onClose} />
      <div class="sheet titled settings-dialog" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
        <h2 class="ink-plate sheet-plate" style={{ '--plate': TONE }}>
          <PlatePaper />
          <Icon name="gear" /> {t('settings.title')}
        </h2>
        <button type="button" class="card-x" aria-label={t('common.close')} onClick={tap(onClose, 'sfx_cancel')}>
          <Icon name="close" size={18} />
        </button>
        <div class="sheet-body">
          <div class="cols">
            <section class="group">
              <div class="list">
                <div class="list-item">
                  <Icon name="globe" />
                  <span class="label">{t('settings.language')}</span>
                  <div class="segmented">
                    {(['ja', 'en'] as const).map((l) => (
                      <button
                        key={l}
                        class={lang.value === l ? 'on' : ''}
                        onClick={tap(() => {
                          setLang(l);
                          set((d) => (d.lang = l));
                        })}
                      >
                        {l === 'ja' ? '日本語' : 'English'}
                      </button>
                    ))}
                  </div>
                </div>
                <label class="list-item">
                  <Icon name="sound" />
                  <span class="label">{t('settings.bgm')}</span>
                  <input type="range" min={0} max={1} step={0.05} value={s.bgm} style={{ maxWidth: '46%' }} onInput={(e) => set((d) => (d.bgm = Number((e.target as HTMLInputElement).value)))} />
                </label>
                <label class="list-item">
                  <Icon name="sound" />
                  <span class="label">{t('settings.sfx')}</span>
                  <input type="range" min={0} max={1} step={0.05} value={s.sfx} style={{ maxWidth: '46%' }} onInput={(e) => set((d) => (d.sfx = Number((e.target as HTMLInputElement).value)))} />
                </label>
              </div>
            </section>

            <section class="group">
              <h2 class="section-title">{t('settings.gameplay')}</h2>
              <div class="list">
                <div class="list-item">
                  <span class="label">{t('settings.autoCollect')}</span>
                  <Switch on={s.autoCollect} onChange={(v) => set((d) => (d.autoCollect = v))} label={t('settings.autoCollect')} />
                </div>
                <div class="list-item">
                  <span class="label">{t('settings.reducedMotion')}</span>
                  <Switch on={s.reducedMotion} onChange={(v) => set((d) => (d.reducedMotion = v))} label={t('settings.reducedMotion')} />
                </div>
              </div>
            </section>

            {/* The art tools are for making the game, so only dev mode (?dev) shows them. */}
            {DEV_MODE ? (
              <section class="group">
                <h2 class="section-title">{t('settings.art')}</h2>
                <div class="list">
                  <div class="list-item">
                    <div class="label">
                      {t('settings.guides')}
                      <div class="desc">{t('settings.guidesDesc')}</div>
                    </div>
                    <Switch on={s.guides} onChange={(v) => set((d) => (d.guides = v))} label={t('settings.guides')} />
                  </div>
                  <button
                    class="list-item"
                    onClick={tap(() => go({ name: 'artkit' }))}
                  >
                    <Icon name="image" />
                    <div class="label">
                      {t('settings.artkit')}
                      <div class="desc">{t('settings.artkitDesc')}</div>
                    </div>
                    <Icon name="next" size={18} />
                  </button>
                </div>
              </section>
            ) : null}

            <section class="group">
              <h2 class="section-title">{t('settings.save')}</h2>
              <div class="list">
                <button class="list-item" onClick={tap(() => setSheet('export'))}>
                  <Icon name="upload" />
                  <span class="label">{t('settings.export')}</span>
                </button>
                <button class="list-item" onClick={tap(() => setSheet('import'))}>
                  <Icon name="download" />
                  <span class="label">{t('settings.import')}</span>
                </button>
                <button class="list-item" onClick={tap(() => setSheet('reset'))} style={{ color: '#b33a30' }}>
                  <Icon name="close" />
                  <span class="label">{t('settings.reset')}</span>
                </button>
              </div>
              {!storageOk.value ? <p class="small bold" style={{ color: '#b33a30' }}>⚠ localStorage unavailable — progress will not be kept.</p> : null}
            </section>

            <section class="group">
              <div class="list">
                {installState.value === 'available' ? (
                  <button class="list-item" onClick={tap(promptInstall)}>
                    <Icon name="download" />
                    <span class="label">{t('settings.install')}</span>
                  </button>
                ) : null}
                <button class="list-item" onClick={tap(() => setSheet('about'))}>
                  <Icon name="info" />
                  <span class="label">{t('settings.about')}</span>
                  <span class="small faint">{t('settings.version', { v: __APP_VERSION__ })}</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
      {sheet === 'export' ? <ExportSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'import' ? <ImportSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'reset' ? <ResetSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'about' ? (
        <Sheet onClose={() => setSheet(null)} title={t('app.title')} tone={TONE}>
          <div class="stack" style={{ gap: '10px' }}>
            <p class="small" style={{ lineHeight: 1.7 }}>
              {t('app.disclaimer')}
            </p>
            <p class="small muted">{t('settings.credits')}</p>
            <p class="tiny faint">{t('settings.version', { v: __APP_VERSION__ })}</p>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

function ExportSheet({ onClose }: { onClose: () => void }) {
  const code = exportCode(save.value);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast(t('common.copied'), 'ok');
    } catch {
      toast(code.slice(0, 24) + '…');
    }
  };
  return (
    <Sheet
      onClose={onClose}
      title={t('settings.export')}
      tone={TONE}
      actions={
        <button class="btn primary block" onClick={tap(copy)}>
          <Icon name="copy" /> {t('common.copy')}
        </button>
      }
    >
      <div class="stack" style={{ gap: '10px' }}>
        <p class="small muted">{t('settings.exportDesc')}</p>
        <textarea class="field-input" readOnly value={code} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
      </div>
    </Sheet>
  );
}

function ImportSheet({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const apply = () => {
    const d = importCode(code, lang.value);
    if (!d) {
      toast(t('settings.importBad'), 'bad');
      return;
    }
    applyImported(d);
    setLang(d.settings.lang);
    toast(t('settings.importOk'), 'ok');
    onClose();
  };
  return (
    <Sheet
      onClose={onClose}
      title={t('settings.import')}
      tone={TONE}
      actions={
        <button class="btn primary block" disabled={!code.trim()} onClick={tap(apply)}>
          {t('common.apply')}
        </button>
      }
    >
      <div class="stack" style={{ gap: '10px' }}>
        <textarea class="field-input" placeholder={t('settings.importPlaceholder')} value={code} onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)} />
      </div>
    </Sheet>
  );
}

function ResetSheet({ onClose }: { onClose: () => void }) {
  const [word, setWord] = useState('');
  const ok = word.trim() === t('settings.resetWord');
  return (
    <Sheet
      onClose={onClose}
      title={t('settings.reset')}
      tone="#F6B6B0"
      actions={
        <button
          class="btn danger block"
          disabled={!ok}
          onClick={tap(() => {
            resetSave();
            toast(t('settings.resetDone'), 'ok');
            onClose();
            closeSettings();
          })}
        >
          {t('settings.reset')}
        </button>
      }
    >
      <div class="stack" style={{ gap: '10px' }}>
        <p class="small muted">{t('settings.resetDesc')}</p>
        <input class="field-input" value={word} placeholder={t('settings.resetWord')} onInput={(e) => setWord((e.target as HTMLInputElement).value)} />
      </div>
    </Sheet>
  );
}
