import type { SimulationResult } from '@/types/digimon';
import { rootPlanInfo, prefixKey } from './battleActionPlans';
import type { BattleInput } from './battleTypes';
import type { FastestRoute } from './battleFastestRoute';
import { createOptimizedSearchPass, optimizedConfigForBudget, type OptimizedCandidate, type OptimizedSearchOptions, type SearchEffort } from './battleOptimizedSearch';
import { compareCandidates, rolloutSeed, type OptimizationObjective } from './battleSearchObjectives';
import { tasLuckCapForBudget } from './battleTasLuck';

export type SearchThoroughness = 'standard' | 'thorough' | 'maximum';
export type SearchStopReason = 'single-pass-complete' | 'configured-search-complete' | 'search-exhausted' | 'budget-exhausted' | 'insufficient-budget-for-pass' | 'no-progress' | 'cancelled';
export interface SearchPassMetadata {
  thoroughness: SearchThoroughness;
  passIndex: number; passesStarted: number; passesCompleted: number; currentPassEvaluations: number;
  explorationSeed: number; fastestPass: number | null; fastestImprovements: number;
  stopReason?: SearchStopReason;
}
/** Domain-separated identity; fair rolloutSeed calls keep the original master seed. */
export const explorationSeedForPass = (master: number, pass: number) => rolloutSeed(master, pass, 'search-exploration', 0);

/** Policies selected from the bounded matrix in docs/phase-2k-l4/experiment-matrix.json.
 * Lower schedules are affordability fallbacks, not changes to the quality presets. */
export function resolveThoroughnessPolicy(mode: SearchThoroughness, rootCount: number, budget: number, base: { beamWidth: number; maxDepth: number }) {
  const levels = [[4, 16, 64], [8, 32, 128], [16, 64, 256]];
  let level = mode === 'maximum' ? 2 : mode === 'thorough' ? 1 : 0;
  while (level > 0 && rootCount * levels[level][0] > budget) level--;
  const screeningSchedule = levels[level];
  const desired = base.beamWidth * (mode === 'maximum' ? 4 : mode === 'thorough' ? 2 : 1);
  const affordable = Math.floor((budget - rootCount * screeningSchedule[0]) / (screeningSchedule[2] - screeningSchedule[0]));
  const beamWidth = mode === 'standard' ? base.beamWidth : Math.max(base.beamWidth, Math.min(desired, affordable));
  return { screeningSchedule: [...screeningSchedule], config: { beamWidth, maxDepth: base.maxDepth } };
}

/** Compare only the most complete available common stage, never synthetic samples. */
export function mergeScreenedCandidates(previous: OptimizedCandidate[], next: OptimizedCandidate[], objective: OptimizationObjective) {
  const rows = [...previous, ...next];
  const stage = Math.max(0, ...rows.map(c => c.stats.evaluations));
  const unique = new Map<string, OptimizedCandidate>();
  for (const c of rows) if (c.stats.evaluations === stage && Number.isSafeInteger(stage) && stage >= 4) {
    const old = unique.get(c.key);
    if (!old || compareCandidates(c, old, objective) < 0) unique.set(c.key, { key: c.key, plans: c.plans, stats: c.stats });
  }
  return [...unique.values()].sort((a, b) => compareCandidates(a, b, objective)).slice(0, 5);
}

function mergeEffort(a: SearchEffort | undefined, b: SearchEffort | undefined): SearchEffort | undefined {
  if (!a) return b;
  if (!b) return a;
  const stageEvaluations = { ...a.stageEvaluations };
  for (const [stage, count] of Object.entries(b.stageEvaluations)) stageEvaluations[Number(stage)] = (stageEvaluations[Number(stage)] ?? 0) + count;
  return { ...b, completedStages: [...new Set([...a.completedStages, ...b.completedStages])].sort((x, y) => x - y),
    stageEvaluations, maxBeam: Math.max(a.maxBeam, b.maxBeam) };
}

