// Content definitions (loaded from src/data/*.json) and runtime entity shapes.

export type SizeTier = 'S' | 'M' | 'L' | 'XL';
type SpeedTier = 'slow' | 'normal' | 'fast';

// ---------------------------------------------------------------- allies

interface AllyAttackDef {
  /** `missiles`: うさぎ（クール）'s (owner's call, 2026-11-08): she only poses, and every interval missiles fall from
   *  the sky, one on each lane that has an enemy on the field, where one of its enemies is (picked at random). Each
   *  blows up where it lands: every enemy on the ground in that lane within `blastTiles` tiles of the spot takes the
   *  blow. With no enemy on the field, none fall. */
  kind: 'none' | 'hitscan' | 'projectile' | 'lob' | 'spread3' | 'missiles';
  damage?: number;
  intervalMs?: number;
  /** Hitscan reach in tiles up the lane (own tile plus this many). Omitted = whole lane. */
  rangeTiles?: number;
  /** Visual id of the projectile or jab effect. */
  fx?: string;
  /** A lob that splashes where it lands (栗まんじゅう's can, owner's call 2026-11-07: PvZ's melon-pult): every enemy
   *  within this many lanes and tiles of the spot takes the blow (1: the 3×3 tiles round it). */
  splashTiles?: number;
  /** Slow applied to the enemy hit. */
  slowMs?: number;
  /** Damage multiplier against fliers (v2). */
  vsFlierMultiplier?: number;
  /** A projectile that goes on through every enemy in the lane, hitting each once, until it leaves the field (フタバ's
   *  seashells, v2). Not the same as ignoring armour (`ignoresArmor`). */
  passThrough?: boolean;
  /** Its blows go straight through armour (ラッコ, who once beat the horned bug Chiikawa could not, v2). */
  ignoresArmor?: boolean;
  /** A hitscan sweep (ラッコ's sword, owner's call 2026-11-07): each blow also strikes every enemy within reach in this
   *  many lanes either side of its own, each enemy once; it swings when any of those lanes has one. Its reach is the same
   *  in every lane it cuts: from his own tile, so whoever is level with him, to the tiles ahead (owner's call 2026-11-10,
   *  in place of the 2026-11-09 rule that spared anyone level with him). */
  sweepLanes?: number;
  /** Shots in each attack, one after another a moment apart (古本屋, owner's call 2026-11-08: two at a time). */
  volley?: number;
  /** A jab that pushes the enemy it hits back this many tiles, toward where the enemies come from (ハチワレ（パジャマ）,
   *  owner's call 2026-11-08). A boss or a giant is too big to push; one in the air, jumping or lunging is not pushed
   *  either. Nobody is pushed back off the field. */
  pushTiles?: number;
  /** A missile's blast (`missiles`): how far along its lane it reaches either side of where it lands, in tiles. */
  blastTiles?: number;
  /** How far into the attack (ms) the blow lands or the shot leaves, where that is not the usual moment
   *  (ATTACK_RELEASE_MS): 栗まんじゅう's can leaves her hand on her throw, late in her frames. */
  releaseMs?: number;
}

/** たい焼き (owner's call, 2026-11-08: a trap): it cooks for `readyMs` after it is put down (enemies leave it alone
 *  meanwhile, as always since 2026-11-12: they walk over it), and once it is ready the first enemy on the ground to reach it sets it off: every enemy on the ground in its lane,
 *  from half a tile in front of its tile to the back of it, takes `damage`, and the taiyaki is used up. */
export interface MineDef {
  readyMs: number;
  damage: number;
}

interface ProduceDef {
  amount: number;
  intervalMs: number;
  firstMs: number;
  /** Auto-pull sprouted weeds within this Manhattan tile distance. */
  pullRadius: number;
}

/** What a friend who never attacks does for the others instead (v2). */
type SupportDef =
  /** Friends in the same lane attack this many times as fast while it sings (パジャマパーティーズ). */
  { kind: 'aura_attackspeed'; mul: number };

/** A one-use card (v2): it does its one thing and nothing stays. オデ is put down like any friend, on an empty land
 *  tile (owner's call, 2026-11-08); むちゃうマン on any tile of an open lane, a friend standing there or not. */
