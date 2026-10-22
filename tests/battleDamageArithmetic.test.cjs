const { test } = require('node:test');
const assert = require('node:assert/strict');
const { unit, first, rng, run, data, load } = require('./helpers/battleSupportFixtures.cjs');
const { createBattleState } = load('src/utils/battle/battleInput.ts');
const { effectiveParameter } = load('src/utils/battle/battleState.ts');
const { calculateLegacyDamage } = load('src/utils/battle/battleDamage.ts');
const { applySupportEffects } = load('src/utils/battle/battleSupportEffects.ts');
const { planAction } = load('src/utils/battle/battleActions.ts');
const { calculateActionOrder } = load('src/utils/battle/battleOrder.ts');
const { resolveActionAccuracy } = load('src/utils/battle/battleAccuracy.ts');
const state = (id = 2) => createBattleState({ player: [unit('P', id)], enemy: [unit('E')], floorSpecialty: 'None' });
const plan = (s, actor) => planAction(s, actor, first.chooseAction(actor));

test('canonical NeoCrimson encounter retains DEF 132', () => {
  const { encounters } = load('src/data/encounters.ts');
  const targets = encounters.flatMap(e => e.digimons).filter(d => d.name === 'NeoCrimson');
  assert.ok(targets.length > 0);
  assert.ok(targets.every(d => d.def === 132));
});

for (const stat of ['atk', 'def', 'spd']) {
  for (const [base, values] of [[132, [66,92,132,186,264]], [67, [33,47,67,94,134]], [67.5, [33,47,67.5,95,135]]]) {
    test(`${stat} fixed-point stages from base ${base}`, () => {
      const actor = state().combatants[0];
      actor.baseStats[stat] = base;
      for (const [i, oldExpected] of values.entries()) {
        const expected = i === 3 && stat !== 'spd' ? ({132:198,67:100,67.5:101})[base] : oldExpected;
        actor[stat + 'Stage'] = i - 2;
        assert.equal(effectiveParameter(actor, stat), expected);
        actor.parametersSuppressed = true;
        assert.equal(effectiveParameter(actor, stat), base);
        assert.equal(actor[stat + 'Stage'], i - 2);
        actor.parametersSuppressed = false;
        assert.equal(effectiveParameter(actor, stat), expected);
      }
    });
  }
}

test('canonical stage floors before independent legacy and half-defense factors', () => {
  const actor = state().combatants[0];
  actor.baseStats.def = 67; actor.defStage = -1;
  actor.parameterModifiers.def = 0.75; actor.halfDefense = true;
  assert.equal(effectiveParameter(actor, 'def'), 47 * 0.75 * 0.5);
  actor.parametersSuppressed = true;
  assert.equal(effectiveParameter(actor, 'def'), 67 * 0.75 * 0.5);
});

test('fractional AP survives until final division: 22.5 * 120 / 102 = 26', () => {
  const [p, e] = state().combatants;
  p.baseStats.atk = 120; e.baseStats.def = 102;
  assert.equal(calculateLegacyDamage(p, e, { ...p.skills[0].legacyTech, ap: 22.5, element: 'None' }, 'None'), 26);
});

test('fifth-based offensive factors, AP ratio and defender tile retain their distinct floors', () => {
  const [p, e] = state().combatants;
  p.baseStats.atk = 120; p.type = 'Data';
  e.baseStats.def = 67; e.type = 'Vaccine'; e.specialty = 'Nature';
  const tech = { ...p.skills[0].legacyTech, ap: 22.5, element: 'Fire' };
  assert.equal(calculateLegacyDamage(p, e, tech, 'Fire', [3,2]), 104);
  // DEF tile floors 67 * 6/5 to 80; offense retains 22.5 * (6/5)^2.
  assert.equal(calculateLegacyDamage(p, e, tech, 'Nature', [3,2]), 72);
});

for (const id of [0x46, 0x51]) test(`canonical claw ${id} AP 20 and same-hit DEF stages produce 26 then 36`, () => {
  assert.equal(data.getBattleSkillById(id).attackPowerRaw, 40);
  assert.equal(data.getBattleSkillById(id).attackPower, 20);
  const p = unit('Okuwamon', id, { stats: { atk: 120, spd: 100 } });
  p.techs[0].name = 'Renamed canonical attack';
  const e = unit('NeoCrimson', 2, { stats: { def: 132 } });
  for (const rounds of [1, 2]) {
    const result = run([p], [e], { maxRounds: rounds });
    const hits = result.actions.filter(a => a.actorName === 'Okuwamon');
    assert.deepEqual(hits.map(a => a.impacts[0].damage), [26,36].slice(0, rounds));
    assert.deepEqual(hits.map(a => a.supportEvents.find(e => e.kind === 'stage').after), [-1,-2].slice(0, rounds));
    assert.equal(result.state.combatants[1].defStage, -rounds);
  }
});

test('X-Scissor Claw does not inherit DEF Down by name', () => {
  const s = state(0x56), [p,e] = s.combatants;
  const a = plan(s, p);
  applySupportEffects(s, p, e, a, 'pre-damage');
  applySupportEffects(s, p, e, a, 'after-damage');
  assert.equal(e.defStage, 0);
});

for (const [id, delta, values] of [[0xc1,1,[198,264,264]], [0xf7,-1,[92,66,66]]]) {
  test(`canonical ATK effect ${id} feeds integer ATK into outgoing damage after damage phase`, () => {
    const s = state(id), [p,e] = s.combatants;
    e.baseStats.atk = 132; p.baseStats.def = 100;
    const a = plan(s, p), tech = { ...e.skills[0].legacyTech, ap: 20, element: 'None' };
    applySupportEffects(s, p, e, a, 'pre-damage');
    assert.equal(e.atkStage, 0);
    for (const [i, value] of values.entries()) {
      applySupportEffects(s, p, e, a, 'after-damage');
      assert.equal(e.atkStage, delta * Math.min(i + 1, 2));
      assert.equal(effectiveParameter(e, 'atk'), value);
      assert.equal(calculateLegacyDamage(e, p, tech, 'None'), Math.floor(20 * value / 100));
    }
  });
}

for (const [stage, value, threshold] of [[-2,66,124],[-1,92,123],[1,186,117],[2,264,112]]) {
  test(`SPD stage ${stage} reaches initiative and accuracy`, () => {
    const s = state(), [p,e] = s.combatants;
    p.baseStats.spd = 100; e.baseStats.spd = 132; e.spdStage = stage;
    const a = plan(s, p), b = plan(s, e);
    assert.deepEqual(calculateActionOrder(s, [a,b], rng()), value > 100 ? [b.id,a.id] : [a.id,b.id]);
    assert.equal(b.initiative, value);
    const accuracy = resolveActionAccuracy(p, 'attack', [e], rng());
    assert.equal(accuracy.targetEffectiveSpd, value);
    assert.equal(accuracy.hitThreshold128, threshold);
  });
}
