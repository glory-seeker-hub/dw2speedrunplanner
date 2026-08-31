import { CUMULATIVE_XP_BY_LEVEL } from '@/data/experience';

/**
 * XP helpers. All return `null`/`false` when the required threshold is not yet known,
 * so missing data can never produce fabricated estimates.
 *
 * GAME RULE: a Digimon can gain at most ONE level per battle, regardless of accumulated XP.
 * Callers must therefore apply level-ups one battle at a time (see canLevelUp).
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