type OneUseDef =
  /** オデ (owner's call, 2026-11-08): put down on a tile, he comes running in from the base end of its lane and
   *  sprints the whole length of it, like Rakko's car: every enemy on the ground he runs into is defeated (a boss takes RESCUE_BOSS_DAMAGE, as from
   *  the car). Fliers are overhead: he runs under them. */
  | { kind: 'charge' }
  /** むちゃうマン (owner's call, 2026-11-08): he appears on the tile and strikes a pose, and then every enemy in play
   *  freezes for `freezeMs`, those on the road just before the field too, as all of them are on the screen (no walking,
   *  biting or abilities; they can still be hit); then he is gone. */
  | { kind: 'freeze'; freezeMs: number };

/** Stronger beside a partner (ヒトハ and フタバ, v2): while a friend whose id is `with` stands on the tile right in front
 *  or right behind in its lane, it attacks `attackMul` times as fast. Both of the pair throw 1.5× as fast side by side
 *  (2026-11-06). */
export interface BondDef {
  with: string;
  attackMul?: number;
}

/** 星 (v2), like PvZ's Imitater: it grants a wish. The player picks a friend for it before setting off, and its card is
 *  then that friend's card (cost and recharge too, so a team can take the same friend twice). It is put on the field
 *  like any friend, on an empty tile of that friend's ground: it stands there as itself for `transformMs`, casts, and
 *  then that friend takes its place (a one-use friend does their one thing instead, and the tile is free again). Its
 *  own cost and recharge are never used; it stands with that friend's HP, or its own if they have none. */
export interface WishDef {
  transformMs: number;
}

export interface UnitDef {
  id: string;
  scope: 1 | 2;
  cost: number;
  cooldownMs: number;
  initialCooldownMs: number;
  hp: number;
  size: SizeTier;
  attack: AllyAttackDef;
  produce?: ProduceDef;
  wall?: boolean;
  support?: SupportDef;
  oneUse?: OneUseDef;
  mine?: MineDef;
  wish?: WishDef;
  /** A team whose card brings one member at a time, at random (パジャマパーティーズ, owner's call 2026-11-08): each is
   *  drawn from frames of its own and otherwise is this friend. */
  members?: string[];
  /** Goes only on water tiles (ヒトハ, フタバ and 島二郎, v2); every other friend goes only on land. */
  aquatic?: boolean;
  /** Rakko (v2): he drives the rescue cars, so he comes only on jobs his car comes on (not World 6's big hunt, where
   *  he is not on the hunt). */
  rescuer?: boolean;
  bond?: BondDef;
}

// ---------------------------------------------------------------- enemies

interface EnemyAttackDef {
  kind: 'none' | 'melee' | 'ranged' | 'stomp';
  damage?: number;
  intervalMs?: number;
  /** 1 = melee contact. 3 = stops two tiles earlier (フグ). */
  rangeTiles?: number;
  fx?: string;
  /** How long one swing takes (ms); otherwise by its size (see tempo.ts). */
  swingMs?: number;
  /** How far through the swing the blow lands (0–1); otherwise halfway. */
  hitAt?: number;
}

/** An enemy's ability. The timed ones (heal_aura, song, spell, summon) come again `cooldownMs` after they are over (owner's
 *  call, 2026-11-07: a cooldown starts when its ability ends, not when it starts; see abilityBusyMs in tempo.ts). */
