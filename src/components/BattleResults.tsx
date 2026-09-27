import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RESULT_HELP, combatantLabel, intendedTarget, replayExplanation, replayLimitation, type DisplayCombatant } from '@/utils/battle/battlePresentation';
import { rngRequirementText } from '@/utils/battle/battleRngAudit';
import { STAT_LABELS } from '@/utils/battle/battleStatOverrides';
import { SimulationReportExport } from './SimulationReportExport';
import { RNG_POLICY_LABELS } from '@/utils/battle/battleRngPolicy';
import { OptimizedSearchResults } from './OptimizedSearchResults';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SimulationResult } from '@/types/digimon';
import type { BattleActionRecord } from '@/utils/battle/battleTypes';
import { resourceAlertText } from '@/utils/battle/battleResources';

const stateLabel = (value: string) => value.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
const rngPolicyLabel = (policy: keyof typeof RNG_POLICY_LABELS) => RNG_POLICY_LABELS[policy];
const frames = (value: number | null) => value === null ? 'Unavailable' : `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} f`;
const number = (value: number | null) => value === null ? 'Unavailable' : value.toLocaleString('en-US', { maximumFractionDigits: 1 });

export function ActionHistory({ actions, combatants = [] }: { actions: readonly BattleActionRecord[]; combatants?: readonly DisplayCombatant[] }) {
  const label = (id: string, fallback?: string) => combatantLabel(combatants, id, fallback ?? actions.find(a => a.actorId === id)?.actorName ?? actions.flatMap(a => a.impacts).find(i => i.targetId === id)?.targetName);
  if (!actions.length) return <p className="text-sm text-muted-foreground">No completed victory with the required timing coverage.</p>;
  return <ScrollArea className="h-96 w-full"><ol className="space-y-3 pr-4">
    {actions.map(action => <li key={action.id} className="rounded border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm"><span className="text-muted-foreground">Round {action.round} · </span>
          <span className="font-semibold text-digital-cyan">{label(action.actorId, action.actorName)}</span> · {action.skillName}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{action.state === 'resolved' ? action.outcome === 'guard' ? 'Guard — Motivation Down' : action.outcome === 'miss' ? `Miss — ${action.accuracy?.cause === 'assist-target-lost' ? 'Assist target KO' : action.accuracy?.cause === 'invisibility' ? 'Invisibility forced Miss' : action.accuracy?.cause === 'interrupt-forced-miss' ? 'Forced by Interrupt' : action.accuracy?.cause === 'paralysis' ? 'Paralysis' : action.accuracy?.cause === 'tail-blade-evasion' ? 'Tail Blade' : action.accuracy?.cause === 'counter-not-activated' ? 'Counter not activated' : 'Accuracy'}` : 'Hit' : action.reason === 'confusion-no-eligible-skill' ? 'Confusion skip' : action.state}</Badge>
          <span className="font-mono font-semibold text-info">{action.state === 'resolved' ? frames(action.durationFrames) : 'Not executed'}</span>
        </div>
      </div>
      <p className="text-sm">Actual targets: {action.effectiveTargetIds.map(id => label(id)).join(', ') || 'None'}</p>
      <div className="text-sm">{action.impacts.map((impact, i) => <p key={i}>{label(impact.targetId, impact.targetName)}: {impact.damage} damage · {impact.hpBefore} → {impact.hpAfter} HP{impact.statusApplications.filter(s => s.applied).map(s => ' · ' + stateLabel(s.status)).join('')}</p>)}</div>
      {(action.supportEvents ?? []).filter(e => e.kind === 'healing').map((e, i) => e.kind === 'healing' && <p key={i}>{label(e.targetId)}: Healed {e.appliedAmount} HP · {e.hpBefore} → {e.hpAfter}</p>)}
      {action.counter && <p>Counter — {stateLabel(action.counter.executionMode)}</p>}
      {action.kind === 'interrupt' && <p>Interrupt</p>}
      {action.kind === 'assist' && <p>Assist</p>}
      {action.accuracy?.rngResolution && <p>{action.accuracy.rngResolution.outcome === 'miss' ? 'Paralysis must prevent this action' : 'Paralysis must allow the action so Confusion can execute'}</p>}
      <details><summary className="cursor-pointer text-sm">Action details — HP/MP, status, RNG and effect audit</summary><div className="mt-2 space-y-2 break-words">
      {action.interruptTiming && <p className="text-xs text-muted-foreground">Interrupt timing: {action.interruptTiming.totalFrames}f · {action.interruptTiming.preludeFrames}f interrupted-action prelude + {action.interruptTiming.executionFrames}f {action.outcome === 'miss' ? 'Miss execution' : 'Interrupt execution'}</p>}
      {action.kind === 'interrupt' && <p className="text-sm text-info">{action.reason === 'interrupt-no-eligible-target' ? 'Interrupt skipped — no eligible target' : 'Interrupt — ' + (action.outcome === 'hit' ? 'Hit' : action.accuracy?.cause === 'paralysis' ? 'Miss — Paralysis' : 'Miss — Accuracy')}</p>}
      {action.interrupt && <div className="text-xs text-info">
        <p>Interrupt target: {action.interrupt.targetActorName} / {action.interrupt.targetActionId}</p>
        {action.restart && <><p>Initial Hit → Interrupted → {action.interrupt.restarted ? 'Restarted' : 'Not restarted'} → Final {action.outcome}</p><p>Natural recovery suppressed on restart · Skill and targets locked</p></>}
        {action.interrupt.cancelled && <p>Action cancelled by Interrupt{action.interrupt.cancellationReason === 'actor-ko' ? ' — actor KO' : ''}</p>}
        {action.interrupt.sentLast && <p>Action sent to end of turn, after Counters</p>}
        {action.interrupt.forceMiss && <p>Forced Miss by Interrupt</p>}
        {action.interrupt.damageRetained && <p>Damage reduced by Interrupt · retained {action.interrupt.damageRetained.numerator}/{action.interrupt.damageRetained.denominator}</p>}
        {action.interrupt.deletionImmunity && <p>Boss immune to action deletion</p>}
        {action.interrupt.confusionSuppressedForActionId && <p>Confusion applied — effective next turn for this interrupted action</p>}
      </div>}
      {action.chainFromActionId && <p className="text-xs text-muted-foreground">Shadow Scythe repeat</p>}
      {action.counter && <div className="text-xs text-muted-foreground">
        <p>{action.counter.executionMode === 'activated' ? 'Counter — Activated' : action.counter.executionMode === 'shared-trigger-promoted' ? 'Counter — Shared AOE follow-up' : action.counter.executionMode === 'untriggered-end-of-turn' ? 'Counter — Untriggered' : 'Counter — Waiting'}</p>
        {action.counter.triggerActorId && <p>Triggered by {action.counter.triggerActorName} ({action.counter.triggerActorId}) · {action.counter.triggerActionId}</p>}
        {action.counter.executionMode === 'untriggered-end-of-turn' && <p>Executed at end of turn</p>}
        {!action.counter.activatedMechanics && <p>Using non-activated skill effects</p>}
        {action.counter.replacedByConfusion && <p>Confusion replacement attack · Counter effects removed</p>}
      </div>}
      {action.statusRecoveries.map(recovery => <p key={recovery.status} className="text-xs text-info">{stateLabel(recovery.status)} {recovery.recovered ? 'recovered' : 'remains'}{recovery.rngResolution ? ' — '+rngPolicyLabel(recovery.rngResolution.policy)+' RNG' : ` · roll ${recovery.roll}/3`}</p>)}
      {action.confusion?.redirected && <p className="text-sm text-info">Confusion redirect: own side, including self{action.confusion.plannedSkillKey !== action.confusion.selectedSkillKey ? ' · technique reselected' : ''}</p>}
      {action.accuracy?.standardRollSkipped && <p className="text-xs text-info">Standard accuracy bypassed — Strategy mode</p>}
      {action.accuracy?.hitThreshold128 !== undefined && <p className="text-xs text-muted-foreground">Accuracy: roll {action.accuracy.roll128} · Hit below {action.accuracy.hitThreshold128}/128{action.accuracy.referenceRule === 'average-effective-target-spd' ? ` · average target SPD ${action.accuracy.targetEffectiveSpd}` : ''}</p>}
      {action.accuracy?.rngResolution && <p>{rngPolicyLabel(action.accuracy.rngResolution.policy)} RNG: {action.accuracy.rngResolution.outcome === 'miss' ? 'Paralysis action must fail' : 'Paralysis action must proceed'}</p>}
      {action.accuracy?.paralysisRoll !== undefined && <p className="text-xs text-muted-foreground">Paralysis check: {action.accuracy.paralysisRoll === 1 ? 'failed' : 'passed'}</p>}
      <ul className="space-y-1 text-sm">{action.impacts.map((impact, index) => <li key={`${impact.targetId}-${index}`} className="flex flex-wrap justify-between gap-2">
        <span>{label(impact.targetId, impact.targetName)}</span>
        <span><span className="text-destructive">{impact.damage} dmg</span>{impact.poisonBonusDamage > 0 && <span className="text-info"> (Poison +{impact.poisonBonusDamage})</span>} · {impact.hpBefore} → {impact.hpAfter} HP · {impact.ko ? 'KO' : impact.outcome}
          {impact.effectiveElement && <span className="block text-xs text-info">Effective element: {impact.effectiveElement}</span>}
          {impact.statusApplications.map((status, index) => <span key={`${status.status}-${index}`} className="block text-xs text-info">{stateLabel(status.status)} {status.result === 'immune' ? `immune (${status.immunityReason === 'enemy' ? 'Enemy' : 'Boss'})` : status.applied ? status.alreadyActive ? 'already active; reapplied' : 'applied' : 'not applied'}{status.condition === 'interrupt-hit' ? ' by Interrupt; affects restarted action immediately' : status.condition === 'counter-activated' ? ' by activated Counter' : status.condition?.endsWith('-power') ? ` by ${stateLabel(status.condition)}` : status.rngResolution ? ' — '+rngPolicyLabel(status.rngResolution.policy)+' RNG' : status.roll === null ? ' · guaranteed on Hit' : ` · roll ${status.roll}/2`}</span>)}
        </span>
      </li>)}</ul>
      {(action.supportEvents ?? []).map((event, index) => <p key={index} className="text-xs text-info">
        {label(event.targetId)} · {event.kind === 'healing' ? `Assist — ${event.mode === 'revive-full' ? 'Revive' : event.mode === 'full' ? 'Full Heal' : 'Heal ' + event.requestedAmount}: +${event.appliedAmount} HP (${event.hpBefore} → ${event.hpAfter})`
          : event.kind === 'stage' ? `${event.stat.toUpperCase()} ${event.delta > 0 ? '+1' : '-1'} stage: ${event.before} → ${event.after}${event.effectiveSuppressed ? ' (suppressed this round)' : ''}`
          : event.kind === 'parameter-suppression' ? 'Parameters suppressed for this round'
          : event.kind === 'cure' ? `${stateLabel(event.status)} ${event.before ? 'cured' : 'already clear'}`
          : event.kind === 'poison-body' ? 'Poison Body poisoned attacker'
          : event.state === 'elemental-power' ? `Elemental Power: ${event.before ?? 'None'} → ${event.after}` : `${stateLabel(event.state)} active`}
      </p>)}
      {action.impacts.filter(i => i.invincibilityPreventedDamage !== undefined).map(i => <p key={i.targetId} className="text-xs text-info">{i.targetName}: Invincibility prevented {i.invincibilityPreventedDamage} damage</p>)}
      {action.mpAccounting && <p className="text-xs text-muted-foreground">MP: {action.mpAccounting.before} → {action.mpAccounting.after} · Cost {action.mpAccounting.costCharged ?? 'unresolved'}{action.mpAccounting.paymentRule === 'counter-triggering-actor' ? ` · Payer: ${action.mpAccounting.payerName} (${action.mpAccounting.payerCombatantId}) · triggering actor` : ''}</p>}
      {action.resourceAlerts.map((alert, index) => <p key={`${alert.kind}-${alert.combatantId}-${index}`} role="note" className="text-sm text-info">⚠ {resourceAlertText(alert)}</p>)}
      {action.timingDiagnostics.map(d => <p key={d} className="text-xs text-muted-foreground">{d}</p>)}
      {(action.effectDiagnostics ?? []).map((d, index) => <p key={index} className="text-xs text-muted-foreground">Unresolved effect: {d}</p>)}
      {(action.effectAudit ?? []).map((d, index) => <p key={index} className="text-xs text-info">{d}</p>)}
      {action.resourceDiagnostics.map(d => <p key={d} className="text-xs text-muted-foreground">{d}</p>)}
      </div></details>
    </li>)}
  </ol></ScrollArea>;
}

