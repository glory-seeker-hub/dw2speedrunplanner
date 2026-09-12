import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SimulationResult } from '@/types/digimon';
import type { BattleActionRecord } from '@/utils/battle/battleTypes';
import { resourceAlertText } from '@/utils/battle/battleResources';

const frames = (value: number | null) => value === null ? 'Unavailable' : `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} f`;
const number = (value: number | null) => value === null ? 'Unavailable' : value.toLocaleString('en-US', { maximumFractionDigits: 1 });

function ActionHistory({ actions }: { actions: BattleActionRecord[] }) {
  if (!actions.length) return <p className="text-sm text-muted-foreground">No completed victory with the required timing coverage.</p>;
  return <ScrollArea className="h-96 w-full"><ol className="space-y-3 pr-4">
    {actions.map(action => <li key={action.id} className="rounded border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm"><span className="text-muted-foreground">Round {action.round} · </span>
          <span className="font-semibold text-digital-cyan">{action.actorName}</span> · {action.skillName}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{action.state === 'resolved' ? action.outcome === 'miss' ? `Miss — ${action.accuracy?.cause === 'paralysis' ? 'Paralysis' : action.accuracy?.cause === 'tail-blade-evasion' ? 'Tail Blade' : action.accuracy?.cause === 'counter-not-activated' ? 'Counter not activated' : 'Accuracy'}` : 'Hit' : action.reason === 'confusion-no-eligible-skill' ? 'Confusion skip' : action.state}</Badge>
          <span className="font-mono font-semibold text-info">{action.state === 'resolved' ? frames(action.durationFrames) : 'Not executed'}</span>
        </div>
      </div>
      {action.chainFromActionId && <p className="text-xs text-muted-foreground">Shadow Scythe repeat</p>}
      {action.counter && <div className="text-xs text-muted-foreground">
        <p>{action.counter.executionMode === 'activated' ? 'Counter — Activated' : action.counter.executionMode === 'shared-trigger-promoted' ? 'Counter — Shared AOE follow-up' : action.counter.executionMode === 'untriggered-end-of-turn' ? 'Counter — Untriggered' : 'Counter — Waiting'}</p>
        {action.counter.triggerActorId && <p>Triggered by {action.counter.triggerActorName} ({action.counter.triggerActorId}) · {action.counter.triggerActionId}</p>}
        {action.counter.executionMode === 'untriggered-end-of-turn' && <p>Executed at end of turn</p>}
        {!action.counter.activatedMechanics && <p>Using non-activated skill effects</p>}
        {action.counter.replacedByConfusion && <p>Confusion replacement attack · Counter effects removed</p>}
      </div>}
      {action.statusRecoveries.map(recovery => <p key={recovery.status} className="text-xs text-info">{recovery.status === 'paralysis' ? 'Paralysis' : 'Confusion'} {recovery.recovered ? 'recovered' : 'remains'} · roll {recovery.roll}/3</p>)}
      {action.confusion?.redirected && <p className="text-sm text-info">Confusion redirect: own side, including self{action.confusion.plannedSkillKey !== action.confusion.selectedSkillKey ? ' · technique reselected' : ''}</p>}
      {action.accuracy?.hitThreshold128 !== undefined && <p className="text-xs text-muted-foreground">Accuracy: roll {action.accuracy.roll128} · Hit below {action.accuracy.hitThreshold128}/128{action.accuracy.referenceRule === 'average-effective-target-spd' ? ` · average target SPD ${action.accuracy.targetEffectiveSpd}` : ''}</p>}
      {action.accuracy?.paralysisRoll !== undefined && <p className="text-xs text-muted-foreground">Paralysis check: {action.accuracy.paralysisRoll === 1 ? 'failed' : 'passed'}</p>}
      <ul className="space-y-1 text-sm">{action.impacts.map((impact, index) => <li key={`${impact.targetId}-${index}`} className="flex flex-wrap justify-between gap-2">
        <span>{impact.targetName} <span className="text-xs text-muted-foreground">({impact.targetId})</span></span>
        <span><span className="text-destructive">{impact.damage} dmg</span>{impact.poisonBonusDamage > 0 && <span className="text-info"> (Poison +{impact.poisonBonusDamage})</span>} · {impact.hpBefore} → {impact.hpAfter} HP · {impact.ko ? 'KO' : impact.outcome}
          {impact.statusApplications.map((status, index) => <span key={`${status.status}-${index}`} className="block text-xs text-info">{status.status === 'poison' ? 'Poison' : status.status === 'paralysis' ? 'Paralysis' : 'Confusion'} {status.applied ? status.alreadyActive ? 'already active; reapplied' : 'applied' : 'not applied'}{status.condition === 'counter-activated' ? ' by activated Counter' : ` · roll ${status.roll}/2`}</span>)}
        </span>
      </li>)}</ul>
      {action.mpAccounting && <p className="text-xs text-muted-foreground">MP: {action.mpAccounting.before} → {action.mpAccounting.after} · Cost {action.mpAccounting.costCharged ?? 'unresolved'}{action.mpAccounting.paymentRule === 'counter-triggering-actor' ? ` · Payer: ${action.mpAccounting.payerName} (${action.mpAccounting.payerCombatantId}) · triggering actor` : ''}</p>}
      {action.resourceAlerts.map((alert, index) => <p key={`${alert.kind}-${alert.combatantId}-${index}`} role="note" className="text-sm text-info">⚠ {resourceAlertText(alert)}</p>)}
      {action.timingDiagnostics.map(d => <p key={d} className="text-xs text-muted-foreground">{d}</p>)}
      {action.resourceDiagnostics.map(d => <p key={d} className="text-xs text-muted-foreground">{d}</p>)}
    </li>)}
  </ol></ScrollArea>;
}

