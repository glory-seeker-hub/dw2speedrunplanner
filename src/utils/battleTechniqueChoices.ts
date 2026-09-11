import { RosterDigimon } from '@/types/runPlanner';
import { BattleTechniqueChoice, BattleTechniqueAudit, TechniqueSelection } from '@/types/techniqueCapacity';
import { getBattleTechniqueProgression } from '@/utils/battleTechniqueProgression';
import { buildTechniqueChoice, resolveTechniqueChoice } from '@/utils/techniqueCapacity';

export const getBattleTechniqueChoices = (roster: RosterDigimon[], participantIds: string[], xpReward: number): BattleTechniqueChoice[] =>
  roster.filter(entry => participantIds.includes(entry.instanceId)).flatMap(entry => {
    const { xp, state: advanced } = getBattleTechniqueProgression(entry, xpReward);
    if (!xp.leveledUp) return [];
    if (!advanced.learnedTechniques.length) return [];
    return [{ instanceId: entry.instanceId, name: entry.name, newLevel: xp.newLevel, currentlyPossessed: [...entry.techs],
      choice: buildTechniqueChoice(advanced, advanced.learnedTechniques) }];
  });

/** Validate historical choices from their checkpoint and snapshotted reward, without captures or RNG. */
export const isValidBattleTechniqueAudit = (
  audit: unknown, roster: RosterDigimon[], participantIds: string[], xpReward: number,
): audit is BattleTechniqueAudit[] => {
  try {
    const choices = getBattleTechniqueChoices(roster, participantIds, xpReward);
    if (!Array.isArray(audit) || audit.length !== choices.length) return false;
    return choices.every((entry, index) => {
      const item = audit[index];
      if (!item || item.instanceId !== entry.instanceId || !Array.isArray(item.learned) || !Array.isArray(item.discarded) ||
          !item.discarded.every((name: unknown) => typeof name === 'string')) return false;
      const kept = entry.choice.candidates.filter(p => !item.discarded.includes(p.name)).map(p => p.key);
      const result = resolveTechniqueChoice(entry.choice, kept);
      return result.status === 'resolved' && JSON.stringify(item.learned) === JSON.stringify(result.learned) &&
        JSON.stringify(item.discarded) === JSON.stringify(result.discarded);
    });
  } catch { return false; }
};
