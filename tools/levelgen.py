"""Compact level authoring -> src/data/levels/world{1,2,3,4,5,6}.json.

Usage (from the project root):  python tools/levelgen.py .      (or: npm run levels)

This script overwrites the six level files, with CRLF line endings like the files it replaces. Either edit levels
here and regenerate, or edit the JSON by hand and stop using this script; do not mix the two without porting changes
back.

Notation per wave: "AT[ flags]: code*count[@lane][!][^mul] ..."
  AT     seconds from level start (the gaps between waves are what count)
  flags  big | final | boss  (announced with a banner 3 s ahead)
  code   t2 gb s6 cd fg mj km hn bs gt zu cb, v2: nm ym dt sr an dk pk  (see CODES below)
  *n     count, @lane a fixed lane (0-4) or @all, ! a boss spawn, ^1.5 an HP multiplier
"""
import json, os, re, sys

ROOT = sys.argv[1]
CODES = {
    't2': 'mushi_twolegs', 'gb': 'goblin', 's6': 'mushi_sixlegs', 'cd': 'chushidesu',
    'fg': 'fugu', 'mj': 'majyo', 'km': 'kimera', 'hn': 'mushi_horned',
    'bs': 'kuroi_nagareboshi', 'gt': 'guchokipanogitaigata', 'zu': 'zou', 'cb': 'chiikabu',
    # v2
    'nm': 'ningyo', 'ym': 'yamanba', 'dt': 'dekai_tori', 'sr': 'seiren', 'an': 'anoko', 'dk': 'dekatsuyo', 'pk': 'mushi_pink',
}

def parse_waves(spec):
    waves = []
    for part in [p.strip() for p in spec.split(';') if p.strip()]:
        head, body = part.split(':', 1)
        bits = head.split()
        w = {'at': int(bits[0])}
        for f in bits[1:]:
            w[f] = True
        spawns = []
        for tok in body.split():
            m = re.fullmatch(r'([a-z0-9]{2})(?:\*(\d+))?(?:@(\d|all))?(!)?(?:\^([\d.]+))?', tok)
            if not m:
                raise SystemExit(f'bad token {tok!r} in {part!r}')
            code, cnt, lane, boss, mul = m.groups()
            s = {'enemy': CODES[code]}
            if cnt and int(cnt) != 1:
                s['count'] = int(cnt)
            if lane:
                s['lane'] = 'all' if lane == 'all' else int(lane)
            if boss:
                s['boss'] = True
            if mul:
                s['hpMul'] = float(mul)
            spawns.append(s)
        w['spawns'] = spawns
        waves.append(w)
    return waves

ALL = [0, 1, 2, 3, 4]
STD_SPROUT = {'firstMs': 2500, 'minMs': 7000, 'maxMs': 10000, 'value': 25, 'lifeMs': 10000}

# Pacing (2026-11-06, owner: the later worlds felt too hard, the waves too quick, too few regular enemies between the
# tough ones). The scripts above are written in World 1's rhythm; pace() then reshapes each level:
#   1. The waves' times are stretched by the world's PACE, so later worlds get real lulls between waves.
#   2. No big enemy (L, XL, a boss, or 六足の虫, who jumps every friend and has to be shot down) comes before EARLY_S: the
#      player builds an economy and a second attacker first.
#      A big one scripted earlier is moved to the first wave at or after EARLY_S, and a basic takes its place.
#   3. Big enemies never come in two waves running (unless the second is the final or a boss wave): the second wave's
#      big ones move on to the wave after it, and basics take their place. When the wave after is the final or a boss
#      wave they are simply let go (basics in their place), so the last wave never piles up.
PACE = {1: 1.0, 2: 1.1, 3: 1.15, 4: 1.25, 5: 1.25, 6: 1.25}
EARLY_S = 90
BIG = {'mushi_sixlegs', 'kimera', 'mushi_horned', 'mushi_pink', 'guchokipanogitaigata', 'zou', 'chiikabu', 'yamanba', 'dekai_tori', 'seiren', 'anoko', 'dekatsuyo'}
BASIC = {1: 'mushi_twolegs', 2: 'goblin', 3: 'goblin', 4: 'mushi_twolegs', 5: 'mushi_twolegs', 6: 'goblin'}

