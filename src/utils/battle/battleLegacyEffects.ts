import type { BattleCombatantState, BattleImpact, PlannedAction } from './battleTypes';

/** Compatibility only: preserve the old pre-damage consecutive-use increment. */
export function beforeLegacyAction(actor: BattleCombatantState, action: PlannedAction) {
  const name = action.skill?.legacyTech.name;
  if (actor.legacy.lastTechUsed === name) actor.legacy.consecutiveTechCount++;
  else { actor.legacy.lastTechUsed = name; actor.legacy.consecutiveTechCount = 1; }
}
/** Ordinary compatibility effects only; Counter descriptors have their own resolver. */
export function applyLegacyImpactEffects(actor: BattleCombatantState, target: BattleCombatantState, action: PlannedAction, damage: number): BattleImpact['appliedEffects'] {
  const applied: BattleImpact['appliedEffects'] = [];
  if (action.kind === 'counter' && action.skill.canonicalSkillId !== null) return applied;
  const effect = action.skill?.legacyTech.specialEffect;
  if (effect?.type === 'healOnDamage') {
    const before = actor.currentHp;
    actor.currentHp = Math.min(actor.maxHp, actor.currentHp + damage);
    applied.push({ source: 'legacy', kind: 'drain', combatantId: actor.id, amount: actor.currentHp - before });
  }
  if (effect?.type === 'debuffStat' && effect.stat) {
    const stat = effect.stat;
    const current = target.parameterModifiers[stat] || 1;
    const stacks = Math.round(Math.log2(1 / current));
    if (stacks < (effect.maxStacks || 2)) {
      target.parameterModifiers[stat] = current / Math.SQRT2;
      applied.push({ source: 'legacy', kind: 'parameter-modifier', combatantId: target.id, stat, amount: target.parameterModifiers[stat]! });
    }
  }
  return applied;
}
/** Legacy chain remains reachable only for explicitly supplied old specialEffect. */
export const legacyChainContinues = (action: PlannedAction, ko: boolean) => ko && action.skill?.legacyTech.specialEffect?.type === 'chainOnKill';
/** afterAction legacy cleanup; resource accounting is separate. */
export const afterLegacyAction = (actor: BattleCombatantState) => { actor.legacy.damageTakenThisTurn = 0; };
