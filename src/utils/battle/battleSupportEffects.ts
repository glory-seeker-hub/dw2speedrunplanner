import { necroTarget, resolvePolicyTarget } from './battleEffectCompletion';
import { getBattleSkillById } from '@/data/battleSkills';
import type { Ailment, SkillElement } from '@/types/battleSkill';
import type { BattleCombatantState, BattleSkillSelection, BattleState, PlannedAction } from './battleTypes';
import type { BattleRng } from './battleRng';

export type SupportEvent =
  | { kind: 'healing'; targetId: string; mode: 'fixed' | 'full' | 'revive-full'; requestedAmount: number; hpBefore: number; hpAfter: number; appliedAmount: number; revived: boolean }
  | { kind: 'stage'; targetId: string; stat: 'atk' | 'def' | 'spd'; before: number; delta: -1 | 1; after: number; effectiveSuppressed: boolean }
  | { kind: 'parameter-suppression'; targetId: string; round: number }
  | { kind: 'cure'; targetId: string; status: Ailment; before: boolean; after: false }
  | { kind: 'temporary-state'; targetId: string; state: string; before: boolean | SkillElement | null; after: boolean | SkillElement; sourceSkillId: number | null }
  | { kind: 'poison-body'; targetId: string; holderId: string; alreadyActive: boolean };
