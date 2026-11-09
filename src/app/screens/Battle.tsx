import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { spriteFor } from '../../art/sprite';
import { CARD_LOOKS, spriteIdFor } from '../../art/spec';
import { art } from '../../art/store';
import { audio } from '../../audio/audio';
import { BattleController, type BattleEnd, type CardView } from '../../game/controller';
import { enemiesInLevel, LEVELS, nextLevelId, UNITS, waterOf } from '../../game/sim/defs';
import { nameOf, t } from '../../i18n/i18n';
import { save, updateSave } from '../../save/save';
import { CutOut, warmCutOut } from '../components/CutOut';
import { showDetails } from '../components/Details';
import { callOff, pressNow } from '../components/HandStamp';
import { Icon } from '../components/Icon';
import { LoadingScreen } from '../components/LoadingScreen';
import { StarMark } from '../components/PaperMarks';
import { PlatePaper } from '../components/Plate';
import { BackButton, confirm, Notice, Sheet, Switch, tap, toast } from '../components/ui';
import { SANDBOX_RULES, SandboxPanel, sandboxWish } from '../components/SandboxPanel';
import { askWish } from '../components/Wish';
import { sandboxTeam, worldHasCars } from '../../game/sim/sandbox';
import {
  applyResult,
  deckSize,
  defaultDeck,
  endlessPool,
  flushGallery,
  galleryKnown,
  isWishCard,
  jobCards,
  levelUnlocked,
  needsDeckChoice,
  noteDefeated,
  noteMet,
  noteSeen,
  ownedCards,
  recordAttemptStart,
  type Reward,
  rewardFor,
  startBonus,
  wishable,
  wishFor,
} from '../progress';
import { backInBattle, ENDLESS_PAPER, go, type Route, up } from '../router';

type BattleRoute = Extract<Route, { name: 'battle' }>;


/** What getting ready offers: the cards to choose from (when the player owns more than fit), the team it starts
 *  with, the ramen tickets, and the enemies to show on the road. */
interface Plan {
  owned: string[];
  size: number;
  choose: boolean;
  forced: boolean;
  tickets: number;
  deck: string[];
  /** The friend 星 turns into, when it is on the team. */
  wish: string | null;
  lineup: { id: string; unknown: boolean }[];
}

function planFor(r: BattleRoute): Plan {
  // The testing ground (dev mode): every friend, nothing to pick, nobody waiting on the road.
  if (r.mode === 'sandbox') {
    const team = sandboxTeam();
    return { owned: team, size: team.length, choose: false, forced: false, tickets: 0, deck: team, wish: sandboxWish.peek(), lineup: [] };
  }
  const level = r.levelId ? LEVELS[r.levelId] : undefined;
  const endless = r.mode === 'endless';
  // The friends who can go on this job (the islanders only where there is water).
  const owned = jobCards(level);
  const size = deckSize();
  const enemies = endless ? endlessPool() : level ? enemiesInLevel(level) : [];
  // The team picked on the job notice (only cards still owned, as many as fit).
  const picked = r.team?.filter((id) => owned.includes(id) || level?.deck.forced?.includes(id)).slice(0, size);
  // 星 comes with its wish (made on the notice, or else the one made last time); without one it stays home.
  const asked = r.team ? r.wish : undefined;
  const wish = asked && wishable(level).includes(asked) ? asked : wishFor(level);
  return {
    owned,
    size,
    choose: picked?.length ? false : needsDeckChoice(level),
    forced: !!level?.deck.forced?.length,
    tickets: save.value.items.buta,
    deck: (picked?.length ? picked : defaultDeck(level)).filter((id) => wish || !isWishCard(id)),
    wish,
    lineup: enemies.map((id) => ({ id, unknown: galleryKnown(id) === 'none' })),
  };
}

/** Back to where the job was picked: its job notice (or the world's quest), the quest board for endless mode, or the
 *  lobby from the testing ground. */
function leave(r: BattleRoute): void {
  if (r.mode === 'sandbox') {
    up({ name: 'lobby' });
    return;
  }
  const level = r.levelId ? LEVELS[r.levelId] : undefined;
  up(level ? { name: 'quest', world: level.world, ...(r.team ? { level: level.id } : {}) } : { name: 'quests', focus: ENDLESS_PAPER });
}

