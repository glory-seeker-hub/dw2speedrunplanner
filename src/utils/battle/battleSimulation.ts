import { initializeMotivation, clearRoundEffects, copyNegativeStatuses, randomTarget, necroTarget, bypassAccuracy, postUseHalfDefense, effectsOf } from './battleEffectCompletion';
import { classifyEffect } from './battleEffectCoverage';
import { getBattleSkillById } from '@/data/battleSkills';
import { assistEligible, assistCandidateIds, chooseAssistTargets, assistTargetsAtExecution, isRevive, applySupportEffects } from './battleSupportEffects';
import type { BattleActionRecord, BattleEngineOptions, BattleInput, BattleRunResult, BattleState, PlannedAction } from './battleTypes';
import { BattleInputError } from './battleTypes';
import { createProductionBattleRng } from './battleRng';
import { createBattleState } from './battleInput';
import { actorById, completedOutcome, validateCombatant } from './battleState';
import { legacyActionPolicy, planAction, revalidateAction } from './battleActions';
import { calculateActionOrder } from './battleOrder';
import { livingOpponents, resolveEffectiveTargets } from './battleTargets';
import { calculateActionDamage, getTypeBonus } from './battleDamage';
import { afterLegacyAction, applyLegacyImpactEffects, beforeLegacyAction, legacyChainContinues } from './battleLegacyEffects';
import { completeCounter, promoteCounters, counterForcesMiss, counterTargetForm, counterDefinition, usesActivatedCounterMechanics, waitingTailBlade } from './battleReactions';
import { classifySkillTiming, resolveActionTiming, summarizeBattleTiming } from './battleTiming';
import { accountActionMp, depletionAlert } from './battleResources';
import { scheduleShadowScytheRepeat, SHADOW_SCYTHE_ID } from './battleChains';
import { recoverStatuses, statusSnapshot, resolveImpactStatuses } from './battleStatuses';
import { prepareConfusionAction } from './battleConfusion';
import { claimInterrupt, refreshPlayerReservations, resolveInterruptEffects, reduceInterruptedDamage } from './battleInterrupts';
import { resolveSimulationRules } from './battleSimulationRules';
import { resolveActionAccuracy } from './battleAccuracy';

