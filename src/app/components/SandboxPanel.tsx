// Dev mode's testing ground (テスト場): the panel on the right of the field. Where (a world's field, Rakko's cars,
// terrain), the rules (free cards, unbeatable friends or enemies, enemies held still), enemies sent on demand (any
// enemy, any lane, from the road or straight onto a column, or a level's wave), time (hold, step, speed), clearing
// up, and a look at whoever is tapped. Nothing here is saved.

import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import type { BattleController } from '../../game/controller';
import { LEVEL_LIST, LEVELS } from '../../game/sim/defs';
import { DEFAULT_DEV_RULES, sandboxEnemies, sandboxWishes, worldHasCars } from '../../game/sim/sandbox';
import type { DevRules, SpawnDef } from '../../game/sim/types';
import { nameOf, t } from '../../i18n/i18n';
import { save, updateSave } from '../../save/save';
import { go, type Route } from '../router';
import { Switch, tap } from './ui';

type BattleRoute = Extract<Route, { name: 'battle' }>;

/** The testing ground's rules, kept for the session: changing the world or the cars builds a new field with them. */
export const SANDBOX_RULES: DevRules = { ...DEFAULT_DEV_RULES };
/** The friend 星 turns into here, kept the same way. */
export const sandboxWish = signal(sandboxWishes()[0]);

const WORLD_IDS = [1, 2, 3, 4, 5, 6];
const SPEEDS = [0.5, 1, 2, 4];
const COUNTS = [1, 2, 3, 5, 10];

