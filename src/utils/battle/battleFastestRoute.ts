import { tasLuckRequirements, tasLuckTraceKey, type TasLuckDecisionTrace } from './battleTasLuck';
import { collectRngRequirements, type TasRngRequirement } from './battleRngAudit';
import type { BattleRunResult } from './battleTypes';
import type { PlayerRoundPlan } from './battleActionPlans';
import { playerDecisionTraceKey } from './battlePlayerDecisionTrace';

export interface FastestRoute {
  tasLuckTrace?: TasLuckDecisionTrace;
  sourcePlayerPrefix?: PlayerRoundPlan[];
  rngRequirements?: TasRngRequirement[];
  totalFrames: number; sourcePrefixKey: string; seed: number; sampleIndex: number;
  decisionTrace: PlayerRoundPlan[]; decisionTraceKey: string; actions: BattleRunResult['actions'];
}
/** One retained observation, independent of fair-stage ranking and completion order. */
export function createFastestRouteTracker() {
  let best: FastestRoute | null = null;
  return {
    get best() { return best; },
    consider(result: BattleRunResult, diverged: boolean, decisionTrace: PlayerRoundPlan[], sourcePrefixKey: string, sampleIndex: number, seed: number, sourcePlayerPrefix: PlayerRoundPlan[] = []) {
      if (diverged || result.outcome !== 'player-win' || result.timingCompleteness !== 'complete' || result.totalFrames === null) return;
      const next: FastestRoute = { totalFrames: result.totalFrames, sourcePrefixKey, sampleIndex, seed,
        ...(result.tasLuckTrace ? {tasLuckTrace: result.tasLuckTrace,sourcePlayerPrefix:structuredClone(sourcePlayerPrefix)} : {}), decisionTrace, decisionTraceKey: playerDecisionTraceKey(decisionTrace), actions: result.actions };
      const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
      if (!best || (next.totalFrames - best.totalFrames || lexical(next.decisionTraceKey, best.decisionTraceKey)
        || lexical(tasLuckTraceKey(next.tasLuckTrace??[]),tasLuckTraceKey(best.tasLuckTrace??[]))
        || lexical(next.sourcePrefixKey, best.sourcePrefixKey) || next.sampleIndex - best.sampleIndex || next.seed - best.seed) < 0) {
        const requirements = result.tasLuckTrace ? tasLuckRequirements(result.tasLuckTrace,result.state) : collectRngRequirements(result.actions);
        if (requirements.length) next.rngRequirements = requirements;
        best = next;
      }
    },
  };
}
