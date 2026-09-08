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
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const localRequire = (id) => {
    if (!id.startsWith('@/')) return require(id);
    const base = path.join('src', id.slice(2));
    return load(base + (fs.existsSync(path.resolve(root, base + '.ts')) ? '.ts' : '.tsx'));
  };
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
const envelope = (run) => ({ schemaVersion: 3, runs: [run], activeRunId: run.id });
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
    assert.equal(run.totalBits, 1030);
    assert.equal(run.history.filter(event=>event.type==='battle').length,0);
    assert.deepEqual(run.history, []);
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
    assert.equal(next.totalBits,1030);
    assert.notEqual(next.id, run.id);
    assert.notEqual(next.starterInstanceId, member.instanceId);
    assert.equal(storage.saveRunPlannerData(envelope(next)), true);
  });
}
test('invalid starter is rejected', () => assert.throws(() => createRunPlan('unknown', 'Run')));
test('malformed and incompatible storage falls back without overwriting it', () => {
  for (const raw of ['{broken', JSON.stringify({schemaVersion: 1, runs: [], activeRunId: null}), 'null']) {
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
test('saving a remaining run preserves the version-3 multi-run envelope', () => {
  const first = createRunPlan('gold-hawk', 'First');
  const second = createRunPlan('blue-falcon', 'Second');
  assert.equal(storage.saveRunPlannerData({schemaVersion: 3,runs:[first,second],activeRunId:first.id}),true);
  const remaining = {schemaVersion: 3,runs:[second],activeRunId:null};
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
  run.history = [{type:'battle',id:'history',order:0,domainId:'test',phase:'before-blood-knights',floor:1,encounterId:182,
    preActionCheckpoint:load('src/utils/runActionCheckpoint.ts').createRunActionCheckpoint(run),
    capturedEnemySlot:null,capturedInstanceId:null,capturedLevelCap:null,
    digilineInstanceIds:[run.starterInstanceId],xpReward:0,bitsReward:0}];
  freeze(run);
  const before = JSON.stringify(run);
  const changed = moveDigilineMember(addToDigiline(run,'reserve-a'),'reserve-a','up');
  const {digiline, ...other} = changed;
  const {digiline: originalDigiline, ...originalOther} = run;
  assert.deepEqual(other, originalOther);
  assert.equal(JSON.stringify(run), before);
  assert.deepEqual(changed.history[0].digilineInstanceIds, [run.starterInstanceId]);
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

const selection = load('src/utils/runBattleSelection.ts');
const before = 'before-blood-knights';
const after = 'after-blood-knights';
test('phase Domain queries expose only existing variants', () => {
  const { DOMAINS } = load('src/data/domains.ts');
  for (const phase of [before, after]) {
    assert.deepEqual(selection.getDomainsForPhase(phase), DOMAINS.filter(d => d.variants.some(v => v.phase === phase)));
  }
  assert.ok(selection.getDomainsForPhase(before).some(d => d.id === 'boot-domain'));
  assert.ok(!selection.getDomainsForPhase(after).some(d => d.id === 'boot-domain'));
  assert.deepEqual(selection.getEncountersForFloor('boot-domain', after, 1), []);
  assert.deepEqual(selection.getFloorsForDomain('missing', before), []);
});
test('floors are derived from explicit sparse mappings', () => {
  assert.deepEqual(selection.getFloorsForDomain('video-domain', before), [1, 2, 3, 5]);
  assert.deepEqual(selection.getEncountersForFloor('video-domain', before, 4), []);
  assert.deepEqual(selection.getFloorsForDomain('scsi-domain', before), [1, 2, 3, 4]);
});
test('floor queries isolate phase and preserve multi-floor encounter availability', () => {
  const ids = (domain, phase, floor) => selection.getEncountersForFloor(domain, phase, floor).map(e => e.encounterId);
  assert.deepEqual(ids('scsi-domain', before, 1), [32, 31]);
  assert.deepEqual(ids('scsi-domain', after, 1), [35, 5, 65]);
  assert.deepEqual(ids('video-domain', before, 2), [33, 34]);
  assert.deepEqual(ids('video-domain', before, 3), [33, 34]);
});
test('boss metadata remains specific to the selected location with regular enemies on the same floor', () => {
  const options = selection.getEncountersForFloor('scsi-domain', after, 6);
  assert.deepEqual(options.map(e => [e.encounterId, e.isBoss]), [[69, false], [99, true]]);
  assert.deepEqual(options.map(e => e.groupIds), [[24], [25]]);
  assert.deepEqual(selection.getEncountersForFloor('disk-domain', after, 7).filter(e => e.isBoss).map(e => e.encounterId), [101, 102]);
});
test('preview retains exact canonical stats, techniques, levels, slots and repeated species', () => {
  const { encounters } = load('src/data/encounters.ts');
  const preview = selection.getBattlePreview(36);
  assert.equal(preview.encounter, encounters.find(e => e.id === 36));
  assert.deepEqual(preview.encounter.digimons.map(e => e.name), ['Penguinmon', 'Penguinmon']);
  assert.deepEqual(preview.encounter.digimons.map(e => e.slot), [1, 2]);
  assert.ok(preview.encounter.digimons.every(e => e.level === 3));
  assert.equal(selection.getBattlePreview(-1), undefined);
});
test('every real floor option resolves canonical stats and authoritative rewards', () => {
  const { DOMAIN_GROUPS } = load('src/data/domainGroups.ts');
  const { getResolvedReward } = load('src/utils/rewardMatching.ts');
  for (const group of DOMAIN_GROUPS) {
    for (const floor of group.floors) {
      const option = selection.getEncountersForFloor(group.domainId, group.phase, floor).find(e => e.encounterId === group.encounterId);
      assert.ok(option);
      assert.ok(option.preview);
      assert.ok(option.preview.reward);
      assert.equal(option.preview.reward, getResolvedReward(group.encounterId));
      assert.ok(option.groupIds.includes(group.groupId));
    }
  }
});
test('known zero reward is distinct from unknown reward', () => {
  const { REWARDS_BY_ENCOUNTER_ID } = load('src/utils/rewardMatching.ts');
  const zeroId = [...REWARDS_BY_ENCOUNTER_ID].find(([,r]) => r.xp === 0 && r.bits === 0)[0];
  const reward = selection.getBattlePreview(zeroId).reward;
  assert.equal(reward.xp, 0);
  assert.equal(reward.bits, 0);
  assert.equal(selection.getBattlePreview(200).reward, undefined);
});
const selectedBattle = () => ({phase:before,domainId:'scsi-domain',floor:1,encounterId:32});
test('phase changes reset downstream selection and retain only compatible Domains', () => {
  assert.deepEqual(selection.battleSelectionReducer(freeze(selectedBattle()), {type:'phase',phase:after}),
    {phase:after,domainId:'scsi-domain',floor:null,encounterId:null});
  assert.deepEqual(selection.battleSelectionReducer({phase:before,domainId:'boot-domain',floor:1,encounterId:154}, {type:'phase',phase:after}),
    {phase:after,domainId:'',floor:null,encounterId:null});
});
test('Domain and floor changes reset dependent selections', () => {
  const changed = selection.battleSelectionReducer(freeze(selectedBattle()), {type:'domain',domainId:'video-domain'});
  assert.deepEqual(changed, {phase:before,domainId:'video-domain',floor:null,encounterId:null});
  assert.deepEqual(selection.battleSelectionReducer(selectedBattle(), {type:'floor',floor:2}),
    {phase:before,domainId:'scsi-domain',floor:2,encounterId:null});
});
test('invalid Domain, floor and encounter choices cannot leave a stale preview', () => {
  assert.equal(selection.battleSelectionReducer(selectedBattle(), {type:'domain',domainId:'missing'}).domainId, '');
  assert.equal(selection.battleSelectionReducer(selectedBattle(), {type:'floor',floor:999}).floor, null);
  assert.equal(selection.battleSelectionReducer(selectedBattle(), {type:'encounter',encounterId:99}).encounterId, null);
  assert.equal(selection.battleSelectionReducer(selectedBattle(), {type:'encounter',encounterId:31}).encounterId, 31);
});
test('selection and preview leave the entire saved RunPlan and progression untouched', () => {
  const run = freeze(fullRun());
  storage.saveRunPlannerData(envelope(run));
  const original = JSON.stringify(run);
  const saved = values.get(storage.RUN_PLANNER_STORAGE_KEY);
  global.localStorage.setItem = () => {throw Error('Selection must not write storage');};
  let state = selection.initialBattleSelection;
  for (const action of [{type:'domain',domainId:'scsi-domain'}, {type:'floor',floor:1}, {type:'encounter',encounterId:32}]) {
    state = selection.battleSelectionReducer(state, action);
  }
  selection.getBattlePreview(state.encounterId);
  assert.equal(JSON.stringify(run), original);
  assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY), saved);
  assert.deepEqual(storage.loadRunPlannerData().runs[0], run);
});

const recording = load('src/utils/runBattleRecording.ts');
const xpHelpers = load('src/utils/experience.ts');
const growthHelpers = load('src/utils/statGrowth.ts');
const normalBattle = () => ({phase:before,domainId:'scsi-domain',floor:1,encounterId:32,capturedEnemySlot:null});
test('recording rejects empty, duplicate and unknown participants without changing the run', () => {
  const run = multiRun();
  for (const digiline of [[], [run.starterInstanceId,run.starterInstanceId], ['missing']]) {
    const invalid = freeze({...run,digiline});
    assert.throws(() => recording.recordRunBattle(invalid,normalBattle()));
    assert.equal(invalid.history.length,0);
    assert.equal(invalid.totalBits,1030);
  }
});
for (const count of [1,2,3]) test(`full encounter XP reaches each of ${count} participants, never reserves`, () => {
  let run = multiRun();
  for (const id of ['reserve-a','reserve-b'].slice(0,count-1)) run = addToDigiline(run,id);
  freeze(run);
  const reward = selection.getBattlePreview(32).reward;
  const {run:next,resolution,event} = recording.recordRunBattle(run,normalBattle());
  assert.equal(resolution.outcomes.length,count);
  for (const member of run.roster) {
    const updated = next.roster.find(r => r.instanceId === member.instanceId);
    assert.equal(updated.totalXp,member.totalXp+(run.digiline.includes(member.instanceId)?reward.xp:0));
    if (!run.digiline.includes(member.instanceId)) assert.deepEqual(updated,member);
  }
  assert.equal(next.totalBits,run.totalBits+reward.bits);
  assert.equal(next.history.length,1);
  assert.equal(event.xpReward,reward.xp);
  assert.equal(event.bitsReward,reward.bits);
  assert.deepEqual(event.digilineInstanceIds,run.digiline);
  assert.deepEqual(run.history,[]);
});
test('recording reuses one-level XP and exact deterministic expected growth', () => {
  const run = multiRun();
  run.roster[0] = {...run.roster[0],totalXp:100000};
  const expected = growthHelpers.applyExpectedLevelUpGrowth(run.roster[0].speciesId,1,run.roster[0].stats).stats;
  const first = recording.recordRunBattle(freeze(run),normalBattle());
  const again = recording.recordRunBattle(run,normalBattle());
  assert.equal(first.run.roster[0].level,2);
  assert.equal(first.run.roster[0].totalXp,100000+first.event.xpReward);
  assert.equal(first.resolution.outcomes[0].xpToNextLevel,0);
  assert.deepEqual(first.run.roster[0].stats,expected);
  assert.deepEqual(again.run.roster,first.run.roster);
  assert.ok(Object.values(expected).some(value => !Number.isInteger(value)));
});
test('no level-up leaves stats unchanged while recording XP and Bits', () => {
  const run = multiRun();
  run.roster[0] = {...run.roster[0],level:30,levelCap:{min:50,max:50,resolved:50},totalXp:xpHelpers.getRequiredTotalXpForLevel(30)};
  const next = recording.recordRunBattle(freeze(run),normalBattle());
  assert.equal(next.run.roster[0].level,30);
  assert.deepEqual(next.run.roster[0].stats,run.roster[0].stats);
});
test('history is append-only with stable IDs, location and ordered participant snapshots', () => {
  let run = fullRun();
  run = moveDigilineMember(run,'reserve-b','up');
  const first = recording.recordRunBattle(run,normalBattle());
  const snapshot = structuredClone(first.event);
  const changed = removeFromDigiline(first.run,'reserve-b');
  const second = recording.recordRunBattle(changed,normalBattle());
  assert.deepEqual(second.run.history[0],snapshot);
  assert.notEqual(second.event.id,first.event.id);
  assert.deepEqual(second.run.history.map(e => e.order),[0,1]);
  assert.equal(second.event.phase,before);
  assert.equal(second.event.floor,1);
  assert.deepEqual(snapshot.digilineInstanceIds,[run.starterInstanceId,'reserve-b','reserve-a']);
  assert.equal(second.run.totalBits,1030+first.event.bitsReward*2);
});
test('capture uses exact slot data and cumulative XP, stays reserve and receives no battle XP', () => {
  const run = multiRun();
  const {run:next,resolution,event} = recording.recordRunBattle(freeze(run),{...normalBattle(),capturedEnemySlot:1});
  const enemy = selection.getBattlePreview(32).encounter.digimons[0];
  const captured = next.roster.find(r => r.instanceId === resolution.capturedInstanceId);
  assert.equal(next.roster.length,run.roster.length+1);
  assert.equal(captured.level,enemy.level);
  assert.equal(captured.totalXp,xpHelpers.getRequiredTotalXpForLevel(enemy.level));
  assert.deepEqual(captured.stats,Object.fromEntries(['hp','mp','atk','def','spd'].map(stat => [stat,enemy[stat]])));
  assert.deepEqual(captured.techs,enemy.techs);
  assert.deepEqual(captured.source,{type:'capture',encounterId:32,enemySlot:1});
  assert.deepEqual(next.digiline,run.digiline);
  assert.equal(event.capturedEnemySlot,1);
  assert.ok(!event.digilineInstanceIds.includes(captured.instanceId));
  assert.ok(addToDigiline(next,captured.instanceId).digiline.includes(captured.instanceId));
});
test('repeated captures of the same species create distinct instances', () => {
  const first = recording.recordRunBattle(multiRun(),{...normalBattle(),capturedEnemySlot:1});
  const second = recording.recordRunBattle(first.run,{...normalBattle(),capturedEnemySlot:1});
  assert.notEqual(first.resolution.capturedInstanceId,second.resolution.capturedInstanceId);
  assert.equal(new Set(second.run.roster.map(r => r.instanceId)).size,second.run.roster.length);
  assert.equal(second.run.roster.length,6);
});
test('capture choices preserve slots and boss capture is rejected in state logic', () => {
  const normal = {...normalBattle(),phase:after,floor:2,encounterId:36};
  assert.deepEqual(recording.getCaptureChoices(normal).map(e => [e.slot,e.name]),[[1,'Penguinmon'],[2,'Penguinmon']]);
  const boss = {...normalBattle(),floor:4,encounterId:91};
  assert.deepEqual(recording.getCaptureChoices(boss),[]);
  assert.throws(() => recording.recordRunBattle(multiRun(),{...boss,capturedEnemySlot:1}),/Boss/);
  assert.throws(() => recording.recordRunBattle(multiRun(),{...normalBattle(),capturedEnemySlot:99}),/valid enemy slot/);
  assert.equal(recording.recordRunBattle(multiRun(),boss).run.history.length,1);
});
test('known zero rewards record, missing metadata and incompatible location reject', () => {
  const {REWARDS_BY_ENCOUNTER_ID:rewards} = load('src/utils/rewardMatching.ts');
  const saved = rewards.get(32);
  try {
    // No current Domain group references a 0/0 encounter. Exercise this future-safe
    // branch with an in-memory reward fixture; never add fabricated Domain mappings.
    const zero = [...rewards.values()].find(reward => reward.xp === 0 && reward.bits === 0);
    rewards.set(32,zero);
    const result = recording.recordRunBattle(multiRun(),normalBattle());
    assert.equal(result.run.history.length,1);
    assert.equal(result.run.totalBits,1030);
    assert.equal(result.event.xpReward,0);
    rewards.delete(32);
    assert.throws(() => recording.recordRunBattle(multiRun(),normalBattle()),/Reward metadata/);
  } finally { rewards.set(32,saved); }
  assert.throws(() => recording.recordRunBattle(multiRun(),{...normalBattle(),floor:999}),/valid Domain/);
});
test('recorded progression, fractional stats, capture and history survive storage without replay', () => {
  const first = recording.recordRunBattle(multiRun(),{...normalBattle(),capturedEnemySlot:1});
  const recorded = recording.recordRunBattle(first.run,normalBattle());
  assert.ok(Object.values(recorded.run.roster[0].stats).some(value => !Number.isInteger(value)));
  assert.equal(storage.saveRunPlannerData(envelope(recorded.run)),true);
  assert.deepEqual(storage.loadRunPlannerData().runs[0],recorded.run);
  assert.deepEqual(storage.loadRunPlannerData().runs[0],recorded.run);
  const next = recording.recordRunBattle(storage.loadRunPlannerData().runs[0],normalBattle());
  assert.equal(next.run.history.length,3);
});
test('schema v3 requires battle location and rejects invalid location fields', () => {
  const recorded = recording.recordRunBattle(multiRun(),normalBattle()).run;
  const legacy = structuredClone(recorded);
  delete legacy.history[0].phase;
  delete legacy.history[0].floor;
  assert.equal(storage.saveRunPlannerData(envelope(legacy)),false);
  assert.deepEqual(storage.loadRunPlannerData(),storage.emptyRunPlannerData());
  for (const extension of [{phase:'unknown'},{floor:0},{floor:1.5}]) {
    const invalid = {...recorded,history:[{...recorded.history[0],...extension}]};
    assert.equal(storage.saveRunPlannerData(envelope(invalid)),false);
  }
});

// Minimal hook host to exercise the real save-before-publish action and current-run ref.
function plannerHost() {
  const slots = []; let cursor = 0;
  const react = {
    useState(initial) { const i=cursor++; if (!(i in slots)) slots[i]=typeof initial==='function'?initial():initial;
      return [slots[i],value => {slots[i]=typeof value==='function'?value(slots[i]):value;}]; },
    useRef(initial) { const i=cursor++; if (!(i in slots)) slots[i]={current:initial}; return slots[i]; },
  };
  const source = fs.readFileSync(path.join(root,'src/hooks/useRunPlanner.ts'),'utf8');
  const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports',js)(id => id==='react'?react:load('src/'+id.slice(2)+'.ts'),mod,mod.exports);
  return () => {cursor=0; return mod.exports.useRunPlanner();};
}
test('failed recording save preserves current and persisted run; retry applies once', () => {
  const run = multiRun(); storage.saveRunPlannerData(envelope(run));
  const render = plannerHost(); const planner = render();
  const original = values.get(storage.RUN_PLANNER_STORAGE_KEY);
  const setItem = global.localStorage.setItem;
  global.localStorage.setItem = () => {throw Error('quota');};
  assert.equal(planner.recordBattle({...normalBattle(),capturedEnemySlot:1}),null);
  assert.deepEqual(render().activeRun,run);
  assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY),original);
  assert.match(render().error,/Could not save/);
  global.localStorage.setItem=setItem;
  assert.ok(render().recordBattle({...normalBattle(),capturedEnemySlot:1}));
  assert.equal(render().activeRun.history.length,1);
  assert.equal(render().activeRun.roster.length,run.roster.length+1);
  assert.equal(render().error,null);
});
test('record action snapshots latest committed Digiline and consecutive calls do not overwrite history', () => {
  storage.saveRunPlannerData(envelope(multiRun()));
  const render=plannerHost(); const planner=render();
  planner.addMember('reserve-a');
  planner.recordBattle(normalBattle());
  planner.recordBattle(normalBattle());
  const run=render().activeRun;
  assert.equal(run.history.length,2);
  assert.deepEqual(run.history[0].digilineInstanceIds,[run.starterInstanceId,'reserve-a']);
  assert.deepEqual(run.history[1].digilineInstanceIds,run.history[0].digilineInstanceIds);
  assert.equal(run.totalBits,1030+run.history[0].bitsReward*2);
});

const undo = load('src/utils/runActionUndo.ts');
const meaningfulRun = ({updatedAt, ...run}) => run;
const restoredRun = (run) => {
  const result = undo.undoLastAction(run);
  assert.equal(result.ok,true,result.reason);
  return result.run;
};
test('new event preActionCheckpoint is the complete pre-battle state with no recursive history', () => {
  const run = freeze(fullRun());
  const recorded = recording.recordRunBattle(run,{...normalBattle(),capturedEnemySlot:1});
  assert.deepEqual(recorded.event.preActionCheckpoint,{roster:run.roster,digiline:run.digiline,totalBits:run.totalBits});
  assert.deepEqual(Object.keys(recorded.event.preActionCheckpoint).sort(),['digiline','roster','totalBits']);
  assert.notEqual(recorded.event.preActionCheckpoint.roster,run.roster);
  assert.notEqual(recorded.event.preActionCheckpoint.digiline,run.digiline);
  for (let i=0;i<run.roster.length;i++) {
    assert.notEqual(recorded.event.preActionCheckpoint.roster[i],run.roster[i]);
    for (const field of ['stats','techs','source']) {
      assert.notEqual(recorded.event.preActionCheckpoint.roster[i][field],run.roster[i][field]);
      assert.notEqual(recorded.event.preActionCheckpoint.roster[i][field],recorded.run.roster[i][field]);
    }
  }
});
test('normal battle undo restores all meaningful run state and does not mutate input', () => {
  const before = multiRun();
  const recorded = freeze(recording.recordRunBattle(before,normalBattle()).run);
  const snapshot = JSON.stringify(recorded);
  const restored = restoredRun(recorded);
  assert.deepEqual(meaningfulRun(restored),meaningfulRun(before));
  assert.equal(JSON.stringify(recorded),snapshot);
  assert.ok(Number.isFinite(Date.parse(restored.updatedAt)));
  restored.roster[0].stats.hp=999;
  assert.equal(recorded.history[0].preActionCheckpoint.roster[0].stats.hp,before.roster[0].stats.hp);
});
test('level-up undo restores exact fractional stats, level, XP and Bits', () => {
  const before = recording.recordRunBattle(recording.recordRunBattle(multiRun(),normalBattle()).run,normalBattle()).run;
  before.roster[0].totalXp=100000;
  before.totalBits=123.5;
  assert.ok(Object.values(before.roster[0].stats).some(v => !Number.isInteger(v)));
  const recorded=recording.recordRunBattle(freeze(before),normalBattle()).run;
  assert.equal(recorded.roster[0].level,before.roster[0].level+1);
  assert.deepEqual(meaningfulRun(restoredRun(recorded)),meaningfulRun(before));
});
test('undo removes a capture promoted into Digiline and discards later membership and order changes', () => {
  let before=multiRun();
  before=addToDigiline(before,'reserve-a');
  before=moveDigilineMember(before,'reserve-a','up');
  const recorded=recording.recordRunBattle(before,{...normalBattle(),capturedEnemySlot:1});
  const capturedId=recorded.resolution.capturedInstanceId;
  let changed=addToDigiline(recorded.run,capturedId);
  changed=moveDigilineMember(changed,capturedId,'up');
  changed=removeFromDigiline(changed,before.starterInstanceId);
  const restored=restoredRun(freeze(changed));
  assert.deepEqual(meaningfulRun(restored),meaningfulRun(before));
  assert.ok(!restored.roster.some(r => r.instanceId===capturedId));
  assert.ok(!restored.digiline.includes(capturedId));
  assert.deepEqual(restored.roster.map(r => r.instanceId),before.roster.map(r => r.instanceId));
});
test('repeated undo restores successive exact checkpoints and preserves earlier events', () => {
  const states=[multiRun()];
  for(let i=0;i<3;i++) states.push(recording.recordRunBattle(states[i],{...normalBattle(),capturedEnemySlot:1}).run);
  let current=freeze(states[3]);
  for(let i=2;i>=0;i--) {
    const previousHistory=current.history.slice(0,-1);
    current=restoredRun(current);
    assert.deepEqual(current.history,previousHistory);
    assert.deepEqual(meaningfulRun(current),meaningfulRun(states[i]));
  }
  assert.equal(undo.undoLastAction(current).ok,false);
});
test('schema v3 rejects events missing mandatory checkpoints without overwriting development saves', () => {
  const legacy=recording.recordRunBattle(multiRun(),normalBattle()).run;
  delete legacy.history[0].preActionCheckpoint;
  const raw=JSON.stringify(envelope(legacy));values.set(storage.RUN_PLANNER_STORAGE_KEY,raw);
  assert.equal(storage.saveRunPlannerData(envelope(legacy)),false);
  assert.deepEqual(storage.loadRunPlannerData(),storage.emptyRunPlannerData());
  assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY),raw);
  assert.match(undo.undoLastAction(legacy).reason,/Invalid checkpoint/);
});

