// How long a character's moves take (owner's call, 2026-11-06: the frames ran too quick, and bigger ones should move
// slower, giants slowest of all, their blows long and heavy). The sim times an enemy's swing and fall from here, and
// the renderer plays its frames at the same pace.

import { ATTACK_RELEASE_MS, COLLAPSE_MS, FADE_MS } from './constants';
import type { EnemyAbility, EnemyDef, SizeTier } from './types';

/** How many times longer than a small one's each move of a character takes, by size; giants are slowest. */
export const TEMPO: Record<SizeTier | 'giant', number> = { S: 1, M: 1.15, L: 1.3, XL: 1.5, giant: 1.9 };

/** 六足の虫's jump, in its three parts (owner's call, 2026-11-07: over a friend in 0.7 s it was unfair): getting ready
 *  where it is, in the air over the friend's tile, landing and steadying itself (ms). */
export interface JumpParts {
  readyMs: number;
  airMs: number;
  landMs: number;
}

/** How long a jump takes in all (ms). */
export function jumpMsOf(j: JumpParts): number {
  return j.readyMs + j.airMs + j.landMs;
}

/** Where the jumper is `el` ms into its jump: getting ready ('ready'), in the air ('air', `k` of the way over), or
 *  landed and steadying itself ('land'); `k` runs from 0 to 1 through each part. */
export function jumpAt(j: JumpParts, el: number): { phase: 'ready' | 'air' | 'land'; k: number } {
  if (el < j.readyMs) return { phase: 'ready', k: Math.max(0, el) / Math.max(1, j.readyMs) };
  if (el < j.readyMs + j.airMs) return { phase: 'air', k: (el - j.readyMs) / Math.max(1, j.airMs) };
  return { phase: 'land', k: Math.min(1, (el - j.readyMs - j.airMs) / Math.max(1, j.landMs)) };
}

/** A character's tempo (`form` 'true': ちいかぶ's big true form, which moves like an XL one). */
export function tempoOf(def: { size: SizeTier; giant?: boolean }, form?: string): number {
  if (def.giant) return TEMPO.giant;
  return TEMPO[form === 'true' ? 'XL' : def.size] ?? 1;
}

/** A small enemy's swing (ms); bigger ones take longer by their tempo. */
const SWING_MS = 640;
/** How far through its swing an enemy's blow lands, unless its data says otherwise. */
const HIT_AT = 0.5;

/** How an enemy swings: when its blow lands and when the swing is over (ms from the swing's start, before any
 *  slowing). Swings come the interval plus 220 ms apart (see Sim.engage), and one always ends before the next.
 *  `interval`: its time between swings, when that is not its attack's (キメラ with her claws out: attackIntervalOf). */
export function swingOf(def: EnemyDef, form?: string, interval = def.attack.intervalMs ?? 1000): { hitMs: number; swingMs: number } {
  const swing = Math.min(def.attack.swingMs ?? SWING_MS * tempoOf(def, form), interval + ATTACK_RELEASE_MS - 60);
  return { hitMs: Math.round(swing * (def.attack.hitAt ?? HIT_AT)), swingMs: Math.round(swing) };
}

/** キメラ's claws, if it has them: hidden at first; hurt low enough, she stops to draw them, then walks and swings faster. */
export function clawsOf(def: EnemyDef): Extract<EnemyAbility, { kind: 'claws' }> | undefined {
  return def.abilities.find((a): a is Extract<EnemyAbility, { kind: 'claws' }> => a.kind === 'claws');
}

/** How long an enemy waits between swings (ms, before the 220 ms release): its attack's interval, or a share of it
 *  once キメラ has her claws out (she swings `attackSpeedMul` times as often from then on). */
export function attackIntervalOf(e: { def: EnemyDef; form?: string }): number {
  const interval = e.def.attack.intervalMs ?? 1000;
  const claws = e.form === 'claws' ? clawsOf(e.def) : undefined;
  return claws ? interval / claws.attackSpeedMul : interval;
}

/** How many times its speed an enemy walks: 1, or `moveSpeedMul` once キメラ has her claws out (owner's call,
 *  2026-11-07). */
export function moveSpeedMulOf(e: { def: EnemyDef; form?: string }): number {
  const claws = e.form === 'claws' ? clawsOf(e.def) : undefined;
  return claws ? claws.moveSpeedMul : 1;
}

/** A boss falls this many times slower again (owner's call, 2026-11-06): its fall is the end of the job. */
export const BOSS_FALL = 2;
/** A small enemy's fall (ms): its death frames play over this, while it fades. */
const DEATH_MS = 560;

/** How long an enemy takes to fall and fade away before it is gone (ms). */
export function fallMsOf(def: { size: SizeTier; giant?: boolean }, form?: string, boss = false): number {
  return Math.round((COLLAPSE_MS + FADE_MS) * tempoOf(def, form) * (boss ? BOSS_FALL : 1));
}

/** How long an enemy's death frames take to play (ms), inside its fall. */
export function deathMsOf(def: { size: SizeTier; giant?: boolean }, form?: string, boss = false): number {
  return Math.round(DEATH_MS * tempoOf(def, form) * (boss ? BOSS_FALL : 1));
}

/** How long a called-up enemy takes to come up (ms; セイレーン's followers): a small one's, its spawn frames played once
 *  over it (bigger ones by their tempo); it walks on after. */
const SPAWN_MS = 900;

/** How long one called up takes to come up (ms). */
export function spawnMsOf(def: { size: SizeTier; giant?: boolean }, form?: string): number {
  return Math.round(SPAWN_MS * tempoOf(def, form));
}

/** A heal pulse's whole animation (ms): it spreads out from the middle of whoever heals, and fades. */
export const HEAL_PULSE_MS = 700;
/** 古本屋's smaller pulse each time it heals its neighbours (ms; it heals every second). */
export const HEAL_PULSE_SMALL_MS = 480;
/** How long a healed mark (「＋HP」) shows over each one healed (ms): only a moment. */
export const HEALED_MARK_MS = 650;

/** How long an enemy that heals around it (黒い星) stops each time to do it (ms): the sim keeps it still this long, and
 *  its heal frames play over it. Long enough for its pulse to be over before it moves on (owner's call, 2026-11-07). */
export function healPauseOf(def: EnemyDef): number {
  const ab = def.abilities.find((a) => a.kind === 'heal_aura');
  return ab && ab.kind === 'heal_aura' ? (ab.pauseMs ?? 0) : 0;
}

/** How long a timed enemy ability goes on once used, before its cooldown starts (owner's call, 2026-11-07: a cooldown
 *  starts when its ability is over): 黒い星's stop, 擬態型's song (as long as it holds friends), 山姥's spell until her
 *  hold wears off (however long her chant), and セイレーン's call (her stop to sing). */
export function abilityBusyMs(ab: EnemyAbility): number {
  if (ab.kind === 'heal_aura') return ab.pauseMs ?? 0;
  if (ab.kind === 'song') return ab.durationMs;
  if (ab.kind === 'spell') return Math.max(ab.castMs, ab.freezeMs);
  if (ab.kind === 'summon') return ab.castMs;
  return 0;
}

/** From one use of a timed enemy ability to the next when nothing holds it up: it goes on, then cools down. */
export function abilityCycleMs(ab: Extract<EnemyAbility, { kind: 'heal_aura' | 'song' | 'spell' | 'summon' }>): number {
  return abilityBusyMs(ab) + ab.cooldownMs;
}