export type EnemyAbility =
  | { kind: 'armor'; flat: number }
  /** Heals the enemies within `radiusTiles` lanes and tiles of it: 1 is the 3×3 tiles round it, it in the middle.
   *  `pauseMs`: it stops for this long each time it heals, then moves on; its cooldown starts once the stop is over
   *  (黒い星). */
  | { kind: 'heal_aura'; amount: number; cooldownMs: number; radiusTiles: number; pauseMs: number }
  /** 擬態型's lure song: `firstMs` after it comes onto the field, and again `cooldownMs` after each song is over, it
   *  sings as it goes (not a stop), and up to `targets` friends in its lane, however far, picked at random, sway for
   *  `durationMs` (no attacks, no 草, no support). Its blows land `relaxedDamageMul` times as hard on a swaying
   *  friend. */
  | { kind: 'song'; cooldownMs: number; durationMs: number; firstMs: number; relaxedDamageMul: number; targets: number }
  /** 山姥's spell: `firstMs` after she comes onto the field, and again `cooldownMs` after each hold wears off, she stops
   *  for `castMs` and chants at up to `targets` key friends (any that attack, make 草 or support; never a wall)
   *  anywhere on the field, picked at random, any not held yet first: each is held (no attacks, no 草, no support)
   *  for `freezeMs` from when she starts. */
  | { kind: 'spell'; cooldownMs: number; castMs: number; freezeMs: number; targets: number; firstMs: number }
  /** While it is on the field, every enemy among `who` (セイレーン's mermaids, anywhere) moves `speedMul` times as fast. */
  | { kind: 'rally'; who: string[]; speedMul: number }
  /** セイレーン's call, the game's summoner boss (owner's call, 2026-11-07): `firstMs` after she comes onto the field,
   *  and again `cooldownMs` after each call is over, she stops for `castMs` and sings, and `min`–`max` small mobs come up
   *  round the column she is in, one after another through her song, in lanes dealt out at random (each open lane once
   *  before any has a second): `water` (人魚) on a water lane, `land` (the two-legged mermaid) on land. Each comes up
   *  (the 'spawn' mode) before it walks on. */
  | { kind: 'summon'; cooldownMs: number; castMs: number; firstMs: number; min: number; max: number; water: string; land: string }
  | { kind: 'disguise'; transformMs: number }
  /** Flies over everything to the friend nearest the base in its lane, hovers over it, grabs it and flies back out
   *  with it (でかい鳥, v2). */
  | { kind: 'flier'; hoverMs: number }
  /** Within `tiles` of a friend ahead it stops for `readyMs`, eyeing it, then lunges: dashes in over its swing's
   *  wind-up, and the swipe lands `damageMul` times as hard (ちゅーしです). Then it attacks as usual. */
  | { kind: 'lunge'; tiles: number; damageMul: number; readyMs: number }
  /** It never attacks: it jumps over every friend in its way, landing just past its tile (六足の虫). A jump comes in
   *  three parts: getting ready where it is (`readyMs`), in the air over the friend (`airMs`), and landing,
   *  steadying itself (`landMs`). */
  | { kind: 'jump'; readyMs: number; airMs: number; landMs: number }
  /** It picks up any 草 growing where it passes (never ちいかわ's finds, nor one she is pulling), stopping `ms` (by its
   *  tempo) to do it, and carries them until it is defeated, when they drop back where it falls (ゴブリン). */
  | { kind: 'steal'; ms: number }
  /** It starts with its claws hidden. The first time it is down to `atHp` of its HP (0.3: 30%) it stops and draws
   *  them out, taking `ms`; from then on it has them out (form 'claws': its clawed frames, whose ability is the
   *  drawing), walks `moveSpeedMul` times as fast and swings `attackSpeedMul` times as often until it falls, however
   *  much it is healed (キメラ). */
  | { kind: 'claws'; atHp: number; ms: number; attackSpeedMul: number; moveSpeedMul: number };

export interface EnemyDef {
  id: string;
  scope: 1 | 2;
  size: SizeTier;
  /** Only ever called up by another enemy (セイレーン's two-legged mermaids): in no job's waves, and never sent out in endless mode. */
  summonOnly?: boolean;
  /** Size of the revealed form, for disguised enemies. */
  trueSize?: SizeTier;
  speed: SpeedTier;
  hp: number;
  attack: EnemyAttackDef;
  abilities: EnemyAbility[];
  boss?: boolean;
  /** Comes in a group of this many, one after another in the same lane (小さい人魚: 3). */
  pack?: number;
  /** Swims (人魚, セイレーン, v2): in a job with water it comes down only the water lanes, and nobody else does. Where
   *  there is no water (endless mode) it walks like everyone else. */
  aquatic?: boolean;
  /** A giant (でかつよ, あのこ, 2026-11-06): one body three lanes wide, always down the middle of the field. Every
   *  friend in its three lanes can hit it; the first friend in any of them stops it; each swing hits the friend in
   *  front of it in each lane. Reaching the base, it calls all three lanes' cars. */
  giant?: boolean;
  /** Difficulty points, used by endless mode's wave generator (for the whole group, with `pack`). */
  weight: number;
}

