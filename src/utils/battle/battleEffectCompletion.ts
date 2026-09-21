import { getBattleSkillById } from '@/data/battleSkills';
import type { BattleCombatantState, BattleSkillSelection, BattleState, PlannedAction } from './battleTypes';
import type { BattleRng } from './battleRng';
import { getStatusImmunity } from './battleImmunity';

export const effectsOf = (skill: BattleSkillSelection) => getBattleSkillById(skill.canonicalSkillId ?? -1)?.effects ?? [];
export const MOTIVATION_GUARD: BattleSkillSelection = { key: 'motivation-guard', canonicalSkillId: null, kind: 'assist', source: 'motivation-guard', legacyTech: { id: 'motivation-guard', name: 'Guard — Motivation Down', ap: 0, element: 'None', target: 'Single', isCounter: false } };
export const mustGuard = (actor: BattleCombatantState) => actor.side === 'player' && !!actor.statuses['motivation-down'] && actor.skills.length > 0 && actor.skills.every(s=>actor.motivationBlocked?.includes(s.key));
export const randomTarget = (skill: BattleSkillSelection) => effectsOf(skill).some(e => e.kind === 'target-mode-modifier' && e.mode === 'random-digimon');
export const necroTarget = (skill: BattleSkillSelection) => effectsOf(skill).some(e => e.kind === 'drain' && e.mode === 'dead-target-remaining-mp');
export const fullMpRequired = (skill: BattleSkillSelection) => effectsOf(skill).some(e => e.kind === 'drain' && e.mode === 'interrupted-tech-cost');
export const canPayRequiredMp = (actor: BattleCombatantState, skill: BattleSkillSelection) => !fullMpRequired(skill) || actor.currentMp >= getBattleSkillById(skill.canonicalSkillId!)!.mpCost;
export const bypassAccuracy = (skill: BattleSkillSelection) => skill.canonicalSkillId === 0x66 || effectsOf(skill).some(e => e.kind === 'accuracy-modifier' && e.modifier === 'cannot-miss');
export const counterCostTransfer = (skill: BattleSkillSelection) => skill.canonicalSkillId === 0x89 && effectsOf(skill).some(e => e.byte === 22 && e.mask === 1);
/** Reviewed non-stacking post-use half DEF, cleared at the round boundary. */
export const postUseHalfDefense = (skill: BattleSkillSelection) => effectsOf(skill).some(e => e.byte === 17 && e.mask === 0x40
  || skill.canonicalSkillId === 0x3d && e.byte === 31 && e.mask === 4);

/** Selection happens only on application/initialization, never during a legality query. */
export function initializeMotivation(actor: BattleCombatantState, rng: BattleRng): void {
  if (!actor.statuses['motivation-down']) { delete actor.motivationBlocked; return; }
  if (actor.side === 'enemy') { delete actor.statuses['motivation-down']; delete actor.motivationBlocked; return; }
  if (actor.motivationBlocked) return;
  const byCost = [...actor.skills].sort((a,b) => (getBattleSkillById(b.canonicalSkillId ?? -1)?.mpCost ?? 0) - (getBattleSkillById(a.canonicalSkillId ?? -1)?.mpCost ?? 0));
  const blocked: string[] = [];
  while (byCost.length && blocked.length < 2) {
    const cost = getBattleSkillById(byCost[0].canonicalSkillId ?? -1)?.mpCost ?? 0;
    const tied = byCost.filter(s => (getBattleSkillById(s.canonicalSkillId ?? -1)?.mpCost ?? 0) === cost);
    const remaining = 2 - blocked.length;
    if (tied.length <= remaining) {
      blocked.push(...tied.map(s=>s.key)); byCost.splice(0,tied.length);
    } else {
      while (blocked.length < 2) blocked.push(tied.splice(rng.nextIntExclusive(tied.length,'motivation-blocked-choice'),1)[0].key);
    }
  }
  actor.motivationBlocked = blocked;
}

export function copyNegativeStatuses(actor: BattleCombatantState, target: BattleCombatantState, rng: BattleRng): string[] {
  const copied: string[] = [];
  for (const status of ['poison','paralysis','confusion','motivation-down'] as const) {
    if (!actor.statuses[status] || getStatusImmunity(target,status)) continue;
    target.statuses[status] = true; copied.push(status);
  }
  for (const status of ['hpRecoveryBlocked','statusRecoveryBlocked'] as const) if (actor[status]) { target[status]=true; copied.push(status); }
  initializeMotivation(target,rng);
  return copied;
}
export function clearRoundEffects(state: BattleState): void {
  for (const actor of state.combatants) {
    actor.parametersSuppressed = false;
    delete actor.hpRecoveryBlocked; delete actor.statusRecoveryBlocked; delete actor.halfDefense;
  }
}
export function resolvePolicyTarget(state: BattleState, action: PlannedAction, rng: BattleRng): string[] | null {
  const actor = state.combatants.find(a=>a.id===action.actorId)!;
  if (necroTarget(action.skill)) {
    const candidates = state.combatants.filter(a=>a.currentHp===0 && a.currentMp>0);
    return candidates.length ? [candidates[rng.nextIntExclusive(candidates.length,'necro-ko-target')].id] : [];
  }
  if (action.skill.canonicalSkillId === 0x4d && actor.side === 'enemy') {
    const candidates = state.combatants.filter(a=>a.side==='player' && a.currentHp>0);
    const min = Math.min(...candidates.map(a=>a.currentHp));
    const tied = candidates.filter(a=>a.currentHp===min);
    return tied.length ? [tied[tied.length===1 ? 0 : rng.nextIntExclusive(tied.length,'shadow-scythe-hp-tie')].id] : [];
  }
  if (!randomTarget(action.skill)) return null;
  if (action.counter) action.counter.targetRule = 'random-policy';
  const group = getBattleSkillById(action.skill.canonicalSkillId!)!.targetGroup;
  const candidates = state.combatants.filter(a=>a.isAlive && (group==='field' || group==='self' ? group==='field' || a.id===actor.id : group==='one-ally' || group==='all-allies' ? a.side===actor.side : a.side!==actor.side));
  return candidates.length ? [candidates[rng.nextIntExclusive(candidates.length,'random-digimon-target')].id] : [];
}