def is_big(s):
    return s['enemy'] in BIG

def basic_like(world, s):
    b = {'enemy': BASIC[world]}
    if s.get('count', 1) != 1:
        b['count'] = s['count']
    return b

def move_bigs(waves, i, to, world):
    """Move wave i's big enemies to wave `to` (or let them go, with `to` None), leaving basics in their place."""
    w = waves[i]
    bigs = [s for s in w['spawns'] if is_big(s)]
    if not bigs:
        return
    w['spawns'] = [s for s in w['spawns'] if not is_big(s)] + [basic_like(world, s) for s in bigs]
    if to is not None:
        waves[to]['spawns'] = waves[to]['spawns'] + bigs

def pace(world, waves):
    k = PACE[world]
    for w in waves:
        w['at'] = int(round(w['at'] * k))
    # 2. Nothing big before EARLY_S.
    late = next((i for i, w in enumerate(waves) if w['at'] >= EARLY_S), None)
    if late is not None:
        for i in range(late):
            move_bigs(waves, i, late, world)
    # 3. Not two waves of big ones running (the final and boss waves may follow anything).
    for i in range(1, len(waves)):
        w = waves[i]
        if w.get('final') or w.get('boss'):
            continue
        if any(is_big(s) for s in waves[i - 1]['spawns']) and any(is_big(s) for s in w['spawns']) and i + 1 < len(waves):
            nxt = waves[i + 1]
            move_bigs(waves, i, None if nxt.get('final') or nxt.get('boss') else i + 1, world)
    return waves

def lvl(world, idx, waves, lanes=ALL, start=50, sprout=None, night=False, forced=None, terrain=(), unlock=None, features=None, first=400, rescues=True):
    d = {
        'id': f'{world}-{idx}', 'world': world, 'index': idx, 'lanes': list(lanes), 'startWeeds': start,
        'sprout': None if night else (sprout or STD_SPROUT), 'deck': {'forced': forced} if forced else {},
        'terrain': [{'lane': l, 'col': r, 'kind': k} for (l, r, k) in terrain],
        'rescues': rescues, 'waves': pace(world, parse_waves(waves)),
        'rewards': {'firstClear': first, 'replay': 50},
    }
    if unlock:
        d['rewards']['unlockCard'] = unlock
    if features:
        d['rewards']['unlockFeatures'] = features
    return d

# The campaign (owner's call, 2026-11-09): six worlds of five jobs, thirty in all, with first clears paying twice what
# they did at ten jobs a world. Enemies come by how hard they are and friends by what answers them, not in the story's
# order: a new friend on every job of World 1, then one every two jobs, each joining just before what it answers. World 5
# brings only フタバ, ヒトハ, 島二郎 and ちいかわ（人魚の島）, World 6 only ハチワレ（パジャマ） and うさぎ（クール）. うさぎ is
# everyone's first friend; シーサー and 星 stay at her なかま屋 (src/data/shop.json). tests/content.test.ts pins the plan.
# The lanes open once, in World 1 (one, then three, then all five), and never close again.

W1 = [
    lvl(1, 1, "24: t2; 48: t2; 70: t2; 90: t2*2; 114 final: t2*3",
        lanes=[2], start=75, sprout={'firstMs': 2500, 'minMs': 6000, 'maxMs': 9000, 'value': 25, 'lifeMs': 12000},
        forced=['usagi'], unlock='chiikawa', first=300),
    lvl(1, 2, "24: t2; 46: t2; 66: t2*2; 86: t2*2; 106: t2*2; 130 final: t2*5",
        lanes=[1, 2, 3], unlock='yoroi'),
    # 中止で〜す's lunge lands on 鎧さん, who has just joined...
    lvl(1, 3, "24: t2; 46: t2; 66: cd; 86: t2*2; 106: t2*2 cd; 130 final: t2*4 cd*2",
        lanes=[1, 2, 3], unlock='hachiware'),
    # ...and then the six-legged bug jumps over him: walls do not stop everyone, so ハチワレ's harder jabs come next.
    lvl(1, 4, "24: t2; 46: t2; 70: t2*2; 92: t2 cd; 114: s6^0.7 t2; 136: t2*2 cd; 160 final: t2*5 s6^0.7 cd",
        unlock='kurimanju'),
    # The bugs' boss, at a toughness that suits the fifth job of the game. Endless mode opens after World 6, not here.
    lvl(1, 5, "24: t2; 46: t2*2; 66: cd t2; 88: t2*2; 110 big: t2*6 s6^0.7; 134: cd t2*2; 156: t2*3; 184 final boss: pk!^0.6 t2*6 s6^0.7 cd",
        unlock='furuhonya', features=['speed'], first=600),
]

