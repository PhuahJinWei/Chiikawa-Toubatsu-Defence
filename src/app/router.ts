import { signal } from '@preact/signals';
import { LEVELS } from '../game/sim/defs';

export type Route =
  /** The lobby. `settings` opens the settings pop-up over it: a step of its own (like a seller in the shop), so the
   *  system back gesture closes it before leaving the lobby, which is always the first page of the game's history. */
  | { name: 'lobby'; settings?: boolean }
  /** The quest board. `focus` brings a paper into view: a world number, or ENDLESS_PAPER. */
  | { name: 'quests'; focus?: number }
  /** A world's quest, picked from the board: its paper and the sheet of its levels. `level` opens that level's job
   *  notice beside the sheet (who is coming, and the team to take). */
  | { name: 'quest'; world: number; level?: string }
  /** A battle. Set off from a job notice, it brings the `team` (with the friend 星 turns into, its `wish`, and whether
   *  to use a ramen ticket) and only glances at the enemies on the road before starting; without a team (endless mode)
   *  the team is picked on the field. */
  | {
      name: 'battle';
      /** `sandbox`: dev mode's testing ground, on `world`'s field, with Rakko's cars or not (`cars`). */
      mode: 'level' | 'endless' | 'sandbox';
      levelId?: string;
      nonce: number;
      team?: string[];
      wish?: string;
      ramen?: boolean;
      world?: number;
      cars?: boolean;
    }
  | { name: 'book' }
  /** The shop. `spot` is the seller the camera is on, with their goods open beside them: a step of its own (like a
   *  level's notice on the quest screen), so もどる and the system back gesture close it before leaving the shop. `next`:
   *  the shop was stopped by on the way to that job, whose notice it goes back to instead of the lobby. */
  | { name: 'shop'; spot?: string; next?: { world: number; level: string } }
  | { name: 'artkit' };

/** The quest board's paper for endless mode (after the six worlds). */
export const ENDLESS_PAPER = 7;
/** The board's last chosen paper, so coming back to the board shows it again (the lobby clears it). */
export const boardMemory: { paper: number | null } = { paper: null };

export const route = signal<Route>({ name: 'lobby' });
/** Every screen there is. A history entry for a screen an update removed goes to the lobby instead. */
const SCREENS = new Set<string>(['lobby', 'quests', 'quest', 'battle', 'book', 'shop', 'artkit'] satisfies Route['name'][]);
/** Bumped when the system back gesture happens during a battle (the battle pauses instead of leaving). */
export const backInBattle = signal(0);
/** The screens in this tab's history as far as this session knows them, oldest first (the last is the current one). */
const stack: Route[] = [];
/** Set while the game itself steps back out of a battle, so the back guard below lets it go. */
let leavingBattle = false;
/** Where a step back the game took is to land instead (see upThen). */
let landOn: Route | null = null;
/** Where to go on to from there, once landed (see upThenGo). */
let thenGo: Route | null = null;
/** Set while the game undoes a step forward into a battle (see the popstate handler), so that step back is let be. */
let undoingForward = false;
/** The pop-ups that are up and asked to be closed by the system back gesture, the top one last (see closeOnBack). */
const backCloses: (() => void)[] = [];

/** While a pop-up is up, the system back gesture closes it instead of the screen under it (the top one first, when
 *  one is open over another), so going back is always one step. Returns the way to let go once it is closed another
 *  way. Let go in a layout effect's cleanup (or sooner): a step back right after closing, like 「やめる」 in a battle,
 *  must not be taken for one more pop-up to close. A pop-up on the game's first page (the lobby) has nothing to step
 *  back to, so it is a route step instead (see the lobby's `settings`). */
export function closeOnBack(close: () => void): () => void {
  backCloses.push(close);
  return () => {
    const i = backCloses.lastIndexOf(close);
    if (i >= 0) backCloses.splice(i, 1);
  };
}

let installed = false;

