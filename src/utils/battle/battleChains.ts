import type { BattleActionRecord, BattleState, PlannedAction } from './battleTypes';
import { nextActionId } from './battleActions';

/** Reviewed engine exception from Phase 2K-D, not a decoded generic ROM flag. */
export const SHADOW_SCYTHE_ID = 0x4d;
export function shadowScytheCanRepeat(entry: BattleActionRecord): boolean {
  return entry.canonicalSkillId === SHADOW_SCYTHE_ID && entry.kind === 'attack' && entry.state === 'resolved'
    && entry.outcome === 'hit' && entry.impacts.length === 1 && entry.impacts[0].ko;
}
export function scheduleShadowScytheRepeat(state: BattleState, action: PlannedAction, entry: BattleActionRecord): PlannedAction | null {
  // Only actual enemy KOs trigger this reviewed rule. Zero-HP players stay active.
  if (!shadowScytheCanRepeat(entry) || !state.combatants.some(a => a.id === entry.impacts[0].targetId && a.side === 'enemy')
    || !state.combatants.some(a => a.side === 'enemy' && a.isAlive)) return null;
  const repeat: PlannedAction = { ...action, id: nextActionId(state), state: 'waiting',
    targetIntent: { kind: 'opponents', side: 'enemy', selection: 'random-at-execution' },
    chainFromActionId: action.id, reaction: null, prepared: undefined, interrupt: undefined };
  state.plannedActions.push(repeat); state.queue.unshift(repeat.id);
  return repeat;
}
