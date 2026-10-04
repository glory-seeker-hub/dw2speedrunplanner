import { getBattleSkillById } from '@/data/battleSkills';
import { MOTIVATION_GUARD, randomTarget, necroTarget } from './battleEffectCompletion';
import { selectableSingleOpponents } from './battleTargets';
import type { BattleCombatantState, BattleSkillSelection, TargetIntent } from './battleTypes';

export const playerControlsReactionTarget = (skill: BattleSkillSelection) => !randomTarget(skill) && !necroTarget(skill)
  && (skill.kind === 'interrupt' || skill.kind === 'counter' && getBattleSkillById(skill.canonicalSkillId ?? -1)?.targetGroup === 'one-enemy');

/** Planning choices only: future accuracy, reaction activation and Enemy orders are unknown. */
export function playerTargetChoices(combatants: readonly BattleCombatantState[], actor: Readonly<BattleCombatantState>, skill: BattleSkillSelection): { intent?: TargetIntent; label: string }[] {
  const canonical = getBattleSkillById(skill.canonicalSkillId ?? -1);
  const policy = randomTarget(skill) || necroTarget(skill);
  const manual = playerControlsReactionTarget(skill) || !policy
    && skill.kind === 'attack' && skill.legacyTech.target === 'Single' && canonical?.targetGroup !== 'self';
  if (manual) return selectableSingleOpponents({ combatants }, actor.id)
    .map(t => ({ intent: { kind: 'combatants', targetIds: [t.id] }, label: t.name }));
  return [{ label: skill === MOTIVATION_GUARD ? 'None' : policy ? 'Random / engine policy'
    : canonical?.targetGroup === 'self' ? 'Self' : skill.kind !== 'assist' && skill.legacyTech.target === 'All' ? 'All' : 'Engine policy' }];
}
