import { BattleTechniqueAudit, BattleTechniqueChoice, TechniqueSelection } from '@/types/techniqueCapacity';
import { getBattleTechniqueChoices } from '@/utils/battleTechniqueChoices';
import { BattleTechniqueSelectionRequired, resolveTechniqueChoice } from '@/utils/techniqueCapacity';
import { RosterDigimon } from '@/types/runPlanner';
import { StatGrowthEstimate } from '@/types/runPlanner';
import { DigimonStats } from '@/types/digimon';
import { applyBattleXp } from '@/utils/experience';
import { applyExpectedLevelUpGrowth, StatKey } from '@/utils/statGrowth';
import { getResolvedReward } from '@/utils/rewardMatching';
import { tryCreateCapturedDigimon } from '@/utils/capture';
import { advanceTechniqueState, registerOwnTechnique } from '@/utils/techniqueInheritance';

/**
 * BATTLE RESOLUTION FOR THE RUN PLANNER (pure, deterministic)
 *
 * GAME RULES enforced here:
 * - Eligible Digiline participants receive FULL encounter XP (never split).
 * - Capped, unresolved-at-minimum and unsupported-scope participants retain their state,
 *   with distinct outcome flags. Teammates, Bits and captures still resolve.
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
  encounterXpReward: number;
  actualXpApplied: number;
  capped: boolean;
  capResolutionRequired: boolean;
  plannerScopeUnsupported: boolean;
  learnedTechniques: string[];
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
  techniqueChoices: BattleTechniqueAudit[];
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

export interface BattleChoiceReview {
  status: 'selection-required';
  choices: BattleTechniqueChoice[];
  expectedRunState: string;
}

export interface ResolveBattleInput {
  encounterId: number;
  /** Instance IDs of the Digiline that fought (max 3). */
  digilineInstanceIds: string[];
  roster: RosterDigimon[];
  totalBits: number;
  capturedEnemySlot?: number | null;
  capturedMaxLevel?: number | null;
  techniqueSelections?: TechniqueSelection[];
  reviewTechniques?: boolean;
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

  const choices = getBattleTechniqueChoices(roster, participantIds, xpAwarded);
  const selections = input.techniqueSelections ?? [];
  if (new Set(selections.map(s => s.instanceId)).size !== selections.length ||
      selections.some(s => !choices.some(c => c.instanceId === s.instanceId))) throw new Error('Invalid participant technique selection');
  const resolvedChoices = choices.map(entry => ({ entry, result: resolveTechniqueChoice(entry.choice,
    selections.find(s => s.instanceId === entry.instanceId)?.keptKeys) }));
  if ((input.reviewTechniques && choices.length > 0) || resolvedChoices.some(c => c.result.status === 'selection-required')) {
    throw new BattleTechniqueSelectionRequired(choices);
  }
  const techniqueChoices: BattleTechniqueAudit[] = [];
  const outcomes: ParticipantOutcome[] = [];
  const nextRoster = roster.map((entry) => {
    if (!participantIds.includes(entry.instanceId)) return entry;

    // 2. Cap-aware XP + 3. at most one level-up.
    const xp = applyBattleXp(entry.level, entry.totalXp, xpAwarded, entry.levelCap);
    const selected = resolvedChoices.find(c => c.entry.instanceId === entry.instanceId)?.result;
    const techniqueState = selected?.status === 'resolved'
      ? { techs: selected.techs, techniquePool: selected.techniquePool, learnedTechniques: selected.learned }
      : xp.leveledUp
      ? advanceTechniqueState(registerOwnTechnique({ techs: entry.techs, techniquePool: entry.techniquePool }, entry.speciesId, entry.level), entry.level, xp.newLevel)
      : { techs: entry.techs, techniquePool: entry.techniquePool, learnedTechniques: [] };
    const { learnedTechniques } = techniqueState;
    if (selected?.status === 'resolved') techniqueChoices.push({ instanceId: entry.instanceId, learned: selected.learned, discarded: selected.discarded });

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
      encounterXpReward: xpAwarded, actualXpApplied: xp.actualXpApplied,
      capped: xp.capped, capResolutionRequired: xp.capResolutionRequired,
      plannerScopeUnsupported: xp.plannerScopeUnsupported, learnedTechniques,
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

    return { ...entry, level: xp.newLevel, totalXp: xp.newTotalXp, stats: { ...newStats }, techs: techniqueState.techs, techniquePool: techniqueState.techniquePool };
  });

  // 6. Captured Digimon is added AFTER rewards and receives no XP from this battle.
  let capturedInstanceId: string | null = null;
  let captureError: string | null = null;
  if (typeof input.capturedEnemySlot === 'number') {
    const result = tryCreateCapturedDigimon(encounterId, input.capturedEnemySlot, input.capturedMaxLevel);
    if (result.ok === true) {
      nextRoster.push(result.digimon);
      capturedInstanceId = result.digimon.instanceId;
    } else if (result.ok === false) {
      captureError = result.reason;
    }
  }

  return {
    encounterId,
    techniqueChoices,
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