ST = 'stump'; BU = 'bush'
W2 = [
    lvl(2, 1, "24: gb; 46: gb; 66: gb t2; 86: s6 gb; 106 big: gb*5 s6; 130: gb*2 cd; 152: gb*2 s6; 178 final: gb*6 s6*2 cd",
        terrain=[(1, 5, ST), (3, 2, ST), (0, 3, ST), (4, 6, ST)]),
    lvl(2, 2, "24: gb; 46: fg; 66: gb*2; 86: fg s6; 106 big: gb*5 fg*2; 130: fg cd gb; 152: s6 fg; 180 final: gb*7 fg*3 s6*2 cd",
        terrain=[(2, 4, ST), (0, 6, ST), (4, 2, ST)], unlock='taiyaki'),
    # The first bushes stand well up the field, so whoever hides in one comes out before reaching anyone.
    lvl(2, 3, "24: gb; 46: mj; 66: gb fg; 86: mj gb; 106 big: gb*5 mj*2; 130: s6 fg; 152: cd mj gb*2; 180 final: gb*6 mj*2 s6 cd fg",
        terrain=[(1, 6, BU), (3, 6, BU), (0, 6, ST), (4, 1, ST), (2, 7, BU)]),
    lvl(2, 4, "24: gb; 46: gb bs; 68: fg gb; 90: gb*2 mj; 112 big: gb*6 s6 bs; 136: mj fg; 158: cd bs gb; 186 final: gb*7 s6 bs*2 mj fg",
        terrain=[(0, 5, BU), (4, 5, BU), (2, 1, ST), (1, 7, ST), (3, 3, ST)], unlock='momonga'),
    lvl(2, 5, "24: gb; 46: gb*2; 68: fg gb; 90: cd mj bs; 112 big: gb*6 s6 mj; 136: fg bs gb; 160 big: gb*5 cd mj bs; 196 final boss: gt! gb*5 s6 mj",
        terrain=[(0, 4, ST), (4, 4, ST), (2, 6, BU)], first=600),
]

W3 = [
    lvl(3, 1, "24: gb; 46: fg*2; 66: mj gb; 86: dt cd; 106 big: gb*7 fg*2 mj; 130: dt gb; 152: cd*2 fg; 180 final: gb*7 fg*2 mj s6 dt",
        unlock='ode'),
    lvl(3, 2, "24: gb; 46: gb fg; 66: gb*2 mj; 88: km s6; 110 big: gb*6 cd s6; 134: km mj gb; 156: s6*2 bs; 184 final: gb*6 km*2 s6 cd fg"),
    # パジャマパーティーズ join two jobs after the bird that kidnapped them in the story comes in.
    lvl(3, 3, "24: gb; 46: fg mj; 66: gb*2; 86: dt s6; 106 big: gb*6 fg*2 mj; 130: km cd; 152: fg*2 bs; 182 final: gb*7 fg*3 km mj*2 s6*2",
        unlock='pajama_parties'),
    lvl(3, 4, "24: gb; 46: gb fg; 66: fg mj; 88: km gb; 110 big: gb*7 mj fg; 134 boss: zu!^0.8 gb*3; 160: km fg*2; 190 final: gb*8 km mj*2 fg*2"),
    lvl(3, 5, "24: gb; 46: fg gb; 68: gb mj; 90: km cd; 112 big: gb*7 fg*2 bs; 136: dt gb; 158: mj cd; 182 big: gb*7 zu fg*2; 218 final boss: cb! gb*7 km*2 mj*2 fg*2",
        unlock='rakko', first=800),
]

