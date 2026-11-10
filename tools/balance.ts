// Runs the heuristic bot over every campaign level and prints a difficulty table.
//   npm run balance            (good + casual bots, each on a job's first three tries)
//   npm run balance -- 2-5     (only levels whose id starts with "2-5")
// A job's randomness comes from its id and the try (see simForLevel): its first try is attempt 0, and each finished one
// moves it on. These are the tries a player really gets, so they are the ones played here.

import { BOT_CASUAL, BOT_GOOD, botDeck, runBot, type BotOptions } from '../src/game/sim/bot';
import { LEVEL_LIST } from '../src/game/sim/defs';
import { simForLevel } from '../src/game/sim/sim';

const filter = process.argv[2] ?? '';
const ATTEMPTS = [0, 1, 2];

function run(label: string, opts: BotOptions) {
  console.log(`\n=== ${label} bot ===`);
  console.log('level  wins  avgTime  rescues  lost  deck');
  let failures = 0;
  for (const level of LEVEL_LIST) {
    if (filter && !level.id.startsWith(filter)) continue;
    const deck = botDeck(level);
    const results = ATTEMPTS.map((attempt) => runBot(simForLevel(level, deck, { attempt }), opts));
    const wins = results.filter((r) => r.won).length;
    if (wins < ATTEMPTS.length) failures++;
    const avg = (f: (r: (typeof results)[number]) => number) => (results.reduce((n, r) => n + f(r), 0) / results.length).toFixed(1);
    console.log(
      `${level.id.padEnd(6)} ${`${wins}/${ATTEMPTS.length}`.padEnd(5)} ${avg((r) => r.timeS).padStart(7)}  ${avg((r) => r.rescuesUsed).padStart(7)}  ${avg((r) => r.alliesLost).padStart(4)}  ${deck.join(',')}`,
    );
  }
  return failures;
}

const goodFailures = run('GOOD', BOT_GOOD);
run('CASUAL', BOT_CASUAL);
console.log(`\nGOOD bot failed ${goodFailures} level(s).`);
