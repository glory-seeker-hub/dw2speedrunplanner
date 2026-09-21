import { DigimonStats } from '@/types/digimon';
import {
  DigimonGrowthProfile,
  GrowthRate,
  StatGrowthEstimate,
  StatProgression,
} from '@/types/runPlanner';
import { getGrowthProfile } from '@/data/growthProfiles';
import {
  ATK_DEF_GROWTH_ROWS,
  GROWTH_OUTCOMES_PER_ROW,
  GROWTH_OUTCOME_PROBABILITY,
  GrowthTableRow,
  HP_MP_GROWTH_ROWS,
  RANK_MINIMUM_EL,
  SPD_GROWTH_ROWS,
} from '@/data/statGrowthTables';

export type StatKey = keyof DigimonStats;

/**
 * STAT GROWTH (pure + deterministic)
 *
 * Verified DW2 structure (DW2_Lovable_Authoritative_Rules_v3):
 * - HP/MP: bracket selected by the NEW EL.
 * - ATK/DEF: bracket selected by rankOffset = newEL - RANK_MINIMUM_EL[rank].
 * - SPD:    bracket selected by the CURRENT SPD, before the level-up.
 *
 * Every row has exactly FOUR equiprobable outcomes (25% each), so
 * expected = arithmetic mean of the four rolls. The planner always uses `expected`;
 * it NEVER rolls randomly, so replaying a run yields identical estimates.
 */

export type StatCategory = 'hpmp' | 'atkdef' | 'spd';

export const getStatCategory = (stat: StatKey): StatCategory => {
  if (stat === 'hp' || stat === 'mp') return 'hpmp';
  if (stat === 'atk' || stat === 'def') return 'atkdef';
  return 'spd';
};

export const rollsMin = (rolls: number[]): number => Math.min(...rolls);
export const rollsMax = (rolls: number[]): number => Math.max(...rolls);
/** Arithmetic mean of the four equiprobable outcomes. */
export const rollsExpected = (rolls: number[]): number =>
  rolls.reduce((sum, v) => sum + v, 0) / rolls.length;

/** Parses "1-11", "7-10", "1", ">51" and tests a value against it. */
export const bracketContains = (bracket: string, value: number): boolean => {
  const trimmed = bracket.trim();
  if (trimmed.startsWith('>')) return value > Number(trimmed.slice(1));
  if (trimmed.startsWith('<')) return value < Number(trimmed.slice(1));
  if (trimmed.includes('-')) {
    const [from, to] = trimmed.split('-').map(Number);
    return value >= from && value <= to;
  }
  return value === Number(trimmed);
};

const findRow = (
  rows: GrowthTableRow[],
  rate: GrowthRate,
  value: number
): GrowthTableRow | undefined =>
  rows.find((r) => r.rate === rate && bracketContains(r.bracket, value));

const rateFor = (profile: DigimonGrowthProfile, stat: StatKey): GrowthRate => {
  switch (stat) {
    case 'hp':
      return profile.hpGrowth;
    case 'mp':
      return profile.mpGrowth;
    case 'atk':
      return profile.atkGrowth;
    case 'def':
      return profile.defGrowth;
    default:
      return profile.spdGrowth;
  }
};

/** Minimum EL of a rank. `null` when the rank is unknown — never guessed from EL. */
export const getRankMinimumEL = (rank: string | undefined): number | null => {
  if (!rank) return null;
  const value = RANK_MINIMUM_EL[rank];
  return typeof value === 'number' ? value : null;
};

/** rankOffset = newEL - minimum EL of the profile's rank. */
export const getRankOffset = (
  rank: string | undefined,
  newEL: number
): number | null => {
  const min = getRankMinimumEL(rank);
  return min === null ? null : newEL - min;
};

const estimateFromRow = (row: GrowthTableRow): StatGrowthEstimate => ({
  available: true,
  min: rollsMin(row.rolls),
  max: rollsMax(row.rolls),
  expected: rollsExpected(row.rolls),
  rolls: [...row.rolls],
  outcomeProbability: GROWTH_OUTCOME_PROBABILITY,
  bracket: row.bracket,
});

/**
 * Growth window for a single stat on the next level-up (currentLevel -> currentLevel + 1).
 * `currentSpeed` is required for SPD (pre-level-up bracket lookup).
 */
