import { collectRngRequirements, emptyRngOverrideCounts, addRngOverrideCounts } from './battleRngAudit';
import type { SimulationResult } from '@/types/digimon';
import type { Encounter } from '@/types/encounter';
import type { BattleEngineOptions, BattleRunResult, BattleTeamMember } from './battleTypes';
import { createProductionBattleRng } from './battleRng';
import { simulateBattleCore } from './battleSimulation';

/** Aggregate streaming runs without retaining every canonical history in a batch. */
export function createBattleAccumulator() {
  const result: SimulationResult = {
    winRate: 0, totalSimulations: 0, completedSuccesses: 0, timedSuccesses: 0, incompleteTimingSuccesses: 0,
    outcomeCounts: { 'player-win': 0, 'enemy-win': 0, 'limit-reached': 0, invalid: 0, unsupported: 0 },
    minTurns: null, avgTurns: null, maxTurns: null, minFrames: null, avgFrames: null, maxFrames: null,
    fastestBattleHistory: [], fastestBattleByFrames: [], timingDiagnostics: [], resourceDiagnostics: [], runsWithResourceAlerts: 0,
  };
  const timingDiagnostics = new Set<string>(), resourceDiagnostics = new Set<string>();
  let turns = 0, frames = 0;
  let bestFoundAtSimulation: number | null = null, bestOccurrenceCount = 0;
  const add = (run: BattleRunResult) => {
    const requirements = collectRngRequirements(run.actions);
    if (requirements.length) {
      result.rngOverrideCounts ??= emptyRngOverrideCounts();
      addRngOverrideCounts(result.rngOverrideCounts, requirements);
    }
    result.totalSimulations++; result.outcomeCounts[run.outcome]++;
    if (run.actions.some(a => a.resourceAlerts.length)) result.runsWithResourceAlerts++;
    // Deduplicate action-level messages rather than storing one ID per batch run.
    for (const action of run.actions) {
      action.timingDiagnostics.forEach(d => timingDiagnostics.add(d));
      action.resourceDiagnostics.forEach(d => resourceDiagnostics.add(d));
    }
    if (run.outcome !== 'player-win') return;
    result.completedSuccesses++; turns += run.actionCount;
    if (result.minTurns === null || run.actionCount < result.minTurns) {
      result.minTurns = run.actionCount; result.fastestBattleHistory = run.actions;
    }
    result.maxTurns = Math.max(result.maxTurns ?? 0, run.actionCount);
    if (run.timingCompleteness !== 'complete' || run.totalFrames === null) { result.incompleteTimingSuccesses++; return; }
    result.timedSuccesses++; frames += run.totalFrames;
    if (result.minFrames === null || run.totalFrames < result.minFrames) {
      result.minFrames = run.totalFrames; result.fastestBattleByFrames = run.actions;
      bestFoundAtSimulation = result.totalSimulations; bestOccurrenceCount = 1;
    }
    else if (run.totalFrames === result.minFrames) bestOccurrenceCount++;
    result.maxFrames = Math.max(result.maxFrames ?? 0, run.totalFrames);
  }
  const snapshot = (): SimulationResult => {
  result.winRate = result.totalSimulations ? result.completedSuccesses / result.totalSimulations * 100 : 0;
  result.avgTurns = result.completedSuccesses ? turns / result.completedSuccesses : null;
  result.avgFrames = result.timedSuccesses ? frames / result.timedSuccesses : null;
  result.timingDiagnostics = [...timingDiagnostics]; result.resourceDiagnostics = [...resourceDiagnostics];
  return { ...result, ...(result.rngOverrideCounts ? { rngOverrideCounts: { ...result.rngOverrideCounts } } : {}), outcomeCounts: { ...result.outcomeCounts } };
  };
  return { add, snapshot, convergence: () => ({ bestFoundAtSimulation, bestOccurrenceCount, simulationsSinceLastImprovement: bestFoundAtSimulation === null ? null : result.totalSimulations - bestFoundAtSimulation }) };
}
export function aggregateBattleRuns(runs: Iterable<BattleRunResult>): SimulationResult {
  const accumulator = createBattleAccumulator();
  for (const run of runs) accumulator.add(run);
  return accumulator.snapshot();
}
/** Retain the existing UI input/callback boundary. Seconds are deliberately removed. */
export function runLegacyBattleSimulation(player: readonly BattleTeamMember[], enemy: readonly BattleTeamMember[] | Encounter, floorSpecialty: string, simulationCount: number, options: BattleEngineOptions = {}): SimulationResult {
  if (!Number.isSafeInteger(simulationCount) || simulationCount < 1) throw new Error('simulationCount must be a positive safe integer.');
  const rng = options.rng ?? createProductionBattleRng();
  function* runs() {
    for (let i = 0; i < simulationCount; i++) {
      const result = simulateBattleCore({ player, enemy, floorSpecialty }, { ...options, rng, simulationIndex: i });
      // Existing UI error handling remains appropriate for invalid/incomplete batches.
      if (result.outcome !== 'player-win' && result.outcome !== 'enemy-win') throw new Error(`${result.outcome}: ${result.diagnostics.join(' ')}`);
      yield result;
    }
  }
  const result = aggregateBattleRuns(runs());
  return options.simulationRules ? { ...result, ...(options.simulationRules.rngPolicy === 'tas-favorable' ? { rngPolicy: options.simulationRules.rngPolicy } : {}), accuracyMode: options.simulationRules.accuracyMode } : result;
}
