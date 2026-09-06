import { useState } from 'react';
import { STARTERS } from '@/data/starters';
import { MAX_DIGILINE_SIZE } from '@/types/runPlanner';
import { DigimonStats } from '@/types/digimon';
import { useRunPlanner } from '@/hooks/useRunPlanner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

const Stats = ({ stats }: { stats: DigimonStats }) => (
  <dl className="grid grid-cols-5 gap-2 text-center text-sm">
    {(['hp', 'mp', 'atk', 'def', 'spd'] as const).map((stat) => (
      <div key={stat} className="rounded bg-muted/30 p-2">
        <dt className="text-xs text-muted-foreground">{stat.toUpperCase()}</dt>
        <dd className="font-semibold tabular-nums">{stats[stat]}</dd>
      </div>
    ))}
  </dl>
);

type Props = { planner: ReturnType<typeof useRunPlanner> };

export const RunPlanner = ({ planner }: Props) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const { data, activeRun: run, error, starterId, setStarterId, name, setName } = planner;
  const starterMember = run?.roster.find((member) => member.instanceId === run.starterInstanceId);
  const starter = STARTERS.find((option) => option.speciesId === starterMember?.speciesId);

  return (
    <section className="space-y-6" aria-label="Run Planner">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Run Planner</h2>
          <p className="text-sm text-muted-foreground">Choose your starter and keep your run saved in this browser.</p>
        </div>
        {run && <Button variant="outline" onClick={() => setConfirmReset(true)}>New Run</Button>}
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {data.runs.length > 0 && (
        <div className="max-w-sm space-y-2">
          <Label htmlFor="saved-run">Saved runs</Label>
          <Select value={run?.id ?? ''} onValueChange={planner.loadRun}>
            <SelectTrigger id="saved-run"><SelectValue placeholder="Load a saved run" /></SelectTrigger>
            <SelectContent>{data.runs.map((saved) => <SelectItem key={saved.id} value={saved.id}>{saved.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {!run ? (
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle>No active run</CardTitle>
            <CardDescription>Choose one starter to begin. Your starter will join both your roster and your active Digiline.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); planner.startRun(); }}>
              <div className="max-w-md space-y-2">
                <Label htmlFor="run-name">Run name (optional)</Label>
                <Input id="run-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="My speedrun" />
              </div>
              <fieldset className="space-y-3">
                <legend className="mb-3 font-semibold">Choose your starter</legend>
                <RadioGroup value={starterId} onValueChange={setStarterId} aria-label="Starter" className="grid gap-4 lg:grid-cols-3">
                  {STARTERS.map((option) => (
                    <label key={option.id} htmlFor={'starter-' + option.id}
                      className={'cursor-pointer rounded-lg border p-4 space-y-4 ' + (starterId === option.id ? 'border-primary bg-primary/10' : 'border-border bg-muted/10')}>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem id={'starter-' + option.id} value={option.id} aria-label={option.label + ' / ' + option.name} />
                        <div><p className="text-sm text-muted-foreground">{option.label}</p><p className="font-semibold">{option.name} <span className="text-sm font-normal">EL {option.level}</span></p></div>
                      </div>
                      <Stats stats={option.stats} />
                      <p className="text-sm"><span className="text-muted-foreground">Starting techniques: </span>{option.techs.join(', ')}</p>
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>
              <Button type="submit" disabled={!starterId}>Start Run</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader><CardTitle>{run.name}</CardTitle><CardDescription>{starter?.label ?? 'Starter'} / {starterMember?.name ?? 'No starter recorded'}</CardDescription></CardHeader>
            <CardContent><dl className="flex flex-wrap gap-8">
              <div><dt className="text-sm text-muted-foreground">Total Bits</dt><dd className="text-xl font-semibold tabular-nums">{run.totalBits}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Recorded battles</dt><dd className="text-xl font-semibold tabular-nums">{run.battles.length}</dd></div>
            </dl></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Current Digiline</CardTitle>
              <CardDescription>{run.digiline.length} / {MAX_DIGILINE_SIZE} active members. Removing a member keeps it in your roster.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-4 lg:grid-cols-3" aria-label="Digiline slots">
                {Array.from({ length: MAX_DIGILINE_SIZE }, (_, index) => {
                  const id = run.digiline[index];
                  const member = run.roster.find((entry) => entry.instanceId === id);
                  return (
                    <li key={index} className="space-y-3 rounded-lg border border-border bg-muted/10 p-4" aria-label={'Slot ' + (index + 1)}>
                      <p className="text-sm text-muted-foreground">Slot {index + 1}</p>
                      {member ? (
                        <>
                          <p className="font-semibold">{member.name} <span className="text-sm font-normal">EL {member.level}</span></p>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" disabled={index === 0}
                              aria-label={'Move ' + member.name + ' in slot ' + (index + 1) + ' up'}
                              onClick={() => planner.moveMember(id, 'up')}>Move Up</Button>
                            <Button size="sm" variant="outline" disabled={index === run.digiline.length - 1}
                              aria-label={'Move ' + member.name + ' in slot ' + (index + 1) + ' down'}
                              onClick={() => planner.moveMember(id, 'down')}>Move Down</Button>
                            <Button size="sm" variant="outline" aria-label={'Remove ' + member.name + ' from slot ' + (index + 1)}
                              onClick={() => planner.removeMember(id)}>Remove</Button>
                          </div>
                        </>
                      ) : <p className="text-sm text-muted-foreground">Empty</p>}
                    </li>
                  );
                })}
              </ol>
              {run.digiline.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No active members. Add a reserve from your roster below.</p>}
            </CardContent>
          </Card>
          <section className="space-y-3" aria-label="Roster">
            <h3 className="text-xl font-semibold">Roster</h3>
            <div className="grid gap-4 lg:grid-cols-3">
              {run.roster.map((member) => (
                <Card key={member.instanceId}>
                  <CardHeader><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-lg">{member.name}</CardTitle><Badge variant={run.digiline.includes(member.instanceId) ? "secondary" : "outline"}>{run.digiline.includes(member.instanceId) ? "Active Digiline" : "Reserve"}</Badge></div>
                    <CardDescription>EL {member.level} · Total XP {member.totalXp}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Stats stats={member.stats} />
                    {!run.digiline.includes(member.instanceId) && (
                      <div className="space-y-2">
                        <Button size="sm" variant="outline" disabled={run.digiline.length >= MAX_DIGILINE_SIZE}
                          aria-describedby={run.digiline.length >= MAX_DIGILINE_SIZE ? 'digiline-full-' + member.instanceId : undefined}
                          onClick={() => planner.addMember(member.instanceId)}>Add to Digiline</Button>
                        {run.digiline.length >= MAX_DIGILINE_SIZE && <p id={'digiline-full-' + member.instanceId} className="text-xs text-muted-foreground">Digiline full ({MAX_DIGILINE_SIZE}/{MAX_DIGILINE_SIZE}). Remove an active member first.</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Discard this run and start again?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes {run?.name ?? 'the current run'}, including its roster and progress, from this browser. Other saved runs are kept. You will return to starter selection.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={(event) => { if (!planner.resetRun()) event.preventDefault(); }}>Discard Run</AlertDialogAction></AlertDialogFooter>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
