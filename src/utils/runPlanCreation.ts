import { getStarterById } from '@/data/starters';
import { RunPlan } from '@/types/runPlanner';
import { createStarterDigimon, newInstanceId } from '@/utils/capture';
import { validateRunPlan } from '@/utils/runInvariants';

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
    battles: [],
    // Planner balance starts at zero; no battle rewards have been earned.
    totalBits: 0,
    createdAt: now,
    updatedAt: now,
  };
  const violations = validateRunPlan(run);
  if (violations.length) throw new Error(violations.map((v) => v.message).join(' '));
  return run;
};
