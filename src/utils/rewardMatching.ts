import { encounters } from '@/data/encounters';
import {
  ENCOUNTER_REWARD_SOURCE,
  EncounterRewardSourceRecord,
} from '@/data/encounterRewardSource';
import { normalizeDigimonName } from '@/utils/digimonLookup';

/**
 * REWARD RECORD -> ENCOUNTER MATCHING
 *
 * Reward source records intentionally carry no project encounter IDs. They are matched
 * against src/data/encounters.ts using the full encounter identity available in both
 * sources: enemy count, normalized species names, multiplicity and levels.
 *
 * HARD RULES
 * - Never match on XP, Bits, source row or source label.
 * - Only a UNIQUE full-data match assigns a reward. Multiple candidates -> ambiguous.
 * - 0 XP / 0 Bits is VALID KNOWN DATA, never treated as missing.
 */

const enemyKey = (name: string, level: number): string =>
  `${normalizeDigimonName(name)}@${level}`;

const signatureOf = (enemies: { name: string; level: number }[]): string =>
  enemies
    .map((e) => enemyKey(e.name, e.level))
    .sort()
    .join('|');

const encountersBySignature = new Map<string, number[]>();
for (const encounter of encounters) {
  const signature = signatureOf(encounter.digimons);
  const list = encountersBySignature.get(signature);
  if (list) list.push(encounter.id);
  else encountersBySignature.set(signature, [encounter.id]);
}

export type RewardMatch =
  | { status: 'unique'; record: EncounterRewardSourceRecord; encounterId: number }
  | {
      status: 'ambiguous';
      record: EncounterRewardSourceRecord;
      candidateIds: number[];
      signature: string;
    }
  | { status: 'unmatched'; record: EncounterRewardSourceRecord; signature: string };

export const matchRewardRecord = (
  record: EncounterRewardSourceRecord
): RewardMatch => {
  const signature = signatureOf(record.slots);
  const candidates = encountersBySignature.get(signature) ?? [];
  if (candidates.length === 1) {
    return { status: 'unique', record, encounterId: candidates[0] };
  }
  if (candidates.length > 1) {
    return { status: 'ambiguous', record, candidateIds: [...candidates], signature };
  }
  return { status: 'unmatched', record, signature };
};

export const REWARD_MATCHES: RewardMatch[] = ENCOUNTER_REWARD_SOURCE.map(matchRewardRecord);

export interface ResolvedReward {
  xp: number;
  bits: number;
  /** 'verified-zero' means the source explicitly contains 0 XP / 0 Bits. */
  rewardStatus: string;
  sourceRow: number;
}

/** Only unique matches ever produce a reward entry. */
export const REWARDS_BY_ENCOUNTER_ID: Map<number, ResolvedReward> = new Map(
  REWARD_MATCHES.filter(
    (m): m is Extract<RewardMatch, { status: 'unique' }> => m.status === 'unique'
  ).map((m) => [
    m.encounterId,
    {
      xp: m.record.xp,
      bits: m.record.bits,
      rewardStatus: m.record.rewardStatus,
      sourceRow: m.record.sourceRow,
    },
  ])
);

export const AMBIGUOUS_REWARD_MATCHES = REWARD_MATCHES.filter(
  (m) => m.status === 'ambiguous'
);
export const UNMATCHED_REWARD_MATCHES = REWARD_MATCHES.filter(
  (m) => m.status === 'unmatched'
);

export const EXPLICIT_ZERO_REWARD_RECORDS = ENCOUNTER_REWARD_SOURCE.filter(
  (r) => r.xp === 0 && r.bits === 0
);

/** `undefined` = unknown reward. A returned 0 is a KNOWN reward of zero. */
export const getResolvedReward = (encounterId: number): ResolvedReward | undefined =>
  REWARDS_BY_ENCOUNTER_ID.get(encounterId);
