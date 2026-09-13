const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./helpers/loadTs.cjs');
const d = load('src/utils/battleSkillDecoder.ts');
const b = load('src/data/battleSkills.ts');
const v = load('src/utils/battleSkillValidation.ts');
const { WAZADATA_RECORDS, SKILL_EFFECT_SOURCE } = load('src/data/wazaSource.ts');
const { TECHS } = load('src/data/techs.ts');
const { getTechByName } = load('src/utils/techLookup.ts');
const { requireEncounterTech, requireEncounterTechs } = load('src/utils/encounterBattleSkills.ts');
const { toLegacyTech } = load('src/utils/battleSkillCompatibility.ts');
const flags = (changes = {}) => Object.fromEntries(d.EFFECT_BYTES.map(byte => [byte, changes[byte] ?? 0]));
const effects = changes => d.decodeEffectFlags(flags(changes));
const raw = (changes = {}) => {
  const bytes = Array(68).fill(0); bytes[0] = 1; bytes[2] = 0x50; bytes[3] = 5; bytes[32] = 1;
  for (const [byte, value] of Object.entries(changes)) bytes[Number(byte) - 1] = value;
  return { row: 999, label: 'Synthetic', bytes };
};

test('AP conversion is once, in displayed half-point units, including high byte', () => {
  assert.equal(d.internalApToDisplayed(30), 15);
  assert.equal(d.internalApToDisplayed(135), 67.5);
  assert.equal(d.normalizeWazaRecord(raw({ 9: 1, 10: 1 })).attackPower, 128.5);
  assert.equal(b.getBattleSkillByName('Poison Ivy').attackPower, 15);
  assert.equal(b.getBattleSkillByName('Rail Cannon').attackPower, 67.5);
  assert.throws(() => d.internalApToDisplayed(-1));
  assert.throws(() => d.internalApToDisplayed(1.5));
});
test('high-bit AP is preserved but signed healing/sentinel interpretation remains unresolved', () => {
  for (const word of [0xff6a, 0xffff, 0x8000]) {
    const s = d.normalizeWazaRecord(raw({ 9: word & 255, 10: word >> 8 }));
    assert.equal(s.attackPowerRaw, word); assert.equal(s.attackPower, null);
    assert.ok(s.issues.some(i => i.field === 'attackPower'));
  }
});
for (const [nibble, actionKind, animationKind] of [
  [0, 'attack', 'projectile'], [1, 'attack', 'magic'], [2, 'attack', 'physical'],
  [4, 'counter', 'projectile'], [5, 'counter', 'magic'], [6, 'counter', 'physical'],
  [8, 'interrupt', 'projectile'], [9, 'interrupt', 'magic'], [10, 'interrupt', 'physical'],
  [12, 'assist', 'projectile'], [13, 'assist', 'magic'],
]) test(`byte3 ${nibble.toString(16)} decodes ${actionKind}/${animationKind}`, () => {
  assert.deepEqual(d.decodeByte3(0x50 | nibble), { actionKind, animationKind, targetGroup: 'one-enemy' });
});
for (const [high, targetGroup] of [[0, 'self'], [1, 'one-ally'], [2, 'all-allies'], [5, 'one-enemy'], [6, 'all-enemies'], [8, 'field'], [9, 'interrupt-target']]) {
  test(`byte3 target ${targetGroup} is independent`, () => assert.equal(d.decodeByte3((high << 4) | 1).targetGroup, targetGroup));
}
test('unknown byte3 nibbles survive without inventing physical Assist', () => {
  assert.equal(d.decodeByte3(0x5e).actionKind, null);
  assert.equal(d.decodeByte3(0x30).targetGroup, null);
  assert.equal(d.normalizeWazaRecord(raw({ 3: 0x3e })).issues[0].field, 'byte3');
});
for (const [high, rank] of ['Rookie', 'Champion', 'Ultimate', 'Mega'].entries()) {
  test(`byte4 rank ${rank}`, () => assert.deepEqual(d.decodeByte4((high << 4) | 5), { rank, element: 'Neutral' }));
}
for (const [low, element] of ['Water', 'Fire', 'Nature', 'Machine', 'Darkness', 'Neutral'].entries()) {
  test(`byte4 element ${element}`, () => assert.deepEqual(d.decodeByte4(0x20 | low), { rank: 'Ultimate', element }));
}
test('unknown byte4 nibbles stay independent and visible', () => {
  assert.deepEqual(d.decodeByte4(0x36), { rank: 'Mega', element: null });
  assert.deepEqual(d.decodeByte4(0x45), { rank: null, element: 'Neutral' });
});
test('MP byte5 is imported, including zero and 255', () => {
  assert.equal(d.normalizeWazaRecord(raw({ 5: 255 })).mpCost, 255);
  assert.equal(d.normalizeWazaRecord(raw({ 5: 0 })).mpCost, 0);
  assert.equal(b.getBattleSkillByName('Poison Ivy').mpCost, 8);
});
test('combined protection flags decode independently without duplicate composite effects', () => {
  assert.deepEqual(effects({ 17: 3 }).map(e => e.against), ['counter', 'interrupt']);
  assert.equal(effects({ 17: 0x0b }).length, 3);
});
for (const [byte, low, status] of [[25, 1, 'poison'], [25, 0x10, 'paralysis'], [26, 1, 'confusion']]) {
  for (const [factor, chance, condition] of [[1, 33, 'always'], [2, 66, 'always'], [4, 100, 'counter-triggered']]) {
    test(`${status} ${chance}% ${condition}`, () => {
      const [e] = effects({ [byte]: low * factor });
      assert.equal(e.kind, 'status-application'); assert.equal(e.status, status);
      assert.equal(e.chancePercent, chance); assert.equal(e.condition, condition);
    });
  }
}
test('Interrupt paralysis and coexisting status chances are not collapsed', () => {
  const e = effects({ 25: 0x83 });
  assert.deepEqual(e.map(x => x.chancePercent), [33, 66, 100]);
  assert.equal(e[2].condition, 'interrupt-triggered'); assert.equal(e[2].sourceAlias, 'stun');
});
test('Motivation Down and Poison Body remain distinct from poison', () => {
  assert.deepEqual(effects({ 26: 0x90 }).map(e => e.status), ['motivation-down', 'poison-body']);
});
for (const [mask, status] of [[1, 'poison'], [2, 'paralysis'], [4, 'confusion'], [8, 'motivation-down']]) {
  test(`byte29 cure ${status}`, () => assert.equal(effects({ 29: mask })[0].status, status));
}
test('combined cures 07 and 0F are independent, separate from parameter reset', () => {
  assert.equal(effects({ 29: 7 }).length, 3);
  const e = effects({ 29: 15, 23: 0x0c });
  assert.equal(e.filter(x => x.kind === 'status-cure').length, 4);
  assert.equal(e.filter(x => x.kind === 'parameter-reset').length, 1);
});
for (const [mask, stat, direction] of [[4, 'atk', 'down'], [8, 'atk', 'up'], [0x10, 'def', 'down'], [0x20, 'def', 'up'], [0x40, 'spd', 'down'], [0x80, 'spd', 'up']]) {
  test(`byte22 ${stat} ${direction}`, () => {
    const [e] = effects({ 22: mask }); assert.equal(e.kind, 'parameter-modifier');
    assert.deepEqual(e.stats, [stat]); assert.equal(e.direction, direction);
  });
}
test('byte23 isolated 04/08 unresolved; conjunction with extra bits resets all', () => {
  for (const mask of [4, 8]) assert.equal(effects({ 23: mask })[0].reason, 'uncertain-source');
  const e = effects({ 23: 0x1c });
  assert.equal(e.filter(x => x.kind === 'parameter-reset').length, 1);
  assert.equal(e.find(x => x.kind === 'parameter-modifier').attribute, 'Vaccine');
  assert.equal(e.filter(x => x.kind === 'unresolved').length, 0);
});
for (const [index, power] of ['poison', 'Fire', 'Water', 'paralysis', 'confusion', 'Nature', 'Machine', 'Darkness'].entries()) {
  test(`byte27 temporary ${power} power is not an ailment`, () => {
    const [e] = effects({ 27: 1 << index }); assert.equal(e.kind, 'temporary-attack-power'); assert.equal(e.power, power);
  });
}
test('all temporary powers coexist', () => assert.equal(effects({ 27: 255 }).length, 8));
test('Zombie, Invisibility, Invincibility and recovery restrictions are separate', () => {
  const e = effects({ 28: 3, 31: 0x5a });
  assert.deepEqual(e.filter(x => x.kind === 'special-state').map(x => x.state), ['zombie', 'invisibility', 'invincibility']);
  assert.equal(e.filter(x => x.kind === 'recovery-restriction').length, 2);
  assert.equal(e.find(x => x.kind === 'recovery').mode, 'revive-full-heal');
});
test('Interrupt descriptors include exact chances, boss exclusion, reduction and turn end', () => {
  const e = effects({ 31: 0x80, 32: 0x2e }).filter(x => x.kind === 'interrupt-modifier');
  assert.deepEqual(e.map(x => x.modifier), ['cancel-action', 'reduce-action-damage', 'reduce-action-damage', 'force-miss', 'target-acts-last']);
  assert.equal(e[0].chancePercent, 87.5); assert.equal(e[0].excludesBosses, true);
  assert.equal(e[1].reductionPercent, 70.3125); assert.equal(e[2].reductionPercent, 39.84375);
  assert.equal(e[3].chancePercent, 66);
});
test('Counter descriptors combine returned damage, multiplier, payment, status, miss and targets', () => {
  const e = effects({ 17: 1, 18: 0x25, 19: 0x10, 25: 4, 33: 4 });
  assert.equal(e.filter(x => x.kind === 'damage-modifier').length, 2);
  assert.equal(e.find(x => x.kind === 'counter-payment').payer, 'enemy');
  assert.equal(e.find(x => x.kind === 'accuracy-modifier').modifier, 'miss-unless-counter');
  assert.equal(e.find(x => x.kind === 'status-application').condition, 'counter-triggered');
  assert.equal(e.find(x => x.kind === 'target-mode-modifier').mode, 'all-on-counter');
});
for (const [value, mode] of [[1, 'normal'], [2, 'random-digimon'], [4, 'all-on-counter']]) {
  test(`byte33 ${value} ${mode}`, () => assert.deepEqual(d.normalizeWazaRecord(raw({ 33: value })).targetModes, [mode]));
}
test('unknown and combined byte33 values preserve bits and report unsupported combinations', () => {
  const s = d.normalizeWazaRecord(raw({ 33: 0x83 }));
  assert.deepEqual(s.targetModes, ['normal', 'random-digimon']);
  assert.ok(s.issues.some(i => i.field === 'byte33'));
  assert.equal(s.effects.find(e => e.kind === 'unresolved').mask, 128);
  assert.ok(d.normalizeWazaRecord(raw({ 33: 0 })).issues.some(i => i.field === 'byte33'));
});
test('all undocumented bits of every effect byte survive decoder and export', () => {
  const r = raw(Object.fromEntries(d.EFFECT_BYTES.map(byte => [byte, 255])));
  const s = d.normalizeWazaRecord(r);
  assert.deepEqual(d.exportWazaBytes(s), r.bytes);
  for (const byte of d.EFFECT_BYTES) {
    const masks = s.effects.filter(e => e.byte === byte).reduce((mask, e) => mask | e.mask, 0);
    assert.equal(masks, 255, `byte ${byte}`);
  }
  r.bytes[19] = 0;
  assert.equal(s.provenance.bytes[19], 255, 'import makes a snapshot');
});
test('invalid lengths and bytes fail loudly, including missing effect bytes', () => {
  assert.throws(() => d.normalizeWazaRecord({ ...raw(), bytes: [0] }));
  for (const bad of [-1, 256, 0.5, NaN]) assert.throws(() => d.normalizeWazaRecord(raw({ 17: bad })));
  assert.throws(() => d.decodeEffectFlags({}));
});
test('ID uses bytes1-2 and blank records are not discarded', () => {
  assert.equal(d.normalizeWazaRecord(raw({ 1: 3, 2: 1 })).id, 259);
  assert.equal(b.getBattleSkillById(259).name, 'Antidote');
  assert.equal(b.getBattleSkillByName('Antidote').id, 200);
  assert.equal(b.BATTLE_SKILLS.length, 256);
  assert.equal(b.BATTLE_SKILLS.filter(s => s.name === null).length, 39);
});
test('duplicate IDs and canonical technique names are rejected, item names may overlap', () => {
  assert.ok(v.validateWazaRecords([raw(), raw()]).some(e => e.includes('Duplicate')));
  assert.ok(v.validateWazaRecords([raw(), raw({ 1: 2 })]).some(e => e.includes('Ambiguous')));
  assert.deepEqual(v.validateWazaRecords(WAZADATA_RECORDS), []);
});
test('reviewed aliases, punctuation and reversed source labels resolve conservatively', () => {
  for (const [alias, canonical] of [['Blaze Buster', 'Blaze Blaster'], ['FLer Cannon', 'Flower Cannon'], ['Ninja FLer', 'Ninja Flower'], ['Destabilizer Ray', 'Destablizer Ray'], ['SubzeroIcePunch', 'SubZero Ice Punch'], ['Trihorn Attack', 'Tri-Horn Attack']]) {
    assert.equal(b.getBattleSkillByName(alias).id, b.getBattleSkillByName(canonical).id);
  }
  assert.equal(b.getBattleSkillByName('Giga Scissor Claw').id, 0xa3);
  assert.equal(b.getBattleSkillByName('Blind Attack').id, 0xdd);
  assert.equal(b.getBattleSkillByName('Nature Hit Ray').id, 0xc4);
  assert.equal(getTechByName('FLer Cannon').name, 'Flower Cannon');
});
test('no fuzzy matching or guessing explicitly uncertain identities', () => {
  for (const name of ['Peper Breath', 'Poison Iv', 'Alias Fake', 'Alias Fake (?)', 'HP Disk 40 HP', 'unlisted']) assert.equal(b.getBattleSkillByName(name), undefined);
});
test('Planner and encounter coverage matches reviewed report with every unresolved occurrence', () => {
  const r = v.getBattleSkillCoverageReport();
  assert.deepEqual(r.planner, { total: 179, resolved: 179, unresolved: [] });
  assert.deepEqual(r.encounterLabels, { total: 196, resolved: 195, unresolved: ['Alias Fake'] });
  assert.deepEqual(r.encounterReferences.unresolved, [{ encounterId: 149, slot: 1, label: 'Alias Fake' }]);
  assert.deepEqual(r, JSON.parse(fs.readFileSync('docs/phase-2k-b/coverage.json', 'utf8')));
});
test('data preflight flags unresolved identities, unknown bytes and effects', () => {
  assert.equal(v.validateBattleSkillLabels(['Pepper Breath']).complete, true);
  for (const name of ['Alias Fake', 'Fantasmic Ray', 'HP Recovery', 'Black Pearl Shot', 'Pummel Whack', 'Necro Magic', 'SubZero Ice Punch']) assert.equal(v.validateBattleSkillLabels([name]).complete, false, name);
});
test('encounter lookup cannot become fake AP10 and normalizes safe variants', () => {
  assert.throws(() => requireEncounterTechs([]), /no technique data/);
  assert.throws(() => requireEncounterTech('No Such Skill'), /Unresolved authoritative/);
  assert.throws(() => requireEncounterTech('Alias Fake'), /Unresolved authoritative/);
  assert.equal(requireEncounterTech('HP Recovery').canonicalSkillId, 0xb5);
  assert.equal(requireEncounterTech('HP Recovery').ap, 0);
  assert.equal(requireEncounterTech('Rain Of Pollen').id, 'rain-of-pollen');
  assert.equal(requireEncounterTech('Trihorn Attack').id, 'tri-horn-attack');
});
test('actual simulator rejects unresolved and empty encounter techniques before damage', () => {
  const { runBattleSimulation } = load('src/utils/battleEngine.ts');
  for (const techs of [['Alias Fake'], ['Unlisted'], []]) {
    assert.throws(() => runBattleSimulation([], { digimons: [{ name: 'Agumon', hp: 50, mp: 10, atk: 10, def: 10, spd: 10, techs }] }, 'None', 1), /technique/i);
  }
});
test('existing simulator UI releases busy state and reports async data rejection', async () => {
  const React = require('react');
  const { toast } = require('sonner');
  const { BattleSimulation } = load('src/components/BattleSimulation.tsx');
  const original = { useState: React.useState, useMemo: React.useMemo, setTimeout: global.setTimeout, error: console.error, toast: toast.error };
  const states = [0, 'encounter', 149, null, 'none', 1, '', false];
  const busy = []; const messages = []; let cursor = 0; let scheduled;
  try {
    React.useState = initial => { const index = cursor++; return [states[index] ?? initial, value => { if (index === 7) busy.push(value); }]; };
    React.useMemo = fn => fn();
    global.setTimeout = fn => { scheduled = fn; return 1; };
    console.error = () => {};
    toast.error = (...args) => messages.push(args);
    const tree = BattleSimulation({ savedTeams: [[]], onSimulationComplete: () => assert.fail('Incomplete simulation must not return results') });
    const find = node => {
      if (!node || typeof node !== 'object') return undefined;
      if (node.props?.onClick) return node.props.onClick;
      const children = node.props?.children;
      for (const child of Array.isArray(children) ? children.flat(Infinity) : [children]) { const found = find(child); if (found) return found; }
    };
    await find(tree)();
    assert.equal(typeof scheduled, 'function'); scheduled();
    assert.deepEqual(busy, [true, false]);
    assert.equal(messages[0][0], 'Simulation unavailable');
  } finally {
    React.useState = original.useState; React.useMemo = original.useMemo;
    global.setTimeout = original.setTimeout; console.error = original.error; toast.error = original.toast;
  }
});
test('138 legacy UI identities preserved; mechanics derive from canonical bytes', () => {
  assert.equal(TECHS.length, 138); assert.equal(new Set(TECHS.map(t => t.id)).size, 138);
  for (const t of TECHS) {
    const s = b.getBattleSkillByName(t.name);
    assert.equal(t.ap, s.attackPower); assert.equal(t.isCounter, s.actionKind === 'counter');
    assert.deepEqual(t, toLegacyTech(s, t.id, t.name));
  }
  assert.equal(getTechByName('Beast King Fist').specialEffect.type, 'counterDamageMultiplier');
  assert.equal(getTechByName('Shadow Scythe').specialEffect, undefined);
  assert.equal(getTechByName('Smiley Warhead').specialEffect.type, 'counterApMultiplierAndTargetAll');
});
test('modded bytes change mechanics without name-based special cases', () => {
  const s = d.normalizeWazaRecord({ ...raw({ 17: 1, 3: 0x66, 4: 0x30, 5: 50, 9: 80 }), label: 'Any new mod skill' });
  const t = toLegacyTech(s, 'mod', 'Completely different display name');
  assert.equal(t.ap, 40); assert.equal(t.isCounter, true); assert.equal(t.element, 'Water');
  assert.equal(t.target, 'All'); assert.equal(t.specialEffect.type, 'noTriggerCounter');
  assert.equal(s.mpCost, 50);
});
test('full source provenance, timing absent and drift self-checks pass', () => {
  for (const s of b.BATTLE_SKILLS) { assert.equal('timing' in s, false); assert.equal(s.provenance.bytes.length, 68); }
  assert.equal(SKILL_EFFECT_SOURCE.length, 90);
  const failed = v.runBattleSkillSelfChecks().filter(c => !c.passed);
  assert.deepEqual(failed, []);
});
test('every documented flag has source evidence, including composite entries', () => {
  for (const source of SKILL_EFFECT_SOURCE) {
    const e = effects({ [source.byte]: source.mask });
    assert.ok(e.length > 0);
    assert.equal(e.reduce((mask, x) => mask | x.mask, 0), source.mask);
    assert.ok(e.every(x => x.sourceRow), `source row ${source.row}`);
  }
});
