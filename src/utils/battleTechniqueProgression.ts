import { RosterDigimon } from '@/types/runPlanner';
import { getSpeciesProgression } from '@/data/speciesProgression';
import { applyBattleXp } from '@/utils/experience';
import { advanceTechniqueState, registerOwnTechnique } from '@/utils/techniqueInheritance';

/** Shared by recording, choice preflight, warnings and historical audit. */
export const getBattleTechniqueProgression = (entry: RosterDigimon, xpReward: number) => {
  const rank = getSpeciesProgression(entry.speciesId)?.rank;
  if (!rank) throw new Error('Missing current rank metadata');
  const xp = applyBattleXp(entry.level, entry.totalXp, xpReward, entry.levelCap);
  const state = xp.leveledUp
    ? advanceTechniqueState(registerOwnTechnique(entry, entry.speciesId, entry.level), entry.level, xp.newLevel, rank)
    : { techs: entry.techs, techniquePool: entry.techniquePool, learnedTechniques: [], missedTechniques: [] };
  return { rank, xp, state };
};

export const getBattleTechniqueMisses = (roster: RosterDigimon[], participantIds: string[], xpReward: number) =>
  roster.filter(p => participantIds.includes(p.instanceId)).flatMap(entry => {
    const { state } = getBattleTechniqueProgression(entry, xpReward);
    return state.missedTechniques.length ? [{ instanceId: entry.instanceId, missed: state.missedTechniques }] : [];
  });

export const isValidBattleTechniqueMisses = (audit: unknown, roster: RosterDigimon[], participantIds: string[], xpReward: number): boolean => {
  try {
    const expected = getBattleTechniqueMisses(roster, participantIds, xpReward);
    return audit === undefined ? expected.length === 0 : JSON.stringify(audit) === JSON.stringify(expected);
  } catch { return false; }
};
