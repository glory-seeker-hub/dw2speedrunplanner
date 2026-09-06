import { useState } from 'react';
import { PersistedRunPlannerData } from '@/types/runPlanner';
import { createRunPlan } from '@/utils/runPlanCreation';
import { loadRunPlannerData, saveRunPlannerData, resetRunPlannerData } from '@/utils/runPlannerStorage';

/** Own the persisted envelope above tab content. Save only explicit user changes. */
export const useRunPlanner = () => {
  const [data, setData] = useState(loadRunPlannerData);
  const [error, setError] = useState<string | null>(null);
  const [starterId, setStarterId] = useState('');
  const [name, setName] = useState('');
  const activeRun = data.runs.find((run) => run.id === data.activeRunId) ?? null;

  const persist = (next: PersistedRunPlannerData): boolean => {
    if (!saveRunPlannerData(next)) {
      setError('Could not save this change. Your current run has been kept. Check browser storage and try again.');
      return false;
    }
    setData(next);
    setError(null);
    return true;
  };

  const startRun = (): boolean => {
    if (activeRun) return false; // Replacement requires the confirmed reset flow.
    try {
      const run = createRunPlan(starterId, name);
      return persist({ ...data, runs: [...data.runs, run], activeRunId: run.id });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the run.');
      return false;
    }
  };

  const loadRun = (id: string) => {
    if (data.runs.some((run) => run.id === id)) persist({ ...data, activeRunId: id });
  };

  // Discard only the active run; other saved runs belong to the user too.
  const resetRun = (): boolean => {
    if (!activeRun) return false;
    const next = { ...data, runs: data.runs.filter((run) => run.id !== activeRun.id), activeRunId: null };
    if (next.runs.length > 0) {
      if (!persist(next)) return false;
    } else {
      if (!resetRunPlannerData()) {
        setError('Could not reset the saved run. Your current run has been kept. Try again.');
        return false;
      }
      setData(next);
      setError(null);
    }
    setStarterId('');
    setName('');
    return true;
  };

  return { data, activeRun, error, starterId, setStarterId, name, setName, startRun, loadRun, resetRun };
};