export function initRouter(): void {
  if (installed) return;
  installed = true;
  history.replaceState({ route: route.value }, '');
  stack.splice(0, stack.length, route.value);
  window.addEventListener('popstate', (ev) => {
    const close = backCloses.pop();
    if (close) {
      // A pop-up is up: stay on this screen (put its entry back) and close the pop-up.
      history.pushState({ route: route.value }, '');
      close();
      return;
    }
    if (route.value.name === 'battle' && !leavingBattle) {
      // Stay in the battle: re-push it and ask the battle to pause.
      history.pushState({ route: route.value }, '');
      backInBattle.value++;
      return;
    }
    leavingBattle = false;
    if (undoingForward) {
      undoingForward = false;
      return;
    }
    const r = (ev.state as { route?: Route } | null)?.route;
    let next: Route = r && SCREENS.has(r.name) ? r : { name: 'lobby' };
    // A battle is never entered from history (the browser's forward button, iOS's forward swipe): it would start again,
    // with no notice and maybe another ramen ticket (2026-11-10 audit). From its own notice the step is undone; reached
    // any other way, the entry becomes that notice.
    if (next.name === 'battle') {
      const parent = battleParent(next);
      if (sameScreen(parent, route.value)) {
        undoingForward = true;
        history.back();
        return;
      }
      next = parent;
      try {
        history.replaceState({ route: next }, '');
      } catch {
        /* ignore */
      }
    }
    if (stack.length >= 2 && sameScreen(stack[stack.length - 2], next)) stack.pop();
    else stack.splice(0, stack.length, next);
    // A step back asked to land somewhere else (upThen): the entry it landed on becomes that screen.
    if (landOn) {
      next = landOn;
      landOn = null;
      try {
        history.replaceState({ route: next }, '');
      } catch {
        /* ignore */
      }
    }
    stack[stack.length - 1] = next;
    route.value = next;
    // A step on from there (upThenGo).
    if (thenGo) {
      const on = thenGo;
      thenGo = null;
      go(on);
    }
  });
}

/** Navigate. A replace swaps the current history entry instead of adding one. */
export function go(r: Route, opts: { replace?: boolean } = {}): void {
  route.value = r;
  if (opts.replace) {
    if (stack.length) stack[stack.length - 1] = r;
    else stack.push(r);
  } else stack.push(r);
  try {
    if (opts.replace) history.replaceState({ route: r }, '');
    else history.pushState({ route: r }, '');
  } catch {
    /* ignore (e.g. sandboxed iframes) */
  }
}

/** Whether two routes show the same screen (the board counts as one screen wherever it is scrolled). */
function sameScreen(a: Route, b: Route): boolean {
  if (a.name !== b.name) return false;
  if (a.name === 'lobby' && b.name === 'lobby') return !!a.settings === !!b.settings;
  if (a.name === 'quest' && b.name === 'quest') return a.world === b.world && (a.level ?? null) === (b.level ?? null);
  if (a.name === 'shop' && b.name === 'shop') return (a.spot ?? null) === (b.spot ?? null);
  return true;
}

/** Go up to a parent screen: step back through history when the parent is the entry before this one (so the
 *  system back gesture and the in-game back button agree), else replace this entry with it. */
export function up(parent: Route): void {
  if (stack.length >= 2 && sameScreen(stack[stack.length - 2], parent)) {
    try {
      leavingBattle = route.value.name === 'battle';
      history.back();
      return;
    } catch {
      leavingBattle = false;
    }
  }
  go(parent, { replace: true });
}

/** Where a battle was set off from: its job notice (or the world's quest), the quest board for endless mode, or the
 *  lobby for the testing ground. */
export function battleParent(r: Extract<Route, { name: 'battle' }>): Route {
  if (r.mode === 'sandbox') return { name: 'lobby' };
  const level = r.levelId ? LEVELS[r.levelId] : undefined;
  return level ? { name: 'quest', world: level.world, ...(r.team ? { level: level.id } : {}) } : { name: 'quests', focus: ENDLESS_PAPER };
}

/** Go up to `parent` as up() does, then show `then` in its place. The battle report's 次へ leaves the battle for the job
 *  notice it was set off from and turns that notice into the next job's, so playing on never piles up history (each
 *  次へ left one more step for the back gesture to walk through: 2026-11-10 audit). */
export function upThen(parent: Route, then: Route): void {
  if (stack.length >= 2 && sameScreen(stack[stack.length - 2], parent)) {
    try {
      leavingBattle = route.value.name === 'battle';
      landOn = then;
      history.back();
      return;
    } catch {
      leavingBattle = false;
      landOn = null;
    }
  }
  go(then, { replace: true });
}

/** upThen, then a step on to `after`, so stepping back from it lands on `then`: the battle report's 「お店へ」 opens the shop
 *  with the next job's notice under it. */
export function upThenGo(parent: Route, then: Route, after: Route): void {
  if (stack.length >= 2 && sameScreen(stack[stack.length - 2], parent)) {
    try {
      leavingBattle = route.value.name === 'battle';
      landOn = then;
      thenGo = after;
      history.back();
      return;
    } catch {
      leavingBattle = false;
      landOn = null;
      thenGo = null;
    }
  }
  go(then, { replace: true });
  go(after);
}
