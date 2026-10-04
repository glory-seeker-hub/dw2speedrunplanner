import type { BattleActionRecord, BattleSide, BattleState, InterruptResolution, PlannedAction } from './battleTypes';
import type { BattleRng } from './battleRng';
import { actorById } from './battleState';
import { counterDefinition } from './battleReactions';
import { canPayRequiredMp } from './battleEffectCompletion';

export function potentiallyInterruptible(state: BattleState, action: PlannedAction): boolean {
  if (action.guard) return false;
  if (actorById(state, action.actorId).revivedRound === state.round || !actorById(state, action.actorId).isAlive || !['planned', 'waiting'].includes(action.state)
    || action.prepared?.interruptConsumed || action.kind === 'interrupt' || action.skill.canonicalSkillId === 0x4d) return false;
  if (action.counter && !['waiting', 'untriggered-end-of-turn'].includes(action.counter.executionMode)) return false;
  return !counterDefinition(action)?.effects.some(e => e.kind === 'action-protection' && e.against === 'interrupt');
}
const waitingUsers = (state: BattleState, side: BattleSide) => state.plannedActions.filter(a => a.round === state.round
  && ['planned', 'waiting'].includes(a.state)
  && actorById(state, a.actorId).revivedRound !== state.round && a.interrupt?.state === 'waiting' && actorById(state, a.actorId).side === side && actorById(state, a.actorId).isAlive
  && canPayRequiredMp(actorById(state, a.actorId), a.skill));

/** The queue supplies opportunities in execution order; Player users match their fixed intention. */
export function claimInterrupt(state: BattleState, target: PlannedAction, rng: BattleRng): PlannedAction | null {
  const prep = target.prepared;
  if (!prep || prep.initialAccuracy.outcome !== 'hit' || !potentiallyInterruptible(state, target)) return null;
  const side = actorById(state, target.actorId).side === 'player' ? 'enemy' : 'player';
  const users = waitingUsers(state, side).filter(a => side === 'enemy' || a.targetIntent.kind === 'combatants' && a.targetIntent.targetIds.includes(target.actorId));
  if (!users.length) return null;
  const user = users.length === 1 ? users[0] : users[rng.nextIntExclusive(users.length, 'interrupt-user-choice')];
  user.interrupt!.state = 'executing'; user.interrupt!.targetActionId = target.id; user.interrupt!.interruptedActorId = target.actorId;
  user.state = 'planned';
  prep.interruptConsumed = true; prep.interruptedByActionId = user.id;
  prep.resolution = { targetActionId: target.id, targetActorId: target.actorId, targetActorName: actorById(state, target.actorId).name,
    executorId: user.actorId, targetPolicy: side === 'player' ? 'player-selected' : 'enemy-first-attacker', initialTargetOutcome: 'hit',
    restarted: false, cancelled: false, sentLast: false };
  state.queue.unshift(user.id, target.id);
  return user;
}
/** Called once on the Interrupt's completed Hit. Modifiers live on the original target action. */
export function resolveInterruptEffects(state: BattleState, interrupt: PlannedAction, entry: BattleActionRecord, rng: BattleRng): void {
  const target = state.plannedActions.find(a => a.id === interrupt.interrupt!.targetActionId)!;
  const prep = target.prepared!, audit = prep.resolution!, actor = actorById(state, target.actorId);
  audit.interruptOutcome = entry.outcome as 'hit' | 'miss';
  if (entry.outcome !== 'hit') return;
  if (entry.impacts.some(i => i.statusApplications.some(s => s.status === 'confusion' && s.applied))) {
    actor.confusionSuppressedForActionId = target.id; audit.confusionSuppressedForActionId = target.id;
  }
  const user = actorById(state, interrupt.actorId);
  if (counterDefinition(interrupt)?.effects.some(e => e.kind === 'drain' && e.mode === 'interrupted-tech-cost')) {
    const gain = Math.min(user.maxMp - user.currentMp, counterDefinition(target)?.mpCost ?? 0);
    user.currentMp += gain; entry.resourceDiagnostics.push(`Interrupt MP gained: ${gain}`);
    if (entry.mpAccounting) entry.mpAccounting.after = user.currentMp;
  }
  for (const effect of counterDefinition(interrupt)?.effects ?? []) {
    if (effect.kind !== 'interrupt-modifier') continue;
    if (effect.modifier === 'cancel-action' && effect.chancePercent === 87.5) {
      if (actor.isBoss) audit.deletionImmunity = 'boss';
      else { audit.deleteActionRoll = rng.nextIntExclusive(8, 'interrupt-delete-action'); audit.cancelled = audit.deleteActionRoll < 7; }
      if (audit.cancelled) { audit.cancellationReason = 'action-deleted'; break; }
    }
    if (effect.modifier === 'force-miss' && effect.chancePercent === 66) {
      audit.forcedMissRoll = rng.nextIntExclusive(3, 'interrupt-force-miss'); audit.forceMiss = audit.forcedMissRoll < 2;
    }
    if (effect.modifier === 'reduce-action-damage') {
      if (effect.reductionPercent === 70.3125) audit.damageRetained = { numerator: 38, denominator: 128 };
      if (effect.reductionPercent === 39.84375) audit.damageRetained = { numerator: 77, denominator: 128 };
    }
    if (effect.modifier === 'target-acts-last') audit.sentLast = true;
  }
  if (!actor.isAlive) { audit.cancelled = true; audit.cancellationReason = 'actor-ko'; }
  if (audit.sentLast && !audit.cancelled) {
    state.queue = state.queue.filter(id => id !== target.id); state.queue.push(target.id);
  }
}
/** Final outgoing damage, including Poison bonus, is reduced exactly once. */
export function reduceInterruptedDamage(damage: number, audit?: InterruptResolution): number {
  const fraction = audit?.damageRetained;
  return fraction ? Number(BigInt(damage) * BigInt(fraction.numerator) / BigInt(fraction.denominator)) : damage;
}
