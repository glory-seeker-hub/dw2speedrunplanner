const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/loadTs.cjs');
const { cases } = require('./helpers/battleFixtures.cjs');
const expected = require('./fixtures/battle-legacy-characterization.json');
const { createSequenceBattleRng } = load('src/utils/battle/battleRng.ts');
const { simulateBattleCore } = load('src/utils/battleEngine.ts');
// Keep the original pre-extraction snapshots intact. Phase 2K-D replaces timing,
// extends battles after player depletion, and splits Shadow Scythe executions.
// Compare the complete original damage/target/round prefix without those fields.
const damageFields = row => ({ round: row.round, digimon: row.digimon, tech: row.tech, target: row.target, damage: row.damage, hpRemaining: row.hpRemaining });
for (const [name, [player, enemy]] of Object.entries(cases)) test(`legacy damage characterization: ${name}`, () => {
  const result = simulateBattleCore({ player, enemy, floorSpecialty: 'None' }, { rng: createSequenceBattleRng(Array(10000).fill(0)) });
  const rows = result.actions.filter(a => a.state === 'resolved').flatMap(a => a.impacts.map(i => ({ round: a.round, digimon: a.actorName, tech: a.skillName, target: i.targetName, damage: i.damage, hpRemaining: i.hpAfter })));
  const baseline = expected[name].fastestBattleHistory.map(damageFields);
  assert.deepEqual(rows.slice(0, baseline.length), baseline);
  assert.equal(result.outcome, 'player-win');
  // If baseline was already a victory, no extra damage impacts are justified.
  if (expected[name].winRate === 100) assert.equal(rows.length, baseline.length);
});
