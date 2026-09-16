import type { BattleStatus, RecoverableState } from './battleStatuses';
import type { BattleSide } from './battleTypes';
import type { BattleRng, BattleDrawCategory } from './battleRng';

export type BattleRngPolicy = 'natural' | 'tas-favorable';
export const RNG_POLICY_LABELS: Record<BattleRngPolicy, string> = { natural: 'Natural', 'tas-favorable': 'TAS Favorable' };
export interface RngResolution {
  policy: 'tas-favorable'; category: 'direct-status-application' | 'natural-status-recovery' | 'paralysis-failure';
  affectedSide: BattleSide; outcome: 'apply' | 'prevent' | 'recover' | 'remain' | 'miss' | 'pass';
  naturalProbability: { numerator: number; denominator: number }; rollSkipped: true;
}
interface Gate { succeeds: boolean; roll: number | null; rngResolution?: RngResolution }
function gate(policy: BattleRngPolicy, side: BattleSide, category: RngResolution['category'], favorable: boolean,
  outcomes: [RngResolution['outcome'], RngResolution['outcome']], numerator: number, denominator: number,
  rng: BattleRng, drawCategory: BattleDrawCategory, natural: (roll: number) => boolean): Gate {
  if (policy === 'tas-favorable') return { succeeds: favorable, roll: null, rngResolution: {
    policy, category, affectedSide: side, outcome: outcomes[favorable ? 0 : 1],
    naturalProbability: { numerator: favorable ? numerator : denominator - numerator, denominator }, rollSkipped: true,
  } };
  const roll = rng.nextIntExclusive(denominator, drawCategory);
  return { succeeds: natural(roll), roll };
}
export function resolveDirectStatusApplication(policy: BattleRngPolicy, side: BattleSide, status: BattleStatus, successes: 1 | 2, rng: BattleRng): Gate {
  return gate(policy, side, 'direct-status-application', side === 'enemy', ['apply', 'prevent'], successes, 3, rng, `status-apply-${status}`, roll => roll < successes);
}
export function resolveNaturalStatusRecovery(policy: BattleRngPolicy, side: BattleSide, status: RecoverableState, rng: BattleRng): Gate {
  // Only these two recoverable states are in the authoritative I4 matrix.
  const supported = status === 'paralysis' || status === 'confusion' || status === 'motivation-down';
  return gate(supported ? policy : 'natural', side, 'natural-status-recovery', side === 'player', ['recover', 'remain'], 1, 4, rng, `status-recovery-${status}`, roll => roll === 0);
}
export function resolveParalysisFailure(policy: BattleRngPolicy, side: BattleSide, rng: BattleRng): Gate {
  return gate(policy, side, 'paralysis-failure', side === 'enemy', ['miss', 'pass'], 1, 2, rng, 'paralysis-failure', roll => roll === 1);
}
