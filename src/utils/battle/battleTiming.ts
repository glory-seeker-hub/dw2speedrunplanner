import { getBattleSkillById } from '@/data/battleSkills';
import type { ActionKind } from '@/types/battleSkill';
import type { BattleActionRecord, BattleSkillSelection } from './battleTypes';

/** Project-authoritative measured frames supplied in the Phase 2K-D request.
 * Independent execution measurements, not WAZADATA bytes or converted seconds. */
export const ACTION_TIMING_PROFILE = Object.freeze({
  miss: 194, singleTarget: 685,
  aoe: Object.freeze({ 1: 703, 2: 873, 3: 990 }),
  fieldAll: Object.freeze({ 2: 758, 3: 838, 4: 915, 5: 995, 6: 1071 }),
});
export type TimingClass = 'single-target' | 'aoe' | 'field-all' | 'unknown';
export type ExecutionOutcome = 'hit' | 'miss' | 'cancelled' | 'skipped' | 'unsupported' | 'invalid';
export interface ActionTimingInput {
  actionKind: ActionKind | 'guard'; timingClass: TimingClass;
  effectiveTargetCount: number; outcome: ExecutionOutcome;
}
export function resolveActionTiming(input: ActionTimingInput): { durationFrames: number | null; diagnostics: string[] } {
  const unavailable = (reason: string) => ({ durationFrames: null, diagnostics: [reason] });
  if (input.actionKind === 'guard') return unavailable('Guard is excluded from simulation.');
  if (input.outcome !== 'hit' && input.outcome !== 'miss') return unavailable(`No measured timing for ${input.outcome} actions.`);
  // An explicitly classified full-action Miss; never inferred from impact count.
  if (input.outcome === 'miss') return { durationFrames: ACTION_TIMING_PROFILE.miss, diagnostics: [] };
  if (input.actionKind === 'interrupt') return unavailable('Measured Interrupt Hit duration unavailable.');
  if (input.actionKind !== 'attack' && input.actionKind !== 'counter') return unavailable(`No proven measured timing for ${input.actionKind} execution.`);
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
  if (!canonical || canonical.actionKind !== 'attack') return 'unknown';
  // Current execution only proves opposing single/all targeting. Field and
  // random-target semantics need a future resolver before using FIELD_ALL.
  if (canonical.targetModes.some(mode => mode !== 'normal')) return 'unknown';
  if (canonical.targetGroup === 'one-enemy' && skill.legacyTech.target === 'Single') return 'single-target';
  if (canonical.targetGroup === 'all-enemies' && skill.legacyTech.target === 'All') return 'aoe';
  return 'unknown';
}
export function summarizeBattleTiming(actions: readonly BattleActionRecord[]) {
  const executed = actions.filter(a => a.state === 'resolved');
  const unknown = executed.filter(a => a.durationFrames === null);
  const knownFrames = executed.reduce((sum, a) => sum + (a.durationFrames ?? 0), 0);
  return { totalFrames: unknown.length ? null : knownFrames, knownFrames,
    timingCompleteness: unknown.length ? 'incomplete' as const : 'complete' as const,
    timingDiagnostics: unknown.map(a => `${a.id}: ${a.timingDiagnostics.join(' ') || 'Unknown action duration.'}`) };
}
