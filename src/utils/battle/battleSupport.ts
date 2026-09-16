import { classifyEffect } from './battleEffectCoverage';
import { getBattleSkillById } from '@/data/battleSkills';
import type { BattleInput, BattleSkillSelection } from './battleTypes';
import { createBattleState } from './battleInput';
export type BattleSupportLevel = 'supported' | 'legacy-compatibility' | 'future-mechanic-unsupported' | 'canonical-data-incomplete' | 'unknown';
export function assessBattleSkill(skill: BattleSkillSelection): { level: BattleSupportLevel; reasons: string[] } {
  if (skill.source === 'motivation-guard') return { level: 'supported', reasons: ['Guard is available only when Motivation Down blocks every technique.'] };
  if (skill.source === 'synthetic-legacy-fallback') return { level: 'legacy-compatibility', reasons: ['Synthetic fallback is not DW2 skill data.'] };
  const canonical = skill.canonicalSkillId === null ? undefined : getBattleSkillById(skill.canonicalSkillId);
  if (!canonical) return { level: 'unknown', reasons: ['No canonical WAZADATA identity.'] };
  const coverage = canonical.effects.map(e => classifyEffect(e, canonical));
  const deferred = coverage.filter(e => e.status === 'deferred-unresolved');
  const issues = canonical.issues.filter(i => !(canonical.id === 0xf4 && i.field === 'byte4') && !(canonical.id === 0xd2 && i.field === 'byte33') && !(canonical.actionKind === 'assist' && i.field === 'attackPower' && [0xbc, 0xb5, 0xcb, 0xcd, 0xb8].includes(canonical.id)));
  if (issues.length || deferred.length) return { level: issues.length || canonical.effects.some(e => classifyEffect(e, canonical).status === 'deferred-unresolved' && (e.kind === 'unresolved' || e.kind === 'accuracy-modifier' && e.certainty === 'uncertain')) ? 'canonical-data-incomplete' : 'future-mechanic-unsupported', reasons: [...issues.map(i => i.detail), ...deferred.map(e => e.boundary)] };
  if (coverage.some(e => e.status === 'compatibility-only')) return { level: 'legacy-compatibility', reasons: coverage.filter(e => e.status === 'compatibility-only').map(e => e.boundary) };
  if (canonical.actionKind === 'attack') return { level: 'legacy-compatibility', reasons: ['Authoritative supported effects use the retained legacy base damage/target adapter.'] };
  return { level: 'supported', reasons: [canonical.actionKind === 'interrupt' ? 'Authoritative Interrupt resolution and measured prelude/execution timing.' : 'Authoritative canonical effects and measured execution timing where the target count is covered.'] };
}
export function assessBattleScenario(input: BattleInput) {
  try {
    const state = createBattleState(input);
    return { valid: true, skills: state.combatants.flatMap(a => a.skills.map(s => ({ actorId: a.id, skillKey: s.key, ...assessBattleSkill(s) }))), errors: [] as string[] };
  } catch (error) { return { valid: false, skills: [], errors: [error instanceof Error ? error.message : String(error)] }; }
}