// ---------------------------------------------------------------- the testing ground (dev mode)

/** Rules dev mode's testing ground (テスト場) can switch, changed while it runs. */
export interface DevRules {
  /** Cards cost nothing and are ready again at once. */
  free: boolean;
  /** Enemies hold still: they do not walk, bite or use their abilities. */
  freeze: boolean;
  /** Friends take no damage (the blow still lands and shows). */
  safeFriends: boolean;
  /** Enemies take no damage (the blow still lands and shows). */
  safeEnemies: boolean;
}

// ---------------------------------------------------------------- levels

export interface SpawnDef {
  enemy: string;
  count?: number;
  /** Lane index, 'random' (spread across active lanes) or 'all' (one per active lane, times count). */
  lane?: number | 'random' | 'all';
  hpMul?: number;
  /** Show this enemy as a boss (HP bar, limited rescue damage). */
  boss?: boolean;
}

export interface WaveDef {
  /** Seconds from level start (scheduling keeps the gaps between waves). */
  at: number;
  big?: boolean;
  final?: boolean;
  boss?: boolean;
  spawns: SpawnDef[];
}

export interface TerrainDef {
  lane: number;
  col: number;
  kind: 'stump' | 'bush';
}

export interface SproutDef {
  firstMs: number;
  minMs: number;
  maxMs: number;
  value: number;
  lifeMs: number;
}

export interface LevelDef {
  id: string;
  world: number;
  index: number;
  lanes: number[];
  startWeeds: number;
  sprout: SproutDef | null;
  deck: { forced?: string[] };
  terrain: TerrainDef[];
  rescues: boolean;
  waves: WaveDef[];
  rewards: { firstClear: number; replay: number; unlockCard?: string; unlockFeatures?: string[] };
}

export interface WorldDef {
  id: number;
  key: string;
  palette: { ground: string; ground2: string; accent: string; sky: string };
  bgm: string;
  /** Lanes that are water in this world's battle picture (World 5: the bottom lane, the edge of the sea). Only aquatic
   *  friends go on them and only aquatic enemies come down them. */
  water?: number[];
}

// ---------------------------------------------------------------- runtime

/** `carried`: in でかい鳥's talons, off its tile (it lands again if the bird falls). */
type AllyState = 'idle' | 'attack' | 'pull' | 'collapse' | 'carried';

export interface Ally {
  uid: number;
  def: UnitDef;
  lane: number;
  col: number;
  hp: number;
  maxHp: number;
  state: AllyState;
  anim: string;
  animStart: number;
  attackT: number;
  pendingRelease: number;
  nextProduceAt: number;
  pullTarget: number;
  pullAt: number;
  songUntil: number;
  hitFlashUntil: number;
  collapseAt: number;
  placedAt: number;
  /** The でかい鳥 carrying it, or -1. */
  carriedBy: number;
  /** Placed by 星: still a star until then (sim ms), doing nothing yet; 0 once it has turned into this friend (and for
   *  everyone else). */
  wishUntil: number;
  /** Held by 山姥's spell until then (sim ms): it also sets songUntil, which does the holding; this is for the look. */
  spellUntil: number;
  /** Caught by 擬態型's song until then (sim ms): it also sets songUntil, which does the stopping; this is for 擬態型's
   *  harder blows, and for the look (drawn held, as 山姥's spell leaves a friend, since 2026-11-07). */
  swayUntil: number;
  /** A trap (たい焼き, MineDef): when it is cooked and ready to go off (sim ms); 0 for everyone else. */
  readyAt: number;
  /** Shots still to come in the attack under way (a volley: 古本屋 throws two). */
  shotsLeft: number;
  /** Which member of a team this one is (UnitDef.members), or null. */
  member: string | null;
}

