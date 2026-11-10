import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { DEV_MODE } from '../../dev';
import { lang, setLang, t } from '../../i18n/i18n';
import { applyImported, exportCode, importCode, resetSave, save, storageOk, updateSave } from '../../save/save';
import { Icon } from '../components/Icon';
import { PlatePaper } from '../components/Plate';
import { confirm, Sheet, Switch, tap, toast, usePopUpKeys } from '../components/ui';
import { installState, promptInstall } from '../install';
import { payOwedFriends } from '../progress';
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
  const [sheet, setSheet] = useState<'records' | 'export' | 'import' | 'reset' | 'about' | null>(null);
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
  // Focus comes in and stays in (its own Escape, above, closes it or the sheet over it).
  const box = useRef<HTMLDivElement>(null);
  usePopUpKeys(box);
  return (
    <>
      <div class="backdrop" onClick={onClose} />
      <div ref={box} tabIndex={-1} class="sheet titled settings-dialog" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
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
                        aria-pressed={lang.value === l}
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
                <button class="list-item" onClick={tap(() => setSheet('records'))}>
                  <Icon name="trophy" />
                  <span class="label">{t('settings.records')}</span>
                </button>
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
              {!storageOk.value ? <p class="small bold" style={{ color: '#b33a30' }}>⚠ {t('settings.storageOff')}</p> : null}
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
                  <div class="label">
                    {t('settings.about')}
                    <div class="desc">{t('settings.version', { v: `${__APP_VERSION__} (${__APP_BUILD__})` })}</div>
                  </div>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
      {sheet === 'records' ? <RecordsSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'export' ? <ExportSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'import' ? <ImportSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'reset' ? <ResetSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'about' ? (
        <Sheet onClose={() => setSheet(null)} title={t('app.title')} tone={TONE} closer>
          <div class="stack" style={{ gap: '10px' }}>
            <p class="small" style={{ lineHeight: 1.7 }}>
              {t('app.disclaimer')}
            </p>
            <p class="small muted">{t('settings.credits')}</p>
            <p class="tiny faint">{t('settings.version', { v: `${__APP_VERSION__} (${__APP_BUILD__})` })}</p>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

/** What the save keeps count of: jobs done and failed, 草 gathered, enemies beaten, time played, and since when. */
function RecordsSheet({ onClose }: { onClose: () => void }) {
  const d = save.value;
  const minutes = Math.floor(d.stats.playMs / 60000);
  const since = new Date(d.createdAt);
  const rows: [string, string][] = [
    [t('records.wins'), d.stats.wins.toLocaleString()],
    [t('records.losses'), d.stats.losses.toLocaleString()],
    [t('records.weeds'), d.stats.weeds.toLocaleString()],
    [t('records.defeated'), d.stats.defeated.toLocaleString()],
    [t('records.playTime'), t('records.time', { h: Math.floor(minutes / 60), m: minutes % 60 })],
    [t('records.since'), Number.isNaN(since.getTime()) ? '—' : since.toLocaleDateString(lang.value === 'ja' ? 'ja-JP' : 'en-GB')],
  ];
  return (
    <Sheet onClose={onClose} title={t('settings.records')} tone={TONE} closer>
      <div class="list">
        {rows.map(([k, v]) => (
          <div key={k} class="list-item">
            <span class="label">{k}</span>
            <span class="bold">{v}</span>
          </div>
        ))}
      </div>
    </Sheet>
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
      closer
      actions={
        <button class="btn primary block" onClick={tap(copy)}>
          <Icon name="copy" /> {t('common.copy')}
        </button>
      }
    >
      <div class="stack" style={{ gap: '10px' }}>
        <p class="small muted">{t('settings.exportDesc')}</p>
        <textarea class="field-input" readOnly value={code} aria-label={t('settings.export')} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
      </div>
    </Sheet>
  );
}

function ImportSheet({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const apply = () => {
    const read = importCode(code, lang.value);
    if ('error' in read) {
      toast(t(read.error === 'newer' ? 'settings.importNewer' : 'settings.importBad'), 'bad');
      return;
    }
    const d = read.save;
    // Everything is replaced: say what is coming in, and ask first.
    confirm(
      t('settings.importConfirm', { jobs: Object.keys(d.cleared).length, money: d.money.toLocaleString() }),
      () => {
        const saved = applyImported(d);
        payOwedFriends();
        setLang(d.settings.lang);
        toast(t(saved ? 'settings.importOk' : 'settings.saveFailed'), saved ? 'ok' : 'bad');
        onClose();
      },
      { title: t('settings.import'), yes: t('common.apply') },
    );
  };
  return (
    <Sheet
      onClose={onClose}
      title={t('settings.import')}
      tone={TONE}
      closer
      actions={
        <button class="btn primary block" disabled={!code.trim()} onClick={tap(apply)}>
          {t('common.apply')}
        </button>
      }
    >
      <div class="stack" style={{ gap: '10px' }}>
        <textarea class="field-input" placeholder={t('settings.importPlaceholder')} aria-label={t('settings.importPlaceholder')} value={code} onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)} />
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
      closer
      actions={
        <button
          class="btn danger block"
          disabled={!ok}
          onClick={tap(() => {
            const saved = resetSave();
            toast(t(saved ? 'settings.resetDone' : 'settings.saveFailed'), saved ? 'ok' : 'bad');
            onClose();
            closeSettings();
          })}
        >
          {t('settings.reset')}
        </button>
      }
    >
      <div class="stack" style={{ gap: '10px' }}>
        <p id="reset-desc" class="small muted">
          {t('settings.resetDesc')}
        </p>
        <input
          class="field-input"
          value={word}
          placeholder={t('settings.resetWord')}
          aria-label={t('settings.reset')}
          aria-describedby="reset-desc"
          onInput={(e) => setWord((e.target as HTMLInputElement).value)}
        />
      </div>
    </Sheet>
  );
}
