import { resolvePolicyTarget } from './battleEffectCompletion';
import { getBattleSkillById } from '@/data/battleSkills';
import type { BattleRng } from './battleRng';
import type { BattleSkillSelection, BattleState, PlannedAction } from './battleTypes';
import { counterTargetForm, usesActivatedCounterMechanics } from './battleReactions';
import { actorById } from './battleState';

export const isOwnSideAttack = (skill: BattleSkillSelection) => skill.kind === 'attack'
  && getBattleSkillById(skill.canonicalSkillId ?? -1)?.targetGroup === 'one-ally';

export function livingOpponents(state: { combatants: readonly BattleState['combatants'][number][] }, actorId: string) {
  const actor = state.combatants.find(a => a.id === actorId)!;
  return state.combatants.filter(a => a.side !== actor.side && a.isAlive);
}
/** Shared Player selection restriction; execution of an explicit lock remains separate. */
export function selectableSingleOpponents(state: { combatants: readonly BattleState['combatants'][number][] }, actorId: string) {
  const actor = state.combatants.find(a => a.id === actorId)!;
  const candidates = livingOpponents(state, actorId);
  return actor.side === 'player' && state.combatants.filter(a => a.side === 'enemy' && a.currentHp > 0).length > 1
    ? candidates.filter(a => !a.statuses.invisibility) : candidates;
}
/** Resolve IDs against current state, never a stored mutable target reference. */
export function resolveEffectiveTargets(state: BattleState, action: PlannedAction, rng: BattleRng, confused = false): string[] {
  if (!confused) { const policyTargets = resolvePolicyTarget(state, action, rng); if (policyTargets !== null) return policyTargets; }
  if (action.kind === 'counter' && action.counter && !confused) {
    const form = counterTargetForm(action);
    if (form === 'aoe') {
      action.counter.targetRule = usesActivatedCounterMechanics(action) ? 'activated-aoe' : 'base-aoe';
      return livingOpponents(state, action.actorId).map(a => a.id);
    }
    if (action.counter.triggerActorId) {
      const target = state.combatants.find(a => a.id === action.counter!.triggerActorId);
      if (target?.side === actorById(state, action.actorId).side) {
        action.counter.targetRule = 'friendly-trigger-random-opponent';
        const opponents = livingOpponents(state, action.actorId);
        return opponents.length ? [opponents[opponents.length === 1 ? 0
          : rng.nextIntExclusive(opponents.length, 'counter-friendly-trigger-target')].id] : [];
      }
      action.counter.targetRule = 'causal-attacker';
      return target?.isAlive ? [target.id] : [];
    }
    action.counter.targetRule = 'base-single';
  }
  const intent = action.targetIntent;
  let candidates = intent.kind === 'combatants'
    ? [...new Set(intent.targetIds)].map(id => state.combatants.find(a => a.id === id)).filter(a => a?.isAlive)
    : state.combatants.filter(a => a.side === intent.side && a.isAlive);
  const actor = actorById(state, action.actorId);
  if (!confused && isOwnSideAttack(action.skill)) candidates = candidates.filter(a => a!.side === actor.side);
  const single = action.kind === 'counter' ? counterTargetForm(action) === 'single' : action.skill.legacyTech.target === 'Single';
  if (!confused && single && actor.side === 'player' && intent.kind === 'opponents' && intent.side === 'enemy') {
    const selectable = new Set(selectableSingleOpponents(state, actor.id).map(a => a.id));
    candidates = candidates.filter(a => selectable.has(a!.id));
  }
  if (!candidates.length) return [];
  if (action.kind === 'counter' && !confused && counterTargetForm(action) === 'single' && intent.kind !== 'combatants') return [candidates[rng.nextIntExclusive(candidates.length, 'target-choice')]!.id];
  if (intent.kind === 'combatants' || intent.selection === 'all') return candidates.map(a => a!.id);
  return [candidates[rng.nextIntExclusive(candidates.length, confused ? 'confusion-target' : 'target-choice')]!.id];
}
