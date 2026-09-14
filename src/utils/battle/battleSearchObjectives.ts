import type { BattleRunResult } from './battleTypes';
export type BattleSearchMethod = 'random-monte-carlo' | 'optimized-action-search';
export type OptimizationObjective = 'fastest-potential' | 'average-victory' | 'success-rate';
export const OBJECTIVE_LABELS: Record<OptimizationObjective, string> = {
  'fastest-potential': 'Fastest Potential', 'average-victory': 'Average Victory', 'success-rate': 'Success Rate',
};
export interface OptimizedCandidateStats {
  evaluations: number; validExecutions: number; victories: number; completeTimingVictories: number; diverged: number;
  sumFrames: number; fastestFrames: number | null; averageVictoryFrames: number | null; successRate: number; divergenceRate: number;
}
export const emptyCandidateStats = (): OptimizedCandidateStats => ({ evaluations: 0, validExecutions: 0, victories: 0,
  completeTimingVictories: 0, diverged: 0, sumFrames: 0, fastestFrames: null, averageVictoryFrames: null, successRate: 0, divergenceRate: 0 });
export function addCandidateOutcome(stats: OptimizedCandidateStats, result: BattleRunResult, diverged: boolean) {
  stats.evaluations++;
  if (diverged) stats.diverged++;
  else {
    stats.validExecutions++;
    if (result.outcome === 'player-win') {
      stats.victories++;
      if (result.timingCompleteness === 'complete' && result.totalFrames !== null) {
        stats.completeTimingVictories++; stats.sumFrames += result.totalFrames;
        stats.fastestFrames = Math.min(stats.fastestFrames ?? Infinity, result.totalFrames);
      }
    }
  }
  stats.averageVictoryFrames = stats.completeTimingVictories ? stats.sumFrames / stats.completeTimingVictories : null;
  stats.successRate = stats.victories / stats.evaluations; stats.divergenceRate = stats.diverged / stats.evaluations;
}
export interface RankedCandidate { key: string; stats: OptimizedCandidateStats }
export function compareCandidates(a: RankedCandidate, b: RankedCandidate, objective: OptimizationObjective): number {
  const av = a.stats, bv = b.stats;
  const low = (x: number | null, y: number | null) => x === y ? 0 : x === null ? 1 : y === null ? -1 : x - y;
  const fast = low(av.fastestFrames, bv.fastestFrames), mean = low(av.averageVictoryFrames, bv.averageVictoryFrames);
  const success = bv.successRate - av.successRate;
  return (objective === 'fastest-potential' ? fast || success || mean : objective === 'average-victory' ? mean || success || fast : success || mean || fast)
    || av.divergenceRate - bv.divergenceRate || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}
/** FNV-1a followed by an integer avalanche. Candidate identity is intentionally excluded. */
export function rolloutSeed(rootSeed: number, depth: number, parentKey: string, sampleIndex: number): number {
  let value = 2166136261;
  for (const c of JSON.stringify([rootSeed >>> 0, depth, parentKey, sampleIndex])) value = Math.imul(value ^ c.charCodeAt(0), 16777619);
  value ^= value >>> 16; value = Math.imul(value, 0x7feb352d); value ^= value >>> 15;
  return (Math.imul(value, 0x846ca68b) ^ (value >>> 16)) >>> 0;
}
export interface RepresentativeSample { frames: number; sampleIndex: number; seed: number; rounds?: number }
/** Samples are bounded by the configured finite evaluation-stage ceiling (64 by default). */
export function representativeSample(samples: readonly RepresentativeSample[], objective: OptimizationObjective): RepresentativeSample | null {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a.frames - b.frames || a.sampleIndex - b.sampleIndex);
  if (objective === 'fastest-potential') return sorted[0];
  const middle = (sorted[Math.floor((sorted.length - 1) / 2)].frames + sorted[Math.floor(sorted.length / 2)].frames) / 2;
  return sorted.sort((a, b) => Math.abs(a.frames - middle) - Math.abs(b.frames - middle) || a.sampleIndex - b.sampleIndex)[0];
}
