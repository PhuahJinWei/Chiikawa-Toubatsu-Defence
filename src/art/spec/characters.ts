// Every battle character: its size, which way it faces, the moves it makes, and what it is like (for whoever draws it).
// Its pictures are frames in art/sprites/<id>/, drawn by src/art/sprite.ts. Friends and Rakko's car and boat face right;
// enemies face left.

import type { CharacterSpec, Text, Tier } from './types';

interface Opts {
  motions?: string[];
  height?: number;
}

const ally = (subject: string, tier: Tier, note: Text, o: Opts = {}): CharacterSpec => ({
  id: `ally_${subject}`,
  group: 'ally',
  subject,
  tier,
  height: o.height,
  facing: 1,
  // Friends have no defeat frames (owner's call, 2026-11-08): beaten, they just fade away.
  motions: o.motions ?? ['idle', 'attack'],
  note,
});

const enemy = (subject: string, tier: Tier, note: Text, o: Opts = {}, id = `enemy_${subject}`): CharacterSpec => ({
  id,
  group: 'enemy',
  subject,
  tier,
  height: o.height,
  facing: -1,
  motions: o.motions ?? ['idle', 'walk', 'attack', 'collapse'],
  note,
});

export const ALLY_CHARACTERS: CharacterSpec[] = [
  ally(
    'chiikawa',
    'S',
    {
      ja: 'ふだんはすわって草をさがしていて（weed_search）、ときどき草を見つけて、かかげる（weed_found：草は絵に描きこむ）。手に入った草は、その手から草の数へとんでいく。となりに生えた草は、自分でぬく。攻撃しない。',
      en: 'Sits searching for 草 (weed_search), now and then finds some and holds it up (weed_found: the 草 is part of the picture), and it flies from her hand to the count. Pulls up weeds that sprout beside her too. Never attacks.',
    },
    { motions: ['idle', 'weed_search', 'weed_found', 'pull'] },
  ),
  ally(
    'chiikawa_island',
    'S',
    {
      ja: 'ちいかわ（人魚の島）：オーナーの絵のとおり、ピンクの花かんむりと緑のこしみのをつけた、島すがたのちいかわ（原作8巻の表紙の姿）。手前の手に火のついたたいまつを持ち、前へつき出して炎をひとつ飛ばす（たいまつと炎は、このゲームでの動き）。炎はいちばん近い1体に強く当たり、燃えうつらない。',
      en: 'ちいかわ（人魚の島）: as in the owner’s picture, Chiikawa in island dress, with a pink flower crown and a green grass skirt (as on the cover of manga volume 8). Holds a lit torch in the near hand and thrusts it forward to send one flame flying (the torch and the flame are this game’s own). The flame hits the nearest enemy hard; nothing catches fire.',
    },
  ),
  ally('hachiware', 'S', { ja: 'さすまたで前3マスを突く。', en: 'Jabs 3 tiles ahead with the さすまた.' }),
  ally(
    'hachiware_pajama',
    'S',
    {
      ja: 'ハチワレ（パジャマ）：オーナーの絵のとおり、ネコ耳のフードがついた水色のパジャマ（ポシェットの鎧さんのパジャマ）を着たハチワレ。手前の手にデッキブラシ（パジャマパーティーズの代わりにステージに立つことになったとき、うさぎがもってきたデッキブラシで大きな鳥に立ち向かった）。ブラシで前3マスまでの相手をつき、うしろへおし返す（おし返しは、このゲームでの動き）。',
      en: 'ハチワレ（パジャマ）: as in the owner’s picture, Hachiware in pale-blue pajamas with a cat-eared hood (Pochette 鎧さん’s pajamas). Holds a deck brush in the near hand (standing in for the Pajama Parties, the trio faced the giant bird with the deck brushes Usagi brought). Pokes enemies up to 3 tiles ahead with the brush and pushes them back (the push is this game’s own).',
    },
  ),
  ally(
    'yoroi',
    'M',
    { ja: '壁。攻撃しない。HPが減ると、絵が「へこみ（damaged1）」「ひび（damaged2）」に替わる。', en: 'Wall. Never attacks. As HP drops, it swaps to its dented (damaged1) and cracked (damaged2) pictures.' },
    { motions: ['idle', 'damaged1', 'damaged2'] },
  ),
  ally(
    'yoroi_erai',
    'M',
    {
      ja: '偉い鎧さん：金色のよろいを着た、鎧さんたちの上司みたいな鎧さん。頭に王冠のようなかざり。ふつうの鎧さんと同じ背の高さで、ずっとじょうぶな壁（このゲームでの動き）。攻撃しない。HPが減ると、絵が「へこみ（damaged1）」「ひび（damaged2）」に替わる。',
      en: '偉い鎧さん: a 鎧さん in gold armour, like a boss to the others, with a crown-like ornament on the head. As tall as the ordinary 鎧さん, and a far tougher wall (this game’s own). Never attacks. As HP drops, it swaps to its dented (damaged1) and cracked (damaged2) pictures.',
    },
    { motions: ['idle', 'damaged1', 'damaged2'] },
  ),
  // A friend's height counts everything on top of it: うさぎ's long ears and 古本屋's crab would shrink their bodies next to
  // everyone else's (owner's call, 2026-11-08), so these stand taller, their heads as wide as the others'.
  ally('usagi', 'S', { ja: '討伐棒を振り下ろして、爆風を飛ばす（いちばん近い1体に当たる）。', en: 'Swings the 討伐棒 down and sends a blast flying (it hits the nearest enemy).' }, { height: 196 }),
  ally(
    'usagi_cool',
    'S',
    {
      ja: 'うさぎ（クール）：オーナーの絵のとおり、黒いサングラスをかけたうさぎ（この見た目は、このゲームのオリジナル）。置かれたら、ポーズをきめたままじっとしていて、攻撃の動きはない。そのあいだ、相手のいるレーンに空からミサイルが落ちてきて、落ちたところのまわりの相手に当たる（このゲームでの動き。ミサイルは fx_missile、爆発は fx_boom）。',
      en: 'うさぎ（クール）: as in the owner’s picture, Usagi in black sunglasses (this look is this game’s own). Once placed it just holds its pose, with no attack motion; meanwhile missiles fall from the sky on every lane with an enemy and hit the enemies round where they land (this game’s own; the missile is fx_missile, the blast fx_boom).',
    },
    { motions: ['idle'], height: 196 },
  ),
  ally('momonga', 'S', { ja: '自分と左右のレーンにどんぐりを投げる。動かない。', en: 'Throws acorns into its own and both neighbouring lanes. Never moves.' }),
  ally('kurimanju', 'S', { ja: '缶を山なりに投げる。壁を越え、落ちたところで3×3マスにしぶきが広がる（しぶきの絵：fx_can_splash）。', en: 'Lobs a can over walls; it splashes over the 3×3 tiles where it lands (the splash: fx_can_splash).' }),
  ally('shisa', 'S', { ja: 'ゴーヤを投げて相手を遅くする。', en: 'Throws ゴーヤ that slow the enemy.' }),
  ally(
    'ode',
    'L',
    {
      ja: '1回だけ使える。置いたレーンのはしから大男のオデが走ってきて、レーンを右はしまでかけぬけ、ぶつかった相手をみんな倒す（ラッコのくるまと同じ。このゲームでの動き）。走る（walk）の絵を使う：右向きに全力で走る。',
      en: 'One use. The big man オデ comes running in from the base end of the lane and sprints all the way along it, knocking down every enemy he runs into (as Rakko’s car does; this game’s own). His run is his walk: sprinting to the right, flat out.',
    },
    { motions: ['idle', 'walk'] },
  ),
  ally(
    'pajama_parties',
    'S',
    {
      ja: 'アイドルグループ。カードを使うと4人のうちのだれか1人がランダムで来る（オーナーの絵は1人ずつ：ally_pajama_parties_green・pink・purple・white）。攻撃しない。おどって歌うと（ability）、同じレーンのなかまの攻撃が速くなる。',
      en: 'The idol group. Each time the card is used one of the four comes, at random (the owner’s frames are one member each: ally_pajama_parties_green, pink, purple and white). Never attacks: while dancing and singing (ability), friends in their lane attack faster.',
    },
    { motions: ['idle', 'song'] },
  ),
  ally(
    'furuhonya',
    'S',
    {
      ja: '古本屋（カニちゃん）。うすいピンク色の小さなちいかわ族で、丸い耳。モモンガにもらったカニのカチューシャ（上にカニが乗って、はさみを上げている）。本を2冊つづけて投げる（このゲームでの動き。本は fx_book）。',
      en: '古本屋 (カニちゃん): a small pale-pink Chiikawa-folk with round ears, wearing the crab headband Momonga gave it (the crab sits on top, claws up). Throws books, two in a row (this game’s own; the book is fx_book).',
    },
    { height: 176 },
  ),
  ally(
    'futaba',
    'S',
    {
      ja: 'フタバ：島の子（映画『人魚の島のひみつ』）。いつもヒトハといっしょ。小さな木のボートに乗って、水のレーンにだけ置ける。貝がらを水切りのように投げ、貝がらはレーンの相手みんなをつきぬける。ヒトハがとなりにいると、投げるのが速くなる。',
      en: 'フタバ: an islander from the film 『人魚の島のひみつ』, always with ヒトハ. Sits in a little wooden rowboat and goes only on the water lane. Skims seashells that go through every enemy in the lane, faster with ヒトハ beside it.',
    },
  ),
  ally(
    'hitoha',
    'S',
    {
      ja: 'ヒトハ：島の子（映画『人魚の島のひみつ』）。いつもフタバといっしょ。小さな木のボートに乗って、水のレーンにだけ置ける。大きな巻き貝を投げて、いちばん近い1体に強く当てる。フタバがとなりにいると、投げるのが速くなる。',
      en: 'ヒトハ: an islander from the film 『人魚の島のひみつ』, always with フタバ. Sits in a little wooden rowboat and goes only on the water lane. Throws a big spiral shell that hits the nearest enemy hard, faster with フタバ beside it.',
    },
  ),
  ally(
    'rakko',
    'S',
    {
      ja: 'ラッコ：討伐ランキング1位の「先生」。オーナーのくるまとボートの絵のとおり、クリーム色のまるい顔（ふちはツンツンした毛）、横に小さな黒い耳、額に星形の傷あと、首に白いマフラー。体も同じクリーム色。手前の前足に剣を持つ（剣で討伐するのは原作どおり）。最前線に立って剣を前にふりはらい、自分のレーンと上下のレーンの、目の前と1マス先の相手を斬る（上下のレーンまでとどくひとふりは、このゲームでの動き：ふり上げて、上から下へふりはらう）。',
      en: 'Rakko, the top-ranked hunter Chiikawa and Hachiware call 先生: as in the owner’s car and boat pictures, a round cream face with a spiky furry edge, small black ears at the sides, a star-shaped scar on the forehead and a white muffler; the body the same cream. Holds his sword in his near paw (he hunts with a sword in the original). Stands at the front and sweeps it through his own lane and the lanes above and below, cutting the enemy in front of him or a tile ahead in each (a swing that reaches the lanes either side is this game’s own: it swings up, then sweeps down).',
    },
  ),
  ally(
    'shimajiro',
    'L',
    {
      ja: '島二郎：島の森の奥の食堂「島二郎」の店主（映画『人魚の島のひみつ』）。ちいかわたちよりずっと大きなおじさんで、たくましい体に口ひげ、腰にはエプロンだけ。貝汁の貝を自分で海に潜ってとるほど泳ぎが得意なので、ボートなしで水のレーンに入って壁になる（水のレーンにだけ置ける）。攻撃しない。HPが減ると、絵が「すり傷と冷や汗（damaged1）」「ばんそうこう（damaged2）」に替わる。',
      en: '島二郎: the owner of 「島二郎」, the diner deep in the island’s forest (the film 『人魚の島のひみつ』). A big man next to Chiikawa and friends: brawny, with a moustache and nothing but an apron at his waist. He dives for the shellfish in his 貝汁, so he swims into the water lane with no boat and holds it as a wall (he goes only on the water lane). Never attacks. As HP drops, it swaps to its scraped-and-sweating (damaged1) and plastered (damaged2) pictures.',
    },
    { motions: ['idle', 'damaged1', 'damaged2'] },
  ),
  ally(
    'taiyaki',
    'S',
    {
      ja: 'わな（このゲームでの動き）。置くとまず焼きはじめる（cook：生から焼きあがりまでの段階の絵）。焼きあがると準備ができて（idle：きつね色のたい焼き）、さいしょにたどりついた相手のところで、あつあつのあんこがはじける（fx_taiyaki_pop）。焼けるまでは、相手にかじられる。',
      en: 'A trap (this game’s own). Put down, it starts cooking (cook: its stages, raw to done); once cooked it is ready (idle: a golden-brown taiyaki), and the first enemy to reach it sets it off in a burst of piping-hot red-bean paste (fx_taiyaki_pop). Until it is cooked, enemies can bite it.',
    },
    { motions: ['cook', 'idle'], height: 100 },
  ),
  ally(
    'muchauman',
    'M',
    {
      ja: 'むちゃうマン：「むちゃうまヨーグルト」のヒーロー（ちいかわは大ファン）。1回だけ使える：置いたマスにあらわれて決めポーズ（ability：さいごのコマのまま止まる）をとると、フィールドの相手がみんなこおりつく。そのあと消える（このゲームでの動き）。',
      en: 'むちゃうマン: the hero of むちゃうまヨーグルト (Chiikawa is a big fan). One use: he appears on the tile and strikes his pose (ability, its last frame held), and every enemy on the field freezes; then he is gone (this game’s own).',
    },
    { motions: ['idle', 'pose'] },
  ),
];

