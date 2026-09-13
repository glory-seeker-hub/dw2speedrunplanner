import type { Ailment } from '@/types/battleSkill';
import type { BattleCombatantState } from './battleTypes';
/** Applies to every source, including future Motivation Down support. */
export function getStatusImmunity(actor: BattleCombatantState, status: Ailment | 'poison-body'): 'boss' | 'enemy' | null {
  if (status === 'confusion' && actor.isBoss) return 'boss';
  if (status === 'motivation-down' && actor.side === 'enemy') return 'enemy';
  return null;
}
