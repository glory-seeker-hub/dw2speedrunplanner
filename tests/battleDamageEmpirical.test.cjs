const { test } = require('node:test');
const assert = require('node:assert/strict');
const { unit, run, data, load, first } = require('./helpers/battleSupportFixtures.cjs');
const { createBattleState } = load('src/utils/battle/battleInput.ts');
const { effectiveParameter } = load('src/utils/battle/battleState.ts');
const { calculateLegacyDamage, calculateActionDamage } = load('src/utils/battle/battleDamage.ts');
const { applySupportEffects } = load('src/utils/battle/battleSupportEffects.ts');
const { planAction } = load('src/utils/battle/battleActions.ts');

// Expected numbers below are supplied BizHawk 2.11.1 observations, except tests
// explicitly labelled compatibility. No expected damage uses the implementation.
function fighter(name, id, stats = {}, type = 'Data', specialty = 'None', stages = {}) {
  const result = unit(name, id, { stats: { hp: 10000, mp: 1000, atk: 0, spd: 100, ...stats }, initialStages: stages });
  result.digimon = { ...result.digimon, type, specialty };
  return result;
}
function setup(id, atk, def, { type = false, specialty = false, stacks = 0, down = 0 } = {}) {
  const p = fighter('P', id, { atk }, type ? 'Virus' : 'Data');
  p.techs.push(unit('Armor', 0xc1).techs[0]);
  const e = fighter('E', 6, { def }, 'Data', specialty ? 'Nature' : 'None', { def: -down });
  const s = createBattleState({ player: [p], enemy: [e], floorSpecialty: 'None' });
  s.round = 1;
  const [actor, target] = s.combatants;
  const buff = planAction(s, actor, { kind: 'skill', skillKey: actor.skills[1].key });
  for (let i = 0; i < stacks; i++) applySupportEffects(s, actor, actor, buff, 'after-damage');
  const action = planAction(s, actor, first.chooseAction(actor));
  return { s, actor, target, action };
}
function damage(id, atk, def, options) {
  const { s, actor, target, action } = setup(id, atk, def, options);
  return calculateActionDamage(actor, target, action, 'None', s);
}

for (const [atk, expected] of [[124,223],[125,224]]) test(`empirical Armor then type truncations: ATK ${atk} => ${expected}`, () => {
  const { s, actor, target, action } = setup(0x40, atk, 20, { type: true, stacks: 1 });
  assert.equal(actor.baseStats.atk, atk);
  assert.equal(effectiveParameter(actor, 'atk'), atk === 124 ? 186 : 187);
  assert.equal(calculateActionDamage(actor, target, action, 'None', s), expected);
  // Isolated ordinary formula and canonical action must agree.
  assert.equal(calculateLegacyDamage(actor, target, action.skill.legacyTech, 'None'), expected);
});

for (const [def, type, expected] of [[24,false,[110,165,220]], [24,true,[131,197,263]], [55,true,[57,86,114]], [60,true,[52,79,105]]]) {
  for (const [stacks, value] of expected.entries()) test(`empirical Party Time DEF ${def}, armor ${stacks}, type ${type}: ${value}`, () => {
    assert.equal(data.getBattleSkillById(0x40).attackPower, 20);
    assert.equal(damage(0x40, 132, def, { type, stacks }), value);
  });
}
for (const [stacks, expected] of [45,67,90].entries()) test(`empirical Fire Blast one advantage armor ${stacks}: ${expected}`, () => {
  assert.equal(damage(0x6f, 120, 56, { type: true, stacks }), expected);
  assert.equal(damage(0x6f, 120, 56, { specialty: true, stacks }), expected);
});

const defenseDown = [[100,70,50],[101,71,50],[102,71,51],[103,72,51],[104,73,52],[105,73,52],[106,74,53],[107,75,53],[108,75,54],[109,76,54],[110,77,55],[111,78,55],[112,78,56],[128,90,64],[132,92,66],[150,105,75],[155,108,77]];
for (const [base, one, two] of defenseDown) test(`empirical DEF ${base} reductions: ${one}/${two}`, () => {
  const { s, actor, target, action } = setup(70, 120, base);
  for (const [stage, expected] of [[-1,one],[-2,two],[-2,two]]) {
    applySupportEffects(s, actor, target, action, 'pre-damage');
    assert.equal(target.defStage, stage);
    assert.equal(effectiveParameter(target, 'def'), expected);
    assert.equal(target.baseStats.def, base);
  }
});
for (const [base, one, two] of [[60,90,120],[52,78,104],[55,82,110]]) test(`empirical Defensive Ray DEF ${base}: ${one}/${two}`, () => {
  const { s, actor, target, action } = setup(0xbd, 0, base);
  for (const [stage, expected] of [[1,one],[2,two],[2,two]]) {
    applySupportEffects(s, actor, target, action, 'after-damage');
    assert.equal(target.defStage, stage);
    assert.equal(effectiveParameter(target, 'def'), expected);
    assert.equal(target.baseStats.def, base);
  }
});

