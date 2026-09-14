import type { BattleInput } from '@/utils/battle/battleTypes';
import type { SimulationResult } from '@/types/digimon';
import type { SearchProgress } from '@/utils/battle/battleSimulationSearch';
export type SearchRequest = { type: 'START'; jobId: string; input: BattleInput; requestedSimulations: number; searchMethod?: import('@/utils/battle/battleSearchObjectives').BattleSearchMethod; optimizationObjective?: import('@/utils/battle/battleSearchObjectives').OptimizationObjective; optimizedConfig?: import('@/utils/battle/battleOptimizedSearch').OptimizedSearchConfig; simulationRules?: import('@/utils/battle/battleSimulationRules').BattleSimulationRules; seed?: number; maxRounds?: number } | { type: 'CANCEL'; jobId: string };
export type SearchResponse = { type: 'PROGRESS'; jobId: string; progress: SearchProgress }
  | { type: 'COMPLETE' | 'CANCELLED'; jobId: string; result: SimulationResult }
  | { type: 'ERROR'; jobId: string; message: string };
