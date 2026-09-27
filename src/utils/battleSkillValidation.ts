import type { BattleSkillDefinition, RawWazaRecord } from '@/types/battleSkill';
import { BATTLE_SKILLS, buildBattleSkillIndex, getBattleSkillByName, normalizeBattleSkillName } from '@/data/battleSkills';
import { WAZADATA_RECORDS, SKILL_EFFECT_SOURCE, WAZADATA_SOURCE } from '@/data/wazaSource';
import { SPECIES_PROGRESSION } from '@/data/speciesProgression';
import { encounters } from '@/data/encounters';
import { normalizeWazaRecord } from '@/utils/battleSkillDecoder';
import { LEGACY_TECH_IDENTITIES } from '@/data/legacyTechIdentities';
import { classifyEffect } from '@/utils/battle/battleEffectCoverage';

export function validateWazaRecords(records: readonly RawWazaRecord[]): string[] {
  const errors: string[] = [];
  const decoded: BattleSkillDefinition[] = [];
  for (const record of records) {
    try { decoded.push(normalizeWazaRecord(record)); }
    catch (error) { errors.push(`Row ${record.row}: ${String(error)}`); }
  }
  try { buildBattleSkillIndex(decoded); }
  catch (error) { errors.push(String(error)); }
  return errors;
}

/** Call before a future authoritative simulation; no invented mechanics on failure. */
export function validateBattleSkillLabels(labels: readonly string[]) {
  const resolved: BattleSkillDefinition[] = [];
  const blockers: { label: string; reason: string }[] = [];
  if (labels.length === 0) blockers.push({ label: '', reason: 'No technique data supplied.' });
  const unresolvedEffects: { label: string; byte: number; mask: number; reason: string }[] = [];
  for (const label of labels) {
    if (label === 'Alias Fake' || label === 'Alias Fake (?)') continue;
    const skill = getBattleSkillByName(label);
    if (!skill) { blockers.push({ label, reason: 'No unambiguous authoritative technique identity.' }); continue; }
    resolved.push(skill);
    for (const issue of skill.issues) {
      if (skill.id === 0xf4 && issue.field === 'byte4' || skill.id === 0xd2 && issue.field === 'byte33') continue;
      blockers.push({ label, reason: `${issue.field}: ${issue.detail}` });
    }
    for (const effect of skill.effects) {
      const coverage = classifyEffect(effect,skill);
      if (effect.kind === 'unresolved') {
        unresolvedEffects.push({ label, byte: effect.byte, mask: effect.mask, reason: effect.reason });
        if (effect.reason !== 'deprecated' && coverage.status === 'deferred-unresolved') blockers.push({ label, reason: `Unresolved effect byte ${effect.byte}, mask ${effect.mask}.` });
      }
      if (effect.kind === 'accuracy-modifier' && effect.certainty === 'uncertain' && coverage.status === 'deferred-unresolved') blockers.push({ label, reason: 'Uncertain cannot-miss flag.' });
      if (effect.kind === 'consecutive-power') blockers.push({ label, reason: 'Consecutive AP cap interpretation unresolved.' });
    }
  }
  return { resolved, blockers, unresolvedEffects, complete: blockers.length === 0 };
}

