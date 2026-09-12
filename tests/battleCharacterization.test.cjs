const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/loadTs.cjs');
const { cases } = require('./helpers/battleFixtures.cjs');
const expected = require('./fixtures/battle-legacy-characterization.json');
const { createSequenceBattleRng } = load('src/utils/battle/battleRng.ts');
const { runBattleSimulation } = load('src/utils/battleEngine.ts');
for (const [name, [player, enemy]] of Object.entries(cases)) test(`legacy characterization: ${name}`, () => {
  const rng = createSequenceBattleRng(Array(10000).fill(0));
  assert.deepEqual(runBattleSimulation(player, enemy, 'None', 1, { rng }), expected[name]);
});
