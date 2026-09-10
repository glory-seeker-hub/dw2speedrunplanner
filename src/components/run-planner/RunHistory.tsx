import { RunPlan } from '@/types/runPlanner';
import { useState } from 'react';
import { getUndoUnavailableReason } from '@/utils/runActionUndo';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { getDomainById } from '@/data/domains';
import { getBattlePreview } from '@/utils/runBattleSelection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const RunHistory = ({ run, onUndo, error }: { run: RunPlan; onUndo: (eventId: string, runId: string) => boolean; error: string | null }) => {
  const [confirmEventId, setConfirmEventId] = useState<string | null>(null);
  const [undoneAt, setUndoneAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState('all');
  const filters = [['all', 'All'], ['battle', 'Battles'], ['digivolve', 'Digivolution'], ['dna', 'DNA'], ['trade', 'Trades']];
  // Retain the original chronological position before filtering; Undo uses the full history below.
  const visible = run.history.map((event, index) => ({ event, index })).filter(({ event }) => filter === 'all' || event.type === filter);
  const latestId = run.history.at(-1)?.id ?? 'empty';
  const unavailable = getUndoUnavailableReason(run);
  return (
  <Card>
    <CardHeader className="space-y-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-lg">Run History <span className="text-sm font-normal text-muted-foreground">({run.history.length} actions)</span></CardTitle>
        <Button size="sm" variant="ghost" aria-expanded={expanded} aria-controls="run-history-content" onClick={() => setExpanded(!expanded)}>{expanded ? 'Collapse History' : 'Expand History'}</Button>
      </div>
      <div><Button variant="outline" disabled={Boolean(unavailable)} onClick={() => {
        setUndoneAt(null); setConfirmEventId(run.history[run.history.length - 1].id);
      }}>Undo Last Action</Button></div>
      {unavailable && run.history.length > 0 && <p className="text-sm text-muted-foreground">{unavailable}</p>}
      {undoneAt === latestId && <p role="status" className="text-sm">Action undone. The run was restored to its pre-action state.</p>}
    </CardHeader>
    <CardContent id="run-history-content" hidden={!expanded} className="space-y-3 p-3 pt-0">
      <div className="flex flex-wrap gap-2" role="group" aria-label="History filters">{filters.map(([value, label]) =>
        <Button key={value} size="sm" variant={filter === value ? 'secondary' : 'outline'} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</Button>
      )}</div>
      {run.history.length > 0 && visible.length === 0 && <p role="status" className="text-sm text-muted-foreground">No actions match this filter.</p>}
      {run.history.length === 0 ? <p className="text-sm text-muted-foreground">No actions recorded yet.</p> : (
        <ol className="grid gap-2 md:grid-cols-2" aria-label="Run History">
          {visible.map(({ event, index }) => {
            if (event.type === 'trade') return <li key={event.id} className="space-y-1 rounded-lg border p-3 text-sm">
              <p className="font-semibold">Action {index + 1} · Trade</p>
              <p>{event.givenName} → {event.receivedName}</p>
              <p>EL{event.receivedLevel} · DP{event.receivedDp} · Max EL{event.receivedMaxLevel}</p>
            </li>;
            if (event.type === 'dna') return <li key={event.id} className="space-y-1 rounded-lg border p-3 text-sm">
              <p className="font-semibold">Action {index + 1} · DNA Digivolution{event.isMutation ? ' · Mutation' : ''}</p>
              <p>{event.parentAName} + {event.parentBName} → {event.childName}</p>
              <p>{event.actualResultRank} · {event.actualResultType}</p>
              <p>EL{event.childStartingLevel} · DP{event.childDp} · Max EL{event.childMaxLevel}</p>
              {event.isMutation && <p>Matrix: {event.matrixSelectionRank} / {event.matrixSelectionType}</p>}
              {event.techniqueChoice.discarded.length > 0 && <p>Discarded: {event.techniqueChoice.discarded.join(', ')}</p>}
            </li>;
            if (event.type === 'digivolve') return <li key={event.id} className="space-y-1 rounded-lg border p-3 text-sm">
              <p className="font-semibold">Action {index + 1} · Digivolution</p>
              <p>{event.fromName} → {event.toName}</p>
              <p>{event.fromRank} → {event.toRank} · EL {event.level} · DP {event.dp}</p>
              <p>HP +{event.hpBonus} · MP +{event.mpBonus}</p>
            </li>;
            const encounter = getBattlePreview(event.encounterId)?.encounter;
            const captured = encounter?.digimons.find(enemy => enemy.slot === event.capturedEnemySlot);
            return <li key={event.id} className="space-y-1 rounded-lg border p-3 text-sm">
              <p className="font-semibold">Action {index + 1} · Battle · {getDomainById(event.domainId)?.name ?? event.domainId} · {`Floor ${event.floor}`}</p>
              <p className="text-muted-foreground">{event.phase === 'before-blood-knights' ? 'Before Blood Knights' : 'After Blood Knights'}</p>
              <p>{encounter?.digimons.map(enemy => `${enemy.name} EL ${enemy.level}`).join(' · ') ?? `Encounter ${event.encounterId}`}</p>
              <p>{event.xpReward} XP · {event.bitsReward} Bits</p>
              <p>Participants: {event.digilineInstanceIds.map(id => event.preActionCheckpoint.roster.find(member => member.instanceId === id)?.name ?? id).join(' · ')}</p>
              <p>Capture: {event.capturedEnemySlot == null ? 'None' : `Slot ${event.capturedEnemySlot} — ${captured?.name ?? 'Unknown enemy'}`}</p>
              {event.techniqueChoices.map(choice => <p key={choice.instanceId}>
                {event.preActionCheckpoint.roster.find(member => member.instanceId === choice.instanceId)?.name ?? choice.instanceId}:
                {' '}Learned {choice.learned.join(', ') || 'none'} · Discarded {choice.discarded.join(', ') || 'none'}
              </p>)}
              <p className="text-xs text-muted-foreground">Encounter {event.encounterId}</p>
            </li>;
          })}
        </ol>
      )}
    </CardContent>
    <AlertDialog open={confirmEventId !== null} onOpenChange={open => { if (!open) setConfirmEventId(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Undo the last recorded action?</AlertDialogTitle>
          <AlertDialogDescription>{run.history.find(event => event.id === confirmEventId)?.type === 'trade' ? 'Undo this trade and restore the given Digimon? ' : run.history.find(event => event.id === confirmEventId)?.type === 'dna' ? 'Undo this DNA and restore both parents? ' : run.history.find(event => event.id === confirmEventId)?.type === 'digivolve' ? 'Undo this Digivolution? ' : 'Undo this battle? '}Undo restores the run to the state immediately before the last recorded action. Species, XP, levels, stats, techniques, Bits and captures will be restored. Digiline changes made after that action will also be discarded. There is no redo.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={event => {
          if (confirmEventId && onUndo(confirmEventId, run.id)) setUndoneAt(run.history.at(-2)?.id ?? 'empty');
          else event.preventDefault();
        }}>Confirm Undo</AlertDialogAction></AlertDialogFooter>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </AlertDialogContent>
    </AlertDialog>
  </Card>
  );
};