export const BattleResults = ({ results }: { results: SimulationResult }) => {
  const stats = [
    ['Fastest Victory', frames(results.minFrames)],
    ['Average Victory', frames(results.avgFrames)],
    ['Slowest Victory', frames(results.maxFrames)],
    ['Completed Successes', `${results.completedSuccesses.toLocaleString()} / ${results.totalSimulations.toLocaleString()}`],
  ];
  return <div className="space-y-6">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{stats.map(([label, value]) => <Card key={label} className="bg-gradient-card border-border">
      <CardContent className="pt-6 space-y-2"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold text-info">{value}</p></CardContent>
    </Card>)}</div>
    <Card className="bg-gradient-card border-border"><CardHeader><CardTitle>Timing and resource coverage</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>Frame statistics cover {results.timedSuccesses.toLocaleString()} completed victories with complete measured timing.</p>
        {results.incompleteTimingSuccesses > 0 && <p className="text-info">{results.incompleteTimingSuccesses.toLocaleString()} completed victories have incomplete timing and are excluded from frame comparisons.</p>}
        <p>Players continue attacking and remain targetable at 0 HP or MP. Recovery, revival, Guard and items are omitted; their actions and frames are not counted.</p>
        <p className="text-info">{results.runsWithResourceAlerts.toLocaleString()} simulations required additional in-game recovery actions.</p>
        {Object.entries(results.outcomeCounts).filter(([outcome, count]) => outcome !== 'player-win' && count > 0).map(([outcome, count]) => <p key={outcome}>{outcome}: {count} (excluded from victory statistics)</p>)}
        {results.timingDiagnostics.map(d => <p key={d} className="text-muted-foreground">{d}</p>)}
        {results.resourceDiagnostics.map(d => <p key={d} className="text-muted-foreground">{d}</p>)}
      </CardContent>
    </Card>
    <Card className="bg-gradient-card border-border"><CardHeader><CardTitle>Fastest Battle by Frames ({frames(results.minFrames)})</CardTitle></CardHeader>
      <CardContent><ActionHistory actions={results.fastestBattleByFrames} /></CardContent>
    </Card>
    <Card className="bg-gradient-card border-border"><CardHeader><CardTitle>Fewest Actions in a Victory ({number(results.minTurns)})</CardTitle></CardHeader>
      <CardContent><ActionHistory actions={results.fastestBattleHistory} /></CardContent>
    </Card>
    <Card className="bg-gradient-card border-border"><CardHeader><CardTitle>Action Statistics</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
      <p>Fewest: {number(results.minTurns)}</p><p>Average: {number(results.avgTurns)}</p><p>Most: {number(results.maxTurns)}</p>
    </CardContent></Card>
  </div>;
};
