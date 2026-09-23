import { useReducer, useState } from 'react';
import { RunPlan } from '@/types/runPlanner';
import { STORY_SEGMENTS, StorySegment, getStoryDomains } from '@/data/storySegments';
import { getColiseumBattle } from '@/data/coliseumBattles';
import { battleSelectionReducer, initialBattleSelection, getColiseumOptions, getFloorsForDomain, getEncountersForFloor } from '@/utils/runBattleSelection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { BattlePreview } from '@/components/run-planner/BattlePreview';
import { BattleRecordControls, RecordBattleHandler } from '@/components/run-planner/BattleRecordControls';


export const BattleSelector = ({ hasParticipants, onRecord, run }: { hasParticipants: boolean; onRecord: RecordBattleHandler; run?: RunPlan }) => {
  const [selection, dispatch] = useReducer(battleSelectionReducer, initialBattleSelection);
  const [segment, setSegment] = useState<StorySegment>('before-blood-knights');
  const isColiseum = segment === 'coliseum';
  const segmentLabel = STORY_SEGMENTS.find(s => s.id === segment)!.label;
  const { phase, domainId, floor, encounterId } = selection;
  const domains = getStoryDomains(segment);
  const domain = domains.find((entry) => entry.domainId === domainId);
  const floors = getFloorsForDomain(domainId, phase);
  const options = isColiseum ? getColiseumOptions() : floor === null ? [] : getEncountersForFloor(domainId, phase, floor);
  const selected = options.find((entry) => entry.encounterId === encounterId);

  return (
    <section className="space-y-4" aria-label="Battle Selector">
      <Card>
        <CardHeader><CardTitle>Battle Selector</CardTitle><CardDescription>Browse encounters and preview rewards. Selecting a battle does not change your run.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="battle-phase">Story phase</Label>
              <Select value={segment} onValueChange={(value) => {
                const next = value as StorySegment;
                setSegment(next);
                dispatch(next === 'coliseum' ? { type: 'coliseum' } : { type: 'location', domainId: '', phase: getStoryDomains(next)[0].phase });
              }}>
                <SelectTrigger id="battle-phase"><SelectValue /></SelectTrigger>
                <SelectContent>{STORY_SEGMENTS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!isColiseum && <><div className="space-y-2">
              <Label htmlFor="battle-domain">Domain</Label>
              <Select value={domainId} onValueChange={(value) => dispatch({ type: 'location', domainId: value, phase: domains.find(d => d.domainId === value)!.phase })}>
                <SelectTrigger id="battle-domain"><SelectValue placeholder="Choose a Domain" /></SelectTrigger>
                <SelectContent>{domains.map((entry) => <SelectItem key={entry.domainId} value={entry.domainId}>{entry.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="battle-floor">Floor</Label>
              <Select value={floor === null ? '' : String(floor)} disabled={!domain || floors.length === 0} onValueChange={(value) => dispatch({ type: 'floor', floor: Number(value) })}>
                <SelectTrigger id="battle-floor"><SelectValue placeholder="Choose a floor" /></SelectTrigger>
                <SelectContent>{floors.map((value) => <SelectItem key={value} value={String(value)}>Floor {value}</SelectItem>)}</SelectContent>
              </Select>
            </div></>}
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold">Available Encounters</h3>
            {options.length === 0 ? <p className="text-sm text-muted-foreground">{floor === null ? 'Choose a Domain and floor to browse encounters.' : 'No encounters mapped to this selection.'}</p> : (
              <RadioGroup aria-label="Available Encounters" value={encounterId === null ? '' : String(encounterId)} onValueChange={(value) => dispatch({ type: 'encounter', encounterId: Number(value) })} className="grid gap-3 lg:grid-cols-2">
                {options.map((option) => (
                  <label key={option.encounterId} htmlFor={'battle-encounter-' + option.encounterId} className={'flex cursor-pointer items-start gap-3 rounded-lg border p-4 ' + (encounterId === option.encounterId ? 'menu-selected' : 'border-border')}>
                    <RadioGroupItem id={'battle-encounter-' + option.encounterId} value={String(option.encounterId)} className="mt-1" />
                    <div className="space-y-2">
                      {isColiseum && <p className="font-semibold">{getColiseumBattle(option.encounterId)!.label}</p>}
                      {option.isBoss && <Badge>Boss</Badge>}
                      <p className="text-sm font-medium">{option.preview?.encounter.digimons.map((enemy) => `${enemy.name} EL ${enemy.level}`).join(' · ') ?? 'Data warning: encounter missing'}</p>
                      <p className="text-sm tabular-nums">{option.preview?.reward ? `${option.preview.reward.xp} XP · ${option.preview.reward.bits} Bits` : 'Data warning: XP/Bits metadata missing (unknown)'}</p>
                      <p className="text-xs text-muted-foreground">Encounter {option.encounterId}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}
          </div>
        </CardContent>
      </Card>
      {selected && domain && floor !== null && <BattlePreview encounterId={selected.encounterId} domainName={domain.label} phaseLabel={segmentLabel} floor={floor} isBoss={selected.isBoss} />}
      {selected && isColiseum && <p className="text-sm">Coliseum · {getColiseumBattle(selected.encounterId)!.label} · 0 XP · 0 Bits · No level-up · Capture unavailable</p>}
      {selected && <BattleRecordControls key={`${phase}/${domainId}/${floor}/${encounterId}`} selection={selection} hasParticipants={hasParticipants} onRecord={onRecord} run={run} />}
    </section>
  );
};
