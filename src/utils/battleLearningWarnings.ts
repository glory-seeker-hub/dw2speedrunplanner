import { RunPlan } from '@/types/runPlanner';
import { DigimonRank } from '@/types/techniqueInheritance';
import { getBattleTechniqueProgression } from '@/utils/battleTechniqueProgression';
import { canCompleteLearningMilestone, getLearningMilestoneRank } from '@/utils/learningMilestones';
import { getRecordingEncounter } from '@/utils/runBattleRecording';
import { BattleSelection } from '@/utils/runBattleSelection';
import { previewNormalDigivolution } from '@/utils/normalDigivolution';
import { getSpeciesProgression } from '@/data/speciesProgression';
import { getTechniqueIdentity, TECHNIQUE_UNLOCK_LEVELS } from '@/data/techniqueMetadata';

export interface BattleLearningWarning {
  instanceId: string; name: string; currentRank: DigimonRank; requiredRank: DigimonRank;
  previousLevel: number; projectedLevel: number; milestone: number; techniques: string[];
}

/** Uses the exact cap-aware XP/technique transition used by recording. No future-form registration. */
export const getBattleLearningWarnings = (run: RunPlan, selection: BattleSelection): BattleLearningWarning[] => {
  const reward = getRecordingEncounter(selection)?.preview?.reward;
  if (!reward) return [];
  return run.roster.filter(p => run.digiline.includes(p.instanceId)).flatMap(member => {
    const { xp, rank, state } = getBattleTechniqueProgression(member, reward.xp);
    const requiredRank = getLearningMilestoneRank(xp.newLevel);
    if (!xp.leveledUp || !requiredRank || canCompleteLearningMilestone(rank, xp.newLevel)) return [];
    const atRisk = new Map(state.missedTechniques.map(name => [getTechniqueIdentity(name)!.key, name]));
    const evolution = previewNormalDigivolution(member);
    if (evolution.canDigivolve) {
      const target = getSpeciesProgression(evolution.targetSpeciesId);
      const own = target?.ownTechnique && getTechniqueIdentity(target.ownTechnique);
      if (target?.rank === requiredRank && own && TECHNIQUE_UNLOCK_LEVELS[own.rank] === xp.newLevel &&
          !member.techs.some(name => getTechniqueIdentity(name)?.key === own.key)) atRisk.set(own.key, own.name);
    }
    return [{ instanceId: member.instanceId, name: member.name, currentRank: rank, requiredRank,
      previousLevel: member.level, projectedLevel: xp.newLevel, milestone: xp.newLevel, techniques: [...atRisk.values()] }];
  });
};
