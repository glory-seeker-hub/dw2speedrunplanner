import { RunDnaEvent, RunActionCheckpoint } from '@/types/runPlanner';
import { proposeDnaChild } from '@/utils/dnaProposal';
import { normalizeTechniqueName } from '@/data/techniqueMetadata';

export const isValidDnaEvent = (v: Record<string, unknown>, checkpoint: RunActionCheckpoint): v is Record<string, unknown> & RunDnaEvent => {
  try {
    if (typeof v.parentAInstanceId !== 'string' || typeof v.parentBInstanceId !== 'string' ||
        v.parentAInstanceId >= v.parentBInstanceId || typeof v.childInstanceId !== 'string' || !v.childInstanceId.trim() ||
        checkpoint.roster.some(p => p.instanceId === v.childInstanceId)) return false;
    const a = checkpoint.roster.find(p => p.instanceId === v.parentAInstanceId), b = checkpoint.roster.find(p => p.instanceId === v.parentBInstanceId);
    if (!a || !b || a.speciesId !== v.parentASpeciesId || a.name !== v.parentAName || b.speciesId !== v.parentBSpeciesId || b.name !== v.parentBName) return false;
    const decision = v.techniqueChoice as RunDnaEvent['techniqueChoice'];
    if (!decision || !Array.isArray(decision.kept) || !decision.kept.every(n => typeof n === 'string') || !Array.isArray(decision.discarded)) return false;
    const result = proposeDnaChild(a, b, decision.kept.map(normalizeTechniqueName));
    if (result.status !== 'ready') return false;
    const m = result.mechanical;
    return v.childSpeciesId === result.child.speciesId && v.childName === result.child.name &&
      v.matrixSelectionRank === m.matrixSelectionRank && v.matrixSelectionType === m.matrixSelectionType &&
      v.actualResultRank === m.actualResultRank && v.actualResultType === m.actualResultType && v.isMutation === m.isMutation &&
      v.childStartingLevel === m.startingLevel && v.childDp === m.childDp && v.childMaxLevel === m.childMaxLevel &&
      JSON.stringify(decision.kept) === JSON.stringify(result.techniqueChoice.kept) &&
      JSON.stringify(decision.discarded) === JSON.stringify(result.techniqueChoice.discarded);
  } catch { return false; }
};
