import { initializeMotivation } from './battleEffectCompletion';
import { resolveDirectStatusApplication, resolveNaturalStatusRecovery, type BattleRngPolicy, type RngResolution } from './battleRngPolicy';
import { getStatusImmunity } from './battleImmunity';
import { getBattleSkillById } from '@/data/battleSkills';
import type { SkillEffectDefinition } from '@/types/battleSkill';
import type { BattleCombatantState, BattleSkillSelection } from './battleTypes';
import type { BattleRng } from './battleRng';

export type BattleStatus = 'poison' | 'paralysis' | 'confusion' | 'motivation-down';
export type RecoverableState = 'motivation-down' | 'paralysis' | 'confusion' | 'poison-body' | 'poison-power' | 'paralysis-power' | 'confusion-power' | 'elemental-power' | 'invincibility' | 'invisibility';
export const RECOVERY_ORDER: readonly RecoverableState[] = ['paralysis', 'confusion', 'motivation-down', 'poison-body', 'poison-power', 'paralysis-power', 'confusion-power', 'elemental-power', 'invincibility', 'invisibility'];
export type StatusSnapshot = Record<'poison' | 'paralysis' | 'confusion', boolean> & Partial<Record<RecoverableState, boolean>>;
export interface StatusRecoveryResult { status: RecoverableState; roll: number | null; recovered: boolean; rngResolution?: RngResolution }
export interface StatusApplicationResult { rngResolution?: RngResolution; status: BattleStatus; roll: number | null; successesOutOf3: 1 | 2 | null; condition?: 'counter-activated' | 'interrupt-hit' | 'poison-power' | 'paralysis-power' | 'confusion-power'; immunityReason?: 'boss' | 'enemy'; result?: 'immune'; applied: boolean; alreadyActive: boolean }
export const statusSnapshot = (actor: BattleCombatantState): StatusSnapshot => {
  const snapshot: StatusSnapshot = { poison: !!actor.statuses.poison, paralysis: !!actor.statuses.paralysis, confusion: !!actor.statuses.confusion };
  for (const status of ['poison-body', 'invincibility', 'invisibility'] as const) if (actor.statuses[status]) snapshot[status] = true;
  for (const power of ['poison', 'paralysis', 'confusion'] as const) if (actor.temporaryPowers[power]) snapshot[`${power}-power`] = true;
  if (actor.elementalPower) snapshot['elemental-power'] = true;
  if (actor.statuses['motivation-down']) snapshot['motivation-down'] = true;
  return snapshot;
};
export function recoverStatuses(actor: BattleCombatantState, rng: BattleRng, policy: BattleRngPolicy = 'natural'): StatusRecoveryResult[] {
  const results: StatusRecoveryResult[] = [];
  if (actor.statusRecoveryBlocked) return results;
  for (const status of RECOVERY_ORDER) {
    const power = status === 'poison-power' ? 'poison' : status === 'paralysis-power' ? 'paralysis' : status === 'confusion-power' ? 'confusion' : null;
    const active = power ? actor.temporaryPowers[power] : status === 'elemental-power' ? actor.elementalPower : actor.statuses[status as 'paralysis'];
    if (!active) continue;
    const resolved = resolveNaturalStatusRecovery(policy, actor.side, status, rng);
    const { roll } = resolved;
    if (resolved.succeeds) { if (power) delete actor.temporaryPowers[power]; else if (status === 'elemental-power') actor.elementalPower = null; else delete actor.statuses[status as 'paralysis']; }
    if (status === 'motivation-down' && resolved.succeeds) delete actor.motivationBlocked;
    results.push({ status, roll, recovered: resolved.succeeds, ...(resolved.rngResolution ? { rngResolution: resolved.rngResolution } : {}) });
  }
  return results;
}
export function isDirectBattleStatus(effect: SkillEffectDefinition): boolean {
  return effect.kind === 'status-application' && effect.condition === 'always'
    && ['poison', 'paralysis', 'confusion', 'motivation-down'].includes(effect.status)
    && ([33, 66].includes(effect.chancePercent ?? -1)
      || (effect.status === 'motivation-down' && (effect.chancePercent === undefined || effect.chancePercent === 100)));
}
export function applyDirectStatuses(target: BattleCombatantState, effects: readonly SkillEffectDefinition[], rng: BattleRng, policy: BattleRngPolicy = 'natural'): StatusApplicationResult[] {
  const results: StatusApplicationResult[] = [];
  for (const status of ['poison', 'paralysis', 'confusion', 'motivation-down'] as const) for (const effect of effects) {
    if (!isDirectBattleStatus(effect) || effect.kind !== 'status-application' || effect.status !== status) continue;
    // Project-confirmed native Motivation Down rate: guaranteed on Hit. Keep raw source data intact.
    const guaranteed = status === 'motivation-down' && (effect.chancePercent === undefined || effect.chancePercent === 100);
    const successesOutOf3 = guaranteed ? null : effect.chancePercent === 33 ? 1 : 2;
    const resolved = successesOutOf3 === null ? { roll: null, succeeds: true }
      : resolveDirectStatusApplication(policy, target.side, status, successesOutOf3, rng);
    const { roll } = resolved;
    const immunityReason = getStatusImmunity(target, status);
    const alreadyActive = !!target.statuses[status], applied = resolved.succeeds && !immunityReason;
    if (applied) target.statuses[status] = true;
    if (applied && status === 'motivation-down') initializeMotivation(target,rng);
    results.push({ status, roll, successesOutOf3, applied, alreadyActive, ...(resolved.rngResolution ? { rngResolution: resolved.rngResolution } : {}), ...(immunityReason ? { immunityReason, result: 'immune' as const } : {}) });
  }
  return results;
}
export function resolveImpactStatuses(target: BattleCombatantState, skill: BattleSkillSelection, baseDamage: number, rng: BattleRng, activatedCounter = false, interruptHit = false, attacker?: BattleCombatantState, policy: BattleRngPolicy = 'natural') {
  const wasPoisoned = !!target.statuses.poison;
  const canonical = skill.canonicalSkillId === null ? undefined : getBattleSkillById(skill.canonicalSkillId);
  const statusApplications = applyDirectStatuses(target, canonical?.effects ?? [], rng, policy);
  if (activatedCounter || interruptHit) for (const effect of canonical?.effects ?? []) {
    if (effect.kind !== 'status-application' || effect.condition !== (interruptHit ? 'interrupt-triggered' : 'counter-triggered') || effect.chancePercent !== 100) continue;
    if (effect.status !== 'poison' && effect.status !== 'paralysis' && effect.status !== 'confusion') continue;
    const alreadyActive = !!target.statuses[effect.status];
    const immunityReason = getStatusImmunity(target, effect.status);
    if (!immunityReason) target.statuses[effect.status] = true;
    statusApplications.push({ status: effect.status, roll: null, successesOutOf3: null, condition: interruptHit ? 'interrupt-hit' : 'counter-activated', applied: !immunityReason, alreadyActive, ...(immunityReason ? { immunityReason, result: 'immune' as const } : {}) });
  }
  for (const status of ['poison', 'paralysis', 'confusion'] as const) if (attacker?.temporaryPowers[status]) {
    const alreadyActive = !!target.statuses[status], immunityReason = getStatusImmunity(target, status);
    if (!immunityReason) target.statuses[status] = true;
    statusApplications.push({ status, roll: null, successesOutOf3: null, condition: `${status}-power`, applied: !immunityReason, alreadyActive, ...(immunityReason ? { immunityReason, result: 'immune' as const } : {}) });
  }
  const poisonBonusDamage = wasPoisoned || statusApplications.some(s => s.status === 'poison' && s.applied) ? 10 : 0;
  return { statusApplications, poisonBonusDamage, damage: baseDamage + poisonBonusDamage };
}
