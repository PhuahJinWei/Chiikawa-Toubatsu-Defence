// QA helpers, available in dev builds or with ?debug in the URL. Not shown anywhere in the UI.

import type { BattleController } from './game/controller';
import { LEVEL_LIST, UNIT_LIST } from './game/sim/defs';
import { STEP_MS } from './game/sim/constants';
import { save, updateSave } from './save/save';
import { go } from './app/router';

declare global {
  interface Window {
    __ctd?: Record<string, unknown>;
    __ctdBattle?: BattleController;
  }
}

export function installDebug(): void {
  window.__ctd = {
    save,
    go,
    /** Clear every level with 3 stars and unlock everything. */
    unlockAll() {
      updateSave((d) => {
        for (const l of LEVEL_LIST) d.cleared[l.id] = { stars: 3, clears: 1 };
        d.cards = UNIT_LIST.map((u) => u.id);
        d.features = { endless: true, speed: true };
      });
    },
    /** Clear levels up to (not including) an id, e.g. upTo('2-1'). */
    upTo(id: string) {
      updateSave((d) => {
        for (const l of LEVEL_LIST) {
          if (l.id === id) break;
          d.cleared[l.id] = { stars: 3, clears: 1 };
          if (l.rewards.unlockCard && !d.cards.includes(l.rewards.unlockCard)) d.cards.push(l.rewards.unlockCard);
          for (const f of l.rewards.unlockFeatures ?? []) (d.features as Record<string, boolean>)[f] = true;
        }
      });
    },
    money(n = 10000) {
      updateSave((d) => {
        d.money += n;
      });
    },
    weeds(n = 1000) {
      const b = window.__ctdBattle;
      if (b) b.sim.weeds += n;
    },
    /** Fast-forward the current battle by n seconds of game time. */
    skip(seconds = 10) {
      window.__ctdBattle?.debugAdvance(seconds * 1000);
    },
    /** Defeat every enemy on the field and every pending wave. */
    win() {
      const b = window.__ctdBattle;
      if (!b) return;
      for (let i = 0; i < 20000 && b.sim.status === 'playing'; i++) {
        for (const e of b.sim.enemies) if (e.state !== 'collapse') b.sim.damageEnemy(e, 1e6, 'debug', 'fx_hit', true);
        b.debugAdvance(STEP_MS, false);
      }
      b.debugAdvance(0);
    },
  };
}
