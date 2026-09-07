import { RunPlan } from '@/types/runPlanner';
import { useState } from 'react';
import { getUndoUnavailableReason } from '@/utils/runBattleUndo';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { getDomainById } from '@/data/domains';
import { getBattlePreview } from '@/utils/runBattleSelection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const BattleHistory = ({ run, onUndo, error }: { run: RunPlan; onUndo: (eventId: string) => boolean; error: string | null }) => {
  const [confirmEventId, setConfirmEventId] = useState<string | null>(null);
  const [undone, setUndone] = useState(false);
  const unavailable = getUndoUnavailableReason(run);
  return (
  <Card>
    <CardHeader>
      <CardTitle>Battle History</CardTitle>
      <div><Button variant="outline" disabled={Boolean(unavailable)} onClick={() => {
        setUndone(false); setConfirmEventId(run.battles[run.battles.length - 1].id);
      }}>Undo Last Battle</Button></div>
      {unavailable && run.battles.length > 0 && <p className="text-sm text-muted-foreground">{unavailable}</p>}
      {undone && <p role="status" className="text-sm">Battle undone. The run was restored to its pre-battle state.</p>}
    </CardHeader>
    <CardContent>
      {run.battles.length === 0 ? <p className="text-sm text-muted-foreground">No battles recorded yet.</p> : (
        <ol className="space-y-4" aria-label="Battle History">
          {run.battles.map((event, index) => {
            const encounter = getBattlePreview(event.encounterId)?.encounter;
            const captured = encounter?.digimons.find(enemy => enemy.slot === event.capturedEnemySlot);
            return <li key={event.id} className="space-y-2 rounded-lg border p-4 text-sm">
              <p className="font-semibold">Battle {index + 1} · {getDomainById(event.domainId)?.name ?? event.domainId} · {event.floor === undefined ? 'Floor not recorded' : `Floor ${event.floor}`}</p>
              <p className="text-muted-foreground">{event.phase === undefined ? 'Story phase not recorded' : event.phase === 'before-blood-knights' ? 'Before Blood Knights' : 'After Blood Knights'}</p>
              <p>{encounter?.digimons.map(enemy => `${enemy.name} EL ${enemy.level}`).join(' · ') ?? `Encounter ${event.encounterId}`}</p>
              <p>{event.xpReward} XP · {event.bitsReward} Bits</p>
              <p>Participants: {event.digilineInstanceIds.map(id => run.roster.find(member => member.instanceId === id)?.name ?? id).join(' · ')}</p>
              <p>Capture: {event.capturedEnemySlot == null ? 'None' : `Slot ${event.capturedEnemySlot} — ${captured?.name ?? 'Unknown enemy'}`}</p>
              <p className="text-xs text-muted-foreground">Encounter {event.encounterId}</p>
            </li>;
          })}
        </ol>
      )}
    </CardContent>
    <AlertDialog open={confirmEventId !== null} onOpenChange={open => { if (!open) setConfirmEventId(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Undo the last recorded battle?</AlertDialogTitle>
          <AlertDialogDescription>Undo restores the run to the state immediately before the last recorded battle. XP, levels, stats, Bits, captures, and Digiline changes made after that battle will be discarded. There is no redo.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={event => {
          if (confirmEventId && onUndo(confirmEventId)) setUndone(true);
          else event.preventDefault();
        }}>Confirm Undo</AlertDialogAction></AlertDialogFooter>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </AlertDialogContent>
    </AlertDialog>
  </Card>
  );
};
