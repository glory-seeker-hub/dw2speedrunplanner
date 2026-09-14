import { getBattleSkillById } from '@/data/battleSkills';
import type { PlayerOrder, PlayerRoundPlan } from './battleActionPlans';
import type { BattleState, PlannedAction, TargetIntent, PlayerDecisionObserver } from './battleTypes';

const intentKey = (intent: TargetIntent) => intent.kind === 'combatants'
  ? ['combatants', intent.targetIds] : ['opponents', intent.side, intent.selection];
const orderKey = (order: PlayerOrder) => JSON.stringify([order.actorId, order.canonicalSkillId, order.skillKey, order.targetIntent ? intentKey(order.targetIntent) : null]);
export const playerDecisionTraceKey = (trace: readonly PlayerRoundPlan[]) => JSON.stringify(trace.map(p => [p.round, p.orders.map(orderKey)]));

/** Observes planning/selection directly, before execution can replace an intention. No RNG or state mutation. */
export function createPlayerDecisionTrace() {
  const trace: PlayerRoundPlan[] = [], byAction = new Map<string, { order: PlayerOrder; plan: PlayerRoundPlan; controlledSingle: boolean }>();
  const label = (state: BattleState, intent: TargetIntent) => intent.kind === 'combatants'
    ? intent.targetIds.map(id => state.combatants.find(a => a.id === id)?.name ?? id).join(', ') : intent.selection === 'all' ? 'All' : 'Engine policy';
  const refresh = (plan: PlayerRoundPlan) => { plan.orders.forEach(o => { o.key = orderKey(o); }); plan.key = JSON.stringify([plan.round, plan.orders.map(o => o.key)]); };
  const observer: PlayerDecisionObserver = {
    planned(state, action) {
      const actor = state.combatants.find(a => a.id === action.actorId)!;
      if (actor.side !== 'player') return;
      const skill = getBattleSkillById(action.skill.canonicalSkillId ?? -1);
      const self = skill?.targetGroup === 'self';
      const controlledSingle = action.kind === 'attack' && action.skill.legacyTech.target === 'Single' && !self
        && !skill?.effects.some(e => e.kind === 'target-mode-modifier' && e.mode === 'random-digimon');
      let plan = trace.find(p => p.round === state.round);
      if (!plan) { plan = { round: state.round, orders: [], key: '' }; trace.push(plan); }
      const order: PlayerOrder = { actorId: actor.id, actorName: actor.name, skillKey: action.skill.key,
        canonicalSkillId: action.skill.canonicalSkillId, skillName: skill?.name ?? action.skill.legacyTech.name,
        targetIntent: structuredClone(action.targetIntent),
        targetLabel: self ? 'Self' : action.kind !== 'attack' ? 'Engine policy' : label(state, action.targetIntent), key: '' };
      plan.orders.push(order); byAction.set(action.id, { order, plan, controlledSingle }); refresh(plan);
    },
    selectedTargets(state, action: PlannedAction, targetIds) {
      const entry = byAction.get(action.id);
      if (!entry?.controlledSingle || !targetIds.length) return;
      // The engine calls this only for original, non-Confusion selections. Causal reaction targets are not inputs.
      entry.order.targetIntent = { kind: 'combatants', targetIds: [...targetIds] };
      entry.order.targetLabel = label(state, entry.order.targetIntent); refresh(entry.plan);
    },
  };
  return { trace, observer };
}