/** `spell`: stopped to chant a spell at a friend (山姥). `heal`: stopped a moment to heal the others (黒い星). `hover`: a flier over the friend it is about to grab.
 *  `gone`: left the field without being beaten (a flier flying off); removed at once. */
/** An enemy's mode (see Sim's FIXED_MODES): walking, waiting up against a friend (`engaged`), swinging (`attack`, also
 *  でかい鳥's grab), ちゅーしです eyeing a friend before it lunges (`aim`) and its lunge, 六足の虫's jump, ゴブリン picking up 草 (`steal`), キメラ drawing her claws (`claws`),
 *  セイレーン's phrase as she swims (`sing`), healing, chanting a spell, transforming, hovering (でかい鳥), falling, or
 *  gone. */
export type EnemyState = 'walk' | 'engaged' | 'attack' | 'aim' | 'lunge' | 'jump' | 'steal' | 'claws' | 'summon' | 'spawn' | 'heal' | 'spell' | 'transform' | 'collapse' | 'hover' | 'gone';

/** A flier's errand (でかい鳥). */
export interface Flight {
  /** The friend it is flying to or hovering over, or -1. */
  target: number;
  /** The friend in its talons, or -1. */
  carry: number;
  /** Flying back out (with a friend, or with nothing to take). */
  out: boolean;
}

export interface Enemy {
  uid: number;
  def: EnemyDef;
  lane: number;
  x: number;
  y: number;
  prevY: number;
  hp: number;
  maxHp: number;
  state: EnemyState;
  anim: string;
  animStart: number;
  attackT: number;
  pendingHitAt: number;
  targetUid: number;
  slowUntil: number;
  hitFlashUntil: number;
  /** How far its timed ability's cooldown has run (ms; below 0 while its first use is further off than a cooldown). */
  abilityT: number;
  /** Until when the ability it used last is still going (its stop, its song, its hold): its cooldown waits for it. */
  abilityBusyUntil: number;
  stateUntil: number;
  disguised: boolean;
  /** 'small' while disguised, 'true' after the reveal (ちいかぶ); 'claws' from when キメラ starts drawing her claws;
   *  'normal' otherwise. */
  form: 'normal' | 'small' | 'true' | 'claws';
  boss: boolean;
  collapseAt: number;
  spawnedAt: number;
  waveIndex: number;
  /** For fliers, else null. */
  flight: Flight | null;
  /** How many lanes either side of `lane` its body covers: 1 for a giant (EnemyDef.giant) with an open lane on both
   *  sides, else 0. */
  half: number;
  /** A lunge or a jump in progress: where it set off from and where it lands (travel px). */
  moveFrom: number;
  moveTo: number;
  /** The 草 a goblin carries, each one's worth. */
  stolen: number[];
  /** The 草 it is picking up (a pickup's uid), or -1. */
  stealTarget: number;
  /** セイレーン's followers still to come up through the song she is singing: when, in which lane, and who. */
  calls: { at: number; lane: number; id: string }[];
  /** Frozen by むちゃうマン until then (sim ms): it does nothing at all, and whatever it was in the middle of waits. */
  frozenUntil: number;
  /** How much further it is still being pushed back (travel px), by ハチワレ（パジャマ）'s jab. */
  pushLeft: number;
  /** The friend ちゅーしです has pounced on (its uid, or -1): it never lunges at that one again. */
  lungedAt: number;
  /** The friend it is up against (its uid, or -1), and since when (sim ms). */
  heldBy: number;
  heldSince: number;
  /** The friend an enemy that never attacks (黒い流れ星) is drifting past, held up too long by it (uid, or -1). */
  driftedPast: number;
}

