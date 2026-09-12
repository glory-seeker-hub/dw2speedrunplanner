import type { BattleTurn, SimulationResult } from '@/types/digimon';
import type { Encounter } from '@/types/encounter';
import type { BattleEngineOptions, BattleRunResult, BattleTeamMember } from './battleTypes';
import { createProductionBattleRng } from './battleRng';
import { simulateBattleCore } from './battleSimulation';

/** Non-authoritative 10/12/14 second estimates, never converted to frames. */
export const legacyTimingAdapter = (targetsHit: number): number => targetsHit === 1 ? 10 : targetsHit === 2 ? 12 : 14;
export function projectLegacyHistory(result: BattleRunResult): BattleTurn[] {
  let turn = 0;
  return result.actions.flatMap(action => {
    if (action.state !== 'resolved') return [];
    turn++;
    return action.impacts.map(impact => ({
      turn, round: action.round, digimon: action.actorName, tech: action.skillName ?? 'Guard', target: impact.targetName,
      damage: impact.damage, hpRemaining: impact.hpAfter, result: impact.ko ? 'KO' : 'Hit',
      timeSeconds: legacyTimingAdapter(action.legacyTimingTargetCount), targetsHit: action.legacyTimingTargetCount,
    }));
  });
}
/** Preserve old aggregate conventions (including defeats) until the Results phase. */
export function runLegacyBattleSimulation(player: readonly BattleTeamMember[], enemy: readonly BattleTeamMember[] | Encounter, floorSpecialty: string, simulationCount: number, options: BattleEngineOptions = {}): SimulationResult {
  if (!Number.isSafeInteger(simulationCount) || simulationCount < 1) throw new Error('simulationCount must be a positive safe integer.');
  const rng = options.rng ?? createProductionBattleRng();
  let wins = 0, totalTurns = 0, totalTime = 0, minTurns = Infinity, minTime = Infinity, maxTurns = 0, maxTime = 0;
  let fastestBattleHistory: BattleTurn[] = [], fastestBattleByTime: BattleTurn[] = [];
  for (let i = 0; i < simulationCount; i++) {
    const result = simulateBattleCore({ player, enemy, floorSpecialty }, { ...options, rng, simulationIndex: i });
    if (result.outcome !== 'player-win' && result.outcome !== 'enemy-win') throw new Error(`${result.outcome}: ${result.diagnostics.join(' ')}`);
    const history = projectLegacyHistory(result);
    const time = history.reduce((sum, row) => sum + row.timeSeconds, 0);
    if (result.outcome === 'player-win') wins++;
    totalTurns += result.actionCount; totalTime += time;
    if (result.actionCount < minTurns) { minTurns = result.actionCount; fastestBattleHistory = history; }
    if (time < minTime) { minTime = time; fastestBattleByTime = history; }
    maxTurns = Math.max(maxTurns, result.actionCount); maxTime = Math.max(maxTime, time);
  }
  return { winRate: wins / simulationCount * 100, totalSimulations: simulationCount, minTurns, avgTurns: totalTurns / simulationCount, maxTurns, minTime, avgTime: totalTime / simulationCount, maxTime, fastestBattleHistory, fastestBattleByTime };
}
