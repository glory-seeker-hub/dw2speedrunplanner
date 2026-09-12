import type { BattleRng } from './battleRng';
import type { BattleState, PlannedAction } from './battleTypes';
import { actorById, effectiveParameter } from './battleState';

/** Base initiative only. Double-SPD and act-last WAZADATA flags remain deferred. */
export function calculateActionOrder(state: BattleState, actions: PlannedAction[], rng: BattleRng): string[] {
  // Preserve legacy draw order: all normals, then all counter intentions.
  const normal = actions.filter(a => a.priority !== 'legacy-counter-last');
  const counter = actions.filter(a => a.priority === 'legacy-counter-last');
  for (const action of [...normal, ...counter]) {
    action.initiative = effectiveParameter(actorById(state, action.actorId), 'spd') + rng.nextIntInclusive(0, 10, 'initiative');
    action.state = action.priority === 'legacy-counter-last' ? 'waiting' : 'planned';
  }
  const sort = (group: PlannedAction[]) => group.sort((a, b) => b.initiative! - a.initiative!);
  return [...sort(normal), ...sort(counter)].map(a => a.id);
}
