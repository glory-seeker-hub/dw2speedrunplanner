import type { BattleActionRecord, BattleSide, BattleState, InterruptResolution, PlannedAction } from './battleTypes';
import type { BattleRng } from './battleRng';
import { actorById } from './battleState';
import { counterDefinition } from './battleReactions';

export function potentiallyInterruptible(state: BattleState, action: PlannedAction): boolean {
  if (actorById(state, action.actorId).revivedRound === state.round || !actorById(state, action.actorId).isAlive || !['planned', 'waiting'].includes(action.state)
    || action.prepared?.interruptConsumed || action.kind === 'interrupt' || action.kind === 'assist' || action.skill.canonicalSkillId === 0x4d) return false;
  if (action.counter && !['waiting', 'untriggered-end-of-turn'].includes(action.counter.executionMode)) return false;
  return !counterDefinition(action)?.effects.some(e => e.kind === 'action-protection' && e.against === 'interrupt');
}
const waitingUsers = (state: BattleState, side: BattleSide) => state.plannedActions.filter(a => a.round === state.round
  && actorById(state, a.actorId).revivedRound !== state.round && a.interrupt?.state === 'waiting' && actorById(state, a.actorId).side === side && actorById(state, a.actorId).isAlive);

/** Reservations belong to target opportunities, not to an executor. */
export function refreshPlayerReservations(state: BattleState, reserved: Set<string>, rng: BattleRng): void {
  const candidates = state.queue.map(id => state.plannedActions.find(a => a.id === id)!)
    .filter(a => actorById(state, a.actorId).side === 'enemy' && potentiallyInterruptible(state, a));
  for (const id of reserved) if (!candidates.some(a => a.id === id)) reserved.delete(id);
  const count = waitingUsers(state, 'player').length;
  const available = candidates.filter(a => !reserved.has(a.id));
  while (reserved.size < count && available.length) {
    const index = rng.nextIntExclusive(available.length, 'interrupt-target-choice');
    reserved.add(available.splice(index, 1)[0].id);
  }
}
export function claimInterrupt(state: BattleState, target: PlannedAction, reserved: Set<string>, rng: BattleRng): PlannedAction | null {
  const prep = target.prepared;
  if (!prep || prep.initialAccuracy.outcome !== 'hit' || !potentiallyInterruptible(state, target)) { reserved.delete(target.id); return null; }
  const side = actorById(state, target.actorId).side === 'player' ? 'enemy' : 'player';
  if (side === 'player' && !reserved.has(target.id)) return null;
  const users = waitingUsers(state, side);
  if (!users.length) return null;
  const user = users.length === 1 ? users[0] : users[rng.nextIntExclusive(users.length, 'interrupt-user-choice')];
  reserved.delete(target.id);
  user.interrupt!.state = 'executing'; user.interrupt!.targetActionId = target.id; user.interrupt!.interruptedActorId = target.actorId;
  user.targetIntent = { kind: 'combatants', targetIds: [target.actorId] }; user.state = 'planned';
  prep.interruptConsumed = true; prep.interruptedByActionId = user.id;
  prep.resolution = { targetActionId: target.id, targetActorId: target.actorId, targetActorName: actorById(state, target.actorId).name,
    executorId: user.actorId, targetPolicy: side === 'player' ? 'player-random' : 'enemy-first-attacker', initialTargetOutcome: 'hit',
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