test('empty history reports Undo unavailable', () => {
  assert.deepEqual(undo.undoLastAction(multiRun()),{ok:false,reason:'No actions recorded yet.'});
});
test('malformed preActionCheckpoint structures and references are rejected without altering input', () => {
  const run=recording.recordRunBattle(multiRun(),normalBattle()).run;
  const valid=run.history[0].preActionCheckpoint;
  const bad=[null,{}, {...valid,roster:null}, {...valid,totalBits:-1}, {...valid,totalBits:Infinity},
    {...valid,digiline:['missing']}, {...valid,digiline:[valid.digiline[0],valid.digiline[0]]},
    {...valid,digiline:valid.roster.map(r => r.instanceId)},
    {...valid,roster:[valid.roster[0],valid.roster[0]]}, {...valid,history:[]}, {...valid,preActionCheckpoint:valid}];
  for (const change of [{stats:{hp:1}}, {techs:[1]}, {level:0}, {totalXp:NaN}, {source:null}, {instanceId:''}, {speciesId:''}, {name:null}]) {
    bad.push({...valid,roster:[{...valid.roster[0],...change},...valid.roster.slice(1)]});
  }
  for(const preActionCheckpoint of bad) {
    const invalid=freeze({...run,history:[{...run.history[0],preActionCheckpoint}]});
    assert.equal(load('src/utils/runActionCheckpoint.ts').isValidRunActionCheckpoint(preActionCheckpoint),false);
    assert.equal(storage.saveRunPlannerData(envelope(invalid)),false);
    const result=undo.undoLastAction(invalid);
    assert.equal(result.ok,false);
    assert.match(result.reason,/Invalid checkpoint/);
    assert.equal(invalid.history.length,1);
  }
});
test('preActionCheckpoint missing a starter required by the run cannot be applied', () => {
  const run=recording.recordRunBattle(multiRun(),normalBattle()).run;
  run.history[0].preActionCheckpoint={roster:[],digiline:[],totalBits:0};
  assert.equal(undo.undoLastAction(run).ok,false);
});
test('record reload then undo restores exact saved pre-battle state', () => {
  const before=recording.recordRunBattle(multiRun(),normalBattle()).run;
  const recorded=recording.recordRunBattle(before,{...normalBattle(),capturedEnemySlot:1}).run;
  assert.equal(storage.saveRunPlannerData(envelope(recorded)),true);
  const loaded=storage.loadRunPlannerData().runs[0];
  assert.deepEqual(loaded,recorded);
  const restored=restoredRun(loaded);
  assert.deepEqual(meaningfulRun(restored),meaningfulRun(before));
  assert.equal(storage.saveRunPlannerData(envelope(restored)),true);
  assert.deepEqual(storage.loadRunPlannerData().runs[0],restored);
});
test('recording after undo replaces the final order with a fresh event ID', () => {
  let run=multiRun();
  for(let i=0;i<3;i++) run=recording.recordRunBattle(run,normalBattle()).run;
  const oldId=run.history[2].id;
  const next=recording.recordRunBattle(restoredRun(run),{...normalBattle(),encounterId:31}).run;
  assert.deepEqual(next.history.map(b => b.order),[0,1,2]);
  assert.notEqual(next.history[2].id,oldId);
  assert.equal(new Set(next.history.map(b => b.id)).size,3);
  assert.deepEqual(next.history.slice(0,2),run.history.slice(0,2));
});
test('zero-reward fixture can be recorded and undone exactly', () => {
  const {REWARDS_BY_ENCOUNTER_ID:rewards}=load('src/utils/rewardMatching.ts');
  const saved=rewards.get(32);
  try {
    rewards.set(32,{...saved,xp:0,bits:0});
    const before=multiRun();
    assert.deepEqual(meaningfulRun(restoredRun(recording.recordRunBattle(before,normalBattle()).run)),meaningfulRun(before));
  } finally {rewards.set(32,saved);}
});
test('failed Undo save leaves current run, history and feedback revision unchanged', () => {
  const before=multiRun();
  const recorded=recording.recordRunBattle(before,{...normalBattle(),capturedEnemySlot:1}).run;
  storage.saveRunPlannerData(envelope(recorded));
  const render=plannerHost(); const planner=render();
  const raw=values.get(storage.RUN_PLANNER_STORAGE_KEY);
  const save=global.localStorage.setItem;
  global.localStorage.setItem=()=>{throw Error('quota');};
  assert.equal(planner.undoAction(recorded.history[0].id,recorded.id),false);
  assert.deepEqual(render().activeRun,recorded);
  assert.equal(render().feedbackRevision,0);
  assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY),raw);
  assert.match(render().error,/Could not save/);
  global.localStorage.setItem=save;
  assert.equal(render().undoAction(recorded.history[0].id,recorded.id),true);
  assert.deepEqual(meaningfulRun(render().activeRun),meaningfulRun(before));
  assert.equal(render().feedbackRevision,1);
  assert.equal(render().error,null);
});
test('stale confirmation cannot undo a different battle or another saved run', () => {
  const first=recording.recordRunBattle(multiRun(),normalBattle()).run;
  const other=createRunPlan('blue-falcon','Other');
  storage.saveRunPlannerData({schemaVersion: 3,runs:[first,other],activeRunId:first.id});
  const render=plannerHost(); const planner=render();
  planner.recordBattle(normalBattle());
  assert.equal(planner.undoAction(first.history[0].id,first.id),false);
  const latest=render().activeRun;
  assert.equal(planner.undoAction(latest.history[1].id,latest.id),true);
  assert.deepEqual(render().data.runs[1],other);
  render().loadRun(other.id);
  assert.equal(planner.undoAction(first.history[0].id,first.id),false);
});

