const { test } = require('node:test');
const assert = require('node:assert/strict');
const { unit, rng, run, action, data, load } = require('./helpers/battleSupportFixtures.cjs');
const { createBattleState } = load('src/utils/battle/battleInput.ts');
const { planAction, legacyActionPolicy, selectableSkills, revalidateAction } = load('src/utils/battle/battleActions.ts');
const { initializeMotivation, clearRoundEffects } = load('src/utils/battle/battleEffectCompletion.ts');
const { calculateActionOrder } = load('src/utils/battle/battleOrder.ts');
const { effectiveParameter } = load('src/utils/battle/battleState.ts');
const { applySupportEffects } = load('src/utils/battle/battleSupportEffects.ts');
const { applyDirectStatuses, recoverStatuses } = load('src/utils/battle/battleStatuses.ts');
const state = (player = [unit('P')], enemy = [unit('E')]) => {
  const result = createBattleState({ player, enemy, floorSpecialty: 'None' });
  result.round = 1;
  return result;
};
const plan = (s, index = 0) => planAction(s, s.combatants[index], { kind: 'skill', skillKey: s.combatants[index].skills[0].key });
function costSkills(costs) {
  return costs.map((cost, slot) => {
    const skill = data.BATTLE_SKILLS.find(s => s.recordKind === 'technique' && s.mpCost === cost && s.attackPower > 0);
    assert.ok(skill, 'Canonical cost fixture: ' + cost);
    return { ...unit('Fixture', skill.id).techs[0], id: 'slot-' + slot };
  });
}
for (const costs of [[30,20,10,6], [30,30,20,10], [30,20,20,10], [30,30,30,10], [30], [30,20]]) {
  test('Motivation blocked cutoff ' + costs.join('/'), () => {
    const member = unit('P', 2, { initialStatuses: { 'motivation-down': true } });
    member.techs = costSkills(costs);
    const s = state([member]), actor = s.combatants[0], random = rng();
    initializeMotivation(actor, random);
    assert.equal(actor.motivationBlocked.length, Math.min(2, costs.length));
    const selectedCosts = actor.motivationBlocked.map(key => costs[Number(key.slice(5))]);
    assert.deepEqual(selectedCosts.sort((a,b) => b-a), [...costs].sort((a,b) => b-a).slice(0,2));
    const tiedCutoff = costs.length > 2 && [...costs].sort((a,b) => b-a)[1] === [...costs].sort((a,b) => b-a)[2];
    assert.equal(random.draws.some(d => d.category === 'motivation-blocked-choice'), tiedCutoff);
  });
}
test('Motivation cure and later application create a new tied selection', () => {
  const member = unit('P', 2, { initialStatuses: { 'motivation-down': true } });
  member.techs = costSkills([30,30,30]);
  const s = state([member]), actor = s.combatants[0];
  initializeMotivation(actor, rng({ 'motivation-blocked-choice': [0,0] }));
  assert.deepEqual(actor.motivationBlocked, ['slot-0','slot-1']);
  recoverStatuses(actor, rng({ 'status-recovery-motivation-down': [0] }));
  const effect = { kind: 'status-application', status: 'motivation-down', condition: 'always', chancePercent: 33, byte: 26, mask: 16 };
  applyDirectStatuses(actor, [effect], rng({ 'motivation-blocked-choice': [2,1] }));
  assert.deepEqual(actor.motivationBlocked, ['slot-2','slot-1']);
});
for (const role of ['ordinary','boss','boss-ally','coliseum']) test('Enemy Motivation immunity: ' + role, () => {
  const s = state(undefined, [unit(role, 2, { isBoss: role === 'boss' })]), target = s.combatants[1];
  const result = applyDirectStatuses(target, [{ kind: 'status-application', status: 'motivation-down', condition: 'always', chancePercent: 66, byte: 26, mask: 16 }], rng());
  assert.equal(result[0].immunityReason, 'enemy');
  assert.equal(target.statuses['motivation-down'], undefined);
});
test('Motivation applied after command lock does not replace the locked order', () => {
  const s = state(), actor = s.combatants[0], locked = plan(s);
  actor.statuses['motivation-down'] = true;
  initializeMotivation(actor, rng());
  assert.equal(revalidateAction(s, locked), null);
  assert.equal(locked.skill.key, actor.skills[0].key);
  assert.throws(() => plan(s), /blocked/);
  assert.equal(selectableSkills(actor, s.combatants)[0].source, 'motivation-guard');
});
test('Confusion with all confusion-compatible slots blocked skips without inventing Guard', () => {
  const member = unit('P', 0x34, { initialStatuses: { confusion: true, 'motivation-down': true } });
  member.techs.push(...[0xf4,0x68].map(id => unit('X',id).techs[0]));
  const result = run([member], [unit('E')], { actionPolicy: legacyActionPolicy });
  assert.notEqual(result.outcome, 'invalid');
  assert.notEqual(result.outcome, 'unsupported');
  assert.equal(action(result).reason, 'confusion-no-eligible-skill');
});
test('manual skip cannot bypass an available order', () => {
  const s = state(), actor = s.combatants[0];
  assert.throws(() => planAction(s, actor, { kind: 'skip', skillKey: actor.skills[0].key }), /Cannot skip/);
});
test('custom slot named motivation-guard does not acquire Guard behavior', () => {
  const member = unit('P'); member.techs[0].id = 'motivation-guard';
  const result = run([member], [unit('E')]);
  assert.equal(action(result).kind, 'attack');
  assert.equal(action(result).outcome, 'hit');
  assert.ok(action(result).impacts.length);
});
test('unchanged ineligible Assist preserves the Phase J draw order', () => {
  const random = rng();
  const result = run([unit('P',2)], [unit('E',0xc8)], { actionPolicy: legacyActionPolicy, rng: random });
  assert.equal(action(result,'E').reason, 'assist-ineligible');
  assert.deepEqual(random.draws.map(d => d.category), ['action-choice','initiative','initiative','target-choice','accuracy']);
});
for (const id of [0xa6,0xa8]) test('MP depleted before opportunity prevents Interrupt scheduling ' + id, () => {
  const s = state(undefined, [unit('I',id)]), target = plan(s), interrupt = plan(s,1);
  s.queue = calculateActionOrder(s,[target,interrupt],rng());
  target.prepared = { initialAccuracy: { outcome: 'hit' }, interruptConsumed: false };
  s.combatants[1].currentMp = data.getBattleSkillById(id).mpCost-1;
  const { claimInterrupt } = load('src/utils/battle/battleInterrupts.ts');
  assert.equal(claimInterrupt(s,target,new Set(),rng()),null);
  assert.equal(target.prepared.interruptConsumed,false);
  assert.equal(target.prepared.interruptedByActionId,undefined);
});
for (const skill of data.BATTLE_SKILLS.filter(s => s.recordKind === 'technique' && s.targetModes.includes('random-digimon'))) {
  for (const side of ['player','enemy']) test(`${skill.name} resolves one target on ${side} side`, () => {
    const member = unit('R',skill.id,{stats:{spd:100}}), other = [unit('T1'),unit('T2')];
    const result = side === 'player' ? run([member],other) : run(other,[member]);
    const record = action(result,'R');
    assert.equal(record.outcome,'hit');
    assert.equal(record.effectiveTargetIds.length,1);
    assert.equal(record.durationFrames,685);
    if (skill.targetGroup !== 'field') assert.ok(record.effectiveTargetIds[0].startsWith(side === 'player' ? 'enemy-' : 'player-'));
    if (skill.actionKind === 'counter') assert.equal(record.counter.targetRule,'random-policy');
  });
}
for (const id of [0x4b,0x67]) test('source recovery restriction lifecycle ' + id, () => {
  const s = state([unit('P',id)]), actor = s.combatants[0], target = s.combatants[1];
  const resource = data.getBattleSkillById(id).effects.find(e => e.kind === 'recovery-restriction').resource;
  const key = resource === 'hp' ? 'hpRecoveryBlocked' : 'statusRecoveryBlocked';
  applySupportEffects(s,actor,target,plan(s),'after-damage');
  assert.equal(target[key],true);
  clearRoundEffects(s);
  assert.equal(target[key],undefined);
});
test('Tusk Crusher source has no Double SPD; Slamming Tusk carries the reviewed flag', () => {
  const tusk = data.getBattleSkillById(0x34), slamming = data.getBattleSkillById(0x6e);
  assert.equal(tusk.name,'Tusk Crusher');
  assert.ok(!tusk.effects.some(e => e.kind === 'initiative-modifier'));
  assert.ok(slamming.effects.some(e => e.kind === 'initiative-modifier' && e.modifier === 'double-speed'));
  for (const [id,first] of [[0x34,'enemy-0'],[0x6e,'player-0']]) {
    const s=state([unit('P',id,{stats:{spd:30}})],[unit('E',2,{stats:{spd:50}})]),p=plan(s),e=plan(s,1);
    const order=calculateActionOrder(s,[p,e],rng());
    assert.equal(s.plannedActions.find(a=>a.id===order[0]).actorId,first);
    assert.equal(effectiveParameter(s.combatants[0],'spd'),30);
  }
});

