import { useReducer } from 'react';
import { DOMAIN_PHASES, DomainPhase } from '@/types/encounter';
import { battleSelectionReducer, initialBattleSelection, getDomainsForPhase, getFloorsForDomain, getEncountersForFloor } from '@/utils/runBattleSelection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { BattlePreview } from '@/components/run-planner/BattlePreview';
import { BattleRecordControls, RecordBattleHandler } from '@/components/run-planner/BattleRecordControls';

const phaseLabels: Record<DomainPhase, string> = {
  'before-blood-knights': 'Before Blood Knights',
  'after-blood-knights': 'After Blood Knights',
};

export const BattleSelector = ({ hasParticipants, onRecord }: { hasParticipants: boolean; onRecord: RecordBattleHandler }) => {
  const [selection, dispatch] = useReducer(battleSelectionReducer, initialBattleSelection);
  const { phase, domainId, floor, encounterId } = selection;
  const domains = getDomainsForPhase(phase);
  const domain = domains.find((entry) => entry.id === domainId);
  const floors = getFloorsForDomain(domainId, phase);
  const options = floor === null ? [] : getEncountersForFloor(domainId, phase, floor);
  const selected = options.find((entry) => entry.encounterId === encounterId);

  return (
    <section className="space-y-4" aria-label="Battle Selector">
      <Card>
        <CardHeader><CardTitle>Battle Selector</CardTitle><CardDescription>Browse encounters and preview rewards. Selecting a battle does not change your run.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="battle-phase">Story phase</Label>
              <Select value={phase} onValueChange={(value) => dispatch({ type: 'phase', phase: value as DomainPhase })}>
                <SelectTrigger id="battle-phase"><SelectValue /></SelectTrigger>
                <SelectContent>{DOMAIN_PHASES.map((value) => <SelectItem key={value} value={value}>{phaseLabels[value]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="battle-domain">Domain</Label>
              <Select value={domainId} onValueChange={(value) => dispatch({ type: 'domain', domainId: value })}>
                <SelectTrigger id="battle-domain"><SelectValue placeholder="Choose a Domain" /></SelectTrigger>
                <SelectContent>{domains.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="battle-floor">Floor</Label>
              <Select value={floor === null ? '' : String(floor)} disabled={!domain || floors.length === 0} onValueChange={(value) => dispatch({ type: 'floor', floor: Number(value) })}>
                <SelectTrigger id="battle-floor"><SelectValue placeholder="Choose a floor" /></SelectTrigger>
                <SelectContent>{floors.map((value) => <SelectItem key={value} value={String(value)}>Floor {value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold">Available Encounters</h3>
            {options.length === 0 ? <p className="text-sm text-muted-foreground">{floor === null ? 'Choose a Domain and floor to browse encounters.' : 'No encounters mapped to this selection.'}</p> : (
              <RadioGroup aria-label="Available Encounters" value={encounterId === null ? '' : String(encounterId)} onValueChange={(value) => dispatch({ type: 'encounter', encounterId: Number(value) })} className="grid gap-3 lg:grid-cols-2">
                {options.map((option) => (
                  <label key={option.encounterId} htmlFor={'battle-encounter-' + option.encounterId} className={'flex cursor-pointer items-start gap-3 rounded-lg border p-4 ' + (encounterId === option.encounterId ? 'border-primary bg-primary/10' : 'border-border')}>
                    <RadioGroupItem id={'battle-encounter-' + option.encounterId} value={String(option.encounterId)} className="mt-1" />
                    <div className="space-y-2">
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
      {selected && domain && floor !== null && <BattlePreview encounterId={selected.encounterId} domainName={domain.name} phaseLabel={phaseLabels[phase]} floor={floor} isBoss={selected.isBoss} />}
      {selected && <BattleRecordControls key={`${phase}/${domainId}/${floor}/${encounterId}`} selection={selection} hasParticipants={hasParticipants} onRecord={onRecord} />}
    </section>
  );
};
