const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./helpers/loadTs.cjs');
const { cases, member, tech } = require('./helpers/battleFixtures.cjs');
const { createSequenceBattleRng: sequence, createSeededBattleRng: seeded, createBattleRng, SEEDED_RNG_VERSION } = load('src/utils/battle/battleRng.ts');
const { simulateBattleCore: simulate, runBattleSimulation, assessBattleScenario, assessBattleSkill } = load('src/utils/battleEngine.ts');
const { createBattleState, linkLegacySkill } = load('src/utils/battle/battleInput.ts');
const { planAction, legacyActionPolicy } = load('src/utils/battle/battleActions.ts');
const { calculateActionOrder } = load('src/utils/battle/battleOrder.ts');
const { resolveEffectiveTargets } = load('src/utils/battle/battleTargets.ts');
const { calculateLegacyDamage } = load('src/utils/battle/battleDamage.ts');
const { getBattleSkillByName } = load('src/data/battleSkills.ts');
const input = (player, enemy) => ({ player, enemy, floorSpecialty: 'None' });
const zeros = () => sequence(Array(10000).fill(0));
const run = (player, enemy, options = {}) => simulate(input(player, enemy), { rng: zeros(), ...options });
const executed = r => r.actions.filter(a => a.state === 'resolved');
const preparation = (pSpeed = 20, eSpeed = 20) => {
  const state = createBattleState(input([member('P', [tech('Rock Fist')], { spd: pSpeed })], [member('E', [tech('Rock Fist')], { spd: eSpeed })]));
  state.round = 1;
  const actions = state.combatants.map(a => planAction(state, a, { kind: 'skill', skillKey: a.skills[0].key }));
  return { state, actions };
};

