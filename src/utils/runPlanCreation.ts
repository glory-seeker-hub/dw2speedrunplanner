import { getStarterById } from '@/data/starters';
import { RunPlan } from '@/types/runPlanner';
import { createStarterDigimon, newInstanceId } from '@/utils/capture';
import { validateRunPlan } from '@/utils/runInvariants';

export const INITIAL_RUN_BITS = 1030;

/** Build a fresh plan from authoritative starter data, never species baseStats. */
export const createRunPlan = (starterId: string, name: string): RunPlan => {
  const starter = getStarterById(starterId);
  if (!starter) throw new Error('Choose an available starter.');
  const member = createStarterDigimon(starter);
  const now = new Date().toISOString();
  const run: RunPlan = {
    id: newInstanceId(),
    name: name.trim() || starter.label + ' Run',
    starterInstanceId: member.instanceId,
    roster: [member],
    digiline: [member.instanceId],
    history: [],
    // Initial balance is independent of battle history.
    totalBits: INITIAL_RUN_BITS,
    createdAt: now,
    updatedAt: now,
  };
  const violations = validateRunPlan(run);
  if (violations.length) throw new Error(violations.map((v) => v.message).join(' '));
  return run;
};
