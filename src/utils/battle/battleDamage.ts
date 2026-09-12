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

function getTypeBonus(attackerType: string, defenderType: string): number {
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
  isCounterAttack: boolean = false
): number {
  const typeBonus = getTypeBonus(attacker.type, defender.type);
  const specialtyBonus = getSpecialtyBonus(tech.element, defender.specialty);

  // Handle special effects that modify AP
  let attackPower = tech.ap;

  // Legacy returned-damage approximation.
  if (isCounterAttack && tech.specialEffect?.type === 'counterDamageMultiplier' && attacker.legacy.damageTakenThisTurn) {
    const returned = Math.floor(attacker.legacy.damageTakenThisTurn * (tech.specialEffect.value || 1.5));
    if (!Number.isFinite(returned) || returned < 0) throw new BattleInputError('Invalid returned-damage arithmetic.');
    return returned;
  }

  // Counter AP multiplier effects
  if (isCounterAttack && (tech.specialEffect?.type === 'counterApMultiplier' || tech.specialEffect?.type === 'counterApMultiplierAndTargetAll')) {
    attackPower *= (tech.specialEffect.value || 1.5);
  }

  // Legacy consecutive-use bonus, including the unvalidated +25 cap.
  if (tech.specialEffect?.type === 'consecutiveApIncrease' && attacker.legacy.lastTechUsed === tech.name && attacker.legacy.consecutiveTechCount) {
    const bonus = Math.min((attacker.legacy.consecutiveTechCount || 0) * (tech.specialEffect.value || 2.5), 25);
    attackPower += bonus;
  }

  const tileBonus = getTileBonus(tech.element, floorSpecialty);

  // Apply debuffs to stats
  const attack = attacker.baseStats.atk * (attacker.parameterModifiers?.atk || 1);
  const defense = defender.baseStats.def * (defender.parameterModifiers?.def || 1);
  const defenderBonus = getDefenderBonus(defender.specialty, floorSpecialty);

  const baseDamage = Math.floor(typeBonus * specialtyBonus * attackPower * tileBonus);
  const adjustedDefense = Math.floor(defense * defenderBonus);
  const finalDamage = Math.floor((baseDamage * attack) / adjustedDefense);

  if (![attackPower, attack, defense, baseDamage, adjustedDefense, finalDamage].every(Number.isFinite) || adjustedDefense <= 0 || finalDamage < 0) throw new BattleInputError('Invalid damage arithmetic or effective DEF.');
  return finalDamage;
}