# World 4 夜: nothing sprouts at night (sprout null), so only ちいかわ makes 草 and every job starts with more of it.
# 4-1 is the night on its own; ラッコ's blows meet the horned bug at 4-2, むちゃうマン's freeze meets 山姥 at 4-3, ゾウ comes
# back at 4-4, and 偉い鎧さん holds the first giant, あのこ. (The harder でかつよ closes the game instead.)
NIGHT_START = 250

def night(idx, waves, start=NIGHT_START, **kw):
    return lvl(4, idx, waves, start=start, night=True, **kw)

W4 = [
    night(1, "30: t2; 54: t2; 76: t2*2; 98: t2*2 bs; 120 big: t2*5 s6; 146: t2*3; 170: s6 bs t2; 198 final: t2*6 s6 bs"),
    night(2, "28: t2; 50: t2*2; 74: hn; 98: t2*2; 120 big: t2*5 s6; 146: hn t2; 170: t2*2 bs; 198 final: t2*6 s6 hn bs",
          unlock='muchauman'),
    night(3, "28: t2; 50: t2*2; 74: ym; 98: t2*2 bs; 120 big: t2*6 s6; 146: ym bs; 170: hn t2; 198 final: t2*6 s6 ym bs"),
    night(4, "28: t2; 50: t2 bs; 74: hn; 96: t2*2 bs; 118 big: t2*7 bs; 142: ym bs; 166: zu^0.8 t2; 190 big: t2*6 s6; 222 final: t2*7 hn ym bs*2",
          unlock='yoroi_erai'),
    night(5, "28: t2; 50: t2 bs; 74: ym; 98: t2*2 bs; 120 big: t2*6 s6; 146: hn bs; 170: ym t2; 194 big: t2*6 bs; 232 final boss: an! t2*6 s6 bs*2",
          first=800),
]

# World 5 島: the bottom lane is the sea along the shore (worlds.json `water`). 人魚 (in threes) and the boss セイレーン come
# down it and nobody else does; only the islanders can stand on it: フタバ and ヒトハ throwing from their boats, and
# 島二郎, who swims, as its wall. Friends in the lane above help from the land (モモンガ's throw reaches it). 5-1 has no
# water friend yet: the land defends the water. The islanders come one job after another, since nobody else can stand
# on the water, and ちいかわ（人魚の島） joins for beating セイレーン.

def isle(idx, waves, **kw):
    return lvl(5, idx, waves, **kw)

W5 = [
    isle(1, "24: t2; 46: fg; 68: t2*2; 90: nm t2; 112 big: t2*5 fg*2; 136: fg t2*2; 160: nm; 186 final: t2*6 fg*3 nm",
         unlock='futaba'),
    isle(2, "24: t2; 46: nm; 66: fg t2; 88: nm t2; 110 big: t2*6 fg*2 nm; 134: s6 nm; 156: fg*2 t2; 182 final: t2*7 s6 fg*2 nm*2",
         unlock='hitoha'),
    isle(3, "24: t2; 46: mj; 66: nm fg; 88: mj t2*2; 110 big: t2*6 mj*2 nm; 134: nm s6; 156: fg*2 mj; 184 final: t2*7 mj*3 fg*2 nm*2",
         unlock='shimajiro'),
    isle(4, "24: t2; 46: nm fg; 68: t2*3; 90: km nm; 112 big: t2*8 s6 fg nm*2; 136: hn t2; 158: nm*2 mj; 180 big: t2*6 fg*2 nm; 210 final: t2*7 km hn mj nm*2"),
    isle(5, "24: t2; 46: nm fg; 68: t2*2; 90: km nm; 112 big: t2*8 fg*2 nm*2; 136: hn nm; 158: s6*2 mj*2; 182 big: t2*7 km fg*2 nm*2; 218 final boss: sr! t2*7 km*2 fg*2 nm*2",
         unlock='chiikawa_island', first=800),
]

