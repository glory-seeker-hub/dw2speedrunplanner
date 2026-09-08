import { RunPlan } from '@/types/runPlanner';
import { validateRunPlan } from '@/utils/runInvariants';
import { isValidRunActionCheckpoint } from '@/utils/runActionCheckpoint';
import { isValidRunEvent } from '@/utils/runEventValidation';

export const getUndoUnavailableReason = (run: RunPlan): string | null => {
  const last = run.history[run.history.length - 1];
  if (!last) return 'No actions recorded yet.';
  if (!isValidRunActionCheckpoint(last.preActionCheckpoint)) return 'Invalid checkpoint: this action cannot be safely undone.';
  if (!isValidRunEvent(last)) return 'Invalid action: this action cannot be safely undone.';
  return null;
};

export type ActionUndoResult = { ok: true; run: RunPlan } | { ok: false; reason: string };

/** Restore a checkpoint; never reverse formulas, replay events or regenerate IDs. */
export const undoLastAction = (run: RunPlan): ActionUndoResult => {
  const unavailable = getUndoUnavailableReason(run);
  if (unavailable) return { ok: false, reason: unavailable };
  const preActionCheckpoint = run.history[run.history.length - 1].preActionCheckpoint;
  const restored = structuredClone(preActionCheckpoint);
  const next: RunPlan = { ...run, ...restored, history: run.history.slice(0, -1), updatedAt: new Date().toISOString() };
  const violations = validateRunPlan(next);
  if (violations.length) return { ok: false, reason: 'Invalid checkpoint: ' + violations.map(v => v.message).join(' ') };
  return { ok: true, run: next };
};
