import type { BattleActionRecord, BattleEngineOptions, BattleInput, BattleRunResult, BattleState, PlannedAction } from './battleTypes';
import { BattleInputError } from './battleTypes';
import { createProductionBattleRng } from './battleRng';
import { createBattleState } from './battleInput';
import { actorById, completedOutcome, validateCombatant } from './battleState';
import { legacyActionPolicy, planAction, revalidateAction } from './battleActions';
import { calculateActionOrder } from './battleOrder';
import { livingOpponents, resolveEffectiveTargets } from './battleTargets';
import { calculateActionDamage } from './battleDamage';
import { afterLegacyAction, applyLegacyImpactEffects, beforeLegacyAction, legacyChainContinues } from './battleLegacyEffects';
import { completeCounter, promoteCounters, counterForcesMiss, counterTargetForm, counterDefinition, usesActivatedCounterMechanics, waitingTailBlade } from './battleReactions';
import { classifySkillTiming, resolveActionTiming, summarizeBattleTiming } from './battleTiming';
import { accountActionMp, depletionAlert } from './battleResources';
import { scheduleShadowScytheRepeat, SHADOW_SCYTHE_ID } from './battleChains';
import { recoverStatuses, statusSnapshot, resolveImpactStatuses } from './battleStatuses';
import { prepareConfusionAction } from './battleConfusion';
import { claimInterrupt, refreshPlayerReservations, resolveInterruptEffects, reduceInterruptedDamage } from './battleInterrupts';
import { resolveActionAccuracy } from './battleAccuracy';

