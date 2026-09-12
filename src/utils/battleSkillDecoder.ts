import type {
  ActionKind, AnimationKind, BattleSkillDefinition, EffectByte, EffectFlags,
  RawWazaRecord, SkillDataIssue, SkillEffectDefinition, SkillElement, SkillRank, TargetGroup,
} from '@/types/battleSkill';
import { SKILL_EFFECT_SOURCE } from '@/data/wazaSource';

export const EFFECT_BYTES: readonly EffectByte[] = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33];
export function assertByte(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error(`Invalid WAZADATA byte: ${value}`);
}
export const internalApToDisplayed = (value: number): number => {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new Error(`Invalid AP word: ${value}`);
  return value / 2;
};
const actions: Readonly<Record<number, readonly [ActionKind, AnimationKind]>> = {
  0: ['attack', 'projectile'], 1: ['attack', 'magic'], 2: ['attack', 'physical'],
  4: ['counter', 'projectile'], 5: ['counter', 'magic'], 6: ['counter', 'physical'],
  8: ['interrupt', 'projectile'], 9: ['interrupt', 'magic'], 10: ['interrupt', 'physical'],
  12: ['assist', 'projectile'], 13: ['assist', 'magic'],
};
const targets: Readonly<Record<number, TargetGroup>> = {
  0: 'self', 1: 'one-ally', 2: 'all-allies', 5: 'one-enemy', 6: 'all-enemies', 8: 'field', 9: 'interrupt-target',
};
export function decodeByte3(value: number) {
  assertByte(value);
  return { actionKind: actions[value & 15]?.[0] ?? null, animationKind: actions[value & 15]?.[1] ?? null, targetGroup: targets[value >> 4] ?? null };
}
export function decodeByte4(value: number): { rank: SkillRank | null; element: SkillElement | null } {
  assertByte(value);
  const ranks: readonly SkillRank[] = ['Rookie', 'Champion', 'Ultimate', 'Mega'];
  const elements: readonly SkillElement[] = ['Water', 'Fire', 'Nature', 'Machine', 'Darkness', 'Neutral'];
  return { rank: ranks[value >> 4] ?? null, element: elements[value & 15] ?? null };
}

type Meaning<T = SkillEffectDefinition> = T extends SkillEffectDefinition ? Omit<T, 'byte' | 'mask' | 'sourceRow' | 'sourceLabel'> : never;
type Rule = { byte: EffectByte; mask: number; meaning: Meaning };
const rules: Rule[] = [];
const rule = (byte: EffectByte, mask: number, meaning: Meaning) => { rules.push({ byte, mask, meaning }); };
const unresolved = (byte: EffectByte, mask: number, reason: 'deprecated' | 'uncertain-source', note: string) => rule(byte, mask, { kind: 'unresolved', reason, note });

