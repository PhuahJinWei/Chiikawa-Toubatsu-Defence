import type { Mood } from './kit';

/** Everything a subject drawer needs to know about the current frame. */
export interface Pose {
  anim: string;
  frame: number;
  frames: number;
  /** Vertical offset, negative = up (unit scale). */
  bob: number;
  /** Vertical scale around the feet. */
  squash: number;
  /** Horizontal sway. */
  sway: number;
  /** Walk leg phase, -1..1. */
  legs: number;
  /** Item / strike extension, 0..1. */
  extend: number;
  /** Arm raise, 0..1. */
  armUp: number;
  /** Collapse progress, 0..1. */
  fallen: number;
  /** Glow amount, 0..1. */
  glow: number;
  /** Damage state 0..3 (walls). */
  damaged: number;
  mood: Mood | null;
  mouthOpen: boolean;
  /** True for the release / impact frame. */
  impact: boolean;
}

const pick = <T,>(arr: T[], i: number): T => arr[Math.max(0, Math.min(arr.length - 1, i))];

export function poseFor(anim: string, frame: number, frames: number): Pose {
  const p: Pose = {
    anim,
    frame,
    frames,
    bob: 0,
    squash: 1,
    sway: 0,
    legs: 0,
    extend: 0,
    armUp: 0,
    fallen: 0,
    glow: 0,
    damaged: 0,
    mood: null,
    mouthOpen: false,
    impact: false,
  };
  switch (anim) {
    case 'idle':
    case 'parked':
      p.bob = pick([0, 2, 0, -2], frame);
      p.squash = pick([1, 0.97, 1, 1.02], frame);
      break;
    case 'walk':
      p.legs = pick([0, 1, 0.5, 0, -1, -0.5], frame);
      p.bob = pick([0, -4, -2, 0, -4, -2], frame);
      p.sway = pick([0, 2.5, 1, 0, -2.5, -1], frame);
      break;
    case 'attack':
      p.extend = pick([0.15, 0, 1, 0.35], frame);
      p.armUp = pick([0.3, 1, 0.6, 0.2], frame);
      p.squash = pick([1, 0.95, 1.05, 1], frame);
      p.impact = frame === 2;
      p.mouthOpen = frame === 2;
      break;
    case 'spawn':
      // Coming up out of the ground when セイレーン calls.
      p.bob = pick([40, 26, 12, 0], frame);
      p.squash = pick([0.7, 0.85, 1.05, 1], frame);
      break;
    case 'collapse':
      p.fallen = pick([0.22, 0.5, 0.8, 1], frame);
      p.mood = frame >= 1 ? 'closed' : 'wince';
      break;
    case 'pull':
      p.squash = pick([0.9, 0.88, 1.04, 1.0], frame);
      p.armUp = pick([0.1, 0.25, 0.7, 1], frame);
      p.extend = pick([0, 0.2, 0.7, 1], frame);
      p.mood = frame >= 3 ? 'happy' : null;
      break;
    case 'song':
      p.sway = pick([-5, 0, 5, 0], frame);
      p.mouthOpen = true;
      p.mood = 'happy';
      break;
    case 'float':
      p.bob = pick([-5, 0, 5, 0], frame);
      break;
    case 'heal':
      p.glow = pick([0.3, 0.8, 1, 0.4], frame);
      break;
    case 'transform':
      p.sway = pick([-3, 3, -2, 2, 0, 0], frame);
      p.glow = pick([0, 0.25, 0.7, 1, 0.6, 0.2], frame);
      break;
    case 'damaged1':
      p.damaged = 1;
      break;
    case 'damaged2':
      p.damaged = 2;
      break;
    case 'damaged3':
      p.damaged = 3;
      break;
    default:
      break;
  }
  return p;
}
