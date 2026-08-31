import { DigimonStats } from '@/types/digimon';
import { StatGrowthEstimate } from '@/types/runPlanner';
import { getGrowthProfile } from '@/data/growthProfiles';

export type StatKey = keyof DigimonStats;

/**
 * Estimates the increase of a single stat on level-up.
 * Returns an explicit unavailable state while authoritative growth data is missing —
 * never a fabricated number.
 */
export const estimateStatGrowth = (
  speciesId: string,
  _stat: StatKey,
  _currentLevel: number
): StatGrowthEstimate => {
  const profile = getGrowthProfile(speciesId);
  if (!profile) {
    return {
      available: false,
      reason: `No growth profile for species "${speciesId}" (DW2 growth data not yet populated).`,
    };
  }
  // TODO(Phase 2+): apply the real DW2 growth formula once rates/stage data are supplied.
  return {
    available: false,
    reason: 'Growth formula not implemented yet — awaiting authoritative DW2 growth rules.',
  };
};

export const estimateAllStatGrowth = (
  speciesId: string,
  currentLevel: number
): Record<StatKey, StatGrowthEstimate> => ({
  hp: estimateStatGrowth(speciesId, 'hp', currentLevel),
  mp: estimateStatGrowth(speciesId, 'mp', currentLevel),
  atk: estimateStatGrowth(speciesId, 'atk', currentLevel),
  def: estimateStatGrowth(speciesId, 'def', currentLevel),
  spd: estimateStatGrowth(speciesId, 'spd', currentLevel),
});
