// A collected 草's flight to the counter. The counter is part of the page, above the game's canvas, so the flight is a
// page element of its own: drawn on the canvas it would go under the counter and never be seen to arrive.

import { easeInOut } from './view';

/** How long a picked weed is tugged at on the ground before it flies (ms of game time). */
export const WEED_TUG_MS = 110;
/** How long it flies (ms). */
export const WEED_FLIGHT_MS = 420;
/** How far the flight bows upward, as a share of its length. */
const ARC = 0.06;
const STEPS = 16;

interface Pt {
  x: number;
  y: number;
}

export interface FlightFrame extends Pt {
  /** How wide it is there. */
  size: number;
}

/** The flight from one point to another, step by step: where its centre is and how wide it is. */
export function flightFrames(from: Pt, to: Pt, fromSize: number, toSize: number): FlightFrame[] {
  const arc = Math.hypot(to.x - from.x, to.y - from.y) * ARC;
  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const k = i / STEPS;
    const e = easeInOut(k);
    return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e - Math.sin(k * Math.PI) * arc, size: fromSize + (toSize - fromSize) * e };
  });
}

/** What flies, and from where. */
export interface Takeoff extends Pt {
  /** The 草 icon as a sticker. Its centre starts at (x, y), in client coordinates. */
  pic: HTMLCanvasElement;
  /** How wide the sticker is as it takes off (CSS px). */
  size: number;
  /** The sticker's width per width of the plant in it: the white edge is extra. */
  edge: number;
}

interface Flight {
  timer: number;
  el?: HTMLElement;
}

/** The 草 on their way to the counter. */
export class WeedFlights {
  /** How much 草 is in the air: the player's to spend already, but not on the counter yet. */
  inAir = 0;
  private live = new Set<Flight>();

  /** Sends `value` 草 to the counter in `root`, after `delay` ms. `onLand` runs as it lands. */
  launch(root: HTMLElement, from: Takeoff, value: number, delay: number, onLand: () => void): void {
    const flight: Flight = { timer: 0 };
    this.live.add(flight);
    this.inAir += value;
    const land = (): void => {
      flight.el?.remove();
      this.live.delete(flight);
      this.inAir -= value;
      onLand();
    };
    const fly = (): void => {
      // Measured as it takes off: where the badge is depends on the screen (notches, and big screens draw it larger).
      const icon = root.querySelector('.weeds-pill .dot .icon');
      if (!icon) {
        land();
        return;
      }
      const page = root.getBoundingClientRect();
      const badge = icon.getBoundingClientRect();
      const toSize = badge.width * from.edge;
      const base = Math.max(from.size, toSize);
      const frames = flightFrames(
        { x: from.x - page.left, y: from.y - page.top },
        { x: badge.left + badge.width / 2 - page.left, y: badge.top + badge.height / 2 - page.top },
        from.size,
        toSize,
      );
      const el = document.createElement('canvas');
      el.className = 'weed-flight';
      el.width = from.pic.width;
      el.height = from.pic.height;
      el.getContext('2d')?.drawImage(from.pic, 0, 0);
      el.style.width = el.style.height = `${base}px`;
      root.appendChild(el);
      flight.el = el;
      el.animate(
        frames.map((f) => ({ transform: `translate(${f.x - base / 2}px, ${f.y - base / 2}px) scale(${f.size / base})` })),
        { duration: WEED_FLIGHT_MS, easing: 'linear', fill: 'both' },
      );
      flight.timer = window.setTimeout(land, WEED_FLIGHT_MS);
    };
    if (delay > 0) flight.timer = window.setTimeout(fly, delay);
    else fly();
  }

  /** The battle is over: nothing lands any more. */
  clear(): void {
    for (const f of this.live) {
      window.clearTimeout(f.timer);
      f.el?.remove();
    }
    this.live.clear();
    this.inAir = 0;
  }
}
