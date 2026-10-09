import { getBattleSkillById } from '@/data/battleSkills';
import type { ActionKind } from '@/types/battleSkill';
import type { BattleActionRecord, BattleSkillSelection, BattleCombatantState } from './battleTypes';

export const ROUND_TRANSITION_TIMING_PROFILE = Object.freeze({ 1: 319, 2: 385, 3: 452 });
export interface RoundTransitionTiming {
  fromRound: number; toRound: number; livingPlayerAllies: number; frames: number | null;
}
export function roundTransitionTiming(fromRound: number, combatants: readonly BattleCombatantState[]): RoundTransitionTiming {
  const livingPlayerAllies = combatants.filter(a => a.side === 'player' && a.currentHp > 0).length;
  return { fromRound, toRound: fromRound + 1, livingPlayerAllies,
    frames: (ROUND_TRANSITION_TIMING_PROFILE as Readonly<Record<number, number>>)[livingPlayerAllies] ?? null };
}

/** Project-authoritative measured frames supplied in the Phase 2K-D request.
 * Independent execution measurements, not WAZADATA bytes or converted seconds. */
export const ACTION_TIMING_PROFILE = Object.freeze({
  miss: 194, singleTarget: 685,
  aoe: Object.freeze({ 1: 703, 2: 873, 3: 990 }),
  fieldAll: Object.freeze({ 2: 758, 3: 838, 4: 915, 5: 995, 6: 1071 }),
});
/** Phase 2K-G1: the interrupted actor's partial start, not Interrupt animation. */
export const INTERRUPT_PRELUDE_FRAMES = 76;
export interface InterruptTiming { preludeFrames: number; executionFrames: number; totalFrames: number }
export type TimingClass = 'single-target' | 'aoe' | 'field-all' | 'interrupt' | 'unknown';
export type ExecutionOutcome = 'guard' | 'hit' | 'miss' | 'cancelled' | 'skipped' | 'unsupported' | 'invalid';
export interface ActionTimingInput {
  actionKind: ActionKind | 'guard'; timingClass: TimingClass;
  effectiveTargetCount: number; outcome: ExecutionOutcome;
}
export function resolveActionTiming(input: ActionTimingInput): { durationFrames: number | null; diagnostics: string[]; interruptTiming?: InterruptTiming } {
  const unavailable = (reason: string) => ({ durationFrames: null, diagnostics: [reason] });
  if (input.actionKind === 'guard') return unavailable('Guard is excluded from simulation.');
  if (input.outcome !== 'hit' && input.outcome !== 'miss') return unavailable(`No measured timing for ${input.outcome} actions.`);
  if (input.actionKind === 'interrupt' && input.timingClass === 'interrupt') {
    const executionFrames = input.outcome === 'hit' ? ACTION_TIMING_PROFILE.singleTarget : ACTION_TIMING_PROFILE.miss;
    const totalFrames = INTERRUPT_PRELUDE_FRAMES + executionFrames;
    return { durationFrames: totalFrames, diagnostics: [], interruptTiming: { preludeFrames: INTERRUPT_PRELUDE_FRAMES, executionFrames, totalFrames } };
  }
  // An explicitly classified full-action Miss; never inferred from impact count.
  if (input.outcome === 'miss') return { durationFrames: ACTION_TIMING_PROFILE.miss, diagnostics: [] };
  if (input.actionKind === 'interrupt') return unavailable('Canonical Interrupt timing classification unavailable.');
  if (input.actionKind !== 'attack' && input.actionKind !== 'counter' && input.actionKind !== 'assist') return unavailable(`No proven measured timing for ${input.actionKind} execution.`);
  const count = input.effectiveTargetCount;
  if (!Number.isSafeInteger(count) || count < 1) return unavailable('Invalid effective target count for successful timing.');
  let frames: number | undefined;
  if (input.timingClass === 'single-target' && count === 1) frames = ACTION_TIMING_PROFILE.singleTarget;
  if (input.timingClass === 'aoe') frames = (ACTION_TIMING_PROFILE.aoe as Readonly<Record<number, number>>)[count];
  if (input.timingClass === 'field-all') frames = (ACTION_TIMING_PROFILE.fieldAll as Readonly<Record<number, number>>)[count];
  return frames === undefined ? unavailable(`Timing coverage unavailable: ${input.timingClass}, ${count} effective targets.`) : { durationFrames: frames, diagnostics: [] };
}
export function classifySkillTiming(skill: BattleSkillSelection): TimingClass {
  const canonical = skill.canonicalSkillId === null ? undefined : getBattleSkillById(skill.canonicalSkillId);
  if (canonical?.id === 0xd2 || canonical?.targetModes.includes('random-digimon')) return 'single-target';
  if (canonical?.actionKind === 'interrupt') return 'interrupt';
  if (canonical?.actionKind === 'assist') {
    if (canonical.targetModes.some(m => m !== 'normal')) return 'unknown';
    if (['self', 'one-ally', 'one-enemy'].includes(canonical.targetGroup ?? '')) return 'single-target';
    if (['all-allies', 'all-enemies'].includes(canonical.targetGroup ?? '')) return 'aoe';
    if (canonical.targetGroup === 'field') return 'field-all';
  }
  if (!canonical || canonical.actionKind !== 'attack') return 'unknown';
  // Current execution only proves opposing single/all targeting. Field and
  // random-target semantics need a future resolver before using FIELD_ALL.
  if (canonical.targetModes.some(mode => mode !== 'normal')) return 'unknown';
  if (canonical.targetGroup === 'one-enemy' && skill.legacyTech.target === 'Single') return 'single-target';
  if (canonical.targetGroup === 'all-enemies' && skill.legacyTech.target === 'All') return 'aoe';
  return 'unknown';
}
export function summarizeBattleTiming(actions: readonly BattleActionRecord[], roundTransitions: readonly RoundTransitionTiming[] = []) {
  const executed = actions.filter(a => a.state === 'resolved');
  const unknown = executed.filter(a => a.durationFrames === null);
  const actionFrames = executed.reduce((sum, a) => sum + (a.durationFrames ?? 0), 0);
  const roundTransitionFrames = roundTransitions.reduce((sum, t) => sum + (t.frames ?? 0), 0);
  const missingTransitions = roundTransitions.filter(t => t.frames === null);
  const incomplete = unknown.length > 0 || missingTransitions.length > 0;
  const knownFrames = actionFrames + roundTransitionFrames;
  return { actionFrames, roundTransitionFrames, roundTransitions: [...roundTransitions], totalFrames: incomplete ? null : knownFrames, knownFrames,
    timingCompleteness: incomplete ? 'incomplete' as const : 'complete' as const,
    timingDiagnostics: [...unknown.map(a => `${a.id}: ${a.timingDiagnostics.join(' ') || 'Unknown action duration.'}`),
      ...missingTransitions.map(t => `Round ${t.fromRound} -> ${t.toRound}: timing unavailable for ${t.livingPlayerAllies} living Player allies.`)] };
}
export type BattleTimingSummary = ReturnType<typeof summarizeBattleTiming>;
