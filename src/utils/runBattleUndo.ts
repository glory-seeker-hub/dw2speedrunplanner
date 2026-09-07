import { RunPlan } from '@/types/runPlanner';
import { validateRunPlan } from '@/utils/runInvariants';
import { isValidRunBattleCheckpoint } from '@/utils/runPlannerStorage';

export const getUndoUnavailableReason = (run: RunPlan): string | null => {
  const last = run.battles[run.battles.length - 1];
  if (!last) return 'No battles recorded yet.';
  if (last.checkpoint === undefined) return 'This battle predates Undo checkpoints and cannot be safely undone.';
  if (!isValidRunBattleCheckpoint(last.checkpoint)) return 'Invalid checkpoint: this battle cannot be safely undone.';
  return null;
};

export type BattleUndoResult = { ok: true; run: RunPlan } | { ok: false; reason: string };

/** Restore a checkpoint; never reverse formulas, replay events or regenerate IDs. */
export const undoLastBattle = (run: RunPlan): BattleUndoResult => {
  const unavailable = getUndoUnavailableReason(run);
  if (unavailable) return { ok: false, reason: unavailable };
  const checkpoint = run.battles[run.battles.length - 1].checkpoint!;
  const restored = structuredClone(checkpoint);
  const next: RunPlan = { ...run, ...restored, battles: run.battles.slice(0, -1), updatedAt: new Date().toISOString() };
  const violations = validateRunPlan(next);
  if (violations.length) return { ok: false, reason: 'Invalid checkpoint: ' + violations.map(v => v.message).join(' ') };
  return { ok: true, run: next };
};