rule(17, 1, { kind: 'action-protection', against: 'counter', scope: 'skill' });
rule(17, 2, { kind: 'action-protection', against: 'interrupt', scope: 'skill' });
rule(17, 4, { kind: 'accuracy-modifier', modifier: 'cannot-miss', condition: 'always', certainty: 'uncertain' });
rule(17, 8, { kind: 'initiative-modifier', modifier: 'double-speed', subject: 'user' });
rule(17, 0x10, { kind: 'accuracy-modifier', modifier: 'increased-evasion', condition: 'counter-triggered', certainty: 'documented' });
rule(17, 0x20, { kind: 'initiative-modifier', modifier: 'act-last', subject: 'user' });
rule(17, 0x40, { kind: 'parameter-modifier', stats: ['def'], direction: 'down', subject: 'user', multiplier: 0.5, duration: 'this-turn' });
rule(18, 1, { kind: 'damage-modifier', modifier: 'returned-damage', multiplier: 1.5, condition: 'counter-triggered' });
rule(18, 2, { kind: 'damage-rule', rule: 'attribute-dependent-heal-or-damage' });
rule(18, 4, { kind: 'accuracy-modifier', modifier: 'miss-unless-counter', condition: 'counter-triggered', certainty: 'documented' });
rule(18, 8, { kind: 'accuracy-modifier', modifier: 'increased-accuracy', condition: 'always', certainty: 'documented' });
rule(18, 0x10, { kind: 'consecutive-power', displayedIncrement: internalApToDisplayed(5), documentedDisplayedCap: internalApToDisplayed(70), capMeaning: 'unresolved-total-or-bonus' });
rule(18, 0x20, { kind: 'damage-modifier', modifier: 'multiplier', multiplier: 1.5, condition: 'counter-triggered' });
rule(18, 0x40, { kind: 'damage-modifier', modifier: 'multiplier', multiplier: 1.5, condition: 'user-poisoned' });
rule(18, 0x80, { kind: 'damage-modifier', modifier: 'multiplier', multiplier: 1.5, condition: 'target-interrupting' });
rule(19, 1, { kind: 'damage-modifier', modifier: 'multiplier', multiplier: 1.5, condition: 'target-countering' });
rule(19, 2, { kind: 'damage-modifier', modifier: 'multiplier', multiplier: 1.5, condition: 'target-countering-or-interrupting' });
rule(19, 4, { kind: 'damage-modifier', modifier: 'multiplier', multiplier: 1.5, condition: 'user-interrupted' });
rule(19, 8, { kind: 'drain', resource: 'hp', mode: 'damage', amount: 'unspecified' });
rule(19, 0x10, { kind: 'counter-payment', payer: 'enemy' });
rule(19, 0x20, { kind: 'drain', resource: 'mp', mode: 'dead-target-remaining-mp', amount: 'unspecified' });
rule(19, 0x40, { kind: 'drain', resource: 'mp', mode: 'interrupted-tech-cost', amount: 'unspecified' });
unresolved(21, 1, 'deprecated', 'Source marks this bit deprecated; no damage semantics inferred.');
rule(21, 2, { kind: 'damage-rule', rule: 'half-current-hp' });
rule(21, 4, { kind: 'recovery', mode: 'full-heal' });
rule(21, 8, { kind: 'damage-rule', rule: 'execute-below-hp', threshold: 60 });
rule(21, 0x10, { kind: 'damage-rule', rule: 'execute-after-hits', threshold: 3 });
rule(21, 0x20, { kind: 'damage-rule', rule: 'additional-mp-damage', range: [4, 7] });
rule(21, 0x40, { kind: 'damage-rule', rule: 'additional-mp-damage', range: [13, 20] });
unresolved(21, 0x80, 'deprecated', 'Source marks this bit deprecated.');
rule(22, 2, { kind: 'status-transfer' });
for (const [stat, down, up] of [['atk', 4, 8], ['def', 0x10, 0x20], ['spd', 0x40, 0x80]] as const) {
  rule(22, down, { kind: 'parameter-modifier', stats: [stat], direction: 'down', subject: 'target' });
  rule(22, up, { kind: 'parameter-modifier', stats: [stat], direction: 'up', subject: 'target' });
}
unresolved(23, 1, 'deprecated', 'Armor Aid legacy flag.');
unresolved(23, 2, 'deprecated', 'Safety Sphere legacy flag.');
// Isolated 04/08 are handled below: only their conjunction has a known reset scope.
for (const [mask, attribute] of [[0x10, 'Vaccine'], [0x20, 'Virus'], [0x40, 'Data']] as const) {
  rule(23, mask, { kind: 'parameter-modifier', stats: ['atk', 'def'], direction: 'down', subject: 'target', attribute });
}
for (const [byte, low, status] of [[25, 1, 'poison'], [25, 0x10, 'paralysis'], [26, 1, 'confusion']] as const) {
  const sourceAlias = status === 'paralysis' ? 'stun' as const : undefined;
  rule(byte, low, { kind: 'status-application', status, chancePercent: 33, condition: 'always', sourceAlias });
  rule(byte, low * 2, { kind: 'status-application', status, chancePercent: 66, condition: 'always', sourceAlias });
  rule(byte, low * 4, { kind: 'status-application', status, chancePercent: 100, condition: 'counter-triggered', sourceAlias });
}
rule(25, 0x80, { kind: 'status-application', status: 'paralysis', chancePercent: 100, condition: 'interrupt-triggered', sourceAlias: 'stun' });
rule(26, 0x10, { kind: 'status-application', status: 'motivation-down', condition: 'always' });
unresolved(26, 0x40, 'uncertain-source', 'Unknown Status Effect Flag');
rule(26, 0x80, { kind: 'status-application', status: 'poison-body', condition: 'always' });
for (const [index, power] of (['poison', 'Fire', 'Water', 'paralysis', 'confusion', 'Nature', 'Machine', 'Darkness'] as const).entries()) {
  rule(27, 1 << index, { kind: 'temporary-attack-power', power });
}
rule(28, 1, { kind: 'special-state', state: 'zombie' });
rule(28, 2, { kind: 'special-state', state: 'invisibility' });
for (const [index, status] of (['poison', 'paralysis', 'confusion', 'motivation-down'] as const).entries()) {
  rule(29, 1 << index, { kind: 'status-cure', status, sourceAlias: status === 'paralysis' ? 'stun' : undefined });
}
rule(31, 2, { kind: 'recovery', mode: 'revive-full-heal' });
rule(31, 8, { kind: 'recovery-restriction', resource: 'hp' });
rule(31, 0x10, { kind: 'recovery-restriction', resource: 'status' });
rule(31, 0x20, { kind: 'action-protection', against: 'counter', scope: 'turn' });
rule(31, 0x20, { kind: 'action-protection', against: 'interrupt', scope: 'turn', caveat: 'Source explicitly says interrupt prevention is broken.' });
rule(31, 0x40, { kind: 'special-state', state: 'invincibility' });
rule(31, 0x80, { kind: 'interrupt-modifier', modifier: 'cancel-action', chancePercent: 87.5, excludesBosses: true, condition: 'interrupt-triggered' });
unresolved(32, 1, 'deprecated', 'Source: Wing Blade / MP Destroyer legacy flag.');
rule(32, 2, { kind: 'interrupt-modifier', modifier: 'reduce-action-damage', reductionPercent: 70.3125, condition: 'unspecified' });
rule(32, 4, { kind: 'interrupt-modifier', modifier: 'reduce-action-damage', reductionPercent: 39.84375, condition: 'unspecified' });
rule(32, 8, { kind: 'interrupt-modifier', modifier: 'force-miss', chancePercent: 66, condition: 'interrupt-triggered' });
unresolved(32, 0x10, 'deprecated', 'Source: unused Venom Infusion flag.');
rule(32, 0x20, { kind: 'interrupt-modifier', modifier: 'target-acts-last', condition: 'interrupt-triggered' });
unresolved(32, 0x40, 'deprecated', 'Source: Life Shield legacy flag.');
rule(33, 1, { kind: 'target-mode-modifier', mode: 'normal' });
rule(33, 2, { kind: 'target-mode-modifier', mode: 'random-digimon' });
rule(33, 4, { kind: 'target-mode-modifier', mode: 'all-on-counter' });

