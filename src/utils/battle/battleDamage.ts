import { effectiveParameter } from './battleState';
import { counterDefinition, usesActivatedCounterMechanics } from './battleReactions';
import type { BattleState, PlannedAction } from './battleTypes';
import type { Tech } from '@/types/digimon';
import { BattleCombatantState, BattleInputError } from './battleTypes';

// Specialty bonus matrix based on attacker tech specialty vs defender digimon specialty
const SPECIALTY_BONUS_MATRIX: { [key: string]: { [key: string]: number } } = {
  'Dark': { 'Dark': 1, 'Fire': 0.8, 'Machine': 1, 'Nature': 1, 'Water': 1.2 },
  'Fire': { 'Dark': 1, 'Fire': 1, 'Machine': 0.8, 'Nature': 1.2, 'Water': 1 },
  'Machine': { 'Dark': 1.2, 'Fire': 1, 'Machine': 1, 'Nature': 1, 'Water': 0.8 },
  'Nature': { 'Dark': 0.8, 'Fire': 1, 'Machine': 1.2, 'Nature': 1, 'Water': 1 },
  'Water': { 'Dark': 1, 'Fire': 1.2, 'Machine': 1, 'Nature': 0.8, 'Water': 1 }
};

// Type advantage matrix: attacker type vs defender type
const TYPE_BONUS_MATRIX: { [key: string]: { [key: string]: number } } = {
  'Vaccine': { 'Vaccine': 1, 'Data': 0.8, 'Virus': 1.2 },
  'Data': { 'Vaccine': 1.2, 'Data': 1, 'Virus': 0.8 },
  'Virus': { 'Vaccine': 0.8, 'Data': 1.2, 'Virus': 1 }
};

function getSpecialtyBonus(techSpecialty: string, defenderSpecialty: string): number {
  // None specialty always returns 1
  if (techSpecialty === 'None' || defenderSpecialty === 'None') return 1;

  const specialtyMap = SPECIALTY_BONUS_MATRIX[techSpecialty];
  if (!specialtyMap) return 1;

  return specialtyMap[defenderSpecialty] || 1;
}

export function getTypeBonus(attackerType: string, defenderType: string): number {
  const typeMap = TYPE_BONUS_MATRIX[attackerType];
  if (!typeMap) return 1;

  return typeMap[defenderType] || 1;
}

function getTileBonus(techSpecialty: string, floorSpecialty: string): number {
  if (techSpecialty === 'None') return 1;
  return techSpecialty.toLowerCase() === floorSpecialty.toLowerCase() ? 1.2 : 1;
}

function getDefenderBonus(defenderSpecialty: string, floorSpecialty: string): number {
  if (defenderSpecialty === 'None') return 1;
  return defenderSpecialty.toLowerCase() === floorSpecialty.toLowerCase() ? 1.2 : 1;
}

export function calculateLegacyDamage(
  attacker: BattleCombatantState,
  defender: BattleCombatantState,
  tech: Tech,
  floorSpecialty: string,
  apRatio: readonly [number, number] = [1, 1]
): number {
  const typeBonus = getTypeBonus(attacker.type, defender.type);
  const specialtyBonus = getSpecialtyBonus(tech.element, defender.specialty);

  // Handle special effects that modify AP
  let attackPower = tech.ap;

  // Legacy consecutive-use bonus, including the unvalidated +25 cap.
  if (tech.specialEffect?.type === 'consecutiveApIncrease' && attacker.legacy.lastTechUsed === tech.name && attacker.legacy.consecutiveTechCount) {
    const bonus = Math.min((attacker.legacy.consecutiveTechCount || 0) * (tech.specialEffect.value || 2.5), 25);
    attackPower += bonus;
  }

  const tileBonus = getTileBonus(tech.element, floorSpecialty);

  // Apply debuffs to stats
  const attack = effectiveParameter(attacker, 'atk');
  const defense = effectiveParameter(defender, 'def');
  const defenderBonus = getDefenderBonus(defender.specialty, floorSpecialty);

  const baseDamage = Math.floor(attackPower * apRatio[0] * Math.round(typeBonus * 5) * Math.round(specialtyBonus * 5) * Math.round(tileBonus * 5) / (125 * apRatio[1]));
  const adjustedDefense = Math.floor(defense * defenderBonus);
  const finalDamage = Math.floor((baseDamage * attack) / adjustedDefense);

  if (![attackPower, attack, defense, baseDamage, adjustedDefense, finalDamage].every(Number.isFinite) || adjustedDefense <= 0 || finalDamage < 0) throw new BattleInputError('Invalid damage arithmetic or effective DEF.');
  return finalDamage;
}

/** Counter descriptors modify damage output, not AP. Floor base formula first,
 * then each documented output multiplier; causal return replaces base damage.
 * Poison is added by the status resolver after this function. */
export function calculateActionDamage(attacker: BattleCombatantState, defender: BattleCombatantState, action: PlannedAction, floorSpecialty: string, state?: BattleState): number {
  const canonical = counterDefinition(action);
  const tech = (action.kind === 'counter' || action.kind === 'interrupt') && canonical?.attackPower !== null && canonical?.attackPower !== undefined
    ? { ...action.skill.legacyTech, ap: canonical.attackPower, specialEffect: undefined } : action.skill.legacyTech;
  const waitingCounter = state?.plannedActions.find(a => a.id === defender.plannedActionId)?.counter?.executionMode === 'waiting';
  let numerator = 1, denominator = 1;
  for (const effect of canonical?.effects ?? []) if (effect.kind === 'damage-modifier' && (effect.condition === 'user-poisoned' && attacker.statuses.poison || effect.condition === 'target-countering' && waitingCounter)) { numerator *= 3; denominator *= 2; }
  const element = action.effectiveElement ?? attacker.elementalPower;
  let damage = calculateLegacyDamage(attacker, defender, element ? { ...tech, element: element === 'Darkness' ? 'Dark' : element === 'Neutral' ? 'None' : element } : tech, floorSpecialty, [numerator, denominator]);
  if (usesActivatedCounterMechanics(action)) for (const effect of canonical?.effects ?? []) {
    if (effect.kind !== 'damage-modifier' || effect.condition !== 'counter-triggered') continue;
    damage = Math.floor((effect.modifier === 'returned-damage' ? action.counter!.damageReceivedFromTrigger! : damage) * effect.multiplier);
  }
  const targetAction = state?.plannedActions.find(a => a.id === defender.plannedActionId);
  const targetInterrupting = targetAction?.interrupt?.state === 'waiting' || targetAction?.interrupt?.state === 'executing';
  const targetCountering = targetAction?.counter?.executionMode === 'waiting';
  for (const effect of canonical?.effects ?? []) {
    if (effect.kind !== 'damage-modifier' || effect.modifier !== 'multiplier') continue;
    const applies = effect.condition === 'target-interrupting' && targetInterrupting
      || effect.condition === 'target-countering-or-interrupting' && (targetCountering || targetInterrupting)
      || effect.condition === 'user-interrupted' && !!action.prepared?.interruptedByActionId;
    if (applies) damage = Math.floor(damage * effect.multiplier);
  }
  if (!Number.isFinite(damage) || damage < 0) throw new BattleInputError('Invalid Counter damage arithmetic.');
  return damage;
}
