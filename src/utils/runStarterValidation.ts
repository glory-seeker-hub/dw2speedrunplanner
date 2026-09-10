import { RunPlan } from '@/types/runPlanner';
import { getStarterById } from '@/data/starters';
import { createStarterDigimon } from '@/utils/capture';
import { equalRunState } from '@/utils/runTransitionValidation';

export const validateStarterBinding = (run: RunPlan) => {
  const initial = run.history[0]?.preActionCheckpoint.roster ?? run.roster;
  const starter = initial.find(p => p.instanceId === run.starterInstanceId);
  const definition = getStarterById(run.starterDefinitionId);
  if (!starter || !definition || !equalRunState(starter, createStarterDigimon(definition, () => starter.instanceId))) {
    return [{ code: 'starter-definition-mismatch', message: 'Starter definition does not match historical starter state.' }];
  }
  return [];
};
