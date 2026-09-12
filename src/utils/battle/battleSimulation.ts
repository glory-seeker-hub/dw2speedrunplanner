import type { BattleActionRecord, BattleEngineOptions, BattleInput, BattleRunResult, BattleState, PlannedAction } from './battleTypes';
import { BattleInputError } from './battleTypes';
import { createProductionBattleRng } from './battleRng';
import { createBattleState } from './battleInput';
import { actorById, completedOutcome, validateCombatant } from './battleState';
import { legacyActionPolicy, planAction, revalidateAction } from './battleActions';
import { calculateActionOrder } from './battleOrder';
import { livingOpponents, resolveEffectiveTargets } from './battleTargets';
import { calculateLegacyDamage } from './battleDamage';
import { afterLegacyAction, applyLegacyImpactEffects, beforeLegacyAction, legacyChainContinues } from './battleLegacyEffects';
import { legacyCounterPolicy } from './battleReactions';
import { classifySkillTiming, resolveActionTiming, summarizeBattleTiming } from './battleTiming';
import { accountActionMp, depletionAlert } from './battleResources';
import { scheduleShadowScytheRepeat, SHADOW_SCYTHE_ID } from './battleChains';

export const BATTLE_ENGINE_VERSION = '2k-d-frames-resources-v1';
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
      effectiveTargetIds: [], impacts: [], reaction: action.reaction ? { ...action.reaction } : null,
      state: action.state, outcome: action.state === 'cancelled' ? 'cancelled' : 'skipped',
      timingClass: classifySkillTiming(action.skill), durationFrames: null, timingDiagnostics: [],
      chainFromActionId: action.chainFromActionId, resourceAlerts: [], resourceDiagnostics: [], mpAccounting: null,
      ...(reason ? { reason } : {}),
    };
    records.push(entry); return entry;
  };
  const finishPending = () => {
    for (const id of state.queue.splice(0)) {
      const action = state.plannedActions.find(a => a.id === id)!;
      if (action.state !== 'cancelled') action.state = 'skipped';
      record(action, action.state === 'cancelled' ? 'replaced-by-reaction' : 'battle-ended');
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
        actor.reaction = { counterUsed: false, isCountering: false };
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
          record(action, reason ?? 'already-acted'); continue;
        }
        if (action.kind === 'assist') {
          action.state = 'skipped'; record(action, 'future-mechanic-unsupported').outcome = 'unsupported'; finishPending();
          return result('unsupported', [`${action.kind} resolution is deferred.`]);
        }
        const actor = actorById(state, action.actorId);
        const targetIds = resolveEffectiveTargets(state, action, rng);
        if (!targetIds.length) { action.state = 'skipped'; record(action, 'no-living-targets'); continue; }
        action.state = 'resolving';
        const entry = record(action);
        if (targetIds.some(id => actorById(state, id).side === actor.side)) entry.timingClass = 'unknown';
        acted.add(actor.id); executionCount++;
        accountActionMp(actor, action, entry);
        beforeLegacyAction(actor, action);
        for (let index = 0; index < targetIds.length; index++) {
          const target = actorById(state, targetIds[index]);
          if (!target.isAlive) continue;
          // beforeHitRoll / afterHit: current legacy path always hits; no RNG drawn.
          const damage = calculateLegacyDamage(actor, target, action.skill.legacyTech, input.floorSpecialty, action.reaction !== null);
          const hpBefore = target.currentHp;
          target.currentHp = Math.max(0, hpBefore - damage);
          target.legacy.damageTakenThisTurn = damage;
          const appliedEffects = applyLegacyImpactEffects(actor, target, action, damage);
          target.isAlive = target.side === 'player' || target.currentHp > 0;
          entry.resourceAlerts.push(...depletionAlert(target, 'hp', hpBefore, target.currentHp));
          entry.effectiveTargetIds.push(target.id);
          entry.impacts.push({ targetId: target.id, targetName: target.name, hpBefore, hpAfter: target.currentHp, damage, healing: 0, outcome: target.isAlive ? 'hit' : 'ko', ko: !target.isAlive, appliedEffects });
          legacyCounterPolicy(state, action, target, acted);
          // Preserve old generic chain only for Single-target compatibility inputs.
          if (action.skill.canonicalSkillId === null && action.skill.legacyTech.target === 'Single' && legacyChainContinues(action, !target.isAlive)) {
            const remaining = livingOpponents(state, actor.id);
            if (remaining.length) targetIds.push(remaining[rng.nextIntExclusive(remaining.length, 'target-choice')].id);
          }
        }
        afterLegacyAction(actor);
        action.state = 'resolved'; entry.state = 'resolved'; entry.outcome = 'hit';
        // Custom legacy chains have no measured multi-execution timing claim.
        const timing = resolveActionTiming({ actionKind: action.kind, timingClass: entry.timingClass,
          effectiveTargetCount: entry.effectiveTargetIds.length, outcome: entry.outcome });
        entry.durationFrames = timing.durationFrames; entry.timingDiagnostics = timing.diagnostics;
        if (action.skill.canonicalSkillId === SHADOW_SCYTHE_ID) scheduleShadowScytheRepeat(state, action, entry);
        outcome = completedOutcome(state);
        if (outcome) { finishPending(); return result(outcome); }
      }
      // Round cleanup hook: natural status recovery stays at the future action-time hook.
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
