import { getBattleSkillById } from '@/data/battleSkills';
import type { ActionPolicy, BattleCombatantState, BattleSkillSelection, BattleState, PlannedAction, TargetIntent } from './battleTypes';
import { BattleInputError } from './battleTypes';
import { createBattleRng, type BattleRng } from './battleRng';

export interface ConfusionResolution {
  active: boolean; redirected: boolean; skipped: boolean;
  plannedSkillKey: string; selectedSkillKey: string | null; eligibleSkillKeys: string[];
  originalTargetIntent: TargetIntent;
}
export function isConfusionUsableSkill(skill: BattleSkillSelection): boolean {
  const canonical = skill.canonicalSkillId === null ? undefined : getBattleSkillById(skill.canonicalSkillId);
  return canonical?.actionKind === 'attack' && (canonical.animationKind === 'projectile' || canonical.animationKind === 'magic') && skill.legacyTech.ap > 0;
}
/** Execution-time finalization, including statuses acquired earlier in this round. */
export function prepareConfusionAction(state: BattleState, actor: BattleCombatantState, action: PlannedAction, policy: ActionPolicy, rng: BattleRng): ConfusionResolution {
  const audit: ConfusionResolution = { active: !!actor.statuses.confusion, redirected: false, skipped: false,
    plannedSkillKey: action.skill.key, selectedSkillKey: action.skill.key, eligibleSkillKeys: [], originalTargetIntent: structuredClone(action.targetIntent) };
  if (!audit.active || action.kind === 'assist' || action.kind === 'interrupt' || actor.confusionSuppressedForActionId === action.id) return audit;
  const eligible = actor.skills.filter(isConfusionUsableSkill);
  audit.eligibleSkillKeys = eligible.map(s => s.key);
  if (action.chainFromActionId) {
    audit.skipped = !isConfusionUsableSkill(action.skill);
    if (audit.skipped) audit.selectedSkillKey = null;
    return audit;
  }
  if (!eligible.length) { audit.skipped = true; audit.selectedSkillKey = null; return audit; }
  const choice = policy.chooseAction({ ...actor, skills: eligible }, { round: state.round, combatants: state.combatants },
    createBattleRng(() => rng.nextFloat('confusion-action-choice')));
  if (choice.kind !== 'skill') throw new BattleInputError('Guard is excluded.', 'unsupported');
  const skill = eligible.find(s => s.key === choice.skillKey);
  if (!skill) throw new BattleInputError('Confusion policy selected an ineligible skill.', 'unsupported');
  action.skill = skill; action.kind = skill.kind;
  action.targetIntent = { kind: 'opponents', side: actor.side, selection: skill.legacyTech.target === 'All' ? 'all' : 'random-at-execution' };
  audit.selectedSkillKey = skill.key; audit.redirected = true;
  return audit;
}
