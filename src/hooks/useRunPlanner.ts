import { useRef, useState } from 'react';
import { recordRunBattle, RecordBattleRequest } from '@/utils/runBattleRecording';
import { BattleResolution } from '@/utils/runProgression';
import { addToDigiline, removeFromDigiline, moveDigilineMember, DigilineDirection } from '@/utils/runDigiline';
import { PersistedRunPlannerData, RunPlan } from '@/types/runPlanner';
import { createRunPlan } from '@/utils/runPlanCreation';
import { loadRunPlannerData, saveRunPlannerData, resetRunPlannerData } from '@/utils/runPlannerStorage';

/** Own the persisted envelope above tab content. Save only explicit user changes. */
export const useRunPlanner = () => {
  const [data, setData] = useState(loadRunPlannerData);
  const currentData = useRef(data);
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
    currentData.current = next;
    setError(null);
    return true;
  };

  const updateDigiline = (mutate: (run: RunPlan) => RunPlan): boolean => {
    if (!activeRun) return false;
    try {
      const changed = mutate(activeRun);
      if (changed === activeRun) return true;
      const nextRun = { ...changed, updatedAt: new Date().toISOString() };
      return persist({
        ...data,
        runs: data.runs.map((run) => run.id === activeRun.id ? nextRun : run),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the Digiline.');
      return false;
    }
  };

  const addMember = (id: string) => updateDigiline((run) => addToDigiline(run, id));
  const removeMember = (id: string) => updateDigiline((run) => removeFromDigiline(run, id));
  const moveMember = (id: string, direction: DigilineDirection) =>
    updateDigiline((run) => moveDigilineMember(run, id, direction));

  const recordBattle = (request: RecordBattleRequest): BattleResolution | null => {
    const current = currentData.current;
    const run = current.runs.find(entry => entry.id === current.activeRunId);
    if (!run) return null;
    try {
      const recorded = recordRunBattle(run, request);
      return persist({ ...current, runs: current.runs.map(entry => entry.id === run.id ? recorded.run : entry) })
        ? recorded.resolution : null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record this battle.');
      return null;
    }
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
      currentData.current = next;
      setError(null);
    }
    setStarterId('');
    setName('');
    return true;
  };

  return { data, activeRun, error, starterId, setStarterId, name, setName, startRun, loadRun, resetRun, addMember, removeMember, moveMember, recordBattle };
};