// Phase 2F-A: synthetic progression instances deliberately carry explicit cap metadata.
const caps = load('src/utils/levelCap.ts');
const evolution = load('src/utils/normalDigivolution.ts');
const progressionData = load('src/data/speciesProgression.ts');
const progressionAudit = load('src/utils/progressionValidation.ts');
const captureFoundation = load('src/utils/capture.ts');
const battleFoundation = load('src/utils/runProgression.ts');
const speciesLookup = load('src/utils/digimonLookup.ts');
const techLookup = load('src/utils/techLookup.ts');
const foundationMember = (name, level, extra={}) => {
  const species=speciesLookup.getDigimonByName(name);
  return {...createRunPlan('gold-hawk','Fixture').roster[0],speciesId:species.id,name:species.name,
    level,totalXp:1000000,levelCap:{min:53,max:53,resolved:53},...extra};
};
test('Phase 2F authoritative data audit preserves all counts and known diagnostics', () => {
  const r=progressionAudit.getProgressionValidationReport();
  assert.equal(r.capRulesTotal,49); assert.equal(r.fixedCapRules,27); assert.equal(r.randomCapRules,22);
  assert.equal(r.progressionSourceTotal,195); assert.equal(r.canonicalSpeciesTotal,195);
  assert.equal(new Set(progressionData.SPECIES_PROGRESSION.map(r=>r.speciesId)).size,195);
  assert.deepEqual(r.unresolvedProgressionSpecies,[]); assert.equal(r.rankMatches,195); assert.equal(r.typeMatches,195);
  assert.equal(r.metalKidDigimonCount,194); assert.equal(r.metalKidEvolutionRowCount,216);
  assert.deepEqual(r.unresolvedEndpoints,[]); assert.equal(r.workbookDp0AssertionsChecked,137);
  assert.deepEqual(r.dp0AssertionMismatches,[]); assert.equal(r.workbookNullMetalKidPresent.length,5);
  assert.equal(r.noOwnTechnique,13); assert.equal(r.unresolvedPlannerTechniqueLabels.length,45);
  assert.deepEqual(r.evolutionRangeAmbiguities,[]);
  assert.deepEqual(r.plannerXpSupportedRange,{min:1,max:50});
});
for (const [el,min,max] of [[1,13,13],[2,13,13],[5,14,14],[6,17,17],[10,19,19],[17,22,22],[18,26,26],[21,27,27],[27,30,30],[28,30,32],[29,31,33],[30,32,34],[35,37,39],[40,42,44],[45,47,49],[49,51,53]]) {
  test(`acquisition EL${el} has authoritative cap ${min}-${max}`,()=>assert.deepEqual(caps.getInitialLevelCap(el),{min,max,resolved:min===max?min:null}));
}
test('cap rules never extrapolate and cap resolution is pure and explicit',()=>{
  for(const el of [0,-1,1.5,50,99,NaN]) assert.equal(caps.getInitialLevelCap(el),null);
  const c=freeze(caps.getInitialLevelCap(28));
  const random=Math.random; Math.random=()=>{throw Error('Unexpected RNG');};
  try { for(const n of [30,31,32]) assert.deepEqual(caps.resolveLevelCap(c,n),{min:30,max:32,resolved:n}); }
  finally {Math.random=random;}
  assert.equal(c.resolved,null); assert.equal(caps.getResolvedMaxLevel(c),null);
  for(const n of [29,33,30.5,NaN]) assert.throws(()=>caps.resolveLevelCap(c,n));
  assert.equal(caps.isValidLevelCap({min:13,max:13,resolved:null}),false);
  assert.equal(caps.isValidLevelCap({min:32,max:30,resolved:31}),false);
});
test('starter and exact capture slots initialize DP0 and acquisition caps',()=>{
  for(const s of STARTERS){const m=createRunPlan(s.id,'Run').roster[0];assert.equal(m.dp,0);assert.deepEqual(m.levelCap,{min:13,max:13,resolved:13});}
  const es=load('src/data/encounters.ts').encounters;
  for(const level of [3,35]){
    const enc=es.find(e=>e.digimons.some(d=>d.level===level));assert.ok(enc);
    const enemy=enc.digimons.find(d=>d.level===level);const result=captureFoundation.tryCreateCapturedDigimon(enc.id,enemy.slot,level===35?38:undefined);
    assert.equal(result.ok,true);assert.equal(result.digimon.dp,0);assert.deepEqual(result.digimon.levelCap,level===35?{min:37,max:39,resolved:38}:caps.getInitialLevelCap(level));
  }
  // No EL28 encounter exists in the static dataset; exercise capture with an isolated synthetic slot.
  const fixture={id:999928,digimons:[{...es[0].digimons[0],slot:1,level:28}]};
  es.push(fixture);
  try { const result=captureFoundation.tryCreateCapturedDigimon(fixture.id,1,31);
    assert.equal(result.ok,true);assert.equal(result.digimon.dp,0);
    assert.deepEqual(result.digimon.levelCap,{min:30,max:32,resolved:31});
  } finally { es.splice(es.indexOf(fixture),1); }
});
test('resolved cap blocks later XP and preserves excess XP from reaching cap',()=>{
  const c=caps.getInitialLevelCap(1);const first=xpHelpers.applyBattleXp(12,1000000,999,c);
  assert.equal(first.newLevel,13);assert.equal(first.newTotalXp,1000999);assert.equal(first.actualXpApplied,999);
  const second=xpHelpers.applyBattleXp(13,first.newTotalXp,999,c);
  assert.equal(second.capped,true);assert.equal(second.newTotalXp,first.newTotalXp);assert.equal(second.actualXpApplied,0);assert.equal(second.leveledUp,false);
});
test('unresolved cap progresses below minimum, blocks at minimum and resumes after explicit resolution',()=>{
  const c=caps.getInitialLevelCap(28);const first=xpHelpers.applyBattleXp(29,1000000,100,c);
  assert.equal(first.newLevel,30);assert.equal(first.capResolutionRequired,false);
  const blocked=xpHelpers.applyBattleXp(30,first.newTotalXp,100,c);
  assert.equal(blocked.capResolutionRequired,true);assert.equal(blocked.capped,false);assert.equal(blocked.newTotalXp,first.newTotalXp);
  assert.equal(xpHelpers.applyBattleXp(30,first.newTotalXp,100,caps.resolveLevelCap(c,32)).newLevel,31);
});
test('EL50 scope is separate from individual cap and tables stop at 50',()=>{
  assert.equal(caps.getInitialLevelCap(49).max,53);
  assert.equal(xpHelpers.getRequiredTotalXpForLevel(51),null);
  assert.equal(load('src/data/statGrowthTables.ts').PLANNER_SCOPE_MAX_EL,50);
  const x=xpHelpers.applyBattleXp(50,1000000,500,{min:51,max:53,resolved:null});
  assert.equal(x.plannerScopeUnsupported,true);assert.equal(x.capped,false);assert.equal(x.capResolutionRequired,false);
  assert.equal(x.newLevel,50);assert.equal(x.newTotalXp,1000000);
});
for(const [dp,name] of [[0,'D-Tyrannomon'],[1,'D-Tyrannomon'],[2,'D-Tyrannomon'],[3,'Darkrizamon'],[4,'Darkrizamon'],[5,'Darkrizamon'],[6,'Tuskmon'],[999,'Tuskmon']]){
 test(`generic Betamon DP${dp} range selects ${name}`,()=>assert.deepEqual(evolution.lookupNormalEvolution('betamon',dp),{status:'unique',targetSpeciesId:speciesLookup.getDigimonByName(name).id}));
}
test('Piddomon DP6 uses corrected Giromon route; adjacent DP and invalid/unavailable cases are explicit',()=>{
 for(const dp of [0,1,5])assert.deepEqual(evolution.lookupNormalEvolution('piddomon',dp),{status:'unique',targetSpeciesId:'magnaangemon'});
 for(const dp of [6,7,999])assert.deepEqual(evolution.lookupNormalEvolution('piddomon',dp),{status:'unique',targetSpeciesId:'giromon'});
 for(const dp of [5,7])assert.equal(evolution.lookupNormalEvolution('piddomon',dp).status,'unique');
 for(const dp of [-1,1.2,NaN])assert.equal(evolution.lookupNormalEvolution('betamon',dp).status,'invalid');
 assert.equal(evolution.lookupNormalEvolution('unknown',0).status,'invalid');
 assert.equal(evolution.lookupNormalEvolution(speciesLookup.getDigimonByName('No Rookie Form').id,0).status,'unavailable');
 assert.equal(evolution.previewNormalDigivolution(foundationMember('Piddomon',21,{dp:6})).canDigivolve,true);
});
for(const [name,minimum] of [['Agumon',11],['Greymon',21],['MetalGreymon',31]]){
 test(`${name} normal evolution threshold EL${minimum}`,()=>{
  assert.equal(evolution.previewNormalDigivolution(foundationMember(name,minimum-1)).canDigivolve,false);
  assert.equal(evolution.previewNormalDigivolution(foundationMember(name,minimum)).canDigivolve,true);
 });
}
test('normal Digivolution preserves identity and progression, adds fractional HP/MP and no techniques',()=>{
 const m=freeze(foundationMember('Agumon',11,{dp:0,stats:{hp:34.5,mp:37.5,atk:10.5,def:12.5,spd:11.5},techs:['Pepper Breath']}));
 const next=evolution.applyNormalDigivolution(m);assert.equal(next.speciesId,'greymon');assert.equal(next.name,'Greymon');
 for(const k of ['instanceId','level','totalXp','dp','source','levelCap','techs'])assert.deepEqual(next[k],m[k]);
 assert.deepEqual(next.stats,{hp:64.5,mp:67.5,atk:10.5,def:12.5,spd:11.5});
 assert.equal(evolution.previewNormalDigivolution(foundationMember('WarGreymon',32)).canDigivolve,false);
 assert.throws(()=>evolution.applyNormalDigivolution(foundationMember('Agumon',10)));
});
for(const [name,level] of [['Greymon',11],['MetalGreymon',21],['WarGreymon',31],['Piddomon',11]]){
 test(`${name} learns exact own technique only on ${level} -> ${level+1}`,()=>{
 const m=foundationMember(name,level,{techs:[]});const tech=progressionData.getSpeciesProgression(m.speciesId).ownTechnique;
 const r=battleFoundation.resolveBattle({encounterId:32,roster:[freeze(m)],digilineInstanceIds:[m.instanceId],totalBits:0});
 assert.deepEqual(r.outcomes[0].learnedTechniques,[tech]);assert.deepEqual(r.roster[0].techs,[tech]);
 assert.deepEqual(evolution.getLearnedTechniques({...m,techs:[tech]},level+1),[]);
 assert.deepEqual(evolution.getLearnedTechniques({...m,level:level+2},level+3),[]);
 });
}
test('all 45 unresolved labels remain learnable strings when rank has an unlock; no-tech markers never learn',()=>{
 for(const row of progressionData.SPECIES_PROGRESSION){
  const unlock={Champion:12,Ultimate:22,Mega:32}[row.rank];if(!unlock)continue;
  const member=foundationMember(speciesLookup.getDigimonById(row.speciesId).name,unlock-1,{techs:[]});
  assert.deepEqual(evolution.getLearnedTechniques(member,unlock),row.ownTechnique?[row.ownTechnique]:[]);
 }
 const p=foundationMember('Piddomon',11,{techs:[]});assert.equal(techLookup.getTechByName('Mega Heal'),undefined);
 assert.deepEqual(evolution.getLearnedTechniques(p,12),['Mega Heal']);
 const late=evolution.applyNormalDigivolution(foundationMember('Agumon',13,{techs:[]}));assert.deepEqual(late.techs,[]);
 assert.deepEqual(evolution.getLearnedTechniques(late,14),[]);
});
test('mixed capped, unresolved and eligible participants reject recording atomically',()=>{
 const run=multiRun();run.roster=run.roster.slice(0,3);run.digiline=run.roster.map(r=>r.instanceId);
 run.roster[0]={...run.roster[0],level:13,totalXp:1000000};
 run.roster[1]={...run.roster[1],level:30,totalXp:1000000,dp:7,levelCap:caps.getInitialLevelCap(28)};
 const previous=structuredClone(run);
 assert.throws(()=>recording.recordRunBattle(freeze(run),{...normalBattle(),capturedEnemySlot:1}),/Maximum EL is unresolved/);
 assert.deepEqual(run,previous);
});
test('schema v3 rejects old schema and invalid DP/caps in live and preActionCheckpoint rosters',()=>{
 const r=recording.recordRunBattle(multiRun(),normalBattle()).run;
 const raw=JSON.stringify({...envelope(r),schemaVersion:1});values.set(storage.RUN_PLANNER_STORAGE_KEY,raw);
 assert.deepEqual(storage.loadRunPlannerData(),storage.emptyRunPlannerData());assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY),raw);
 for(const bad of [{dp:-1},{dp:0.5},{levelCap:{min:13,max:13,resolved:null}},{levelCap:{min:30,max:32,resolved:33}},{levelCap:undefined},{dp:undefined}]){
  for(const preActionCheckpoint of [false,true]){const copy=structuredClone(r);Object.assign(preActionCheckpoint?copy.history[0].preActionCheckpoint.roster[0]:copy.roster[0],bad);assert.equal(storage.isValidPersistedRunPlannerData(envelope(copy)),false);}
 }
});

