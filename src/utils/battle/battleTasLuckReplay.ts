import { createTasLuckReplay, TasLuckDivergence } from './battleTasLuck';
import { replayPlayerPrefix } from './battleActionPlans';
import { playerDecisionTraceKey } from './battlePlayerDecisionTrace';
import type { FastestRoute } from './battleFastestRoute';
import type { BattleInput, BattleEngineOptions } from './battleTypes';

/** Preserve the original scripted/random boundary: scripting a previously random
 * tail would remove Natural policy draws and replay a different random stream. */
export function replayTasLuckRoute(input: BattleInput, route: FastestRoute, options: BattleEngineOptions) {
  if(!route.tasLuckTrace || !route.sourcePlayerPrefix) throw new TasLuckDivergence('Missing TAS route replay provenance.');
  const replay=createTasLuckReplay(route.tasLuckTrace,true);
  const observation=replayPlayerPrefix(input,route.sourcePlayerPrefix,route.seed,{...options,tasLuck:replay.control,simulationRules:{accuracyMode:options.simulationRules?.accuracyMode??'game-accurate',rngPolicy:'tas-luck'}},false,true);
  replay.finish();
  if(observation.diverged || playerDecisionTraceKey(observation.decisionTrace)!==route.decisionTraceKey) throw new TasLuckDivergence('Player decision trace diverged during TAS replay.');
  observation.result.tasLuckTrace=replay.visited;
  return observation;
}
