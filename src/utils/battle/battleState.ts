import type { BattleCombatantState, BattleState } from './battleTypes';
import { BattleInputError } from './battleTypes';

export function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new BattleInputError(`Non-finite ${label}.`);
  return value;
}
export function validateCombatant(actor: BattleCombatantState): void {
  for (const stat of ['hp', 'mp', 'atk', 'def', 'spd'] as const) {
    const value = actor.baseStats[stat];
    finite(value, `${actor.id} ${stat}`);
    if (value < 0) throw new BattleInputError(`Negative ${actor.id} ${stat}.`);
  }
  if (actor.baseStats.def <= 0) throw new BattleInputError(`DEF must be positive for ${actor.id}.`);
  for (const stage of [actor.atkStage, actor.defStage, actor.spdStage]) if (!Number.isInteger(stage) || stage < -2 || stage > 2) throw new BattleInputError('Invalid stat stage.');
  for (const [stat, multiplier] of Object.entries(actor.parameterModifiers)) {
    finite(multiplier, `${actor.id} ${stat} multiplier`);
    if (multiplier <= 0) throw new BattleInputError(`Invalid ${stat} multiplier for ${actor.id}.`);
  }
  for (const value of [actor.currentHp, actor.currentMp, actor.maxHp, actor.maxMp]) {
    if (finite(value, 'HP/MP') < 0) throw new BattleInputError('Negative HP/MP.');
  }
  for (const skill of actor.skills) {
    if (finite(skill.legacyTech.ap, 'technique AP') < 0) throw new BattleInputError('Negative technique AP.');
    const effect = skill.legacyTech.specialEffect;
    if (effect?.value !== undefined && finite(effect.value, 'legacy effect value') < 0) throw new BattleInputError('Negative legacy effect value.');
    if (effect?.maxStacks !== undefined && (!Number.isSafeInteger(effect.maxStacks) || effect.maxStacks < 0)) throw new BattleInputError('Invalid legacy stack limit.');
  }
}
export function effectiveParameter(actor: BattleCombatantState, stat: 'atk' | 'def' | 'spd'): number {
  return finite(actor.baseStats[stat] * stageMultiplier(actor.parametersSuppressed ? 0 : actor[`${stat}Stage`]) * (actor.parameterModifiers[stat] ?? 1), `effective ${stat}`);
}
export const actorById = (state: BattleState, id: string): BattleCombatantState => {
  const actor = state.combatants.find(a => a.id === id);
  if (!actor) throw new BattleInputError(`Unknown combatant ${id}.`);
  return actor;
};
export function completedOutcome(state: BattleState): 'player-win' | null {
  if (!state.combatants.some(a => a.side === 'enemy' && a.isAlive)) return 'player-win';
  return null;
}

export function stageMultiplier(stage: number): number { return [0.5, 1 / Math.SQRT2, 1, Math.SQRT2, 2][stage + 2]; }
