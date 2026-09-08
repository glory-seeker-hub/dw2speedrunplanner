import { CUMULATIVE_XP_BY_LEVEL } from '@/data/experience';
import { LevelCapState } from '@/types/runPlanner';
import { isValidLevelCap } from '@/utils/levelCap';
import { PLANNER_SCOPE_MAX_EL } from '@/data/statGrowthTables';

/**
 * XP helpers. All return `null`/`false` when the required threshold is not yet known,
 * so missing data can never produce fabricated estimates.
 *
 * GAME RULE: a Digimon can gain at most ONE level per battle, regardless of accumulated XP.
 */

/** Cumulative XP required to reach `level`. `null` when unknown. */
export const getRequiredTotalXpForLevel = (level: number): number | null => {
  const value = CUMULATIVE_XP_BY_LEVEL[level];
  return typeof value === 'number' ? value : null;
};

/**
 * XP still required to reach `level + 1`.
 * Returns 0 when totalXp already meets the next threshold, `null` when unknown.
 */
export const getXpRemainingForNextLevel = (
  level: number,
  totalXp: number
): number | null => {
  const next = getRequiredTotalXpForLevel(level + 1);
  if (next === null) return null;
  return Math.max(0, next - totalXp);
};

/** Whether the Digimon has enough XP for exactly one level-up. */
export const canLevelUp = (level: number, totalXp: number): boolean => {
  const remaining = getXpRemainingForNextLevel(level, totalXp);
  return remaining === 0;
};

export interface BattleXpResult {
  actualXpApplied: number;
  capped: boolean;
  capResolutionRequired: boolean;
  plannerScopeUnsupported: boolean;
  previousLevel: number;
  newLevel: number;
  previousTotalXp: number;
  newTotalXp: number;
  leveledUp: boolean;
  /** XP still missing for the next level; null when blocked or outside known thresholds. */
  xpToNextLevel: number | null;
}

/**
 * Pure XP application for a single battle.
 * Enforces the one-level-per-battle rule: newLevel is either currentLevel or +1.
 * Never touches stats.
 * The optional cap preserves the standalone XP-table API; roster progression always supplies it.
 */
export const applyBattleXp = (
  currentLevel: number,
  currentTotalXp: number,
  gainedXp: number,
  levelCap?: LevelCapState
): BattleXpResult => {
  if (!Number.isInteger(currentLevel) || currentLevel < 1) {
    throw new Error(`applyBattleXp: invalid level ${currentLevel}`);
  }
  if (!Number.isFinite(currentTotalXp) || currentTotalXp < 0) {
    throw new Error(`applyBattleXp: invalid totalXp ${currentTotalXp}`);
  }
  if (!Number.isFinite(gainedXp) || gainedXp < 0) {
    throw new Error(`applyBattleXp: invalid gainedXp ${gainedXp}`);
  }

  if (levelCap !== undefined && !isValidLevelCap(levelCap)) throw new Error('Invalid level cap');
  const capped = levelCap?.resolved != null && currentLevel >= levelCap.resolved;
  const capResolutionRequired = levelCap?.resolved === null && currentLevel >= levelCap.min;
  const plannerScopeUnsupported = !capped && !capResolutionRequired && currentLevel >= PLANNER_SCOPE_MAX_EL;
  if (capped || capResolutionRequired || plannerScopeUnsupported) return {
    previousLevel: currentLevel, newLevel: currentLevel, previousTotalXp: currentTotalXp,
    newTotalXp: currentTotalXp, leveledUp: false, xpToNextLevel: null,
    actualXpApplied: 0, capped, capResolutionRequired, plannerScopeUnsupported,
  };
  const newTotalXp = currentTotalXp + gainedXp;
  const leveledUp = canLevelUp(currentLevel, newTotalXp);
  const newLevel = leveledUp ? currentLevel + 1 : currentLevel;

  return {
    actualXpApplied: gainedXp, capped: false, capResolutionRequired: false, plannerScopeUnsupported: false,
    previousLevel: currentLevel,
    newLevel,
    previousTotalXp: currentTotalXp,
    newTotalXp,
    leveledUp,
    xpToNextLevel: getXpRemainingForNextLevel(newLevel, newTotalXp),
  };
};
