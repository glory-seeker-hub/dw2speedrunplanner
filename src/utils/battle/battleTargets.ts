import type { BattleRng } from './battleRng';
import type { BattleState, PlannedAction } from './battleTypes';
import { actorById } from './battleState';

export function livingOpponents(state: BattleState, actorId: string) {
  const actor = actorById(state, actorId);
  return state.combatants.filter(a => a.side !== actor.side && a.isAlive);
}
/** Resolve IDs against current state, never a stored mutable target reference. */
export function resolveEffectiveTargets(state: BattleState, action: PlannedAction, rng: BattleRng): string[] {
  const intent = action.targetIntent;
  const candidates = intent.kind === 'combatants'
    ? [...new Set(intent.targetIds)].map(id => state.combatants.find(a => a.id === id)).filter(a => a?.isAlive)
    : state.combatants.filter(a => a.side === intent.side && a.isAlive);
  if (!candidates.length) return [];
  const counterAll = action.reaction && (action.skill?.legacyTech.specialEffect?.type === 'counterTargetAll' || action.skill?.legacyTech.specialEffect?.type === 'counterApMultiplierAndTargetAll');
  if (counterAll) return livingOpponents(state, action.actorId).map(a => a.id);
  if (intent.kind === 'combatants' || intent.selection === 'all') return candidates.map(a => a!.id);
  return [candidates[rng.nextIntExclusive(candidates.length, 'target-choice')]!.id];
}