/** These are observational totals, not the selected strategy's fair statistics. */
function mergeObservations(a: SimulationResult | null, b: SimulationResult): SimulationResult {
  if (!a) return b;
  const r = { ...b, outcomeCounts: { ...b.outcomeCounts } };
  for (const key of ['totalSimulations', 'completedSuccesses', 'timedSuccesses', 'incompleteTimingSuccesses', 'runsWithResourceAlerts'] as const) r[key] += a[key];
  for (const key of Object.keys(r.outcomeCounts) as (keyof typeof r.outcomeCounts)[]) r.outcomeCounts[key] += a.outcomeCounts[key];
  r.winRate = r.totalSimulations ? r.completedSuccesses / r.totalSimulations * 100 : 0;
  for (const [average, count] of [['avgTurns', 'completedSuccesses'], ['avgFrames', 'timedSuccesses']] as const)
    r[average] = r[count] ? ((a[average] ?? 0) * a[count] + (b[average] ?? 0) * b[count]) / r[count] : null;
  for (const key of ['minTurns', 'minFrames'] as const) r[key] = a[key] === null ? b[key] : b[key] === null ? a[key] : Math.min(a[key]!, b[key]!);
  for (const key of ['maxTurns', 'maxFrames'] as const) r[key] = a[key] === null ? b[key] : b[key] === null ? a[key] : Math.max(a[key]!, b[key]!);
  if (a.minTurns !== null && (b.minTurns === null || a.minTurns <= b.minTurns)) r.fastestBattleHistory = a.fastestBattleHistory;
  for (const key of ['timingDiagnostics', 'resourceDiagnostics'] as const) r[key] = [...new Set([...a[key], ...b[key]])];
  if (a.rngOverrideCounts) {
    r.rngOverrideCounts = { ...(b.rngOverrideCounts ?? a.rngOverrideCounts) };
    for (const key of Object.keys(a.rngOverrideCounts) as (keyof NonNullable<SimulationResult['rngOverrideCounts']>)[])
      r.rngOverrideCounts[key] = a.rngOverrideCounts[key] + (b.rngOverrideCounts?.[key] ?? 0);
  }
  if (a.tasLuckSummary && b.tasLuckSummary) {
    r.tasLuckSummary = { ...b.tasLuckSummary, maxFrontier: Math.max(a.tasLuckSummary.maxFrontier, b.tasLuckSummary.maxFrontier) };
    for (const key of ['opportunities', 'branchesExplored', 'deduplicated', 'pruned'] as const) r.tasLuckSummary[key] += a.tasLuckSummary[key];
  }
  return r;
}

