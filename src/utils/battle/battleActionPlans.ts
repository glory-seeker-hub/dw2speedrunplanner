import { createPlayerDecisionTrace } from './battlePlayerDecisionTrace';
import { initializeMotivation } from './battleEffectCompletion';
import { getBattleSkillById } from '@/data/battleSkills';
import { selectableSkills } from './battleActions';
import { playerTargetChoices } from './battlePlayerTargets';
import { completedOutcome } from './battleState';
import { createBattleState } from './battleInput';
import { simulateBattleCore } from './battleSimulation';
import { createSeededBattleRng } from './battleRng';
import { BattleInputError, type BattleCombatantState, type BattleEngineOptions, type BattleInput, type BattleState, type TargetIntent } from './battleTypes';

export interface PlayerOrder {
  actorId: string; actorName: string; skillKey: string; canonicalSkillId: number | null;
  skillName: string; targetIntent?: TargetIntent; targetLabel: string; key: string;
}
export interface PlayerRoundPlan { round: number; orders: PlayerOrder[]; key: string }
export const canonicalDecisionKey = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const prefixKey = (plans: readonly PlayerRoundPlan[]) => JSON.stringify(plans.map(p => p.key));
export function enumerateLegalPlayerOrders(state: BattleState, actor: BattleCombatantState): PlayerOrder[] {
  if (completedOutcome(state) || actor.side !== 'player' || !actor.isAlive || actor.revivedRound === state.round) return [];
  const orders = new Map<string, PlayerOrder>();
  for (const skill of selectableSkills(actor, state.combatants)) {
    const canonical = getBattleSkillById(skill.canonicalSkillId ?? -1);
    const targets = playerTargetChoices(state.combatants, actor, skill);
    for (const target of targets) {
      // Include resource/effect semantics, but aliases of the same actual decision deduplicate.
      const semantics: Record<string, unknown> = { ...skill.legacyTech };
      delete semantics.id; delete semantics.name; delete semantics.canonicalSkillId;
      const key = canonicalDecisionKey([actor.id, skill.canonicalSkillId ?? skill.key, semantics, target.intent ?? null]);
      if (!orders.has(key) || skill.key < orders.get(key)!.skillKey) orders.set(key, { actorId: actor.id, actorName: actor.name, skillKey: skill.key,
        canonicalSkillId: skill.canonicalSkillId, skillName: canonical?.name ?? skill.legacyTech.name,
        targetIntent: target.intent, targetLabel: target.label, key });
    }
  }
  return [...orders.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}
export function playerOrderSets(state: BattleState) {
  return state.combatants.filter(a => a.side === 'player' && a.isAlive && a.revivedRound !== state.round)
    .map(a => enumerateLegalPlayerOrders(state, a));
}
export function countPlayerRoundPlans(state: BattleState): number {
  const sets = playerOrderSets(state);
  return sets.length ? sets.reduce((n, s) => n * s.length, 1) : 0;
}
export function* enumeratePlayerRoundPlans(state: BattleState): Generator<PlayerRoundPlan> {
  const sets = playerOrderSets(state);
  if (!sets.length || sets.some(s => !s.length)) return;
  function* product(index: number, orders: PlayerOrder[]): Generator<PlayerRoundPlan> {
    if (index === sets.length) { yield { round: state.round, orders, key: JSON.stringify([state.round, orders.map(o => o.key)]) }; return; }
    for (const order of sets[index]) yield* product(index + 1, [...orders, order]);
  }
  yield* product(0, []);
}
export function rootPlanInfo(input: BattleInput, initialSeed = 0) {
  const state = createBattleState(input); state.round = 1;
  const rng = createSeededBattleRng(initialSeed);
  for (const actor of state.combatants) initializeMotivation(actor, rng);
  const count = countPlayerRoundPlans(state);
  return { state, count, minimumBudget: count * 4 };
}
/** Planning hook only: execution-time Confusion deliberately continues to use the random policy. */
export function replayPlayerPrefix(input: BattleInput, plans: readonly PlayerRoundPlan[], seed: number,
  options: BattleEngineOptions = {}, stopAtNextDecision = false, captureDecisions = false) {
  let diverged = false, nextState: BattleState | null = null;
  const decisions = captureDecisions ? createPlayerDecisionTrace() : null;
  const fail = () => { diverged = true; throw new BattleInputError('scripted-plan-diverged', 'unsupported'); };
  const result = simulateBattleCore(input, { ...options, playerDecisionObserver: decisions?.observer ?? options.playerDecisionObserver, rng: createSeededBattleRng(seed), playerDecisions: {
    beforeRound(state) {
      if (stopAtNextDecision && state.round === plans.length + 1) {
        nextState = structuredClone(state);
        // Previous actions are not needed to enumerate decisions at the next round boundary.
        nextState.plannedActions = []; nextState.queue = [];
        throw new BattleInputError('decision-boundary');
      }
      const plan = plans[state.round - 1];
      if (!plan) return;
      const sets = playerOrderSets(state);
      if (plan.round !== state.round || sets.length !== plan.orders.length) fail();
      for (let i = 0; i < sets.length; i++) {
        const intended = plan.orders[i];
        if (!sets[i].some(o => o.key === intended?.key && o.skillKey === intended.skillKey
          && canonicalDecisionKey(o.targetIntent) === canonicalDecisionKey(intended.targetIntent))) fail();
      }
    },
    chooseAction(actor, state) {
      const plan = plans[state.round - 1];
      if (!plan) return undefined;
      const order = plan.orders.find(o => o.actorId === actor.id);
      if (!order) { fail(); return undefined; }
      return { kind: 'skill', skillKey: order.skillKey, ...(order.targetIntent ? { targetIntent: order.targetIntent } : {}) };
    },
  } });
  return { result, diverged, nextState, decisionTrace: decisions?.trace ?? [] };
}