function evidence(byte: EffectByte, mask: number) {
  const source = SKILL_EFFECT_SOURCE.find(row => row.byte === byte && row.mask === mask);
  return { byte, mask, sourceRow: source?.row, sourceLabel: source?.label };
}
/** Pure bitwise decoder. Composite examples (17=03,29=07) never duplicate effects. */
export function decodeEffectFlags(flags: EffectFlags): SkillEffectDefinition[] {
  const effects: SkillEffectDefinition[] = [];
  const recognized = Object.fromEntries(EFFECT_BYTES.map(byte => [byte, 0])) as Record<EffectByte, number>;
  for (const byte of EFFECT_BYTES) assertByte(flags[byte]);
  for (const { byte, mask, meaning } of rules) {
    recognized[byte] |= mask;
    if ((flags[byte] & mask) !== 0) effects.push({ ...meaning, ...evidence(byte, mask) });
  }
  recognized[23] |= 0x0c;
  if ((flags[23] & 0x0c) === 0x0c) effects.push({ kind: 'parameter-reset', scope: 'all', ...evidence(23, 0x0c) });
  else for (const mask of [4, 8]) {
    if ((flags[23] & mask) !== 0) effects.push({ kind: 'unresolved', reason: 'uncertain-source', note: 'Isolated parameter reset: buff/debuff and side interpretation unresolved.', ...evidence(23, mask) });
  }
  for (const byte of EFFECT_BYTES) {
    for (let mask = 1; mask <= 128; mask <<= 1) {
      if ((flags[byte] & mask & ~recognized[byte]) !== 0) effects.push({ kind: 'unresolved', reason: 'unknown-bit', note: 'No documented interpretation.', ...evidence(byte, mask) });
    }
  }
  return effects;
}