export function Battle({ r }: { r: BattleRoute }) {
  const level = r.levelId ? LEVELS[r.levelId] : undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<{ end: BattleEnd; reward: Reward } | null>(null);
  // Getting ready: the team (and the ramen ticket) comes from the job notice; without one (endless mode) it is picked
  // on the field, before the battle starts.
  const plan = useMemo(() => planFor(r), [r.nonce]);
  const fromNotice = !!r.team?.length;
  const [deck, setDeck] = useState(plan.deck);
  const [wish, setWish] = useState(plan.wish);
  const [ramen, setRamen] = useState(fromNotice && !!r.ramen && plan.tickets > 0);
  const spent = useRef(false);

  const ctl = useMemo(() => {
    const s = save.value;
    const sandbox = r.mode === 'sandbox';
    // The testing ground records nothing: what is met or beaten there is not noted, and it never ends.
    const quiet = () => {};
    return new BattleController({
      mode: r.mode,
      level,
      sandbox: sandbox ? { world: r.world ?? 1, cars: r.cars ?? worldHasCars(r.world ?? 1) } : undefined,
      devRules: sandbox ? SANDBOX_RULES : undefined,
      deck: plan.deck,
      wish: plan.wish ?? undefined,
      bonusWeeds: startBonus(),
      pool: plan.choose ? plan.owned : plan.deck,
      lineup: plan.lineup,
      picking: !fromNotice && (plan.choose || plan.tickets > 0),
      autoCollect: s.settings.autoCollect,
      attempt: level ? recordAttemptStart(level.id) : 0,
      endlessPool: r.mode === 'endless' ? endlessPool() : undefined,
      settings: () => save.value.settings,
      onSeen: sandbox ? quiet : noteSeen,
      onDefeated: sandbox ? quiet : noteDefeated,
      onMet: sandbox ? quiet : noteMet,
      onEnd: (end) => {
        flushGallery();
        const reward = rewardFor(end);
        applyResult(end, reward);
        setResult({ end, reward });
        if (reward.newCard) audio.sfx('sfx_unlock');
        else if (reward.total > 0) audio.sfx('sfx_coin');
      },
    });
    // The route nonce makes "retry" build a fresh controller.
  }, [r.nonce]);

  // Load art, attach, start.
  useEffect(() => {
    let alive = true;
    const canvas = canvasRef.current;
    art.load(ctl.artKeys()).then(() => {
      if (!alive || !canvas) return;
      ctl.speed.value = r.mode !== 'sandbox' && save.value.features.speed ? save.value.settings.speed : 1;
      ctl.attach(canvas);
      window.__ctdBattle = ctl;
      setReady(true);
    });
    audio.playMusic(ctl.worldBgm());
    return () => {
      alive = false;
      ctl.destroy();
      if (window.__ctdBattle === ctl) window.__ctdBattle = undefined;
      flushGallery();
      // Free this battle's pictures; the next screen loads its own (keeps phone memory low).
      art.release();
    };
  }, [ctl]);

  // Keep the canvas sized to its box, and keep the field clear of the top strip and the card column (and of the testing
  // ground's panel while it is open).
  useEffect(() => {
    const root = rootRef.current;
    const el = fieldRef.current;
    if (!root || !el) return;
    const rail = root.querySelector<HTMLElement>('.rail');
    const hud = root.querySelector<HTMLElement>('.hud-top');
    const dock = root.querySelector<HTMLElement>('.sb-dock');
    const sync = () => {
      const box = root.getBoundingClientRect();
      // From its place in the layout, not on the screen: it waits off to the left during the opening. The layout doesn't
      // count how much larger big screens draw the column and the strip.
      const larger = (rail && parseFloat(getComputedStyle(rail).scale)) || 1;
      const left = rail ? rail.offsetLeft + rail.offsetWidth * larger : 0;
      const panel = root.querySelector<HTMLElement>('.sb-panel');
      const right = panel ? box.right - panel.getBoundingClientRect().left : 0;
      ctl.setInsets({ left, top: (hud?.offsetHeight ?? 0) * larger, right });
    };
    const ro = new ResizeObserver(sync);
    for (const node of [el, rail, hud, dock]) if (node) ro.observe(node);
    sync();
    return () => ro.disconnect();
  }, [ctl, ready]);

  // The team being picked is the team the battle starts with.
  useEffect(() => {
    ctl.setTeam(deck, startBonus(), ramen, wish ?? undefined);
  }, [ctl, deck, ramen, wish]);

  // Endless mode is Rakko's ranking.
  useEffect(() => {
    if (r.mode === 'endless') noteMet('rakko');
  }, []);

  const started = ctl.phase.value === 'battle';
  // The team has been seen in a battle now, which is what puts the friend everyone starts with in the gallery book.
  useEffect(() => {
    if (started && r.mode !== 'sandbox') for (const id of deck) noteMet(id);
  }, [started]);

  // Set off from a job notice: once the battle really starts, remember the team and use up the ramen ticket.
  useEffect(() => {
    if (!started || !fromNotice || spent.current) return;
    spent.current = true;
    updateSave((d) => {
      if (!plan.forced) remember(d);
      if (ramen && d.items.buta > 0) d.items.buta--;
    });
  }, [started]);

  // System back gesture: before the battle it goes back to the quest; in battle it pauses.
  useEffect(() => {
    let first = true;
    return backInBattle.subscribe(() => {
      if (first) {
        first = false;
        return;
      }
      if (ctl.phase.value !== 'battle') leave(r);
      else if (ctl.status.value === 'playing') ctl.setPaused(true);
    });
  }, [ctl]);

  // Boss music.
  const boss = ctl.boss.value;
  useEffect(() => {
    if (ctl.status.value !== 'playing') return;
    audio.playMusic(boss ? 'bgm_boss' : ctl.worldBgm());
  }, [!!boss]);

  const status = ctl.status.value;
  useEffect(() => {
    if (status !== 'playing') audio.stopMusic(false);
  }, [status]);

  // 鎧さん is cut out while the last moments of the battle play, so he is there as soon as the report is.
  useEffect(() => {
    if (status !== 'playing') void warmCutOut(yoroiPicture(status === 'lost' && r.mode !== 'endless'), yoroiPx());
  }, [status]);

  const levelName =
    r.mode === 'sandbox'
      ? `${t('sandbox.title')} · ${t(`world.${r.world ?? 1}.name`)}`
      : level
        ? `${level.id} ${t(`world.${level.world}.name`)}`
        : t('endless.title');
  const phase = ctl.phase.value;
  // The team to take next time, and 星's wish with it.
  const remember = (d: { lastDeck: string[]; wish: string | null }) => {
    d.lastDeck = deck;
    if (wish && deck.some(isWishCard)) d.wish = wish;
  };
  const toggle = (id: string) => {
    if (deck.includes(id)) setDeck(deck.filter((x) => x !== id));
    else if (deck.length >= plan.size) toast(t('prep.choose', { n: plan.size }), 'bad');
    // 星 joins with a wish: the friend it turns into is picked first.
    else if (isWishCard(id)) {
      askWish(
        wish,
        (w) => {
          setWish(w);
          setDeck((now) => plan.owned.filter((x) => [...now, id].includes(x)));
        },
        level,
      );
    } else setDeck(plan.owned.filter((x) => [...deck, id].includes(x)));
  };
  const depart = () => {
    if (!deck.length) return;
    updateSave((d) => {
      if (!plan.forced) remember(d);
      if (ramen && d.items.buta > 0) d.items.buta--;
    });
    ctl.go();
  };

  return (
    <div class={`screen battle ${r.mode === 'sandbox' ? 'sandbox' : ''}`} ref={rootRef}>
      <div class="field" ref={fieldRef}>
        <canvas ref={canvasRef} aria-label={levelName} />
        {ctl.banner.value ? (
          <div key={ctl.banner.value.key} class={`banner ink-plate ${ctl.banner.value.kind}`} role="status">
            <PlatePaper />
            {ctl.banner.value.text}
          </div>
        ) : null}
        {/* All the field ever says is why something could not be done. */}
        {ctl.toast.value ? <Notice key={ctl.toast.value.key} text={ctl.toast.value.text} tone="bad" /> : null}
        {!ready ? <LoadingScreen /> : null}
      </div>
      <TopHud ctl={ctl} label={levelName} endless={r.mode === 'endless'} sandbox={r.mode === 'sandbox'} />
      <CardRail ctl={ctl} offstage={phase === 'look'} onRemove={phase === 'pick' && plan.choose ? toggle : undefined} />
      {phase === 'pick' ? (
        <TeamTray plan={plan} deck={deck} wish={wish} ramen={ramen} onToggle={toggle} onRamen={setRamen} onGo={depart} onBack={() => leave(r)} />
      ) : null}
      {r.mode === 'sandbox' && ready ? <SandboxPanel ctl={ctl} r={r} /> : null}
      {ctl.paused.value && !result ? <PauseSheet ctl={ctl} r={r} /> : null}
      {result ? <ResultSheet r={r} end={result.end} reward={result.reward} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------- HUD

/** A mark on the wave bar, a big wave's pennant or a boss's crown. Drawn here rather than typed as emoji, which look
 *  different on every phone and nothing like the rest of the game. */
function WaveMark({ boss }: { boss: boolean }) {
  return boss ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path class="crown" d="M4.5 18.5 3 8.5l5.3 3.8L12 5l3.7 7.3L21 8.5l-1.5 10Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6 2.8v14.6" />
      <path class="pennant" d="M6.6 3.4 17 7.6 6.6 11.8Z" />
    </svg>
  );
}

/** A top-strip button's picture, as drawn: its round face is what lifts it off the scenery. */
function HudIcon({ k }: { k: string }) {
  return <img class="hud-icon" src={art.imageUrl(k)} alt="" draggable={false} />;
}

/** Thin strip along the top: weeds over the cards, the wave bar over the field, shovel, speed and pause. No health is
 *  shown anywhere, like PvZ: not even a boss's.
 *  Buttons look compact but each has a 44 px tap area, and the areas never overlap. */
function TopHud({ ctl, label, endless, sandbox }: { ctl: BattleController; label: string; endless: boolean; sandbox?: boolean }) {
  const weeds = ctl.weeds.value;
  const prev = useRef(weeds);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (weeds > prev.current) setBump((b) => b + 1);
    prev.current = weeds;
  }, [weeds]);
  const progress = ctl.progress.value;
  // The testing ground sets its speed on its own panel.
  const canSpeed = save.value.features.speed && !sandbox;
  return (
    <div class={`hud-top ${ctl.phase.value === 'look' ? 'offstage' : ''}`}>
      <div key={bump} class={`pill weeds-pill ${bump ? 'bump' : ''}`} aria-label={t('res.weeds')}>
        <span class="dot">
          <Icon name="leaf" size={30} />
        </span>
        {weeds}
      </div>
      <div class="wave-box">
        <div class="wave-label">{endless && ctl.phase.value === 'battle' ? `${label} · ${t('battle.wave', { n: ctl.wave.value })}` : label}</div>
        {/* The testing ground has no waves to get through. */}
        {sandbox ? null : (
          <div class="wave-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <div class="fill" style={{ width: `${progress * 100}%` }} />
            {ctl.flags.map((f, i) => (
              <span key={i} class={`flag ${f.at >= 1 ? 'end' : ''} ${progress >= f.at - 0.001 ? 'passed' : ''}`} style={{ left: `${f.at * 100}%` }}>
                <WaveMark boss={f.kind === 'boss'} />
              </span>
            ))}
          </div>
        )}
      </div>
      {/* The shovel and speed wait out of sight until the battle starts, in their places so the row does not shift when they
          appear. Pause is there from the first moment: it is the way out. */}
      <div class={`hud-actions ${ctl.phase.value === 'battle' ? '' : 'waiting'}`}>
        <button
          class={`hud-btn shovel-btn ${ctl.shovel.value ? 'on' : ''}`}
          aria-label={t('battle.shovel')}
          title={t('battle.shovel')}
          aria-pressed={ctl.shovel.value}
          onClick={() => ctl.toggleShovel()}
        >
          <HudIcon k="ui/icon_shovel" />
        </button>
        {canSpeed ? (
          <button
            class={`hud-btn speed-btn ${ctl.speed.value === 2 ? 'on' : ''}`}
            aria-label={t('battle.speed')}
            aria-pressed={ctl.speed.value === 2}
            onClick={tap(() => {
              const s = ctl.speed.value === 2 ? 1 : 2;
              ctl.setSpeed(s);
              updateSave((d) => {
                d.settings.speed = s;
              });
            })}
          >
            {/* At 2× the button shows its own picture, which carries its ×2; a placeholder picture gets the tag. */}
            <HudIcon k={ctl.speed.value === 2 ? 'ui/icon_speed_active' : 'ui/icon_speed'} />
            {ctl.speed.value === 2 && !art.isReal('ui/icon_speed_active') ? <span class="hud-tag">2×</span> : null}
          </button>
        ) : null}
        <button class="hud-btn pause-btn" aria-label={t('battle.paused')} onClick={tap(() => ctl.setPaused(true))}>
          <HudIcon k="ui/icon_pause" />
        </button>
      </div>
    </div>
  );
}