/** Outer orchestration only. Worker scheduling/cancellation still owns the step boundary. */
export function createOptimizedPassSearch(input: BattleInput, budget: number, options: OptimizedSearchOptions = {},
  makePass = createOptimizedSearchPass) {
  const thoroughness = options.searchThoroughness ?? 'standard';
  if (!['standard', 'thorough', 'maximum'].includes(thoroughness)) throw new Error('Unknown search thoroughness.');
  const snapshot = structuredClone(input);
  const rootCount = rootPlanInfo(snapshot, rolloutSeed(options.seed ?? 0, 1, prefixKey([]), 0)).count;
  const policy = resolveThoroughnessPolicy(thoroughness, rootCount, budget, options.config ?? optimizedConfigForBudget(budget));
  const settings = { ...options, ...policy,
    tasFrontierCap: options.tasFrontierCap ?? tasLuckCapForBudget(budget) };
  const master = options.seed ?? 0, objective = options.objective ?? 'fastest-potential';
  let index = 1, completedPasses = 0, used = 0, stopReason: SearchStopReason | undefined;
  let active = makePass(snapshot, budget, settings), stored: SimulationResult | null = null;
  let minimum = active.minimumBudget;
  let completedEffort: SearchEffort | undefined;
  let top: OptimizedCandidate[] = [], fastest: FastestRoute | null = null, fastestPass: number | null = null, improvements = 0;
  let candidatesEvaluated = 0, fairEvaluations = 0, maxDepth = 0;
  const diagnostics = new Set<string>();
  // The tracker already retains an immutable concrete observation. No rollout cloning here.
  const observeFastest = () => {
    const next = active.fastestRoute;
    if (next && (!fastest || next.totalFrames < fastest.totalFrames)) {
      fastest = next; fastestPass = index; improvements++;
    } else if (next && fastestPass === index && next.totalFrames === fastest?.totalFrames) fastest = next;
  };
  const candidates = () => mergeScreenedCandidates(top, active.topCandidates, objective);
  const metadata = (): SearchPassMetadata => ({ thoroughness, passIndex: index, passesStarted: index,
    passesCompleted: completedPasses, currentPassEvaluations: active.completed,
    explorationSeed: explorationSeedForPass(master, index), fastestPass, fastestImprovements: improvements, ...(stopReason ? { stopReason } : {}) });
  const api = {
    get done() { return stopReason !== undefined; },
    get completed() { return used + (active.done ? 0 : active.completed); },
    step() {
      if (stopReason) return;
      active.step();
      // Constant-time comparison only; preserves every strict improvement, including TAS partial observations.
      observeFastest();
      if (!active.done) return;
      const result = active.result('completed', 0), o = result.optimized!;
      used += active.completed; completedPasses++;
      if (completedPasses === 1) minimum = Math.max(minimum, active.completed);
      completedEffort = mergeEffort(completedEffort, o.effort);
      stored = mergeObservations(stored, result);
      top = mergeScreenedCandidates(top, o.topCandidates, objective);
      candidatesEvaluated += o.candidatesEvaluated; fairEvaluations += o.fairStageEvaluations; maxDepth = Math.max(maxDepth, o.depth);
      o.diagnostics.forEach(d => diagnostics.add(d));
      if (!active.completed) stopReason = 'no-progress';
      else if (used >= budget) stopReason = 'budget-exhausted';
      else if (thoroughness === 'standard') stopReason = 'single-pass-complete';
      else if (thoroughness === 'thorough') stopReason = 'configured-search-complete';
      else if (o.effort && (!o.effort.continuationAvailable || o.effort.termination === 'insufficient-stage-budget' || !o.effort.completedStages.includes(settings.screeningSchedule.at(-1)!))) stopReason = 'search-exhausted';
      else if (budget - used < minimum) stopReason = 'insufficient-budget-for-pass';
      else {
        index++;
        active = makePass(snapshot, budget - used, { ...settings, explorationSeed: explorationSeedForPass(master, index) });
      }
    },
    progress(elapsedMs: number) {
      const p = active.progress(elapsedMs), count = api.completed;
      const best = thoroughness === 'standard' ? p.optimized!.bestStats : candidates()[0]?.stats ?? null;
      const speed = elapsedMs > 0 && count ? count / elapsedMs * 1000 : null;
      return { ...p, completedSimulations: count, requestedSimulations: budget, simulationsPerSecond: speed,
        // Early completion is valid even in Maximum; a time-to-budget ETA would be misleading.
        etaMs: null,
        bestFrames: thoroughness === 'standard' ? p.bestFrames : fastest?.totalFrames ?? null,
        successfulVictories: best?.victories ?? 0, completeTimingVictories: best?.completeTimingVictories ?? 0,
        optimized: { ...p.optimized!, effort: active.done ? completedEffort : mergeEffort(completedEffort, p.optimized!.effort), evaluations: count, rolloutBudget: budget, bestStats: best, passes: metadata(),
          candidatesEvaluated: candidatesEvaluated + (active.done ? 0 : p.optimized!.candidatesEvaluated) } };
    },
    result(status: 'completed' | 'cancelled', elapsedMs: number): SimulationResult {
      observeFastest();
      const current = active.result(status, elapsedMs);
      const combined = active.done ? stored ?? current : mergeObservations(stored, current);
      const selected = candidates(), winner = selected[0];
      const p = api.progress(elapsedMs);
      // result() is an observational snapshot; existing callers inspect Partial
      // snapshots while stepping. The Worker owns actual cancellation.
      if (status === 'cancelled') p.optimized.passes = { ...p.optimized.passes, stopReason: 'cancelled' };
      const optimized = { ...current.optimized!, ...p.optimized, status, config: settings.config,
        fastestRoute: fastest, recommendedPrefix: winner?.plans ?? [], recommendedStats: winner?.stats ?? null,
        topCandidates: selected, depth: Math.max(maxDepth, current.optimized!.depth),
        fairStageEvaluations: fairEvaluations + (active.done ? 0 : current.optimized!.fairStageEvaluations),
        diagnostics: [...new Set([...diagnostics, ...current.optimized!.diagnostics])] };
      return { ...combined, fastestBattleByFrames: fastest?.actions ?? [], optimized,
        search: { ...current.search!, ...p, status } };
    },
  };
  return api;
}
