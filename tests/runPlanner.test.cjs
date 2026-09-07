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
    assert.equal(invalid.battles.length,0);
    assert.equal(invalid.totalBits,0);
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
  assert.equal(next.battles.length,1);
  assert.equal(event.xpReward,reward.xp);
  assert.equal(event.bitsReward,reward.bits);
  assert.deepEqual(event.digilineInstanceIds,run.digiline);
  assert.deepEqual(run.battles,[]);
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
  run.roster[0] = {...run.roster[0],level:30,totalXp:xpHelpers.getRequiredTotalXpForLevel(30)};
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
  assert.deepEqual(second.run.battles[0],snapshot);
  assert.notEqual(second.event.id,first.event.id);
  assert.deepEqual(second.run.battles.map(e => e.order),[0,1]);
  assert.equal(second.event.phase,before);
  assert.equal(second.event.floor,1);
  assert.deepEqual(snapshot.digilineInstanceIds,[run.starterInstanceId,'reserve-b','reserve-a']);
  assert.equal(second.run.totalBits,first.event.bitsReward*2);
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
  assert.equal(recording.recordRunBattle(multiRun(),boss).run.battles.length,1);
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
    assert.equal(result.run.battles.length,1);
    assert.equal(result.run.totalBits,0);
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
  assert.equal(next.run.battles.length,3);
});
test('old history without location extensions loads, invalid new location fields reject', () => {
  const recorded = recording.recordRunBattle(multiRun(),normalBattle()).run;
  const legacy = structuredClone(recorded);
  delete legacy.battles[0].phase;
  delete legacy.battles[0].floor;
  assert.equal(storage.saveRunPlannerData(envelope(legacy)),true);
  assert.deepEqual(storage.loadRunPlannerData().runs[0],legacy);
  for (const extension of [{phase:'unknown'},{floor:0},{floor:1.5}]) {
    const invalid = {...recorded,battles:[{...recorded.battles[0],...extension}]};
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
  assert.equal(render().activeRun.battles.length,1);
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
  assert.equal(run.battles.length,2);
  assert.deepEqual(run.battles[0].digilineInstanceIds,[run.starterInstanceId,'reserve-a']);
  assert.deepEqual(run.battles[1].digilineInstanceIds,run.battles[0].digilineInstanceIds);
  assert.equal(run.totalBits,run.battles[0].bitsReward*2);
});

const undo = load('src/utils/runBattleUndo.ts');
const meaningfulRun = ({updatedAt, ...run}) => run;
const restoredRun = (run) => {
  const result = undo.undoLastBattle(run);
  assert.equal(result.ok,true,result.reason);
  return result.run;
};
test('new event checkpoint is the complete pre-battle state with no recursive history', () => {
  const run = freeze(fullRun());
  const recorded = recording.recordRunBattle(run,{...normalBattle(),capturedEnemySlot:1});
  assert.deepEqual(recorded.event.checkpoint,{roster:run.roster,digiline:run.digiline,totalBits:run.totalBits});
  assert.deepEqual(Object.keys(recorded.event.checkpoint).sort(),['digiline','roster','totalBits']);
  assert.notEqual(recorded.event.checkpoint.roster,run.roster);
  assert.notEqual(recorded.event.checkpoint.digiline,run.digiline);
  for (let i=0;i<run.roster.length;i++) {
    assert.notEqual(recorded.event.checkpoint.roster[i],run.roster[i]);
    for (const field of ['stats','techs','source']) {
      assert.notEqual(recorded.event.checkpoint.roster[i][field],run.roster[i][field]);
      assert.notEqual(recorded.event.checkpoint.roster[i][field],recorded.run.roster[i][field]);
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
  assert.equal(recorded.battles[0].checkpoint.roster[0].stats.hp,before.roster[0].stats.hp);
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
    const previousHistory=current.battles.slice(0,-1);
    current=restoredRun(current);
    assert.deepEqual(current.battles,previousHistory);
    assert.deepEqual(meaningfulRun(current),meaningfulRun(states[i]));
  }
  assert.equal(undo.undoLastBattle(current).ok,false);
});
test('legacy saves remain loadable and repeated undo stops at their boundary', () => {
  const legacy=recording.recordRunBattle(multiRun(),normalBattle()).run;
  delete legacy.battles[0].checkpoint;
  assert.equal(storage.saveRunPlannerData(envelope(legacy)),true);
  assert.deepEqual(storage.loadRunPlannerData().runs[0],legacy);
  assert.match(undo.undoLastBattle(legacy).reason,/predates Undo checkpoints/);
  let current=recording.recordRunBattle(legacy,normalBattle()).run;
  current=recording.recordRunBattle(current,normalBattle()).run;
  current=restoredRun(restoredRun(current));
  assert.deepEqual(meaningfulRun(current),meaningfulRun(legacy));
  assert.match(undo.undoLastBattle(current).reason,/predates Undo checkpoints/);
});
test('empty history reports Undo unavailable', () => {
  assert.deepEqual(undo.undoLastBattle(multiRun()),{ok:false,reason:'No battles recorded yet.'});
});
test('malformed checkpoint structures and references are rejected without altering input', () => {
  const run=recording.recordRunBattle(multiRun(),normalBattle()).run;
  const valid=run.battles[0].checkpoint;
  const bad=[null,{}, {...valid,roster:null}, {...valid,totalBits:-1}, {...valid,totalBits:Infinity},
    {...valid,digiline:['missing']}, {...valid,digiline:[valid.digiline[0],valid.digiline[0]]},
    {...valid,digiline:valid.roster.map(r => r.instanceId)},
    {...valid,roster:[valid.roster[0],valid.roster[0]]}, {...valid,battles:[]}, {...valid,checkpoint:valid}];
  for (const change of [{stats:{hp:1}}, {techs:[1]}, {level:0}, {totalXp:NaN}, {source:null}, {instanceId:''}, {speciesId:''}, {name:null}]) {
    bad.push({...valid,roster:[{...valid.roster[0],...change},...valid.roster.slice(1)]});
  }
  for(const checkpoint of bad) {
    const invalid=freeze({...run,battles:[{...run.battles[0],checkpoint}]});
    assert.equal(storage.isValidRunBattleCheckpoint(checkpoint),false);
    assert.equal(storage.saveRunPlannerData(envelope(invalid)),false);
    const result=undo.undoLastBattle(invalid);
    assert.equal(result.ok,false);
    assert.match(result.reason,/Invalid checkpoint/);
    assert.equal(invalid.battles.length,1);
  }
});
test('checkpoint missing a starter required by the run cannot be applied', () => {
  const run=recording.recordRunBattle(multiRun(),normalBattle()).run;
  run.battles[0].checkpoint={roster:[],digiline:[],totalBits:0};
  assert.equal(undo.undoLastBattle(run).ok,false);
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
  const oldId=run.battles[2].id;
  const next=recording.recordRunBattle(restoredRun(run),{...normalBattle(),encounterId:31}).run;
  assert.deepEqual(next.battles.map(b => b.order),[0,1,2]);
  assert.notEqual(next.battles[2].id,oldId);
  assert.equal(new Set(next.battles.map(b => b.id)).size,3);
  assert.deepEqual(next.battles.slice(0,2),run.battles.slice(0,2));
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
  assert.equal(planner.undoBattle(recorded.battles[0].id),false);
  assert.deepEqual(render().activeRun,recorded);
  assert.equal(render().undoRevision,0);
  assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY),raw);
  assert.match(render().error,/Could not save/);
  global.localStorage.setItem=save;
  assert.equal(render().undoBattle(recorded.battles[0].id),true);
  assert.deepEqual(meaningfulRun(render().activeRun),meaningfulRun(before));
  assert.equal(render().undoRevision,1);
  assert.equal(render().error,null);
});
test('stale confirmation cannot undo a different battle or another saved run', () => {
  const first=recording.recordRunBattle(multiRun(),normalBattle()).run;
  const other=createRunPlan('blue-falcon','Other');
  storage.saveRunPlannerData({schemaVersion:1,runs:[first,other],activeRunId:first.id});
  const render=plannerHost(); const planner=render();
  planner.recordBattle(normalBattle());
  assert.equal(planner.undoBattle(first.battles[0].id),false);
  const latest=render().activeRun;
  assert.equal(planner.undoBattle(latest.battles[1].id),true);
  assert.deepEqual(render().data.runs[1],other);
  render().loadRun(other.id);
  assert.equal(planner.undoBattle(first.battles[0].id),false);
});
