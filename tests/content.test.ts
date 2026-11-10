import { describe, expect, it } from 'vitest';
import shop from '../src/data/shop.json';
import { BOT_CASUAL, BOT_GOOD, botDeck, runBot } from '../src/game/sim/bot';
import { ENEMIES, ENEMY_LIST, fitsJob, LEVEL_LIST, LEVELS, newEnemiesInLevel, rewardsOwed, summonsOf, UNIT_LIST, validateContent, waterOf, WORLDS } from '../src/game/sim/defs';
import { simForEndless, simForLevel } from '../src/game/sim/sim';

describe('content', () => {
  it('has 30 campaign levels, five in each of 6 worlds', () => {
    expect(LEVEL_LIST.length).toBe(30);
    expect(new Set(LEVEL_LIST.map((l) => l.world))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    for (const world of [1, 2, 3, 4, 5, 6]) expect(LEVEL_LIST.filter((l) => l.world === world).map((l) => l.index)).toEqual([1, 2, 3, 4, 5]);
  });

  it('opens the lanes once, in World 1: none that has opened ever closes again', () => {
    let open: number[] = [];
    for (const l of LEVEL_LIST) {
      for (const lane of open) expect(l.lanes, `${l.id} closes lane ${lane}`).toContain(lane);
      open = l.lanes;
      if (l.world > 1) expect(l.lanes, l.id).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it('passes validation', () => {
    expect(validateContent()).toEqual([]);
  });

  it('brings in every friend exactly once, from a job or from the shop', () => {
    const unlocks = LEVEL_LIST.map((l) => l.rewards.unlockCard).filter(Boolean) as string[];
    const sold = shop.sellers.flatMap((s) => s.items.map((i) => (i as { card?: string }).card)).filter(Boolean) as string[];
    const all = [...unlocks, ...sold];
    expect(all.length).toBe(new Set(all).size);
    // うさぎ is everyone's first friend (owner's call, 2026-11-08).
    expect([...all, 'usagi'].sort()).toEqual(UNIT_LIST.map((u) => u.id).sort());
    expect(LEVELS['1-1'].deck.forced).toEqual(['usagi']);
    // シーサー and 星 join only from her なかま屋 in the shop.
    expect([...sold].sort()).toEqual(['hoshi', 'shisa']);
    // ポシェットの鎧さん is no friend any more (owner's call, 2026-11-08): he keeps his shop, and stands among the people.
    expect(UNIT_LIST.some((u) => u.id === 'yoroi_pochette')).toBe(false);
  });

  // The campaign's plan (owner's call, 2026-11-09): enemies by how hard they are, each friend just before what it answers.
  it('has each friend join after the job the plan gives it', () => {
    const joins = Object.fromEntries(LEVEL_LIST.filter((l) => l.rewards.unlockCard).map((l) => [l.id, l.rewards.unlockCard]));
    expect(joins).toEqual({
      '1-1': 'chiikawa',
      '1-2': 'yoroi',
      '1-3': 'hachiware',
      '1-4': 'kurimanju',
      '1-5': 'furuhonya',
      '2-2': 'taiyaki',
      '2-4': 'momonga',
      '3-1': 'ode',
      '3-3': 'pajama_parties',
      '3-5': 'rakko',
      '4-2': 'muchauman',
      '4-4': 'yoroi_erai',
      '5-1': 'futaba',
      '5-2': 'hitoha',
      '5-3': 'shimajiro',
      '5-5': 'chiikawa_island',
      '6-1': 'hachiware_pajama',
      '6-2': 'usagi_cool',
    });
  });

  it('brings each enemy in on the job the plan gives it', () => {
    const debuts = LEVEL_LIST.map((l) => [l.id, newEnemiesInLevel(l)] as const).filter(([, ids]) => ids.length);
    expect(Object.fromEntries(debuts)).toEqual({
      '1-1': ['mushi_twolegs'],
      '1-3': ['chushidesu'],
      '1-4': ['mushi_sixlegs'],
      '1-5': ['mushi_pink'],
      '2-1': ['goblin'],
      '2-2': ['fugu'],
      '2-3': ['majyo'],
      '2-4': ['kuroi_nagareboshi'],
      '2-5': ['guchokipanogitaigata'],
      '3-1': ['dekai_tori'],
      '3-2': ['kimera'],
      '3-4': ['zou'],
      '3-5': ['chiikabu'],
      '4-2': ['mushi_horned'],
      '4-3': ['yamanba'],
      '4-5': ['anoko'],
      '5-1': ['ningyo'],
      '5-5': ['seiren'],
      '6-5': ['dekatsuyo'],
    });
  });

  it('gives a friend on every job of World 1, and then never on two jobs running until World 5 (Worlds 5 and 6 bring theirs early)', () => {
    const gives = (world: number, index: number) => !!LEVELS[`${world}-${index}`]?.rewards.unlockCard;
    for (const l of LEVEL_LIST) {
      if (l.world === 1) expect(gives(1, l.index), l.id).toBe(true);
      else if (l.world < 5) expect(gives(l.world, l.index) && gives(l.world, l.index - 1), l.id).toBe(false);
    }
  });

  it('ends every world with its boss, each of the last ones tougher than the one before on paper', () => {
    const bosses = [1, 2, 3, 4, 5, 6].map((world) => {
      const last = LEVELS[`${world}-5`].waves[LEVELS[`${world}-5`].waves.length - 1];
      expect(last.final && last.boss, `${world}-5`).toBe(true);
      return last.spawns.filter((s) => s.boss).map((s) => s.enemy);
    });
    expect(bosses).toEqual([['mushi_pink'], ['guchokipanogitaigata'], ['chiikabu'], ['anoko'], ['seiren'], ['dekatsuyo']]);
    expect(ENEMIES.dekatsuyo.hp).toBeGreaterThan(ENEMIES.anoko.hp);
  });

  it('pays enough over one run through the campaign for everything lasting in the shop', () => {
    const paid = LEVEL_LIST.reduce((n, l) => n + l.rewards.firstClear, 0);
    const lasting = shop.sellers
      .flatMap((s) => s.items as { prices: number[]; consumable?: boolean }[])
      .filter((i) => !i.consumable)
      .reduce((n, i) => n + i.prices.reduce((a, b) => a + b, 0), 0);
    expect(paid).toBeGreaterThanOrEqual(lasting);
  });

  it('calls up only enemies there are: one that lives on water for a water lane, one that walks for land', () => {
    for (const e of ENEMY_LIST) {
      for (const a of e.abilities) {
        if (a.kind !== 'summon') continue;
        expect(ENEMIES[a.water]?.aquatic, `${e.id} → ${a.water}`).toBe(true);
        expect(ENEMIES[a.land] && !ENEMIES[a.land].aquatic, `${e.id} → ${a.land}`).toBe(true);
      }
    }
  });

  it('uses every enemy somewhere in the campaign', () => {
    const used = new Set(LEVEL_LIST.flatMap((l) => l.waves.flatMap((w) => w.spawns.map((s) => s.enemy))));
    // Those that come only when another calls them up (セイレーン's followers) come wherever it does.
    for (const id of [...used]) for (const c of summonsOf(id)) used.add(c);
    for (const e of ENEMY_LIST) expect(used.has(e.id), e.id).toBe(true);
  });
});

describe('World 4 (night)', () => {
  const night = LEVEL_LIST.filter((l) => l.world === 4);

  it('has nothing sprouting, and only there: ちいかわ makes every 草, so the jobs start with more', () => {
    expect(night.length).toBe(5);
    for (const l of LEVEL_LIST) expect(l.sprout === null).toBe(l.world === 4);
    for (const l of night) expect(l.startWeeds).toBeGreaterThan(50);
  });

  it('brings in 虫ツノ at 4-2 and 山姥 at 4-3, and ends with あのこ as the boss, nothing else new', () => {
    expect(night.map((l) => newEnemiesInLevel(l).join()).filter(Boolean)).toEqual(['mushi_horned', 'yamanba', 'anoko']);
    expect(newEnemiesInLevel(LEVELS['4-3'])).toEqual(['yamanba']);
    const last = LEVELS['4-5'].waves[LEVELS['4-5'].waves.length - 1];
    expect(last.final && last.boss).toBe(true);
    expect(last.spawns.filter((s) => s.boss).map((s) => s.enemy)).toEqual(['anoko']);
  });

  it('keeps 黒い星 in every job and brings ゾウ back at 4-4, never as the last boss', () => {
    const has = (id: string) => night.filter((l) => l.waves.some((w) => w.spawns.some((s) => s.enemy === id))).map((l) => l.id);
    expect(has('kuroi_nagareboshi').length).toBe(5);
    expect(has('zou')).toEqual(['4-4']);
  });
});

describe('World 5 (the island)', () => {
  const isle = LEVEL_LIST.filter((l) => l.world === 5);

  it('has its bottom lane as sea in every job, and only World 5 has water', () => {
    expect(isle.length).toBe(5);
    expect(WORLDS[5].water).toEqual([4]);
    for (const l of LEVEL_LIST) expect(waterOf(l).length > 0).toBe(l.world === 5);
    for (const l of isle) expect(waterOf(l)).toEqual([4]);
    expect(isle.map((l) => l.lanes.length)).toEqual([5, 5, 5, 5, 5]);
  });

  it('sends 人魚 down the water in every job and ends with セイレーン as the boss', () => {
    for (const l of isle) expect(l.waves.some((w) => w.spawns.some((s) => s.enemy === 'ningyo'))).toBe(true);
    const last = LEVELS['5-5'].waves[LEVELS['5-5'].waves.length - 1];
    expect(last.final && last.boss).toBe(true);
    expect(last.spawns.filter((s) => s.boss).map((s) => s.enemy)).toEqual(['seiren']);
    expect(ENEMIES.ningyo.aquatic && ENEMIES.seiren.aquatic).toBe(true);
  });

  it('brings フタバ, ヒトハ and 島二郎, the only friends who go on the water, then ちいかわ（人魚の島）, and nobody else', () => {
    expect(isle.filter((l) => l.rewards.unlockCard).map((l) => [l.id, l.rewards.unlockCard])).toEqual([
      ['5-1', 'futaba'],
      ['5-2', 'hitoha'],
      ['5-3', 'shimajiro'],
      ['5-5', 'chiikawa_island'],
    ]);
    expect(UNIT_LIST.filter((u) => u.aquatic).map((u) => u.id).sort()).toEqual(['futaba', 'hitoha', 'shimajiro']);
    // The pair throw (フタバ through everyone, ヒトハ hard at one), and 島二郎 is the water's wall.
    expect(UNIT_LIST.filter((u) => u.aquatic && u.wall).map((u) => u.id)).toEqual(['shimajiro']);
  });

  it('hands 島二郎 to a save that cleared 5-3 before he was its reward', () => {
    const cleared = Object.fromEntries(['5-1', '5-2', '5-3'].map((id) => [id, { stars: 3, clears: 1 }]));
    expect(rewardsOwed(cleared, ['hachiware', 'futaba', 'hitoha'])).toEqual(['shimajiro']);
    expect(rewardsOwed(cleared, ['hachiware', 'futaba', 'hitoha', 'shimajiro'])).toEqual([]);
    expect(rewardsOwed({}, ['hachiware'])).toEqual([]);
  });
});

describe('World 6 (the big hunt)', () => {
  const hunt = LEVEL_LIST.filter((l) => l.world === 6);

  it('has no rescue car, and only there (Rakko is not on this hunt), so its jobs start with more 草', () => {
    expect(hunt.length).toBe(5);
    for (const l of LEVEL_LIST) expect(l.rescues).toBe(l.world !== 6);
    for (const l of hunt) expect(l.startWeeds).toBeGreaterThan(50);
    // Rakko the friend stays home with his car, wherever it does not come; endless mode has the cars.
    for (const l of LEVEL_LIST) expect(fitsJob('rakko', l)).toBe(l.rescues);
    expect(fitsJob('rakko', undefined)).toBe(true);
  });

  it('ends with でかつよ as the boss, and brings only ハチワレ（パジャマ） and うさぎ（クール）', () => {
    const last = LEVELS['6-5'].waves[LEVELS['6-5'].waves.length - 1];
    expect(last.final && last.boss).toBe(true);
    expect(last.spawns.filter((s) => s.boss).map((s) => s.enemy)).toEqual(['dekatsuyo']);
    expect(hunt.filter((l) => l.rewards.unlockCard).map((l) => [l.id, l.rewards.unlockCard])).toEqual([
      ['6-1', 'hachiware_pajama'],
      ['6-2', 'usagi_cool'],
    ]);
  });

  it('opens endless mode at 6-5, and nowhere else', () => {
    expect(LEVEL_LIST.filter((l) => l.rewards.unlockFeatures?.includes('endless')).map((l) => l.id)).toEqual(['6-5']);
  });

  it('brings the big ones out of the tall grass: something large in every job', () => {
    for (const l of hunt) {
      const big = l.waves.some((w) => w.spawns.some((s) => ['L', 'XL'].includes(ENEMIES[s.enemy].size)));
      expect(big, l.id).toBe(true);
    }
  });
});

describe('balance', () => {
  // The bots stand in for players: the good one (quick taps, a full build) must win every level on each of its first
  // three tries, and the casual one (3.5 s to tap a sprout, a shallower build), closer to a person on a phone, on two of
  // them. A try's randomness is the one the game gives it (attempt 0 is the first: see simForLevel), not a made-up seed.
  it('every level is won by the good bot on each of its first three tries and by the casual bot on two', { timeout: 480000 }, () => {
    const failures: string[] = [];
    for (const level of LEVEL_LIST) {
      const deck = botDeck(level);
      const good = [0, 1, 2].filter((attempt) => runBot(simForLevel(level, deck, { attempt }), BOT_GOOD).won).length;
      const casual = [0, 1, 2].filter((attempt) => runBot(simForLevel(level, deck, { attempt }), BOT_CASUAL).won).length;
      if (good < 3 || casual < 2) failures.push(`${level.id} good ${good}/3 casual ${casual}/3`);
    }
    expect(failures).toEqual([]);
  });

  it('endless mode keeps going and gets harder', () => {
    // Six runs, each its own seed: the bot gets past the first big wave in all but one at most, and its runs end
    // anywhere from about a dozen enemies to seventy, by seed. Single runs swing with any change to enemy health (in
    // 2026-11-10's every-enemy-weaker pass the six went further on average, 25 -> 41 enemies, while seed 3 alone ended
    // at wave 5), so no one seed is pinned.
    const runs = [1, 2, 3, 4, 5, 6].map((seed) => {
      const sim = simForEndless(
        ENEMY_LIST.filter((e) => !e.summonOnly).map((e) => e.id),
        ['chiikawa', 'usagi', 'yoroi', 'hachiware', 'momonga', 'yoroi_erai', 'kurimanju'],
        { seed },
      );
      const r = runBot(sim, BOT_GOOD, 8 * 60 * 1000);
      return { wave: sim.waves.currentWave(), defeated: r.enemiesDefeated };
    });
    expect(runs.filter((r) => r.wave > 5).length).toBeGreaterThanOrEqual(runs.length - 1);
    expect(runs.reduce((n, r) => n + r.defeated, 0) / runs.length).toBeGreaterThan(15);
  });
});