// Display-only cap amendment: exercise both semantics and the actual RunPlanner markup.
const { getLevelCapDisplay } = load('src/utils/levelCapDisplay.ts');
const displayCases = [
  {label:'fixed below cap',level:12,cap:{min:13,max:13,resolved:13},text:'EL 12 / 13',status:null},
  {label:'fixed at cap',level:13,cap:{min:13,max:13,resolved:13},text:'EL 13 / 13',status:'MAX'},
  {label:'resolved random below cap',level:31,cap:{min:30,max:32,resolved:32},text:'EL 31 / 32',status:null},
  {label:'resolved random at cap',level:32,cap:{min:30,max:32,resolved:32},text:'EL 32 / 32',status:'MAX'},
  {label:'unresolved below minimum',level:28,cap:{min:30,max:32,resolved:null},text:'EL 28 · Max EL 30–32',status:'Cap unresolved'},
  {label:'unresolved at minimum',level:30,cap:{min:30,max:32,resolved:null},text:'EL 30 · Max EL 30–32',status:'Cap resolution required'},
];
for(const c of displayCases) test(`cap display: ${c.label}`,()=>{
  const member=freeze({level:c.level,levelCap:c.cap});const before=JSON.stringify(member);
  const d=getLevelCapDisplay(member);
  assert.equal(d.levelLabel,c.text);assert.equal(d.statusLabel,c.status);
  assert.equal(d.isMax,c.status==='MAX');assert.equal(d.isUnresolved,c.cap.resolved===null);
  assert.equal(d.requiresResolution,c.status==='Cap resolution required');
  assert.equal(d.knownMaxLevel,c.cap.resolved);assert.equal(JSON.stringify(member),before);
});
test('unresolved display never claims MAX even at upper range endpoint',()=>{
  for(const level of [28,30,31,32]){
    const d=getLevelCapDisplay({level,levelCap:{min:30,max:32,resolved:null}});
    assert.equal(d.isMax,false);assert.equal(d.knownMaxLevel,null);assert.notEqual(d.statusLabel,'MAX');
    assert.ok(!d.levelLabel.includes('/ 32'));
  }
});
for(const c of displayCases) test(`Roster and Current Digiline render persisted cap: ${c.label}`,()=>{
  const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
  const {RunPlanner}=load('src/components/run-planner/RunPlanner.tsx');
  const run=createRunPlan('black-sword','Display test');
  run.roster[0]={...run.roster[0],level:c.level,levelCap:{...c.cap},totalXp:1224};
  const html=renderToStaticMarkup(React.createElement(RunPlanner,{planner:{data:envelope(run),activeRun:run,error:null,starterId:'',name:'',feedbackRevision:0}}));
  const digiline=html.slice(html.indexOf('aria-label="Digiline slots"'),html.indexOf('aria-label="Roster"'));
  const roster=html.slice(html.indexOf('aria-label="Roster"'));
  for(const section of [digiline,roster]){
    assert.ok(section.includes(c.text),section);
    if(c.status)assert.ok(section.includes('>'+c.status+'<'));
    else assert.ok(!section.includes('>MAX<'));
    if(c.cap.resolved===null)assert.ok(!section.includes('>MAX<'));
  }
  assert.ok(roster.includes('Total XP 1224'));assert.ok(roster.includes('Active Digiline'));
  for(const stat of ['HP','MP','ATK','DEF','SPD'])assert.ok(roster.includes('>'+stat+'<'));
});

