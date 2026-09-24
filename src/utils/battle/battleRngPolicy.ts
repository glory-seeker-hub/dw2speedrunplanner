import type { BattleStatus, RecoverableState } from './battleStatuses';
import type { BattleSide } from './battleTypes';
import type { BattleRng, BattleDrawCategory } from './battleRng';

export type BattleRngPolicy = 'natural' | 'tas-favorable' | 'tas-luck';
export const RNG_POLICY_LABELS: Record<BattleRngPolicy, string> = { natural: 'Natural', 'tas-luck': 'TAS Luck', 'tas-favorable': 'TAS Favorable' };
export interface RngResolution {
  opportunityKey?: string;
  policy: 'tas-favorable' | 'tas-luck'; category: 'direct-status-application' | 'natural-status-recovery' | 'paralysis-failure';
  affectedSide: BattleSide; outcome: 'apply' | 'prevent' | 'recover' | 'remain' | 'miss' | 'pass';
  naturalProbability: { numerator: number; denominator: number }; rollSkipped: true;
}
interface Gate { succeeds: boolean; roll: number | null; rngResolution?: RngResolution }
function gate(policy: BattleRngPolicy, side: BattleSide, category: RngResolution['category'], favorable: boolean,
  outcomes: [RngResolution['outcome'], RngResolution['outcome']], numerator: number, denominator: number,
  rng: BattleRng, drawCategory: BattleDrawCategory, natural: (roll: number) => boolean, status?: string, targetId?: string, conflict = false): Gate {
  if (policy === 'tas-luck' && conflict) {
    if (!rng.tasLuck) throw new Error('TAS Luck requires a search/replay controller.');
    const outcome = rng.tasLuck.choose(category,status,targetId,outcomes,numerator,denominator);
    const succeeds = outcome === outcomes[0];
    return {succeeds,roll:null,rngResolution:{...(rng.tasLuck.lastOpportunityKey ? {opportunityKey:rng.tasLuck.lastOpportunityKey} : {}),policy,category,affectedSide:side,outcome,naturalProbability:{numerator:succeeds?numerator:denominator-numerator,denominator},rollSkipped:true}};
  }
  if (policy !== 'natural') return { succeeds: favorable, roll: null, rngResolution: {
    policy, category, affectedSide: side, outcome: outcomes[favorable ? 0 : 1],
    naturalProbability: { numerator: favorable ? numerator : denominator - numerator, denominator }, rollSkipped: true,
  } };
  const roll = rng.nextIntExclusive(denominator, drawCategory);
  return { succeeds: natural(roll), roll };
}
export function resolveDirectStatusApplication(policy: BattleRngPolicy, side: BattleSide, status: BattleStatus, successes: 1 | 2, rng: BattleRng, targetId?: string): Gate {
  return gate(policy, side, 'direct-status-application', side === 'enemy', ['apply', 'prevent'], successes, 3, rng, `status-apply-${status}`, roll => roll < successes, status, targetId);
}
export function resolveNaturalStatusRecovery(policy: BattleRngPolicy, side: BattleSide, status: RecoverableState, rng: BattleRng, targetId?: string): Gate {
  // Only these three recoverable statuses are supported manipulation gates.
  const supported = status === 'paralysis' || status === 'confusion' || status === 'motivation-down';
  return gate(supported ? policy : 'natural', side, 'natural-status-recovery', side === 'player', ['recover', 'remain'], 1, 4, rng, `status-recovery-${status}`, roll => roll === 0, status, targetId);
}
export function resolveParalysisFailure(policy: BattleRngPolicy, side: BattleSide, rng: BattleRng, targetId?: string, confused = false): Gate {
  return gate(policy, side, 'paralysis-failure', side === 'enemy', ['miss', 'pass'], 1, 2, rng, 'paralysis-failure', roll => roll === 1, 'paralysis', targetId, side === 'enemy' && confused);
}
