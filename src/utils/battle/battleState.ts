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
  // Canonical stages floor from base first; legacy multipliers and halfDefense
  // remain independent and apply afterward without another parameter floor.
  return finite(applyParameterStage(actor.baseStats[stat], actor.parametersSuppressed ? 0 : actor[`${stat}Stage`], stat) * (actor.parameterModifiers[stat] ?? 1)
    * (stat === 'def' && actor.halfDefense ? 0.5 : 1), `effective ${stat}`);
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

/** Resolve directly from base, preserving Planner fractional stats at stage zero.
 * ATK/DEF +1 = 3/2 is experimentally validated; DEF -1 = 180/256 is an
 * empirical fit, not a disassembly result. ATK down and all SPD stages retain
 * the preceding Phase 2P-A model and are not validated by these experiments. */
export function applyParameterStage(baseStat: number, stage: number, stat: 'atk' | 'def' | 'spd'): number {
  const numerator = stage === 1 && stat !== 'spd' ? 384 : [128, 180, 256, 362, 512][stage + 2];
  return stage === 0 ? baseStat : Math.floor(baseStat * numerator / 256);
}