for (const id of [70,81]) for (const [def, down, expected, effectiveDef] of [[132,0,26,92],[132,1,36,66],[132,2,36,66],[100,0,34,70],[100,1,48,50],[100,2,48,50]]) {
  test(`empirical canonical claw ${id}, DEF ${def}, prior down ${down}: ${expected}`, () => {
    const canonical = data.getBattleSkillById(id);
    assert.equal(canonical.attackPowerRaw, 40); assert.equal(canonical.attackPower, 20);
    const p = fighter('P', id, { atk: 120 }), e = fighter('E', 6, { def }, 'Data', 'None', { def: -down });
    p.techs[0].name = 'Renamed technique';
    const result = run([p], [e]);
    const hit = result.actions.find(a => a.actorName === 'P');
    assert.equal(hit.impacts[0].damage, expected);
    assert.equal(result.state.combatants[1].defStage, -Math.min(down + 1, 2));
    assert.equal(effectiveParameter(result.state.combatants[1], 'def'), effectiveDef);
  });
}

for (const [def, down, type, specialty, expected] of [
  [100,0,false,false,21],[103,0,false,false,20],[132,0,false,false,15],[56,0,false,false,37],
  [132,1,false,false,22],[132,2,false,false,31],
  [100,0,false,true,25],[100,1,false,true,36],[100,2,false,true,50],
  [55,0,true,true,54],[56,0,true,true,54],[57,0,true,true,53],
]) test(`empirical Fire Blast DEF ${def}, down ${down}, type ${type}, specialty ${specialty}: ${expected}`, () => {
  assert.equal(data.getBattleSkillById(0x6f).attackPowerRaw, 35);
  assert.equal(data.getBattleSkillById(0x6f).attackPower, 17.5);
  assert.equal(damage(0x6f, 120, def, { down, type, specialty }), expected);
});

test('compatibility: disadvantage floors type-adjusted ATK before fractional AP', () => {
  const { s, actor, target, action } = setup(0x6f, 124, 20, { stacks: 1 });
  actor.type = 'Vaccine'; target.type = 'Data';
  assert.equal(calculateActionDamage(actor, target, action, 'None', s), 129);
  target.specialty = 'Machine';
  assert.equal(calculateActionDamage(actor, target, action, 'None', s), 103);
});

test('full battle: Armor persists across rounds, clamps at +2 and feeds Party Time', () => {
  const p = fighter('P', 0xc1, { atk: 132 }, 'Virus');
  p.techs.push(unit('Attack', 0x40).techs[0]);
  const actionPolicy = { chooseAction: (a, context) => ({ kind: 'skill', skillKey: a.skills[a.side === 'player' && context.round % 2 === 0 ? 1 : 0].key }) };
  const result = run([p], [fighter('E', 6, { def: 24 })], { maxRounds: 6, actionPolicy });
  assert.deepEqual(result.actions.filter(a => a.actorName === 'P' && a.kind === 'attack').map(a => a.impacts[0].damage), [197,263,263]);
  assert.equal(result.state.combatants[0].atkStage, 2);
  assert.equal(result.state.combatants[0].baseStats.atk, 132);
});

test('full battle: Duo AoE keeps independent stages; subsequent Fire Blast uses each DEF', () => {
  const p = fighter('P', 81, { atk: 120 }); p.techs.push(unit('Fire', 0x6f).techs[0]);
  const enemies = [fighter('A', 6, { def: 132 }), fighter('B', 6, { def: 100 }, 'Data', 'None', { def: -1 }), fighter('C', 6, { def: 132 }, 'Data', 'None', { def: -2 })];
  const actionPolicy = { chooseAction: (a, c) => ({ kind: 'skill', skillKey: a.skills[a.side === 'player' && c.round > 2 ? 1 : 0].key }) };
  const result = run([p], enemies, { maxRounds: 3, actionPolicy });
  const attacks = result.actions.filter(a => a.actorName === 'P');
  assert.deepEqual(attacks[0].impacts.map(i => i.damage), [26,48,36]);
  assert.deepEqual(attacks[0].supportEvents.filter(e => e.kind === 'stage').map(e => e.after), [-1,-2,-2]);
  assert.deepEqual(attacks[1].impacts.map(i => i.damage), [36,48,36]);
  assert.deepEqual(attacks[2].impacts.map(i => i.damage), [31,42,31]);
  assert.deepEqual(result.state.combatants.slice(1).map(a => a.defStage), [-2,-2,-2]);
});
