import type { SimulationResult } from '@/types/digimon';
import type { PlannerBattleAnalysisPreset } from '@/utils/runPlanner/runBattleAnalysis';
import type { BattleInput, BattleCombatantState, BattleActionRecord } from './battleTypes';
import type { PlayerStatProvenance } from './battleStatOverrides';
import type { PlayerRoundPlan } from './battleActionPlans';
import type { OptimizedCandidateStats, OptimizationObjective, BattleSearchMethod } from './battleSearchObjectives';
import type { OptimizedSearchConfig } from './battleOptimizedSearch';
import { optimizedConfigForBudget } from './battleOptimizedSearch';
import { createBattleState } from './battleInput';
import { resolveSimulationRules, type BattleSimulationRules } from './battleSimulationRules';
import { collectRngRequirements } from './battleRngAudit';
import { resourceAlertText } from './battleResources';

export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
/** Normalize optional undefined properties, detach, and freeze the complete plain-data tree. */
function immutable<T>(value: T): DeepReadonly<T> {
  const copy = JSON.parse(JSON.stringify(value)) as T;
  function freeze(item: unknown): void {
    if (item && typeof item === 'object') { Object.values(item).forEach(freeze); Object.freeze(item); }
  }
  freeze(copy);
  return copy as DeepReadonly<T>;
}
export interface SimulationReportJobRequest {
  input: BattleInput; requestedSimulations: number; searchMethod?: BattleSearchMethod;
  optimizationObjective?: OptimizationObjective; optimizedConfig?: OptimizedSearchConfig;
  simulationRules?: BattleSimulationRules; seed?: number; maxRounds?: number;
  plannerProvenance?: Pick<PlannerBattleAnalysisPreset, 'source' | 'selectedBattle' | 'historicalStateSummary' | 'diagnostics'>;
  playerStatProvenance?: PlayerStatProvenance;
}
type Combatant = Pick<BattleCombatantState, 'id' | 'sourceInstanceId' | 'name' | 'side' | 'speciesId' | 'type' | 'specialty' | 'baseStats' | 'maxHp' | 'currentHp' | 'maxMp' | 'currentMp' | 'isBoss' | 'skills' | 'statuses' | 'temporaryPowers' | 'elementalPower' | 'atkStage' | 'defStage' | 'spdStage'> & {
  slot: number; level?: number; dp?: number; levelCap?: import('@/types/runPlanner').LevelCapState;
};
export interface SimulationReportJob {
  input: BattleInput;
  source: { kind: 'manual' } | ({ kind: 'run-planner' } & NonNullable<SimulationReportJobRequest['plannerProvenance']>);
  combatants: Combatant[];
  playerStatProvenance?: PlayerStatProvenance;
  configuration: {
    searchMethod: BattleSearchMethod; objective?: OptimizationObjective;
    rules: BattleSimulationRules; requestedEvaluations: number; floorSpecialty: string;
    optimizedConfig?: OptimizedSearchConfig; seed?: number; maxRounds: number;
  };
}
/** Called at dispatch, before controls can change; never reconstruct Planner state at export time. */
export function snapshotSimulationReportJob(request: SimulationReportJobRequest): DeepReadonly<SimulationReportJob> {
  const r = structuredClone(request), method = r.searchMethod ?? 'random-monte-carlo';
  const state = createBattleState(r.input);
  const combatants = state.combatants.map(a => {
    const members = a.side === 'player' ? r.input.player : Array.isArray(r.input.enemy) ? r.input.enemy : [];
    const metadata = members[a.position] as { level?: number; dp?: number; levelCap?: import('@/types/runPlanner').LevelCapState } | undefined;
    const { id, sourceInstanceId, name, side, speciesId, type, specialty, baseStats, maxHp, currentHp, maxMp, currentMp, isBoss, skills, statuses, temporaryPowers, elementalPower, atkStage, defStage, spdStage } = a;
    return { id, sourceInstanceId, name, side, speciesId, type, specialty, baseStats, maxHp, currentHp, maxMp, currentMp, isBoss, skills, statuses, temporaryPowers, elementalPower, atkStage, defStage, spdStage,
      slot: a.position + 1, level: metadata?.level, dp: metadata?.dp, levelCap: metadata?.levelCap };
  });
  return immutable({ input: r.input, source: r.plannerProvenance ? { kind: 'run-planner' as const, ...r.plannerProvenance } : { kind: 'manual' as const },
    combatants, playerStatProvenance: r.playerStatProvenance,
    configuration: { searchMethod: method, rules: resolveSimulationRules(r.simulationRules), requestedEvaluations: r.requestedSimulations,
      floorSpecialty: r.input.floorSpecialty, maxRounds: r.maxRounds ?? 1000,
      ...(method === 'optimized-action-search' ? { objective: r.optimizationObjective ?? 'fastest-potential', optimizedConfig: r.optimizedConfig ?? optimizedConfigForBudget(r.requestedSimulations), seed: r.seed ?? 0 } : r.seed === undefined ? {} : { seed: r.seed }) } });
}
type SelectedResult = {
  kind: 'random-monte-carlo'; winRate: number; minFrames: number | null; averageFrames: number | null;
  maxFrames: number | null; minActions: number | null; averageActions: number | null; maxActions: number | null;
} | {
  kind: 'optimized-action-search'; objective: OptimizationObjective;
  fastestCompleteRoute: { totalFrames: number; rounds: number; sourcePrefixKey: string; seed: number; sampleIndex: number; decisionTrace: PlayerRoundPlan[] } | null;
  screenedPrefix: { plans: PlayerRoundPlan[]; statistics: OptimizedCandidateStats | null };
  topCandidates: { key: string; statistics: OptimizedCandidateStats; firstRoundOrders: PlayerRoundPlan['orders'] }[];
};
interface ReportData {
  reportVersion: 1; resultStatus: 'completed' | 'cancelled';
  source: SimulationReportJob['source']; battle: { encounterId?: number; label: string };
  effectiveInput: BattleInput; playerTeam: Combatant[]; enemyTeam: Combatant[];
  playerStatProvenance?: PlayerStatProvenance;
  simulationConfiguration: SimulationReportJob['configuration'];
  searchSummary: { evaluations: number; elapsedMs?: number; completedSuccesses: number; timedSuccesses: number; incompleteTimingSuccesses: number;
    outcomeCounts: SimulationResult['outcomeCounts']; rootPlanCount?: number; candidateCount?: number; candidatesEvaluated?: number;
    depth?: number; fairStageEvaluations?: number; rngOverrideCounts?: SimulationResult['rngOverrideCounts']; runsWithResourceAlerts: number };
  selectedResult: SelectedResult;
  playerStrategy: { kind: 'observed-route' | 'fair-prefix' | 'not-retained'; plans: PlayerRoundPlan[] };
  rngRequirements: ReturnType<typeof collectRngRequirements>;
  executedBattle: { kind: 'global-fastest-observation' | 'fastest-timed-observation' | 'fewest-actions-observation'; totalFrames: number | null; rounds: number; actions: BattleActionRecord[] };
  diagnostics: string[];
}
export type BattleSimulationReport = DeepReadonly<ReportData>;
export const TIMING_SCOPE = 'Frame totals cover modeled battle actions. External real-game UI and order-menu overhead is not modeled.';
/** Observational only: consumes retained results and a detached dispatch snapshot. */
export function buildBattleSimulationReport(result: SimulationResult, job: DeepReadonly<SimulationReportJob>): BattleSimulationReport | null {
  if ((result.search?.completedSimulations ?? result.optimized?.evaluations ?? result.totalSimulations) === 0) return null;
  const o = result.optimized, route = o?.fastestRoute;
  const actions = route?.actions ?? (result.fastestBattleByFrames.length ? result.fastestBattleByFrames : result.fastestBattleHistory);
  const rounds = actions.reduce((n, a) => Math.max(n, a.round), 0);
  const status = result.search?.status ?? o?.status ?? 'completed';
  const diagnostics = [TIMING_SCOPE, ...result.timingDiagnostics, ...result.resourceDiagnostics, ...(o?.diagnostics ?? []),
    ...actions.flatMap(a => [...a.timingDiagnostics, ...a.resourceDiagnostics, ...a.resourceAlerts.map(resourceAlertText), ...(a.effectDiagnostics ?? [])])];
  if (job.source.kind === 'run-planner') diagnostics.push(...job.source.diagnostics.map(d => d.message), 'Current HP/MP are simulation-start resources, not historical Planner-tracked values.');
  if (status === 'cancelled') diagnostics.push('Search status: Cancelled / Partial. Results contain only completed observations retained before cancellation. Incomplete candidate stages are not fair comparisons.');
  if (job.configuration.rules.rngPolicy === 'tas-favorable') diagnostics.push('Statistics are conditional on TAS Favorable policy, not natural probabilities. Simulator seeds are not game RNG seeds or manipulation inputs.');
  if (!o) diagnostics.push('Random Monte Carlo does not retain an intended Player decision trace or per-route seed. Executed actions are observations, not reconstructed Player orders.', ...(job.configuration.seed === undefined ? ['This run used an unseeded production RNG; exact random-stream reproduction is unavailable.'] : []));
  if (o) diagnostics.push('Beam pruning and stochastic rollouts do not exhaust the battle tree. Orders after Round 1 are path-specific, not a complete adaptive policy.');
  if (o && o.objective !== 'fastest-potential') diagnostics.push('No representative replay of the selected fair strategy is retained. Executed Battle is the global fastest observation and may belong to another prefix.');
  if (!actions.length) diagnostics.push('No completed victory history is retained.');
  const encounterId = job.source.kind === 'run-planner' ? job.source.selectedBattle.encounterId : !Array.isArray(job.input.enemy) ? (job.input.enemy as { id?: number }).id : undefined;
  return immutable({ reportVersion: 1, resultStatus: status, source: job.source, battle: { encounterId, label: job.combatants.filter(a => a.side === 'enemy').map(a => a.name).join(' + ') },
    effectiveInput: job.input, playerTeam: job.combatants.filter(a => a.side === 'player'), enemyTeam: job.combatants.filter(a => a.side === 'enemy'),
    playerStatProvenance: job.playerStatProvenance, simulationConfiguration: job.configuration,
    searchSummary: { evaluations: result.search?.completedSimulations ?? o?.evaluations ?? result.totalSimulations, elapsedMs: result.search?.elapsedMs,
      completedSuccesses: result.completedSuccesses, timedSuccesses: result.timedSuccesses, incompleteTimingSuccesses: result.incompleteTimingSuccesses,
      outcomeCounts: result.outcomeCounts, runsWithResourceAlerts: result.runsWithResourceAlerts, rngOverrideCounts: result.rngOverrideCounts,
      ...(o ? { rootPlanCount: o.rootPlanCount, candidateCount: o.candidateCount, candidatesEvaluated: o.candidatesEvaluated, depth: o.depth, fairStageEvaluations: o.fairStageEvaluations } : {}) },
    selectedResult: o ? { kind: 'optimized-action-search', objective: o.objective,
      fastestCompleteRoute: route ? { totalFrames: route.totalFrames, rounds, sourcePrefixKey: route.sourcePrefixKey, seed: route.seed, sampleIndex: route.sampleIndex, decisionTrace: route.decisionTrace } : null,
      screenedPrefix: { plans: o.recommendedPrefix, statistics: o.recommendedStats },
      topCandidates: o.topCandidates.slice(0, 5).map(c => ({ key: c.key, statistics: c.stats, firstRoundOrders: c.plans[0]?.orders ?? [] })) }
      : { kind: 'random-monte-carlo', winRate: result.winRate, minFrames: result.minFrames, averageFrames: result.avgFrames, maxFrames: result.maxFrames, minActions: result.minTurns, averageActions: result.avgTurns, maxActions: result.maxTurns },
    playerStrategy: { kind: o ? o.objective === 'fastest-potential' ? 'observed-route' : 'fair-prefix' : 'not-retained', plans: o ? o.objective === 'fastest-potential' ? route?.decisionTrace ?? [] : o.recommendedPrefix : [] },
    rngRequirements: job.configuration.rules.rngPolicy === 'tas-favorable' ? collectRngRequirements(actions) : [],
    executedBattle: { kind: route ? 'global-fastest-observation' : result.fastestBattleByFrames.length ? 'fastest-timed-observation' : 'fewest-actions-observation', totalFrames: route?.totalFrames ?? (result.fastestBattleByFrames.length ? result.minFrames : null), rounds, actions },
    diagnostics: [...new Set(diagnostics)] }) as BattleSimulationReport;
}
