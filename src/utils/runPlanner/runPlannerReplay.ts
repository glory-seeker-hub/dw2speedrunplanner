import type { RunPlan, RunActionCheckpoint, RunEvent } from '@/types/runPlanner';
import { isValidRunActionCheckpoint } from '@/utils/runActionCheckpoint';
import { isValidRunEvent } from '@/utils/runEventValidation';
import { validateStarterBinding } from '@/utils/runStarterValidation';
import { deriveActionPostState, equalRunState } from '@/utils/runTransitionValidation';
export type AnalysisDiagnosticCode = 'historical-event-replay-failed' | 'empty-historical-digiline' | 'unresolved-player-species' | 'unresolved-player-technique' | 'unresolved-encounter' | 'unresolved-enemy-skill' | 'unresolved-enemy-species' | 'checkpoint-mismatch' | 'planner-resource-history-unavailable' | 'canonical-effect-unresolved' | 'selected-event-not-battle' | 'missing-historical-instance';
export interface AnalysisDiagnostic { code: AnalysisDiagnosticCode; severity: 'blocking' | 'info'; message: string; eventId?: string }
export class BattleAnalysisError extends Error {
  readonly diagnostic: AnalysisDiagnostic;
  constructor(code: AnalysisDiagnosticCode, message: string, eventId?: string) { super(message); this.diagnostic = { code, message, severity: 'blocking', ...(eventId ? { eventId } : {}) }; }
}
export interface HistoricalRunState extends RunActionCheckpoint { runId: string; eventIndex: number; beforeEventId: string; replayedEvents: number }
/** Forward progression replay. V7 has no Digiline-edit events: each pre-action
 * checkpoint supplies the recorded party selection, but never replaces replayed
 * roster/Bits. The first checkpoint is the persisted initial-state anchor. */
export function reconstructRunStateBeforeEvent(run: RunPlan, eventIdOrIndex: string | number): HistoricalRunState {
  const index = typeof eventIdOrIndex === 'number' ? eventIdOrIndex : run.history.findIndex(e => e.id === eventIdOrIndex);
  if (!Number.isInteger(index) || index < 0 || index >= run.history.length) throw new BattleAnalysisError('historical-event-replay-failed', 'Selected event no longer exists in run ' + run.id + '.');
  const selected = run.history[index];
  if (run.history.filter(e => e.id === selected.id).length !== 1) throw new BattleAnalysisError('historical-event-replay-failed', 'Ambiguous event identity in run ' + run.id + '.');
  const initial = run.history[0].preActionCheckpoint;
  if (!isValidRunActionCheckpoint(initial) || validateStarterBinding({ ...run, roster: initial.roster, history: [run.history[0]] }).length) throw new BattleAnalysisError('historical-event-replay-failed', 'Initial historical checkpoint does not match the recorded starter.');
  let state: RunActionCheckpoint = structuredClone(initial);
  const ids = new Set<string>();
  for (let i = 0; i <= index; i++) {
    const event: RunEvent = run.history[i];
    if (!['battle', 'digivolve', 'dna', 'trade'].includes(event.type) || event.order !== i || ids.has(event.id)) throw new BattleAnalysisError('historical-event-replay-failed', 'Unknown event type or invalid chronological identity at action ' + (i + 1), event.id);
    ids.add(event.id);
    if (!isValidRunActionCheckpoint(event.preActionCheckpoint)) throw new BattleAnalysisError('historical-event-replay-failed', 'Invalid pre-action checkpoint.', event.id);
    if (!equalRunState(state.roster, event.preActionCheckpoint.roster) || state.totalBits !== event.preActionCheckpoint.totalBits) throw new BattleAnalysisError('checkpoint-mismatch', 'Forward replay disagrees with pre-action roster or Bits at action ' + (i + 1), event.id);
    state.digiline = [...event.preActionCheckpoint.digiline];
    if (event.type === 'battle' && !equalRunState(state.digiline, event.digilineInstanceIds)) throw new BattleAnalysisError('checkpoint-mismatch', 'Pre-battle participant order disagrees with the recorded Digiline.', event.id);
    if (i === index) break; // Never resolve selected event or inspect future progression.
    if (!isValidRunEvent(event)) throw new BattleAnalysisError('historical-event-replay-failed', 'Invalid recorded action data.', run.history[i].id);
    try {
      const after = deriveActionPostState({ ...event, preActionCheckpoint: state });
      state = { roster: structuredClone(after.roster), totalBits: after.totalBits, digiline: state.digiline };
    } catch (cause) { throw new BattleAnalysisError('historical-event-replay-failed', cause instanceof Error ? cause.message : 'Recorded action cannot be replayed.', event.id); }
  }
  return structuredClone({ ...state, runId: run.id, eventIndex: index, beforeEventId: selected.id, replayedEvents: index });
}
