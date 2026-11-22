const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, buildPlannerBattleAnalysisPreset } = require('./helpers/plannerAnalysisFixtures.cjs');
const { createRunPlan } = load('src/utils/runPlanCreation.ts');
const { getStarterById } = load('src/data/starters.ts');
const { getDigimonById } = load('src/utils/digimonLookup.ts');
const { DOMAIN_GROUPS } = load('src/data/domainGroups.ts');
const { encounters } = load('src/data/encounters.ts');
const { getCoreTowerGuardianEncounterId } = load('src/utils/coreTowerGuardian.ts');
const { getEncountersForFloor, getFloorsForDomain, getColiseumOptions } = load('src/utils/runBattleSelection.ts');
const { recordRunBattle, getCaptureChoices } = load('src/utils/runBattleRecording.ts');
const { COLISEUM_LOCATION, getColiseumBattle, validateColiseumBattles } = load('src/data/coliseumBattles.ts');
const { getPlannerBattleLabel } = load('src/utils/plannerBattleLabel.ts');
const location = { domainId: 'core-tower', phase: 'after-blood-knights', floor: 24 };
const options = starter => getEncountersForFloor(location.domainId, location.phase, 24, starter);

// Exercise the real selector at Floor 24 using only a React hook state fixture.
function renderSelector(run) {
  const fs = require('node:fs'), ts = require('typescript');
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/components/run-planner/BattleSelector.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const state = { ...location, encounterId: null };
  new Function('require', 'module', 'exports', source)(id => {
    if (id === 'react') return { useReducer: () => [state, () => {}], useState: () => ['after-file-island', () => {}] };
    if (id.startsWith('@/')) {
      const path = 'src/' + id.slice(2);
      return load(path + (fs.existsSync(path + '.ts') ? '.ts' : '.tsx'));
    }
    return require(id);
  }, mod, mod.exports);
  return mod.exports.BattleSelector({ run, hasParticipants: true, onRecord() {} });
}

test('Rank 8 order, canonical lineups and complete unique Coliseum set', () => {
  const rank8 = getColiseumOptions().filter(b => b.rank === 8);
  assert.deepEqual(rank8.map(b => [b.label, b.encounterId]), [['Rank 8-A', 176], ['Rank 8-B', 178], ['Rank 8-C', 177]]);
  assert.deepEqual(rank8.map(b => b.preview.encounter.digimons.map(d => d.name)), [
    ['AeroVeedramon', 'Garudamon', 'Mammothmon'], ['WaruMonzaemon', 'Megadramon', 'Tekkamon'], ['Deramon', 'Blossomon', 'Pumpkinmon'],
  ]);
  assert.deepEqual(validateColiseumBattles(), []);
  assert.deepEqual(getColiseumOptions().map(b => b.encounterId).sort((a, b) => a - b), Array.from({ length: 24 }, (_, i) => 158 + i));
});

for (const [id, label] of [[178, 'Rank 8-B'], [177, 'Rank 8-C']]) test('recorded Coliseum ID resolves corrected history and Analyze label: ' + id, () => {
  const { run, event } = recordRunBattle(createRunPlan('gold-hawk', 'History'), { ...COLISEUM_LOCATION, encounterId: id });
  const saved = JSON.stringify(run);
  assert.equal(getColiseumBattle(id).label, label);
  assert.equal(getPlannerBattleLabel(event), 'Coliseum · ' + label);
  const preset = buildPlannerBattleAnalysisPreset(run, event.id);
  assert.equal(getPlannerBattleLabel(preset.selectedBattle), 'Coliseum · ' + label);
  assert.deepEqual(preset.enemyTeam.map(e => e.digimon.name), encounters.find(e => e.id === id).digimons.map(e => e.name));
  assert.equal(JSON.stringify(run), saved);
});

test('one corrected Floor 24 anchor, normal Floor 17 preserved, no Floor 23', () => {
  const floors = getFloorsForDomain(location.domainId, location.phase);
  assert.ok(floors.includes(24));
  assert.ok(!floors.includes(23));
  const floor17 = getEncountersForFloor(location.domainId, location.phase, 17);
  assert.ok(floor17.length > 0);
  assert.ok(floor17.every(b => !b.isBoss && ![146, 148, 150].includes(b.encounterId)));
  const groups = DOMAIN_GROUPS.filter(g => g.domainId === location.domainId && g.floors.includes(24));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].groupId, 438);
  assert.equal(groups[0].isBoss, true);
  assert.equal(groups[0].resolution, 'contextual-correction');
});