export const estimateStatGrowth = (
  speciesId: string,
  stat: StatKey,
  currentLevel: number,
  currentSpeed?: number
): StatGrowthEstimate => {
  const profile = getGrowthProfile(speciesId);
  if (!profile) {
    return {
      available: false,
      reason: `No growth profile for species "${speciesId}".`,
    };
  }

  const rate = rateFor(profile, stat);
  const category = getStatCategory(stat);
  const newEL = currentLevel + 1;

  let row: GrowthTableRow | undefined;
  if (category === 'hpmp') {
    row = findRow(HP_MP_GROWTH_ROWS, rate, newEL);
  } else if (category === 'atkdef') {
    const rank = profile.rank ?? profile.stage;
    const offset = getRankOffset(rank, newEL);
    if (offset === null) {
      return {
        available: false,
        reason: `Growth profile for "${speciesId}" has no known rank, which ATK/DEF growth requires.`,
      };
    }
    row = findRow(ATK_DEF_GROWTH_ROWS, rate, offset);
  } else {
    if (typeof currentSpeed !== 'number' || !Number.isFinite(currentSpeed)) {
      return {
        available: false,
        reason: 'SPD growth requires the current Speed value (pre-level-up bracket lookup).',
      };
    }
    // Source brackets describe integer SPD. Normalize only the lookup key;
    // preserve the fractional expected stat when adding the selected growth.
    row = findRow(SPD_GROWTH_ROWS, rate, Math.floor(currentSpeed));
  }

  if (!row) {
    return {
      available: false,
      reason: `No verified growth row for species "${profile.speciesId}", EL ${currentLevel} -> ${newEL}, stat "${stat}", rate "${rate}"${category === 'spd' ? `, SPD ${currentSpeed}` : ''}.`,
    };
  }
  if (row.rolls.length !== GROWTH_OUTCOMES_PER_ROW) {
    return {
      available: false,
      reason: `Growth row for "${stat}" (${row.bracket}/${row.rate}) does not have exactly four outcomes.`,
    };
  }

  return estimateFromRow(row);
};

export const estimateAllStatGrowth = (
  speciesId: string,
  currentLevel: number,
  currentStats?: DigimonStats
): Record<StatKey, StatGrowthEstimate> => ({
  hp: estimateStatGrowth(speciesId, 'hp', currentLevel),
  mp: estimateStatGrowth(speciesId, 'mp', currentLevel),
  atk: estimateStatGrowth(speciesId, 'atk', currentLevel),
  def: estimateStatGrowth(speciesId, 'def', currentLevel),
  spd: estimateStatGrowth(speciesId, 'spd', currentLevel, currentStats?.spd),
});

/**
 * Applies the deterministic EXPECTED growth of one level-up to a stat block.
 * Fractional results are preserved — rounding happens only at the simulator boundary.
 * Stats without verified growth data are left untouched and reported.
 */
export const applyExpectedLevelUpGrowth = (
  speciesId: string,
  currentLevel: number,
  currentStats: DigimonStats
): {
  stats: DigimonStats;
  growth: Record<StatKey, StatGrowthEstimate>;
  missing: StatKey[];
} => {
  const growth = estimateAllStatGrowth(speciesId, currentLevel, currentStats);
  const stats: DigimonStats = { ...currentStats };
  const missing: StatKey[] = [];
  (Object.keys(stats) as StatKey[]).forEach((stat) => {
    const g = growth[stat];
    if (g.available) stats[stat] = currentStats[stat] + g.expected;
    else missing.push(stat);
  });
  return { stats, growth, missing };
};

/**
 * Builds a deterministic progression view. Known stats are never overwritten and no
 * random roll ever happens here, so recalculating or reloading is stable.
 */
export const buildStatProgression = (
  speciesId: string,
  currentLevel: number,
  currentStats: DigimonStats
): StatProgression => {
  const growthRange = estimateAllStatGrowth(speciesId, currentLevel, currentStats);
  const estimatedStats: StatProgression['estimatedStats'] = {};
  (Object.keys(currentStats) as StatKey[]).forEach((stat) => {
    const g = growthRange[stat];
    estimatedStats[stat] = g.available ? currentStats[stat] + g.expected : null;
  });
  return { currentStats: { ...currentStats }, estimatedStats, growthRange };
};