export interface Projectile {
  uid: number;
  fx: string;
  lane: number;
  x0: number;
  x: number;
  y: number;
  y0: number;
  prevY: number;
  vy: number;
  damage: number;
  source: string;
  splashTiles?: number;
  slowMs?: number;
  /** `stump`: the column of the stump it was thrown at, when there was no enemy to throw it at. */
  lob?: { targetUid: number; t0: number; dur: number; yT: number; height: number; stump?: number };
  /** A missile falling from the sky (うさぎ（クール）): it lands at `yT` (a hit line in its lane) `dur` ms after `t0`
   *  and blows up there, over `tiles` tiles either side along the lane. `stump`: the column of the stump it was sent
   *  to, in a lane with no enemy. */
  drop?: { t0: number; dur: number; yT: number; tiles: number; stump?: number };
  /** For a projectile that goes through everyone (AllyAttackDef.passThrough): the enemies it has hit already. */
  passed?: Set<number>;
  /** Enemy projectile homing on an ally. */
  hostileTarget?: number;
  /** A friend's shot, on its first step: enemies whose front is anywhere on the shooter's tile (up to this hit line) are
   *  in its way too, though behind the muzzle. Cleared after that step. */
  back?: number;
  bornAt: number;
  dead: boolean;
}

/** Someone crossing a whole lane once, from a one-use card: オデ's charge, defeating every enemy he runs into. `y` is his
 *  front (travel px). */
export interface Sweep {
  uid: number;
  /** The card's id. */
  source: string;
  lane: number;
  y: number;
  prevY: number;
  /** px/s along the lane: negative, out from the base toward where the enemies come from. */
  vy: number;
  /** The enemies he has already run into. */
  hit: Set<number>;
  startedAt: number;
  dead: boolean;
}

/** A one-use friend who appears on a tile, does their one thing and is gone (むちゃうマン: a pose, then every enemy
 *  freezes). */
export interface Cameo {
  uid: number;
  def: UnitDef;
  lane: number;
  col: number;
  startedAt: number;
  /** When they do their thing (the end of the pose), and when they are gone. */
  firesAt: number;
  leavesAt: number;
  fired: boolean;
}

type PickupState = 'sprout' | 'idle' | 'pulled' | 'wilt' | 'gone';

export interface Pickup {
  uid: number;
  kind: 'weed' | 'drop';
  lane: number;
  col: number;
  x: number;
  y: number;
  value: number;
  bornAt: number;
  expiresAt: number;
  autoAt: number;
  state: PickupState;
  stateAt: number;
  claimedBy: number;
}

export interface Rescue {
  lane: number;
  /** On a water lane: Rakko comes in his boat instead of the car (the same rescue). */
  boat: boolean;
  state: 'parked' | 'driving' | 'used';
  y: number;
  prevY: number;
  hit: Set<number>;
  startedAt: number;
}

export interface CardState {
  /** The friend the card places (for 星, the friend wished for). */
  def: UnitDef;
  /** Set when the card is 星's: the star's own definition (what it places is a star first, see WishDef). */
  star?: UnitDef;
  cooldownLeft: number;
  /** A team's card: the member it brings next, picked ahead so its ghost shows who is coming (UnitDef.members). */
  member?: string;
}

export type SimStatus = 'playing' | 'won' | 'lost';

