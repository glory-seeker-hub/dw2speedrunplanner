import { counterCostTransfer } from './battleEffectCompletion';
import { usesActivatedCounterMechanics } from './battleReactions';
import { actorById } from './battleState';
import { getBattleSkillById } from '@/data/battleSkills';
import type { BattleActionRecord, BattleCombatantState, BattleResourceAlert, BattleState, PlannedAction } from './battleTypes';

export function depletionAlert(actor: BattleCombatantState, resource: 'hp' | 'mp', before: number, after: number): BattleResourceAlert[] {
  return actor.side === 'player' && before > 0 && after === 0
    ? [{ kind: resource === 'hp' ? 'player-hp-depleted' : 'player-mp-depleted', combatantId: actor.id, combatantName: actor.name }]
    : [];
}
export function accountActionMp(actor: BattleCombatantState, action: PlannedAction, entry: BattleActionRecord, state?: BattleState): void {
  const canonical = action.skill.canonicalSkillId === null ? undefined : getBattleSkillById(action.skill.canonicalSkillId);
  if (entry.outcome === 'miss') {
    entry.mpAccounting = { before: actor.currentMp, after: actor.currentMp, costCharged: 0, completeness: 'complete',
      payerCombatantId: null, payerName: null, payerSide: null, paymentRule: 'none-on-miss' };
    return;
  }
  let payer = actor;
  let paymentRule: NonNullable<BattleActionRecord['mpAccounting']>['paymentRule'] = 'own';
  if (usesActivatedCounterMechanics(action) && (canonical?.effects.some(e => e.kind === 'counter-payment') || counterCostTransfer(action.skill))) {
    if (!state || !action.counter?.triggerActorId) throw new Error('Activated Counter payment requires causal actor.');
    payer = actorById(state, action.counter.triggerActorId); paymentRule = 'counter-triggering-actor';
  }
  const before = payer.currentMp;
  let cost: number | null = canonical?.mpCost ?? null;
  if (action.chainFromActionId && canonical?.id === 0x4d) { cost = 0; paymentRule = 'shadow-scythe-free-repeat'; }
  if (cost === null) {
    paymentRule = 'unknown';
    entry.resourceDiagnostics.push('No authoritative MP cost for this custom/synthetic technique; legacy no-payment compatibility retained.');
  }
  payer.currentMp = Math.max(0, before - (cost ?? 0));
  entry.mpAccounting = { before, costCharged: cost, after: payer.currentMp, completeness: cost === null ? 'incomplete' : 'complete',
    payerCombatantId: payer.id, payerName: payer.name, payerSide: payer.side, paymentRule };
  entry.resourceAlerts.push(...depletionAlert(payer, 'mp', before, payer.currentMp));
}
export function resourceAlertText(alert: BattleResourceAlert): string {
  return alert.kind === 'player-hp-depleted'
    ? `${alert.combatantName} reached 0 HP. An additional recovery/revival action is required in-game but is not counted by this simulator.`
    : `${alert.combatantName} reached 0 MP. An additional Guard/item action is required in-game but is not counted by this simulator.`;
}
