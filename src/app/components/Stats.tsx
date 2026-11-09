// A friend's numbers in words, as little chips: in the gallery book and on the job notice's details card. Enemies have
// none: their raw numbers stay hidden (owner's call), and their ability line says what they do.

import { UNITS } from '../../game/sim/defs';
import { t } from '../../i18n/i18n';
import { Icon } from './Icon';

/** A friend's numbers (cost, HP, attack, how often, reach, recharge); none for an enemy. 星's are the wished-for
 *  friend's, so it shows only that, and how soon it turns into them. */
export function statsOf(id: string): { k: string; v: string; icon?: string }[] {
  const stats: { k: string; v: string; icon?: string }[] = [];
  const unit = UNITS[id];
  if (unit?.wish) {
    stats.push({ k: t('stat.cost'), v: t('stat.sameAsWish'), icon: 'leaf' });
    stats.push({ k: t('stat.wishTime'), v: t('stat.seconds', { n: (unit.wish.transformMs / 1000).toFixed(1) }), icon: 'star' });
  } else if (unit) {
    stats.push({ k: t('stat.cost'), v: String(unit.cost), icon: 'leaf' });
    const once = unit.oneUse;
    if (once) {
      // A one-use card: what it does, where, and how long until it can be used again.
      if (once.kind === 'charge') {
        stats.push({ k: t('stat.effect'), v: t('stat.effectCharge'), icon: 'star' });
        stats.push({ k: t('stat.range'), v: t('stat.rangeLane') });
      } else {
        stats.push({ k: t('stat.effect'), v: t('stat.effectFreeze', { s: (once.freezeMs / 1000).toFixed(1) }), icon: 'star' });
        stats.push({ k: t('stat.range'), v: t('stat.rangeField') });
      }
      stats.push({ k: t('stat.cooldown'), v: t('stat.seconds', { n: (unit.cooldownMs / 1000).toFixed(1) }) });
      return stats;
    }
    stats.push({ k: t('stat.hp'), v: String(unit.hp), icon: 'heart' });
    const help = unit.support;
    if (help?.kind === 'aura_attackspeed') stats.push({ k: t('stat.boost'), v: `×${help.mul}`, icon: 'fast' });
    // A trap (たい焼き): how hard it goes off, how long it takes to cook, and that it goes off where it stands.
    if (unit.mine) {
      stats.push({ k: t('stat.damage'), v: String(unit.mine.damage), icon: 'star' });
      stats.push({ k: t('stat.ready'), v: t('stat.seconds', { n: (unit.mine.readyMs / 1000).toFixed(1) }) });
      stats.push({ k: t('stat.range'), v: t('stat.rangeTouch') });
    }
    if (unit.attack.kind !== 'none') {
      // A volley (古本屋): each shot's damage, times how many.
      const volley = unit.attack.volley ?? 1;
      stats.push({ k: t('stat.damage'), v: volley > 1 ? t('stat.damageTimes', { n: unit.attack.damage ?? 0, k: volley }) : String(unit.attack.damage), icon: 'star' });
      stats.push({ k: t('stat.interval'), v: t('stat.seconds', { n: ((unit.attack.intervalMs ?? 0) / 1000).toFixed(1) }) });
      const reach = unit.attack.rangeTiles;
      // うさぎ（クール）'s missiles fall on every lane.
      const lanes = unit.attack.kind === 'missiles';
      stats.push({ k: t('stat.range'), v: lanes ? t('stat.rangeAllLanes') : reach === undefined ? t('stat.rangeLane') : reach === 0 ? t('stat.rangeTouch') : t('stat.rangeTiles', { n: reach }) });
      // A shot that goes through everyone in the lane (フタバ's shells).
      if (unit.attack.passThrough) stats.push({ k: t('stat.targets'), v: t('stat.targetsAll') });
      // A blow goes through everyone it reaches, in the lanes either side too for a sweep (ラッコ's sword).
      const sweep = unit.attack.sweepLanes;
      if (sweep) stats.push({ k: t('stat.targets'), v: t('stat.targetsSweep', { n: 2 * sweep + 1 }) });
      else if (unit.attack.kind === 'hitscan') stats.push({ k: t('stat.targets'), v: t('stat.targetsReach') });
      // A missile's blast: everyone round where it lands.
      if (lanes) stats.push({ k: t('stat.targets'), v: t('stat.targetsBlast') });
      // A jab that pushes back (ハチワレ（パジャマ）).
      if (unit.attack.pushTiles) stats.push({ k: t('stat.push'), v: t('stat.rangeTiles', { n: unit.attack.pushTiles }) });
    }
    stats.push({ k: t('stat.cooldown'), v: t('stat.seconds', { n: (unit.cooldownMs / 1000).toFixed(1) }) });
  }
  return stats;
}

/** The numbers as chips, each on a dashed outline with its icon (nothing at all for an enemy). */
export function StatChips({ id }: { id: string }) {
  if (!statsOf(id).length) return null;
  return (
    <div class="stat-chips">
      {statsOf(id).map((s) => (
        <span key={s.k} class="stat-chip">
          {s.icon ? <Icon name={s.icon} size={12} /> : null}
          {s.k}
          <b>{s.v}</b>
        </span>
      ))}
    </div>
  );
}