export type SimEvent =
  | { type: 'place'; ally: Ally }
  | { type: 'remove'; ally: Ally }
  | { type: 'allyAttack'; ally: Ally }
  /** A friend's blow landing on at least one enemy (a jab, a punch, ラッコ's sword). */
  | { type: 'jab'; ally: Ally }
  /** A melee friend's blow, whatever it landed on: the open lanes it cuts and the last column it reaches. */
  | { type: 'swing'; ally: Ally; lanes: number[]; lastCol: number }
  | { type: 'shoot'; ally: Ally; projectile: Projectile }
  /** `lane`: where the blow landed (a giant is hit in any of its lanes). */
  | { type: 'hit'; enemy: Enemy; damage: number; armored: boolean; source: string; fx: string; lane: number }
  | { type: 'enemyAttack'; enemy: Enemy }
  /** 六足の虫 jumps over the friend in its way. */
  | { type: 'jump'; enemy: Enemy }
  /** A goblin picked up 草 growing where it passed. */
  | { type: 'steal'; enemy: Enemy; pickup: Pickup }
  /** A goblin defeated: the 草 it carried drop back where it fell. */
  | { type: 'stolenBack'; enemy: Enemy; pickups: Pickup[] }
  /** キメラ, hurt low enough (her ability's `atHp`), stops to draw her claws (once): from then on she is faster. */
  | { type: 'claws'; enemy: Enemy }
  | { type: 'allyHit'; ally: Ally; damage: number; source: string }
  | { type: 'allyCollapse'; ally: Ally }
  | { type: 'enemyCollapse'; enemy: Enemy }
  | { type: 'enemySpawn'; enemy: Enemy }
  | { type: 'weedSprout'; pickup: Pickup }
  | { type: 'weedCollect'; pickup: Pickup; auto: boolean }
  | { type: 'weedWilt'; pickup: Pickup }
  | { type: 'produce'; ally: Ally; pickup: Pickup }
  | { type: 'pull'; ally: Ally; pickup: Pickup }
  | { type: 'song'; enemy: Enemy; allies: Ally[] }
  /** セイレーン stopped to sing: her followers come up one by one through the song ('callUp'). */
  | { type: 'summon'; enemy: Enemy }
  /** One of セイレーン's followers came up round her column (now in its 'spawn' mode). */
  | { type: 'callUp'; enemy: Enemy; mob: Enemy }
  | { type: 'heal'; enemy: Enemy; healed: Enemy[] }
  | { type: 'spell'; enemy: Enemy; allies: Ally[] }
  | { type: 'transformStart'; enemy: Enemy }
  | { type: 'transformEnd'; enemy: Enemy }
  | { type: 'stomp'; enemy: Enemy; ally: Ally }
  | { type: 'spit'; enemy: Enemy; projectile: Projectile }
  | { type: 'spitHit'; ally: Ally; projectile: Projectile }
  /** A shot stopped by a stump (World 2's 切り株), at that point of the lane. */
  | { type: 'blocked'; lane: number; y: number }
  /** A stump took a blow; `broken` if that was its last. `spark`: nothing else shows where it landed (a jab). */
  | { type: 'stumpHit'; lane: number; col: number; broken: boolean; spark: boolean }
  /** 栗まんじゅう's can splashed where it landed (its lane, the spot's hit line), over `tiles` lanes and tiles round it. */
  | { type: 'splash'; lane: number; y: number; tiles: number }
  | { type: 'rescue'; lane: number }
  | { type: 'banner'; kind: 'big' | 'final' | 'boss'; bossId?: string }
  | { type: 'waveStart'; index: number; total: number }
  | { type: 'oneUse'; def: UnitDef; lane: number; col: number }
  /** むちゃうマン's pose is over: every enemy on the field froze. */
  | { type: 'freeze'; lane: number; col: number; enemies: Enemy[] }
  /** A taiyaki is cooked: it is ready to go off. */
  | { type: 'cooked'; ally: Ally }
  /** A taiyaki went off under the enemy that reached it (it is used up: gone from its tile). */
  | { type: 'mine'; ally: Ally }
  /** うさぎ（クール）'s missiles start falling, one for each lane with an enemy in it. */
  | { type: 'missiles'; ally: Ally; projectiles: Projectile[] }
  /** A missile landed and blew up at this point of its lane (a hit line). */
  | { type: 'blast'; lane: number; y: number; source: string }
  /** An enemy pushed back by a jab (ハチワレ（パジャマ）). */
  | { type: 'push'; enemy: Enemy }
  | { type: 'hover'; enemy: Enemy; ally: Ally }
  | { type: 'grab'; enemy: Enemy; ally: Ally }
  | { type: 'drop'; enemy: Enemy; ally: Ally }
  | { type: 'carriedOff'; enemy: Enemy; ally: Ally }
  /** 星's wish came true on this tile: the star turned into its friend (ally), or a one-use friend went (null). */
  | { type: 'wishGranted'; lane: number; col: number; ally: Ally | null }
  | { type: 'won' }
  | { type: 'lost'; lane: number; enemy: Enemy };

export interface SimStats {
  rescuesUsed: number;
  alliesLost: number;
  weedsCollected: number;
  enemiesDefeated: number;
  placed: Record<string, number>;
  defeated: Record<string, number>;
  seen: Record<string, number>;
}
