// Run with: node --test tests/runPlanner.test.cjs
// Load the existing TypeScript data modules in memory; no generated files or new dependencies.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.DEV', 'false');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const localRequire = (id) => id.startsWith('@/')
    ? load(path.join('src', id.slice(2)) + '.ts') : require(id);
  new Function('require', 'module', 'exports', js)(localRequire, mod, mod.exports);
  return mod.exports;
}
const { createRunPlan } = load('src/utils/runPlanCreation.ts');
const { STARTERS } = load('src/data/starters.ts');
const { validateRunPlan } = load('src/utils/runInvariants.ts');
const storage = load('src/utils/runPlannerStorage.ts');
const { runDataSelfChecks } = load('src/utils/dataSelfChecks.ts');
let values;
beforeEach(() => {
  values = new Map();
  global.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
});
const envelope = (run) => ({ schemaVersion: 1, runs: [run], activeRunId: run.id });
for (const starter of STARTERS) {
  test(starter.label + ' creates, persists, reloads, resets and recreates a valid run', () => {
    assert.deepEqual(storage.loadRunPlannerData(), storage.emptyRunPlannerData());
    const run = createRunPlan(starter.id, '  Test run  ');
    assert.equal(run.name, 'Test run');
    assert.equal(run.roster.length, 1);
    const member = run.roster[0];
    assert.equal(member.speciesId, starter.speciesId);
    assert.deepEqual(member.stats, starter.stats);
    assert.notEqual(member.stats, starter.stats);
    assert.deepEqual(member.techs, starter.techs);
    assert.notEqual(member.techs, starter.techs);
    assert.equal(member.level, starter.level);
    assert.equal(member.totalXp, starter.totalXp);
    assert.deepEqual(member.source, { type: 'starter' });
    assert.equal(run.starterInstanceId, member.instanceId);
    assert.deepEqual(run.digiline, [member.instanceId]);
    assert.equal(run.totalBits, 0);
    assert.deepEqual(run.battles, []);
    assert.equal(run.createdAt, run.updatedAt);
    assert.ok(Number.isFinite(Date.parse(run.createdAt)));
    assert.deepEqual(validateRunPlan(run), []);
    assert.equal(storage.saveRunPlannerData(envelope(run)), true);
    assert.deepEqual(storage.loadRunPlannerData(), envelope(run));
    values.set('unrelated', 'keep');
    assert.equal(storage.resetRunPlannerData(), true);
    assert.equal(values.has(storage.RUN_PLANNER_STORAGE_KEY), false);
    assert.equal(values.get('unrelated'), 'keep');
    assert.deepEqual(storage.loadRunPlannerData(), storage.emptyRunPlannerData());
    const next = createRunPlan(starter.id, '');
    assert.notEqual(next.id, run.id);
    assert.notEqual(next.starterInstanceId, member.instanceId);
    assert.equal(storage.saveRunPlannerData(envelope(next)), true);
  });
}
test('invalid starter is rejected', () => assert.throws(() => createRunPlan('unknown', 'Run')));
test('malformed and incompatible storage falls back without overwriting it', () => {
  for (const raw of ['{broken', JSON.stringify({schemaVersion: 2, runs: []}), 'null']) {
    values.set(storage.RUN_PLANNER_STORAGE_KEY, raw);
    assert.deepEqual(storage.loadRunPlannerData(), storage.emptyRunPlannerData());
    assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY), raw);
  }
});
test('storage rejects duplicate instances, duplicate run IDs and broken active references', () => {
  const run = createRunPlan('gold-hawk', 'Run');
  for (const data of [
    {...envelope(run), runs: [run, run]},
    {...envelope(run), activeRunId: 'missing'},
    envelope({...run, roster: [run.roster[0], run.roster[0]]}),
    envelope({...run, digiline: [run.starterInstanceId, run.starterInstanceId]}),
  ]) assert.equal(storage.saveRunPlannerData(data), false);
});
test('saving a remaining run preserves the version-1 multi-run envelope', () => {
  const first = createRunPlan('gold-hawk', 'First');
  const second = createRunPlan('blue-falcon', 'Second');
  assert.equal(storage.saveRunPlannerData({schemaVersion:1,runs:[first,second],activeRunId:first.id}),true);
  const remaining = {schemaVersion:1,runs:[second],activeRunId:null};
  assert.equal(storage.saveRunPlannerData(remaining), true);
  assert.deepEqual(storage.loadRunPlannerData(), remaining);
});
test('storage access failures are reported without throwing', () => {
  global.localStorage = {
    getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); },
    removeItem() { throw Error('denied'); },
  };
  assert.deepEqual(storage.loadRunPlannerData(), storage.emptyRunPlannerData());
  assert.equal(storage.saveRunPlannerData(envelope(createRunPlan('gold-hawk', 'Run'))), false);
  assert.equal(storage.resetRunPlannerData(), false);
});
test('all existing Phase 1.6a data self-checks still pass', () => {
  const checks = runDataSelfChecks();
  assert.equal(checks.length, 46);
  assert.deepEqual(checks.filter((check) => !check.passed), []);
});

