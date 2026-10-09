import type { BattleSimulationReport, DeepReadonly } from './battleSimulationReport';
import type { PlayerOrder } from './battleActionPlans';
import type { OptimizationObjective } from './battleSearchObjectives';
import type { BattleActionRecord } from './battleTypes';

/** Presentation only; no ranking, simulation or mutation. */
export const RESULT_HELP = {
  fastest: 'Fastest Route Found is the fastest complete winning execution observed during this search. It is one concrete simulation path, with intended Player orders, and is not proof of a global optimum.',
  screened: 'Best Screened Strategy is the Player strategy/prefix repeatedly evaluated in the completed fair screening stage. Its statistics summarize repeated samples and may differ from the single Fastest Route Found.',
  fair: 'Fair comparisons use common sampled RNG worlds where applicable. Later path-specific or random continuation may extend beyond the fixed prefix; this is not a complete adaptive policy.',
  average: "Selected Average Victory Strategy is the fair-screened strategy chosen by the Simulator's existing average-winning-frame objective. This is an average of winning samples, not expected real-game time.",
  success: "Selected Success Rate Strategy is the fair-screened strategy with the highest observed success rate under the Simulator's existing sampling rules. No confidence interval is calculated.",
  candidates: 'Top Screened Strategies are bounded candidate strategy summaries from fair screening, in search ranking order; they are not the fastest individual battle replays.',
  tas: 'TAS Luck uses favorable outcomes for supported status RNG. If an Enemy is both Confused and Paralyzed when acting, the Simulator compares a Paralysis Miss with allowing the Confusion action to proceed. Unsupported RNG remains Natural.',
  conditional: 'Statistics are conditional on TAS Luck behavior and sampled unsupported RNG; they are not natural game probabilities.',
  natural: "Uses the game's implemented RNG normally. Ordinary Hit Rate is controlled separately by Accuracy Mode.",
  timing: 'Modeled action frames plus measured inter-round processing/order-entry overhead; other external menu, recovery, item and setup time is excluded.',
  limitation: 'Beam pruning, stochastic/fair rollouts and bounded TAS conflict search where applicable do not prove a global optimum.',
} as const;
export const strategyTitle = (o: OptimizationObjective) => o === 'average-victory' ? 'Selected Average Victory Strategy' : o === 'success-rate' ? 'Selected Success Rate Strategy' : 'Best Screened Strategy';
export const strategyHelp = (o: OptimizationObjective) => o === 'average-victory' ? RESULT_HELP.average : o === 'success-rate' ? RESULT_HELP.success : RESULT_HELP.screened;
export type DisplayCombatant = { readonly id: string; readonly name: string; readonly side: string; readonly slot: number };
export function combatantLabel(team: readonly DisplayCombatant[], id: string, fallback = 'Unknown combatant'): string {
  const a = team.find(a => a.id === id);
  return a ? `${a.name} · ${a.side === 'player' ? 'Player' : 'Enemy'} ${a.slot}` : fallback;
}
export function intendedTarget(o: DeepReadonly<PlayerOrder>, team: readonly DisplayCombatant[]): string {
  if (/random/i.test(o.targetLabel)) return 'Random target';
  if (o.targetIntent?.kind === 'combatants') return o.targetIntent.targetIds.map(id => combatantLabel(team, id, /[0-9a-f]{8}-|player-instance-/i.test(o.targetLabel) ? 'Unknown combatant' : o.targetLabel)).join(', ');
  return o.targetLabel === 'All' ? 'All Enemies' : o.targetLabel;
}
/** A retained execution is evidence for this round's order, never for a screened strategy. */
export function resolvedOrderTarget(o: DeepReadonly<PlayerOrder>, round: number, actions: readonly DeepReadonly<BattleActionRecord>[], team: readonly DisplayCombatant[]) {
  const action = actions.find(a => a.round === round && a.actorId === o.actorId && !a.chainFromActionId && a.state === 'resolved');
  if (!action) return { label: intendedTarget(o, team), executed: false };
  const ids = action.effectiveTargetIds;
  return { label: ids.length ? ids.map(id => combatantLabel(team, id)).join(', ') : intendedTarget(o, team), executed: true };
}
export function replayExplanation(r: BattleSimulationReport): string {
  if (!r.executedBattle.actions.length) return 'No completed victory replay was retained.';
  return r.executedBattle.kind === 'fewest-actions-observation' ? 'This is the retained fewest-actions victory observation; complete frame timing is unavailable.' : 'This is the detailed replay of the fastest complete winning execution retained by the Simulator.';
}
export function replayLimitation(r: BattleSimulationReport): string | null {
  const s = r.selectedResult;
  if (s.kind !== 'optimized-action-search' || s.objective === 'fastest-potential' || !s.fastestCompleteRoute || !r.executedBattle.actions.length) return null;
  if (s.screenedPrefix.plans.length && JSON.stringify(s.screenedPrefix.plans.map(p => p.key)) === s.fastestCompleteRoute.sourcePrefixKey) return null;
  return `Detailed replay shown below is the retained Fastest Route observation. It may not use the selected ${s.objective === 'average-victory' ? 'Average Victory' : 'Success Rate'} screened strategy.`;
}


export const THOROUGHNESS_LABELS = { standard: 'Standard', thorough: 'Thorough', maximum: 'Maximum' } as const;
/** Shared display descriptors; consistency tests check these against production policy. */
export const SEARCH_QUALITY_PRESETS = [['Quick', 10000], ['Standard', 100000], ['Deep', 1000000]] as const;
export const THOROUGHNESS_DETAILS = {
  standard: { samples: [4, 16, 64], beamMultiplier: 1, restart: 'No restart.' },
  thorough: { samples: [8, 32, 128], beamMultiplier: 2, restart: 'No restart.' },
  maximum: { samples: [16, 64, 256], beamMultiplier: 4, restart: 'Conditional fallback restart only after enhanced search, when useful continuation and enough budget remain.' },
} as const;
export const THOROUGHNESS_HELP = 'Higher thoroughness increases search coverage and statistical screening and may take substantially longer. It does not guarantee the global optimum.';
export const THOROUGHNESS_DESCRIPTIONS = {
  standard: 'Uses the current optimized search.',
  thorough: 'Uses more of the available budget to evaluate and retain promising strategies more carefully.',
  maximum: 'Uses the most thorough supported search within the rollout budget.',
} as const;
export const SEARCH_STOP_LABELS: Record<import('./battleSearchPasses').SearchStopReason, string> = {
  'single-pass-complete': 'Standard search completed',
  'configured-search-complete': 'Configured screening and exploration completed',
  'search-exhausted': 'No further useful configured search step', 'budget-exhausted': 'Rollout budget exhausted',
  'insufficient-budget-for-pass': 'Remaining budget below valid pass minimum',
  'no-progress': 'Search pass made no evaluation progress', 'cancelled': 'Cancelled / Partial',
};