export const FIXED_HEALS: Readonly<Record<number, number>> = Object.freeze({ 0xbc: 50, 0xb5: 150, 0xcb: 150 });
export const REVIVE_IDS = [0xb7, 0xce] as const;
export const isRevive = (skill: BattleSkillSelection) => REVIVE_IDS.some(id => id === skill.canonicalSkillId);
const definition = (skill: BattleSkillSelection) => getBattleSkillById(skill.canonicalSkillId ?? -1);
/** Only these reviewed Assists require an opposing attribute; do not generalize future effects. */
export const isAttributeRestrictedAssist = (skill: BattleSkillSelection) => [0xb4, 0xb6, 0xd6].includes(skill.canonicalSkillId ?? -1);
export const isHealing = (skill: BattleSkillSelection) => FIXED_HEALS[skill.canonicalSkillId ?? -1] !== undefined || definition(skill)?.effects.some(e => e.kind === 'recovery' && e.mode === 'full-heal');
const cures = (skill: BattleSkillSelection): Ailment[] => (definition(skill)?.effects ?? []).flatMap(e => e.kind === 'status-cure' ? [e.status] : []);
export function assistEligible(actor: Readonly<BattleCombatantState>, skill: BattleSkillSelection, combatants: readonly BattleCombatantState[]): boolean {
  if (necroTarget(skill)) return combatants.some(a => a.currentHp === 0 && a.currentMp > 0);
  if (isAttributeRestrictedAssist(skill)) return (definition(skill)?.effects ?? []).some(effect =>
    effect.kind === 'parameter-modifier' && effect.subject === 'target' && effect.attribute !== undefined
    && combatants.some(target => target.side !== actor.side && target.currentHp > 0 && target.type === effect.attribute));
  const allies = combatants.filter(a => a.side === actor.side);
  if (isRevive(skill)) return allies.some(a => a.currentHp === 0 && a.maxHp > 0);
  if (isHealing(skill)) return actor.side === 'player' || allies.some(a => a.currentHp === 0 || a.currentHp / a.maxHp < 0.1);
  const statuses = cures(skill);
  if (statuses.length) return allies.some(a => statuses.some(s => a.statuses[s]));
  return true;
}
/** Single support locks are chosen before ordinary execution. Lowest HP ties use party position (simulator policy). */
export function assistCandidateIds(state: BattleState, action: PlannedAction): string[] {
  const actor = state.combatants.find(a => a.id === action.actorId)!;
  const skill = definition(action.skill), group = skill?.targetGroup;
  if (!skill) return [];
  let candidates = state.combatants.filter(a => group === 'field' || (group === 'one-enemy' || group === 'all-enemies' ? a.side !== actor.side : a.side === actor.side));
  if (group === 'self') candidates = [actor];
  candidates = candidates.filter(a => isRevive(action.skill) ? a.currentHp === 0 && a.maxHp > 0 : a.currentHp > 0);
  const statuses = cures(action.skill);
  if (statuses.length) candidates = candidates.filter(a => statuses.some(s => a.statuses[s]));
  if (action.targetIntent.kind === 'combatants') {
    const ids = action.targetIntent.targetIds;
    candidates = candidates.filter(a => ids.includes(a.id));
  }
  if (isHealing(action.skill) && !isRevive(action.skill)) candidates.sort((a, b) => a.currentHp - b.currentHp || a.position - b.position);
  return candidates.map(a => a.id);
}
export function chooseAssistTargets(state: BattleState, action: PlannedAction, rng: BattleRng): string[] {
  const group = definition(action.skill)?.targetGroup;
  const candidates = action.assistCandidateIds ?? assistCandidateIds(state, action);
  if (group === 'field' || group === 'all-allies' || group === 'all-enemies' || group === 'self') return candidates;
  if (!candidates.length) return [];
  if (candidates.length === 1 || isHealing(action.skill) && !isRevive(action.skill)) return [candidates[0]];
  return [candidates[rng.nextIntExclusive(candidates.length, isRevive(action.skill) ? 'revive-target-choice' : cures(action.skill).length ? 'assist-status-cure-target' : 'assist-target-choice')]];
}
export function assistTargetsAtExecution(state: BattleState, action: PlannedAction, rng: BattleRng): string[] {
  if (necroTarget(action.skill)) return resolvePolicyTarget(state, action, rng)!;
  const group = definition(action.skill)?.targetGroup;
  if (group === 'field' || group === 'all-allies' || group === 'all-enemies') {
    // AOE uses the living recipients at execution, never a stale party-size measurement.
    const actor = state.combatants.find(a => a.id === action.actorId)!;
    return state.combatants.filter(a => a.currentHp > 0 && (group === 'field' || (group === 'all-allies' ? a.side === actor.side : a.side !== actor.side))).map(a => a.id);
  }
  return action.assistTargetIds ?? chooseAssistTargets(state, action, rng);
}
export function applySupportEffects(state: BattleState, actor: BattleCombatantState, target: BattleCombatantState, action: PlannedAction, phase: 'pre-damage' | 'after-damage'): SupportEvent[] {
  const events: SupportEvent[] = [], skill = definition(action.skill);
  if (!skill) return events;
  const addStage = (recipient: BattleCombatantState, stat: 'atk' | 'def' | 'spd', delta: -1 | 1) => {
    const key = `${stat}Stage` as const, before = recipient[key], after = Math.max(-2, Math.min(2, before + delta));
    recipient[key] = after; events.push({ kind: 'stage', targetId: recipient.id, stat, before, delta, after, effectiveSuppressed: recipient.parametersSuppressed });
  };
  for (const effect of skill.effects) {
    if (effect.kind !== 'parameter-modifier' || effect.duration || effect.multiplier !== undefined) continue;
    const recipient = effect.subject === 'user' ? actor : target;
    if (effect.attribute && recipient.type !== effect.attribute) continue;
    for (const stat of effect.stats) {
      const pre = stat === 'def' && effect.direction === 'down';
      if (pre === (phase === 'pre-damage')) addStage(recipient, stat, effect.direction === 'up' ? 1 : -1);
    }
  }
  if (phase === 'pre-damage') return events;
  if (skill.effects.some(e => e.kind === 'action-protection' && e.scope === 'turn' && e.against === 'counter')) {
    const waiting = state.plannedActions.find(a => a.id === target.plannedActionId && a.round === state.round);
    if (waiting?.counter?.executionMode === 'waiting' && waiting.state === 'waiting') {
      waiting.counter.executionMode = 'prevented';
      waiting.counter.activatedMechanics = false;
      events.push({ kind: 'temporary-state', targetId: target.id, state: 'counter-prevented', before: false, after: true, sourceSkillId: skill.id });
    }
  }
  if ([0xbe, 0xe3, 0xcc, 0xc6, 0xd4].includes(skill.id)) {
    target.parametersSuppressed = true; events.push({ kind: 'parameter-suppression', targetId: target.id, round: state.round });
  }
  if (action.kind === 'assist' && (isRevive(action.skill) || isHealing(action.skill))) {
    const hpBefore = target.currentHp, revive = isRevive(action.skill), fixed = FIXED_HEALS[skill.id];
    const requestedAmount = revive || fixed === undefined ? target.maxHp : fixed;
    const revived = revive && hpBefore === 0;
    if (revived || (!revive && hpBefore > 0 && !(fixed !== undefined && target.hpRecoveryBlocked))) target.currentHp = Math.min(target.maxHp, revive || fixed === undefined ? target.maxHp : hpBefore + fixed);
    if (revived) { target.isAlive = true; target.revivedRound = state.round; }
    events.push({ kind: 'healing', targetId: target.id, mode: revive ? 'revive-full' : fixed === undefined ? 'full' : 'fixed', requestedAmount, hpBefore, hpAfter: target.currentHp, appliedAmount: target.currentHp - hpBefore, revived });
    // A second locked revive is an executed no-op, including its secondary states.
    if (revive && !revived) return events;
  }
  for (const effect of skill.effects) {
    if (effect.kind === 'recovery-restriction') {
      const key = effect.resource === 'hp' ? 'hpRecoveryBlocked' : 'statusRecoveryBlocked';
      const before = !!target[key]; target[key] = true;
      events.push({ kind: 'temporary-state', targetId: target.id, state: effect.resource + '-recovery-block', before, after: true, sourceSkillId: skill.id });
    }
    if (effect.kind === 'status-cure' && !target.statusRecoveryBlocked) {
      const before = !!target.statuses[effect.status]; delete target.statuses[effect.status];
      if (effect.status === 'motivation-down') delete target.motivationBlocked;
      events.push({ kind: 'cure', targetId: target.id, status: effect.status, before, after: false });
    }
    if (effect.kind === 'temporary-attack-power') {
      const power = effect.power;
      if (power === 'poison' || power === 'paralysis' || power === 'confusion') {
        const before = !!target.temporaryPowers[power]; target.temporaryPowers[power] = true;
        events.push({ kind: 'temporary-state', targetId: target.id, state: power + '-power', before, after: true, sourceSkillId: skill.id });
      } else {
        const before = target.elementalPower; target.elementalPower = power;
        events.push({ kind: 'temporary-state', targetId: target.id, state: 'elemental-power', before, after: power, sourceSkillId: skill.id });
      }
    }
    const temporary = effect.kind === 'special-state' && effect.state !== 'zombie' ? effect.state
      : effect.kind === 'status-application' && effect.status === 'poison-body' && effect.condition === 'always' ? 'poison-body' : null;
    if (temporary) {
      const before = !!target.statuses[temporary]; target.statuses[temporary] = true;
      events.push({ kind: 'temporary-state', targetId: target.id, state: temporary, before, after: true, sourceSkillId: skill.id });
    }
  }
  return events;
}
