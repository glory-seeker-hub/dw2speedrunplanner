import { RosterDigimon } from '@/types/runPlanner';
import { StatGrowthEstimate } from '@/types/runPlanner';
import { DigimonStats } from '@/types/digimon';
import { applyBattleXp } from '@/utils/experience';
import { applyExpectedLevelUpGrowth, StatKey } from '@/utils/statGrowth';
import { getResolvedReward } from '@/utils/rewardMatching';
import { tryCreateCapturedDigimon } from '@/utils/capture';

/**
 * BATTLE RESOLUTION FOR THE RUN PLANNER (pure, deterministic)
 *
 * GAME RULES enforced here:
 * - Every participating Digiline Digimon receives the FULL encounter XP (never split).
 * - At most ONE level per Digimon per battle; excess XP is retained.
 * - XP-to-next may legally be 0 right after a level-up.
 * - A level-up applies the deterministic EXPECTED stat growth (no RNG, no rerolls).
 * - The Digimon captured in a battle receives NO XP from that battle.
 *
 * Resolution order (authoritative):
 *   1. snapshot participants -> 2. award XP -> 3. at most one level-up ->
 *   4. expected stat growth -> 5. add Bits -> 6. add captured Digimon.
 */

export interface ParticipantOutcome {
  instanceId: string;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  previousTotalXp: number;
  newTotalXp: number;
  xpToNextLevel: number | null;
  previousStats: DigimonStats;
  newStats: DigimonStats;
  growth: Record<StatKey, StatGrowthEstimate> | null;
  statsWithoutGrowthData: StatKey[];
}

export interface BattleResolution {
  encounterId: number;
  /** Snapshot of the participating instance IDs, taken before any mutation. */
  participantIds: string[];
  xpAwarded: number;
  bitsAwarded: number;
  /** True when the encounter has no verified reward record (undefined, not zero). */
  rewardUnknown: boolean;
  roster: RosterDigimon[];
  outcomes: ParticipantOutcome[];
  capturedInstanceId: string | null;
  captureError: string | null;
  totalBits: number;
}

export interface ResolveBattleInput {
  encounterId: number;
  /** Instance IDs of the Digiline that fought (max 3). */
  digilineInstanceIds: string[];
  roster: RosterDigimon[];
  totalBits: number;
  capturedEnemySlot?: number | null;
}

export const resolveBattle = (input: ResolveBattleInput): BattleResolution => {
  const { encounterId, digilineInstanceIds, roster, totalBits } = input;

  // 1. Snapshot participants.
  const participantIds = digilineInstanceIds.filter((id) =>
    roster.some((r) => r.instanceId === id)
  );

  const reward = getResolvedReward(encounterId);
  const rewardUnknown = reward === undefined;
  const xpAwarded = reward?.xp ?? 0;
  const bitsAwarded = reward?.bits ?? 0;

  const outcomes: ParticipantOutcome[] = [];
  const nextRoster = roster.map((entry) => {
    if (!participantIds.includes(entry.instanceId)) return entry;

    // 2. Full encounter XP + 3. at most one level-up.
    const xp = applyBattleXp(entry.level, entry.totalXp, xpAwarded);

    // 4. Deterministic expected stat growth on level-up only.
    let newStats = entry.stats;
    let growth: ParticipantOutcome['growth'] = null;
    let missing: StatKey[] = [];
    if (xp.leveledUp) {
      const applied = applyExpectedLevelUpGrowth(
        entry.speciesId,
        xp.previousLevel,
        entry.stats
      );
      newStats = applied.stats;
      growth = applied.growth;
      missing = applied.missing;
    }

    outcomes.push({
      instanceId: entry.instanceId,
      previousLevel: xp.previousLevel,
      newLevel: xp.newLevel,
      leveledUp: xp.leveledUp,
      previousTotalXp: xp.previousTotalXp,
      newTotalXp: xp.newTotalXp,
      xpToNextLevel: xp.xpToNextLevel,
      previousStats: { ...entry.stats },
      newStats: { ...newStats },
      growth,
      statsWithoutGrowthData: missing,
    });

    return { ...entry, level: xp.newLevel, totalXp: xp.newTotalXp, stats: { ...newStats } };
  });

  // 6. Captured Digimon is added AFTER rewards and receives no XP from this battle.
  let capturedInstanceId: string | null = null;
  let captureError: string | null = null;
  if (typeof input.capturedEnemySlot === 'number') {
    const result = tryCreateCapturedDigimon(encounterId, input.capturedEnemySlot);
    if (result.ok) {
      nextRoster.push(result.digimon);
      capturedInstanceId = result.digimon.instanceId;
    } else {
      captureError = result.reason;
    }
  }

  return {
    encounterId,
    participantIds,
    xpAwarded,
    bitsAwarded,
    rewardUnknown,
    roster: nextRoster,
    outcomes,
    capturedInstanceId,
    captureError,
    // 5. Bits.
    totalBits: totalBits + bitsAwarded,
  };
};
