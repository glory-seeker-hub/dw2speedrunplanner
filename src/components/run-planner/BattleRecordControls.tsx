import { useState } from 'react';
import { getLevelCapChoices } from '@/utils/levelCap';
import { BattleSelection } from '@/utils/runBattleSelection';
import { getCaptureChoices, getRecordingEncounter, RecordBattleRequest } from '@/utils/runBattleRecording';
import { BattleResolution, BattleChoiceReview } from '@/utils/runProgression';
import { TechniqueSelection } from '@/types/techniqueCapacity';
import { TechniqueChoiceControls } from '@/components/run-planner/TechniqueChoiceControls';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type RecordBattleHandler = (request: RecordBattleRequest) => BattleResolution | BattleChoiceReview | null;

export const BattleRecordControls = ({ selection, hasParticipants, onRecord }: {
  selection: BattleSelection;
  hasParticipants: boolean;
  onRecord: RecordBattleHandler;
}) => {
  const [capture, setCapture] = useState('none');
  const [selectedCap, setSelectedCap] = useState('');
  const [result, setResult] = useState<BattleResolution | null>(null);
  const [review, setReview] = useState<{ response: BattleChoiceReview; request: RecordBattleRequest } | null>(null);
  const [selections, setSelections] = useState<TechniqueSelection[]>([]);
  const option = getRecordingEncounter(selection);
  const choices = getCaptureChoices(selection);
  const cap = choices.find(enemy => String(enemy.slot) === capture)?.levelCap;
  const capRequired = cap?.resolved === null;
  const blocked = !hasParticipants ? 'Add at least one Digimon to the Digiline before recording a battle.'
    : capRequired && !getLevelCapChoices(cap).includes(Number(selectedCap)) ? 'Select the exact Maximum EL before recording capture.'
    : !option?.preview?.reward ? 'Reward metadata is missing. This battle cannot be recorded.' : null;
  const submit = (request: RecordBattleRequest) => {
    const recorded = onRecord(request);
    if (recorded && 'status' in recorded) {
      setResult(null);
      setReview({ response: recorded, request });
      // All checked is neutral: overflow remains invalid until the player chooses what to discard.
      setSelections(recorded.choices.map(entry => ({ instanceId: entry.instanceId, keptKeys: entry.choice.candidates.map(p => p.key) })));
    } else if (recorded && 'roster' in recorded) { setResult(recorded); setCapture('none'); setSelectedCap(''); setReview(null); }
  };
  const record = (reviewTechniques = false) => submit({ ...selection, reviewTechniques,
    capturedEnemySlot: capture === 'none' ? null : Number(capture), capturedMaxLevel: selectedCap === '' ? null : Number(selectedCap) });
  return (
    <div className="space-y-4 rounded-lg border p-4">
      {option?.isBoss ? <p className="text-sm text-muted-foreground">Boss encounter: capture is unavailable.</p> : (
        <div className="max-w-md space-y-2">
          <Label htmlFor="battle-capture">Capture</Label>
          <Select value={capture} disabled={review !== null} onValueChange={value => { setCapture(value); setSelectedCap(''); }}>
            <SelectTrigger id="battle-capture"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No capture</SelectItem>
              {choices.map(enemy => <SelectItem key={enemy.slot} value={String(enemy.slot)} disabled={Boolean(enemy.unavailableReason)}>
                Slot {enemy.slot} — {enemy.name} EL {enemy.level}{enemy.unavailableReason ? ` (${enemy.unavailableReason})` : ''}
              </SelectItem>)}
            </SelectContent>
          </Select>
          {cap && (capRequired ? <>
            <Label htmlFor="capture-max-el">Maximum EL</Label>
            <Select value={selectedCap} disabled={review !== null} onValueChange={setSelectedCap}>
              <SelectTrigger id="capture-max-el"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{getLevelCapChoices(cap).map(value =>
                <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent>
            </Select>
          </> : <p className="text-sm">Maximum EL: {cap.resolved}</p>)}
        </div>
      )}
      <p className="text-sm text-muted-foreground">Recording keeps this encounter selected for the next battle and resets capture to No capture.</p>
      <Button onClick={() => record()} disabled={Boolean(blocked) || review !== null} aria-describedby={blocked ? 'record-battle-reason' : undefined}>Record Battle</Button>
      <Button variant="outline" onClick={() => record(true)} disabled={Boolean(blocked) || review !== null}>Review techniques before recording</Button>
      {review && <TechniqueChoiceControls choices={review.response.choices} selections={selections} onChange={setSelections}
        onCancel={() => setReview(null)} onConfirm={() => submit({ ...review.request, reviewTechniques: false,
          expectedRunState: review.response.expectedRunState, techniqueSelections: selections })} />}
      {blocked && <p id="record-battle-reason" className="text-sm text-destructive">{blocked}</p>}
      {result && <div role="status" className="space-y-3 text-sm">
        <p className="font-semibold">Battle recorded · +{result.xpAwarded} XP per participant · +{result.bitsAwarded} Bits</p>
        {result.outcomes.filter(outcome => outcome.leveledUp).map(outcome => (
          <div key={outcome.instanceId} className="space-y-1">
            <p>{result.roster.find(member => member.instanceId === outcome.instanceId)?.name} · EL {outcome.previousLevel} → {outcome.newLevel} · +{result.xpAwarded} XP</p>
            {outcome.learnedTechniques.length > 0 && <p>Learned technique: {outcome.learnedTechniques.join(', ')}</p>}
            {result.techniqueChoices.find(c => c.instanceId === outcome.instanceId)?.discarded.length > 0 &&
              <p>Discarded: {result.techniqueChoices.find(c => c.instanceId === outcome.instanceId)?.discarded.join(', ')}</p>}
            <p className="text-muted-foreground">Expected growth: {(['hp', 'mp', 'atk', 'def', 'spd'] as const).map(stat => `${stat.toUpperCase()} ${outcome.previousStats[stat]} → ${outcome.newStats[stat]}`).join(' · ')}</p>
            {outcome.statsWithoutGrowthData.length > 0 && <p>Growth data unavailable; unchanged: {outcome.statsWithoutGrowthData.join(', ').toUpperCase()}</p>}
          </div>
        ))}
        {result.capturedInstanceId && <p>Captured {result.roster.find(member => member.instanceId === result.capturedInstanceId)?.name} — added as Reserve, with no XP from this battle.</p>}
      </div>}
    </div>
  );
};
