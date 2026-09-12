import type { BattleCombatantState, BattleState, PlannedAction } from './battleTypes';
import { nextActionId } from './battleActions';

/** Legacy approximation: immediate counter, random opponent, one action per actor. */
export function legacyCounterPolicy(state: BattleState, cause: PlannedAction, target: BattleCombatantState, acted: ReadonlySet<string>): PlannedAction | null {
  const waiting = state.plannedActions.find(a => a.id === target.plannedActionId);
  if (!target.isAlive || !waiting?.skill?.legacyTech.isCounter || target.reaction.counterUsed || acted.has(target.id) || cause.skill?.legacyTech.specialEffect?.type === 'noTriggerCounter' || cause.reaction) return null;
  target.reaction.counterUsed = true;
  target.reaction.isCountering = true;
  waiting.state = 'cancelled';
  const reaction: PlannedAction = { ...waiting, id: nextActionId(state), state: 'planned', priority: 'legacy-reaction', chainFromActionId: null, reaction: {
    reactionToActionId: cause.id, triggeredByActorId: cause.actorId, counterActorId: target.id,
  } };
  state.plannedActions.push(reaction);
  // Repeated insertion reverses simultaneous AOE Counter triggers, as before.
  state.queue.unshift(reaction.id);
  return reaction;
}