// Phase 2F-B: retain the original regression cases above under the clean v3 contract.
const { recordRunDigivolution } = load('src/utils/runDigivolutionRecording.ts');
const checkpointHelpers = load('src/utils/runActionCheckpoint.ts');
const evolutionRun = (name='Agumon', level=11, extra={}) => {
  const run=createRunPlan('gold-hawk','Evolution fixture');
  run.roster=[foundationMember(name,level,{instanceId:run.starterInstanceId,
    stats:{hp:34.5,mp:37.25,atk:10.5,def:12.25,spd:11.75},techs:['Pepper Breath'],...extra})];
  return run;
};
const renderPlanner = run => require('react-dom/server').renderToStaticMarkup(require('react').createElement(
  load('src/components/run-planner/RunPlanner.tsx').RunPlanner,
  {planner:{data:envelope(run),activeRun:run,error:null,starterId:'',name:'',feedbackRevision:0}}
));

test('schema v3 is explicit and rejects schema v2 without migration or writes',()=>{
  assert.equal(storage.RUN_PLANNER_SCHEMA_VERSION,3);
  assert.equal(storage.emptyRunPlannerData().schemaVersion,3);
  const old={...envelope(evolutionRun()),schemaVersion:2};
  const raw=JSON.stringify(old);values.set(storage.RUN_PLANNER_STORAGE_KEY,raw);
  assert.deepEqual(storage.loadRunPlannerData(),storage.emptyRunPlannerData());
  assert.equal(storage.saveRunPlannerData(old),false);
  assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY),raw);
});

