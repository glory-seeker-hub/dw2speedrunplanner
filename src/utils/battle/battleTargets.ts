import type { BattleRng } from './battleRng';
import type { BattleState, PlannedAction } from './battleTypes';
import { counterTargetForm, usesActivatedCounterMechanics } from './battleReactions';
import { actorById } from './battleState';

export function livingOpponents(state: BattleState, actorId: string) {
  const actor = actorById(state, actorId);
  return state.combatants.filter(a => a.side !== actor.side && a.isAlive);
}
/** Resolve IDs against current state, never a stored mutable target reference. */
export function resolveEffectiveTargets(state: BattleState, action: PlannedAction, rng: BattleRng, confused = false): string[] {
  if (action.kind === 'counter' && action.counter && !confused) {
    const form = counterTargetForm(action);
    if (form === 'aoe') {
      action.counter.targetRule = usesActivatedCounterMechanics(action) ? 'activated-aoe' : 'base-aoe';
      return livingOpponents(state, action.actorId).map(a => a.id);
    }
    if (action.counter.triggerActorId) {
      action.counter.targetRule = 'causal-attacker';
      const target = state.combatants.find(a => a.id === action.counter!.triggerActorId);
      return target?.isAlive ? [target.id] : [];
    }
    action.counter.targetRule = 'base-single';
  }
  const intent = action.targetIntent;
  const candidates = intent.kind === 'combatants'
    ? [...new Set(intent.targetIds)].map(id => state.combatants.find(a => a.id === id)).filter(a => a?.isAlive)
    : state.combatants.filter(a => a.side === intent.side && a.isAlive);
  if (!candidates.length) return [];
  if (action.kind === 'counter' && !confused && counterTargetForm(action) === 'single') return [candidates[rng.nextIntExclusive(candidates.length, 'target-choice')]!.id];
  if (intent.kind === 'combatants' || intent.selection === 'all') return candidates.map(a => a!.id);
  return [candidates[rng.nextIntExclusive(candidates.length, confused ? 'confusion-target' : 'target-choice')]!.id];
}
