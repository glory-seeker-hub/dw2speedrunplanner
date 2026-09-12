import { getBattleSkillById } from '@/data/battleSkills';
import type { BattleActionRecord, BattleCombatantState, BattleResourceAlert, PlannedAction } from './battleTypes';

export function depletionAlert(actor: BattleCombatantState, resource: 'hp' | 'mp', before: number, after: number): BattleResourceAlert[] {
  return actor.side === 'player' && before > 0 && after === 0
    ? [{ kind: resource === 'hp' ? 'player-hp-depleted' : 'player-mp-depleted', combatantId: actor.id, combatantName: actor.name }]
    : [];
}
export function accountActionMp(actor: BattleCombatantState, action: PlannedAction, entry: BattleActionRecord): void {
  const canonical = action.skill.canonicalSkillId === null ? undefined : getBattleSkillById(action.skill.canonicalSkillId);
  const before = actor.currentMp;
  let cost: number | null = null;
  if (canonical?.effects.some(e => e.kind === 'counter-payment')) {
    // Preserve the previous no-payment path until the actual Counter payer is resolved.
    entry.resourceDiagnostics.push(`0x${canonical.id.toString(16).toUpperCase()} ${canonical.name}: enemy Counter payer unresolved; legacy no-payment compatibility retained.`);
  } else if (canonical) cost = action.chainFromActionId && canonical.id === 0x4d ? 0 : canonical.mpCost;
  else entry.resourceDiagnostics.push('No authoritative MP cost for this custom/synthetic technique; legacy no-payment compatibility retained.');
  actor.currentMp = Math.max(0, before - (cost ?? 0));
  entry.mpAccounting = { before, costCharged: cost, after: actor.currentMp, completeness: cost === null ? 'incomplete' : 'complete' };
  entry.resourceAlerts.push(...depletionAlert(actor, 'mp', before, actor.currentMp));
}
export function resourceAlertText(alert: BattleResourceAlert): string {
  return alert.kind === 'player-hp-depleted'
    ? `${alert.combatantName} reached 0 HP. An additional recovery/revival action is required in-game but is not counted by this simulator.`
    : `${alert.combatantName} reached 0 MP. An additional Guard/item action is required in-game but is not counted by this simulator.`;
}
