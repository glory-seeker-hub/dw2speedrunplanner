const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load, unit, first, data } = require('./helpers/battleSupportFixtures.cjs');
const { DIGIMONS } = load('src/data/digimons.ts');
const { getDigimonByName, getSpecies } = load('src/utils/digimonLookup.ts');
const { encounters } = load('src/data/encounters.ts');
const { encounterToBattleTeam } = load('src/utils/battle/battleEncounter.ts');
const { createBattleState } = load('src/utils/battle/battleInput.ts');
const { effectiveParameter } = load('src/utils/battle/battleState.ts');
const { planAction } = load('src/utils/battle/battleActions.ts');
const { calculateActionDamage } = load('src/utils/battle/battleDamage.ts');
const { runDataSelfChecks } = load('src/utils/dataSelfChecks.ts');
const boss = encounters.find(e => e.id === 157);
const species = getDigimonByName('MasterTyrannomon');

test('MasterTyrannomon canonical runtime and CSV classification is Vaccine / None', () => {
  assert.equal(DIGIMONS.filter(d => d.id === 'mastertyrannomon').length, 1);
  assert.equal(species.type, 'Vaccine');
  assert.equal(species.specialty, 'None');
  const rows = fs.readFileSync('src/data/digimon_data.csv', 'utf8').split(/\r?\n/);
  assert.deepEqual(rows.filter(r => r.startsWith('MasterTyrannomon,')), ['MasterTyrannomon,Vaccine,None']);
});

for (const name of ['MasterTyrannomon', 'Master Tyrannomon']) test(`canonical species lookup: ${name}`, () => {
  assert.equal(getDigimonByName(name), species);
  assert.deepEqual(getSpecies(name), { id: 'mastertyrannomon', name: 'MasterTyrannomon', type: 'Vaccine', specialty: 'None' });
});

test('Power F2 encounter 157 inherits corrected canonical identity and preserves all stats', () => {
  const group = load('src/data/domainGroups.ts').DOMAIN_GROUPS.find(g => g.encounterId === 157);
  assert.equal(group.domainId, 'power');
  assert.deepEqual(group.floors, [2]);
  assert.equal(boss.digimons[0].name, 'Master Tyrannomon');
  assert.equal(getDigimonByName(boss.digimons[0].name), species);
  const [target] = encounterToBattleTeam(boss);
  assert.equal(target.isBoss, true);
  assert.deepEqual(target.digimon, species);
  assert.deepEqual(target.customStats, { hp: 520, mp: 520, atk: 70, def: 60, spd: 63 });
});

test('reviewed MasterTyrannomon self-check detects any specialty regression', () => {
  const check = () => runDataSelfChecks().find(c => c.name === 'Reviewed MasterTyrannomon specialty is None');
  assert.equal(check().passed, true);
  const original = species.specialty;
  try {
    for (const specialty of ['Machine', 'Nature', 'Fire', 'Water', 'Dark']) {
      species.specialty = specialty;
      assert.equal(check().passed, false);
    }
  } finally { species.specialty = original; }
});

// Supplied BizHawk observations; expected damage is not computed by a test formula.
for (const [attacker, atk, technique, ap, element, observed] of [
  ['Okuwamon', 115, 'Thunder Ray', 25, 'Nature', 76],
  ['Okuwamon', 115, 'Pummel Peck', 25, 'Machine', 76],
  ['Myotismon', 117, 'Evil Charm', 20, 'Dark', 62],
  ['Myotismon', 117, 'Fire Blast', 17.5, 'Fire', 54],
]) test(`BizHawk ${technique}: observed and simulated damage ${observed}`, () => {
  const skill = data.getBattleSkillByName(technique);
  const player = unit(attacker, skill.id, { stats: { atk } });
  player.digimon = getDigimonByName(attacker);
  const [enemy] = encounterToBattleTeam(boss);
  enemy.initialStages = { def: -2 };
  const state = createBattleState({ player: [player], enemy: [enemy], floorSpecialty: 'None' });
  state.round = 1;
  const [actor, target] = state.combatants;
  const action = planAction(state, actor, first.chooseAction(actor));
  assert.equal(actor.type, 'Virus');
  assert.equal(actor.baseStats.atk, atk);
  assert.equal(target.type, 'Vaccine');
  assert.equal(target.specialty, 'None');
  assert.equal(target.baseStats.def, 60);
  assert.equal(target.defStage, -2);
  assert.equal(effectiveParameter(target, 'def'), 30);
  assert.equal(action.skill.legacyTech.ap, ap);
  assert.equal(action.skill.legacyTech.element, element);
  assert.equal(calculateActionDamage(actor, target, action, 'None', state), observed);
  if (technique === 'Thunder Ray' || technique === 'Fire Blast') {
    const oldTarget = { ...target, specialty: 'Machine' };
    assert.notEqual(calculateActionDamage(actor, oldTarget, action, 'None', state), observed);
  }
});
