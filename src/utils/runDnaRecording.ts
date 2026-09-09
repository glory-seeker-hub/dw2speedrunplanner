import { RunPlan, RosterDigimon, RunDnaEvent } from '@/types/runPlanner';
import { proposeDnaChild, replaceDnaParents } from '@/utils/dnaProposal';
import { createRunActionCheckpoint } from '@/utils/runActionCheckpoint';
import { validateRunPlan } from '@/utils/runInvariants';
import { newInstanceId } from '@/utils/capture';
import { getHistoricalInstanceIds } from '@/utils/runInstanceLifecycle';

export const recordDnaAction = (run: RunPlan, parentAId: string, parentBId: string,
  keptKeys?: readonly string[], generateId: () => string = newInstanceId) => {
  const violations = validateRunPlan(run);
  if (violations.length) throw new Error(violations.map(v => v.message).join(' '));
  const a = run.roster.find(p => p.instanceId === parentAId), b = run.roster.find(p => p.instanceId === parentBId);
  if (!a || !b) throw new Error('Both DNA parents must be in the current roster');
  const proposal = proposeDnaChild(a, b, keptKeys);
  if (proposal.status === 'unavailable') throw new Error(`DNA unavailable: ${proposal.reason}`);
  if (proposal.status === 'selection-required') throw new Error('Technique selection required before DNA');
  const used = getHistoricalInstanceIds(run);
  run.history.forEach(event => used.add(event.id));
  const freshId = () => {
    const id = generateId();
    if (typeof id !== 'string' || !id.trim() || used.has(id)) throw new Error('Could not generate a fresh DNA ID');
    used.add(id); return id;
  };
  const child: RosterDigimon = { instanceId: freshId(), ...proposal.child };
  const [first, second] = [a, b].sort((x, y) => x.instanceId < y.instanceId ? -1 : 1);
  const m = proposal.mechanical;
  const event: RunDnaEvent = {
    type: 'dna', id: freshId(), order: run.history.length, preActionCheckpoint: createRunActionCheckpoint(run),
    parentAInstanceId: first.instanceId, parentBInstanceId: second.instanceId,
    parentASpeciesId: first.speciesId, parentAName: first.name,
    parentBSpeciesId: second.speciesId, parentBName: second.name,
    childInstanceId: child.instanceId, childSpeciesId: child.speciesId, childName: child.name,
    matrixSelectionRank: m.matrixSelectionRank, matrixSelectionType: m.matrixSelectionType,
    actualResultRank: m.actualResultRank, actualResultType: m.actualResultType, isMutation: m.isMutation,
    childStartingLevel: child.level, childDp: child.dp, childMaxLevel: m.childMaxLevel,
    techniqueChoice: proposal.techniqueChoice,
  };
  const parents = [a.instanceId, b.instanceId];
  const next: RunPlan = { ...run, roster: replaceDnaParents(run.roster, p => p.instanceId, parents, child),
    digiline: replaceDnaParents(run.digiline, id => id, parents, child.instanceId),
    history: [...run.history, event], updatedAt: new Date().toISOString() };
  const errors = validateRunPlan(next);
  if (errors.length) throw new Error(errors.map(e => e.message).join(' '));
  return { run: next, event, child };
};
