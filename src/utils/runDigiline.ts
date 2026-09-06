import { RunPlan } from '@/types/runPlanner';
import { validateRunPlan } from '@/utils/runInvariants';

export type DigilineDirection = 'up' | 'down';

const assertValidRun = (run: RunPlan): void => {
  const violations = validateRunPlan(run);
  if (violations.length) throw new Error(violations.map((v) => v.message).join(' '));
};

const assertRosterMember = (run: RunPlan, instanceId: string): void => {
  assertValidRun(run);
  if (!run.roster.some((member) => member.instanceId === instanceId)) {
    throw new Error('This Digimon is not in the roster.');
  }
};

/** Pure replacement: array order is slot order. The persistence layer timestamps changes. */
const withDigiline = (run: RunPlan, digiline: string[]): RunPlan => {
  const next = { ...run, digiline };
  assertValidRun(next);
  return next;
};

/** Append a reserve instance; existing invariants reject duplicates and a fourth member. */
export const addToDigiline = (run: RunPlan, instanceId: string): RunPlan => {
  assertRosterMember(run, instanceId);
  return withDigiline(run, [...run.digiline, instanceId]);
};

/** Keep every roster instance and the relative order of remaining active members. */
export const removeFromDigiline = (run: RunPlan, instanceId: string): RunPlan => {
  assertRosterMember(run, instanceId);
  if (!run.digiline.includes(instanceId)) return run;
  return withDigiline(run, run.digiline.filter((id) => id !== instanceId));
};

/** Swap adjacent active slots. Boundary moves are no-ops, never wrap around. */
export const moveDigilineMember = (
  run: RunPlan,
  instanceId: string,
  direction: DigilineDirection
): RunPlan => {
  assertRosterMember(run, instanceId);
  if (direction !== 'up' && direction !== 'down') throw new Error('Unknown move direction.');
  const index = run.digiline.indexOf(instanceId);
  if (index === -1) throw new Error('Only active Digiline members can be moved.');
  const target = index + (direction === 'up' ? -1 : 1);
  if (target < 0 || target >= run.digiline.length) return run;
  const digiline = [...run.digiline];
  [digiline[index], digiline[target]] = [digiline[target], digiline[index]];
  return withDigiline(run, digiline);
};