function ReplayPanel({ results, combatants }: { results: SimulationResult; combatants: readonly DisplayCombatant[] }) {
  const [fewest, setFewest] = useState(false);
  const retained = (results.report?.executedBattle.actions ?? results.optimized?.fastestRoute?.actions ?? (results.fastestBattleByFrames.length ? results.fastestBattleByFrames : results.fastestBattleHistory)) as readonly BattleActionRecord[];
  const actions = fewest ? results.fastestBattleHistory : retained;
  const alternate = results.fastestBattleHistory.length > 0 && JSON.stringify(results.fastestBattleHistory) !== JSON.stringify(retained);
  return <Card><CardHeader><CardTitle>Executed Battle Replay</CardTitle></CardHeader><CardContent className="space-y-3">
    <p>{fewest ? 'Fewest-actions victory observation. This is a separate retained execution, not the selected screened strategy.' : results.report ? replayExplanation(results.report) : results.fastestBattleByFrames.length ? 'Retained fastest timed victory observation.' : 'Retained fewest-actions victory observation; complete timing may be unavailable.'}</p>
    {!fewest && results.report && replayLimitation(results.report) && <p role="note">{replayLimitation(results.report)}</p>}
    {alternate && <div role="group" aria-label="Replay selection" className="flex flex-wrap gap-2"><Button variant="outline" aria-pressed={!fewest} onClick={() => setFewest(false)}>Retained fastest replay</Button><Button variant="outline" aria-pressed={fewest} onClick={() => setFewest(true)}>Fewest-actions replay</Button></div>}
    <ActionHistory actions={actions} combatants={combatants} />
  </CardContent></Card>;
}

