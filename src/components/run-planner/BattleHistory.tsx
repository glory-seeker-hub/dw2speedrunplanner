import { RunPlan } from '@/types/runPlanner';
import { getDomainById } from '@/data/domains';
import { getBattlePreview } from '@/utils/runBattleSelection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const BattleHistory = ({ run }: { run: RunPlan }) => (
  <Card>
    <CardHeader><CardTitle>Battle History</CardTitle></CardHeader>
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
  </Card>
);