test('v3 battle event retains all location, capture, reward and ordered participant fields',()=>{
  const run=fullRun();const request={...normalBattle(),capturedEnemySlot:1};
  const {event,resolution}=recording.recordRunBattle(run,request);
  assert.equal(event.type,'battle');assert.equal(event.order,0);
  for(const key of ['domainId','phase','floor','encounterId','capturedEnemySlot'])assert.equal(event[key],request[key]);
  assert.deepEqual(event.digilineInstanceIds,run.digiline);
  assert.equal(event.xpReward,resolution.xpAwarded);assert.equal(event.bitsReward,resolution.bitsAwarded);
  assert.deepEqual(event.preActionCheckpoint,checkpointHelpers.createRunActionCheckpoint(run));
});

test('Digivolution records one audited action and preserves every unrelated field exactly',()=>{
  const run=freeze(evolutionRun());const before=JSON.stringify(run);
  const {run:next,event}=recordRunDigivolution(run,run.starterInstanceId);
  const member=next.roster[0];
  assert.equal(JSON.stringify(run),before);assert.equal(next.history.length,1);
  assert.equal(member.speciesId,'greymon');assert.equal(member.name,'Greymon');
  assert.equal(progressionData.getSpeciesProgression(member.speciesId).rank,'Champion');
  for(const key of ['instanceId','level','totalXp','dp','levelCap','techs','source'])assert.deepEqual(member[key],run.roster[0][key]);
  assert.deepEqual(member.stats,{hp:64.5,mp:67.25,atk:10.5,def:12.25,spd:11.75});
  assert.deepEqual(next.digiline,run.digiline);assert.equal(next.totalBits,run.totalBits);
  assert.equal(next.starterInstanceId,run.starterInstanceId);
  assert.deepEqual(event,{type:'digivolve',id:event.id,order:0,instanceId:member.instanceId,
    fromSpeciesId:'agumon',toSpeciesId:'greymon',fromRank:'Rookie',toRank:'Champion',level:11,dp:0,
    levelCap:run.roster[0].levelCap,hpBonus:30,mpBonus:30,preActionCheckpoint:checkpointHelpers.createRunActionCheckpoint(run)});
  assert.equal(storage.saveRunPlannerData(envelope(next)),true);
  assert.deepEqual(storage.loadRunPlannerData().runs[0],next);
  assert.deepEqual(storage.loadRunPlannerData().runs[0],next);
});

test('Digivolution checkpoints and audit caps are deep copied without recursive history',()=>{
  const run=evolutionRun();const {event,run:next}=recordRunDigivolution(freeze(run),run.starterInstanceId);
  const cp=event.preActionCheckpoint;
  assert.deepEqual(Object.keys(cp).sort(),['digiline','roster','totalBits']);
  assert.notEqual(cp.roster,run.roster);assert.notEqual(cp.digiline,run.digiline);
  for(const key of ['source','stats','levelCap','techs']){
    assert.notEqual(cp.roster[0][key],run.roster[0][key]);assert.notEqual(cp.roster[0][key],next.roster[0][key]);
  }
  assert.notEqual(event.levelCap,cp.roster[0].levelCap);assert.notEqual(event.levelCap,next.roster[0].levelCap);
  event.levelCap.resolved=52;cp.roster[0].stats.hp=0;
  assert.equal(run.roster[0].stats.hp,34.5);assert.equal(next.roster[0].stats.hp,64.5);
  assert.equal(next.roster[0].levelCap.resolved,53);
});

test('Digivolution changes only the selected duplicate-species reserve instance',()=>{
  const run=evolutionRun();run.roster.push({...structuredClone(run.roster[0]),instanceId:'reserve'});
  const next=recordRunDigivolution(freeze(run),'reserve').run;
  assert.deepEqual(next.roster[0],run.roster[0]);assert.equal(next.roster[1].speciesId,'greymon');
  assert.deepEqual(next.digiline,run.digiline);assert.equal(next.history[0].instanceId,'reserve');
});

for(const [name,level,cap] of [
  ['Agumon',13,{min:13,max:13,resolved:13}],
  ['Greymon',30,{min:30,max:32,resolved:null}],
  ['MetalGreymon',31,{min:30,max:32,resolved:null}],
])test(`Digivolution permits ${name} EL${level} at MAX or an unresolved cap`,()=>{
  const run=evolutionRun(name,level,{levelCap:cap});
  const next=recordRunDigivolution(run,run.starterInstanceId).run;
  assert.notEqual(next.roster[0].speciesId,run.roster[0].speciesId);
  assert.deepEqual(next.roster[0].levelCap,cap);assert.equal(next.roster[0].level,level);
});

test('Digivolution rejects low EL, terminal ranks, invalid state and unknown instances without mutation',()=>{
  for(const run of [evolutionRun('Agumon',10),evolutionRun('WarGreymon',32),evolutionRun('Agumon',11,{dp:-1})]){
    const before=JSON.stringify(run);assert.throws(()=>recordRunDigivolution(freeze(run),run.starterInstanceId));
    assert.equal(JSON.stringify(run),before);
  }
  assert.throws(()=>recordRunDigivolution(evolutionRun(),'missing'),/not in the roster/);
});

test('mixed history uses one chronology, battle-only counts and original battle names',()=>{
  const initial=evolutionRun('Agumon',10);
  const first=recording.recordRunBattle(initial,normalBattle()).run;
  const evolved=recordRunDigivolution(first,first.starterInstanceId).run;
  const final=recording.recordRunBattle(evolved,normalBattle()).run;
  assert.deepEqual(final.history.map(e=>[e.type,e.order]),[['battle',0],['digivolve',1],['battle',2]]);
  const html=renderPlanner(final);
  assert.match(html,/Recorded battles<\/dt><dd[^>]*>2<\/dd>/);
  assert.ok(html.indexOf('Action 1')<html.indexOf('Action 2') && html.indexOf('Action 2')<html.indexOf('Action 3'));
  const history=html.slice(html.indexOf('aria-label="Run History"'));
  assert.match(history,/Participants: Agumon/);assert.match(history,/Participants: Greymon/);
  assert.match(history,/Agumon → Greymon/);assert.match(history,/Rookie → Champion/);
  assert.match(history,/HP \+30 · MP \+30/);assert.match(html,/Gold Hawk/);
  assert.ok(!html.includes('Undo Last Battle'));assert.ok(html.includes('Undo Last Action'));
});

test('mixed Undo restores exact checkpoints, techniques, species, fractional stats and earlier events',()=>{
  const initial=evolutionRun('Agumon',10);
  const first=recording.recordRunBattle(initial,normalBattle()).run;
  const evolved=recordRunDigivolution(first,first.starterInstanceId).run;
  assert.deepEqual(meaningfulRun(restoredRun(freeze(evolved))),meaningfulRun(first));
  const final=recording.recordRunBattle(evolved,{...normalBattle(),capturedEnemySlot:1}).run;
  assert.equal(final.roster[0].level,12);assert.ok(final.roster[0].techs.length>evolved.roster[0].techs.length);
  const once=restoredRun(freeze(final));assert.deepEqual(meaningfulRun(once),meaningfulRun(evolved));
  const twice=restoredRun(once);assert.deepEqual(meaningfulRun(twice),meaningfulRun(first));
  assert.equal(progressionData.getSpeciesProgression(twice.roster[0].speciesId).rank,'Rookie');
  assert.deepEqual(meaningfulRun(restoredRun(twice)),meaningfulRun(initial));
});

test('Undo Digivolution discards subsequent Digiline edits and replacement orders stay contiguous',()=>{
  const initial=evolutionRun();initial.roster.push({...structuredClone(initial.roster[0]),instanceId:'reserve'});
  const evolved=recordRunDigivolution(initial,initial.starterInstanceId).run;
  let changed=addToDigiline(evolved,'reserve');changed=moveDigilineMember(changed,'reserve','up');
  changed=removeFromDigiline(changed,initial.starterInstanceId);
  const restored=restoredRun(changed);assert.deepEqual(meaningfulRun(restored),meaningfulRun(initial));
  const replacement=recordRunDigivolution(restored,initial.starterInstanceId).run;
  assert.equal(replacement.history[0].order,0);assert.notEqual(replacement.history[0].id,evolved.history[0].id);
  const battled=recording.recordRunBattle(replacement,normalBattle()).run;
  const undone=restoredRun(battled);
  const another=recording.recordRunBattle(undone,normalBattle()).run;
  assert.deepEqual(another.history.map(e=>e.order),[0,1]);assert.deepEqual(another.history[0],replacement.history[0]);
});

test('v3 rejects malformed discriminants, audit fields, checkpoint references, IDs and order',()=>{
  const initial=evolutionRun();const valid=recordRunDigivolution(initial,initial.starterInstanceId).run;
  const event=valid.history[0];
  const bad=[{type:'dna'},{type:'battle'},{id:''},{id:7},{order:-1},{order:0.5},{order:1},{order:NaN},
    {instanceId:'missing'},{fromSpeciesId:'betamon'},{toSpeciesId:'devimon'},
    {fromRank:'Champion'},{toRank:'Mega'},{level:12},{dp:1},{hpBonus:31},{mpBonus:0},
    {levelCap:{min:13,max:13,resolved:13}},{preActionCheckpoint:null},
    {preActionCheckpoint:{...event.preActionCheckpoint,history:[]}}];
  for(const key of Object.keys(event))bad.push({[key]:undefined});
  for(const change of bad){
    const invalid=freeze({...valid,history:[{...event,...change}]});
    assert.equal(storage.isValidPersistedRunPlannerData(envelope(invalid)),false,JSON.stringify(change));
    assert.ok(validateRunPlan(invalid).length>0,JSON.stringify(change));
  }
  const mixed=recording.recordRunBattle(valid,normalBattle()).run;
  mixed.history[1].id=mixed.history[0].id;
  assert.equal(storage.saveRunPlannerData(envelope(mixed)),false);
});