test('Math.random is confined to the production RNG adapter', () => {
  for (const file of fs.readdirSync('src/utils/battle').filter(f => f.endsWith('.ts') && f !== 'battleRng.ts')) assert.ok(!fs.readFileSync(`src/utils/battle/${file}`, 'utf8').includes('Math.random'), file);
});
test('programmed RNG exact primitives, draw categories and exhaustion', () => {
  const r = sequence([0, 0.999999, 0.5]);
  assert.equal(r.nextIntInclusive(0, 10, 'initiative'), 0);
  assert.equal(r.nextIntInclusive(0, 10, 'initiative'), 10);
  assert.equal(r.nextIntExclusive(4, 'target-choice'), 2);
  assert.deepEqual(r.draws.map(d => d.category), ['initiative', 'initiative', 'target-choice']);
  assert.throws(() => r.nextFloat(), /exhausted after 3/);
});
test('programmed exhaustion propagates through core without becoming an outcome or random fallback', () => {
  assert.throws(() => run(...cases.single, { rng: sequence([0]) }), /exhausted/);
});
test('RNG rejects invalid floats and unsafe bounds', () => {
  for (const bad of [-0.1, 1, Infinity, NaN]) assert.throws(() => createBattleRng(() => bad).nextFloat());
  const r = sequence([0]);
  for (const bad of [0, -1, 0.5, Infinity]) assert.throws(() => r.nextIntExclusive(bad));
  assert.throws(() => r.nextIntInclusive(2, 1)); assert.throws(() => r.nextIntInclusive(-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER));
  assert.equal(r.consumed, 0);
});
test('seed algorithm is versioned and matches stable golden vector', () => {
  assert.equal(SEEDED_RNG_VERSION, 'mulberry32-v1');
  const r = seeded(1);
  assert.deepEqual(Array.from({ length: 4 }, () => r.nextFloat()), [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741]);
  for (const bad of [-1, 1.5, 4294967296, NaN]) assert.throws(() => seeded(bad));
});
test('same seed, engine and input yield identical complete canonical histories and state', () => {
  assert.deepEqual(run(...cases.choices, { rng: seeded(123) }), run(...cases.choices, { rng: seeded(123) }));
});
test('different seed changes choices or order', () => {
  assert.notDeepEqual(run(...cases.choices, { rng: seeded(1) }).actions, run(...cases.choices, { rng: seeded(2) }).actions);
});
test('action and target selection consume exactly the requested programmed draws', () => {
  const state = createBattleState(input(cases.choices[0], cases.choices[1]));
  state.round = 1;
  const r = sequence([0.9, 0.9]);
  const actor = state.combatants[0];
  const choice = legacyActionPolicy.chooseAction(actor, { round: 1, combatants: state.combatants }, r);
  assert.equal(choice.skillKey, 'rock-fist');
  const action = planAction(state, actor, choice);
  assert.deepEqual(resolveEffectiveTargets(state, action, r), ['enemy-1']);
  assert.deepEqual(r.draws.map(d => d.category), ['action-choice', 'target-choice']);
  assert.equal(r.consumed, 2);
});
test('one-hit battle has exact draw budget including Phase 2K-E accuracy', () => {
  const r = sequence([0, 0, 0, 0, 0, 0]);
  const result = run([member('P', [tech('Terra Force')], { spd: 100 })], [member('E', [tech('Rock Fist')], { hp: 1 })], { rng: r });
  assert.equal(result.outcome, 'player-win'); assert.equal(r.consumed, 6);
  assert.deepEqual(r.draws.map(d => d.category), ['action-choice', 'action-choice', 'initiative', 'initiative', 'target-choice', 'accuracy']);
});
for (const [float, expected] of [[0, 20], [0.999999, 30]]) test(`initiative roll reaches ${expected - 20}`, () => {
  const { state, actions } = preparation(); calculateActionOrder(state, actions, sequence([float, 0]));
  assert.equal(actions[0].initiative, expected);
});
test('a base speed advantage within 10 can lose order', () => {
  const { state, actions } = preparation(29, 20);
  assert.deepEqual(calculateActionOrder(state, actions, sequence([0, 0.999999])), [actions[1].id, actions[0].id]);
});
test('11 effective SPD advantage beats maximum opposing roll', () => {
  const { state, actions } = preparation(31, 20);
  assert.deepEqual(calculateActionOrder(state, actions, sequence([0, 0.999999])), [actions[0].id, actions[1].id]);
});
test('effective SPD uses existing multiplier state without changing stack semantics', () => {
  const { state, actions } = preparation(40, 30); state.combatants[0].parameterModifiers.spd = 0.5;
  assert.deepEqual(calculateActionOrder(state, actions, sequence([0, 0])), [actions[1].id, actions[0].id]);
  assert.equal(actions[0].initiative, 20);
});
test('existing SPD debuff affects the next round in actual core resolution', () => {
  const r = run([member('P', [tech('Coral Crusher')], { hp: 200, spd: 25 })], [member('E', [tech('Rock Fist')], { hp: 200, spd: 30 })], { maxRounds: 2 });
  assert.deepEqual(executed(r).map(a => a.actorId), ['enemy-0', 'player-0', 'player-0', 'enemy-0']);
});
test('advanced WAZADATA priority flags remain deferred', () => {
  const r = run([member('P', [{ ...tech('Rock Fist'), id: 'rail-cannon', name: 'Rail Cannon' }], { spd: 100 })], [member('E', [tech('Rock Fist')])]);
  assert.equal(executed(r)[0].actorId, 'player-0');
});
for (const count of [1, 2, 3]) test(`one AOE execution produces ${count} independent impacts`, () => {
  const enemies = Array.from({ length: count }, (_, i) => member('Duplicate', [tech('Rock Fist')], { hp: i === 0 ? 5 : 80, def: 20 + i * 10 }));
  const r = run([member('P', [tech('Triple Forces')], { spd: 100 })], enemies);
  const a = executed(r)[0];
  assert.equal(a.impacts.length, count); assert.equal(new Set(a.impacts.map(i => i.targetId)).size, count);
  assert.deepEqual(a.impacts.map(i => i.hpBefore), enemies.map(e => e.customStats.hp));
  assert.ok(a.impacts.every(i => i.hpAfter === Math.max(0, i.hpBefore - i.damage)));
  assert.equal(a.durationFrames, [703, 873, 990][count - 1]); assert.equal(a.canonicalSkillId, getBattleSkillByName('Triple Forces').id);
  assert.equal(r.actionCount, executed(r).length);
});
test('Single action has one impact and preserves normal damage', () => {
  const first = executed(run(...cases.single))[0]; assert.equal(first.impacts.length, 1); assert.equal(first.impacts[0].damage, 17);
});
test('action IDs are stable and independent of duplicate display names', () => {
  const r1 = run(...cases.aoe), r2 = run(...cases.aoe);
  assert.deepEqual(r1.actions.map(a => a.id), r2.actions.map(a => a.id));
  assert.equal(new Set(r1.actions.map(a => a.id)).size, r1.actions.length);
  assert.ok(r1.actions.every(a => /^s0-r\d+-a\d+$/.test(a.id)));
});
test('actor KO skips its queued action while other actors continue', () => {
  const r = run(...cases.koSkip);
  assert.ok(r.actions.some(a => a.actorId === 'enemy-0' && a.state === 'skipped'));
  assert.ok(!executed(r).some(a => a.actorId === 'enemy-0'));
  assert.ok(executed(r).some(a => a.actorId === 'enemy-1'));
});
test('explicit selected target IDs are revalidated after KO, without stale reference damage', () => {
  const { state, actions } = preparation();
  actions[0].targetIntent = { kind: 'combatants', targetIds: ['enemy-0'] };
  state.combatants[1].isAlive = false; state.combatants[1].currentHp = 0;
  assert.deepEqual(resolveEffectiveTargets(state, actions[0], sequence([])), []);
});
test('queues empty on normal completion and operational limit', () => {
  assert.deepEqual(run(...cases.single).state.queue, []);
  assert.deepEqual(run(...cases.single, { maxRounds: 1 }).state.queue, []);
});
test('Counter promotion preserves its intention ID and correct causal actor/action linkage', () => {
  const r = run(...cases.counter);
  const reaction = executed(r).find(a => a.reaction);
  assert.ok(reaction); assert.equal(reaction.kind, 'counter');
  const cause = r.actions.find(a => a.id === reaction.reaction.reactionToActionId);
  assert.equal(reaction.reaction.triggeredByActorId, cause.actorId);
  assert.equal(reaction.reaction.counterActorId, reaction.actorId);
  assert.notEqual(reaction.id, cause.id);
  assert.equal(r.state.plannedActions.filter(a => a.round === reaction.round && a.actorId === reaction.actorId).length, 1);
  assert.equal(r.actions.filter(a => a.id === reaction.id).length, 1);
});
test('Counter non-trigger behavior uses base offense with no fabricated reaction context', () => {
  const r = run(...cases.noCounter);
  const counters = executed(r).filter(a => a.kind === 'counter');
  assert.ok(counters.length); assert.ok(counters.every(a => a.reaction === null));
});
test('no damage loop terminates operationally with no winner', () => {
  const r = run([member('P', [tech('Rock Fist')], { atk: 0 })], [member('E', [tech('Rock Fist')], { atk: 0 })], { maxRounds: 3 });
  assert.equal(r.outcome, 'limit-reached'); assert.equal(r.rounds, 3); assert.equal(r.winner, null); assert.equal(r.actionCount, 6);
});
test('normal battle below maxRounds still completes', () => {
  const r = run(...cases.single, { maxRounds: 100 }); assert.ok(['player-win', 'enemy-win'].includes(r.outcome)); assert.ok(r.rounds < 100);
});
test('legacy public API rejects incomplete batch rather than counting a fabricated victory', () => {
  assert.throws(() => runBattleSimulation(...cases.single, 'None', 1, { maxRounds: 1, rng: zeros() }), /limit-reached/);
});
test('runtime state tracks HP/MP with Phase 2K-D resource accounting and future status slots', () => {
  const r = run(...cases.single); const a = r.state.combatants[0];
  assert.ok(a.currentMp < a.maxMp); assert.equal(a.maxHp, 80); assert.equal(a.side, 'player'); assert.equal(a.position, 0);
  assert.deepEqual(a.statuses, {}); assert.deepEqual(a.temporaryPowers, {}); assert.equal(a.guarding, undefined);
});
test('input snapshots are isolated and caller instance IDs are preserved', () => {
  const p = structuredClone(cases.single[0]); p[0].instanceId = 'planner-slot-future'; const original = structuredClone(p);
  const r = run(p, cases.single[1]); assert.deepEqual(p, original);
  assert.equal(r.state.combatants[0].sourceInstanceId, 'planner-slot-future');
  assert.equal(r.state.combatants[0].id, 'player-instance-planner-slot-future');
});
test('Guard is rejected before planning and has no MP/DEF behavior', () => {
  const r = run(...cases.single, { actionPolicy: { chooseAction: () => ({ kind: 'guard' }) } });
  assert.equal(r.outcome, 'unsupported'); assert.equal(r.winner, null);
  assert.deepEqual(r.actions, []); assert.deepEqual(r.state.plannedActions, []);
  assert.ok(r.state.combatants.every(a => a.currentMp === a.maxMp && Object.keys(a.parameterModifiers).length === 0));
});
test('policy-selected Assist keeps canonical kind and applies authoritative support', () => {
  const assist = { id: 'assist-test', name: 'Armor Coating', ap: 0, element: 'None', target: 'Single', isCounter: false };
  const r = run([member('P', [assist], { spd: 100 })], cases.single[1], { actionPolicy: { chooseAction: actor => ({ kind: 'skill', skillKey: actor.skills[0].key }) } });
  assert.equal(r.outcome, 'limit-reached'); assert.equal(r.actions[0].kind, 'assist'); assert.equal(r.actions[0].impacts.length, 1); assert.equal(r.actions[0].supportEvents[0].kind,'stage');
});
test('Interrupt canonical identity uses scheduled execution with measured prelude-inclusive timing', () => {
  const r = run([member('P', [tech('Electro Shocker')], { spd: 100 })], cases.single[1]);
  const a = executed(r)[0]; assert.equal(a.kind, 'interrupt'); assert.equal(a.canonicalSkillId, 0xa0);
  assert.equal(assessBattleSkill(r.state.combatants[0].skills[0]).level, 'supported'); assert.equal(a.interrupt.targetPolicy,'player-random'); assert.equal(a.durationFrames,761);
});
test('synthetic fallback is explicit, noncanonical and only for manual compatibility', () => {
  const r = run([member('P', [], { spd: 100 })], cases.single[1]); const a = executed(r)[0];
  assert.equal(a.source, 'synthetic-legacy-fallback'); assert.equal(a.canonicalSkillId, null);
  assert.equal(a.skillName, 'Basic Attack');
});
test('unknown identities or unusable unknown skills never create synthetic attacks', () => {
  for (const t of [{ ...tech('Rock Fist'), canonicalSkillId: 9999 }, { ...tech('Rock Fist'), id: 'unknown', name: 'unknown', ap: 0 }]) {
    const r = run([member('P', [t])], cases.single[1]); assert.equal(r.winner, null);
    assert.ok(['invalid', 'unsupported'].includes(r.outcome)); assert.ok(!r.actions.some(a => a.source === 'synthetic-legacy-fallback'));
  }
});
test('Alias Fake encounter remains incomplete and public facade rejects it', () => {
  const encounter = load('src/data/encounters.ts').encounters.find(e => e.id === 149);
  const r = run(cases.single[0], encounter); assert.equal(r.outcome, 'invalid'); assert.equal(r.winner, null);
  assert.ok(r.diagnostics.join().includes('Alias Fake')); assert.equal(r.actions.length, 0);
  assert.throws(() => runBattleSimulation(cases.single[0], encounter, 'None', 1), /Alias Fake/);
});
for (const [stat, value] of [['hp', -1], ['mp', -1], ['atk', NaN], ['spd', Infinity], ['def', 0], ['def', 0.2]]) test(`reject invalid runtime ${stat}=${value}`, () => {
  const r = run([member('P', [tech('Rock Fist')], { [stat]: value })], cases.single[1]);
  assert.equal(r.outcome, 'invalid'); assert.equal(r.winner, null);
  assert.ok(!r.actions.flatMap(a => a.impacts).some(i => !Number.isFinite(i.damage)));
});
test('damage overflow and invalid AP fail explicitly', () => {
  for (const value of [-1, NaN, Infinity]) assert.equal(run([member('P', [tech('Rock Fist', { ap: value })])], cases.single[1]).outcome, 'invalid');
  const state = createBattleState(input(cases.single[0], cases.single[1]));
  state.combatants[0].baseStats.atk = Number.MAX_VALUE;
  assert.throws(() => calculateLegacyDamage(...state.combatants, tech('Rock Fist'), 'None'), /arithmetic/);
});
test('invalid operational limits and simulation counts are rejected', () => {
  for (const limit of [0, -1, 0.5, Infinity]) assert.equal(run(...cases.single, { maxRounds: limit }).outcome, 'invalid');
  for (const count of [0, -1, NaN, 0.5]) assert.throws(() => runBattleSimulation(...cases.single, 'None', count), /simulationCount/);
});
test('support diagnostic distinguishes unknown, incomplete and future mechanics', () => {
  assert.equal(assessBattleSkill(linkLegacySkill({ ...tech('Rock Fist'), id: 'unknown', name: 'unknown' })).level, 'unknown');
  assert.equal(assessBattleSkill(linkLegacySkill(tech('Black Pearl Shot'))).level, 'canonical-data-incomplete');
  assert.equal(assessBattleSkill(linkLegacySkill(tech('Poison Ivy'))).level, 'legacy-compatibility');
  assert.equal(assessBattleSkill(linkLegacySkill(tech('Rock Fist'))).level, 'legacy-compatibility');
  const scenario = input(...cases.single); const copy = structuredClone(scenario);
  assert.equal(assessBattleScenario(scenario).valid, true); assert.deepEqual(scenario, copy);
});
test('implemented canonical direct ailments coexist with the single legacy effect path', () => {
  const r = run([member('P', [tech('Poison Ivy')], { spd: 100 })], cases.single[1]);
  assert.ok(r.actions.flatMap(a => a.impacts).some(i => i.statusApplications.some(s => s.status === 'poison' && s.applied)));
  assert.ok(r.state.combatants.every(a => !a.statuses.paralysis && !a.statuses.confusion));
  assert.ok(executed(r).every(a => a.outcome === 'hit')); // Timing now measured; status resolution remains deferred.
});
test('a planned action can be cancelled before execution without changing its identity', () => {
  const { state, actions } = preparation(); const id = actions[0].id;
  actions[0].state = 'cancelled';
  assert.equal(load('src/utils/battle/battleActions.ts').revalidateAction(state, actions[0]), 'cancelled');
  assert.equal(actions[0].id, id);
});
test('canonical debuff uses discrete stages clamped to minus two', () => {
  const r = run([member('P', [tech('Scissor Claw')], { hp: 1000, spd: 100 })], [member('E', [tech('Rock Fist')], { hp: 1000 })], { maxRounds: 8 });
  assert.equal(r.state.combatants[1].defStage, -2);
  assert.equal(r.state.combatants[1].parameterModifiers.def, undefined);
});
test('missing numeric stats are rejected before initiative', () => {
  const m = member('P', [tech('Rock Fist')]); delete m.customStats.spd;
  assert.equal(run([m], cases.single[1]).outcome, 'invalid');
});
test('defense arithmetic overflow is invalid, not silently zero damage', () => {
  const state = createBattleState(input(...cases.single));
  state.combatants[1].baseStats.def = Number.MAX_VALUE; state.combatants[1].specialty = 'Fire';
  assert.throws(() => calculateLegacyDamage(...state.combatants, tech('Rock Fist'), 'Fire'), /arithmetic/);
});
test('public UI can still complete a supported legacy simulation', async () => {
  const React = require('react'); const rngModule = load('src/utils/battle/battleRng.ts');
  const { BattleSimulation } = load('src/components/BattleSimulation.tsx');
  const original = { useState: React.useState, useMemo: React.useMemo, setTimeout: global.setTimeout, rng: rngModule.createProductionBattleRng };
  const states = [null, 0, 'encounter', 1, null, 'none', 1, '', false]; let cursor = 0, scheduled, completed;
  const busy = [];
  try {
    React.useState = initial => { const i = cursor++; return [i in states ? states[i] : typeof initial === 'function' ? initial() : initial, value => { if (i === 8) busy.push(value); }]; };
    React.useMemo = fn => fn(); global.setTimeout = fn => { scheduled = fn; return 1; };
    rngModule.createProductionBattleRng = () => seeded(42);
    const tree = BattleSimulation({ savedTeams: [cases.single[0]], onSimulationComplete: result => { completed = result; } });
    const find = node => {
      if (!node || typeof node !== 'object') return;
      if (node.props?.onClick) return node.props.onClick;
      for (const child of [node.props?.children].flat(Infinity)) { const fn = find(child); if (fn) return fn; }
    };
    await find(tree)(); scheduled();
    assert.deepEqual(busy, [true, false]); assert.equal(completed.totalSimulations, 1);
    assert.ok(completed.fastestBattleHistory.length > 0);
  } finally {
    React.useState = original.useState; React.useMemo = original.useMemo; global.setTimeout = original.setTimeout; rngModule.createProductionBattleRng = original.rng;
  }
});