test('context-free inspection is explicit and unknown starter fails closed', () => {
  assert.deepEqual(options().map(b => b.encounterId), [146, 148, 150]);
  assert.equal(getCoreTowerGuardianEncounterId('unknown'), undefined);
  assert.deepEqual(options('unknown'), []);
});

for (const [starterId, speciesName, type, id, name] of [
  ['gold-hawk', 'Agumon', 'Vaccine', 148, 'VaccineGuardian'],
  ['blue-falcon', 'Patamon', 'Data', 146, 'DataGuardian'],
  ['black-sword', 'DemiDevimon', 'Virus', 150, 'VirusGuardian'],
]) {
  test(starterId + ': canonical starter resolves exactly one unchanged Guardian boss', () => {
    const starter = getStarterById(starterId), species = getDigimonById(starter.speciesId);
    assert.equal(species.name, speciesName);
    assert.equal(species.type, type);
    assert.equal(getCoreTowerGuardianEncounterId(starterId), id);
    const choices = options(starterId);
    assert.deepEqual(choices.map(b => b.encounterId), [id]);
    assert.equal(choices[0].isBoss, true);
    assert.deepEqual(choices[0].groupIds, [438]);
    const enemy = choices[0].preview.encounter.digimons[0];
    assert.equal(enemy.name, name);
    assert.equal(enemy.level, 31);
    assert.deepEqual([enemy.hp, enemy.mp, enemy.atk, enemy.def, enemy.spd], [897, 804, 144, 141, 76]);
    assert.deepEqual(getCaptureChoices({ ...location, encounterId: id }), []);
    const { nodes } = require('./helpers/componentHost.cjs');
    const tree = renderSelector(createRunPlan(starterId, 'Selector'));
    const labels = nodes(tree).filter(n => n.props?.htmlFor?.startsWith('battle-encounter-'));
    assert.deepEqual(labels.map(n => n.props.htmlFor), ['battle-encounter-' + id]);
    const text = JSON.stringify(labels[0]);
    assert.ok(text.includes(name + ' EL 31'));
    assert.ok(text.includes('Boss'));
  });

  test(starterId + ': recording validates starter, location, boss capture and historical Analyze', () => {
    const initial = createRunPlan(starterId, 'Guardian'), request = { ...location, encounterId: id };
    for (const wrong of [146, 148, 150].filter(value => value !== id)) {
      assert.throws(() => recordRunBattle(initial, { ...request, encounterId: wrong }), /valid Domain/);
    }
    assert.throws(() => recordRunBattle(initial, { ...request, floor: 17 }), /valid Domain/);
    assert.throws(() => recordRunBattle(initial, { ...request, floor: 23 }), /valid Domain/);
    assert.throws(() => recordRunBattle(initial, { ...request, capturedEnemySlot: 1 }), /Boss/);
    const { run, event } = recordRunBattle(initial, request);
    assert.deepEqual([event.domainId, event.phase, event.floor, event.encounterId], ['core-tower', 'after-blood-knights', 24, id]);
    const saved = JSON.stringify(run);
    const preset = buildPlannerBattleAnalysisPreset(run, event.id);
    assert.equal(preset.source.encounterId, id);
    assert.equal(preset.enemyTeam.length, 1);
    assert.equal(preset.enemyTeam[0].isBoss, true);
    assert.deepEqual(preset.enemyTeam[0].customStats, { hp: 897, mp: 804, atk: 144, def: 141, spd: 76 });
    // The canonical Simulator species uses Guardian-* aliases; encounter ID and stats are authoritative.
    assert.equal(JSON.stringify(run), saved);
    const changedCurrent = { ...run, roster: [], digiline: [] };
    assert.deepEqual(buildPlannerBattleAnalysisPreset(changedCurrent, event.id).enemyTeam, preset.enemyTeam);
  });
}

test('generic Guardian inspection cannot submit without a Run', () => {
  const { host, button, nodes } = require('./helpers/componentHost.cjs');
  const labels = nodes(renderSelector()).filter(n => n.props?.htmlFor?.startsWith('battle-encounter-'));
  assert.equal(labels.length, 3);
  const render = host('src/components/run-planner/BattleRecordControls.tsx', 'BattleRecordControls');
  const tree = render({ selection: { ...location, encounterId: 148 }, hasParticipants: true, onRecord() { throw Error('unexpected submission'); } });
  assert.ok(JSON.stringify(tree).includes('Select a Run'));
  const recordButton = nodes(tree).find(n => n.props?.onClick && n.props?.disabled === true);
  assert.ok(recordButton);
});
