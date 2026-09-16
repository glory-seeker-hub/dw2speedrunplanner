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
  const actor = state.combatants.find(a=>a.id===action.actorId)!;
  const enemyUse = actor.side === 'enemy';
  const causedKo = enemyUse ? entry.canonicalSkillId === SHADOW_SCYTHE_ID && entry.outcome === 'hit' && entry.impacts.length === 1 && entry.impacts[0].hpBefore > 0 && entry.impacts[0].hpAfter === 0 : shadowScytheCanRepeat(entry);
  if (!causedKo || !state.combatants.some(a=>a.side !== actor.side && (enemyUse ? a.currentHp > 0 : a.isAlive))) return null;
  const repeat: PlannedAction = { ...action, id: nextActionId(state), state: 'waiting',
    targetIntent: { kind: 'opponents', side: enemyUse ? 'player' : 'enemy', selection: 'random-at-execution' },
    chainFromActionId: action.id, reaction: null, prepared: undefined, interrupt: undefined };
  state.plannedActions.push(repeat); state.queue.unshift(repeat.id);
  return repeat;
}
