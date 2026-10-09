import { summarizeBattleTiming, type BattleTimingSummary } from './battleTiming';
import { isCaptureQualifiedVictory, validateCaptureTarget } from './battleCaptureObjective';
import { createTasLuckSearch, createTasLuckReplay, emptyTasLuckSummary, addTasLuckSummary, tasLuckCapForBudget, type TasLuckDecisionTrace } from './battleTasLuck';
import { createFastestRouteTracker, type FastestRoute } from './battleFastestRoute';
import { createOptimizedPassSearch, type SearchThoroughness, type SearchPassMetadata } from './battleSearchPasses';
import { getBattleSkillById } from '@/data/battleSkills';
import { classifyEffect } from './battleEffectCoverage';
import type { SimulationResult } from '@/types/digimon';
import type { BattleEngineOptions, BattleInput, BattleState } from './battleTypes';
import type { SearchProgress } from './battleSimulationSearch';
import { resolveSimulationRules } from './battleSimulationRules';
import { createBattleAccumulator } from './battleCompatibility';
import { countPlayerRoundPlans, enumeratePlayerRoundPlans, prefixKey, replayPlayerPrefix, rootPlanInfo, type PlayerRoundPlan } from './battleActionPlans';
import { addCandidateOutcome, compareCandidates, emptyCandidateStats, representativeSample, rolloutSeed,
  type OptimizationObjective, type OptimizedCandidateStats, type RepresentativeSample } from './battleSearchObjectives';