export const ENEMY_CHARACTERS: CharacterSpec[] = [
  enemy('mushi_twolegs', 'S', { ja: '基本の相手。', en: 'The basic enemy.' }),
  // Goblins stand about as tall as the Chiikawa folk, a touch shorter (the prison arc).
  enemy(
    'goblin',
    'S',
    {
      ja: 'World 2 の相手。こん棒で殴る。通り道に生えている草を、足もとでかがんでひろう（ability：手がとどいたところで草が消える）。ちいかわより少し小さい。',
      en: 'World 2. Hits with a club. Bends down at its feet to pick up 草 growing where it walks (ability: the 草 vanishes as its hand reaches it). A little shorter than Chiikawa.',
    },
    { height: 135, motions: ['idle', 'walk', 'attack', 'collapse', 'steal'] },
  ),
  enemy(
    'mushi_sixlegs',
    'M',
    { ja: '攻撃しない。行く手のなかまを、ぜんぶとびこえて進む（ability：その場でとぶ絵。前と上へは、ゲームが運ぶ）。', en: 'Never attacks: it jumps over every friend in its way (ability: drawn jumping on the spot; the game carries it up and over).' },
    { motions: ['idle', 'walk', 'jump', 'collapse'] },
  ),
  enemy('chushidesu', 'M', { ja: '攻撃が2倍速い。なかまの1マス手前で、攻撃の1コマめのまま一瞬かまえてから、攻撃の動きでとびかかる（ふりかぶるあいだに前へ出る）。', en: 'Attacks twice as fast, and pounces from a tile away on its attack frames: it holds its first attack frame for a moment, then moves in during the wind-up.' }),
  enemy(
    'fugu',
    'S',
    { ja: '跳ねて進み、ふくらんで3マス先へ吐く。', en: 'Hops along, puffs up and spits from 3 tiles away.' },
  ),
  enemy('majyo', 'L', { ja: 'とても速い（前かがみで走る、唯一の速い相手）。山姥と同じくらいの大きさ。', en: 'Very fast: runs hunched over, the only fast enemy. As big as 山姥.' }),
  enemy(
    'kimera',
    'S',
    {
      ja: '地上を歩く。高HP。ピンクのキメラで、ちいかわと同じくらいの大きさ。はじめの姿：爪をかくしている（image/sprite/kimera/claws_retracted/ に、ほかと同じ名前で）。体力がのこり3割になると爪を出し、爪のある姿 enemy_kimera_claws になる。',
      en: 'Walks on the ground. High HP. The pink chimera, as big as Chiikawa. Her first look, claws hidden (in image/sprite/kimera/claws_retracted/, named like the rest). At 30% HP she draws them out and takes her clawed form, enemy_kimera_claws.',
    },
  ),
  enemy(
    'kimera',
    'S',
    {
      ja: 'キメラの爪を出した姿（image/sprite/kimera/ の絵）。体力がのこり3割になると、その場で止まって1秒で爪を出し（ability：爪をかくした姿から始めて、さいごのコマで爪が出そろう）、そこからはこの姿で、歩くのもひっかくのも2倍速くなる（歩きの絵も速く回る）。',
      en: 'The chimera with her claws out (the frames in image/sprite/kimera/). At 30% HP she stops where she stands and draws them out in 1 s (ability: starting with them hidden, out by the last frame), then stays like this, moving and clawing twice as fast (her walk frames play faster too).',
    },
    { motions: ['idle', 'walk', 'attack', 'collapse', 'claws'] },
    'enemy_kimera_claws',
  ),
  enemy('mushi_horned', 'L', { ja: '硬い（固定ダメージ軽減）。攻撃も重い。', en: 'Armoured (flat damage reduction). Hits hard.' }),
  enemy(
    'mushi_pink',
    'XL',
    {
      ja: 'ボス：二本足の虫をうんと大きくしたような、ピンクの虫（このゲームのオリジナル。オーナーの絵）。虫たちのボスで、とくべつな技はなく、体力と一撃がとても大きい。',
      en: 'Boss: a pink bug like the two-legged one, only far bigger (this game’s own, from the owner’s pictures). The boss of the bugs: no special move, just a great deal of HP and heavy blows.',
    },
  ),
  // A little smaller than Chiikawa (the user's call).
  enemy('kuroi_nagareboshi', 'S', { ja: 'ふわふわ浮かび、周りの相手を少し回復する。攻撃しない（回復の光は fx_heal_black）。ちいかわより少し小さい。', en: 'Drifts along and heals nearby enemies a little. Never attacks (the healing pulse is fx_heal_black). A little smaller than Chiikawa.' }, { motions: ['float', 'heal', 'collapse'], height: 128 }),
  enemy('guchokipanogitaigata', 'L', { ja: 'ボス。歩きながら歌い、同じレーンのなかまを3人まで動けなくする（歌の絵はいらない：音符はゲームが出す。止まったなかまは山姥の呪文にかかったのと同じ見た目）。動けないなかまへの一撃は2倍。', en: 'Boss. It sings as it goes, and up to three friends in its lane are frozen (no singing frames needed: the game adds the notes, and the frozen friends look as 山姥’s spell leaves them). Its blows land twice as hard on a frozen friend.' }),
  enemy('zou', 'XL', { ja: 'ボス級。体を持ち上げてふみつけ、一撃でなかまを倒す。', en: 'Boss-class. Rears up and stomps, defeating an ally in one blow.' }),
  enemy('chiikabu', 'S', { ja: 'ボス。擬態中の小さな姿（攻撃されない）。', en: 'Boss. The small disguised form (cannot be targeted).' }, { motions: ['idle', 'walk'] }),
  enemy(
    'chiikabu',
    'XL',
    { ja: 'ボス。真の姿。変身のコマ（transform）で、小さな姿から大きくなる。', en: 'Boss. The true form. Its transform frames grow it out of the small form.' },
    { motions: ['transform', 'idle', 'walk', 'attack', 'collapse'] },
    'enemy_chiikabu_true',
  ),
  enemy(
    'ningyo',
    'S',
    {
      ja: '島の小さい人魚（ちいかわ族より小さい：島民が袋に入れて運べるくらい）。シンプルでかわいく。足がなく、しっぽで跳ねて進む。3匹ずつ来る（セイレーンに呼ばれて、その場に出てくることもある：出てくる絵はいらない）。色や頭の形は原作・映画で確認。',
      en: 'A small island mermaid, smaller than the Chiikawa folk (an islander could carry one off in a bag): keep it simple and cute. No feet: it hops along on its tail. Comes in threes (and also comes up where it stands when セイレーン calls: no frames needed for that). Check its colours and head in the manga or the film.',
    },
    { height: 120 },
  ),
  enemy(
    'mermaid_twolegs',
    'S',
    {
      ja: '二本足の人魚（このゲームのオリジナル。オーナーの絵）：白いまるい頭に小さな赤いひれ、波のもようの赤いおわんのような体、細い二本の足。セイレーンに呼ばれて、地面からはい出してくる（spawn のコマ）。強さは二本足の虫と同じくらい。',
      en: 'The two-legged mermaid (this game’s own, from the owner’s pictures): a round white head with a little red fin, a red bowl of a body with wave stripes, and two thin legs. Called up by セイレーン, it climbs out of the ground (its spawn frames). About as tough as the two-legged bug.',
    },
    { motions: ['idle', 'walk', 'attack', 'collapse', 'spawn'] },
  ),
  enemy(
    'yamanba',
    'L',
    {
      ja: '山姥（単行本7巻）。着物のおばあさんで、長い白髪をおろしている。マロングラッセの森でわなにかかったちいかわたちを助けて、手当てやごはんでもてなした（わなをしかけたところは描かれていない）。おそいが、HPが高い。手でつかみかかり、立ち止まって呪文をとなえる（ability のコマ）。',
      en: 'The yamanba (volume 7): an old woman in a kimono, her long white hair worn loose, who freed Chiikawa and friends from traps in the マロングラッセの森 and looked after them (nothing shows she set the traps). Slow but tough. Grabs with her hands, and stops to chant a spell (her ability frames).',
    },
  ),
  enemy(
    'seiren',
    'XL',
    {
      ja: 'ボス（島編。映画『人魚の島のひみつ』）。まるくてかわいいのに不気味な、とても大きな怪物。頭は犬張子がモデル、下半身は金魚のように赤く、人魚のような尾びれ。しっぽで浮かんで進む（泳ぐあいだは歌わない）。ときどき止まって歌い（歌の絵：ability のコマ）、まわりに小さな手下を呼び出す（水のレーンには人魚、陸には二本足の人魚。呼び出すのはこのゲームでの動き）。セイレーンがいるあいだ、人魚たちはみんな速く進む。なかまの前に来ると前足でノックして攻撃する。怒ると目が真っ赤になる。',
      en: 'Boss of the island arc (the film 『人魚の島のひみつ』). Huge and rounded, cute but eerie: the head modelled on a 犬張子, the lower body red like a goldfish, ending in a mermaid-like tail fin. Floats along on its tail (no singing as it swims). Now and then it stops to sing (its singing frames: ability) and calls up small followers round it: mermaids on the water lane, two-legged mermaids on land (the calling is this game’s own). While it is about, all mermaids move faster. In front of a friend it knocks with its forelegs. Its eyes turn bright red when it is angry.',
    },
    // As tall as the giants (her mermaids ride on her head), though she keeps to her one lane.
    { motions: ['idle', 'walk', 'attack', 'collapse', 'song'], height: 480 },
  ),
  enemy(
    'anoko',
    'XXL',
    {
      ja: '最後のボス。ちいかわとシール貼りの仕事をした「あのこ」が、キメラになった姿。ちいかわ族の何倍も大きく、白くてもふもふ。額に小さな黄色い角が1本、ほおと胸にふさふさの毛、黄色い長いつめ、下のほうはベージュ、ヘビか竜のような長いしっぽ。おっきい討伐では、このしっぽでハチワレをたおした。3レーンぶんの高さの巨大な相手で、まん中の3レーンをいっぺんに進み（足は手前のレーンに）、ひとふりで3レーンをなぎはらう。',
      en: 'The final boss: あのこ, Chiikawa’s friend from the sticker job, become a chimera many times Chiikawa’s size. White and fluffy, with one small yellow horn on the forehead, fluffy cheeks and chest, long yellow claws, a beige lower body and a long snake- or dragon-like tail. On the big hunt that tail knocked Hachiware flat. A giant three lanes tall: it comes down the middle three lanes at once, its feet on the nearest, and sweeps all three as it strikes.',
    },
  ),
  enemy(
    'dekatsuyo',
    'XXL',
    {
      ja: 'ボス。ちいかわ族よりずっと大きい。黄色いぼさぼさのたてがみに囲まれた大きな顔、黄色い体、黒く長い4本の足。モモンガを「返せッ」と追いかけていた。3レーンぶんの高さの巨大な相手で、まん中の3レーンをいっぺんに進み（足は手前のレーンに）、ひとふりで3レーンをなぎはらう。',
      en: 'Boss, much bigger than the Chiikawa folk: a big face framed by a shaggy yellow mane, a yellow body, four long black legs. Chased Momonga crying 「返せッ」. A giant three lanes tall: it comes down the middle three lanes at once, its feet on the nearest, and sweeps all three as it strikes.',
    },
  ),
  enemy(
    'dekai_tori',
    'M',
    {
      ja: 'ただ1羽の、空を飛ぶ相手。大きくて丸い白い鳥。いつも浮かんでいて、壁を飛びこえ、基地にいちばん近いなかまの上で止まると、つかんで連れ去る（かみつかない）。攻撃の動きが「つかむ」。パジャマパーティーズのメンバーをさらった鳥。',
      en: 'The only flier: a big round white bird. Always in the air: it flies over walls, hovers over the friend nearest the base, then grabs it and carries it off (it never bites). Its attack motion is the grab. The bird that carried off members of パジャマパーティーズ.',
    },
    // Smaller than in the story (the user's call), so it stays over its own lane.
    { motions: ['float', 'attack', 'collapse'], height: 170 },
  ),
];

