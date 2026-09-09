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
const envelope = (run) => ({ schemaVersion: 5, runs: [run], activeRunId: run.id });
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
test('saving a remaining run preserves the version-5 multi-run envelope', () => {
  const first = createRunPlan('gold-hawk', 'First');
  const second = createRunPlan('blue-falcon', 'Second');
  assert.equal(storage.saveRunPlannerData({schemaVersion: 5,runs:[first,second],activeRunId:first.id}),true);
  const remaining = {schemaVersion: 5,runs:[second],activeRunId:null};
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
  run.history = [{type:'battle',techniqueChoices:[],id:'history',order:0,domainId:'test',phase:'before-blood-knights',floor:1,encounterId:182,
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
  storage.saveRunPlannerData({schemaVersion: 5,runs:[first,other],activeRunId:first.id});
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
const inheritance = load('src/utils/techniqueInheritance.ts');
const techniqueMetadata = load('src/data/techniqueMetadata.ts');
const foundationMember = (name, level, extra={}) => {
  const species=speciesLookup.getDigimonByName(name);
  const member = {...createRunPlan('gold-hawk','Fixture').roster[0],speciesId:species.id,name:species.name,
    level,totalXp:1000000,levelCap:{min:53,max:53,resolved:53},...extra};
  return {...member, ...inheritance.createAvailableTechniqueState(member.techs, {type:"starter",speciesId:species.id})};
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

test('schema v5 is explicit and rejects schema v4 without migration or writes',()=>{
  assert.equal(storage.RUN_PLANNER_SCHEMA_VERSION,5);
  assert.equal(storage.emptyRunPlannerData().schemaVersion,5);
  const old={...envelope(evolutionRun()),schemaVersion:4};
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
  storage.saveRunPlannerData({schemaVersion: 5,runs:[initial,other],activeRunId:initial.id});
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

// Phase 2G-A: pure DNA preview; no roster/history integration.
const dnaData = load('src/data/dna.ts');
const dnaSource = load('src/data/dnaSource.ts');
const dnaTypes = load('src/types/dna.ts');
const dnaEngine = load('src/utils/dnaDigivolution.ts');
const dnaAudit = load('src/utils/dnaValidation.ts');
const dnaExternal = load('src/data/dnaCrossValidationSource.ts');
const dnaParent = (name, id, extra={}) => foundationMember(name,
  {Champion:11,Ultimate:21,Mega:31,Rookie:1}[progressionData.getSpeciesProgression(speciesLookup.getDigimonByName(name).id).rank],
  {instanceId:id, ...extra});
const dnaPreview = (a,b) => dnaEngine.previewDnaDigivolution(a,b);

test('DNA v4 audit computes full family, matrix, mutation and independent combination counts',()=>{
  const r=dnaAudit.getDnaValidationReport();
  for(const [key,value] of Object.entries({familyRecords:182,familyNamesResolved:182,familyDuplicateSpecies:0,
    matrixEntries:576,matrixResultsResolved:576,matrixUniqueResultLabels:137,matrixAsymmetries:0,matrixDuplicateCells:0,
    MetalKidComparableCombinations:4322,MetalKidMatches:4322,MetalKidMismatches:0,MetalKidUnresolved:0,mutationCellCount:15,mutationInitializationUnresolved:0}))assert.equal(r[key],value,key);
  for(const key of ['familyUnresolved','missingCells','asymmetricCells','MetalKidMismatchDetails','MetalKidUnresolvedIds'])assert.deepEqual(r[key],[]);
  assert.deepEqual(r.mutationResultSpecies.sort(),['SandYanmamon','Vademon','Yanmamon']);
  assert.deepEqual(r.mutationCells.sort(),dnaSource.DNA_DOCUMENTED_MUTATIONS.flatMap(m=>m.sourceCells).sort());
  for(const [name,family] of dnaSource.DNA_FAMILY_SOURCE){assert.ok(dnaTypes.DNA_FAMILIES.includes(family));assert.equal(dnaData.getDnaFamily(speciesLookup.getDigimonByName(name).id),family);}
});
test('DNA normalization is contextual and preserves global aliases and distinct Tyrannomon species',()=>{
  assert.equal(dnaData.resolveDnaMatrixLabel('M-Tyrannomon').id,'mastertyrannomon');
  assert.equal(speciesLookup.getDigimonByName('M-Tyrannomon'),undefined);
  assert.equal(speciesLookup.DIGIMON_NAME_ALIASES.mtyrannomon,undefined);
  assert.equal(dnaData.resolveDnaMatrixLabel('MetalTyrannomon').id,'metaltyrannomon');
  assert.equal(dnaData.resolveDnaMatrixLabel('Dokunemmon').id,'dokunemon');
  for(const name of ['M-Garurumon','M-Seadramon','M-Kabuterimon'])assert.equal(dnaData.resolveDnaMatrixLabel(name).id,speciesLookup.getDigimonByName(name).id);
  assert.equal(dnaData.resolveDnaMatrixLabel('M-Agumon'),undefined);
  const labels=new Set(dnaSource.DNA_MATRIX_SOURCE.map(row=>row.resultLabel));assert.equal(labels.size,137);
  for(const name of labels)assert.ok(dnaData.resolveDnaMatrixLabel(name));
});
for(const rank of dnaTypes.DNA_SELECTION_RANKS)for(const type of dnaTypes.DNA_TYPES)test(`DNA ${rank}/${type} has 64 exact symmetric cells`,()=>{
  const rows=dnaSource.DNA_MATRIX_SOURCE.filter(r=>r.matrixSelectionRank===rank&&r.matrixSelectionType===type);assert.equal(rows.length,64);
  for(const row of rows){const r=dnaData.getDnaMatrixResult(rank,type,row.familyA,row.familyB);const reverse=dnaData.getDnaMatrixResult(rank,type,row.familyB,row.familyA);
    assert.equal(r.actualResultSpeciesId,dnaData.resolveDnaMatrixLabel(row.resultLabel).id);assert.equal(r.actualResultSpeciesId,reverse.actualResultSpeciesId);
    assert.equal(r.isMutation,reverse.isMutation);assert.equal(r.sourceCell,row.sourceCell);
    assert.equal(r.isMutation,r.actualResultRank!==rank||r.actualResultType!==type);
  }
});
for(const [a,b,rank] of [['Greymon','Greymon','Rookie'],['Greymon','MetalGreymon','Rookie'],['Greymon','WarGreymon','Rookie'],
  ['MetalGreymon','MetalGreymon','Champion'],['MetalGreymon','WarGreymon','Champion'],['WarGreymon','WarGreymon','Ultimate']])test(`DNA ${a} + ${b} selects ${rank} before either reaches MAX`,()=>{
 const pa=freeze(dnaParent(a,'a')),pb=freeze(dnaParent(b,'b'));const old=structuredClone([pa,pb]);
 const r=dnaPreview(pa,pb);assert.equal(r.status,'success');assert.equal(r.matrixSelectionRank,rank);assert.equal(r.actualResultRank,rank);
 assert.equal(r.actualResultType,'Vaccine');assert.equal(r.matrixSelectionType,'Vaccine');assert.equal(r.isMutation,false);
 assert.deepEqual(r,dnaPreview(pb,pa));assert.deepEqual(r,dnaPreview(pa,pb));assert.deepEqual([pa,pb],old);
 assert.equal(r.startingLevel,{Rookie:1,Champion:11,Ultimate:21}[rank]);assert.equal(r.childTotalXp,{Rookie:0,Champion:483,Ultimate:5883}[rank]);
 assert.notEqual(r.childTotalXp,pa.totalXp);assert.notEqual(r.childTotalXp,pb.totalXp);
 assert.deepEqual(r.parents.map(p=>p.instanceId),['a','b']);assert.ok(r.parents.every(p=>p.family==='Dragon'));
 assert.ok(!('techs' in r));assert.ok(!('instanceId' in r));assert.ok(!('source' in r));
});
for(const partner of ['Greymon','WarGreymon'])test(`DNA Rookie + ${partner} is rejected both ways`,()=>{
 const a=dnaParent('Agumon','a'),b=dnaParent(partner,'b');assert.equal(dnaPreview(a,b).reason,'rookie-parent-ineligible');assert.deepEqual(dnaPreview(a,b),dnaPreview(b,a));
});
for(const name of ['ChaosLord','C-Pierrotmon','C-Seadramon','C-WarGreymon','Guardian-Data','Guardian-Vaccine','Guardian-Virus',
 'Left Hand','NeoCrimson','No Rookie Form','Overlord GAIA','Overlord GAIA (2)','Right Hand'])test(`DNA ${name} has no fabricated family`,()=>{
 const a=dnaParent(name,'a'),b=dnaParent('Greymon','b');assert.equal(dnaData.getDnaFamily(a.speciesId),null);assert.equal(dnaPreview(a,b).reason,'missing-family');assert.deepEqual(dnaPreview(a,b),dnaPreview(b,a));
});
test('DNA rejects duplicate instance identity even with different species',()=>{
 assert.equal(dnaPreview(dnaParent('Greymon','same'),dnaParent('MetalGreymon','same')).reason,'same-instance');
});
for(const [a,b,expected] of [['Vaccine','Virus','Vaccine'],['Virus','Data','Virus'],['Data','Vaccine','Data'],
 ['Vaccine','Vaccine','Vaccine'],['Data','Data','Data'],['Virus','Virus','Virus']])test(`DNA dominance ${a}/${b} = ${expected}`,()=>{
 assert.equal(dnaData.getDnaSelectionType(a,b),expected);assert.equal(dnaData.getDnaSelectionType(b,a),expected);
});
for(const [a,b,result] of [[0,0,1],[2,0,3],[4,7,8]])test(`DNA DP${a} + DP${b} = DP${result}`,()=>{
 const pa=dnaParent('Greymon','a',{dp:a}),pb=dnaParent('Greymon','b',{dp:b});assert.equal(dnaPreview(pa,pb).childDp,result);assert.deepEqual(dnaPreview(pa,pb),dnaPreview(pb,pa));
});
for(const dp of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER])test(`DNA invalid DP ${dp} rejected`,()=>{
 assert.equal(dnaPreview(dnaParent('Greymon','a',{dp}),dnaParent('Greymon','b')).reason,'invalid-dp');
});
for(const [a,b,cap] of [[11,11,13],[19,14,21],[20,15,23],[21,29,33],[49,49,58]])test(`DNA EL${a} + EL${b} gives exact cap ${cap}`,()=>{
 const pa=dnaParent('Greymon','a',{level:a,levelCap:{min:99,max:99,resolved:99}}),pb=dnaParent('Greymon','b',{level:b});
 const r=dnaPreview(pa,pb);assert.equal(r.childMaxLevel,cap);assert.deepEqual(r.childLevelCap,{min:cap,max:cap,resolved:cap});assert.deepEqual(r,dnaPreview(pb,pa));
});
const dnaStatsA={hp:123.75,mp:88.25,atk:101.75,def:73.5,spd:43.25};
const dnaStatsB={hp:234.5,mp:155.75,atk:67.5,def:98.25,spd:66.75};
for(const [name,expected] of [['Greymon',{hp:35,mp:24,atk:60,def:61,spd:33}],
 ['MetalGreymon',{hp:121,mp:82,atk:71,def:71,spd:49}],['WarGreymon',{hp:161,mp:109,atk:77,def:78,spd:55}]])test(`DNA ${name} pair uses complete fractional stat expressions`,()=>{
 const a=freeze(dnaParent(name,'a',{stats:{...dnaStatsA}})),b=freeze(dnaParent(name,'b',{stats:{...dnaStatsB}}));
 const r=dnaPreview(a,b);assert.deepEqual(r.childStats,expected);assert.deepEqual(r,dnaPreview(b,a));
 r.childStats.hp=999;assert.deepEqual(a.stats,dnaStatsA);assert.deepEqual(b.stats,dnaStatsB);assert.deepEqual(dnaPreview(a,b).childStats,expected);
});
test('DNA final flooring retains parent fractions and combines weighted terms before flooring',()=>{
 const a=dnaParent('Greymon','a',{stats:{hp:9.5,mp:9.5,atk:1.5,def:1.5,spd:1.75}}),b=dnaParent('Greymon','b',{stats:{hp:0.5,mp:0.5,atk:1.5,def:1.5,spd:1.75}});
 assert.deepEqual(dnaPreview(a,b).childStats,{hp:1,mp:1,atk:1,def:1,spd:1});
});
for(const [a,b,name,rank,type] of [['Cherrymon','MasterTyrannomon','Vademon','Ultimate','Virus'],
 ['Gryphonmon','H-Kabuterimon','Yanmamon','Champion','Data'],['Baihumon','H-Kabuterimon','SandYanmamon','Champion','Data']])test(`DNA ${name} mutation initializes from actual canonical rank`,()=>{
 const pa=freeze(dnaParent(a,'a',{dp:4,stats:{...dnaStatsA}})),pb=freeze(dnaParent(b,'b',{dp:7,stats:{...dnaStatsB}}));const old=structuredClone([pa,pb]);
 const r=dnaPreview(pa,pb);assert.equal(r.status,'success');assert.equal(r.initializationStatus,'initialized');assert.equal(r.isMutation,true);
 assert.equal(r.actualResultName,name);assert.equal(r.actualResultRank,rank);assert.equal(r.actualResultType,type);
 assert.equal(r.matrixSelectionRank,name==='Vademon'?'Champion':'Ultimate');assert.equal(r.matrixSelectionType,name==='Vademon'?'Vaccine':'Data');
 assert.equal(r.startingLevel,name==='Vademon'?21:11);assert.equal(r.childTotalXp,name==='Vademon'?5883:483);
 const ultimateStats={hp:161,mp:109,atk:77,def:78,spd:55},championStats={hp:121,mp:82,atk:71,def:71,spd:49};
 assert.deepEqual(r.childStats,name==='Vademon'?ultimateStats:championStats);
 assert.notDeepEqual(r.childStats,name==='Vademon'?championStats:ultimateStats);assert.equal(r.childDp,8);
 const cap=name==='Vademon'?25:37;assert.equal(r.childMaxLevel,cap);assert.deepEqual(r.childLevelCap,{min:cap,max:cap,resolved:cap});
 assert.deepEqual(r,dnaPreview(pb,pa));assert.deepEqual(r,dnaPreview(pa,pb));assert.deepEqual([pa,pb],old);
});
test('DNA every documented mutation cell retains its actual metadata',()=>{
 for(const group of dnaSource.DNA_DOCUMENTED_MUTATIONS)for(const cell of group.sourceCells){const row=dnaSource.DNA_MATRIX_SOURCE.find(r=>r.sourceCell===cell);
  const r=dnaData.getDnaMatrixResult(row.matrixSelectionRank,row.matrixSelectionType,row.familyA,row.familyB);
  assert.equal(r.isMutation,true);assert.equal(r.actualResultName,group.actualResultSpecies);assert.equal(r.actualResultRank,group.actualResultRank);assert.equal(r.actualResultType,group.actualResultType);
 }
});
test('DNA missing authoritative XP fails explicitly for both ordinary and mutation results',()=>{
 const xp=load('src/data/experience.ts').CUMULATIVE_XP_BY_LEVEL;const old=[xp[1],xp[11],xp[21]];
 try{for(const l of [1,11,21])delete xp[l];assert.equal(dnaPreview(dnaParent('Greymon','a'),dnaParent('Greymon','b')).reason,'missing-xp-threshold');
 assert.equal(dnaPreview(dnaParent('Cherrymon','a'),dnaParent('MasterTyrannomon','b')).reason,'missing-xp-threshold');
 }finally{[1,11,21].forEach((l,i)=>{xp[l]=old[i];});}
});
for(const [extra,reason] of [[{speciesId:'unknown'},'invalid-species'],[{instanceId:''},'invalid-instance'],[{level:0},'invalid-level'],
 [{level:11.5},'invalid-level'],[{stats:{...dnaStatsA,hp:NaN}},'invalid-stats'],[{stats:{...dnaStatsA,spd:-1}},'invalid-stats'],
 [{level:Number.MAX_SAFE_INTEGER},'invalid-child-cap'],[{stats:{...dnaStatsA,hp:Number.MAX_VALUE}},'invalid-stats']])test(`DNA invalid input reports ${reason}`,()=>{
 assert.equal(dnaPreview(dnaParent('Greymon','a',extra),dnaParent('Greymon','b')).reason,reason);
});
test('DNA missing matrix and unresolved result labels are explicit failures',()=>{
 assert.equal(dnaData.getDnaMatrixResult('Mega','Vaccine','Dragon','Dragon').reason,'missing-matrix-result');
 const row=dnaSource.DNA_MATRIX_SOURCE.find(r=>r.matrixSelectionRank==='Rookie'&&r.matrixSelectionType==='Vaccine'&&r.familyA==='Dragon'&&r.familyB==='Dragon');
 const old=row.resultLabel;try{row.resultLabel='MissingSpecies';assert.equal(dnaPreview(dnaParent('Greymon','a'),dnaParent('Greymon','b')).reason,'unresolved-result-species');}finally{row.resultLabel=old;}
});
test('DNA external audit recomputes mismatches and unresolved IDs instead of trusting recorded counts',()=>{
 const row=dnaExternal.DNA_METALKID_COMBINATIONS[0];const wrong=dnaExternal.DNA_METALKID_SPECIES.find(([id])=>id!==row[3])[0];
 const r=dnaAudit.validateDnaCombinations([[...row.slice(0,3),wrong],[999,-1,row[2],row[3]]]);
 assert.equal(r.comparable,1);assert.equal(r.matches,0);assert.equal(r.mismatches.length,1);assert.deepEqual(r.unresolved,[999]);
});
test('DNA previews match every independent combination with canonical parents and preserve reversal',()=>{
 const byId=new Map(dnaExternal.DNA_METALKID_SPECIES);let ordinary=0,mutation=0;
 for(const [id,a,b,result] of dnaExternal.DNA_METALKID_COMBINATIONS){
  const pa=dnaParent(byId.get(a),'a'),pb=dnaParent(byId.get(b),'b');const r=dnaPreview(pa,pb);
  assert.equal(r.actualResultSpeciesId,speciesLookup.getDigimonByName(byId.get(result)).id,`combination ${id}`);assert.deepEqual(r,dnaPreview(pb,pa));
  assert.equal(r.status,'success');assert.ok(r.childStats);assert.equal(r.startingLevel,{Rookie:1,Champion:11,Ultimate:21}[r.actualResultRank]);
  if(r.isMutation){mutation++;}else{ordinary++;}
 }
 assert.equal(ordinary,4312);assert.equal(mutation,10);
});

test('DNA all 576 cells have v4 initialization rules for their actual canonical ranks',()=>{
 for(const row of dnaSource.DNA_MATRIX_SOURCE){
  const result=dnaData.getDnaMatrixResult(row.matrixSelectionRank,row.matrixSelectionType,row.familyA,row.familyB);
  const rule=dnaData.getDnaInitializationRule(result.actualResultRank);
  assert.ok(rule,row.sourceCell);assert.equal(rule.statFormulaRank,result.actualResultRank);
  assert.equal(rule.startingLevel,{Rookie:1,Champion:11,Ultimate:21}[result.actualResultRank]);
  assert.notEqual(load('src/utils/experience.ts').getRequiredTotalXpForLevel(rule.startingLevel),null);
 }
 for(const mutation of dnaSource.DNA_DOCUMENTED_MUTATIONS){
  const rule=dnaData.getDnaInitializationRule(mutation.actualResultRank);
  assert.equal(rule.startingLevel,mutation.startingLevel);assert.equal(rule.statFormulaRank,mutation.statFormulaRank);
 }
});
test('DNA mutation XP reads the actual-rank threshold independently of the matrix-rank threshold',()=>{
 const xp=load('src/data/experience.ts').CUMULATIVE_XP_BY_LEVEL;const old11=xp[11],old21=xp[21];
 try {
  delete xp[11];
  const v=dnaPreview(dnaParent('Cherrymon','a'),dnaParent('MasterTyrannomon','b'));
  assert.equal(v.status,'success');assert.equal(v.childTotalXp,5883);
  xp[11]=old11;delete xp[21];
  for(const partner of ['Gryphonmon','Baihumon']){
   const r=dnaPreview(dnaParent(partner,'a'),dnaParent('H-Kabuterimon','b'));
   assert.equal(r.status,'success');assert.equal(r.childTotalXp,483);
  }
 } finally {xp[11]=old11;xp[21]=old21;}
});
test('DNA unsupported actual result rank fails instead of falling back to matrix initialization',()=>{
 const metadata=progressionData.getSpeciesProgression('vademon');const old=metadata.rank;
 try{metadata.rank='Mega';assert.equal(dnaPreview(dnaParent('Cherrymon','a'),dnaParent('MasterTyrannomon','b')).reason,'unsupported-result-rank');}
 finally{metadata.rank=old;}
});

// Phase 2G-B: explicit planner identity, latent potentials, and pure DNA inheritance.
const techniqueAudit = load('src/utils/techniqueValidation.ts');
const techniqueReport = techniqueAudit.getTechniqueValidationReport();
for (const [field,expected] of Object.entries({species:195,named:182,none:13,unique:179,crossRankConflicts:0,captureSlots:238,captureLabels:173,captureResolved:173,captureAmbiguous:0})) {
  test(`technique metadata audit ${field} = ${expected}`,()=>assert.equal(techniqueReport[field],expected));
}
test('technique ranks and Party Time duplicate owners are intrinsic and unique',()=>{
  assert.deepEqual(techniqueReport.rankCounts,{Rookie:31,Champion:69,Ultimate:51,Mega:28});
  assert.deepEqual(techniqueReport.partyTimeOwners.map(id=>speciesLookup.getDigimonById(id).name).sort(),['Nanimon','Numemon','Sukamon','Vegiemon']);
  assert.equal(techniqueMetadata.getTechniqueRank('Party Time'),'Champion');
  assert.throws(()=>techniqueMetadata.buildTechniqueMetadata([{ownTechnique:'Party Time',rank:'Rookie'},{ownTechnique:'Party Time',rank:'Champion'}]),/Conflicting/);
});
for(const [raw,canonical] of [['Blaze Blaster','Blaze Buster'],['FLer Cannon','Flower Cannon'],['Ninja FLer','Ninja Flower']]) {
  test(`reviewed technique alias ${raw} -> ${canonical}`,()=>{
    assert.equal(techniqueMetadata.getTechniqueIdentity(raw).name,canonical);
    assert.equal(techniqueMetadata.normalizeTechniqueName(raw),techniqueMetadata.normalizeTechniqueName(canonical));
  });
}
test('technique normalization does not guess similar spellings',()=>{
  assert.equal(techniqueMetadata.getTechniqueIdentity('Blaze Blaste'),undefined);
  assert.notEqual(techniqueMetadata.normalizeTechniqueName('Blaze Blast'),techniqueMetadata.normalizeTechniqueName('Blaze Blaster'));
  assert.notEqual(techniqueMetadata.normalizeTechniqueName('Left Hand'),techniqueMetadata.normalizeTechniqueName('Right Hand'));
});
test('all 45 simulator-unresolved labels retain planner ranks independently',()=>{
  assert.equal(techniqueReport.unresolvedSimulatorLabels.length,45);
  assert.deepEqual(techniqueReport.simulatorLabelsWithoutRank,[]);
  assert.deepEqual(techniqueReport.captureUnresolved,[]);
});
for(const starter of STARTERS) test(`starter pool preserves ${starter.name} current techniques`,()=>{
  const member=captureFoundation.createStarterDigimon(starter);
  assert.deepEqual(member.techs,starter.techs);
  assert.ok(inheritance.isValidTechniqueState(member));
  assert.ok(member.techniquePool.every(p=>p.unlock.status==='available' && p.sources[0].type==='starter'));
});
test('every recordable capture preserves source techniques and resolves intrinsic ranks',()=>{
  const {DOMAIN_GROUPS}=load('src/data/domainGroups.ts');const {encounters}=load('src/data/encounters.ts');
  const cap=load('src/utils/levelCap.ts');const xp=load('src/utils/experience.ts');
  const ids=new Set(DOMAIN_GROUPS.filter(g=>!g.isBoss).map(g=>g.encounterId));let count=0;
  for(const e of encounters.filter(e=>ids.has(e.id))) for(const d of e.digimons){
    const c=cap.getInitialLevelCap(d.level);if(!c || xp.getRequiredTotalXpForLevel(d.level)===null)continue;
    const result=captureFoundation.tryCreateCapturedDigimon(e.id,d.slot,c.min);
    assert.equal(result.ok,true,`${e.id}/${d.slot}: ${result.reason}`);
    assert.deepEqual(result.digimon.techs,d.techs);
    assert.ok(inheritance.isValidTechniqueState(result.digimon));
    assert.ok(result.digimon.techniquePool.every(p=>p.unlock.status==='available'));
    count++;
  }
  assert.equal(count,238);
  const capture=captureFoundation.tryCreateCapturedDigimon(10,1,cap.getInitialLevelCap(encounters.find(e=>e.id===10).digimons.find(d=>d.slot===1).level).min).digimon;
  assert.equal(progressionData.getSpeciesProgression(capture.speciesId).rank,'Champion');
  assert.equal(capture.techniquePool.find(p=>p.name==='Spiral Twister').rank,'Rookie');
});
const techParent=(id,names)=>({instanceId:id,...inheritance.createAvailableTechniqueState(names,{type:'starter',speciesId:'agumon'})});
const rankedNames=['Pepper Breath','Spiral Twister','Party Time','Mega Heal','Ninja Flower','Venom Infusion'];
const childTech=(name,level,a=techParent('a',rankedNames),b=techParent('b',['Party Time']))=>{
  const species=speciesLookup.getDigimonByName(name);
  return inheritance.calculateDnaTechniqueState({speciesId:species.id,actualRank:progressionData.getSpeciesProgression(species.id).rank,startingLevel:level},a,b);
};
const potential=(state,name)=>state.techniquePool.find(p=>p.key===techniqueMetadata.normalizeTechniqueName(name));
for(const [name,level] of [['Agumon',1],['Greymon',11],['MetalGreymon',21],['Vademon',21],['Yanmamon',11],['SandYanmamon',11],['WarGreymon',31]]){
  test(`${name} DNA uses actual rank and starting threshold for every inherited rank`,()=>{
    const a=freeze(techParent('a',rankedNames)),b=freeze(techParent('b',['Party Time']));const before=JSON.stringify([a,b]);
    const child=childTech(name,level,a,b);
    assert.ok(inheritance.isValidTechniqueState(child));
    assert.equal(JSON.stringify([a,b]),before);
    assert.deepEqual(child,childTech(name,level,b,a));
    const own=progressionData.getSpeciesProgression(speciesLookup.getDigimonByName(name).id).ownTechnique;
    for(const raw of rankedNames){
      const p=potential(child,raw);const threshold=techniqueMetadata.TECHNIQUE_UNLOCK_LEVELS[p.rank];
      assert.deepEqual(p.unlock,(level>=threshold || (level===1 && p.key===techniqueMetadata.normalizeTechniqueName(own))) ? {status:'available'} : {status:'pending',level:threshold});
    }
    assert.deepEqual(potential(child,own).unlock,level===1 ? {status:'available'} : {status:'pending',level:level+1});
    assert.equal(child.techniquePool.filter(p=>p.name==='Party Time').length,1);
    assert.deepEqual(potential(child,'Party Time').sources,[{type:'inherited',parentInstanceId:'a'},{type:'inherited',parentInstanceId:'b'}]);
  });
}
test('DNA own Rookie duplicate wins EL1 and merges own/inherited provenance',()=>{
  const child=childTech('Agumon',1);
  assert.equal(child.techs.filter(n=>n==='Pepper Breath').length,1);
  assert.deepEqual(potential(child,'Pepper Breath').unlock,{status:'available'});
  assert.equal(potential(child,'Pepper Breath').sources.length,2);
  assert.deepEqual(potential(child,'Spiral Twister').unlock,{status:'pending',level:2});
});
for(const [name,level] of [['Agumon',11],['Greymon',21],['MetalGreymon',31]]){
  test(`normal ${name} evolution registers own potential and preserves existing state`,()=>{
    const member=foundationMember(name,level);const old=structuredClone(member);
    const evolved=evolution.applyNormalDigivolution(freeze(member));
    assert.deepEqual(member,old);assert.deepEqual(evolved.techs,old.techs);
    for(const p of old.techniquePool)assert.deepEqual(potential(evolved,p.name),p);
    const own=progressionData.getSpeciesProgression(evolved.speciesId).ownTechnique;
    assert.deepEqual(potential(evolved,own).unlock,{status:'pending',level:level+1});
    const advanced=inheritance.advanceTechniqueState(evolved,level,level+1);
    assert.deepEqual(advanced.learnedTechniques,[techniqueMetadata.getTechniqueIdentity(own).name]);
    assert.deepEqual(potential(advanced,own).unlock,{status:'available'});
    assert.deepEqual(inheritance.advanceTechniqueState(advanced,level+1,level+2).learnedTechniques,[]);
    const late=evolution.applyNormalDigivolution(foundationMember(name,level+2));
    assert.deepEqual(potential(late,own).unlock,{status:'missed',level:level+1});
    assert.deepEqual(inheritance.advanceTechniqueState(late,level+2,level+3).learnedTechniques,[]);
    const at=evolution.applyNormalDigivolution(foundationMember(name,level+1));
    assert.equal(potential(at,own).unlock.status,'missed');
  });
}
for(const [rank,threshold] of Object.entries(techniqueMetadata.TECHNIQUE_UNLOCK_LEVELS)){
  test(`${rank} level-up returns the full batch once without a 12-technique limit`,()=>{
    const names=[...new Set(progressionData.SPECIES_PROGRESSION.filter(r=>r.rank===rank && r.ownTechnique).map(r=>r.ownTechnique))];
    const initial=childTech('Agumon',1,techParent('a',names),techParent('b',names));
    const pending=initial.techniquePool.filter(p=>p.rank===rank && p.unlock.status==='pending').map(p=>p.name);
    const next=inheritance.advanceTechniqueState(freeze(initial),threshold-1,threshold);
    assert.deepEqual(next.learnedTechniques,pending);
    assert.ok(next.learnedTechniques.length>12);
    assert.equal(new Set(next.techs.map(techniqueMetadata.normalizeTechniqueName)).size,next.techs.length);
    assert.ok(inheritance.isValidTechniqueState(next));
    assert.deepEqual(inheritance.advanceTechniqueState(next,threshold,threshold+1).learnedTechniques,[]);
    assert.deepEqual(inheritance.advanceTechniqueState(initial,threshold-1,threshold-1).learnedTechniques,[]);
    assert.deepEqual(inheritance.advanceTechniqueState(initial,threshold-1,threshold+1).learnedTechniques,[]);
  });
}
test('multiple generations exclude missed and pending pools and reset own Rookie privilege',()=>{
  const late=evolution.applyNormalDigivolution(foundationMember('Agumon',13));
  const missed=late.techniquePool.find(p=>p.unlock.status==='missed');assert.ok(missed);
  const first=childTech('Agumon',1,{...late,instanceId:'a'},techParent('b',['Venom Infusion']));
  assert.equal(potential(first,missed.name),undefined);
  const member={...foundationMember('Agumon',11),...first};
  const evolved=evolution.applyNormalDigivolution(freeze(member));
  for(const p of first.techniquePool)assert.deepEqual(potential(evolved,p.name),p);
  const second=childTech('MetalGreymon',21,{...evolved,instanceId:'a'},techParent('b',[]));
  assert.equal(potential(second,missed.name),undefined);
  assert.equal(potential(second,'Venom Infusion'),undefined);
  const rookie=childTech('Biyomon',1,{...first,instanceId:'a'},techParent('b',[]));
  assert.deepEqual(potential(rookie,'Pepper Breath').unlock,{status:'pending',level:2});
});
test('pure DNA rejects mismatched actual rank and malformed parent metadata',()=>{
  const species=speciesLookup.getDigimonByName('Vademon');
  assert.throws(()=>inheritance.calculateDnaTechniqueState({speciesId:species.id,actualRank:'Champion',startingLevel:21},techParent('a',[]),techParent('b',[])),/actual DNA/);
  assert.throws(()=>childTech('Agumon',1,{...techParent('a',['Party Time']),techs:[]},techParent('b',[])),/parent technique/);
});
test('schema v5 persists pool and checkpoints; Battle and Digivolution Undo restore exactly',()=>{
  const undo=load('src/utils/runActionUndo.ts');const checkpoint=load('src/utils/runActionCheckpoint.ts');
  const run=evolutionRun();run.roster[0]={...run.roster[0],...childTech('Agumon',1)};
  assert.equal(storage.RUN_PLANNER_SCHEMA_VERSION,5);
  assert.equal(storage.saveRunPlannerData(envelope(run)),true);assert.deepEqual(storage.loadRunPlannerData(),envelope(run));
  assert.deepEqual(checkpoint.createRunActionCheckpoint(run).roster,run.roster);
  const evolved=recordRunDigivolution(freeze(run),run.starterInstanceId).run;
  assert.deepEqual(undo.undoLastAction(evolved).run.roster,run.roster);
  const battle=recording.recordRunBattle(evolved,normalBattle());
  assert.ok(battle.resolution.outcomes[0].learnedTechniques.includes('Party Time'));
  assert.deepEqual(undo.undoLastAction(battle.run).run.roster,evolved.roster);
  assert.equal(storage.saveRunPlannerData(envelope(battle.run)),true);
  assert.deepEqual(storage.loadRunPlannerData(),envelope(battle.run));
});
for(const [label,change] of [
  ['duplicate pool keys',s=>s.techniquePool.push(structuredClone(s.techniquePool[0]))],
  ['conflicting rank',s=>s.techniquePool[0].rank='Mega'],
  ['missing available label',s=>s.techs=[]],
  ['available missing pool',s=>s.techniquePool=[]],
  ['pending in techs',s=>s.techniquePool[0].unlock={status:'pending',level:2}],
  ['missed in techs',s=>s.techniquePool[0].unlock={status:'missed',level:2}],
  ['duplicate usable alias',s=>s.techs.push('pepper-breath')],
  ['incorrect unlock level',s=>{s.techs=[];s.techniquePool[0].unlock={status:'pending',level:12};}],
  ['missing provenance',s=>s.techniquePool[0].sources=[]],
  ['missing pool',s=>delete s.techniquePool],
])test(`schema v5 rejects ${label} in roster and checkpoints`,()=>{
  const run=createRunPlan('gold-hawk','Validation');change(run.roster[0]);
  assert.equal(inheritance.isValidTechniqueState(run.roster[0]),false);
  assert.ok(validateRunPlan(run).length>0);
  assert.equal(storage.saveRunPlannerData(envelope(run)),false);
  const cp=load('src/utils/runActionCheckpoint.ts');assert.equal(cp.isValidRunActionCheckpoint(cp.createRunActionCheckpoint(run)),false);
});
for(const [rank,level,name] of [['Rookie',1,'Agumon'],['Champion',11,'Greymon'],['Ultimate',21,'MetalGreymon'],['Mega',31,'WarGreymon']])test(`battle integration unlocks ${rank} batch and leaves no-level state untouched`,()=>{
  const names=progressionData.SPECIES_PROGRESSION.filter(r=>r.rank===rank && r.ownTechnique).slice(0,16).map(r=>r.ownTechnique);
  const state=childTech(name,level,techParent('a',names),techParent('b',[]));
  const member={...foundationMember(name,level),...state};
  const input={encounterId:1,digilineInstanceIds:[member.instanceId],roster:[member],totalBits:1030};
  let review;assert.throws(()=>battleFoundation.resolveBattle(freeze(input)),error=>{review=error.choices;return !!review;});
  const choice=review[0].choice;
  const keptKeys=choice.candidates.slice(-12).map(p=>p.key); // Explicit synthetic player choice.
  const resolved=battleFoundation.resolveBattle({...input,techniqueSelections:[{instanceId:member.instanceId,keptKeys}]});
  assert.equal(resolved.outcomes[0].newLevel,level+1);
  assert.deepEqual(resolved.outcomes[0].learnedTechniques,choice.candidates.filter(p=>keptKeys.includes(p.key) && choice.newlyUnlockedKeys.includes(p.key)).map(p=>p.name));
  assert.ok(inheritance.isValidTechniqueState(resolved.roster[0]));
  const capped={...member,levelCap:{min:level,max:level,resolved:level}};
  const unchanged=battleFoundation.resolveBattle({...input,roster:[capped]});
  assert.deepEqual(unchanged.outcomes[0].learnedTechniques,[]);
  assert.deepEqual(unchanged.roster[0].techniquePool,state.techniquePool);
});
test('normal Rookie progression never introduces a new own technique and null own is not invented',()=>{
  const empty={techs:[],techniquePool:[]};
  assert.deepEqual(inheritance.registerOwnTechnique(empty,speciesLookup.getDigimonByName('Agumon').id,1),empty);
  const species=progressionData.SPECIES_PROGRESSION.find(s=>s.ownTechnique===null);
  assert.deepEqual(inheritance.calculateDnaTechniqueState({speciesId:species.speciesId,actualRank:species.rank,startingLevel:1},techParent('a',[]),techParent('b',[])),empty);
});

// Corrected Phase 2G-B inheritance: only current possession propagates.
const withoutPossession=(state,name,unlock)=>{
  const next=structuredClone(state),key=techniqueMetadata.normalizeTechniqueName(name);
  next.techs=next.techs.filter(n=>techniqueMetadata.normalizeTechniqueName(n)!==key);
  potential(next,name).unlock=unlock;
  return next;
};
for(const [status,unlock] of [['pending',{status:'pending',level:12}],['missed',{status:'missed',level:12}],['discarded',{status:'discarded'}]]){
  test(`DNA excludes ${status} metadata even with inherited provenance`,()=>{
    const original=techParent('a',['Party Time','Spiral Twister']);
    const parent=withoutPossession(original,'Party Time',unlock);
    potential(parent,'Party Time').sources.push({type:'inherited',parentInstanceId:'earlier-generation'});
    assert.ok(inheritance.isValidTechniqueState(parent));
    const child=childTech('Agumon',1,freeze(parent),techParent('b',[]));
    assert.equal(potential(child,'Party Time'),undefined);
    assert.deepEqual(potential(child,'Spiral Twister').unlock,{status:'pending',level:2});
    assert.deepEqual(potential(parent,'Party Time').unlock,unlock);
  });
  test(`DNA rejects ${status} metadata appearing in current techs`,()=>{
    const parent=techParent('a',['Party Time']);potential(parent,'Party Time').unlock=unlock;
    assert.equal(inheritance.isValidTechniqueState(parent),false);
    assert.throws(()=>childTech('Agumon',1,parent,techParent('b',[])),/parent technique state/);
  });
}
for(const [name,level] of [['Vademon',21],['Yanmamon',11],['SandYanmamon',11]]){
  test(`${name} inherits only possessed techniques and independently creates its own potential`,()=>{
    let parent=techParent('a',['Spiral Twister','Party Time','Ninja Flower','Venom Infusion']);
    parent=withoutPossession(parent,'Party Time',{status:'missed',level:12});
    parent=withoutPossession(parent,'Ninja Flower',{status:'discarded'});
    parent=withoutPossession(parent,'Venom Infusion',{status:'pending',level:32});
    const child=childTech(name,level,parent,techParent('b',[]));
    assert.equal(child.techniquePool.length,2);
    assert.equal(potential(child,'Spiral Twister').unlock.status,'available');
    for(const label of ['Party Time','Ninja Flower','Venom Infusion'])assert.equal(potential(child,label),undefined);
    const own=progressionData.getSpeciesProgression(speciesLookup.getDigimonByName(name).id).ownTechnique;
    assert.deepEqual(potential(child,own).unlock,{status:'pending',level:level+1});
    assert.deepEqual(potential(child,own).sources,[{type:'own-species',speciesId:speciesLookup.getDigimonByName(name).id}]);
    assert.deepEqual(child,childTech(name,level,techParent('b',[]),parent));
  });
}
for(const [label,level] of [['Party Time',12],['Ninja Flower',22],['Venom Infusion',32]]){
  test(`${label} cannot propagate before EL${level}, but can after its actual battle unlock`,()=>{
    const first=childTech('Agumon',1,techParent('a',[label]),techParent('b',[]));
    assert.deepEqual(potential(first,label).unlock,{status:'pending',level});
    const before={...foundationMember('Agumon',level-1),...first,instanceId:'second-generation'};
    assert.equal(potential(childTech('Biyomon',1,before,techParent('other',[])),label),undefined);
    const battle=battleFoundation.resolveBattle({encounterId:1,digilineInstanceIds:[before.instanceId],roster:[freeze(before)],totalBits:1030});
    const learned=battle.roster[0];
    assert.equal(learned.level,level);assert.ok(learned.techs.includes(label));
    assert.deepEqual(potential(learned,label).unlock,{status:'available'});
    const third=childTech('Biyomon',1,learned,techParent('other',[]));
    assert.deepEqual(potential(third,label).unlock,{status:'pending',level});
    assert.deepEqual(potential(third,label).sources,[{type:'inherited',parentInstanceId:'second-generation'}]);
  });
}
test('DNA current labels resolve reviewed aliases through available pool metadata',()=>{
  const parent=techParent('a',['Blaze Blaster','FLer Cannon','Ninja FLer']);
  const child=childTech('Agumon',1,parent,techParent('b',['Blaze Buster']));
  for(const name of ['Blaze Buster','Flower Cannon','Ninja Flower'])assert.ok(potential(child,name));
  assert.deepEqual(potential(child,'Blaze Buster').sources,[{type:'inherited',parentInstanceId:'a'},{type:'inherited',parentInstanceId:'b'}]);
  assert.deepEqual(child,childTech('Agumon',1,techParent('b',['Blaze Buster']),parent));
});
test('child own technique is recreated independently of excluded parent discarded state',()=>{
  const parent=withoutPossession(techParent('a',['Pepper Breath']),'Pepper Breath',{status:'discarded'});
  const child=childTech('Agumon',1,parent,techParent('b',[]));
  assert.deepEqual(child.techs,['Pepper Breath']);
  assert.deepEqual(potential(child,'Pepper Breath').sources,[{type:'own-species',speciesId:speciesLookup.getDigimonByName('Agumon').id}]);
});
test('discarded former own techniques remain discarded through evolution and battle milestones',()=>{
  const own=progressionData.getSpeciesProgression(evolution.applyNormalDigivolution(foundationMember('Agumon',11)).speciesId).ownTechnique;
  const base=foundationMember('Agumon',11,{techs:['Pepper Breath',own]});
  const member=withoutPossession(base,own,{status:'discarded'});
  const evolved=evolution.applyNormalDigivolution(freeze(member));
  assert.equal(progressionData.getSpeciesProgression(evolved.speciesId).ownTechnique,own);
  assert.deepEqual(potential(evolved,own),potential(member,own));
  assert.deepEqual(evolution.getLearnedTechniques(evolved,12),[]);
  const battle=battleFoundation.resolveBattle({encounterId:1,digilineInstanceIds:[evolved.instanceId],roster:[evolved],totalBits:1030});
  assert.equal(battle.roster[0].level,12);
  assert.deepEqual(battle.outcomes[0].learnedTechniques,[]);
  assert.deepEqual(potential(battle.roster[0],own).unlock,{status:'discarded'});
  assert.equal(potential(childTech('Biyomon',1,battle.roster[0],techParent('b',[])),own),undefined);
});
test('schema v5 saves, loads and checkpoints discarded provenance exactly; Undo preserves it',()=>{
  const run=evolutionRun();
  run.roster[0]={...run.roster[0],...inheritance.createAvailableTechniqueState(['Pepper Breath','Party Time'],{type:'starter',speciesId:run.roster[0].speciesId})};
  run.roster[0]=withoutPossession(run.roster[0],'Party Time',{status:'discarded'});
  const original=structuredClone(run.roster[0].techniquePool);
  assert.equal(storage.isValidPersistedRunPlannerData(envelope(run)),true);
  assert.equal(storage.saveRunPlannerData(envelope(run)),true);
  assert.deepEqual(storage.loadRunPlannerData(),envelope(run));
  const checkpoint=load('src/utils/runActionCheckpoint.ts');
  const cp=checkpoint.createRunActionCheckpoint(run);
  assert.ok(checkpoint.isValidRunActionCheckpoint(cp));assert.deepEqual(cp.roster[0].techniquePool,original);
  const evolved=recordRunDigivolution(run,run.starterInstanceId).run;
  const undo=load('src/utils/runActionUndo.ts');
  assert.deepEqual(undo.undoLastAction(evolved).run.roster[0].techniquePool,original);
  const battle=recording.recordRunBattle(evolved,normalBattle()).run;
  assert.deepEqual(undo.undoLastAction(battle).run.roster,evolved.roster);
  assert.equal(storage.saveRunPlannerData(envelope(battle)),true);
  assert.deepEqual(storage.loadRunPlannerData(),envelope(battle));
});
test('storage rejects discarded entries in techs or with invalid level metadata',()=>{
  for(const inTechs of [true,false]){
    const run=createRunPlan('gold-hawk','Invalid discarded');
    if(inTechs)run.roster[0].techniquePool[0].unlock={status:'discarded'};
    else {run.roster[0].techs=[];run.roster[0].techniquePool[0].unlock={status:'discarded',level:2};}
    assert.equal(storage.saveRunPlannerData(envelope(run)),false);
    assert.ok(validateRunPlan(run).length>0);
    const cp=load('src/utils/runActionCheckpoint.ts');
    assert.equal(cp.isValidRunActionCheckpoint(cp.createRunActionCheckpoint(run)),false);
  }
});

// Phase 2G-C: capacity candidates are not committed roster state.
const capacity=load('src/utils/techniqueCapacity.ts');
const capacityTypes=load('src/types/techniqueCapacity.ts');
const battleChoices=load('src/utils/battleTechniqueChoices.ts');
const rookieNames=[...new Set(progressionData.SPECIES_PROGRESSION.filter(r=>r.rank==='Rookie'&&r.ownTechnique).map(r=>techniqueMetadata.getTechniqueIdentity(r.ownTechnique).name))];
const availableState=names=>inheritance.createAvailableTechniqueState(names,{type:'starter',speciesId:'agumon'});
const capacityRun=(name='Greymon',level=11,count=12)=>{
  const run=evolutionRun(name,level,{techs:rookieNames.slice(0,count)});
  return run;
};
const preflight=(run,reviewTechniques=false)=>{
  let review;assert.throws(()=>recording.recordRunBattle(freeze(run),{...normalBattle(),reviewTechniques}),error=>{
    assert.ok(error instanceof capacity.BattleTechniqueSelectionRequired);review=error.choices;return true;
  });return review;
};
const keepSelection=(review,keep)=>review.map(c=>({instanceId:c.instanceId,keptKeys:keep(c)}));
test('capacity is one authoritative 12-technique constant',()=>assert.equal(capacityTypes.MAX_TECHNIQUES,12));
for(const count of [12,13,24])test(`${count} candidates preserve all metadata and require choice only above capacity`,()=>{
  const state=freeze(availableState(rookieNames.slice(0,count)));const before=JSON.stringify(state);
  const choice=capacity.buildTechniqueChoice(state);
  assert.equal(choice.candidates.length,count);assert.equal(choice.selectionRequired,count>12);
  const result=capacity.resolveTechniqueChoice(choice);
  assert.equal(result.status,count>12?'selection-required':'resolved');
  if(count<=12)assert.deepEqual(result.techs,state.techs);
  else {assert.equal(result.choice.candidates.length,count);assert.equal('techs' in result,false);}
  assert.equal(JSON.stringify(state),before);
  assert.deepEqual(capacity.resolveTechniqueChoice(choice),result);
});
test('committed over-cap rosters and checkpoints are rejected by schema v5',()=>{
  const run=capacityRun('Greymon',11,13);
  assert.ok(validateRunPlan(run).some(v=>v.code==='roster-technique-capacity'));
  assert.equal(storage.saveRunPlannerData(envelope(run)),false);
  const checkpoints=load('src/utils/runActionCheckpoint.ts');
  assert.equal(checkpoints.isValidRunActionCheckpoint(checkpoints.createRunActionCheckpoint(run)),false);
  assert.equal(storage.RUN_PLANNER_SCHEMA_VERSION,5);
});
test('canonical aliases occupy one candidate slot',()=>{
  const state=availableState(['Blaze Blaster','Blaze Buster','FLer Cannon','Flower Cannon']);
  const choice=capacity.buildTechniqueChoice(state);
  assert.equal(choice.candidates.length,2);assert.equal(capacity.resolveTechniqueChoice(choice).techs.length,2);
});
for(const keptCount of [0,1,2])test(`optional choice may retain ${keptCount} of 2 candidates without imposing a minimum`,()=>{
  const state=availableState(rookieNames.slice(0,2)),choice=capacity.buildTechniqueChoice(state,[rookieNames[1]]);
  const selected=choice.candidates.slice(0,keptCount).map(p=>p.key);
  const result=capacity.resolveTechniqueChoice(freeze(choice),selected);
  assert.equal(result.status,'resolved');assert.equal(result.techs.length,keptCount);
  assert.equal(result.discarded.length,2-keptCount);assert.ok(inheritance.isValidTechniqueState(result));
  for(const p of result.techniquePool)assert.deepEqual(p.sources,state.techniquePool.find(q=>q.key===p.key).sources);
});
for(const invalid of [['missing-key'],['pepperbreath','pepperbreath'],rookieNames.slice(0,13).map(techniqueMetadata.normalizeTechniqueName)])test('invalid retention set is rejected: '+invalid.join(','),()=>{
  assert.throws(()=>capacity.resolveTechniqueChoice(capacity.buildTechniqueChoice(availableState(rookieNames.slice(0,14))),invalid),/unique candidate/);
});
test('no arbitrary deletion API is offered when nothing became learnable',()=>{
  const choice=capacity.buildTechniqueChoice(availableState(['Pepper Breath']),[]);
  assert.throws(()=>capacity.resolveTechniqueChoice(choice,[]),/learning opportunity/);
  assert.deepEqual(capacity.resolveTechniqueChoice(choice).techs,['Pepper Breath']);
  const run=createRunPlan('gold-hawk','No learning');
  assert.throws(()=>recording.recordRunBattle(run,{...normalBattle(),techniqueSelections:[{instanceId:run.starterInstanceId,keptKeys:[]}]}),/participant technique/);
});
test('11 possessed plus one own technique defaults to all 12 and audits learning',()=>{
  const run=capacityRun('Greymon',11,11),result=recording.recordRunBattle(run,normalBattle());
  assert.equal(result.run.roster[0].techs.length,12);
  const own=progressionData.getSpeciesProgression(run.roster[0].speciesId).ownTechnique;
  assert.deepEqual(result.event.techniqueChoices,[{instanceId:run.starterInstanceId,learned:[own],discarded:[]}]);
});
for(const [name,level] of [['Greymon',11],['MetalGreymon',21],['WarGreymon',31]]){
  for(const dropNew of [true,false])test(`${name} own milestone overflow lets player discard ${dropNew?'new':'old'} technique`,()=>{
    const run=capacityRun(name,level),before=JSON.stringify(run),review=preflight(run);
    assert.equal(review[0].choice.candidates.length,13);
    const newly=review[0].choice.newlyUnlockedKeys[0],old=review[0].choice.candidates.find(p=>p.key!==newly).key;
    const dropped=dropNew?newly:old;
    const choices=keepSelection(review,c=>c.choice.candidates.filter(p=>p.key!==dropped).map(p=>p.key));
    const next=recording.recordRunBattle(run,{...normalBattle(),techniqueSelections:choices});
    assert.equal(JSON.stringify(run),before);assert.equal(next.run.roster[0].techs.length,12);
    assert.deepEqual(next.run.roster[0].techniquePool.find(p=>p.key===dropped).unlock,{status:'discarded'});
    assert.equal(next.event.techniqueChoices[0].learned.length,dropNew?0:1);
    assert.equal(next.event.techniqueChoices[0].discarded.length,1);
    const own=potential(next.run.roster[0],progressionData.getSpeciesProgression(run.roster[0].speciesId).ownTechnique);
    if(dropNew)assert.equal(own.unlock.status,'discarded');
    assert.equal(storage.saveRunPlannerData(envelope(next.run)),true);assert.deepEqual(storage.loadRunPlannerData(),envelope(next.run));
    assert.deepEqual(load('src/utils/runActionUndo.ts').undoLastAction(next.run).run.roster,run.roster);
  });
}
test('multiple participant preflight and selections are atomic, including partial choices',()=>{
  const run=capacityRun();run.roster.push({...capacityRun('MetalGreymon',21).roster[0],instanceId:'second'});run.digiline.push('second');
  const original=JSON.stringify(run),review=preflight(run);assert.equal(review.length,2);
  const selections=keepSelection(review,c=>c.choice.candidates.slice(-12).map(p=>p.key));
  assert.throws(()=>recording.recordRunBattle(run,{...normalBattle(),techniqueSelections:selections.slice(0,1)}),capacity.BattleTechniqueSelectionRequired);
  assert.equal(JSON.stringify(run),original);assert.equal(run.history.length,0);assert.equal(run.totalBits,1030);
  const recorded=recording.recordRunBattle(run,{...normalBattle(),techniqueSelections:selections});
  assert.equal(recorded.run.history.length,1);assert.equal(recorded.event.techniqueChoices.length,2);
  assert.ok(recorded.run.roster.every(r=>r.techs.length===12));assert.deepEqual(recorded.run.roster.map(r=>r.level),[12,22]);
});
test('voluntary non-overflow review discards old techniques and prevents subsequent DNA inheritance',()=>{
  const run=capacityRun('Greymon',11,2),review=preflight(run,true);
  assert.equal(review[0].choice.selectionRequired,false);
  const old=review[0].choice.candidates[0];
  const choices=keepSelection(review,c=>c.choice.candidates.filter(p=>p.key!==old.key).map(p=>p.key));
  const recorded=recording.recordRunBattle(run,{...normalBattle(),techniqueSelections:choices});
  const parent=recorded.run.roster[0];assert.deepEqual(potential(parent,old.name).unlock,{status:'discarded'});
  const child=childTech('Biyomon',1,parent,techParent('b',[]));assert.equal(potential(child,old.name),undefined);
  const retained=parent.techs.find(n=>n!==progressionData.getSpeciesProgression(parent.speciesId).ownTechnique);
  assert.ok(potential(child,retained));
  const later=inheritance.advanceTechniqueState(parent,12,13);assert.deepEqual(potential(later,old.name).unlock,{status:'discarded'});
});
test('future DNA composition requires choice for 24 immediate candidates and resolves exactly 12',()=>{
  const a=foundationMember('MetalGreymon',49,{instanceId:'a',techs:rookieNames.slice(0,12)});
  const b=foundationMember('MetalGreymon',49,{instanceId:'b',techs:rookieNames.slice(12,24)});
  const p=dnaPreview(a,b);assert.equal(p.status,'success');
  const state=inheritance.calculateDnaTechniqueState({speciesId:p.actualResultSpeciesId,actualRank:p.actualResultRank,startingLevel:p.startingLevel},a,b);
  assert.equal(state.techs.length,24);
  const choice=capacity.buildTechniqueChoice(state);assert.equal(capacity.resolveTechniqueChoice(choice).status,'selection-required');
  const selected=choice.candidates.filter((p,i)=>i%2===0).map(p=>p.key);
  const final=capacity.resolveTechniqueChoice(choice,selected);
  assert.equal(final.techs.length,12);assert.equal(final.discarded.length,12);
  assert.ok(inheritance.isValidTechniqueState(final));
});
test('deferred DNA EL2 overflow exposes 25 candidates before any recorded level-up',()=>{
  const names=rookieNames.filter(n=>n!=='Spiral Twister');
  const a=foundationMember('AeroVeedramon',49,{instanceId:'a',techs:names.slice(0,12)});
  const b=foundationMember('Airdramon',49,{instanceId:'b',techs:names.slice(12,24)});
  const p=dnaPreview(a,b);assert.equal(p.actualResultName,'Biyomon');
  const state=inheritance.calculateDnaTechniqueState({speciesId:p.actualResultSpeciesId,actualRank:p.actualResultRank,startingLevel:p.startingLevel},a,b);
  assert.equal(state.techs.length,1);
  const run=evolutionRun('Biyomon',1);Object.assign(run.roster[0],state);
  const review=preflight(run);assert.equal(review[0].choice.candidates.length,25);assert.equal(review[0].choice.newlyUnlockedKeys.length,24);
  assert.equal(run.roster[0].level,1);assert.equal(run.history.length,0);
  const result=recording.recordRunBattle(run,{...normalBattle(),techniqueSelections:keepSelection(review,c=>c.choice.candidates.slice(-12).map(p=>p.key))});
  assert.equal(result.run.roster[0].level,2);assert.equal(result.run.roster[0].techs.length,12);
});
test('choice candidates exclude other pending, missed and discarded potentials',()=>{
  let state=childTech('Agumon',1,techParent('a',['Spiral Twister','Party Time','Venom Infusion']),techParent('b',[]));
  potential(state,'Party Time').unlock={status:'missed',level:12};potential(state,'Venom Infusion').unlock={status:'discarded'};
  const advanced=inheritance.advanceTechniqueState(state,1,2),choice=capacity.buildTechniqueChoice(advanced,advanced.learnedTechniques);
  assert.deepEqual(choice.candidates.map(p=>p.name).sort(),['Pepper Breath','Spiral Twister']);
  const result=capacity.resolveTechniqueChoice(choice,[]);
  assert.equal(potential(result,'Party Time').unlock.status,'missed');assert.equal(potential(result,'Venom Infusion').unlock.status,'discarded');
});
for(const mutation of [e=>e.techniqueChoices=[],e=>e.techniqueChoices[0].learned.push('Invented'),e=>e.techniqueChoices[0].discarded.push('Invented'),e=>e.techniqueChoices[0].instanceId='missing'])test('battle choice audit tampering is rejected',()=>{
  const result=recording.recordRunBattle(capacityRun('Greymon',11,11),normalBattle());mutation(result.event);
  assert.equal(storage.saveRunPlannerData(envelope(result.run)),false);
});
test('hook leaves run/storage untouched until choices resolve; failed save and stale choice are atomic',()=>{
  const run=capacityRun();storage.saveRunPlannerData(envelope(run));const render=plannerHost(),planner=render();const serialized=values.get(storage.RUN_PLANNER_STORAGE_KEY);
  const review=planner.recordBattle(normalBattle());assert.equal(review.status,'selection-required');
  assert.deepEqual(render().activeRun,run);assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY),serialized);
  const request={...normalBattle(),expectedRunState:review.expectedRunState,techniqueSelections:keepSelection(review.choices,c=>c.choice.candidates.slice(-12).map(p=>p.key))};
  const save=global.localStorage.setItem;global.localStorage.setItem=()=>{throw Error('quota');};
  assert.equal(planner.recordBattle(request),null);assert.deepEqual(render().activeRun,run);
  global.localStorage.setItem=save;assert.ok(planner.recordBattle(request));assert.equal(render().activeRun.history.length,1);
  assert.equal(planner.recordBattle(request),null);assert.equal(render().activeRun.history.length,1);
});
test('mandatory choice controls start over capacity and never choose twelve automatically',()=>{
  const run=capacityRun(),review=preflight(run);let selected=keepSelection(review,c=>c.choice.candidates.map(p=>p.key));let confirmations=0,cancellations=0;
  const Controls=load('src/components/run-planner/TechniqueChoiceControls.tsx').TechniqueChoiceControls;
  const render=()=>Controls({choices:review,selections:selected,onChange:v=>selected=v,onConfirm:()=>confirmations++,onCancel:()=>cancellations++});
  let tree=render();assert.ok(elementText(tree).includes('13 / 12 selected'));
  assert.equal(elements(tree).find(e=>e.props.children==='Confirm choices and record battle').props.disabled,true);
  elements(tree).find(e=>e.type==='input').props.onChange({target:{checked:false}});
  tree=render();assert.equal(elements(tree).find(e=>e.props.children==='Confirm choices and record battle').props.disabled,false);
  elements(tree).find(e=>e.props.children==='Confirm choices and record battle').props.onClick();assert.equal(confirmations,1);
  elements(tree).find(e=>e.props.children==='Cancel technique selection').props.onClick();assert.equal(cancellations,1);
});
test('battle controls route overflow through selection, freeze capture request, and commit only on confirm',()=>{
  const run=capacityRun();storage.saveRunPlannerData(envelope(run));const hook=plannerHost(),planner=hook();
  const render=componentHost('src/components/run-planner/BattleRecordControls.tsx','BattleRecordControls');
  const props={selection:normalBattle(),hasParticipants:true,onRecord:planner.recordBattle};
  let tree=render(props);elements(tree).find(e=>e.props.children==='Record Battle').props.onClick();
  tree=render(props);const choiceElement=elements(tree).find(e=>e.type?.name==='TechniqueChoiceControls');assert.ok(choiceElement);
  assert.equal(hook().activeRun.history.length,0);
  const selected=keepSelection(choiceElement.props.choices,c=>c.choice.candidates.slice(-12).map(p=>p.key));choiceElement.props.onChange(selected);
  tree=render(props);elements(tree).find(e=>e.type?.name==='TechniqueChoiceControls').props.onConfirm();
  assert.equal(hook().activeRun.history.length,1);assert.ok(elementText(render(props)).includes('Battle recorded'));
});
test('optional review is exposed in battle UI and defaults all candidates selected',()=>{
  const run=capacityRun('Greymon',11,2);storage.saveRunPlannerData(envelope(run));const hook=plannerHost(),planner=hook();
  const render=componentHost('src/components/run-planner/BattleRecordControls.tsx','BattleRecordControls');const props={selection:normalBattle(),hasParticipants:true,onRecord:planner.recordBattle};
  elements(render(props)).find(e=>e.props.children==='Review techniques before recording').props.onClick();
  const choices=elements(render(props)).find(e=>e.type?.name==='TechniqueChoiceControls');assert.ok(choices);
  assert.equal(choices.props.selections[0].keptKeys.length,3);assert.equal(hook().activeRun.history.length,0);
  choices.props.onChange(choices.props.selections.map(s=>({...s,keptKeys:[]})));
  elements(render(props)).find(e=>e.type?.name==='TechniqueChoiceControls').props.onConfirm();
  assert.deepEqual(hook().activeRun.roster[0].techs,[]);
});