// Synthetic multi-instance rosters stay in tests; no production starter/capture changes.
const { addToDigiline, removeFromDigiline, moveDigilineMember } = load('src/utils/runDigiline.ts');
function multiRun() {
  const run = createRunPlan('gold-hawk', 'Synthetic roster');
  const first = run.roster[0];
  run.roster = [first, ...['reserve-a', 'reserve-b', 'reserve-c'].map((instanceId, index) => ({
    ...first, instanceId, stats: {...first.stats, hp: first.stats.hp + index + 0.5},
    techs: [...first.techs],
  }))];
  assert.deepEqual(validateRunPlan(run), []);
  return run;
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
function fullRun() {
  return addToDigiline(addToDigiline(multiRun(), 'reserve-a'), 'reserve-b');
}
test('reserve instances append in order up to exactly three, including same-species instances', () => {
  const run = freeze(multiRun());
  const second = addToDigiline(run, 'reserve-a');
  const third = addToDigiline(second, 'reserve-b');
  assert.deepEqual(run.digiline, [run.starterInstanceId]);
  assert.deepEqual(second.digiline, [run.starterInstanceId, 'reserve-a']);
  assert.deepEqual(third.digiline, [run.starterInstanceId, 'reserve-a', 'reserve-b']);
  assert.equal(third.digiline.length, 3);
  assert.deepEqual(validateRunPlan(third), []);
});
test('fourth member and already-active IDs are rejected without mutation', () => {
  const run = freeze(fullRun());
  const before = JSON.stringify(run);
  assert.throws(() => addToDigiline(run, 'reserve-c'), /max 3/);
  assert.throws(() => addToDigiline(multiRun(), 'reserve-a-does-not-exist'), /not in the roster/);
  const single = multiRun();
  assert.throws(() => addToDigiline(single, single.starterInstanceId), /duplicate/i);
  assert.equal(JSON.stringify(run), before);
});
test('removal keeps roster data and remaining order; re-add appends at the end', () => {
  const run = freeze(fullRun());
  const removed = removeFromDigiline(run, 'reserve-a');
  assert.deepEqual(removed.digiline, [run.starterInstanceId, 'reserve-b']);
  assert.deepEqual(removed.roster, run.roster);
  assert.equal(removed.roster.length, 4);
  assert.deepEqual(addToDigiline(removed, 'reserve-a').digiline,
    [run.starterInstanceId, 'reserve-b', 'reserve-a']);
  assert.equal(removeFromDigiline(removed, 'reserve-a'), removed);
});
test('starter can become reserve and an empty Digiline remains valid and persisted', () => {
  const run = multiRun();
  const empty = removeFromDigiline(run, run.starterInstanceId);
  assert.deepEqual(empty.digiline, []);
  assert.equal(empty.starterInstanceId, run.starterInstanceId);
  assert.deepEqual(empty.roster, run.roster);
  assert.deepEqual(validateRunPlan(empty), []);
  assert.equal(storage.saveRunPlannerData(envelope(empty)), true);
  assert.deepEqual(storage.loadRunPlannerData().runs[0].digiline, []);
  assert.deepEqual(addToDigiline(empty, run.starterInstanceId).digiline, run.digiline);
});
test('up and down swap adjacent slots without changing roster order or original input', () => {
  const run = freeze(fullRun());
  const up = moveDigilineMember(run, 'reserve-b', 'up');
  assert.deepEqual(up.digiline, [run.starterInstanceId, 'reserve-b', 'reserve-a']);
  const down = moveDigilineMember(up, 'reserve-b', 'down');
  assert.deepEqual(down.digiline, run.digiline);
  assert.deepEqual(down.roster, run.roster);
});
test('first/last moves are no-ops and cannot wrap into an empty slot', () => {
  const run = fullRun();
  assert.equal(moveDigilineMember(run, run.starterInstanceId, 'up'), run);
  assert.equal(moveDigilineMember(run, 'reserve-b', 'down'), run);
  const one = multiRun();
  assert.equal(moveDigilineMember(one, one.starterInstanceId, 'up'), one);
  assert.equal(moveDigilineMember(one, one.starterInstanceId, 'down'), one);
});
test('unknown instances, reserve moves and invalid directions are rejected', () => {
  const run = multiRun();
  assert.throws(() => addToDigiline(run, 'missing'), /not in the roster/);
  assert.throws(() => removeFromDigiline(run, 'missing'), /not in the roster/);
  assert.throws(() => moveDigilineMember(run, 'missing', 'up'), /not in the roster/);
  assert.throws(() => moveDigilineMember(run, 'reserve-a', 'up'), /Only active/);
  assert.throws(() => moveDigilineMember(run, run.starterInstanceId, 'sideways'), /direction/);
});
test('add, reorder and remove each survive save/load with exact slot order', () => {
  let run = multiRun();
  const original = run;
  for (const mutate of [
    (r) => addToDigiline(r, 'reserve-a'),
    (r) => addToDigiline(r, 'reserve-b'),
    (r) => moveDigilineMember(r, 'reserve-b', 'up'),
    (r) => removeFromDigiline(r, r.starterInstanceId),
  ]) {
    const next = mutate(run);
    assert.equal(storage.saveRunPlannerData(envelope(next)), true);
    run = storage.loadRunPlannerData().runs[0];
    assert.deepEqual(run, next);
  }
  assert.deepEqual(run.digiline, ['reserve-b', 'reserve-a']);
  assert.deepEqual(run.roster, original.roster);
});
test('Digiline mutations preserve history snapshots, rewards, fractional stats and identity', () => {
  const run = multiRun();
  run.totalBits = 100;
  run.battles = [{id:'history',order:0,domainId:'test',encounterId:182,
    digilineInstanceIds:[run.starterInstanceId],xpReward:0,bitsReward:0}];
  freeze(run);
  const before = JSON.stringify(run);
  const changed = moveDigilineMember(addToDigiline(run,'reserve-a'),'reserve-a','up');
  const {digiline, ...other} = changed;
  const {digiline: originalDigiline, ...originalOther} = run;
  assert.deepEqual(other, originalOther);
  assert.equal(JSON.stringify(run), before);
  assert.deepEqual(changed.battles[0].digilineInstanceIds, [run.starterInstanceId]);
  assert.notDeepEqual(digiline, originalDigiline);
});
test('failed save of a Digiline update retains the previously persisted run', () => {
  const run = multiRun();
  storage.saveRunPlannerData(envelope(run));
  const before = values.get(storage.RUN_PLANNER_STORAGE_KEY);
  global.localStorage.setItem = () => {throw Error('quota');};
  assert.equal(storage.saveRunPlannerData(envelope(addToDigiline(run,'reserve-a'))),false);
  assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY), before);
  assert.deepEqual(storage.loadRunPlannerData(), envelope(run));
});
test('static data coverage remains complete after Digiline management', () => {
  const report = load('src/utils/dataValidation.ts').validateGameData();
  assert.equal(report.rewards.uniqueMatches,184);
  assert.equal(report.domains.resolvedGroups,473);
  assert.equal(report.growth.canonicalProfiles,195);
  assert.deepEqual(report.issues.filter((issue) => issue.severity === 'error'),[]);
});
