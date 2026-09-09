import { recordDnaAction } from '@/utils/runDnaRecording';
import { useRef, useState } from 'react';
import { recordRunBattle, RecordBattleRequest } from '@/utils/runBattleRecording';
import { recordRunDigivolution } from '@/utils/runDigivolutionRecording';
import { BattleResolution, BattleChoiceReview } from '@/utils/runProgression';
import { BattleTechniqueSelectionRequired } from '@/utils/techniqueCapacity';
import { undoLastAction } from '@/utils/runActionUndo';
import { addToDigiline, removeFromDigiline, moveDigilineMember, DigilineDirection } from '@/utils/runDigiline';
import { PersistedRunPlannerData, RosterDigimon, RunPlan } from '@/types/runPlanner';
import { createRunPlan } from '@/utils/runPlanCreation';
import { loadRunPlannerData, saveRunPlannerData, resetRunPlannerData } from '@/utils/runPlannerStorage';

/** Own the persisted envelope above tab content. Save only explicit user changes. */
export const useRunPlanner = () => {
  const [data, setData] = useState(loadRunPlannerData);
  const currentData = useRef(data);
  const [error, setError] = useState<string | null>(null);
  const [starterId, setStarterId] = useState('');
  const [name, setName] = useState('');
  const [feedbackRevision, setFeedbackRevision] = useState(0);
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
    const current = currentData.current;
    const run = current.runs.find(entry => entry.id === current.activeRunId);
    if (!run) return false;
    try {
      const changed = mutate(run);
      if (changed === run) return true;
      const nextRun = { ...changed, updatedAt: new Date().toISOString() };
      return persist({
        ...current,
        runs: current.runs.map((entry) => entry.id === run.id ? nextRun : entry),
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

  const recordBattle = (request: RecordBattleRequest): BattleResolution | BattleChoiceReview | null => {
    const current = currentData.current;
    const run = current.runs.find(entry => entry.id === current.activeRunId);
    if (!run) return null;
    if ((request.techniqueSelections !== undefined || request.expectedRunState !== undefined) && request.expectedRunState !== JSON.stringify(run)) {
      setError('The run has changed. Cancel technique selection and review this battle again.');
      return null;
    }
    try {
      const recorded = recordRunBattle(run, request);
      return persist({ ...current, runs: current.runs.map(entry => entry.id === run.id ? recorded.run : entry) })
        ? recorded.resolution : null;
    } catch (cause) {
      if (cause instanceof BattleTechniqueSelectionRequired) {
        setError(null);
        return { status: 'selection-required', choices: cause.choices, expectedRunState: JSON.stringify(run) };
      }
      setError(cause instanceof Error ? cause.message : 'Could not record this battle.');
      return null;
    }
  };

  const digivolve = (expectedRunId: string, expectedMember: RosterDigimon): boolean => {
    const current = currentData.current;
    const run = current.runs.find(entry => entry.id === current.activeRunId);
    const member = run?.roster.find(entry => entry.instanceId === expectedMember.instanceId);
    if (!run || run.id !== expectedRunId || !member || JSON.stringify(member) !== JSON.stringify(expectedMember)) {
      setError('This Digimon or the active run has changed. Close the preview and review Digivolution again.');
      return false;
    }
    try {
      const recorded = recordRunDigivolution(run, member.instanceId);
      if (!persist({ ...current, runs: current.runs.map(entry => entry.id === run.id ? recorded.run : entry) })) return false;
      setFeedbackRevision(value => value + 1);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not Digivolve this Digimon.');
      return false;
    }
  };

  const dna = (expectedRunId: string, expectedA: RosterDigimon, expectedB: RosterDigimon, keptKeys?: string[]): boolean => {
    const current = currentData.current;
    const run = current.runs.find(r => r.id === current.activeRunId);
    const a = run?.roster.find(p => p.instanceId === expectedA.instanceId), b = run?.roster.find(p => p.instanceId === expectedB.instanceId);
    if (!run || run.id !== expectedRunId || !a || !b || JSON.stringify(a) !== JSON.stringify(expectedA) || JSON.stringify(b) !== JSON.stringify(expectedB)) {
      setError('The DNA parents or active run have changed. Review DNA again.'); return false;
    }
    try {
      const result = recordDnaAction(run, a.instanceId, b.instanceId, keptKeys);
      if (!persist({ ...current, runs: current.runs.map(r => r.id === run.id ? result.run : r) })) return false;
      setFeedbackRevision(v => v + 1); return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record DNA.'); return false;
    }
  };

  const undoAction = (expectedEventId: string, expectedRunId: string): boolean => {
    const current = currentData.current;
    const run = current.runs.find(entry => entry.id === current.activeRunId);
    if (!run) return false;
    if (run.id !== expectedRunId || run.history[run.history.length - 1]?.id !== expectedEventId) {
      setError('The latest action or active run has changed. Review it before undoing.');
      return false;
    }
    const result = undoLastAction(run);
    if (result.ok === false) { setError(result.reason); return false; }
    if (!persist({ ...current, runs: current.runs.map(entry => entry.id === run.id ? result.run : entry) })) return false;
    setFeedbackRevision(value => value + 1);
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
      currentData.current = next;
      setError(null);
    }
    setStarterId('');
    setName('');
    return true;
  };

  return { data, activeRun, error, starterId, setStarterId, name, setName, startRun, loadRun, resetRun, addMember, removeMember, moveMember, recordBattle, digivolve, dna, undoAction, feedbackRevision };
};
