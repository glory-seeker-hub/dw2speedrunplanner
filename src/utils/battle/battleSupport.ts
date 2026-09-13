import { getBattleSkillById } from '@/data/battleSkills';
import type { BattleInput, BattleSkillSelection } from './battleTypes';
import { createBattleState } from './battleInput';
import { isDirectBattleStatus } from './battleStatuses';
export type BattleSupportLevel = 'supported' | 'legacy-compatibility' | 'future-mechanic-unsupported' | 'canonical-data-incomplete' | 'unknown';
export function assessBattleSkill(skill: BattleSkillSelection): { level: BattleSupportLevel; reasons: string[] } {
  if (skill.source === 'synthetic-legacy-fallback') return { level: 'legacy-compatibility', reasons: ['Synthetic fallback is not DW2 skill data.'] };
  const canonical = skill.canonicalSkillId === null ? undefined : getBattleSkillById(skill.canonicalSkillId);
  if (!canonical) return { level: 'unknown', reasons: ['No canonical WAZADATA identity.'] };
  if (canonical.recordKind !== 'technique' || canonical.issues.length || canonical.effects.some(e =>
    (e.kind === 'unresolved' && e.reason !== 'deprecated') ||
    (e.kind === 'accuracy-modifier' && e.certainty === 'uncertain') || e.kind === 'consecutive-power'
  )) return { level: 'canonical-data-incomplete', reasons: ['Canonical fields or effect interpretation remain unresolved.'] };
  if (canonical.actionKind === 'assist') return { level: 'future-mechanic-unsupported', reasons: [`Authoritative ${canonical.actionKind} resolution is deferred.`] };
  const legacyEffect = skill.legacyTech.specialEffect?.type;
  const deferred = canonical.effects.filter(e => {
    if (canonical.actionKind === 'interrupt' && (e.kind === 'interrupt-modifier' || (e.kind === 'status-application' && e.condition === 'interrupt-triggered' && e.chancePercent === 100) || (e.kind === 'action-protection' && e.against === 'interrupt'))) return false;
    if (e.kind === 'action-protection' && e.against === 'interrupt') return false;
    if (e.kind === 'damage-modifier' && ['target-interrupting', 'target-countering-or-interrupting', 'user-interrupted'].includes(e.condition)) return false;
    if (canonical.actionKind === 'counter') {
      if (e.kind === 'damage-modifier' && e.condition === 'counter-triggered') return false;
      if (e.kind === 'status-application' && e.condition === 'counter-triggered' && e.chancePercent === 100 && ['poison', 'paralysis', 'confusion'].includes(e.status)) return false;
      if (e.kind === 'counter-payment') return false;
      if (e.kind === 'accuracy-modifier' && (e.modifier === 'miss-unless-counter' || (canonical.id === 0x85 && e.modifier === 'increased-evasion'))) return false;
      if (e.kind === 'target-mode-modifier' && e.mode === 'all-on-counter') return false;
    }
    if (isDirectBattleStatus(e)) return false;
    if (e.kind === 'unresolved') return false; // Only deprecated entries reach here.
    if (e.kind === 'target-mode-modifier') return e.mode !== 'normal' && !(e.mode === 'all-on-counter' && ['counterTargetAll', 'counterApMultiplierAndTargetAll'].includes(legacyEffect ?? ''));
    if (e.kind === 'parameter-modifier') return !(legacyEffect === 'debuffStat' && e.direction === 'down' && e.subject === 'target' && e.stats.length === 1 && e.stats[0] === skill.legacyTech.specialEffect?.stat);
    if (e.kind === 'action-protection') return !(legacyEffect === 'noTriggerCounter' && e.against === 'counter' && e.scope === 'skill');
    if (e.kind === 'drain') return !(legacyEffect === 'healOnDamage' && e.resource === 'hp');
    if (e.kind === 'damage-modifier' && e.condition === 'counter-triggered') return !(e.modifier === 'returned-damage' ? legacyEffect === 'counterDamageMultiplier' : ['counterApMultiplier', 'counterApMultiplierAndTargetAll'].includes(legacyEffect ?? ''));
    return true;
  });
  if (deferred.length) return { level: 'future-mechanic-unsupported', reasons: ['Canonical effects are described but not executed by this resolver.'] };
  if (canonical.actionKind === 'interrupt') return { level: 'supported', reasons: ['Authoritative Interrupt resolution and measured prelude/execution timing.'] };
  if (canonical.actionKind === 'counter') return { level: 'supported', reasons: ['Authoritative Counter resolution using the retained base damage formula.'] };
  return { level: 'legacy-compatibility', reasons: ['Legacy damage/targeting/effect path; unmeasured timing classes and full effects resolution remain deferred.'] };
}
export function assessBattleScenario(input: BattleInput) {
  try {
    const state = createBattleState(input);
    return { valid: true, skills: state.combatants.flatMap(a => a.skills.map(s => ({ actorId: a.id, skillKey: s.key, ...assessBattleSkill(s) }))), errors: [] as string[] };
  } catch (error) { return { valid: false, skills: [], errors: [error instanceof Error ? error.message : String(error)] }; }
}
