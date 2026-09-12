import { getBattleSkillById } from '@/data/battleSkills';
import type { BattleInput, BattleSkillSelection } from './battleTypes';
import { createBattleState } from './battleInput';
export type BattleSupportLevel = 'supported' | 'legacy-compatibility' | 'future-mechanic-unsupported' | 'canonical-data-incomplete' | 'unknown';
export function assessBattleSkill(skill: BattleSkillSelection): { level: BattleSupportLevel; reasons: string[] } {
  if (skill.source === 'synthetic-legacy-fallback') return { level: 'legacy-compatibility', reasons: ['Synthetic fallback is not DW2 skill data.'] };
  const canonical = skill.canonicalSkillId === null ? undefined : getBattleSkillById(skill.canonicalSkillId);
  if (!canonical) return { level: 'unknown', reasons: ['No canonical WAZADATA identity.'] };
  if (canonical.recordKind !== 'technique' || canonical.issues.length || canonical.effects.some(e =>
    (e.kind === 'unresolved' && e.reason !== 'deprecated') ||
    (e.kind === 'accuracy-modifier' && e.certainty === 'uncertain') || e.kind === 'consecutive-power'
  )) return { level: 'canonical-data-incomplete', reasons: ['Canonical fields or effect interpretation remain unresolved.'] };
  if (canonical.actionKind === 'interrupt' || canonical.actionKind === 'assist') return { level: 'future-mechanic-unsupported', reasons: [`Authoritative ${canonical.actionKind} resolution is deferred.`] };
  const legacyEffect = skill.legacyTech.specialEffect?.type;
  const deferred = canonical.effects.filter(e => {
    if (e.kind === 'unresolved') return false; // Only deprecated entries reach here.
    if (e.kind === 'target-mode-modifier') return e.mode !== 'normal' && !(e.mode === 'all-on-counter' && ['counterTargetAll', 'counterApMultiplierAndTargetAll'].includes(legacyEffect ?? ''));
    if (e.kind === 'parameter-modifier') return !(legacyEffect === 'debuffStat' && e.direction === 'down' && e.subject === 'target' && e.stats.length === 1 && e.stats[0] === skill.legacyTech.specialEffect?.stat);
    if (e.kind === 'action-protection') return !(legacyEffect === 'noTriggerCounter' && e.against === 'counter' && e.scope === 'skill');
    if (e.kind === 'drain') return !(legacyEffect === 'healOnDamage' && e.resource === 'hp');
    if (e.kind === 'damage-modifier' && e.condition === 'counter-triggered') return !(e.modifier === 'returned-damage' ? legacyEffect === 'counterDamageMultiplier' : ['counterApMultiplier', 'counterApMultiplierAndTargetAll'].includes(legacyEffect ?? ''));
    return true;
  });
  if (deferred.length) return { level: 'future-mechanic-unsupported', reasons: ['Canonical effects are described but not executed by this resolver.'] };
  return { level: 'legacy-compatibility', reasons: ['Legacy damage/targeting/effect path; unmeasured timing classes and full effects resolution remain deferred.'] };
}
export function assessBattleScenario(input: BattleInput) {
  try {
    const state = createBattleState(input);
    return { valid: true, skills: state.combatants.flatMap(a => a.skills.map(s => ({ actorId: a.id, skillKey: s.key, ...assessBattleSkill(s) }))), errors: [] as string[] };
  } catch (error) { return { valid: false, skills: [], errors: [error instanceof Error ? error.message : String(error)] }; }
}