/** Getting ready, while the camera looks at the enemies on the road: the cards to take (when there is a choice;
 *  the column of cards shows the team as it is picked), the ramen ticket, back, and 出発. */
function TeamTray(p: {
  plan: Plan;
  deck: string[];
  wish: string | null;
  ramen: boolean;
  onToggle: (id: string) => void;
  onRamen: (v: boolean) => void;
  onGo: () => void;
  onBack: () => void;
}) {
  const { plan, deck } = p;
  return (
    <section class="team-tray" aria-label={t('prep.title')}>
      <div class="tt-head">
        <h2>{t('prep.title')}</h2>
        {plan.choose ? <span class="chip pink">{t('prep.count', { n: deck.length, m: plan.size })}</span> : null}
      </div>
      {plan.choose ? (
        <div class="tt-cards">
          {plan.owned.map((id) => {
            const on = deck.includes(id);
            // 星 going shows the friend it turns into, and costs what they cost.
            const star = isWishCard(id);
            const as = star && on ? p.wish : null;
            const cost = UNITS[as ?? id]?.cost ?? 0;
            return (
              <button
                key={id}
                type="button"
                class={`tt-card ${on ? 'on' : ''}`}
                aria-pressed={on}
                aria-label={as ? `${t('wish.as', { name: nameOf(as) })} ${t('battle.cost', { n: cost })}` : star ? nameOf(id) : `${nameOf(id)} ${t('battle.cost', { n: cost })}`}
                onClick={tap(() => p.onToggle(id), on ? 'sfx_cancel' : 'sfx_card')}
              >
                <img src={art.portraitUrl(id)} alt="" draggable={false} />
                {as ? <img class="tt-wish" src={art.portraitUrl(as)} alt="" draggable={false} /> : null}
                <span class="cost">
                  <Icon name="leaf" />
                  {star && !as ? '?' : cost}
                </span>
                {on ? (
                  <span class="check">
                    <Icon name="check" size={12} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {plan.tickets > 0 ? (
        <div class="tt-ramen">
          <div class="grow">
            <div class="bold">{t('prep.ramen')}</div>
            <div class="tiny muted">{t('prep.ramenLeft', { n: plan.tickets })}</div>
          </div>
          <Switch on={p.ramen} onChange={p.onRamen} label={t('prep.ramen')} />
        </div>
      ) : null}
      <div class="tt-actions">
        <BackButton onClick={p.onBack} />
        <button type="button" class="btn primary grow" disabled={!deck.length} onClick={tap(p.onGo)}>
          {t('prep.go')}
        </button>
      </div>
    </section>
  );
}

/** The friend on a card: what will appear on the field, close up (art/spec/cards.ts frames each one). */
function CardFigure({ card }: { card: CardView }) {
  const { zoom, x, y } = CARD_LOOKS[card.id];
  return <img class="figure" src={art.imageUrl(`sprites/${card.sprite}/idle_1`)} style={{ '--zoom': zoom, '--x': x, '--y': y } as Record<string, number>} alt="" draggable={false} />;
}

/** The cards stand in a column down the left edge, by the thumb. They shrink to fit the team, so none ever scroll out of
 *  view (only the testing ground, with every friend at once, scrolls). `offstage`: waiting off to the left during the
 *  opening. */
/** 星's card is the wished-for friend's, marked with a star: its name reads 「星→ハチワレ」. */
function CardRail({ ctl, onRemove, offstage }: { ctl: BattleController; onRemove?: (id: string) => void; offstage?: boolean }) {
  const cards = ctl.cards.value;
  const sel = ctl.selected.value;
  const [info, setInfo] = useState<number | null>(null);
  const press = useRef<{ i: number; timer: number; long: boolean } | null>(null);

  const down = (i: number) => (ev: PointerEvent) => {
    audio.unlock();
    const p = { i, timer: 0, long: false };
    p.timer = window.setTimeout(() => {
      if (ctl.cardDragged) return;
      p.long = true;
      setInfo(i);
    }, 420);
    press.current = p;
    ctl.beginCardDrag(i, ev);
  };
  const up = (i: number) => () => {
    const p = press.current;
    press.current = null;
    if (!p || p.i !== i) return;
    window.clearTimeout(p.timer);
    if (p.long) {
      setInfo(null);
      return;
    }
    // A tap picks the card up. A drag picked it up as it left the card, and goes down where it is let go.
    if (!ctl.cardDragged) ctl.selectCard(i);
  };
  const cancel = () => {
    const p = press.current;
    if (p) window.clearTimeout(p.timer);
    press.current = null;
    setInfo(null);
    ctl.cancelCardDrag();
  };

  const infoCard = info !== null ? cards[info] : null;
  const u = infoCard ? UNITS[infoCard.id] : null;
  return (
    <div class={`rail ${offstage ? 'offstage' : ''}`}>
      {infoCard && u ? (
        <div class="card-info">
          <div class="bold" style={{ fontSize: '15px' }}>
            {infoCard.star ? t('wish.as', { name: nameOf(u.id) }) : nameOf(u.id)} <span class="chip green">{t('battle.cost', { n: u.cost })}</span>
          </div>
          <div class="muted">{t(`card.${u.id}.ability`)}</div>
        </div>
      ) : null}
      <div class="cards">
        {cards.map((c, i) => (
          <button
            key={c.deckId}
            class={`card ${sel === i ? 'sel' : ''} ${c.affordable ? '' : 'poor'} ${UNITS[c.id]?.oneUse && !c.star ? 'once' : ''} ${c.star ? 'wish' : ''}`}
            style={{ '--cd': (1 - Math.min(1, c.ready)).toFixed(3), '--tint': CARD_LOOKS[c.id].tint } as Record<string, string>}
            aria-label={`${c.star ? t('wish.as', { name: nameOf(c.id) }) : nameOf(c.id)} ${t('battle.cost', { n: c.cost })}`}
            aria-pressed={sel === i}
            onClick={onRemove ? tap(() => onRemove(c.deckId), 'sfx_cancel') : undefined}
            onPointerDown={onRemove ? undefined : down(i)}
            onPointerUp={onRemove ? undefined : up(i)}
            onPointerCancel={cancel}
            onPointerLeave={() => {
              const p = press.current;
              if (p && !p.long) window.clearTimeout(p.timer);
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span class="face">
              <CardFigure card={c} />
              <span class="cost">{c.cost}</span>
            </span>
            {c.star ? (
              <span class="wish-mark" aria-hidden="true">
                <Icon name="star" size={12} />
              </span>
            ) : null}
            <span class="cd" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- sheets

/** The pause panel's plate: a soft yellow, like the 2× speed badge. */
const PAUSE_TONE = '#FDE49C';

function PauseSheet({ ctl, r }: { ctl: BattleController; r: BattleRoute }) {
  const s = save.value.settings;
  const resume = () => ctl.setPaused(false);
  // The testing ground starts over as a fresh field, and is left for the lobby.
  const sandbox = r.mode === 'sandbox';
  const quit = t(sandbox ? 'sandbox.leave' : 'battle.quit');
  // Before the battle has started there is nothing to lose, so nothing to ask.
  const sure: typeof confirm = (text, onYes, opts) => (ctl.phase.value === 'battle' ? confirm(text, onYes, opts) : onYes());
  return (
    <Sheet onClose={tap(resume)} title={t('battle.paused')} tone={PAUSE_TONE}>
      <div class="stack" style={{ gap: '14px' }}>
        <div class="pause-grid">
          <button class="btn primary big" onClick={tap(resume)}>
            <Icon name="resume" /> {t('battle.resume')}
          </button>
          <button
            class="btn"
            onClick={tap(() =>
              // The same team again; a ramen ticket is only used when the player chooses it again on the notice.
              sure(t(sandbox ? 'sandbox.confirmRestart' : 'battle.confirmRestart'), () => go({ ...r, ramen: false, nonce: Date.now() }, { replace: true }), {
                title: t('battle.restart'),
              }),
            )}
          >
            <Icon name="restart" /> {t('battle.restart')}
          </button>
          <button class="btn" onClick={tap(() => sure(t(sandbox ? 'sandbox.confirmLeave' : 'battle.confirmQuit'), () => leave(r), { title: quit }))}>
            <Icon name="back" /> {quit}
          </button>
        </div>
        <div class="list">
          <div class="list-item">
            <Icon name="sound" />
            <span class="label">{t('settings.bgm')}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.bgm}
              style={{ maxWidth: '45%' }}
              onInput={(e) => {
                const v = Number((e.target as HTMLInputElement).value);
                updateSave((d) => {
                  d.settings.bgm = v;
                });
              }}
              aria-label={t('settings.bgm')}
            />
          </div>
          <div class="list-item">
            <Icon name="sound" />
            <span class="label">{t('settings.sfx')}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.sfx}
              style={{ maxWidth: '45%' }}
              onInput={(e) => {
                const v = Number((e.target as HTMLInputElement).value);
                updateSave((d) => {
                  d.settings.sfx = v;
                });
              }}
              aria-label={t('settings.sfx')}
            />
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function hintFor(levelId?: string): string {
  const level = levelId ? LEVELS[levelId] : undefined;
  const ids = new Set(level?.waves.flatMap((w) => w.spawns.map((s) => s.enemy)) ?? []);
  // No rescue car (World 6): every lane has to hold on its own.
  if (level && !level.rescues) return t('result.hints.noRescue');
  if (ids.has('zou')) return t('result.hints.zou');
  // With water about (World 5): 島二郎 in front of the pair once he has joined, the pair once they have, モモンガ from
  // the lanes beside it before.
  if (waterOf(level).length) {
    const has = (id: string) => save.value.cards.includes(id);
    return t(has('shimajiro') ? 'result.hints.waterWall' : has('futaba') ? 'result.hints.water' : 'result.hints.waterBank');
  }
  // At night nothing sprouts (World 4): the start's weeds are best spent on ちいかわ.
  if (level && !level.sprout) return t('result.hints.night');
  if (ids.has('guchokipanogitaigata')) return t('result.hints.song');
  if (ids.has('mushi_horned')) return t('result.hints.armor');
  if (ids.has('majyo')) return t('result.hints.fast');
  if (save.value.upgrades.slots === 0 && ownedCards().length > deckSize()) return t('result.hints.shop');
  return save.value.cards.includes('yoroi') ? t('result.hints.wall') : t('result.hints.economy');
}

/** 「討伐完了」, stamped on the report of a job done. */
const DONE_STAMP = '討伐\n完了';
/** How long the report is up before the hand stamp comes for it (ms): the stars have popped in by then. */
const STAMP_AFTER_MS = 900;
/** How tall a friend who has just joined stands on the report (CSS px). */
const NEW_FRIEND_PX = 106;

/** 労働の鎧さん beside the report: thanking the player, or scratching his head over a job that went wrong. */
const yoroiPicture = (sad: boolean) => art.imageUrl(sad ? 'ui/report_yoroi_concerned' : 'ui/report_yoroi_bow');
/** How many pixels tall he is cut. His box is in the styles: this only decides how sharp he is. */
const yoroiPx = () => Math.min(760, Math.round(window.innerHeight * 0.86));

/** 鎧さん himself, beside the report. He comes up from below the screen (his pictures end at the waist), stands breathing,
 *  and dips in a bow (`bowed`) as the stamp lands. */
function ReportYoroi({ sad, bowed }: { sad: boolean; bowed: boolean }) {
  return (
    <div class={`report-yoroi${sad ? ' sad' : ''}`}>
      <div class={`report-yoroi-bow${bowed ? ' now' : ''}`}>
        <div class="report-yoroi-pic">
          <CutOut src={yoroiPicture(sad)} px={yoroiPx()} />
        </div>
      </div>
    </div>
  );
}

/** Who has just joined: standing as they do in battle (the team of four, who have no one picture, by their card's face),
 *  their name and what they do. A long description is cut short here; a tap opens all of it. */
function NewFriend({ id }: { id: string }) {
  const sprite = spriteFor(spriteIdFor('ally', id));
  const idle = sprite?.anims.idle;
  const src = sprite && idle ? art.imageUrl(`sprites/${sprite.id}/idle_1`) : art.portraitUrl(id);
  const ratio = idle ? idle.w / idle.h : 1;
  return (
    <button type="button" class="report-friend" onClick={tap(() => showDetails(id))}>
      <span class="ink-plate report-tag">
        <PlatePaper />
        {t('result.newCard')}
      </span>
      <span class="report-friend-pic" style={{ width: `${Math.round(NEW_FRIEND_PX * ratio)}px`, height: `${NEW_FRIEND_PX}px` }}>
        <CutOut src={src} px={Math.round(NEW_FRIEND_PX * Math.max(1, ratio))} />
      </span>
      <span class="report-name">{nameOf(id)}</span>
      <span class="report-does">{t(`card.${id}.ability`)}</span>
    </button>
  );
}

/** 「討伐完了」, pressed onto the report by the hand stamp once the stars are in; `onInk` runs as it lands. */
function ReportStamp({ onInk }: { onInk: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    void art.load(['ui/hand_stamp']);
    const timer = window.setTimeout(() => pressNow(el, onInk), STAMP_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      callOff(el);
    };
  }, []);
  return (
    <span ref={ref} class="red-stamp report-stamp unstamped" role="img" aria-label={t('banner.win')}>
      {DONE_STAMP}
    </span>
  );
}

function ResultSheet({ r, end, reward }: { r: BattleRoute; end: BattleEnd; reward: Reward }) {
  const [bowed, setBowed] = useState(false);
  const level = r.levelId ? LEVELS[r.levelId] : undefined;
  const nextId = level ? nextLevelId(level.id) : null;
  const canNext = end.won && nextId && levelUnlocked(nextId);
  const retry = () => go({ ...r, ramen: false, nonce: Date.now() }, { replace: true });
  const actions = (
    <>
      <button class="btn grow" onClick={tap(() => leave(r))}>
        <Icon name="back" /> {t('result.map')}
      </button>
      {canNext ? (
        <button class="btn primary grow" onClick={tap(() => go({ name: 'quest', world: LEVELS[nextId!].world, level: nextId! }, { replace: true }))}>
          {t('result.next')}
        </button>
      ) : (
        <button class={`btn grow ${end.won ? '' : 'primary'}`} onClick={tap(retry)}>
          <Icon name="restart" /> {t('result.retry')}
        </button>
      )}
    </>
  );
  const levelName = level ? `${level.id} ${t(`world.${level.world}.name`)}` : '';
  const pay = (
    <span class="report-amount">
      {t('result.pay')} <Icon name="coin" size={16} /> +{reward.total}
    </span>
  );

  if (end.mode === 'endless') {
    return (
      <Sheet class="report solo" title={t('endless.title')} tone="var(--yellow)" actions={actions} aside={<ReportYoroi sad={false} bowed={false} />}>
        <div class="report-sum">
          <p class="report-wave">{t('result.waveReached', { n: end.wavesCleared })}</p>
          {reward.bestEndless ? <span class="chip yellow report-best">{t('result.best')}</span> : null}
          <div class="report-pay">
            <span />
            {pay}
          </div>
        </div>
      </Sheet>
    );
  }

  if (!end.won) {
    return (
      <Sheet class="report solo" title={t('result.lose')} tone="#e9dfd6" actions={actions} aside={<ReportYoroi sad bowed={false} />}>
        <div class="report-sum">
          <div class="report-level">{levelName}</div>
          <p class="report-sad">{t('result.loseLine')}</p>
          <div class="report-hint">
            <Icon name="bulb" size={20} /> {t('result.hintTitle')}
          </div>
          <p class="report-note">{hintFor(level?.id)}</p>
        </div>
      </Sheet>
    );
  }

  // What each star is for, in the order they are earned (see starsFor): where there are no cars, a clear earns all three.
  const cars = !!level?.rescues;
  const goals = cars ? ['goalDone', 'goalOneCar', 'goalNoCars'] : ['goalDone', 'goalNobody', 'goalHeld'];
  return (
    <Sheet class={reward.newCard ? 'report' : 'report solo'} title={t('result.win')} tone="var(--green)" actions={actions} aside={<ReportYoroi sad={false} bowed={bowed} />}>
      <div class="report-grid">
        {reward.newCard ? <NewFriend id={reward.newCard} /> : null}
        <div class="report-sum">
          <div class="report-level">{levelName}</div>
          <div class="report-goals" aria-label={`${reward.stars}/3`}>
            {goals.map((g, i) => (
              <div key={g} class={i < reward.stars ? 'report-goal' : 'report-goal off'} style={{ '--i': i }}>
                <StarMark on={i < reward.stars} />
                <span>{t(`result.${g}`)}</span>
              </div>
            ))}
          </div>
          {reward.features.length ? (
            <div class="report-unlocks">
              <span class="bold">{t('result.unlocks')}</span>{' '}
              {[reward.features.includes('endless') ? t('map.endlessTitle') : '', reward.features.includes('speed') ? t('result.unlockSpeed') : '']
                .filter(Boolean)
                .join(' · ')}
            </div>
          ) : null}
          <div class="report-pay">
            <span class="report-used">{cars ? t('result.carsUsed', { n: end.stats.rescuesUsed }) : ''}</span>
            {pay}
          </div>
          <ReportStamp onInk={() => setBowed(true)} />
        </div>
      </div>
    </Sheet>
  );
}
