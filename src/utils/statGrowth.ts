import { DigimonStats } from '@/types/digimon';
import {
  DigimonGrowthProfile,
  GrowthRate,
  StatGrowthEstimate,
  StatProgression,
} from '@/types/runPlanner';
import { getGrowthProfile } from '@/data/growthProfiles';

export type StatKey = keyof DigimonStats;

/**
 * STAT GROWTH FOUNDATION (pure + deterministic)
 *
 * Verified DW2 structure:
 * - HP and MP share the same growth rules (keyed by stage/rank + growth class + new level).
 * - ATK and DEF share the same growth rules (keyed by stage/rank + growth class + level).
 * - SPD uses brackets of the CURRENT Speed value, not the level.
 *
 * The tables below intentionally contain no data: the numeric DW2 growth tables are not
 * present in this repository, and no distribution is invented. `available: false` is
 * returned until real rows are supplied. `expected` may stay null when only min/max
 * are verified — never assume uniform probability between min and max.
 */

export type StatCategory = 'hpmp' | 'atkdef' | 'spd';

export const getStatCategory = (stat: StatKey): StatCategory => {
  if (stat === 'hp' || stat === 'mp') return 'hpmp';
  if (stat === 'atk' || stat === 'def') return 'atkdef';
  return 'spd';
};

/** One verified outcome window. `expected` null = distribution unknown. */
export interface GrowthRow {
  min: number;
  max: number;
  expected: number | null;
}

/** Keyed by stage/rank -> growth class -> level bracket (inclusive lower bound). */
export interface LevelBracketTable {
  [stageOrRank: string]: {
    [rate in GrowthRate]?: { fromLevel: number; row: GrowthRow }[];
  };
}

/** Keyed by stage/rank -> growth class -> current-speed bracket (inclusive lower bound). */
export interface SpeedBracketTable {
  [stageOrRank: string]: {
    [rate in GrowthRate]?: { fromSpeed: number; row: GrowthRow }[];
  };
}

export const HP_MP_GROWTH_TABLE: LevelBracketTable = {};
export const ATK_DEF_GROWTH_TABLE: LevelBracketTable = {};
export const SPD_GROWTH_TABLE: SpeedBracketTable = {};

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

const pickLevelRow = (
  table: LevelBracketTable,
  key: string,
  rate: GrowthRate,
  level: number
): GrowthRow | undefined => {
  const rows = table[key]?.[rate];
  if (!rows) return undefined;
  return [...rows]
    .filter((r) => level >= r.fromLevel)
    .sort((a, b) => b.fromLevel - a.fromLevel)[0]?.row;
};

const pickSpeedRow = (
  key: string,
  rate: GrowthRate,
  currentSpeed: number
): GrowthRow | undefined => {
  const rows = SPD_GROWTH_TABLE[key]?.[rate];
  if (!rows) return undefined;
  return [...rows]
    .filter((r) => currentSpeed >= r.fromSpeed)
    .sort((a, b) => b.fromSpeed - a.fromSpeed)[0]?.row;
};

/**
 * Growth window for a single stat on the next level-up.
 * `currentSpeed` is required for SPD (bracket lookup).
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
      reason: `No growth profile for species "${speciesId}" (DW2 growth data not yet populated).`,
    };
  }

  const key = profile.rank ?? profile.stage;
  if (!key) {
    return {
      available: false,
      reason: `Growth profile for "${speciesId}" has no stage/rank, which the DW2 growth tables require.`,
    };
  }

  const rate = rateFor(profile, stat);
  const category = getStatCategory(stat);

  let row: GrowthRow | undefined;
  if (category === 'hpmp') {
    // HP/MP use the NEW level.
    row = pickLevelRow(HP_MP_GROWTH_TABLE, key, rate, currentLevel + 1);
  } else if (category === 'atkdef') {
    row = pickLevelRow(ATK_DEF_GROWTH_TABLE, key, rate, currentLevel);
  } else {
    if (typeof currentSpeed !== 'number') {
      return {
        available: false,
        reason: 'SPD growth requires the current Speed value (bracket lookup).',
      };
    }
    row = pickSpeedRow(key, rate, currentSpeed);
  }

  if (!row) {
    return {
      available: false,
      reason: `No verified growth row for stage/rank "${key}", rate "${rate}", stat "${stat}".`,
    };
  }

  return { available: true, min: row.min, max: row.max, expected: row.expected };
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
    estimatedStats[stat] =
      g.available && g.expected !== null ? currentStats[stat] + g.expected : null;
  });
  return { currentStats: { ...currentStats }, estimatedStats, growthRange };
};
