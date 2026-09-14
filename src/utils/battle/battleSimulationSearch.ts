import { resolveSimulationRules, type AccuracyMode } from './battleSimulationRules';
import type { SimulationResult } from '@/types/digimon';
import type { BattleInput, BattleEngineOptions } from './battleTypes';
import { createBattleAccumulator } from './battleCompatibility';
import { simulateBattleCore } from './battleSimulation';
import { createProductionBattleRng } from './battleRng';

export interface SearchProgress {
  completedSimulations: number; requestedSimulations: number; successfulVictories: number;
  completeTimingVictories: number; bestFrames: number | null; bestFoundAtSimulation: number | null;
  bestOccurrenceCount: number; simulationsSinceLastImprovement: number | null;
  elapsedMs: number; simulationsPerSecond: number | null; etaMs: number | null;
}
export interface SimulationSearchMetadata extends SearchProgress { accuracyMode: AccuracyMode; status: 'completed' | 'cancelled' }
/** One continuous RNG and one accumulator per search; stepping never reseeds. */
export function createSimulationSearch(input: BattleInput, requested: number, options: BattleEngineOptions = {}) {
  if (!Number.isSafeInteger(requested) || requested < 1) throw new Error('Number of simulations must be a positive safe integer.');
  const snapshot = structuredClone(input);
  const simulationRules = resolveSimulationRules(options.simulationRules);
  const rng = options.rng ?? createProductionBattleRng();
  const accumulator = createBattleAccumulator();
  let completed = 0;
  return {
    get completed() { return completed; },
    get done() { return completed === requested; },
    step() {
      if (completed === requested) return;
      const run = simulateBattleCore(snapshot, { ...options, simulationRules, rng, simulationIndex: completed });
      if (run.outcome !== 'player-win' && run.outcome !== 'enemy-win') throw new Error(run.outcome + ': ' + run.diagnostics.join(' '));
      accumulator.add(run); completed++;
    },
    progress(elapsedMs: number): SearchProgress {
      const result = accumulator.snapshot();
      const speed = elapsedMs > 0 && completed > 0 ? completed / elapsedMs * 1000 : null;
      return { completedSimulations: completed, requestedSimulations: requested, successfulVictories: result.completedSuccesses,
        completeTimingVictories: result.timedSuccesses, bestFrames: result.minFrames, ...accumulator.convergence(),
        elapsedMs, simulationsPerSecond: speed, etaMs: speed ? (requested - completed) / speed * 1000 : null };
    },
    result(status: SimulationSearchMetadata['status'], elapsedMs: number): SimulationResult {
      return { ...accumulator.snapshot(), search: { ...this.progress(elapsedMs), accuracyMode: simulationRules.accuracyMode, status } };
    },
  };
}
