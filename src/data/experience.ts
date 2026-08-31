/**
 * DIGIMON WORLD 2 EXPERIENCE THRESHOLDS  (Phase 1 foundation)
 *
 * DEVELOPER NOTE: the repository contains no authoritative XP table (encounter data has no
 * XP rewards, and no level/XP dataset exists). Nothing is invented here.
 *
 * To populate: map level -> cumulative total XP required to REACH that level.
 * Level 1 is 0 by definition.
 */
export const CUMULATIVE_XP_BY_LEVEL: Record<number, number> = {
  1: 0,
};

export const MAX_DEFINED_LEVEL = Math.max(
  ...Object.keys(CUMULATIVE_XP_BY_LEVEL).map(Number)
);

/** True when the XP table is complete enough to be used for planning. */
export const isExperienceTableComplete = (): boolean => MAX_DEFINED_LEVEL > 1;