export function SandboxPanel({ ctl, r }: { ctl: BattleController; r: BattleRoute }) {
  const [open, setOpen] = useState(true);
  const [, redraw] = useState(0);
  const rules = ctl.devRules ?? SANDBOX_RULES;
  const world = r.world ?? 1;
  const cars = r.cars ?? worldHasCars(world);
  const [enemy, setEnemy] = useState(sandboxEnemies()[0]);
  const [lane, setLane] = useState<string>('random');
  const [where, setWhere] = useState<string>('road');
  const [count, setCount] = useState(1);
  const [levelId, setLevelId] = useState(LEVEL_LIST[0].id);
  const [wave, setWave] = useState(0);
  const tool = ctl.tool.value;

  const rebuild = (patch: Partial<BattleRoute>) => go({ ...r, ...patch, nonce: Date.now() }, { replace: true });
  const flip = (k: keyof DevRules) => (v: boolean) => {
    rules[k] = v;
    redraw((n) => n + 1);
  };
  const wishFor = (id: string) => {
    sandboxWish.value = id;
    ctl.sandboxWish(id);
  };
  const laneOf = (): SpawnDef['lane'] => (lane === 'random' || lane === 'all' ? lane : Number(lane));
  const send = () => {
    const spawns: SpawnDef[] = [{ enemy, count, lane: laneOf() }];
    ctl.sandboxSend(spawns, where === 'road' ? undefined : Number(where));
  };
  const level = LEVELS[levelId];
  const sendWave = () => {
    const w = level?.waves[wave];
    if (w) ctl.sandboxSend(w.spawns);
  };

  // Folded away: a tab in the corner, and the field has the whole screen again.
  if (!open) {
    return (
      <div class="sb-dock">
        <button type="button" class="sb-tab" aria-label={t('sandbox.open')} onClick={tap(() => setOpen(true))}>
          ◂ {t('sandbox.title')}
        </button>
      </div>
    );
  }
  return (
    <div class="sb-dock">
      <aside class="sb-panel" aria-label={t('sandbox.title')}>
        <div class="sb-head">
          <b>{t('sandbox.title')}</b>
          <button type="button" class="sb-x" aria-label={t('sandbox.close')} onClick={tap(() => setOpen(false))}>
            ▸
          </button>
        </div>

        <section>
          <h4>{t('sandbox.field')}</h4>
          <div class="sb-row">
            {WORLD_IDS.map((n) => (
              <button key={n} type="button" class={`sb-btn ${n === world ? 'on' : ''}`} onClick={tap(() => rebuild({ world: n, cars: worldHasCars(n) }))}>
                {n}
              </button>
            ))}
          </div>
          <label class="sb-line">
            <span>{t('sandbox.cars')}</span>
            <Switch on={cars} onChange={(v) => rebuild({ cars: v })} label={t('sandbox.cars')} />
          </label>
          <button type="button" class={`sb-btn wide ${tool === 'terrain' ? 'on' : ''}`} aria-pressed={tool === 'terrain'} onClick={tap(() => ctl.setTool('terrain'))}>
            {t('sandbox.terrain')}
          </button>
          {tool === 'terrain' ? <p class="sb-note">{t('sandbox.terrainHint')}</p> : null}
        </section>

        <section>
          <h4>{t('sandbox.rules')}</h4>
          {(['free', 'safeFriends', 'safeEnemies', 'freeze'] as const).map((k) => (
            <label key={k} class="sb-line">
              <span>{t(`sandbox.${k}`)}</span>
              <Switch on={rules[k]} onChange={flip(k)} label={t(`sandbox.${k}`)} />
            </label>
          ))}
          <button type="button" class="sb-btn wide" onClick={tap(() => ctl.sandboxWeeds(1000))}>
            {t('sandbox.weeds')}
          </button>
        </section>

        <section>
          <h4>{t('sandbox.wish')}</h4>
          <select aria-label={t('sandbox.wish')} value={sandboxWish.value} onChange={(e) => wishFor((e.target as HTMLSelectElement).value)}>
            {sandboxWishes().map((id) => (
              <option key={id} value={id}>
                {nameOf(id)}
              </option>
            ))}
          </select>
        </section>

        <section>
          <h4>{t('sandbox.enemies')}</h4>
          <select aria-label={t('sandbox.enemy')} value={enemy} onChange={(e) => setEnemy((e.target as HTMLSelectElement).value)}>
            {sandboxEnemies().map((id) => (
              <option key={id} value={id}>
                {nameOf(id)}
              </option>
            ))}
          </select>
          <div class="sb-row">
            <select aria-label={t('sandbox.lane')} value={lane} onChange={(e) => setLane((e.target as HTMLSelectElement).value)}>
              <option value="random">{t('sandbox.laneRandom')}</option>
              <option value="all">{t('sandbox.laneAll')}</option>
              {[0, 1, 2, 3, 4].map((l) => (
                <option key={l} value={String(l)}>
                  {t('sandbox.laneN', { n: l + 1 })}
                </option>
              ))}
            </select>
            <select aria-label={t('sandbox.count')} value={String(count)} onChange={(e) => setCount(Number((e.target as HTMLSelectElement).value))}>
              {COUNTS.map((n) => (
                <option key={n} value={String(n)}>
                  ×{n}
                </option>
              ))}
            </select>
          </div>
          <select aria-label={t('sandbox.where')} value={where} onChange={(e) => setWhere((e.target as HTMLSelectElement).value)}>
            <option value="road">{t('sandbox.road')}</option>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
              <option key={c} value={String(c)}>
                {t('sandbox.colN', { n: c + 1 })}
              </option>
            ))}
          </select>
          <button type="button" class="sb-btn wide primary" onClick={tap(send)}>
            {t('sandbox.send')}
          </button>
          <div class="sb-row">
            <select
              aria-label={t('sandbox.level')}
              value={levelId}
              onChange={(e) => {
                setLevelId((e.target as HTMLSelectElement).value);
                setWave(0);
              }}
            >
              {LEVEL_LIST.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id}
                </option>
              ))}
            </select>
            <select aria-label={t('sandbox.wave')} value={String(wave)} onChange={(e) => setWave(Number((e.target as HTMLSelectElement).value))}>
              {(level?.waves ?? []).map((w, i) => (
                <option key={i} value={String(i)}>
                  {t('sandbox.waveN', { n: i + 1 })}
                  {w.boss ? ' 👑' : w.final ? ' ⚑' : w.big ? ' !' : ''}
                </option>
              ))}
            </select>
          </div>
          <button type="button" class="sb-btn wide" onClick={tap(sendWave)}>
            {t('sandbox.sendWave')}
          </button>
        </section>

        <section>
          <h4>{t('sandbox.time')}</h4>
          <div class="sb-row">
            <button type="button" class={`sb-btn ${ctl.hold.value ? 'on' : ''}`} aria-pressed={ctl.hold.value} onClick={tap(() => ctl.setHold(!ctl.hold.value))}>
              {ctl.hold.value ? t('sandbox.run') : t('sandbox.hold')}
            </button>
            <button type="button" class="sb-btn" onClick={tap(() => ctl.stepBy(0))}>
              {t('sandbox.stepFrame')}
            </button>
            <button type="button" class="sb-btn" onClick={tap(() => ctl.stepBy(500))}>
              {t('sandbox.stepHalf')}
            </button>
          </div>
          <div class="sb-row">
            {SPEEDS.map((s) => (
              <button key={s} type="button" class={`sb-btn ${ctl.speed.value === s ? 'on' : ''}`} onClick={tap(() => ctl.setSpeed(s))}>
                ×{s}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h4>{t('sandbox.clean')}</h4>
          <div class="sb-grid">
            <button type="button" class="sb-btn" onClick={tap(() => ctl.sandboxDefeat('enemies'))}>
              {t('sandbox.defeatEnemies')}
            </button>
            <button type="button" class="sb-btn" onClick={tap(() => ctl.sandboxDefeat('friends'))}>
              {t('sandbox.defeatFriends')}
            </button>
            <button type="button" class="sb-btn" onClick={tap(() => ctl.sandboxHeal())}>
              {t('sandbox.healAll')}
            </button>
            <button type="button" class="sb-btn" disabled={!cars} onClick={tap(() => ctl.sandboxCars())}>
              {t('sandbox.carsBack')}
            </button>
          </div>
        </section>

        <section>
          <h4>{t('sandbox.look')}</h4>
          <button type="button" class={`sb-btn wide ${tool === 'inspect' ? 'on' : ''}`} aria-pressed={tool === 'inspect'} onClick={tap(() => ctl.setTool('inspect'))}>
            {t('sandbox.inspect')}
          </button>
          {ctl.inspect.value ? (
            <p class="sb-readout" role="status">
              {ctl.inspect.value}
            </p>
          ) : null}
          <label class="sb-line">
            <span>{t('sandbox.guides')}</span>
            <Switch
              on={save.value.settings.guides}
              onChange={(v) =>
                updateSave((d) => {
                  d.settings.guides = v;
                })
              }
              label={t('sandbox.guides')}
            />
          </label>
        </section>
      </aside>
    </div>
  );
}
