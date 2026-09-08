import { RunDigivolveEvent, RunPlan } from '@/types/runPlanner';
import { createRunActionCheckpoint } from '@/utils/runActionCheckpoint';
import { applyNormalDigivolution } from '@/utils/normalDigivolution';
import { getSpeciesProgression } from '@/data/speciesProgression';
import { validateRunPlan } from '@/utils/runInvariants';
import { newInstanceId } from '@/utils/capture';

/** Build and validate one atomic replacement. The caller owns persistence. */
export const recordRunDigivolution = (run: RunPlan, instanceId: string): { run: RunPlan; event: RunDigivolveEvent } => {
  const violations = validateRunPlan(run);
  if (violations.length) throw new Error(violations.map(v => v.message).join(' '));
  const before = run.roster.find(member => member.instanceId === instanceId);
  if (!before) throw new Error('This Digimon is not in the roster.');
  const preActionCheckpoint = createRunActionCheckpoint(run);
  const evolved = applyNormalDigivolution(before);
  const event: RunDigivolveEvent = {
    type: 'digivolve', id: newInstanceId(),
    order: run.history.length ? run.history[run.history.length - 1].order + 1 : 0,
    preActionCheckpoint, instanceId,
    fromSpeciesId: before.speciesId, toSpeciesId: evolved.speciesId,
    fromRank: getSpeciesProgression(before.speciesId)!.rank,
    toRank: getSpeciesProgression(evolved.speciesId)!.rank,
    level: before.level, dp: before.dp, levelCap: { ...before.levelCap }, hpBonus: 30, mpBonus: 30,
  };
  const next: RunPlan = { ...run,
    roster: run.roster.map(member => member.instanceId === instanceId ? evolved : member),
    history: [...run.history, event], updatedAt: new Date().toISOString(),
  };
  const nextViolations = validateRunPlan(next);
  if (nextViolations.length) throw new Error(nextViolations.map(v => v.message).join(' '));
  return { run: next, event };
};