/** Identity annotations only; these IDs identify reversed labels, never mechanics. */
const reversedLabels = new Set([0xa3, 0xc3, 0xc4, 0xdd]);
export function decodeRecordIdentity(raw: RawWazaRecord) {
  const id = raw.bytes[0] | (raw.bytes[1] << 8);
  const parts = raw.label?.split(/ (?:-|\u2013) /);
  const name = parts ? (parts.length === 2 ? parts[reversedLabels.has(id) ? 0 : 1] : raw.label) : null;
  // Workbook labels with '?' explicitly withhold identity certainty.
  const recordKind = id >= 0xfd ? 'item-or-system' : !name || name.includes('?') ? 'unresolved' : 'technique';
  return { id, name, recordKind } as const;
}
export function normalizeWazaRecord(raw: RawWazaRecord): BattleSkillDefinition {
  if (raw.bytes.length !== 68) throw new Error(`WAZADATA row ${raw.row}: expected 68 bytes`);
  raw.bytes.forEach(assertByte);
  const bytes = [...raw.bytes];
  const provenance = { ...raw, bytes };
  const identity = decodeRecordIdentity(raw);
  const action = decodeByte3(bytes[2]);
  const rankElement = decodeByte4(bytes[3]);
  const effectFlags = Object.fromEntries(EFFECT_BYTES.map(byte => [byte, bytes[byte - 1]])) as Record<EffectByte, number>;
  const effects = decodeEffectFlags(effectFlags);
  const attackPowerRaw = bytes[8] | (bytes[9] << 8);
  const issues: SkillDataIssue[] = [];
  if (!action.actionKind || !action.animationKind || !action.targetGroup) issues.push({ field: 'byte3', value: bytes[2], detail: 'Unknown action/animation or target nibble.' });
  if (!rankElement.rank || !rankElement.element) issues.push({ field: 'byte4', value: bytes[3], detail: 'Unknown rank or element nibble.' });
  if (![1, 2, 4].includes(bytes[32])) issues.push({ field: 'byte33', value: bytes[32], detail: 'Undocumented target mode value/combination; known bits decoded independently.' });
  if (attackPowerRaw >= 0x8000) issues.push({ field: 'attackPower', value: attackPowerRaw, detail: 'High-bit AP: signed healing/sentinel interpretation not specified by sources.' });
  if (identity.recordKind === 'unresolved' || !identity.name) issues.push({ field: 'identity', value: raw.label, detail: 'Unnamed or explicitly uncertain workbook label.' });
  return {
    ...identity, ...action, ...rankElement, mpCost: bytes[4], attackPowerRaw,
    attackPower: attackPowerRaw < 0x8000 ? internalApToDisplayed(attackPowerRaw) : null,
    targetModes: effects.flatMap(effect => effect.kind === 'target-mode-modifier' ? [effect.mode] : []),
    effectFlags, effects, issues, provenance,
  };
}

/** Lossless export, including unknown fields and effects. */
export const exportWazaBytes = (skill: BattleSkillDefinition): number[] => [...skill.provenance.bytes];
