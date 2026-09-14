import { BattleInputError } from './battleTypes';
export type AccuracyMode = 'strategy' | 'game-accurate';
export interface BattleSimulationRules { accuracyMode: AccuracyMode }
/** API omission preserves authoritative gameplay; UI explicitly chooses Strategy. */
export function resolveSimulationRules(rules?: BattleSimulationRules): BattleSimulationRules {
  const accuracyMode = rules?.accuracyMode ?? 'game-accurate';
  if (accuracyMode !== 'strategy' && accuracyMode !== 'game-accurate') throw new BattleInputError('Unknown simulation accuracy mode.');
  return { accuracyMode };
}
