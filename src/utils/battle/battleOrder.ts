import { effectsOf } from './battleEffectCompletion';
import type { BattleRng } from './battleRng';
import type { BattleState, PlannedAction } from './battleTypes';
import { actorById, effectiveParameter } from './battleState';

/** Queue-only skill modifiers; stored SPD and accuracy SPD are unchanged. */
export function calculateActionOrder(state: BattleState, actions: PlannedAction[], rng: BattleRng): string[] {
  actions = actions.filter(a=>a.state !== 'skipped');
  // Counters consume no initiative draw and retain stable party-position order.
  const normal = actions.filter(a => a.priority === 'normal');
  for (const action of actions.filter(a => a.kind === 'interrupt')) action.state = 'waiting';
  const counter = actions.filter(a => a.priority === 'counter-last');
  for (const action of normal) {
    action.initiative = effectiveParameter(actorById(state, action.actorId), 'spd') * (effectsOf(action.skill).some(e => e.kind === 'initiative-modifier' && e.modifier === 'double-speed') ? 2 : 1) + rng.nextIntInclusive(0, 10, 'initiative');
    action.state = action.priority === 'counter-last' ? 'waiting' : 'planned';
  }
  const sort = (group: PlannedAction[]) => group.sort((a, b) => b.initiative! - a.initiative!);
  for (const action of counter) action.state = 'waiting';
  counter.sort((a, b) => comparePartyPosition(state, a, b));
  const last = (a: PlannedAction) => effectsOf(a.skill).some(e => e.kind === 'initiative-modifier' && e.modifier === 'act-last');
  return [...sort(normal.filter(a=>!last(a))), ...counter, ...sort(normal.filter(last))].map(a => a.id);
}

/** Cross-party ties use player before enemy, then stable ID; never SPD or RNG. */
export function comparePartyPosition(state: BattleState, a: PlannedAction, b: PlannedAction): number {
  const left = actorById(state, a.actorId), right = actorById(state, b.actorId);
  return (left.side === right.side ? 0 : left.side === 'player' ? -1 : 1)
    || left.position - right.position || left.id.localeCompare(right.id);
}
