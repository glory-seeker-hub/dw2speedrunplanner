import type { BattleSkillDefinition, SkillEffectDefinition } from '@/types/battleSkill';
export type EffectCoverageStatus = 'authoritative' | 'compatibility-only' | 'deferred-unresolved' | 'ignored-by-project' | 'not-applicable' | 'data-only';
export interface EffectCoverage { status: EffectCoverageStatus; handler: string; boundary: string }
/** Exhaustive kind switch: adding a decoded effect kind requires an explicit execution decision. */
export function classifyEffect(effect: SkillEffectDefinition, skill: Pick<BattleSkillDefinition, 'id' | 'actionKind' | 'recordKind'>): EffectCoverage {
  const result = (status: EffectCoverageStatus, handler: string, boundary = '') => ({ status, handler, boundary });
  const deferred = (boundary: string) => result('deferred-unresolved', 'none', boundary);
  const authoritative = (handler: string, boundary = '') => result('authoritative', handler, boundary);
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
      if (effect.status === 'motivation-down') return deferred('Enemy immunity in battleImmunity; exact Player behavior unresolved.');
      if (effect.status === 'poison-body') return authoritative('battleSupportEffects / battleSimulation');
      if (skill.actionKind === 'assist') return deferred('Direct probabilistic ailment on Assist is not specified; supported temporary states execute independently.');
      return authoritative('battleStatuses.resolveImpactStatuses', 'Direct 1/3 or 2/3; activated Counter/Interrupt conditional guarantees.');
    case 'unresolved':
      if (effect.reason === 'deprecated') return result('data-only', 'none', 'Retained raw flag; no behavior inferred.');
      if (skill.id === 0xbe && effect.byte === 23 && effect.mask === 4) return authoritative('battleSupportEffects.applySupportEffects', 'Reviewed Parameter Patch numeric exception; raw uncertainty preserved.');
      return deferred(effect.note);
    case 'accuracy-modifier':
      if (effect.modifier === 'cannot-miss' && skill.actionKind === 'assist') return authoritative('battleAccuracy.resolveActionAccuracy', 'Project Assist guarantee; not a general interpretation of the uncertain bit.');
      if (effect.modifier === 'miss-unless-counter') return authoritative('battleReactions.counterForcesMiss');
      if (effect.modifier === 'increased-evasion' && skill.id === 0x85) return authoritative('battleAccuracy.resolveActionAccuracy', 'Reviewed Tail Blade 1/3 evasion.');
      return deferred('Increased Accuracy / general Cannot Miss arithmetic not established.');
    case 'damage-modifier': return ['counter-triggered', 'target-interrupting', 'target-countering-or-interrupting', 'user-interrupted'].includes(effect.condition) ? authoritative('battleDamage.calculateActionDamage') : deferred('Condition/arithmetic not promoted by this phase.');
    case 'counter-payment': return authoritative('battleResources.accountActionMp');
    case 'interrupt-modifier': return skill.actionKind === 'interrupt' ? authoritative('battleInterrupts.resolveInterruptEffects') : deferred('Non-Interrupt applicability unresolved.');
    case 'target-mode-modifier': return effect.mode === 'random-digimon' ? deferred('Random-Digimon semantics remain unresolved; ordinary compatibility targeting only.') : authoritative('battleTargets / battleSupportEffects', 'Canonical normal targets and activated Counter expansion.');
    case 'action-protection': return effect.scope === 'skill' ? authoritative('battleInterrupts / battleReactions') : deferred('Turn-wide support protection not specified; broken Interrupt flag retained.');
    case 'drain': return effect.resource === 'hp' ? result('compatibility-only', 'battleLegacyEffects.applyLegacyImpactEffects', 'Legacy full damage HP drain; amount remains unspecified in source.') : deferred('MP transfer amount/payer/order unresolved.');
    case 'consecutive-power': return result('compatibility-only', 'battleDamage.calculateLegacyDamage', 'Legacy +2.5 bonus, cap25 retained; source cap35 total-or-bonus unresolved.');
    case 'initiative-modifier': return deferred('Double-speed / act-last skill modifiers not implemented.');
    case 'damage-rule': return deferred('Special damage/death/execute/MP rules not implemented.');
    case 'status-transfer': return deferred('Status transfer semantics not implemented.');
    case 'recovery-restriction': return deferred('Recovery restriction duration/scope not established.');
    default: { const missing: never = effect; throw new Error('Unclassified effect: ' + JSON.stringify(missing)); }
  }
}