export const BATTLE_ENGINE_VERSION = '2k-g-authoritative-interrupts-v1';
export const DEFAULT_MAX_ROUNDS = 1000;
export function simulateBattleCore(input: BattleInput, options: BattleEngineOptions = {}): BattleRunResult {
  const rng = options.rng ?? createProductionBattleRng();
  const policy = options.actionPolicy ?? legacyActionPolicy;
  let state: BattleState = { combatants: [], plannedActions: [], queue: [], round: 0, nextActionNumber: 1, simulationIndex: options.simulationIndex ?? 0 };
  const records: BattleActionRecord[] = [];
  let executionCount = 0;
  const result = (outcome: BattleRunResult['outcome'], diagnostics: string[] = []): BattleRunResult => ({
    engineVersion: BATTLE_ENGINE_VERSION, outcome, winner: outcome === 'player-win' ? 'player' : outcome === 'enemy-win' ? 'enemy' : null,
    rounds: state.round, actionCount: executionCount, actions: records, state, diagnostics,
    ...summarizeBattleTiming(records),
  });
  const record = (action: PlannedAction, reason?: string): BattleActionRecord => {
    const actor = actorById(state, action.actorId);
    const entry: BattleActionRecord = {
      id: action.id, round: action.round, sequence: records.length + 1, actorId: actor.id, actorName: actor.name,
      skillKey: action.skill?.key ?? null, skillName: action.skill?.legacyTech.name ?? null, canonicalSkillId: action.skill?.canonicalSkillId ?? null,
      kind: action.kind, source: action.skill.source, targetIntent: structuredClone(action.targetIntent),
      effectiveTargetIds: [], impacts: [], counter: action.counter ? { ...action.counter } : null, reaction: action.reaction ? { ...action.reaction } : null,
      state: action.state, outcome: action.state === 'cancelled' ? 'cancelled' : 'skipped',
      timingClass: classifySkillTiming(action.skill), durationFrames: null, timingDiagnostics: [],
      chainFromActionId: action.chainFromActionId, resourceAlerts: [], resourceDiagnostics: [], mpAccounting: null,
      accuracy: null, statusesBefore: statusSnapshot(actor), statusesAfterRecovery: statusSnapshot(actor), statusRecoveries: [], confusion: null,
      ...(reason ? { reason } : {}),
    };
    if (action.prepared?.interruptedByActionId) {
      entry.interrupt = action.prepared.resolution;
      entry.restart = { wasInterrupted: true, interruptedByActionId: action.prepared.interruptedByActionId,
        initialAccuracyResolution: action.prepared.initialAccuracy, recoverySuppressedOnRestart: true,
        targetLocked: true, skillLocked: true, statusesAtRestart: statusSnapshot(actor) };
    }
    records.push(entry); return entry;
  };
  const finishUnusedInterrupts = () => {
    for (const action of state.plannedActions.filter(a => a.round === state.round && a.interrupt?.state === 'waiting')) {
      action.interrupt!.state = 'skipped-no-opportunity'; action.state = 'skipped'; record(action, 'interrupt-no-eligible-target');
    }
  };
  const finishPending = () => {
    for (const id of state.queue.splice(0)) {
      const action = state.plannedActions.find(a => a.id === id)!;
      if (action.state !== 'cancelled') action.state = 'skipped';
      if (action.prepared?.resolution?.cancelled) action.state = 'cancelled';
      record(action, action.prepared?.resolution?.cancelled ? 'cancelled-by-interrupt' : 'battle-ended'); completeCounter(action);
      delete actorById(state, action.actorId).confusionSuppressedForActionId;
    }
    finishUnusedInterrupts();
  };
  try {
    const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;
    if (!Number.isSafeInteger(maxRounds) || maxRounds < 1) throw new BattleInputError('maxRounds must be a positive safe integer.');
    if (!Number.isSafeInteger(state.simulationIndex) || state.simulationIndex < 0) throw new BattleInputError('Invalid simulation index.');
    state = createBattleState(input, state.simulationIndex);
    let outcome = completedOutcome(state);
    if (outcome) return result(outcome);
    for (let round = 1; round <= maxRounds; round++) {
      state.round = round;
      const eligible = state.combatants.filter(a => a.isAlive);
      const actions = eligible.map(actor => {
        validateCombatant(actor);
        return planAction(state, actor, policy.chooseAction(actor, { round, combatants: state.combatants }, rng));
      });
      // beforeActionOrder: future priority/status flags attach here.
      state.queue = calculateActionOrder(state, actions, rng);
      const acted = new Set<string>();
      const playerReservations = new Set<string>();
      while (state.queue.length) {
        refreshPlayerReservations(state, playerReservations, rng);
        const nextId = state.queue.shift()!;
        const action = state.plannedActions.find(a => a.id === nextId)!;
        const reason = action.prepared?.resolution?.cancelled ? 'cancelled-by-interrupt' : revalidateAction(state, action);
        if (reason || (acted.has(action.actorId) && !action.chainFromActionId)) {
          action.state = reason === 'cancelled-by-interrupt' ? 'cancelled' : 'skipped';
          delete actorById(state, action.actorId).confusionSuppressedForActionId;
          record(action, reason ?? 'already-acted'); completeCounter(action); continue;
        }
        const actor = actorById(state, action.actorId);
        if (!action.prepared) {
          if (action.counter?.executionMode === 'waiting') action.counter.executionMode = 'untriggered-end-of-turn';
          const statusesBefore = statusSnapshot(actor);
          const statusRecoveries = action.chainFromActionId || action.kind === 'interrupt' ? [] : recoverStatuses(actor, rng);
          const statusesAfterRecovery = statusSnapshot(actor);
          const confusion = prepareConfusionAction(state, actor, action, policy, rng);
          if (action.counter && (confusion.redirected || confusion.skipped)) {
            action.counter.activatedMechanics = false; action.counter.replacedByConfusion = true;
            action.counter.targetRule = 'confusion-replacement';
          }
          const recordSkipped = (reason: string) => Object.assign(record(action, reason), { statusesBefore, statusesAfterRecovery, statusRecoveries, confusion });
          if (confusion.skipped) {
            action.state = 'skipped'; acted.add(actor.id); recordSkipped('confusion-no-eligible-skill'); completeCounter(action); continue;
          }
          if (action.kind === 'assist') {
            action.state = 'skipped'; const entry = recordSkipped('future-mechanic-unsupported'); entry.outcome = 'unsupported';
            entry.accuracy = resolveActionAccuracy(actor, 'assist', [], rng); finishPending();
            return result('unsupported', ['assist resolution is deferred.']);
          }
          const targetIds = action.interrupt ? [action.interrupt.interruptedActorId!] : resolveEffectiveTargets(state, action, rng, confusion.redirected);
          if (!targetIds.length) { action.state = 'skipped'; recordSkipped('no-living-targets'); completeCounter(action); continue; }
          const initialAccuracy = counterForcesMiss(action)
            ? { outcome: 'miss' as const, cause: 'counter-not-activated' as const, referenceTargetId: null }
            : resolveActionAccuracy(actor, action.kind, targetIds.map(id => actorById(state, id)), rng,
                targetIds.length === 1 && waitingTailBlade(state, targetIds[0]));
          action.prepared = { targetIds, statusesBefore, statusesAfterRecovery, statusRecoveries, confusion, initialAccuracy, interruptConsumed: false };
        }
        const prepared = action.prepared;
        if (!prepared.interruptConsumed && claimInterrupt(state, action, playerReservations, rng)) continue;
        const targetIds = prepared.targetIds.filter(id => actorById(state, id).isAlive);
        if (!targetIds.length) { action.state = 'skipped'; record(action, 'no-living-targets'); completeCounter(action); delete actor.confusionSuppressedForActionId; continue; }
        action.state = 'resolving';
        const entry = Object.assign(record(action), { statusesBefore: prepared.statusesBefore, statusesAfterRecovery: prepared.statusesAfterRecovery,
          statusRecoveries: prepared.statusRecoveries, confusion: prepared.confusion });
        if (!action.counter && !prepared.confusion.redirected && targetIds.some(id => actorById(state, id).side === actor.side)) entry.timingClass = 'unknown';
        if (action.kind === 'counter') {
          const form = counterTargetForm(action);
          entry.timingClass = counterDefinition(action)?.targetModes.includes('random-digimon') ? 'unknown'
            : form === 'single' ? 'single-target' : form === 'aoe' ? 'aoe' : 'unknown';
        }
        entry.effectiveTargetIds = [...targetIds];
        acted.add(actor.id); executionCount++;
        beforeLegacyAction(actor, action);
        if (prepared.interruptedByActionId) {
          prepared.resolution!.restarted = true;
          entry.accuracy = prepared.resolution!.forceMiss
            ? { outcome: 'miss', cause: 'interrupt-forced-miss', referenceTargetId: null }
            : resolveActionAccuracy(actor, action.kind, targetIds.map(id => actorById(state, id)), rng,
                targetIds.length === 1 && waitingTailBlade(state, targetIds[0]));
        } else entry.accuracy = prepared.initialAccuracy;
        if (entry.accuracy.outcome === 'unsupported') throw new BattleInputError('Accuracy has no effective target.', 'unsupported');
        entry.outcome = entry.accuracy.outcome;
        accountActionMp(actor, action, entry, state);
        // Full-action Miss retains target IDs but has no impacts or on-hit draws.
        for (let index = 0; entry.outcome === 'hit' && index < targetIds.length; index++) {
          const target = actorById(state, targetIds[index]);
          if (!target.isAlive) continue;
          const baseDamage = calculateActionDamage(actor, target, action, input.floorSpecialty, state);
          const { damage: ordinaryDamage, poisonBonusDamage, statusApplications } = resolveImpactStatuses(target, action.skill, baseDamage, rng, usesActivatedCounterMechanics(action), action.kind === 'interrupt');
          const damage = reduceInterruptedDamage(ordinaryDamage, prepared.resolution);
          const hpBefore = target.currentHp;
          target.currentHp = Math.max(0, hpBefore - damage);
          target.legacy.damageTakenThisTurn = damage;
          const appliedEffects = applyLegacyImpactEffects(actor, target, action, damage);
          target.isAlive = target.side === 'player' || target.currentHp > 0;
          entry.resourceAlerts.push(...depletionAlert(target, 'hp', hpBefore, target.currentHp));
          if (!entry.effectiveTargetIds.includes(target.id)) entry.effectiveTargetIds.push(target.id);
          entry.impacts.push({ targetId: target.id, targetName: target.name, hpBefore, hpAfter: target.currentHp, baseDamage, poisonBonusDamage, statusApplications, damage, ...(prepared.resolution?.damageRetained ? { damageBeforeInterruptReduction: ordinaryDamage } : {}), healing: 0, outcome: target.isAlive ? 'hit' : 'ko', ko: !target.isAlive, appliedEffects });
          // Preserve old generic chain only for Single-target compatibility inputs.
          if (action.skill.canonicalSkillId === null && action.skill.legacyTech.target === 'Single' && legacyChainContinues(action, !target.isAlive)) {
            const remaining = livingOpponents(state, actor.id);
            if (remaining.length) targetIds.push(remaining[rng.nextIntExclusive(remaining.length, 'target-choice')].id);
          }
        }
        if (action.interrupt) {
          resolveInterruptEffects(state, action, entry, rng);
          entry.interrupt = state.plannedActions.find(a => a.id === action.interrupt!.targetActionId)!.prepared!.resolution;
          action.interrupt.state = 'resolved';
        }
        delete actor.confusionSuppressedForActionId;
        afterLegacyAction(actor);
        action.state = 'resolved'; entry.state = 'resolved';
        // Custom legacy chains have no measured multi-execution timing claim.
        const timing = resolveActionTiming({ actionKind: action.kind, timingClass: entry.timingClass,
          effectiveTargetCount: entry.effectiveTargetIds.length, outcome: entry.outcome });
        entry.durationFrames = timing.durationFrames; entry.timingDiagnostics = timing.diagnostics;
        if (timing.interruptTiming) entry.interruptTiming = timing.interruptTiming;
        if (action.skill.canonicalSkillId === SHADOW_SCYTHE_ID) scheduleShadowScytheRepeat(state, action, entry);
        // Promotion occurs after all impacts, ahead of any queued chain repeat.
        promoteCounters(state, action, entry, acted);
        completeCounter(action);
        outcome = completedOutcome(state);
        if (outcome) { finishPending(); return result(outcome); }
      }
      finishUnusedInterrupts();
      // No round-based status recovery, cure or Poison tick.
    }
    return result('limit-reached', [`Operational maxRounds (${maxRounds}) reached; no winner assigned.`]);
  } catch (error) {
    if (!(error instanceof BattleInputError)) throw error; // RNG exhaustion and programming failures stay loud.
    for (const action of state.plannedActions) if (action.state === 'resolving') action.state = 'cancelled';
    for (const entry of records) if (entry.state === 'resolving') { entry.state = 'cancelled'; entry.outcome = 'invalid'; entry.reason = error.message; }
    finishPending();
    return result(error.outcome, [error.message]);
  }
}
