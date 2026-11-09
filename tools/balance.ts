// Runs the heuristic bot over every campaign level and prints a difficulty table.
//   npm run balance            (good + casual bots, 3 seeds each)
//   npm run balance -- 2-5     (only levels whose id starts with "2-5")

import { BOT_CASUAL, BOT_GOOD, botDeck, runBot, type BotOptions } from '../src/game/sim/bot';
import { LEVEL_LIST } from '../src/game/sim/defs';
import { simForLevel } from '../src/game/sim/sim';

const filter = process.argv[2] ?? '';
const SEEDS = [1, 2, 3];

function run(label: string, opts: BotOptions) {
  console.log(`\n=== ${label} bot ===`);
  console.log('level  wins  avgTime  rescues  lost  deck');
  let failures = 0;
  for (const level of LEVEL_LIST) {
    if (filter && !level.id.startsWith(filter)) continue;
    const deck = botDeck(level);
    const results = SEEDS.map((seed) => runBot(simForLevel(level, deck, { seed }), opts));
    const wins = results.filter((r) => r.won).length;
    if (wins < SEEDS.length) failures++;
    const avg = (f: (r: (typeof results)[number]) => number) => (results.reduce((n, r) => n + f(r), 0) / results.length).toFixed(1);
    console.log(
      `${level.id.padEnd(6)} ${`${wins}/${SEEDS.length}`.padEnd(5)} ${avg((r) => r.timeS).padStart(7)}  ${avg((r) => r.rescuesUsed).padStart(7)}  ${avg((r) => r.alliesLost).padStart(4)}  ${deck.join(',')}`,
    );
  }
  return failures;
}

const goodFailures = run('GOOD', BOT_GOOD);
run('CASUAL', BOT_CASUAL);
console.log(`\nGOOD bot failed ${goodFailures} level(s).`);