const histogram = (values: readonly (string | number | null)[]) => {
  const result: Record<string, number> = {};
  for (const value of values) { const key = String(value ?? 'unknown'); result[key] = (result[key] ?? 0) + 1; }
  return result;
};
function summarize(skills: readonly BattleSkillDefinition[]) {
  const count = (...kinds: BattleSkillDefinition['effects'][number]['kind'][]) => skills.filter(s => s.effects.some(e => kinds.includes(e.kind))).length;
  return {
    records: skills.length,
    actions: histogram(skills.map(s => s.actionKind)), targets: histogram(skills.map(s => s.targetGroup)),
    animations: histogram(skills.map(s => s.animationKind)), ranks: histogram(skills.map(s => s.rank)), elements: histogram(skills.map(s => s.element)),
    statusInflicting: count('status-application'), statusCuring: count('status-cure'),
    parameterModifiers: count('parameter-modifier'), parameterResets: count('parameter-reset'),
    temporaryPowers: count('temporary-attack-power'), specialStates: count('special-state', 'recovery-restriction', 'recovery'),
  };
}
export function getBattleSkillCoverageReport() {
  const techniques = BATTLE_SKILLS.filter(s => s.recordKind === 'technique');
  const plannerLabels = [...new Set(SPECIES_PROGRESSION.flatMap(s => s.ownTechnique ? [s.ownTechnique] : []))].sort();
  const plannerIdentities = [...new Map(plannerLabels.map(name => [normalizeBattleSkillName(name), name])).values()];
  const references = encounters.flatMap(e => e.digimons.flatMap(d => d.techs.map(label => ({ encounterId: e.id, slot: d.slot, label }))));
  const encounterLabels = [...new Set(references.map(r => r.label))].sort();
  const coverage = (labels: string[]) => ({ total: labels.length, resolved: labels.filter(l => getBattleSkillByName(l)).length, unresolved: labels.filter(l => !getBattleSkillByName(l)) });
  const compatibilityIds = new Set(LEGACY_TECH_IDENTITIES.map(([id]) => id));
  return {
    source: WAZADATA_SOURCE,
    allRecords: summarize(BATTLE_SKILLS), namedTechniques: summarize(techniques),
    // Usable basic record != fully implemented or semantically certain simulation.
    usableTechniqueRecords: techniques.filter(s => s.issues.length === 0).length,
    recordKinds: histogram(BATTLE_SKILLS.map(s => s.recordKind)),
    unnamedRecords: BATTLE_SKILLS.filter(s => !s.name).map(s => ({ id: s.id, row: s.provenance.row })),
    uncertainIdentities: BATTLE_SKILLS.filter(s => s.recordKind === 'unresolved' && s.name).map(s => ({ id: s.id, name: s.name })),
    unknownValues: BATTLE_SKILLS.flatMap(s => s.issues.filter(i => i.field !== 'identity').map(i => ({ id: s.id, name: s.name, ...i }))),
    unknownEffectBits: BATTLE_SKILLS.flatMap(s => s.effects.filter(e => e.kind === 'unresolved' && e.reason === 'unknown-bit').map(e => ({ id: s.id, name: s.name, byte: e.byte, mask: e.mask }))),
    unresolvedDocumentedFlags: BATTLE_SKILLS.flatMap(s => s.effects.filter(e => e.kind === 'unresolved' && e.reason !== 'unknown-bit').map(e => ({ id: s.id, name: s.name, ...e }))),
    planner: coverage(plannerIdentities), plannerLabels: coverage(plannerLabels), encounterLabels: coverage(encounterLabels),
    encounterReferences: { total: references.length, resolved: references.filter(r => getBattleSkillByName(r.label)).length, unresolved: references.filter(r => !getBattleSkillByName(r.label)) },
    legacyUnsupportedEncounterLabels: encounterLabels.filter(label => { const s = getBattleSkillByName(label); return s && !compatibilityIds.has(s.id); }),
    assists: techniques.filter(s => s.actionKind === 'assist').map(s => ({ id: s.id, name: s.name, animationKind: s.animationKind, targetGroup: s.targetGroup })),
  };
}

/** Non-cryptographic deterministic drift sentinel, independent of workbook location. */
export function battleSourceFingerprint(): string {
  const text = JSON.stringify([WAZADATA_RECORDS, SKILL_EFFECT_SOURCE]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export function runBattleSkillSelfChecks() {
  const results: { name: string; passed: boolean; detail?: string }[] = [];
  const check = (name: string, passed: boolean, detail?: string) => results.push({ name, passed, ...(passed ? {} : { detail }) });
  const errors = validateWazaRecords(WAZADATA_RECORDS);
  check('WAZADATA valid bytes, unique IDs and technique names', errors.length === 0, errors.join('; '));
  check('WAZADATA source record count', BATTLE_SKILLS.length === 256 && WAZADATA_SOURCE.recordCount === 256);
  const wingBlade = BATTLE_SKILLS.find(s => s.id === 0x00a1);
  check('WAZADATA Wing Blade is Interrupt and Nature', wingBlade?.actionKind === 'interrupt' && wingBlade.element === 'Nature');
  check('WAZADATA source fingerprint', battleSourceFingerprint() === '00a1f844', battleSourceFingerprint());
  check('WAZADATA AP conversion and MP import', BATTLE_SKILLS.every(s => s.mpCost === s.provenance.bytes[4] && s.mpCost >= 0 && (s.attackPowerRaw >= 0x8000 ? s.attackPower === null : s.attackPower === s.attackPowerRaw / 2)));
  check('WAZADATA byte3 known source values', BATTLE_SKILLS.every(s => s.actionKind && s.animationKind && s.targetGroup));
  check('WAZADATA byte4 unknowns explicitly preserved', JSON.stringify(BATTLE_SKILLS.filter(s => !s.rank || !s.element).map(s => s.id)) === '[241,244]');
  const combined = normalizeWazaRecord({ row: 1, label: 'Check', bytes: Array.from({ length: 68 }, (_, i) => i === 16 ? 3 : i === 28 ? 7 : i === 32 ? 4 : 0) });
  check('WAZADATA combined protection/cure flags and counter target mode', combined.effects.filter(e => e.kind === 'action-protection').length === 2 && combined.effects.filter(e => e.kind === 'status-cure').length === 3 && combined.targetModes[0] === 'all-on-counter');
  check('WAZADATA reviewed aliases resolve', getBattleSkillByName('Blaze Buster')?.id === 195 && getBattleSkillByName('FLer Cannon')?.id === 18 && getBattleSkillByName('Ninja FLer')?.id === 20 && getBattleSkillByName('Destabilizer Ray')?.id === 249);
  const report = getBattleSkillCoverageReport();
  check('WAZADATA planner identities covered', report.planner.unresolved.length === 0, report.planner.unresolved.join(', '));
  check('WAZADATA encounter unresolved baseline is explicit', JSON.stringify(report.encounterLabels.unresolved) === JSON.stringify(['Alias Fake']), report.encounterLabels.unresolved.join(', '));
  check('WAZADATA compatibility identities exist', LEGACY_TECH_IDENTITIES.every(([id]) => BATTLE_SKILLS.some(s => s.id === id)));
  return results;
}