export const BattleResults = ({ results }: { results: SimulationResult }) => {
  const rngPolicy = results.search?.rngPolicy ?? results.rngPolicy ?? 'natural';
  const stats = [
    ['Fastest Victory', frames(results.minFrames)],
    ['Average Victory', frames(results.avgFrames)],
    ['Slowest Victory', frames(results.maxFrames)],
    ['Completed Successes', `${results.completedSuccesses.toLocaleString()} / ${results.totalSimulations.toLocaleString()}`],
  ];
  const combatants = results.report ? [...results.report.playerTeam, ...results.report.enemyTeam] : [];
  return <div className="space-y-6 min-w-0 break-words">
    <SimulationReportExport report={results.report} />
    {results.report && <header className="space-y-2"><h1 className="text-xl font-semibold">{results.report.battle.label}</h1><p className="text-sm">{results.report.source.kind === 'run-planner' ? 'Run Planner · Historical pre-battle state · ' + (results.report.source.source.runName ?? 'Saved run') : 'Manual Simulator setup'}</p></header>}
    <p className="text-sm">Accuracy Mode: {(results.search?.accuracyMode ?? results.accuracyMode) === 'strategy' ? 'Strategy' : 'Game-accurate'} · RNG Policy: {RNG_POLICY_LABELS[rngPolicy]}</p>
    {results.optimized ? <OptimizedSearchResults result={results.optimized} combatants={combatants} /> : <section aria-label="Simulation Summary" className="rounded border p-4 space-y-3"><h2 className="text-xl font-semibold">Simulation Summary</h2><p>Random Monte Carlo · {results.search?.status === 'cancelled' ? 'Cancelled / Partial' : 'Completed'}</p><div className="grid gap-3 sm:grid-cols-3"><p>Success rate: {number(results.winRate)}%</p><p>Average victory: {frames(results.avgFrames)}</p><p>Samples: {number(results.totalSimulations)}</p><p>Fastest victory: {frames(results.minFrames)}</p></div>{!results.completedSuccesses && <p>No complete Player victory observed.</p>}<p className="text-xs">{RESULT_HELP.timing}</p>{rngPolicy === 'tas-luck' && <p>{RESULT_HELP.conditional}</p>}</section>}
    {!results.optimized && results.tasLuckRoute && <section className="rounded border p-4 space-y-3" aria-label="Recommended Player actions"><h3 className="font-semibold">Recommended Player Orders — retained fastest observation</h3>{results.tasLuckRoute.decisionTrace.map(p => <div key={p.key}><h4>Round {p.round}</h4>{p.orders.map(o => <p key={o.key}>{combatantLabel(combatants, o.actorId, o.actorName)} — {o.skillName} → {intendedTarget(o, combatants)}</p>)}</div>)}</section>}
    {!results.optimized && results.tasLuckRoute && <section aria-label="TAS Requirements"><h3 className="font-semibold">TAS Requirements — retained fastest observation</h3>{results.tasLuckRoute.rngRequirements?.map((r,i)=><p key={i}>Round {r.round} · {combatantLabel(combatants,r.targetId,r.targetName)} · {rngRequirementText(r)}</p>)}</section>}
    <ReplayPanel key={results.report ? JSON.stringify([results.report.battle, results.report.searchSummary]) : results.totalSimulations} results={results} combatants={combatants} />
    <details className="rounded border p-4"><summary className="cursor-pointer font-semibold">Technical Details</summary><div className="mt-3 space-y-4 break-words">
    {results.tasLuckSummary && results.tasLuckSummary.opportunities > 0 && <section aria-label="TAS Luck conflicts"><p>Confusion + Paralysis conflicts: {results.tasLuckSummary.opportunities} · Branches explored: {results.tasLuckSummary.branchesExplored} · Branches pruned: {results.tasLuckSummary.pruned} · Deduplicated: {results.tasLuckSummary.deduplicated} · Frontier: {results.tasLuckSummary.maxFrontier}/{results.tasLuckSummary.frontierCap}</p></section>}
    {results.report && <details><summary>Frozen provenance and internal identities</summary><pre className="overflow-auto max-h-80 text-xs">{JSON.stringify({ source: results.report.source, configuration: results.report.simulationConfiguration, combatants: combatants.map(a => ({ id: a.id, name: a.name, side: a.side, slot: a.slot })), fastest: results.optimized?.fastestRoute ? { seed: results.optimized.fastestRoute.seed, sampleIndex: results.optimized.fastestRoute.sampleIndex, sourcePrefixKey: results.optimized.fastestRoute.sourcePrefixKey } : null }, null, 2)}</pre></details>}
    {results.playerStatProvenance && <section aria-label="Player stat provenance" className="rounded border p-3 space-y-1">
      <p className="font-semibold">Player stat source: {results.playerStatProvenance.source === 'custom-simulation-stats' ? 'Custom simulation stats' : 'Planner baseline'}</p>
      {results.playerStatProvenance.players.map(p => <div key={p.instanceId}>
        <p>Slot {p.slot} {p.name} <span className="text-xs">({p.instanceId})</span></p>
        {p.changes.map(c => <p key={c.stat}>{STAT_LABELS[c.stat]}: Planner baseline {c.planner} → Simulation {c.simulation}</p>)}
        <p className="text-sm">Simulation-start resources: HP {p.currentHp} / {p.maxHp} · MP {p.currentMp} / {p.maxMp}</p>
      </div>)}
    </section>}
    <p className="font-semibold">Accuracy mode: {(results.search?.accuracyMode ?? results.accuracyMode) === 'strategy' ? 'Strategy' : 'Game-accurate'}</p>
    <p className="font-semibold">RNG Policy: {RNG_POLICY_LABELS[rngPolicy]}</p>
    {rngPolicy === 'tas-favorable' && <p role="note">Manipulated RNG assumptions: averages and success rates are conditional on TAS Favorable policy, not natural probability. Ordinary Hit Rate still follows Accuracy Mode.</p>}
    {rngPolicy === 'tas-luck' && <p role="note">Supported status RNG uses favorable TAS outcomes; only Enemy Confusion + Paralysis action conflicts compare complete paths. Averages and success rates use one selected result per unsupported-RNG seed, not natural probabilities. Unsupported RNG remains Natural; ordinary accuracy follows Accuracy Mode.</p>}
    {rngPolicy === 'tas-favorable' && results.rngOverrideCounts && <p>TAS overrides across completed valid rollouts: direct status gates {results.rngOverrideCounts.directStatus}; Enemy recoveries prevented {results.rngOverrideCounts.enemyRecoveryPrevented}; Player recoveries forced {results.rngOverrideCounts.playerRecoveryForced}; Enemy paralysis misses forced {results.rngOverrideCounts.enemyParalysisMiss}; Player paralysis failures prevented {results.rngOverrideCounts.playerParalysisPass}.</p>}
    {results.search && !results.optimized && <Card><CardHeader><CardTitle>{results.search.status === 'cancelled' ? 'Partial results — simulation cancelled' : 'Search completed'}</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
      <p>{number(results.search.completedSimulations)} / {number(results.search.requestedSimulations)} simulations completed</p>
      <p>Best found at simulation: {number(results.search.bestFoundAtSimulation)}</p>
      <p>Best occurred: {number(results.search.bestOccurrenceCount)} times</p>
      <p>No improvement in final: {number(results.search.simulationsSinceLastImprovement)} simulations</p>
      <p>Elapsed: {number(results.search.elapsedMs / 1000)} s · Speed: {number(results.search.simulationsPerSecond)} simulations/s</p>
      {!results.timedSuccesses && <p>No complete-timing victory found in completed simulations.</p>}
      <p>Monte Carlo search does not prove the global optimum. Recurrence and time since improvement are search heuristics.</p>
    </CardContent></Card>}
    {results.optimized && <p>Statistics below summarize valid observed rollouts across searched plans.</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{stats.map(([label, value]) => <Card key={label} className="bg-gradient-card border-border">
      <CardContent className="pt-6 space-y-2"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold text-info">{value}</p></CardContent>
    </Card>)}</div>
    <Card className="bg-gradient-card border-border"><CardHeader><CardTitle>Timing and resource coverage</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>Frame statistics cover {results.timedSuccesses.toLocaleString()} completed victories with complete measured timing.</p>
        {results.incompleteTimingSuccesses > 0 && <p className="text-info">{results.incompleteTimingSuccesses.toLocaleString()} completed victories have incomplete timing and are excluded from frame comparisons.</p>}
        <p>Players continue attacking and remain targetable at 0 HP or MP. Selected healing and revival Assists count toward actions and frames. Ordinary healing excludes 0 HP; a revived Digimon resumes next round. Guard and items remain excluded.</p>
        <p className="text-info">{results.runsWithResourceAlerts.toLocaleString()} simulations required additional in-game recovery actions.</p>
        {Object.entries(results.outcomeCounts).filter(([outcome, count]) => outcome !== 'player-win' && count > 0).map(([outcome, count]) => <p key={outcome}>{outcome}: {count} (excluded from victory statistics)</p>)}
        {results.timingDiagnostics.map(d => <p key={d} className="text-muted-foreground">{d}</p>)}
        {results.resourceDiagnostics.map(d => <p key={d} className="text-muted-foreground">{d}</p>)}
      </CardContent>
    </Card>
    <Card className="bg-gradient-card border-border"><CardHeader><CardTitle>Action Statistics</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
      <p>Fewest: {number(results.minTurns)}</p><p>Average: {number(results.avgTurns)}</p><p>Most: {number(results.maxTurns)}</p>
    </CardContent></Card>
    </div></details>
  </div>;
};
