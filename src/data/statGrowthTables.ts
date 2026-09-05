/**
 * GENERATED — do not edit by hand.
 * Source: DW2_Lovable_JSON_Pack_v2 / stat_growth_tables.json
 *
 * Each row has exactly FOUR possible outcomes, each with probability 25%.
 * min / max / expected are derived, never stored separately, so they can never drift.
 */
export type GrowthRateKey = 'low' | 'normal' | 'high';

export interface GrowthTableRow {
  bracket: string;
  rate: GrowthRateKey | string;
  /** Exactly four equiprobable outcomes. */
  rolls: number[];
}

/** Authoritative probability of each of the four outcomes. */
export const GROWTH_OUTCOME_PROBABILITY = 0.25;
export const GROWTH_OUTCOMES_PER_ROW = 4;

/** Minimum EL for each rank — drives the ATK/DEF rank offset. */
export const RANK_MINIMUM_EL: Record<string, number> = {
  Rookie: 1,
  Champion: 11,
  Ultimate: 21,
  Mega: 31,
};

export const PLANNER_SCOPE_MAX_EL = 50;

/** Bracket is selected by the NEW EL. */
export const HP_MP_GROWTH_ROWS: GrowthTableRow[] = [
  { bracket: '1-11', rate: 'high', rolls: [9, 10, 11, 12] },
  { bracket: '1-11', rate: 'low', rolls: [8, 9, 10, 11] },
  { bracket: '1-11', rate: 'normal', rolls: [9, 10, 10, 11] },
  { bracket: '12-21', rate: 'high', rolls: [5, 6, 7, 7] },
  { bracket: '12-21', rate: 'low', rolls: [5, 5, 6, 7] },
  { bracket: '12-21', rate: 'normal', rolls: [5, 6, 6, 7] },
  { bracket: '22-31', rate: 'high', rolls: [4, 4, 5, 5] },
  { bracket: '22-31', rate: 'low', rolls: [3, 3, 4, 4] },
  { bracket: '22-31', rate: 'normal', rolls: [3, 4, 4, 5] },
  { bracket: '32-41', rate: 'high', rolls: [2, 2, 2, 3] },
  { bracket: '32-41', rate: 'low', rolls: [1, 2, 2, 2] },
  { bracket: '32-41', rate: 'normal', rolls: [1, 2, 2, 3] },
  { bracket: '42-51', rate: 'high', rolls: [0, 0, 1, 1] },
  { bracket: '42-51', rate: 'low', rolls: [0, 0, 1, 1] },
  { bracket: '42-51', rate: 'normal', rolls: [0, 0, 1, 1] },
  { bracket: '>51', rate: 'high', rolls: [0, 0, 0, 1] },
  { bracket: '>51', rate: 'low', rolls: [0, 0, 0, 1] },
  { bracket: '>51', rate: 'normal', rolls: [0, 0, 0, 1] },
];

/** Bracket is selected by rankOffset = newEL - RANK_MINIMUM_EL[rank]. */
export const ATK_DEF_GROWTH_ROWS: GrowthTableRow[] = [
  { bracket: '1', rate: 'high', rolls: [3, 4, 5, 5] },
  { bracket: '1', rate: 'low', rolls: [3, 3, 4, 5] },
  { bracket: '1', rate: 'normal', rolls: [3, 4, 4, 5] },
  { bracket: '2-3', rate: 'high', rolls: [3, 3, 4, 4] },
  { bracket: '2-3', rate: 'low', rolls: [2, 2, 3, 3] },
  { bracket: '2-3', rate: 'normal', rolls: [2, 3, 3, 4] },
  { bracket: '4-6', rate: 'high', rolls: [2, 2, 3, 3] },
  { bracket: '4-6', rate: 'low', rolls: [1, 1, 2, 2] },
  { bracket: '4-6', rate: 'normal', rolls: [1, 2, 2, 3] },
  { bracket: '7-10', rate: 'high', rolls: [1, 1, 1, 2] },
  { bracket: '7-10', rate: 'low', rolls: [0, 1, 1, 1] },
  { bracket: '7-10', rate: 'normal', rolls: [0, 1, 1, 2] },
  { bracket: '>10', rate: 'high', rolls: [0, 0, 0, 1] },
  { bracket: '>10', rate: 'low', rolls: [0, 0, 0, 1] },
  { bracket: '>10', rate: 'normal', rolls: [0, 0, 0, 1] },
];

/** Bracket is selected by the CURRENT SPD, before the level-up. */
export const SPD_GROWTH_ROWS: GrowthTableRow[] = [
  { bracket: '1-20', rate: 'high', rolls: [2, 3, 4, 4] },
  { bracket: '1-20', rate: 'low', rolls: [2, 2, 3, 4] },
  { bracket: '1-20', rate: 'normal', rolls: [2, 3, 3, 4] },
  { bracket: '21-50', rate: 'high', rolls: [2, 2, 3, 3] },
  { bracket: '21-50', rate: 'low', rolls: [1, 1, 2, 2] },
  { bracket: '21-50', rate: 'normal', rolls: [1, 2, 2, 3] },
  { bracket: '51-100', rate: 'high', rolls: [1, 1, 1, 2] },
  { bracket: '51-100', rate: 'low', rolls: [0, 1, 1, 1] },
  { bracket: '51-100', rate: 'normal', rolls: [0, 1, 1, 2] },
  { bracket: '>100', rate: 'high', rolls: [0, 0, 0, 1] },
  { bracket: '>100', rate: 'low', rolls: [0, 0, 0, 1] },
  { bracket: '>100', rate: 'normal', rolls: [0, 0, 0, 1] },
];
