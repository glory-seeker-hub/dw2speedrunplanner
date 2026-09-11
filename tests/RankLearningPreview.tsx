import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { RunPlan } from '@/types/runPlanner';
import { BattleRecordControls, RecordBattleHandler } from '@/components/run-planner/BattleRecordControls';
import { recordRunBattle } from '@/utils/runBattleRecording';
import { recordRunDigivolution } from '@/utils/runDigivolutionRecording';
import { undoLastAction } from '@/utils/runActionUndo';
import { BattleTechniqueSelectionRequired } from '@/utils/techniqueCapacity';
import { BattleSelection } from '@/utils/runBattleSelection';
import fixture from './fixtures/route-snow-ready.json';
export function RankLearningPreview() {
  const [run, setRun] = useState(fixture as RunPlan);
  const [revision, setRevision] = useState(0);
  const member = run.roster.find(p => p.instanceId === fixture.digiline[0])!;
  const last = fixture.history.at(-1)!;
  const selection = { domainId: last.domainId, phase: last.phase, floor: last.floor, encounterId: last.encounterId } as BattleSelection;
  const record: RecordBattleHandler = request => {
    try { const result = recordRunBattle(run, request); setRun(result.run); return result.resolution; }
    catch (error) { if (error instanceof BattleTechniqueSelectionRequired) return {status: 'selection-required', choices: error.choices, expectedRunState: JSON.stringify(run)}; throw error; }
  };
  return <main className="max-w-4xl mx-auto p-4 space-y-4"><h1>Rank learning QA</h1><p>Real action fixture in memory. No user storage is read or written.</p>
    <h2>{member.name} · EL{member.level}</h2><p>Possessed: {member.techs.join(', ')}</p>
    <ul>{member.techniquePool.map(p => <li key={p.key}>{p.name}: {p.unlock.status}</li>)}</ul>
    <button className="border p-2" onClick={() => {const result=undoLastAction(run);if(result.ok){setRun(result.run);setRevision(n=>n+1);}}}>Undo</button>
    <button className="border p-2" onClick={() => {setRun(recordRunDigivolution(run,member.instanceId).run);setRevision(n=>n+1);}}>Digivolve</button>
    <BattleRecordControls key={revision} run={run} selection={selection} hasParticipants onRecord={record} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<RankLearningPreview />);
