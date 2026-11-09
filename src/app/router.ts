import { signal } from '@preact/signals';

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
   *  level's notice on the quest screen), so もどる and the system back gesture close it before leaving the shop. */
  | { name: 'shop'; spot?: string }
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
    const r = (ev.state as { route?: Route } | null)?.route;
    const next = r && SCREENS.has(r.name) ? r : { name: 'lobby' as const };
    if (stack.length >= 2 && sameScreen(stack[stack.length - 2], next)) stack.pop();
    else stack.splice(0, stack.length, next);
    stack[stack.length - 1] = next;
    route.value = next;
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

export function back(fallback: Route = { name: 'lobby' }): void {
  up(fallback);
}
