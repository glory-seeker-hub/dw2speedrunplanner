import { getBattleSkillById } from '@/data/battleSkills';
import type { BattleActionRecord, BattleState, CounterRuntimeState, PlannedAction } from './battleTypes';
import { actorById } from './battleState';
import { comparePartyPosition } from './battleOrder';

export const counterDefinition = (action: PlannedAction) => action.skill.canonicalSkillId === null ? undefined : getBattleSkillById(action.skill.canonicalSkillId);
export const usesActivatedCounterMechanics = (action: PlannedAction) => action.kind === 'counter' && action.counter?.executionMode === 'activated' && action.counter.activatedMechanics;
export function completeCounter(action: PlannedAction): void {
  if (action.counter) { action.counter.executionMode = 'resolved'; action.counter.activatedMechanics = false; }
}
/** Eligibility hook only; no Interrupt scheduler is implemented. */
export const canInterruptCounter = (counter: CounterRuntimeState | null | undefined) => counter?.executionMode === 'waiting';
export function counterForcesMiss(action: PlannedAction): boolean {
  return action.kind === 'counter' && !usesActivatedCounterMechanics(action)
    && !!counterDefinition(action)?.effects.some(e => e.kind === 'accuracy-modifier' && e.modifier === 'miss-unless-counter');
}
export function counterTargetForm(action: PlannedAction): 'single' | 'aoe' | 'unknown' {
  const skill = counterDefinition(action);
  if (!skill) return 'unknown';
  if (usesActivatedCounterMechanics(action) && skill.targetModes.includes('all-on-counter')) return 'aoe';
  if (skill.targetGroup === 'all-enemies') return 'aoe';
  return skill.targetGroup === 'one-enemy' ? 'single' : 'unknown';
}
export function waitingTailBlade(state: BattleState, targetId: string): boolean {
  const target = actorById(state, targetId);
  const action = state.plannedActions.find(a => a.id === target.plannedActionId);
  return !!action && action.kind === 'counter' && action.skill.canonicalSkillId === 0x85
    && action.counter?.executionMode === 'waiting' && action.state === 'waiting';
}
/** Called once, after ALL impacts/effects of the causing action have finished. */
export function promoteCounters(state: BattleState, cause: PlannedAction, entry: BattleActionRecord, acted: ReadonlySet<string>): PlannedAction[] {
  if (cause.kind !== 'attack' || entry.outcome !== 'hit') return [];
  if (counterDefinition(cause)?.effects.some(e => e.kind === 'action-protection' && e.against === 'counter' && e.scope === 'skill')) return [];
  // Preserve explicit protection only for unidentified compatibility inputs.
  if (cause.skill.canonicalSkillId === null && cause.skill.legacyTech.specialEffect?.type === 'noTriggerCounter') return [];
  const eligible = state.plannedActions.filter(a => a.round === state.round && a.counter?.executionMode === 'waiting'
    && actorById(state, a.actorId).revivedRound !== state.round && a.state === 'waiting' && state.queue.includes(a.id) && !acted.has(a.actorId) && actorById(state, a.actorId).isAlive
    && entry.impacts.some(i => i.targetId === a.actorId && i.damage > 0));
  eligible.sort((a, b) => comparePartyPosition(state, a, b));
  eligible.forEach((action, index) => {
    const impact = entry.impacts.find(i => i.targetId === action.actorId && i.damage > 0)!;
    action.counter = { selected: true, executionMode: index === 0 ? 'activated' : 'shared-trigger-promoted', activatedMechanics: index === 0,
      triggerActionId: cause.id, triggerActorId: cause.actorId, triggerActorName: actorById(state, cause.actorId).name,
      triggerImpactTargetId: action.actorId, damageReceivedFromTrigger: impact.damage };
    action.reaction = { reactionToActionId: cause.id, triggeredByActorId: cause.actorId, counterActorId: action.actorId };
    action.priority = 'counter-promoted'; action.state = 'planned';
  });
  const promotedIds = new Set(eligible.map(a => a.id));
  state.queue = [...eligible.map(a => a.id), ...state.queue.filter(id => !promotedIds.has(id))];
  return eligible;
}
