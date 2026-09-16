import type { BattleSkillDefinition, SkillEffectDefinition } from '@/types/battleSkill';
export type EffectCoverageStatus = 'authoritative' | 'compatibility-only' | 'deferred-unresolved' | 'ignored-by-project' | 'not-applicable' | 'data-only';
export interface EffectCoverage { status: EffectCoverageStatus; handler: string; boundary: string }
/** Exhaustive kind switch: adding a decoded effect kind requires an explicit execution decision. */
export function classifyEffect(effect: SkillEffectDefinition, skill: Pick<BattleSkillDefinition, 'id' | 'actionKind' | 'recordKind'>): EffectCoverage {
  const result = (status: EffectCoverageStatus, handler: string, boundary = '') => ({ status, handler, boundary });
  const deferred = (boundary: string) => result('deferred-unresolved', 'none', boundary);
  const authoritative = (handler: string, boundary = '') => result('authoritative', handler, boundary);
  if (skill.id === 0xea) return result('ignored-by-project', 'none', 'Alias Fake is unused in gameplay; filtered from encounter/selection inputs.');
  if (effect.byte === 17 && effect.mask === 0x40 || skill.id === 0x3d && effect.byte === 31 && effect.mask === 4) return authoritative('battleEffectCompletion.postUseDefenseOne', 'User-confirmed exact DEF=1 after use overrides the source half-DEF label for Black Pearl Shot and Trick Or Treat.');
  if (skill.id === 0x89 && effect.byte === 22 && effect.mask === 1) return authoritative('battleResources.accountActionMp', 'Activated Counter cost charged once to causal attacker.');
  if (skill.id === 0xd2 && effect.byte === 33 && effect.mask === 8) return authoritative('battleEffectCompletion.resolvePolicyTarget', 'Execution-time random all-field HP0 and MP-positive target.');
  if ([0xcc,0xc6,0xd4].includes(skill.id) && effect.byte === 23 && [4,8].includes(effect.mask)) return authoritative('battleSupportEffects.applySupportEffects', 'All stored stages suppressed for remainder of round.');
  if (skill.id === 0xd7 && effect.kind === 'status-application' && effect.status === 'poison') return result('ignored-by-project', 'battleSupportEffects', 'Reviewed Poison Wave grants Poison Power and Poison Body; no direct Poison ailment.');
  if (effect.kind === 'special-state' && effect.state === 'zombie') return result('ignored-by-project', 'none', 'Zombie deliberately excluded.');
  if (skill.recordKind !== 'technique') return result('not-applicable', 'none', 'Item/system record; not a simulated technique.');
  switch (effect.kind) {
    case 'parameter-modifier': return effect.duration || effect.multiplier !== undefined ? deferred('Temporary raw-stat multipliers are not persistent stages.') : authoritative('battleSupportEffects.applySupportEffects', 'DEF Down precedes this impact; other stages follow damage.');
    case 'parameter-reset': return skill.id === 0xe3 ? authoritative('battleSupportEffects.applySupportEffects', 'Round suppression, not erasure or implicit cure.') : deferred('Only reviewed reset identities execute.');
    case 'status-cure': return authoritative('battleSupportEffects.applySupportEffects', 'Explicit cure is independent from parameter suppression.');
    case 'temporary-attack-power': return authoritative('battleSupportEffects / battleStatuses / battleDamage', '25% recovery; status Powers coexist, Elemental Power replaces.');
    case 'special-state': return authoritative('battleSupportEffects / battleStatuses / battleAccuracy / battleSimulation');
    case 'recovery': return effect.mode === 'revive-full-heal' && ![0xb7, 0xce].includes(skill.id) ? deferred('Only reviewed revive IDs B7/CE execute.') : authoritative('battleSupportEffects.applySupportEffects');
    case 'status-application':
      if (effect.status === 'motivation-down') return authoritative('battleStatuses / battleEffectCompletion', 'User-confirmed 100% on Hit; Enemy immunity; blocked slots, Guard and recovery.');
      if (effect.status === 'poison-body') return authoritative('battleSupportEffects / battleSimulation');
      if (skill.actionKind === 'assist') return deferred('Direct probabilistic ailment on Assist is not specified; supported temporary states execute independently.');
      return authoritative('battleStatuses.resolveImpactStatuses', 'Direct 1/3 or 2/3; activated Counter/Interrupt conditional guarantees.');
    case 'unresolved':
      if (effect.reason === 'deprecated') return result('data-only', 'none', 'Retained raw flag; no behavior inferred.');
      if (skill.id === 0xbe && effect.byte === 23 && effect.mask === 4) return authoritative('battleSupportEffects.applySupportEffects', 'Reviewed Parameter Patch numeric exception; raw uncertainty preserved.');
      return deferred(effect.note);
    case 'accuracy-modifier':
      if (effect.modifier === 'cannot-miss' || skill.id === 0x66 && effect.modifier === 'increased-accuracy') return authoritative('battleAccuracy.resolveActionAccuracy', 'Bypass ordinary accuracy only; mechanical Miss gates preserved.');
      if (effect.modifier === 'miss-unless-counter') return authoritative('battleReactions.counterForcesMiss');
      if (effect.modifier === 'increased-evasion' && skill.id === 0x85) return authoritative('battleAccuracy.resolveActionAccuracy', 'Reviewed Tail Blade 1/3 evasion.');
      return deferred('Increased Accuracy / general Cannot Miss arithmetic not established.');
    case 'damage-modifier': return ['user-poisoned', 'target-countering', 'counter-triggered', 'target-interrupting', 'target-countering-or-interrupting', 'user-interrupted'].includes(effect.condition) ? authoritative('battleDamage.calculateActionDamage') : deferred('Condition/arithmetic not promoted by this phase.');
    case 'counter-payment': return authoritative('battleResources.accountActionMp');
    case 'interrupt-modifier': return skill.actionKind === 'interrupt' ? authoritative('battleInterrupts.resolveInterruptEffects') : deferred('Non-Interrupt applicability unresolved.');
    case 'target-mode-modifier': return effect.mode === 'random-digimon' ? authoritative('battleEffectCompletion.resolvePolicyTarget', 'One execution-time draw in canonical target domain.') : authoritative('battleTargets / battleSupportEffects', 'Canonical normal targets and activated Counter expansion.');
    case 'action-protection': return effect.scope === 'skill' ? authoritative('battleInterrupts / battleReactions') : effect.against === 'counter' ? authoritative('battleSupportEffects.applySupportEffects', 'Prevents only unactivated waiting Counters for this round.') : result('ignored-by-project', 'none', 'Source claims turn-wide Interrupt prevention; actual game behavior is broken, ignored by confirmed project rule.');
    case 'drain': return effect.resource === 'hp' ? authoritative('battleSimulation', 'Canonical HP drain heals actual HP removed, excluding overkill; capped at user Max HP.') : authoritative('battleInterrupts / battleSimulation', 'Own cost first, Max MP cap; Necro conserves transferred MP.');
    case 'consecutive-power': return result('compatibility-only', 'battleDamage.calculateLegacyDamage', 'Legacy +2.5 bonus, cap25 retained; source cap35 total-or-bonus unresolved.');
    case 'initiative-modifier': return authoritative('battleOrder.calculateActionOrder', 'Queue-only Double SPD / Act Last.');
    case 'damage-rule': return authoritative('battleSimulation', 'Reviewed half-current-HP, pre-impact <=10% execute, type-disadvantage heal, and floor(final HP damage / 2) MP damage.');
    case 'status-transfer': return authoritative('battleEffectCompletion.copyNegativeStatuses', 'Copy negative ailments and recovery blocks; hard immunities retained.');
    case 'recovery-restriction': return authoritative('battleSupportEffects / battleStatuses', 'Round-scoped component-specific recovery block.');
    default: { const missing: never = effect; throw new Error('Unclassified effect: ' + JSON.stringify(missing)); }
  }
}
