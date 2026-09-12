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
import { resolveActionAccuracy } from './battleAccuracy';

export const BATTLE_ENGINE_VERSION = '2k-f-authoritative-counters-v1';
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
    records.push(entry); return entry;
  };
  const finishPending = () => {
    for (const id of state.queue.splice(0)) {
      const action = state.plannedActions.find(a => a.id === id)!;
      if (action.state !== 'cancelled') action.state = 'skipped';
      record(action, 'battle-ended'); completeCounter(action);
    }
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
      while (state.queue.length) {
        const nextId = state.queue.shift()!;
        const action = state.plannedActions.find(a => a.id === nextId)!;
        const reason = revalidateAction(state, action);
        if (reason || (acted.has(action.actorId) && !action.chainFromActionId)) {
          if (action.state !== 'cancelled') action.state = 'skipped';
          record(action, reason ?? 'already-acted'); completeCounter(action); continue;
        }
        const actor = actorById(state, action.actorId);
        if (action.counter?.executionMode === 'waiting') action.counter.executionMode = 'untriggered-end-of-turn';
        const statusesBefore = statusSnapshot(actor);
        const statusRecoveries = action.chainFromActionId ? [] : recoverStatuses(actor, rng);
        const statusesAfterRecovery = statusSnapshot(actor);
        const confusion = prepareConfusionAction(state, actor, action, policy, rng);
        if (action.counter && (confusion.redirected || confusion.skipped)) {
          action.counter.activatedMechanics = false; action.counter.replacedByConfusion = true;
          action.counter.targetRule = 'confusion-replacement';
        }
        const recordPrepared = (reason?: string) => Object.assign(record(action, reason), { statusesBefore, statusesAfterRecovery, statusRecoveries, confusion });
        if (confusion.skipped) {
          action.state = 'skipped'; acted.add(actor.id); recordPrepared('confusion-no-eligible-skill'); completeCounter(action); continue;
        }
        if (action.kind === 'assist') {
          action.state = 'skipped'; const entry = recordPrepared('future-mechanic-unsupported'); entry.outcome = 'unsupported';
          entry.accuracy = resolveActionAccuracy(actor, 'assist', [], rng); finishPending();
          return result('unsupported', [`${action.kind} resolution is deferred.`]);
        }
        const targetIds = resolveEffectiveTargets(state, action, rng, confusion.redirected);
        if (!targetIds.length) { action.state = 'skipped'; recordPrepared('no-living-targets'); completeCounter(action); continue; }
        action.state = 'resolving';
        const entry = recordPrepared();
        if (!action.counter && !confusion.redirected && targetIds.some(id => actorById(state, id).side === actor.side)) entry.timingClass = 'unknown';
        if (action.kind === 'counter') {
          const form = counterTargetForm(action);
          entry.timingClass = counterDefinition(action)?.targetModes.includes('random-digimon') ? 'unknown'
            : form === 'single' ? 'single-target' : form === 'aoe' ? 'aoe' : 'unknown';
        }
        entry.effectiveTargetIds = [...targetIds];
        acted.add(actor.id); executionCount++;
        beforeLegacyAction(actor, action);
        entry.accuracy = counterForcesMiss(action)
          ? { outcome: 'miss', cause: 'counter-not-activated', referenceTargetId: null }
          : resolveActionAccuracy(actor, action.kind, targetIds.map(id => actorById(state, id)), rng,
              targetIds.length === 1 && waitingTailBlade(state, targetIds[0]));
        if (entry.accuracy.outcome === 'unsupported') throw new BattleInputError('Accuracy has no effective target.', 'unsupported');
        entry.outcome = entry.accuracy.outcome;
        accountActionMp(actor, action, entry, state);
        // Full-action Miss retains target IDs but has no impacts or on-hit draws.
        for (let index = 0; entry.outcome === 'hit' && index < targetIds.length; index++) {
          const target = actorById(state, targetIds[index]);
          if (!target.isAlive) continue;
          const baseDamage = calculateActionDamage(actor, target, action, input.floorSpecialty);
          const { damage, poisonBonusDamage, statusApplications } = resolveImpactStatuses(target, action.skill, baseDamage, rng, usesActivatedCounterMechanics(action));
          const hpBefore = target.currentHp;
          target.currentHp = Math.max(0, hpBefore - damage);
          target.legacy.damageTakenThisTurn = damage;
          const appliedEffects = applyLegacyImpactEffects(actor, target, action, damage);
          target.isAlive = target.side === 'player' || target.currentHp > 0;
          entry.resourceAlerts.push(...depletionAlert(target, 'hp', hpBefore, target.currentHp));
          if (!entry.effectiveTargetIds.includes(target.id)) entry.effectiveTargetIds.push(target.id);
          entry.impacts.push({ targetId: target.id, targetName: target.name, hpBefore, hpAfter: target.currentHp, baseDamage, poisonBonusDamage, statusApplications, damage, healing: 0, outcome: target.isAlive ? 'hit' : 'ko', ko: !target.isAlive, appliedEffects });
          // Preserve old generic chain only for Single-target compatibility inputs.
          if (action.skill.canonicalSkillId === null && action.skill.legacyTech.target === 'Single' && legacyChainContinues(action, !target.isAlive)) {
            const remaining = livingOpponents(state, actor.id);
            if (remaining.length) targetIds.push(remaining[rng.nextIntExclusive(remaining.length, 'target-choice')].id);
          }
        }
        afterLegacyAction(actor);
        action.state = 'resolved'; entry.state = 'resolved';
        // Custom legacy chains have no measured multi-execution timing claim.
        const timing = resolveActionTiming({ actionKind: action.kind, timingClass: entry.timingClass,
          effectiveTargetCount: entry.effectiveTargetIds.length, outcome: entry.outcome });
        entry.durationFrames = timing.durationFrames; entry.timingDiagnostics = timing.diagnostics;
        if (action.skill.canonicalSkillId === SHADOW_SCYTHE_ID) scheduleShadowScytheRepeat(state, action, entry);
        // Promotion occurs after all impacts, ahead of any queued chain repeat.
        promoteCounters(state, action, entry, acted);
        completeCounter(action);
        outcome = completedOutcome(state);
        if (outcome) { finishPending(); return result(outcome); }
      }
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