export const BATTLE_ENGINE_VERSION = '2k-h-authoritative-support-v1';
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
      effectDiagnostics: getBattleSkillById(action.skill.canonicalSkillId ?? -1)?.effects.flatMap(e => { const coverage = classifyEffect(e, getBattleSkillById(action.skill.canonicalSkillId!)!); return coverage.status === 'deferred-unresolved' ? [coverage.boundary] : []; }) ?? [],
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
      action.interrupt!.state = 'skipped-no-opportunity'; action.state = 'skipped'; record(action, actorById(state, action.actorId).revivedRound === state.round ? 'revived-this-round' : 'interrupt-no-eligible-target');
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
    const rules = resolveSimulationRules(options.simulationRules);
    const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;
    if (!Number.isSafeInteger(maxRounds) || maxRounds < 1) throw new BattleInputError('maxRounds must be a positive safe integer.');
    if (!Number.isSafeInteger(state.simulationIndex) || state.simulationIndex < 0) throw new BattleInputError('Invalid simulation index.');
    state = createBattleState(input, state.simulationIndex);
    for (const actor of state.combatants) initializeMotivation(actor, rng);
    let outcome = completedOutcome(state);
    if (outcome) return result(outcome);
    for (let round = 1; round <= maxRounds; round++) {
      state.round = round;
      clearRoundEffects(state);
      options.playerDecisions?.beforeRound(state);
      const eligible = state.combatants.filter(a => a.isAlive);
      const actions = eligible.map(actor => {
        validateCombatant(actor);
        const action = planAction(state, actor, (actor.side === 'player' ? options.playerDecisions?.chooseAction(actor, state) : undefined) ?? policy.chooseAction(actor, { round, combatants: state.combatants }, rng));
        if (actor.side === 'player') options.playerDecisionObserver?.planned(state, action);
        if (action.state === 'skipped') record(action, 'no-legal-technique');
        return action;
      });
      for (const action of actions) {
        const actor = actorById(state, action.actorId);
        if (action.kind === 'assist' && !action.guard) {
          action.assistEligibleAtPlanning = assistEligible(actor, action.skill, state.combatants);
          if (action.assistEligibleAtPlanning) action.assistCandidateIds = assistCandidateIds(state, action);
          if (!necroTarget(action.skill) && !actor.statuses.confusion && action.assistEligibleAtPlanning) action.assistTargetIds = chooseAssistTargets(state, action, rng);
        }
      }
      // Lock ordinary Single targets in visibility-sensitive rounds. Existing reaction
      // causal locks and Confusion replacement remain authoritative at execution.
      const visibilitySensitive = state.combatants.some(a => a.statuses.invisibility) || actions.some(a => getBattleSkillById(a.skill.canonicalSkillId ?? -1)?.effects.some(e => e.kind === 'special-state' && e.state === 'invisibility'));
      if (visibilitySensitive) for (const action of actions) {
        if (!randomTarget(action.skill) && action.kind === 'attack' && action.skill.legacyTech.target === 'Single' && action.targetIntent.kind === 'opponents' && !actorById(state, action.actorId).statuses.confusion) {
          action.targetIntent = { kind: 'combatants', targetIds: resolveEffectiveTargets(state, action, rng) };
          if (actorById(state, action.actorId).side === 'player') options.playerDecisionObserver?.selectedTargets(state, action, action.targetIntent.targetIds);
        }
      }
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
        if (action.guard) {
          action.state = 'resolved'; acted.add(actor.id); executionCount++;
          const entry = record(action, 'Guard — Motivation Down');
          entry.kind = 'guard'; entry.outcome = 'guard'; entry.durationFrames = 194; entry.targetIntent = { kind: 'combatants', targetIds: [] };
          entry.statusRecoveries = recoverStatuses(actor, rng, rules.rngPolicy); entry.statusesAfterRecovery = statusSnapshot(actor);
          entry.mpAccounting = { before: actor.currentMp, after: actor.currentMp, costCharged: 0, completeness: 'complete', payerCombatantId: null, payerName: null, payerSide: null, paymentRule: 'guard-no-cost' };
          continue;
        }
        if (!action.prepared) {
          if (action.counter?.executionMode === 'waiting') action.counter.executionMode = 'untriggered-end-of-turn';
          const statusesBefore = statusSnapshot(actor);
          const statusRecoveries = action.chainFromActionId || action.kind === 'interrupt' ? [] : recoverStatuses(actor, rng, rules.rngPolicy);
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
          if (action.kind === 'assist' && action.assistEligibleAtPlanning === false) {
            action.state = 'skipped'; acted.add(actor.id); recordSkipped('assist-ineligible'); continue;
          }
          const targetIds = action.kind === 'assist' ? assistTargetsAtExecution(state, action, rng)
            : action.interrupt ? [action.interrupt.interruptedActorId!] : resolveEffectiveTargets(state, action, rng, confusion.redirected);
          if (actor.side === 'player' && action.kind === 'attack' && !confusion.redirected) options.playerDecisionObserver?.selectedTargets(state, action, targetIds);
          if (!targetIds.length && !randomTarget(action.skill) && !necroTarget(action.skill)) { action.state = 'skipped'; recordSkipped('no-living-targets'); completeCounter(action); continue; }
          const assistLost = action.kind === 'assist' && !necroTarget(action.skill) && !isRevive(action.skill) && targetIds.length === 1 && actorById(state, targetIds[0]).currentHp === 0;
          const initialAccuracy = !targetIds.length ? { outcome: 'miss' as const, cause: 'no-effective-target' as const, referenceTargetId: null } : assistLost ? { outcome: 'miss' as const, cause: 'assist-target-lost' as const, referenceTargetId: targetIds[0] } : counterForcesMiss(action)
            ? { outcome: 'miss' as const, cause: 'counter-not-activated' as const, referenceTargetId: null }
            : resolveActionAccuracy(actor, action.kind, targetIds.map(id => actorById(state, id)), rng,
                targetIds.length === 1 && waitingTailBlade(state, targetIds[0]), rules.accuracyMode, rules.rngPolicy, bypassAccuracy(action.skill));
          action.prepared = { targetIds, statusesBefore, statusesAfterRecovery, statusRecoveries, confusion, initialAccuracy, interruptConsumed: false };
        }
        const prepared = action.prepared;
        if (!prepared.interruptConsumed && claimInterrupt(state, action, playerReservations, rng)) continue;
        const targetIds = prepared.targetIds.filter(id => action.kind === 'assist' || actorById(state, id).isAlive);
        if (!targetIds.length && !randomTarget(action.skill) && !necroTarget(action.skill)) { action.state = 'skipped'; record(action, 'no-living-targets'); completeCounter(action); delete actor.confusionSuppressedForActionId; continue; }
        action.state = 'resolving';
        const entry = Object.assign(record(action), { statusesBefore: prepared.statusesBefore, statusesAfterRecovery: prepared.statusesAfterRecovery,
          statusRecoveries: prepared.statusRecoveries, confusion: prepared.confusion });
        if (action.kind !== 'assist' && !action.counter && !prepared.confusion.redirected && !randomTarget(action.skill) && targetIds.some(id => actorById(state, id).side === actor.side)) entry.timingClass = 'unknown';
        if (action.kind === 'counter') {
          const form = counterTargetForm(action);
          entry.timingClass = counterDefinition(action)?.targetModes.includes('random-digimon') ? 'single-target'
            : form === 'single' ? 'single-target' : form === 'aoe' ? 'aoe' : 'unknown';
        }
        entry.supportEvents = [];
        if (actor.statusRecoveryBlocked) (entry.effectAudit ??= []).push('Natural status recovery blocked for this round');
        entry.effectiveTargetIds = [...targetIds];
        acted.add(actor.id); executionCount++;
        beforeLegacyAction(actor, action);
        if (prepared.interruptedByActionId) {
          prepared.resolution!.restarted = true;
          entry.accuracy = prepared.resolution!.forceMiss
            ? { outcome: 'miss', cause: 'interrupt-forced-miss', referenceTargetId: null }
            : resolveActionAccuracy(actor, action.kind, targetIds.map(id => actorById(state, id)), rng,
                targetIds.length === 1 && waitingTailBlade(state, targetIds[0]), rules.accuracyMode, rules.rngPolicy, bypassAccuracy(action.skill));
        } else entry.accuracy = prepared.initialAccuracy;
        if (entry.accuracy.outcome === 'unsupported') throw new BattleInputError('Accuracy has no effective target.', 'unsupported');
        entry.outcome = entry.accuracy.outcome;
        accountActionMp(actor, action, entry, state);
        if (entry.accuracy.standardRollSkipped && bypassAccuracy(action.skill)) (entry.effectAudit ??= []).push('Standard accuracy bypassed — ' + action.skill.legacyTech.name);
        if (entry.outcome === 'hit' && action.skill.canonicalSkillId === 0xf4) {
          action.effectiveElement = (['Water','Fire','Nature','Machine','Darkness'] as const)[rng.nextIntExclusive(5,'fantasmic-element')];
          (entry.effectAudit ??= []).push('Random attack element: ' + action.effectiveElement);
        }
        if (entry.outcome === 'hit' && actor.statuses.poison && effectsOf(action.skill).some(e=>e.kind==='damage-modifier' && e.condition==='user-poisoned')) (entry.effectAudit ??= []).push('Party Time AP bonus: user Poisoned → ×1.5');
        // Full-action Miss retains target IDs but has no impacts or on-hit draws.
        for (let index = 0; entry.outcome === 'hit' && index < targetIds.length; index++) {
          const target = actorById(state, targetIds[index]);
          if (necroTarget(action.skill)) {
            const amount = Math.max(0, Math.min(100, target.currentMp, actor.maxMp - actor.currentMp));
            target.currentMp -= amount; actor.currentMp += amount;
            entry.resourceDiagnostics.push(`Necro MP transfer: ${amount} from ${target.name}`);
            if (entry.mpAccounting) entry.mpAccounting.after = actor.currentMp;
            entry.impacts.push({ targetId: target.id, targetName: target.name, hpBefore: target.currentHp, hpAfter: target.currentHp, baseDamage: 0, poisonBonusDamage: 0, statusApplications: [], damage: 0, healing: 0, outcome: 'hit', ko: false, appliedEffects: [] });
            continue;
          }
          if (action.kind === 'assist') {
            const hpBefore = target.currentHp;
            const events = [...applySupportEffects(state, actor, target, action, 'pre-damage'), ...applySupportEffects(state, actor, target, action, 'after-damage')];
            entry.supportEvents.push(...events);
            if (target.hpRecoveryBlocked) (entry.effectAudit ??= []).push('HP recovery blocked — fixed healing only');
            if (target.statusRecoveryBlocked) (entry.effectAudit ??= []).push('Status recovery blocked');
            entry.impacts.push({ targetId: target.id, targetName: target.name, hpBefore, hpAfter: target.currentHp, baseDamage: 0, poisonBonusDamage: 0, statusApplications: [], damage: 0, healing: target.currentHp - hpBefore, outcome: 'hit', ko: false, appliedEffects: [] });
            continue;
          }
          if (!target.isAlive) continue;
          entry.supportEvents.push(...applySupportEffects(state, actor, target, action, 'pre-damage'));
          const effects = effectsOf(action.skill);
          const halfHp = effects.some(e => e.kind === 'damage-rule' && e.rule === 'half-current-hp');
          const execute = effects.some(e => e.kind === 'damage-rule' && e.rule === 'execute-below-hp') && target.currentHp * 10 <= target.maxHp;
          const invertHp = effects.some(e => e.kind === 'damage-rule' && e.rule === 'attribute-dependent-heal-or-damage') && getTypeBonus(actor.type, target.type) < 1;
          const baseDamage = halfHp ? Math.floor(target.currentHp / 2) : execute ? target.currentHp : calculateActionDamage(actor, target, action, input.floorSpecialty, state);
          const { damage: statusDamage, poisonBonusDamage: statusPoisonBonus, statusApplications } = resolveImpactStatuses(target, action.skill, baseDamage, rng, usesActivatedCounterMechanics(action), action.kind === 'interrupt', actor, rules.rngPolicy);
          const poisonBonusDamage = halfHp || execute ? 0 : statusPoisonBonus;
          const ordinaryDamage = halfHp || execute ? baseDamage : statusDamage;
          // Exact special HP results bypass ordinary scaling; Invincibility remains the universal prevention gate.
          const beforeInvincibility = halfHp || execute ? ordinaryDamage : reduceInterruptedDamage(ordinaryDamage, prepared.resolution);
          const finalDamage = target.statuses.invincibility ? 0 : beforeInvincibility;
          const damage = invertHp ? 0 : finalDamage;
          const hpBefore = target.currentHp;
          target.currentHp = invertHp ? Math.min(target.maxHp, hpBefore + finalDamage) : Math.max(0, hpBefore - damage);
          const actualHpDamage = Math.max(0, hpBefore - target.currentHp);
          const healing = Math.max(0, target.currentHp - hpBefore);
          if (halfHp || execute || invertHp) (entry.effectAudit ??= []).push(halfHp ? 'HP Zapper: floor(current HP / 2)' : execute ? 'Critical Blow: pre-impact HP × 10 <= Max HP — execute' : 'Musical Fist: type disadvantage, healed target for ' + healing);
          target.legacy.damageTakenThisTurn = damage;
          if (effectsOf(action.skill).some(e=>e.kind==='damage-rule' && e.rule==='additional-mp-damage')) {
            const before = target.currentMp;
            target.currentMp = Math.max(0, before - Math.floor(damage / 2));
            entry.resourceDiagnostics.push('MP damage: ' + (before-target.currentMp));
          }
          if (effectsOf(action.skill).some(e=>e.kind==='status-transfer')) (entry.effectAudit ??= []).push('Status copied: ' + copyNegativeStatuses(actor,target,rng).join(', '));
          const appliedEffects = applyLegacyImpactEffects(actor, target, action, damage);
          if (effects.some(e => e.kind === 'drain' && e.resource === 'hp')) {
            const before = actor.currentHp;
            actor.currentHp = Math.min(actor.maxHp, before + actualHpDamage);
            appliedEffects.push({ source: 'canonical', kind: 'drain', combatantId: actor.id, amount: actor.currentHp - before });
          }
          entry.supportEvents.push(...applySupportEffects(state, actor, target, action, 'after-damage'));
          if (target.side !== actor.side && target.statuses['poison-body'] && !entry.supportEvents.some(e => e.kind === 'poison-body')) {
            entry.supportEvents.push({ kind: 'poison-body', targetId: actor.id, holderId: target.id, alreadyActive: !!actor.statuses.poison }); actor.statuses.poison = true;
          }
          target.isAlive = target.side === 'player' || target.currentHp > 0;
          entry.resourceAlerts.push(...depletionAlert(target, 'hp', hpBefore, target.currentHp));
          if (!entry.effectiveTargetIds.includes(target.id)) entry.effectiveTargetIds.push(target.id);
          entry.impacts.push({ targetId: target.id, targetName: target.name, hpBefore, hpAfter: target.currentHp, baseDamage, poisonBonusDamage, statusApplications, damage, ...(prepared.resolution?.damageRetained ? { damageBeforeInterruptReduction: ordinaryDamage } : {}), healing, ...(action.effectiveElement || actor.elementalPower ? { effectiveElement: action.effectiveElement ?? actor.elementalPower! } : {}), ...(target.statuses.invincibility ? { invincibilityPreventedDamage: beforeInvincibility } : {}), outcome: target.isAlive ? 'hit' : 'ko', ko: !target.isAlive, appliedEffects });
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
        if (postUseHalfDefense(action.skill)) { actor.halfDefense = true; (entry.effectAudit ??= []).push('Post-use half DEF for the remainder of this round'); }
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
      clearRoundEffects(state);
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
