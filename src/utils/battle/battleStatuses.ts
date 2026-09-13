import { getStatusImmunity } from './battleImmunity';
import { getBattleSkillById } from '@/data/battleSkills';
import type { SkillEffectDefinition } from '@/types/battleSkill';
import type { BattleCombatantState, BattleSkillSelection } from './battleTypes';
import type { BattleRng } from './battleRng';

export type BattleStatus = 'poison' | 'paralysis' | 'confusion';
export type StatusSnapshot = Record<BattleStatus, boolean>;
export interface StatusRecoveryResult { status: 'paralysis' | 'confusion'; roll: number; recovered: boolean }
export interface StatusApplicationResult { status: BattleStatus; roll: number | null; successesOutOf3: 1 | 2 | null; condition?: 'counter-activated' | 'interrupt-hit'; immunityReason?: 'boss' | 'enemy'; result?: 'immune'; applied: boolean; alreadyActive: boolean }
export const statusSnapshot = (actor: BattleCombatantState): StatusSnapshot => ({ poison: !!actor.statuses.poison, paralysis: !!actor.statuses.paralysis, confusion: !!actor.statuses.confusion });
export function recoverStatuses(actor: BattleCombatantState, rng: BattleRng): StatusRecoveryResult[] {
  const results: StatusRecoveryResult[] = [];
  for (const status of ['paralysis', 'confusion'] as const) if (actor.statuses[status]) {
    const roll = rng.nextIntExclusive(4, `status-recovery-${status}`);
    if (roll === 0) delete actor.statuses[status];
    results.push({ status, roll, recovered: roll === 0 });
  }
  return results;
}
export function isDirectBattleStatus(effect: SkillEffectDefinition): boolean {
  return effect.kind === 'status-application' && effect.condition === 'always'
    && ['poison', 'paralysis', 'confusion'].includes(effect.status) && [33, 66].includes(effect.chancePercent ?? -1);
}
export function applyDirectStatuses(target: BattleCombatantState, effects: readonly SkillEffectDefinition[], rng: BattleRng): StatusApplicationResult[] {
  const results: StatusApplicationResult[] = [];
  for (const status of ['poison', 'paralysis', 'confusion'] as const) for (const effect of effects) {
    if (!isDirectBattleStatus(effect) || effect.kind !== 'status-application' || effect.status !== status) continue;
    const successesOutOf3 = effect.chancePercent === 33 ? 1 : 2;
    const roll = rng.nextIntExclusive(3, `status-apply-${status}`);
    const immunityReason = getStatusImmunity(target, status);
    const alreadyActive = !!target.statuses[status], applied = roll < successesOutOf3 && !immunityReason;
    if (applied) target.statuses[status] = true;
    results.push({ status, roll, successesOutOf3, applied, alreadyActive, ...(immunityReason ? { immunityReason, result: 'immune' as const } : {}) });
  }
  return results;
}
export function resolveImpactStatuses(target: BattleCombatantState, skill: BattleSkillSelection, baseDamage: number, rng: BattleRng, activatedCounter = false, interruptHit = false) {
  const wasPoisoned = !!target.statuses.poison;
  const canonical = skill.canonicalSkillId === null ? undefined : getBattleSkillById(skill.canonicalSkillId);
  const statusApplications = applyDirectStatuses(target, canonical?.effects ?? [], rng);
  if (activatedCounter || interruptHit) for (const effect of canonical?.effects ?? []) {
    if (effect.kind !== 'status-application' || effect.condition !== (interruptHit ? 'interrupt-triggered' : 'counter-triggered') || effect.chancePercent !== 100) continue;
    if (effect.status !== 'poison' && effect.status !== 'paralysis' && effect.status !== 'confusion') continue;
    const alreadyActive = !!target.statuses[effect.status];
    const immunityReason = getStatusImmunity(target, effect.status);
    if (!immunityReason) target.statuses[effect.status] = true;
    statusApplications.push({ status: effect.status, roll: null, successesOutOf3: null, condition: interruptHit ? 'interrupt-hit' : 'counter-activated', applied: !immunityReason, alreadyActive, ...(immunityReason ? { immunityReason, result: 'immune' as const } : {}) });
  }
  const poisonBonusDamage = wasPoisoned || statusApplications.some(s => s.status === 'poison' && s.applied) ? 10 : 0;
  return { statusApplications, poisonBonusDamage, damage: baseDamage + poisonBonusDamage };
}
