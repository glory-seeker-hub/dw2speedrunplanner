import type { BattleRng } from './battleRng';
import type { BattleState, PlannedAction } from './battleTypes';
import { actorById, effectiveParameter } from './battleState';

/** Base initiative only. Double-SPD and act-last WAZADATA flags remain deferred. */
export function calculateActionOrder(state: BattleState, actions: PlannedAction[], rng: BattleRng): string[] {
  // Counters consume no initiative draw and retain stable party-position order.
  const normal = actions.filter(a => a.priority !== 'counter-last');
  const counter = actions.filter(a => a.priority === 'counter-last');
  for (const action of normal) {
    action.initiative = effectiveParameter(actorById(state, action.actorId), 'spd') + rng.nextIntInclusive(0, 10, 'initiative');
    action.state = action.priority === 'counter-last' ? 'waiting' : 'planned';
  }
  const sort = (group: PlannedAction[]) => group.sort((a, b) => b.initiative! - a.initiative!);
  for (const action of counter) action.state = 'waiting';
  counter.sort((a, b) => comparePartyPosition(state, a, b));
  return [...sort(normal), ...counter].map(a => a.id);
}

/** Cross-party ties use player before enemy, then stable ID; never SPD or RNG. */
export function comparePartyPosition(state: BattleState, a: PlannedAction, b: PlannedAction): number {
  const left = actorById(state, a.actorId), right = actorById(state, b.actorId);
  return (left.side === right.side ? 0 : left.side === 'player' ? -1 : 1)
    || left.position - right.position || left.id.localeCompare(right.id);
}