export const VEHICLES: CharacterSpec[] = [
  {
    id: 'rescue_rakko_car',
    group: 'rescue',
    subject: 'rakko_car',
    tier: 'M',
    height: 130,
    facing: 1,
    motions: ['parked', 'drive'],
    note: { ja: 'ラッコのくるま1枚の絵（タイヤごと）。運転席にラッコ。右向き。各レーン1回だけ相手をまとめて倒してくれる。', en: "Rakko's car as one picture, wheels and all, with Rakko at the wheel, facing right. Clears its lane once." },
  },
  {
    id: 'rescue_rakko_boat',
    group: 'rescue',
    subject: 'rakko_boat',
    tier: 'M',
    // Longer than it is tall: at the car's height it was half as long again and reached into the first tile.
    height: 96,
    facing: 1,
    motions: ['parked', 'drive'],
    note: {
      ja: 'ラッコの小さなモーターボート1枚の絵。運転席にラッコ（肩から上が見える）、うしろに船外機。右向き。水面（喫水線）は足の高さで、そこに白い短い波の線を少し（ボートのまわりに水を少し描いてもよい）。水面より下は描かない。水のレーン（World 5 のいちばん下のレーン）には、くるまのかわりにこのボートで来て、同じように相手をまとめて倒してくれる。',
      en: "Rakko's little motorboat as one picture, with Rakko at the wheel (seen from the shoulders up) and an outboard motor on the stern, facing right. Its waterline is at the feet line, with a couple of short white ripple strokes along it (a little water around the boat is fine); nothing below the water. On a water lane (World 5's bottom lane) he comes by boat instead of the car, and clears the lane the same way.",
    },
  },
];