# World 6 おっきい討伐: the big hunt. Rakko is not on it, so there is no rescue car: whatever reaches the landing spot
# ends the job. The big ones come out of the tall grass, a mixed roster from every world, with ゾウ and 擬態型 as mid-level
# threats and でかつよ, the toughest of all, as the boss. Clearing 6-5 opens endless mode, the 討伐ランキング. With no car to
# catch a slip, every job starts with more 草.
HUNT_START = 100

def hunt(idx, waves, start=HUNT_START, **kw):
    return lvl(6, idx, waves, start=start, rescues=False, **kw)

W6 = [
    hunt(1, "24: gb; 46: gb*2; 68: gb*2; 90: hn; 112 big: gb*6 km; 136: ym gb; 158: km mj; 186 final: gb*7 km hn s6"),
    hunt(2, "24: gb; 46: gb*2; 68: gb mj; 90: dt; 112 big: gb*6 ym; 136: km bs; 158: dt gb*2; 186 final: gb*7 ym km hn dt",
         unlock='hachiware_pajama'),
    hunt(3, "24: gb; 46: gb*2; 68: hn; 90: ym dt; 112 big: gb*7 hn; 136 boss: zu! gb*3; 160: km mj; 188 final: gb*7 zu km ym dt"),
    hunt(4, "24: gb; 46: gb*2; 68: ym mj; 90: hn dt; 112 big: gb*7 km bs; 136 boss: gt! gb*2; 160: ym km; 184 big: gb*6 dt mj; 214 final: gb*7 km ym hn",
         unlock='usagi_cool'),
    hunt(5, "24: gb; 46: gb*2; 68: gb mj; 90: km gb; 112 big: gb*8 ym; 136: hn bs; 160: km mj; 184 big: gb*7 dt ym; 222 final boss: dk! gb*7 km ym",
         features=['endless'], first=1000),
]


def one(v):
    return json.dumps(v, ensure_ascii=False, separators=(', ', ': '))

def dump_levels(levels):
    """Readable JSON: one line per spawn, terrain tile, lane list and sprout setting."""
    out = ['[']
    for li, l in enumerate(levels):
        out.append('  {')
        keys = list(l.keys())
        for ki, k in enumerate(keys):
            v = l[k]
            comma = ',' if ki < len(keys) - 1 else ''
            if k == 'waves':
                out.append('    "waves": [')
                for wi, w in enumerate(v):
                    head = {kk: vv for kk, vv in w.items() if kk != 'spawns'}
                    out.append('      { ' + ', '.join('"%s": %s' % (kk, one(vv)) for kk, vv in head.items()) + ', "spawns": [')
                    for si, sp in enumerate(w['spawns']):
                        out.append('        ' + one(sp) + (',' if si < len(w['spawns']) - 1 else ''))
                    out.append('      ] }' + (',' if wi < len(v) - 1 else ''))
                out.append('    ]' + comma)
            elif k == 'terrain' and v:
                out.append('    "terrain": [')
                for ti, t in enumerate(v):
                    out.append('      ' + one(t) + (',' if ti < len(v) - 1 else ''))
                out.append('    ]' + comma)
            else:
                out.append('    "%s": %s%s' % (k, one(v), comma))
        out.append('  }' + (',' if li < len(levels) - 1 else ''))
    out.append(']')
    return '\n'.join(out) + '\n'

out = os.path.join(ROOT, 'src', 'data', 'levels')
os.makedirs(out, exist_ok=True)
for n, levels in ((1, W1), (2, W2), (3, W3), (4, W4), (5, W5), (6, W6)):
    with open(os.path.join(out, f'world{n}.json'), 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(dump_levels(levels))
    total = sum(sum(s.get('count', 1) * (5 if s.get('lane') == 'all' else 1) for w in l['waves'] for s in w['spawns']) for l in levels)
    print(f'world{n}: {len(levels)} levels, {total} enemies')