export interface OptimizedSearchConfig { beamWidth: number; maxDepth: number }
export const OPTIMIZED_PRESETS = {
  Quick: { budget: 10000, beamWidth: 8, maxDepth: 4 }, Standard: { budget: 100000, beamWidth: 16, maxDepth: 6 },
  Deep: { budget: 1000000, beamWidth: 32, maxDepth: 10 },
};
export function optimizedConfigForBudget(budget: number): OptimizedSearchConfig {
  const { beamWidth, maxDepth } = budget === 10000 ? OPTIMIZED_PRESETS.Quick : budget === 1000000 ? OPTIMIZED_PRESETS.Deep : OPTIMIZED_PRESETS.Standard;
  return { beamWidth, maxDepth };
}
export interface OptimizedCandidate { key: string; plans: PlayerRoundPlan[]; stats: OptimizedCandidateStats }
export interface SearchStageAudit {
  depth: number; samples: number; evaluations: number; candidates: number; retained: number;
  eliminated: number; beam: number; kind: 'screening' | 'finalists';
}
export interface SearchEffort {
  screeningSchedule: number[]; completedStages: number[]; stageEvaluations: Record<number, number>;
  screeningTarget: number; maxBeam: number; beamWidth: number; maxDepth: number; termination?: 'depth-limit' | 'frontier-exhausted' | 'insufficient-stage-budget';
  continuationAvailable: boolean;
}
interface StageSnapshot { stats: OptimizedCandidateStats; samples: RepresentativeSample[]; fallback: Candidate['fallback'] }
interface Candidate extends OptimizedCandidate {
  continuationSamples?: NonNullable<Candidate['fallback']>[];
  stages: Partial<Record<number, StageSnapshot>>;
  parentKey: string; samples: RepresentativeSample[]; fallback: { seed: number; score: number; sampleIndex: number; rounds: number; tasLuckTrace?: TasLuckDecisionTrace } | null;
}
export interface OptimizedProgress {
  effort?: SearchEffort;
  passes?: SearchPassMetadata;
  searchMethod: 'optimized-action-search'; objective: OptimizationObjective;
  phase: 'enumerating' | 'screening' | 'refining' | 'expanding' | 'finalizing'; depth: number; maxDepth: number;
  rootPlanCount: number; candidateCount: number; candidatesEvaluated: number; beamSize: number;
  evaluations: number; rolloutBudget: number; bestStats: OptimizedCandidateStats | null;
}
export interface OptimizedSearchResult extends OptimizedProgress {
  captureObjective?: import('./battleCaptureObjective').BattleCaptureTarget;
  rngPolicy?: import('./battleRngPolicy').BattleRngPolicy;
  status: 'completed' | 'cancelled'; rootSeed: number; config: OptimizedSearchConfig;
  primaryRecommendation: 'fastest-route' | 'fair-prefix'; fastestRoute: FastestRoute | null;
  /** Fair-stage prefix; Fastest Potential primary is fastestRoute. */
  recommendedPrefix: PlayerRoundPlan[]; recommendedStats: OptimizedCandidateStats | null;
  topCandidates: OptimizedCandidate[]; diagnostics: string[]; fairStageEvaluations: number;
}
export interface OptimizedSearchOptions extends BattleEngineOptions { seed?: number; objective?: OptimizationObjective; config?: OptimizedSearchConfig; searchThoroughness?: SearchThoroughness }
export function createOptimizedSearch(input: BattleInput, budget: number, options: OptimizedSearchOptions = {}) {
  return createOptimizedPassSearch(input, budget, options);
}
export interface SearchPassOptions extends OptimizedSearchOptions {
  explorationSeed?: number;
  /** Internal characterization/policy seam; never accepted from UI or Worker input. */
  screeningSchedule?: number[];
  onStage?: (stage: SearchStageAudit, candidates: readonly OptimizedCandidate[]) => void;
}
export function createOptimizedSearchPass(input: BattleInput, budget: number, options: SearchPassOptions = {}) {
  if (!Number.isSafeInteger(budget) || budget < 1) throw new Error('Rollout budget must be a positive safe integer.');
  const snapshot = structuredClone(input), rules = resolveSimulationRules(options.simulationRules);
  const objective = options.objective ?? 'fastest-potential', config = { ...(options.config ?? optimizedConfigForBudget(budget)) };
  if (!['fastest-potential', 'average-victory', 'success-rate'].includes(objective)) throw new Error('Unknown optimization objective.');
  for (const n of [config.beamWidth, config.maxDepth]) if (!Number.isSafeInteger(n) || n < 1) throw new Error('Invalid optimized search configuration.');
  validateCaptureTarget(snapshot, options.captureObjective);
  const rootSeed = options.seed ?? 0;
  if (!Number.isInteger(rootSeed) || rootSeed < 0 || rootSeed > 0xffffffff) throw new Error('Invalid root search seed.');
  const engineOptions: BattleEngineOptions = { simulationRules: rules, ...(options.maxRounds === undefined ? {} : { maxRounds: options.maxRounds }) };
  // Initial injected ailments use the same representative-state policy as later
  // stochastic decision boundaries. Blocked-slot ties are RNG, never plans.
  const root = rootPlanInfo(snapshot, rolloutSeed(rootSeed, 1, prefixKey([]), 0));
  if (!root.count) throw new Error('No complete legal Player round plan is available.');
  if (!Number.isSafeInteger(root.minimumBudget) || budget < root.minimumBudget)
    throw new Error('Search budget too small. Minimum required for current first-round action space: ' + root.minimumBudget + '.');
  const schedule = [...(options.screeningSchedule ?? [4, 16, 64])];
  if (!schedule.length || schedule.some((n, i) => !Number.isSafeInteger(n) || n < 4 || i > 0 && n <= schedule[i - 1])) throw new Error('Invalid screening schedule.');
  if (root.count * schedule[0] > budget) throw new Error('Budget cannot initialize the requested screening schedule.');
  const effort: SearchEffort = { screeningSchedule: schedule, completedStages: [], stageEvaluations: {}, screeningTarget: schedule[0], maxBeam: 0, beamWidth: config.beamWidth, maxDepth: config.maxDepth, continuationAvailable: false };
  const commonStage = (minimum: number) => { for (let i = schedule.length - 1; i >= 0; i--) if (schedule[i] <= minimum) return schedule[i]; return schedule[0]; };
  let activeStageStart: number | null = null;
  const tasSummary = emptyTasLuckSummary(options.tasFrontierCap ?? tasLuckCapForBudget(budget));
  const accumulator = createBattleAccumulator(options.captureObjective);
  const fastest = createFastestRouteTracker(options.captureObjective);
  let bestTurnsSample: { timing: BattleTimingSummary; turns: number; key: string; sampleIndex: number; actions: SimulationResult['fastestBattleHistory'] } | null = null;
  const pairedSeeds = new Map<string, number[]>();
  let evaluations = 0, depth = 0, depthReached = 0, candidateCount = 0, candidatesEvaluated = 0, beamSize = 0, done = false;
  let phase: OptimizedProgress['phase'] = 'enumerating', fairStageEvaluations = 0;
  let fair: Candidate[] = [];
  let completedPaths: Candidate[] = [];
  const diagnostics = new Set<string>();
  const rank = (rows: Candidate[]) => [...rows].sort((a, b) => compareCandidates(a, b, objective));
  // One additional bounded slot, only after an equal stage completes.
  const withElite = (rows: Candidate[], selected: Candidate[]) => {
    if (objective !== 'fastest-potential' || !rows.length) return selected;
    const stage = rows[0].stats.evaluations;
    if (!schedule.includes(stage) || rows.some(c => c.stats.evaluations !== stage)) return selected;
    const elite = rows.find(c => c.key === fastest.best?.sourcePrefixKey);
    return elite && !selected.some(c => c.key === elite.key) ? [...selected, elite] : selected;
  };
  let expansionBeam: Candidate[] = [];
  const checkpoint = (rows: Candidate[]) => {
    const unique = new Map<string, Candidate>();
    for (const c of [...rows, ...completedPaths]) if (!unique.has(c.key) || unique.get(c.key)!.stats.evaluations < c.stats.evaluations) unique.set(c.key, c);
    const common = [...unique.values()].reduce((n, c) => Math.min(n, c.stats.evaluations), Infinity);
    const target = commonStage(common);
    const views = [...unique.values()].map(c => ({ ...c, ...c.stages[target]! }));
    fair = rank(views).slice(0, config.beamWidth)
      .map(c => ({ ...c, stats: { ...c.stats }, samples: [...c.samples] }));
    expansionBeam = withElite(views, fair);
    fairStageEvaluations = evaluations; beamSize = expansionBeam.length; effort.maxBeam = Math.max(effort.maxBeam, beamSize);
  };
  function* evaluate(candidate: Candidate): Generator<void> {
    const sampleIndex = candidate.stats.evaluations;
    const seeds = pairedSeeds.get(candidate.parentKey) ?? [];
    if (!pairedSeeds.has(candidate.parentKey)) pairedSeeds.set(candidate.parentKey, seeds);
    const seed = seeds[sampleIndex] ?? (seeds[sampleIndex] = rolloutSeed(rootSeed, candidate.plans.length, candidate.parentKey, sampleIndex));
    let sample;
    if (rules.rngPolicy === 'tas-luck') {
      const search = createTasLuckSearch(tasLuck => replayPlayerPrefix(snapshot,candidate.plans,seed,{...engineOptions,tasLuck},false,true),tasSummary.frontierCap,false,options.captureObjective);
      let counted = emptyTasLuckSummary(tasSummary.frontierCap);
      while(!search.done) {
        search.step();
        const delta={...search.summary};for(const k of ['opportunities','branchesExplored','deduplicated','pruned'] as const)delta[k]-=counted[k];
        addTasLuckSummary(tasSummary,delta);counted={...search.summary};
        const observed=search.best;if(observed)fastest.consider(observed.result,observed.diverged,observed.decisionTrace,candidate.key,sampleIndex,seed,candidate.plans);
        yield;
      }
      sample=search.best!;
    } else sample=replayPlayerPrefix(snapshot,candidate.plans,seed,engineOptions,false,true);
    const {result,diverged,decisionTrace}=sample;
    const qualified = isCaptureQualifiedVictory(result, options.captureObjective);
    fastest.consider(result, diverged, decisionTrace, candidate.key, sampleIndex, seed, candidate.plans);
    if (!diverged && (result.outcome === 'invalid' || result.outcome === 'unsupported')) throw new Error(result.diagnostics.join(' '));
    if (!candidate.stats.evaluations) candidatesEvaluated++;
    addCandidateOutcome(candidate.stats, result, diverged, options.captureObjective); evaluations++; depthReached = Math.max(depthReached, candidate.plans.length);
    if (!diverged) {
      accumulator.add(result);
      const earlier = (old: { key: string; sampleIndex: number }) => candidate.key < old.key || candidate.key === old.key && sampleIndex < old.sampleIndex;
      if (qualified) {
        if (!bestTurnsSample || result.actionCount < bestTurnsSample.turns || result.actionCount === bestTurnsSample.turns && earlier(bestTurnsSample))
          bestTurnsSample = { timing: summarizeBattleTiming(result.actions, result.roundTransitions), turns: result.actionCount, key: candidate.key, sampleIndex, actions: result.actions };
      }
      if (qualified && result.timingCompleteness === 'complete' && result.totalFrames !== null)
        candidate.samples.push({ frames: result.totalFrames, sampleIndex, seed, rounds: result.rounds, ...(result.tasLuckTrace?{tasLuckTrace:result.tasLuckTrace}:{}) });
      // Qualified victory outranks prefixes; terminal wrong captures rank below them.
      // Unfinished prefixes keep the existing remaining-HP heuristic.
      const score = (qualified ? 1e15 : options.captureObjective && result.outcome === 'player-win' ? -1e15 : 0) - result.state.combatants.filter(a => a.side === 'enemy').reduce((n, a) => n + a.currentHp, 0);
      if (options.explorationSeed !== undefined) (candidate.continuationSamples ??= []).push({ score, seed, sampleIndex, rounds: result.rounds, ...(result.tasLuckTrace ? { tasLuckTrace: result.tasLuckTrace } : {}) });
      if (!candidate.fallback || score > candidate.fallback.score) candidate.fallback = { score, seed, sampleIndex, rounds: result.rounds, ...(result.tasLuckTrace?{tasLuckTrace:result.tasLuckTrace}:{}) };
    }
    if (schedule.includes(candidate.stats.evaluations)) candidate.stages[candidate.stats.evaluations] = {
      stats: { ...candidate.stats }, samples: [...candidate.samples], fallback: candidate.fallback,
    };
  }
  function* run(): Generator<void> {
    let parents: { plans: PlayerRoundPlan[]; state: BattleState; key: string }[] = [{ plans: [], state: root.state, key: prefixKey([]) }];

    for (depth = 1; depth <= config.maxDepth && parents.length; depth++) {
      pairedSeeds.clear();
      phase = depth === 1 ? 'enumerating' : 'expanding';
      let candidates: Candidate[] = [], reserved = 0;
      if (options.explorationSeed !== undefined) parents.sort((a, b) =>
        rolloutSeed(options.explorationSeed!, depth, a.key, 0) - rolloutSeed(options.explorationSeed!, depth, b.key, 0));
      for (const parent of parents) {
        const count = countPlayerRoundPlans(parent.state), minimum = count * schedule[0];
        if (!count || minimum > budget - evaluations - reserved) continue;
        reserved += minimum;
        for (const plan of enumeratePlayerRoundPlans(parent.state)) {
          const plans = [...parent.plans, plan];
          candidates.push({ key: prefixKey(plans), plans, parentKey: parent.key, stats: emptyCandidateStats(), samples: [], fallback: null, stages: {} });
          candidateCount = candidates.length; yield;
        }
      }
      if (!candidates.length) { effort.termination = 'insufficient-stage-budget'; diagnostics.add('Remaining budget cannot fairly screen another complete decision state.'); break; }
      for (const target of schedule) {
        const cost = candidates.reduce((n, c) => n + target - c.stats.evaluations, 0);
        if (cost > budget - evaluations) break;
        phase = target === schedule[0] ? 'screening' : 'refining'; effort.screeningTarget = target; activeStageStart = evaluations;
        // Round-robin paired samples; rank only after every survivor reaches the target.
        for (let sample = candidates[0].stats.evaluations; sample < target; sample++)
          for (let i = 0; i < candidates.length; i++) {
            yield* evaluate(candidates[i]);
            if (sample === target - 1 && i === candidates.length - 1) checkpoint(candidates);
            yield;
          }
        checkpoint(candidates);
        const retained = withElite(candidates, rank(candidates).slice(0, Math.max(config.beamWidth, Math.ceil(candidates.length / 4))));
        effort.stageEvaluations[target] = (effort.stageEvaluations[target] ?? 0) + cost; activeStageStart = null;
        if (!effort.completedStages.includes(target)) effort.completedStages.push(target);
        options.onStage?.({ depth, samples: target, evaluations: cost, candidates: candidates.length, retained: retained.length, eliminated: candidates.length - retained.length, beam: beamSize, kind: 'screening' }, candidates);
        candidates = retained;
      }
      const beam = withElite(candidates, rank(candidates).slice(0, config.beamWidth));
      // Affordable finalists receive repeated refinement even when a whole racing stage cannot fit.
      for (const target of schedule.slice(1)) {
        const active = beam.filter(c => c.stats.evaluations < target);
        const cost = active.reduce((n, c) => n + target - c.stats.evaluations, 0);
        if (!active.length || cost > budget - evaluations) continue;
        phase = 'refining'; effort.screeningTarget = target;
        for (let i = 0; i < active.length; i++) while (active[i].stats.evaluations < target) {
          yield* evaluate(active[i]);
          if (i === active.length - 1 && active[i].stats.evaluations === target) checkpoint(beam);
          yield;
        }
        checkpoint(beam);
      }
      checkpoint(beam);
      if (beam.some(c => c.samples.some(s => (s.rounds ?? 0) > c.plans.length) || (c.fallback?.rounds ?? 0) > c.plans.length)) effort.continuationAvailable = true;
      if (depth === config.maxDepth) { effort.termination = 'depth-limit'; break; }
      parents = [];
      for (const c of expansionBeam) {
        const continuations = c.samples.length ? c.samples : c.continuationSamples ?? [];
        const representative = options.explorationSeed !== undefined && continuations.length
          ? continuations[rolloutSeed(options.explorationSeed, depth, c.key, 1) % continuations.length]
          : representativeSample(c.samples, objective);
        const seed = representative?.seed ?? c.fallback?.seed;
        if (seed === undefined) continue;
        // Reconstruct only up to the decision boundary, never retain every rollout state/history.
        const alreadyEnded = (representative?.rounds ?? c.fallback?.rounds ?? Infinity) <= c.plans.length;
        const replay = alreadyEnded ? { nextState: null } : replayPlayerPrefix(snapshot, c.plans, seed, {...engineOptions, ...(rules.rngPolicy==='tas-luck'?{tasLuck:createTasLuckReplay(representative?.tasLuckTrace??c.fallback?.tasLuckTrace??[]).control}:{})}, true);
        if (replay.nextState) parents.push({ plans: c.plans, state: replay.nextState, key: c.key });
        else if (!options.captureObjective || c.stats.victories > 0) {
          const bestStage = c.stages[commonStage(c.stats.evaluations)]!;
          const retained = { ...c, ...bestStage };
          const finished = [...completedPaths.filter(p => p.key !== c.key), retained];
          const minimum = finished.reduce((n, p) => Math.min(n, p.stats.evaluations), Infinity);
          const stage = commonStage(minimum);
          completedPaths = finished.sort((a, b) => compareCandidates({ key: a.key, stats: a.stages[stage]!.stats }, { key: b.key, stats: b.stages[stage]!.stats }, objective)).slice(0, config.beamWidth);
        }

        yield;
      }
    }
    depth = Math.min(depth, config.maxDepth);
    effort.termination ??= 'frontier-exhausted'; phase = 'finalizing'; done = true;
  }
  const iterator = run();
  function details(): OptimizedProgress {
    return { effort: { ...effort, screeningSchedule: [...schedule], completedStages: [...effort.completedStages], stageEvaluations: { ...effort.stageEvaluations, ...(activeStageStart === null ? {} : { [effort.screeningTarget]: (effort.stageEvaluations[effort.screeningTarget] ?? 0) + evaluations - activeStageStart }) } }, searchMethod: 'optimized-action-search', objective, phase, depth: depthReached, maxDepth: config.maxDepth,
      rootPlanCount: root.count, candidateCount, candidatesEvaluated, beamSize, evaluations, rolloutBudget: budget, bestStats: fair[0]?.stats ?? null };
  }
  return {
    get minimumBudget() { return root.count * schedule[0]; },
    get fastestRoute() { return fastest.best; },
    get topCandidates(): OptimizedCandidate[] { return fair.slice(0, 5); },
    get done() { return done; }, get completed() { return evaluations; },
    step() { if (!done) { const next = iterator.next(); if (next.done) done = true; } },
    progress(elapsedMs: number): SearchProgress {
      const best = fair[0]?.stats, speed = elapsedMs > 0 && evaluations ? evaluations / elapsedMs * 1000 : null;
      return { completedSimulations: evaluations, requestedSimulations: budget, successfulVictories: best?.victories ?? 0,
        completeTimingVictories: best?.completeTimingVictories ?? 0, bestFrames: best?.fastestFrames ?? null,
        bestFoundAtSimulation: null, bestOccurrenceCount: 0, simulationsSinceLastImprovement: null,
        elapsedMs, simulationsPerSecond: speed, etaMs: null, optimized: details() };
    },
    result(status: 'completed' | 'cancelled', elapsedMs: number): SimulationResult {
      if (!fair.length) diagnostics.add('No full fair screening stage completed; no fair screened-prefix ranking was completed.');
      if (fair.length && fair.every(c => !c.stats.completeTimingVictories)) diagnostics.add('No frame-eligible candidate found.');
      for (const plan of fair[0]?.plans ?? []) for (const order of plan.orders) {
        const skill = getBattleSkillById(order.canonicalSkillId ?? -1);
        for (const effect of skill?.effects ?? []) {
          const coverage = classifyEffect(effect, skill!);
          if (coverage.status === 'deferred-unresolved') diagnostics.add(order.skillName + ': ' + coverage.boundary);
        }
      }
      const optimized: OptimizedSearchResult = { ...details(), ...(options.captureObjective ? { captureObjective: options.captureObjective } : {}), status, rootSeed, config, ...(rules.rngPolicy !== 'natural' ? { rngPolicy: rules.rngPolicy } : {}),
        primaryRecommendation: objective === 'fastest-potential' ? 'fastest-route' : 'fair-prefix', fastestRoute: fastest.best,
        recommendedPrefix: fair[0]?.plans ?? [], recommendedStats: fair[0]?.stats ?? null,
        topCandidates: fair.slice(0, 5).map(({ key, plans, stats }) => ({ key, plans, stats })),
        diagnostics: [...diagnostics], fairStageEvaluations };
      const observed = accumulator.snapshot();
      return { ...observed, ...(rules.rngPolicy==='tas-luck'?{tasLuckSummary:{...tasSummary}}:{}), timingDiagnostics: [...observed.timingDiagnostics].sort(), resourceDiagnostics: [...observed.resourceDiagnostics].sort(), fastestBattleByFrames: fastest.best?.actions ?? [], fastestBattleByFramesTiming: fastest.best?.timing, fastestBattleHistory: bestTurnsSample?.actions ?? [], fastestBattleHistoryTiming: bestTurnsSample?.timing, accuracyMode: rules.accuracyMode,
        search: { ...this.progress(elapsedMs), accuracyMode: rules.accuracyMode, ...(rules.rngPolicy !== 'natural' ? { rngPolicy: rules.rngPolicy } : {}), status }, optimized };
    },
  };
}