export const CHARACTERS: CharacterSpec[] = [...ALLY_CHARACTERS, ...ENEMY_CHARACTERS, ...VEHICLES];

export function characterSpec(id: string): CharacterSpec | undefined {
  return CHARACTERS.find((r) => r.id === id);
}

/** The character id for a gameplay subject (and form); for a person in the gallery's people pages, the id of their standing
 *  picture (art/sprites/people_<id>, idle frames only). */
export function spriteIdFor(kind: 'ally' | 'enemy' | 'people', subject: string, form?: string): string {
  if (kind === 'enemy' && subject === 'chiikabu' && form === 'true') return 'enemy_chiikabu_true';
  // キメラ with her claws out (her first look has them hidden).
  if (kind === 'enemy' && subject === 'kimera' && form === 'claws') return 'enemy_kimera_claws';
  // One member of a team (パジャマパーティーズ).
  if (kind === 'ally' && form) return `ally_${subject}_${form}`;
  return `${kind}_${subject}`;
}

/** パジャマパーティーズ' four members (owner's call, 2026-11-08): their card brings one at a time, at random. Each has
 *  frames of its own (art/sprites/ally_pajama_parties_<member>), and otherwise goes by the team's entry. */
export const PAJAMA_MEMBERS = ['green', 'pink', 'purple', 'white'] as const;

/** The entry a team member's frames go by, if `id` is one. */
export function teamSpec(id: string): CharacterSpec | undefined {
  return PAJAMA_MEMBERS.some((m) => id === `ally_pajama_parties_${m}`) ? characterSpec('ally_pajama_parties') : undefined;
}

/** Who each person on the gallery's people pages is as big as: their standing picture stands that fighter's height,
 *  so the book shows them true to size beside everyone else. The 鎧さん are as big as the 鎧さん who fights. */
export const PEOPLE_SIZE: Record<string, string> = { yoroi_ramen: 'ally_yoroi', yoroi_rodo: 'ally_yoroi', yoroi_pochette: 'ally_yoroi' };

/** The entry whose size (tier, height) a character takes: its own, or a person's (see PEOPLE_SIZE). */
export function sizeSpec(id: string): CharacterSpec | undefined {
  return characterSpec(id) ?? teamSpec(id) ?? (id.startsWith('people_') ? characterSpec(PEOPLE_SIZE[id.slice('people_'.length)] ?? '') : undefined);
}
