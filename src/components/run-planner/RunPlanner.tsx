import { TechniquePlanningSummary } from '@/components/run-planner/TechniquePlanningSummary';
import { RunRouteExport } from '@/components/run-planner/export/RunRouteExport';
import { buildRouteDocument, RouteDocumentModel } from '@/utils/routeDocument';
import { TradeControls } from '@/components/run-planner/TradeControls';
import { DnaControls } from '@/components/run-planner/DnaControls';
import { DigivolutionControls } from '@/components/run-planner/DigivolutionControls';
import { getSpeciesProgression } from '@/data/speciesProgression';
import { useState } from 'react';
import { BattleSelector } from '@/components/run-planner/BattleSelector';
import { RunHistory } from '@/components/run-planner/RunHistory';
import { LevelCapDisplay } from '@/components/run-planner/LevelCapDisplay';
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
  <dl className="grid grid-cols-5 gap-1 text-center text-sm">
    {(['hp', 'mp', 'atk', 'def', 'spd'] as const).map((stat) => (
      <div key={stat} className="stat-cell px-1 py-1">
        <dt className="text-xs text-muted-foreground">{stat.toUpperCase()}</dt>
        <dd className="font-semibold tabular-nums">{stats[stat]}</dd>
      </div>
    ))}
  </dl>
);

type Props = { planner: ReturnType<typeof useRunPlanner> };

