import { THOROUGHNESS_LABELS } from '@/utils/battle/battlePresentation';
import { OBJECTIVE_LABELS } from '@/utils/battle/battleSearchObjectives';
import type { SearchProgress } from '@/utils/battle/battleSimulationSearch';
import { Button } from '@/components/ui/button';
const searchNumber = (n: number | null) => n === null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 1 });
export function SimulationSearchProgress({ progress, requested, cancelling, onCancel }: { progress: SearchProgress | null; requested: number; cancelling: boolean; onCancel: () => void }) {
  if (progress?.optimized) {
    const p = progress.optimized;
    return <section aria-label="Optimized search progress" className="rounded border p-3 space-y-2">
      <p className="font-semibold">Optimized Action Search · {OBJECTIVE_LABELS[p.objective]} · {p.phase}</p>
      <progress aria-label="Rollout budget used" max={p.rolloutBudget} value={p.evaluations} className="w-full" />
      <p>Rollout evaluations: {searchNumber(p.evaluations)} / {searchNumber(p.rolloutBudget)}</p>
      {p.passes && p.passes.passIndex > 1 && <p>Search pass {p.passes.passIndex} · {p.passes.passesCompleted} completed · Current pass: {searchNumber(p.passes.currentPassEvaluations)} evaluations</p>}
      {p.passes?.thoroughness !== 'standard' && <p>Fastest found: {searchNumber(progress.bestFrames)} f</p>}
      <p>Search Thoroughness: {THOROUGHNESS_LABELS[p.passes?.thoroughness ?? 'standard']}{p.effort && <> · Screening stage: {p.effort.screeningTarget} / {p.effort.screeningSchedule.at(-1)} samples</>}</p>
      <p>Round depth: {p.depth} / {p.maxDepth} · Root Player plans: {searchNumber(p.rootPlanCount)}</p>
      <p>Candidate plans evaluated: {searchNumber(p.candidatesEvaluated)} · Current candidates: {searchNumber(p.candidateCount)} · Beam: {p.beamSize}</p>
      {!p.bestStats && <p role="status">Search is actively processing; no completed fair screening result yet.</p>}
      <p>Best candidate: {searchNumber(p.bestStats?.fastestFrames ?? null)} f · Success: {searchNumber(p.bestStats ? p.bestStats.successRate * 100 : null)}%</p>
      <p>Elapsed: {searchNumber(progress.elapsedMs / 1000)} s · Speed: {searchNumber(progress.simulationsPerSecond)} evaluations/s · ETA: {searchNumber(progress.etaMs === null ? null : progress.etaMs / 1000)} s</p>
      <Button onClick={onCancel} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel Simulation'}</Button>
    </section>;
  }
  const completed = progress?.completedSimulations ?? 0;
  const total = progress?.requestedSimulations ?? requested;
  const percent = Math.max(0, Math.min(100, completed / total * 100));
  return <section aria-label="Simulation progress" className="rounded border p-3 space-y-2">
    {!progress && <p role="status">Preparing simulation — actively processing; no rollout completed yet.</p>}
    <progress aria-label="Simulations completed" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed} max={total} value={completed} className="w-full" />
    <p>{searchNumber(completed)} / {searchNumber(total)} simulations · {percent.toFixed(1)}%</p>
    <div className="grid gap-1 text-sm sm:grid-cols-2">
      <p>Successful victories: {searchNumber(progress?.successfulVictories ?? 0)}</p>
      <p>Best so far: {searchNumber(progress?.bestFrames ?? null)}{progress?.bestFrames !== null && progress?.bestFrames !== undefined ? ' f' : ''}</p>
      <p>Best found at: {searchNumber(progress?.bestFoundAtSimulation ?? null)}</p>
      <p>Best occurrences: {searchNumber(progress?.bestOccurrenceCount ?? 0)}</p>
      <p>No improvement for: {searchNumber(progress?.simulationsSinceLastImprovement ?? null)}</p>
      <p>Speed: {searchNumber(progress?.simulationsPerSecond ?? null)} simulations/s</p>
      <p>Elapsed: {searchNumber((progress?.elapsedMs ?? 0) / 1000)} s</p>
      <p>ETA: {searchNumber(progress?.etaMs == null ? null : progress.etaMs / 1000)} s</p>
    </div>
    <Button onClick={onCancel} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel Simulation'}</Button>
  </section>;
}
