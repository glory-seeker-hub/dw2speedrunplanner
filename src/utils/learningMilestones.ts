import { TECHNIQUE_UNLOCK_LEVELS } from '@/data/techniqueMetadata';
import { DigimonRank } from '@/types/techniqueInheritance';

/** The canonical rank progression and existing milestone table define event eligibility.
 * Intrinsic technique rank is deliberately irrelevant to a DNA catch-up batch.
 */
export const getLearningMilestoneRank = (level: number): DigimonRank | undefined =>
  (Object.keys(TECHNIQUE_UNLOCK_LEVELS) as DigimonRank[]).find(rank => TECHNIQUE_UNLOCK_LEVELS[rank] === level);

export const canCompleteLearningMilestone = (currentRank: DigimonRank, level: number): boolean => {
  const required = getLearningMilestoneRank(level);
  return required !== undefined && TECHNIQUE_UNLOCK_LEVELS[currentRank] >= TECHNIQUE_UNLOCK_LEVELS[required];
};