for (const skill of data.BATTLE_SKILLS.filter(s => s.effects.some(e => e.kind === 'status-application' && e.status === 'motivation-down'))) {
  for (const policy of ['natural', 'tas-favorable']) test(`${skill.name}: guaranteed Motivation on Hit under ${policy}`, () => {
    const random = rng(), result = run([unit('P')], [unit('E', skill.id, { stats: { spd: 100 } })], { rng: random, simulationRules: { accuracyMode: 'strategy', rngPolicy: policy } });
    const applied = action(result, 'E').impacts.flatMap(i => i.statusApplications).find(s => s.status === 'motivation-down');
    assert.equal(applied.applied, true);
    assert.equal(applied.roll, null);
    assert.equal(applied.successesOutOf3, null);
    assert.equal(random.draws.some(d => d.category === 'status-apply-motivation-down'), false);
    assert.equal(action(result, 'E').effectDiagnostics.some(d => d.includes('application probability')), false);
  });
  test(`${skill.name}: Motivation does not apply on Miss`, () => {
    const result = run([unit('P')], [unit('E', skill.id, { stats: { spd: 100 }, initialStatuses: { paralysis: true } })], { rng: rng({ 'paralysis-failure': [1] }) });
    assert.equal(action(result,'E').outcome, 'miss');
    assert.equal(result.state.combatants[0].statuses['motivation-down'], undefined);
  });
}
for (const id of [0x15, 0x3d]) {
  for (const miss of [false,true]) test(`Shared DEF1 after Hit/Miss ${id}/${miss}`, () => {
    const result = run([unit('P',id)], [unit('E')], { rng: rng({ accuracy: [miss?127:0,0] }) });
    assert.equal(action(result).outcome, miss?'miss':'hit');
    assert.ok(action(result).effectAudit.some(e => e.includes('DEF = 1')));
    assert.equal(action(result,'E').impacts[0].damage,300);
    assert.equal(result.state.combatants[0].defenseOne,undefined);
  });
  test(`Shared DEF1 after mechanical Miss ${id}`, () => {
    const result = run([unit('P',id,{initialStatuses:{paralysis:true}})], [unit('E')], {rng:rng({'paralysis-failure':[1]})});
    assert.equal(action(result).outcome,'miss');
    assert.equal(action(result,'E').impacts[0].damage,300);
  });
  test(`Shared DEF1 does not apply to skipped action ${id}`, () => {
    const result = run([unit('P')], [unit('E',id,{currentHp:1,stats:{spd:1}})]);
    assert.equal(action(result,'E').outcome,'skipped');
    assert.equal(result.state.combatants[1].defenseOne,undefined);
  });
}
