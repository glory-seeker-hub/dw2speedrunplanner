const fs = require('node:fs');
const { load } = require('../tests/helpers/loadTs.cjs');
const { cases } = require('../tests/helpers/battleFixtures.cjs');
const { createSeededBattleRng } = load('src/utils/battle/battleRng.ts');
const { runBattleSimulation } = load('src/utils/battleEngine.ts');
const timings = [1, 100, 1000].map(count => {
  const start = performance.now();
  runBattleSimulation(...cases.aoe, 'None', count, { rng: createSeededBattleRng(42) });
  return { count, ms: performance.now() - start };
});
fs.writeFileSync('docs/phase-2k-c/performance-after.json', JSON.stringify(timings, null, 2) + '\n');
console.log(timings);