export const RunPlanner = ({ planner }: Props) => {
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [routeDocument, setRouteDocument] = useState<RouteDocumentModel | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const { data, activeRun: run, error, starterId, setStarterId, name, setName } = planner;
  const starter = STARTERS.find((option) => option.id === run?.starterDefinitionId);

  return (
    <section className="space-y-4" aria-label="Run Planner">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Run Planner</h2>
          <p className="text-sm text-muted-foreground">Choose your starter and keep your run saved in this browser.</p>
        </div>
        {run && <Button variant="outline" onClick={() => setConfirmReset(run.id)}>New Run</Button>}
      </div>
      {planner.storageWarning && <Alert><AlertDescription>{planner.storageWarning}</AlertDescription></Alert>}
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
                      className={'cursor-pointer rounded-lg border p-4 space-y-4 ' + (starterId === option.id ? 'menu-selected' : 'border-border bg-muted/10')}>
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
          <section aria-label="Run summary" className="run-status status-panel flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div><h3 className="font-semibold">{run.name}</h3><p className="text-xs text-muted-foreground">{starter?.label ?? 'Starter'} / {starter?.name ?? 'No starter recorded'}</p></div>
            <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Total Bits</dt><dd className="font-semibold tabular-nums">{run.totalBits}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Recorded battles</dt><dd className="font-semibold tabular-nums">{run.history.filter(event => event.type === 'battle').length}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Total actions</dt><dd className="font-semibold tabular-nums">{run.history.length}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Roster / Active</dt><dd className="font-semibold tabular-nums">{run.roster.length} / {run.digiline.length}</dd></div>
            </dl>
            <Button variant="outline" onClick={() => {
              try { setRouteDocument(buildRouteDocument(run, new Date())); setExportError(null); }
              catch { setExportError('This run must validate before export. Return to the Planner to review it.'); }
            }}>Export Route</Button>
            <a href="#run-battle" className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Go to Battle ↓</a>
          </section>
          {exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}
          {routeDocument && <RunRouteExport model={routeDocument} onBack={() => setRouteDocument(null)} />}
          <div id="run-roster" tabIndex={-1} aria-label="Roster workspace" role="region" className="grid scroll-mt-28 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Card className="min-w-0">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-lg" id="current-digiline">Current Digiline</CardTitle>
              <CardDescription>{run.digiline.length} / {MAX_DIGILINE_SIZE} active members. Removing a member keeps it in your roster.</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ol className="grid gap-2" aria-label="Digiline slots">
                {Array.from({ length: MAX_DIGILINE_SIZE }, (_, index) => {
                  const id = run.digiline[index];
                  const member = run.roster.find((entry) => entry.instanceId === id);
                  return (
                    <li key={index} className="menu-inset space-y-1.5 rounded-lg p-3" aria-label={'Slot ' + (index + 1)}>
                      <p className="text-sm text-muted-foreground">Slot {index + 1}</p>
                      {member ? (
                        <>
                          <p className="font-semibold">{member.name}</p>
                          <LevelCapDisplay member={member} />
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
              {run.digiline.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No active members. Add a reserve from your roster.</p>}
            </CardContent>
          </Card>
          <section className="min-w-0 space-y-3" aria-label="Roster">
            <h3 className="text-xl font-semibold">Roster</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {run.roster.map((member) => (
                <Card key={member.instanceId} aria-label={`${member.name} roster card`} className="status-panel min-w-0">
                  <CardHeader className="space-y-1 p-3 pb-2"><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-lg">{member.name}</CardTitle><Badge className={run.digiline.includes(member.instanceId) ? "menu-active-badge" : undefined} variant={run.digiline.includes(member.instanceId) ? "active" : "outline"}>{run.digiline.includes(member.instanceId) ? "Active Digiline" : "Reserve"}</Badge></div>
                    <p className="text-sm text-muted-foreground">{getSpeciesProgression(member.speciesId)?.rank ?? 'Unknown rank'} · DP {member.dp}</p>
                    <LevelCapDisplay member={member} />
                  </CardHeader>
                  <CardContent className="space-y-2 p-3 pt-0">
                    <Stats stats={member.stats} />
                    <p className="text-sm"><span className="text-muted-foreground">Known techniques: </span>{member.techs.join(', ') || 'None'}</p>
                    <TechniquePlanningSummary member={member} />
                    <DigivolutionControls runId={run.id} member={member} onDigivolve={planner.digivolve} error={error} />
                    {!run.digiline.includes(member.instanceId) && (
                      <div className="space-y-2">
                        <Button size="sm" variant="outline" disabled={run.digiline.length >= MAX_DIGILINE_SIZE}
                          aria-describedby={run.digiline.length >= MAX_DIGILINE_SIZE ? 'digiline-full-' + member.instanceId : undefined}
                          onClick={() => planner.addMember(member.instanceId)}>Add to Digiline</Button>
                        {run.digiline.length >= MAX_DIGILINE_SIZE && <p id={'digiline-full-' + member.instanceId} className="text-xs text-muted-foreground">Digiline full ({MAX_DIGILINE_SIZE}/{MAX_DIGILINE_SIZE}). Remove an active member first.</p>}
                      </div>
                    )}
                    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Details</summary><p>Total XP {member.totalXp}</p><p>Source: {member.source.type}</p></details>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
          </div>
          <section aria-label="Roster Actions" className="space-y-2">
            <h3 className="text-lg font-semibold">Roster Actions</h3>
            <div className="grid items-start gap-3 md:grid-cols-2">
              <TradeControls compact key={`trade/${run.id}`} run={run} onTrade={planner.trade} error={error} />
              <DnaControls compact key={`dna/${run.id}`} run={run} onDna={planner.dna} error={error} />
            </div>
          </section>
          <section id="run-battle" tabIndex={-1} aria-label="Battle recording" className="scroll-mt-28 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <a href="#run-roster" className="mb-2 inline-block rounded px-2 py-1 text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Back to roster ↑</a>
          <BattleSelector key={`${run.id}/${planner.feedbackRevision}`} hasParticipants={run.digiline.length > 0} onRecord={planner.recordBattle} />
          </section>
          <RunHistory key={run.id} run={run} onUndo={planner.undoAction} error={error} />
        </>
      )}
      <AlertDialog open={confirmReset !== null} onOpenChange={(open) => { if (!open) setConfirmReset(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Discard this run and start again?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes {run?.name ?? 'the current run'}, including its roster and progress, from this browser. Other saved runs are kept. You will return to starter selection.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={(event) => { if (!planner.resetRun(confirmReset ?? '')) event.preventDefault(); }}>Discard Run</AlertDialogAction></AlertDialogFooter>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
