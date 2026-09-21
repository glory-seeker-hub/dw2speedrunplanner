import type { BattleRngPolicy } from './battleRngPolicy';
import { BattleInputError } from './battleTypes';
export type AccuracyMode = 'strategy' | 'game-accurate';
export interface BattleSimulationRules { accuracyMode: AccuracyMode; rngPolicy?: BattleRngPolicy }
/** API omission preserves authoritative gameplay; UI explicitly chooses Strategy. */
export function resolveSimulationRules(rules?: BattleSimulationRules): Required<BattleSimulationRules> {
  const accuracyMode = rules?.accuracyMode ?? 'game-accurate';
  if (accuracyMode !== 'strategy' && accuracyMode !== 'game-accurate') throw new BattleInputError('Unknown simulation accuracy mode.');
  const rngPolicy = rules?.rngPolicy ?? 'natural';
  if (rngPolicy !== 'natural' && rngPolicy !== 'tas-favorable' && rngPolicy !== 'tas-luck') throw new BattleInputError('Unknown simulation RNG policy.');
  return { accuracyMode, rngPolicy };
}
