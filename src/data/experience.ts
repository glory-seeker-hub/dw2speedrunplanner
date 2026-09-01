/**
 * DIGIMON WORLD 2 EXPERIENCE THRESHOLDS
 *
 * Values are CUMULATIVE total experience required to REACH each level.
 * Only verified levels are listed — never extrapolate beyond MAX_DEFINED_LEVEL.
 */
export const CUMULATIVE_XP_BY_LEVEL: Record<number, number> = {
  1: 0,
  2: 6,
  3: 16,
  4: 33,
  5: 57,
  6: 91,
  7: 138,
  8: 198,
  9: 274,
  10: 369,
  11: 483,
  12: 600,
  13: 760,
  14: 981,
  15: 1281,
  16: 1681,
  17: 2202,
  18: 2862,
  19: 3682,
  20: 4683,
  21: 5883,
  22: 7140,
  23: 8520,
  24: 10080,
  25: 11880,
  26: 13980,
  27: 16440,
  28: 19320,
  29: 22680,
  30: 26580,
  31: 31080,
  32: 35740,
  33: 40640,
  34: 45900,
  35: 51640,
  36: 57980,
  37: 65040,
  38: 72940,
  39: 81800,
  40: 91740,
  41: 102880,
  42: 115340,
  43: 129240,
  44: 144700,
  45: 161840,
  46: 180780,
  47: 201640,
  48: 224540,
  49: 249600,
  50: 277040,
};

export const MAX_DEFINED_LEVEL = Math.max(
  ...Object.keys(CUMULATIVE_XP_BY_LEVEL).map(Number)
);

/** True only when EVERY integer level from 1..maxLevel is present in the table. */
export const isExperienceTableCompleteThrough = (maxLevel: number): boolean => {
  if (!Number.isInteger(maxLevel) || maxLevel < 1) return false;
  for (let level = 1; level <= maxLevel; level += 1) {
    if (typeof CUMULATIVE_XP_BY_LEVEL[level] !== 'number') return false;
  }
  return true;
};

/** Highest level reachable with no gaps starting at level 1 (currently 50). */
export const getHighestContinuousExperienceLevel = (): number => {
  let level = 1;
  if (typeof CUMULATIVE_XP_BY_LEVEL[1] !== 'number') return 0;
  while (typeof CUMULATIVE_XP_BY_LEVEL[level + 1] === 'number') level += 1;
  return level;
};
