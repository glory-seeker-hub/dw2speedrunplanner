import { THOROUGHNESS_LABELS, THOROUGHNESS_HELP, SEARCH_STOP_LABELS } from './battlePresentation';
import { RESULT_HELP, strategyTitle, strategyHelp, combatantLabel, intendedTarget, replayExplanation, replayLimitation } from './battlePresentation';
import { isColiseumLocation } from '@/data/coliseumBattles';
import type { BattleSimulationReport, DeepReadonly } from './battleSimulationReport';
import type { PlayerRoundPlan, PlayerOrder } from './battleActionPlans';
import { OBJECTIVE_LABELS } from './battleSearchObjectives';
import { RNG_POLICY_LABELS } from './battleRngPolicy';
import { STAT_LABELS } from './battleStatOverrides';
import { rngRequirementText } from './battleRngAudit';
import { safeRouteTitle } from '@/utils/routeDocument';

/** One-line Markdown text, including inside tables; no raw HTML or active links. */
export function reportText(value: string | number | boolean): string {
  return Array.from(String(value), c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c).join('')
    .replace(/\s+/g, ' ').trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_[\]|]/g, '\\$&');
}
const title = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
/** Readable leaf descriptions for structured engine event details. No JSON dump. */
function details(value: unknown, prefix = ''): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== 'object') return [`- ${reportText(prefix)}: ${reportText(String(value))}`];
  return Object.entries(value).flatMap(([key, item]) => details(item, [prefix, Array.isArray(value) ? String(Number(key) + 1) : title(key)].filter(Boolean).join(' / ')));
}
export function serializeBattleSimulationReportJson(report: BattleSimulationReport): string { return JSON.stringify(report, null, 2) + '\n'; }
export function simulationReportFilename(report: BattleSimulationReport, format: 'md' | 'json' = 'md'): string {
  const objective = report.selectedResult.kind === 'optimized-action-search' ? report.selectedResult.objective : 'random-monte-carlo';
  const battle = safeRouteTitle(report.battle.label).slice('DW2 Route - '.length);
  return `dw2-battle-simulation-${battle}-${objective}.${format}`;
}
export function serializeBattleSimulationReportMarkdown(report: BattleSimulationReport): string {
  const lines: string[] = ['# Digimon World 2 — Battle Simulation Report', '', `Report version: ${report.reportVersion}`, '',
    `Search status: ${report.resultStatus === 'cancelled' ? 'Cancelled / Partial' : 'Completed'}`, ''];
  const section = (heading: string) => { lines.push('', `## ${heading}`, ''); };
  const field = (label: string, value: string | number | undefined | null) => { if (value !== undefined && value !== null) lines.push(`- ${label}: ${reportText(value)}`); };
  const combatants = [...report.playerTeam, ...report.enemyTeam];
  const actorLabel = (id: string) => combatantLabel(combatants, id);
  const order = (o: DeepReadonly<PlayerOrder>) => {
    const target = intendedTarget(o, combatants);
    return `${reportText(actorLabel(o.actorId))} — ${reportText(o.skillName)} → ${reportText(target)}`;
  };
  const orders = (plans: DeepReadonly<PlayerRoundPlan[]>) => {
    for (const p of plans) { lines.push('', `### Round ${p.round}`, ''); for (const o of p.orders) lines.push(`- ${order(o)}`); }
  };
  const statistics = (s: DeepReadonly<import('./battleSearchObjectives').OptimizedCandidateStats> | null) => {
    if (!s) { lines.push('No completed fair-stage statistics retained.'); return; }
    field('Rollouts in fair set', s.evaluations); field('Arithmetic mean victory frames', s.averageVictoryFrames);
    field('Fastest fair-stage sample (frames)', s.fastestFrames); field('Success rate', `${s.successRate * 100}%`);
    field('Divergence rate', `${s.divergenceRate * 100}%`); field('Victories', s.victories); field('Complete timing victories', s.completeTimingVictories);
  };
  section('How to Read This Report');
  if (report.selectedResult.kind === 'optimized-action-search') {
    lines.push(RESULT_HELP.fastest, '', RESULT_HELP.screened, '', RESULT_HELP.fair);
    if (report.selectedResult.objective !== 'fastest-potential') lines.push('', strategyHelp(report.selectedResult.objective));
  } else lines.push('Simulation Summary describes the completed Random Monte Carlo samples. The retained replay is one observed victory, not the average sample.');
  lines.push('', RESULT_HELP.timing);
  if (report.simulationConfiguration.rules.rngPolicy === 'tas-luck') lines.push('', RESULT_HELP.tas, '', RESULT_HELP.conditional, '', 'TAS requirements describe outcomes needed by the retained observation.');
  lines.push('', replayExplanation(report));
  const replayNote = replayLimitation(report); if (replayNote) lines.push('', replayNote);
  section('Source');
  if (report.source.kind === 'manual') lines.push('Manual setup');
  else {
    lines.push('Run Planner — historical pre-battle reconstruction', '');
    field('Run', report.source.source.runName);
    field('Action', report.source.source.battleEventIndex + 1);
    lines.push(...details(report.source.historicalStateSummary, 'Historical context'));
  }
  section('Battle'); field('Enemy group', report.battle.label); field('Encounter', report.battle.encounterId);
  if (report.source.kind === 'run-planner' && !isColiseumLocation(report.source.selectedBattle)) { field('Domain', report.source.selectedBattle.domainId); field('Floor', report.source.selectedBattle.floor); field('Phase', report.source.selectedBattle.phase); }
  for (const [heading, team] of [['Player Team', report.playerTeam], ['Enemy Team', report.enemyTeam]] as const) {
    section(heading);
    lines.push('| Combatant | Max HP | Current HP | Max MP | Current MP | ATK | DEF | SPD |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const a of team) lines.push(`| ${reportText(actorLabel(a.id))} | ${a.maxHp} | ${a.currentHp} | ${a.maxMp} | ${a.currentMp} | ${a.baseStats.atk} | ${a.baseStats.def} | ${a.baseStats.spd} |`);
    for (const a of team) {
      lines.push('', `### ${reportText(actorLabel(a.id))}`, '');
      field('Species ID', a.speciesId); field('Level', a.level); field('DP', a.dp); lines.push(...details(a.levelCap, 'Max Level/cap'));
      field('Type', a.type); field('Specialty', a.specialty); field('Boss', a.isBoss ? 'Yes' : 'No');
      field('Available techniques', a.skills.map(s => `${s.legacyTech.name} (${s.canonicalSkillId ?? s.key}; ${s.source})`).join('; '));
      lines.push(...details(a.statuses, 'Initial statuses'), ...details(a.temporaryPowers, 'Initial powers'));
      field('Initial elemental power', a.elementalPower); field('Initial ATK stage', a.atkStage); field('Initial DEF stage', a.defStage); field('Initial SPD stage', a.spdStage);
    }
  }
  if (report.playerStatProvenance) {
    section('Player Stat Provenance');
    lines.push(`Player stat source: ${report.playerStatProvenance.source === 'planner-baseline' ? 'Planner baseline' : 'Custom simulation stats'}`, '');
    for (const p of report.playerStatProvenance.players) {
      for (const c of p.changes) lines.push(`- ${reportText(p.name)} · Slot ${p.slot} · ${STAT_LABELS[c.stat]}: Planner ${c.planner} → Simulation ${c.simulation}`);
      lines.push(`- ${reportText(p.name)} · Slot ${p.slot}: simulation-start HP ${p.currentHp}/${p.maxHp}; MP ${p.currentMp}/${p.maxMp}.`);
    }
    lines.push('', 'Current HP/MP are not historically tracked by Run Planner. Custom values are local simulation inputs, not verified in-game measurements.');
  }
  section('Simulation Configuration');
  const c = report.simulationConfiguration;
  field('Search Method', c.searchMethod === 'random-monte-carlo' ? 'Random Monte Carlo' : 'Optimized Action Search');
  if (c.searchMethod === 'optimized-action-search') {
    field('Search Thoroughness', THOROUGHNESS_LABELS[c.searchThoroughness ?? 'standard']);
    const passes = report.searchSummary.passes;
    if (passes && passes.passesStarted > 1) { field('Additional exploration restarts', passes.passesStarted - 1); field('Completed passes', passes.passesCompleted); }
    const effort = report.searchSummary.effort;
    if (effort) { field('Screening schedule', effort.screeningSchedule.join(' -> ')); field('Completed screening stages', effort.completedStages.join(' -> ') || 'None'); field('Effective beam width', effort.beamWidth); field('Effective max depth', effort.maxDepth); }
    if (passes?.stopReason) field('Stop reason', SEARCH_STOP_LABELS[passes.stopReason]);
    if (passes?.fastestPass) field('Fastest route source pass', passes.fastestPass);
    if (passes) field('Fastest improvements', passes.fastestImprovements);
    if (c.searchThoroughness && c.searchThoroughness !== 'standard') lines.push('', THOROUGHNESS_HELP, '');
  }
  if (c.objective) field('Optimization Objective', OBJECTIVE_LABELS[c.objective]);
  field('Accuracy Mode', c.rules.accuracyMode === 'strategy' ? 'Strategy' : 'Game-accurate');
  field('RNG Policy', RNG_POLICY_LABELS[c.rules.rngPolicy ?? 'natural']); field('Floor Specialty', c.floorSpecialty);
  field('Requested evaluations / budget', c.requestedEvaluations); field('Beam width', c.optimizedConfig?.beamWidth); field('Max optimized depth', c.optimizedConfig?.maxDepth);
  field('TAS Luck frontier cap', c.tasFrontierCap); field('Simulator root seed', c.seed); field('Max rounds safety limit', c.maxRounds);
  section('Search Summary'); lines.push(...details(Object.fromEntries(Object.entries(report.searchSummary).filter(([key]) => key !== 'passes' && key !== 'effort'))));
  if(report.tasLuckSummary && report.tasLuckSummary.opportunities > 0){section('TAS Luck Conflicts');if(report.tasLuckSummary.opportunities === 0) lines.push('Deterministic favorable status outcomes; no Confusion + Paralysis conflicts encountered.');else lines.push('Enemy Confusion + Paralysis action conflicts only.', ...details(report.tasLuckSummary));}
  section('Result');
  const selected = report.selectedResult;
  if (selected.kind === 'random-monte-carlo') {
    field('Success rate', `${selected.winRate}%`); field('Fastest victory (frames)', selected.minFrames); field('Average victory (frames)', selected.averageFrames); field('Slowest victory (frames)', selected.maxFrames);
    field('Fewest actions', selected.minActions); field('Average actions', selected.averageActions); field('Most actions', selected.maxActions);
  } else {
    if (selected.objective !== 'fastest-potential') { lines.push('### ' + strategyTitle(selected.objective), '', strategyHelp(selected.objective)); statistics(selected.screenedPrefix.statistics); }
    lines.push('### Fastest Route Found', '', RESULT_HELP.fastest, '');
    const route = selected.fastestCompleteRoute;
    if (route) { field('Total frames', route.totalFrames); field('Rounds', route.rounds); }
    else lines.push('No eligible complete victory observed.');
    if (selected.objective === 'fastest-potential') { lines.push('', `### ${strategyTitle(selected.objective)}`, '', RESULT_HELP.screened); statistics(selected.screenedPrefix.statistics); }
    lines.push('', 'Fair prefix orders (distinct from the global fastest observation):'); orders(selected.screenedPrefix.plans);
    if (selected.topCandidates.length) {
      lines.push('', '### Top Screened Strategies', '', RESULT_HELP.candidates, '', '| Rank / first-round orders | Rollouts | Fastest frames | Mean frames | Success | Divergence |', '| --- | ---: | ---: | ---: | ---: | ---: |');
      selected.topCandidates.forEach((candidate, i) => { const s = candidate.statistics; lines.push(`| ${i + 1}. ${candidate.firstRoundOrders.map(order).join('; ')} | ${s.evaluations} | ${s.fastestFrames ?? ''} | ${s.averageVictoryFrames ?? ''} | ${s.successRate * 100}% | ${s.divergenceRate * 100}% |`); });
    }
  }
  section('Recommended Player Orders');
  if (report.playerStrategy.kind === 'not-retained') lines.push('Intended orders were not retained for Random Monte Carlo. See the executed observation below.');
  else { field('Order source', report.playerStrategy.kind === 'observed-route' ? 'Exact intended orders of the retained fastest observation' : 'Selected screened strategy/prefix'); lines.push('These are intended orders. Orders can remain unexecuted if the battle ends earlier. Random/policy targets are resolved by the engine.'); orders(report.playerStrategy.plans); }
  if (selected.kind === 'optimized-action-search' && selected.objective !== 'fastest-potential' && selected.fastestCompleteRoute) {
    lines.push('', '### Global fastest observation — intended orders', '', 'These may differ from the selected fair strategy.'); orders(selected.fastestCompleteRoute.decisionTrace);
  }
  if (report.rngRequirements.length) {
    section(c.rules.rngPolicy === 'tas-luck' ? 'TAS Luck Requirements' : 'TAS RNG Requirements');
    if (selected.kind === 'optimized-action-search' && selected.objective !== 'fastest-potential') lines.push('These requirements belong to the retained Fastest Route observation; they do not establish requirements for the selected screened strategy.');
    for (const r of report.rngRequirements) lines.push(`- Round ${r.round} · ${reportText(actorLabel(r.actorId))} · ${reportText(r.skillName ?? 'Guard')} · ${reportText(actorLabel(r.targetId))} · ${r.phase}: ${reportText(rngRequirementText(r))}`);
  }
  section('Executed Battle Replay'); lines.push(replayExplanation(report)); if (replayNote) lines.push('', replayNote); field('Observation', report.executedBattle.kind); field('Total modeled frames', report.executedBattle.totalFrames); field('Rounds', report.executedBattle.rounds);
  let round = 0;
  for (const a of report.executedBattle.actions) {
    if (round !== a.round) { round = a.round; lines.push('', `### Round ${round}`, ''); }
    lines.push('', `#### ${a.sequence}. ${reportText(actorLabel(a.actorId))} — ${reportText(a.skillName ?? a.kind)}`, '');
    field('Outcome', a.outcome); field('State', a.state); field('Reason', a.reason); field('Action frames', a.durationFrames);
    field('Actual targets', a.effectiveTargetIds.map(actorLabel).join(', '));
    lines.push('', '<details><summary>Action details — resources, status, RNG and effect audit</summary>', '');
    field('Internal action ID', a.id);
    for (const i of a.impacts) {
      lines.push(`- ${reportText(actorLabel(i.targetId))}: ${i.damage} damage; ${i.healing} healing; HP ${i.hpBefore} → ${i.hpAfter}; ${reportText(i.outcome)}.`);
      lines.push(...details(i.statusApplications, 'Status application'), ...details(i.appliedEffects, 'Applied effect'));
      field('Base damage', i.baseDamage); field('Poison bonus damage', i.poisonBonusDamage);
      field('Damage before Interrupt reduction', i.damageBeforeInterruptReduction); field('Effective element', i.effectiveElement);
      field('Invincibility prevented damage', i.invincibilityPreventedDamage);
    }
    for (const [label, data] of Object.entries({ 'MP accounting': a.mpAccounting, 'Accuracy': a.accuracy, 'Status before': a.statusesBefore, 'Status after recovery': a.statusesAfterRecovery,
      'Status recovery': a.statusRecoveries, 'Confusion': a.confusion, 'Counter': a.counter, 'Interrupt': a.interrupt, 'Restart': a.restart, 'Reaction': a.reaction, 'Support events': a.supportEvents,
      'Effect audit': a.effectAudit, 'Effect diagnostics': a.effectDiagnostics, 'Resource alerts': a.resourceAlerts, 'Resource diagnostics': a.resourceDiagnostics, 'Timing diagnostics': a.timingDiagnostics, 'Interrupt timing': a.interruptTiming, 'Chain from action': a.chainFromActionId })) lines.push(...details(data, label));
    lines.push('', '</details>', '');
  }
  section('Technical Details');
  if (report.source.kind === 'run-planner') { field('Run ID', report.source.source.runId); field('Battle event ID', report.source.source.battleEventId); }
  for (const a of combatants) field(actorLabel(a.id), a.id);
  if (selected.kind === 'optimized-action-search' && selected.fastestCompleteRoute) { field('Source prefix identity', selected.fastestCompleteRoute.sourcePrefixKey); field('Simulator seed', selected.fastestCompleteRoute.seed); field('Sample index', selected.fastestCompleteRoute.sampleIndex); }
  section('Diagnostics'); for (const diagnostic of report.diagnostics) {
    if (!replayNote && diagnostic.startsWith('No representative replay of the selected fair strategy')) continue;
    lines.push(`- ${reportText(diagnostic)}`);
  }
  return lines.join('\n') + '\n';
}