test('Digivolution save failure is atomic; retry succeeds once and stale preview is rejected',()=>{
  const initial=evolutionRun();storage.saveRunPlannerData(envelope(initial));
  const render=plannerHost(), planner=render();const reviewed=structuredClone(initial.roster[0]);
  const raw=values.get(storage.RUN_PLANNER_STORAGE_KEY),save=global.localStorage.setItem;
  global.localStorage.setItem=()=>{throw Error('quota');};
  assert.equal(planner.digivolve(initial.id,reviewed),false);
  assert.deepEqual(render().activeRun,initial);assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY),raw);
  assert.equal(render().feedbackRevision,0);assert.match(render().error,/Could not save/);
  global.localStorage.setItem=save;
  assert.equal(planner.digivolve(initial.id,reviewed),true);
  assert.equal(render().activeRun.history.length,1);assert.equal(render().feedbackRevision,1);
  assert.equal(planner.digivolve(initial.id,reviewed),false);
  assert.equal(render().activeRun.history.length,1);assert.match(render().error,/changed/);
});

test('changed stats or switched runs invalidate previews; immediate Digiline edits retain new history',()=>{
  const initial=evolutionRun(),other=evolutionRun();
  storage.saveRunPlannerData({schemaVersion:3,runs:[initial,other],activeRunId:initial.id});
  const render=plannerHost(),planner=render();
  planner.recordBattle(normalBattle());
  assert.equal(planner.digivolve(initial.id,initial.roster[0]),false);
  planner.loadRun(other.id);
  assert.equal(planner.digivolve(initial.id,initial.roster[0]),false);
  assert.equal(render().activeRun.id,other.id);
  assert.equal(planner.digivolve(other.id,other.roster[0]),true);
  planner.removeMember(other.starterInstanceId);
  assert.equal(render().activeRun.history.length,1);assert.equal(render().activeRun.roster[0].speciesId,'greymon');
});

test('failed Digivolution Undo save preserves state and retry restores it',()=>{
  const before=evolutionRun(),evolved=recordRunDigivolution(before,before.starterInstanceId).run;
  storage.saveRunPlannerData(envelope(evolved));const render=plannerHost(),planner=render();
  const save=global.localStorage.setItem;global.localStorage.setItem=()=>{throw Error('quota');};
  assert.equal(planner.undoAction(evolved.history[0].id,evolved.id),false);assert.deepEqual(render().activeRun,evolved);
  global.localStorage.setItem=save;
  assert.equal(planner.undoAction(evolved.history[0].id,evolved.id),true);
  assert.deepEqual(meaningfulRun(render().activeRun),meaningfulRun(before));
});

test('own technique is learned by the following threshold battle, never by early or late Digivolution',()=>{
  for(const [name,level] of [['Agumon',11],['Greymon',21],['MetalGreymon',31]]){
    const initial=evolutionRun(name,level,{techs:[]});
    const evolved=recordRunDigivolution(initial,initial.starterInstanceId).run;
    const tech=progressionData.getSpeciesProgression(evolved.roster[0].speciesId).ownTechnique;
    assert.deepEqual(evolved.roster[0].techs,[]);
    const battle=recording.recordRunBattle(evolved,normalBattle());
    assert.deepEqual(battle.resolution.outcomes[0].learnedTechniques,[tech]);assert.deepEqual(battle.run.roster[0].techs,[tech]);
    const late=evolutionRun(name,level+2,{techs:[]});const lateEvolved=recordRunDigivolution(late,late.starterInstanceId).run;
    assert.deepEqual(lateEvolved.roster[0].techs,[]);
    assert.deepEqual(recording.recordRunBattle(lateEvolved,normalBattle()).resolution.outcomes[0].learnedTechniques,[]);
  }
});

for(const [name,level,dp,text] of [
  ['Agumon',10,0,'Available at EL11'],['Agumon',11,0,'Digivolve'],
  ['WarGreymon',32,0,'No further normal Digivolution'],['Piddomon',21,6,'Next: Giromon'],
])test(`roster displays rank, DP and next evolution for ${name} EL${level} DP${dp}`,()=>{
  const html=renderPlanner(evolutionRun(name,level,{dp}));
  const roster=html.slice(html.indexOf('aria-label="Roster"'),html.indexOf('aria-label="Battle Selector"'));
  assert.ok(roster.includes(`${progressionData.getSpeciesProgression(speciesLookup.getDigimonByName(name).id).rank} · DP ${dp}`));
  assert.ok(roster.includes(text));assert.ok(roster.includes('Active Digiline'));assert.ok(roster.includes('Total XP'));
  if(name==='Agumon')assert.ok(roster.includes('Next: Greymon'));
});

// Drive actual component handlers with local hook state; no DOM dependency or fabricated data files.
function componentHost(file,exportName){
  const slots=[];let cursor=0;const realReact=require('react');
  const react={...realReact,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
    return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];}};
  const mod={exports:{}};const js=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports',js)(id=>{
    if(id==='react')return react;if(!id.startsWith('@/'))return require(id);
    const base='src/'+id.slice(2);return load(base+(fs.existsSync(path.join(root,base+'.ts'))?'.ts':'.tsx'));
  },mod,mod.exports);
  return props=>{cursor=0;return mod.exports[exportName](props);};
}
function elements(node){
  if(Array.isArray(node))return node.flatMap(elements);
  return node&&typeof node==='object'&&node.props?[node,...elements(node.props.children)]:[];
}
function elementText(node){
  if(Array.isArray(node))return node.map(elementText).join('');
  if(node&&typeof node==='object')return elementText(node.props?.children);
  return typeof node==='string'||typeof node==='number'?String(node):'';
}

test('Digivolve preview is read-only, displays exact changes and cancellation does not submit',()=>{
  const member=freeze(evolutionRun().roster[0]);let calls=0;
  const render=componentHost('src/components/run-planner/DigivolutionControls.tsx','DigivolutionControls');
  const props={runId:'test',member,error:null,onDigivolve:()=>{calls++;return false;}};
  let tree=render(props);elements(tree).find(e=>e.props.children==='Digivolve').props.onClick();
  tree=render(props);assert.equal(calls,0);const text=elementText(tree);
  for(const expected of ['CurrentAgumonRookieEL 11 · DP 0','ResultGreymonChampionEL 11 · DP 0',
    'HP: 34.5 → 64.5','MP: 37.25 → 67.25','Max EL: unchanged','Known techniques: preserved','EL12 / EL22 / EL32'])assert.ok(text.includes(expected),text);
  let prevented=false;elements(tree).find(e=>e.props.children==='Confirm Digivolution').props.onClick({preventDefault(){prevented=true;}});
  assert.equal(calls,1);assert.equal(prevented,true);assert.equal(elements(render(props)).find(e=>e.props.open===true).props.open,true);
  elements(tree).find(e=>e.props.open===true).props.onOpenChange(false);
  assert.ok(!elements(render(props)).some(e=>e.props.open===true));assert.equal(calls,1);
});

test('generic ambiguous data remains visible without offering a Digivolve action',()=>{
  const extra={id:-1,from:'agumon',to:'devimon',min:0,max:null};evolution.EVOLUTION_RANGES.push(extra);
  try{const html=renderPlanner(evolutionRun());assert.ok(html.includes('Evolution data ambiguous'));assert.ok(!html.includes('aria-label="Digivolve Agumon"'));}
  finally{evolution.EVOLUTION_RANGES.splice(evolution.EVOLUTION_RANGES.indexOf(extra),1);}
});

for(const name of ['Greymon','Piddomon'])test(`battle feedback displays learned planner technique for ${name}`,()=>{
  const run=evolutionRun(name,11,{techs:[]});
  const result=recording.recordRunBattle(run,normalBattle()).resolution;
  const render=componentHost('src/components/run-planner/BattleRecordControls.tsx','BattleRecordControls');
  const props={selection:normalBattle(),hasParticipants:true,onRecord:()=>result};
  const tree=render(props);elements(tree).find(e=>e.props.children==='Record Battle').props.onClick();
  const html=require('react-dom/server').renderToStaticMarkup(render(props));
  const tech=progressionData.getSpeciesProgression(run.roster[0].speciesId).ownTechnique;
  assert.ok(html.includes('Learned technique: '+tech));
  if(name==='Piddomon'){assert.equal(tech,'Mega Heal');assert.equal(techLookup.getTechByName(tech),undefined);}
});

