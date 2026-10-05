import { validateCaptureTarget } from './battleCaptureObjective';
import { createTasLuckSearch, emptyTasLuckSummary, addTasLuckSummary, tasLuckCapForBudget } from './battleTasLuck';
import { createSeededBattleRng } from './battleRng';
import { createPlayerDecisionTrace } from './battlePlayerDecisionTrace';
import { createFastestRouteTracker } from './battleFastestRoute';
import { resolveSimulationRules, type AccuracyMode } from './battleSimulationRules';
import type { SimulationResult } from '@/types/digimon';
import type { BattleInput, BattleEngineOptions } from './battleTypes';
import { createBattleAccumulator } from './battleCompatibility';
import { simulateBattleCore } from './battleSimulation';
import { createProductionBattleRng } from './battleRng';

export interface SearchProgress {
  optimized?: import('./battleOptimizedSearch').OptimizedProgress;
  completedSimulations: number; requestedSimulations: number; successfulVictories: number;
  completeTimingVictories: number; bestFrames: number | null; bestFoundAtSimulation: number | null;
  bestOccurrenceCount: number; simulationsSinceLastImprovement: number | null;
  elapsedMs: number; simulationsPerSecond: number | null; etaMs: number | null;
}
export interface SimulationSearchMetadata extends SearchProgress { rngPolicy?: import('./battleRngPolicy').BattleRngPolicy; accuracyMode: AccuracyMode; status: 'completed' | 'cancelled' }
/** Natural uses one continuous stream; TAS Luck draws one replay seed per fair sample. */
export function createSimulationSearch(input: BattleInput, requested: number, options: BattleEngineOptions = {}) {
  if (!Number.isSafeInteger(requested) || requested < 1) throw new Error('Number of simulations must be a positive safe integer.');
  const snapshot = structuredClone(input);
  validateCaptureTarget(snapshot, options.captureObjective);
  const simulationRules = resolveSimulationRules(options.simulationRules);
  const rng = options.rng ?? createProductionBattleRng();
  const accumulator = createBattleAccumulator(options.captureObjective);
  let completed = 0;
  const tasSummary=emptyTasLuckSummary(options.tasFrontierCap??tasLuckCapForBudget(requested)),fastest=createFastestRouteTracker(options.captureObjective);
  let pending: ReturnType<typeof createTasLuckSearch> | null=null, sampleSeed=0;
  let counted=emptyTasLuckSummary(tasSummary.frontierCap);
  return {
    get completed() { return completed; },
    get done() { return completed === requested; },
    step() {
      if (completed === requested) return;
      if (simulationRules.rngPolicy==='tas-luck') {
        if(!pending){
          sampleSeed=rng.nextIntExclusive(0x100000000);
          pending=createTasLuckSearch(tasLuck=>{const decisions=createPlayerDecisionTrace();
            const result=simulateBattleCore(snapshot,{...options,simulationRules,rng:createSeededBattleRng(sampleSeed),tasLuck,playerDecisionObserver:decisions.observer});
            return {result,diverged:false,decisionTrace:decisions.trace};},tasSummary.frontierCap,false,options.captureObjective);
          counted=emptyTasLuckSummary(tasSummary.frontierCap);
        }
        pending.step();const delta={...pending.summary};for(const k of ['opportunities','branchesExplored','deduplicated','pruned'] as const)delta[k]-=counted[k];
        addTasLuckSummary(tasSummary,delta);counted={...pending.summary};
        const best=pending.best;if(best)fastest.consider(best.result,false,best.decisionTrace,'random-policy',completed,sampleSeed);
        if(pending.done){accumulator.add(pending.best!.result);completed++;pending=null;}return;
      }
      const run = simulateBattleCore(snapshot, { ...options, simulationRules, rng, simulationIndex: completed });
      if (run.outcome !== 'player-win' && run.outcome !== 'enemy-win') throw new Error(run.outcome + ': ' + run.diagnostics.join(' '));
      accumulator.add(run); completed++;
    },
    progress(elapsedMs: number): SearchProgress {
      const result = accumulator.snapshot();
      const speed = elapsedMs > 0 && completed > 0 ? completed / elapsedMs * 1000 : null;
      return { completedSimulations: completed, requestedSimulations: requested, successfulVictories: result.capture?.successes ?? result.completedSuccesses,
        completeTimingVictories: result.capture?.timedSuccesses ?? result.timedSuccesses, bestFrames: result.capture ? result.capture.minFrames : result.minFrames, ...accumulator.convergence(),
        elapsedMs, simulationsPerSecond: speed, etaMs: speed ? (requested - completed) / speed * 1000 : null };
    },
    result(status: SimulationSearchMetadata['status'], elapsedMs: number): SimulationResult {
      const observed = accumulator.snapshot();
      return { ...observed, ...(observed.capture && fastest.best?.capture ? { capture: { ...observed.capture, ...fastest.best.capture } } : {}), ...(simulationRules.rngPolicy==='tas-luck'?{tasLuckSummary:{...tasSummary},...(fastest.best?{tasLuckRoute:fastest.best}:{}),fastestBattleByFrames:fastest.best?.actions??[]}:{}), search: { ...this.progress(elapsedMs), accuracyMode: simulationRules.accuracyMode, ...(simulationRules.rngPolicy !== 'natural' ? { rngPolicy: simulationRules.rngPolicy } : {}), status } };
    },
  };
}