// Phase 2F-C: isolated authoritative-slot fixtures are restored after every test.
function withCaptureLevel(level, action) {
  const enemy=load('src/data/encounters.ts').encounters.find(e=>e.id===32).digimons[0];
  const old=enemy.level;enemy.level=level;
  try{return action(enemy);}finally{enemy.level=old;}
}
for(const [level,choices] of [[28,[30,31,32]],[29,[31,32,33]],[35,[37,38,39]],[49,[51,52,53]]]) {
  test(`EL${level} exposes authoritative inclusive choices and commits exact acquisition metadata`,()=>withCaptureLevel(level,enemy=>{
    const choice=recording.getCaptureChoices(normalBattle()).find(c=>c.slot===enemy.slot);
    assert.deepEqual(caps.getLevelCapChoices(choice.levelCap),choices);
    const run=createRunPlan('gold-hawk','Capture');
    const r=recording.recordRunBattle(run,{...normalBattle(),capturedEnemySlot:enemy.slot,capturedMaxLevel:choices[1]});
    const captured=r.run.roster.find(m=>m.instanceId===r.event.capturedInstanceId);
    assert.ok(captured);assert.equal(captured.dp,0);assert.equal(captured.level,level);
    assert.equal(captured.totalXp,load('src/utils/experience.ts').getRequiredTotalXpForLevel(level));
    assert.deepEqual(captured.stats,{hp:enemy.hp,mp:enemy.mp,atk:enemy.atk,def:enemy.def,spd:enemy.spd});
    assert.deepEqual(captured.techs,enemy.techs);
    assert.deepEqual(captured.levelCap,{min:choices[0],max:choices[2],resolved:choices[1]});
    assert.deepEqual(r.event.capturedLevelCap,captured.levelCap);assert.notEqual(r.event.capturedLevelCap,captured.levelCap);
    assert.equal(storage.saveRunPlannerData(envelope(r.run)),true);
    assert.deepEqual(storage.loadRunPlannerData(),envelope(r.run));
    const restored=undo.undoLastAction(r.run);assert.equal(restored.ok,true);assert.deepEqual(restored.run.roster,run.roster);
    const again=recording.recordRunBattle(restored.run,{...normalBattle(),capturedEnemySlot:enemy.slot,capturedMaxLevel:choices[2]});
    assert.equal(again.event.capturedLevelCap.resolved,choices[2]);assert.notEqual(again.event.capturedInstanceId,r.event.capturedInstanceId);
  }));
}
for(const value of [undefined,null,29,33,30.5,NaN,Infinity,38])test(`random capture rejects invalid choice ${value}`,()=>withCaptureLevel(28,enemy=>{
  const run=freeze(createRunPlan('gold-hawk','Run'));const previous=structuredClone(run);
  assert.throws(()=>recording.recordRunBattle(run,{...normalBattle(),capturedEnemySlot:enemy.slot,capturedMaxLevel:value}));
  assert.equal(captureFoundation.tryCreateCapturedDigimon(32,enemy.slot,value).ok,false);assert.deepEqual(run,previous);
}));
test('stale cap without capture rejects; no-capture and fixed audit are explicit',()=>{
 const run=createRunPlan('gold-hawk','Run');
 assert.throws(()=>recording.recordRunBattle(run,{...normalBattle(),capturedMaxLevel:31}),/requires a capture/);
 const plain=recording.recordRunBattle(run,normalBattle());assert.equal(plain.event.capturedInstanceId,null);assert.equal(plain.event.capturedLevelCap,null);
 const fixed=recording.recordRunBattle(run,{...normalBattle(),capturedEnemySlot:1});
 assert.deepEqual(fixed.event.capturedLevelCap,fixed.run.roster.at(-1).levelCap);assert.notEqual(fixed.event.capturedLevelCap.resolved,null);
});
for(const level of [28,29,30,31])test(`unresolved active EL${level} recording boundary is atomic`,()=>{
 const run=multiRun();run.roster[0]={...run.roster[0],level,totalXp:1000000,levelCap:{min:30,max:32,resolved:null}};
 run.digiline=run.roster.slice(0,2).map(m=>m.instanceId);const previous=structuredClone(run);
 if(level>=30){assert.throws(()=>recording.recordRunBattle(freeze(run),{...normalBattle(),capturedEnemySlot:1}),/Maximum EL is unresolved/);assert.deepEqual(run,previous);}
 else assert.equal(recording.recordRunBattle(run,normalBattle()).run.history.length,1);
});
test('unresolved reserve is permitted; resolved MAX grants teammates XP, Bits and capture',()=>{
 const run=multiRun();run.roster[1]={...run.roster[1],level:30,totalXp:1000000,levelCap:{min:30,max:32,resolved:null}};
 assert.equal(recording.recordRunBattle(run,normalBattle()).run.history.length,1);
 run.roster[0]={...run.roster[0],level:30,totalXp:1000000,levelCap:{min:30,max:32,resolved:30}};
 run.digiline=[run.roster[0].instanceId,run.roster[2].instanceId];
 const r=recording.recordRunBattle(run,{...normalBattle(),capturedEnemySlot:1});
 assert.equal(r.resolution.outcomes[0].actualXpApplied,0);assert.equal(r.resolution.outcomes[1].actualXpApplied,r.event.xpReward);
 assert.equal(r.run.totalBits,1030+r.event.bitsReward);assert.ok(r.event.capturedInstanceId);assert.equal(r.run.history.length,1);
});
test('first 280 Bits battle and Undo use the initial balance checkpoint',()=>{
 const rewards=load('src/utils/rewardMatching.ts').REWARDS_BY_ENCOUNTER_ID;const old=rewards.get(32);
 try {rewards.set(32,{...old,bits:280});const r=recording.recordRunBattle(createRunPlan('gold-hawk','Run'),normalBattle());
 assert.equal(r.run.totalBits,1310);assert.equal(undo.undoLastAction(r.run).run.totalBits,1030);
 }finally{rewards.set(32,old);}
});
for(const mutation of [e=>{e.capturedInstanceId=null},e=>{e.capturedInstanceId='unknown'},e=>{e.capturedLevelCap=null},e=>{e.capturedLevelCap.resolved=null},e=>{e.capturedLevelCap.min--},e=>{e.capturedLevelCap.resolved=32},e=>{e.capturedEnemySlot=null},e=>{e.capturedEnemySlot=99}])test('capture audit tampering is rejected on save and reload',()=>withCaptureLevel(28,()=>{
 const r=recording.recordRunBattle(createRunPlan('gold-hawk','Run'),{...normalBattle(),capturedEnemySlot:1,capturedMaxLevel:31}).run;
 mutation(r.history[0]);assert.ok(validateRunPlan(r).length);assert.equal(storage.saveRunPlannerData(envelope(r)),false);
 values.set(storage.RUN_PLANNER_STORAGE_KEY,JSON.stringify(envelope(r)));assert.deepEqual(storage.loadRunPlannerData(),storage.emptyRunPlannerData());
}));
test('Piddomon authoritative static ranges need no runtime exception',()=>{
 const source=load('src/data/evolutionSource.ts');const id=source.METALKID_DIGIMON_SOURCE.find(d=>d.name==='Piddomon').id;
 const rows=source.METALKID_EVOLUTION_SOURCE.filter(r=>r.from===id);
 assert.deepEqual(rows.map(r=>[r.min,r.max]),[[0,5],[6,null]]);
 assert.deepEqual(rows.map(r=>source.METALKID_DIGIMON_SOURCE.find(d=>d.id===r.to).name),['MagnaAngemon','Giromon']);
 for(const file of ['normalDigivolution.ts','progressionValidation.ts'])assert.ok(!fs.readFileSync(path.join(root,'src/utils',file),'utf8').toLowerCase().includes('piddomon'));
 assert.deepEqual(load('src/utils/progressionValidation.ts').getProgressionValidationReport().evolutionRangeAmbiguities,[]);
});
test('capture UI starts blank, resets on slot/no-capture/success and disables missing choice',()=>withCaptureLevel(28,()=>{
 const render=componentHost('src/components/run-planner/BattleRecordControls.tsx','BattleRecordControls');let submitted;
 const props={selection:normalBattle(),hasParticipants:true,onRecord:request=>{submitted=request;return recording.recordRunBattle(createRunPlan('gold-hawk','Run'),request).resolution;}};
 const selects=()=>elements(render(props)).filter(e=>typeof e.props.onValueChange==='function');
 const button=()=>elements(render(props)).find(e=>e.props.children==='Record Battle');
 selects()[0].props.onValueChange('1');assert.equal(selects()[1].props.value,'');assert.equal(button().props.disabled,true);
 selects()[1].props.onValueChange('31');assert.equal(button().props.disabled,false);
 selects()[0].props.onValueChange('2');selects()[0].props.onValueChange('1');assert.equal(selects()[1].props.value,'');
 selects()[1].props.onValueChange('32');selects()[0].props.onValueChange('none');selects()[0].props.onValueChange('1');assert.equal(selects()[1].props.value,'');
 selects()[1].props.onValueChange('31');button().props.onClick();assert.equal(submitted.capturedMaxLevel,31);assert.equal(selects()[0].props.value,'none');
 selects()[0].props.onValueChange('1');assert.equal(selects()[1].props.value,'');
 // Parent keys the actual controls on every encounter-location field, forcing fresh hook state.
 const parent=fs.readFileSync(path.join(root,'src/components/run-planner/BattleSelector.tsx'),'utf8');
 assert.ok(parent.includes('key={`${phase}/${domainId}/${floor}/${encounterId}`}'));
}));

test('pure progression retains participant-level capResolutionRequired defense',()=>{
 const run=multiRun();run.roster=run.roster.slice(0,3);run.digiline=run.roster.map(m=>m.instanceId);
 run.roster[0]={...run.roster[0],level:13,totalXp:1000000};
 run.roster[1]={...run.roster[1],level:30,totalXp:1000000,dp:7,levelCap:caps.getInitialLevelCap(28)};
 const previous=structuredClone(run);
 const r=battleFoundation.resolveBattle({encounterId:32,roster:freeze(run.roster),digilineInstanceIds:run.digiline,totalBits:run.totalBits,capturedEnemySlot:1});
 assert.equal(r.outcomes[0].capped,true);assert.equal(r.outcomes[1].capResolutionRequired,true);
 for(const i of [0,1]){assert.deepEqual(r.roster[i],previous.roster[i]);assert.deepEqual(r.outcomes[i].learnedTechniques,[]);}
 assert.equal(r.outcomes[2].actualXpApplied,r.xpAwarded);assert.equal(r.totalBits,1030+r.bitsAwarded);assert.equal(r.roster.length,4);
 assert.deepEqual(run,previous);
});
