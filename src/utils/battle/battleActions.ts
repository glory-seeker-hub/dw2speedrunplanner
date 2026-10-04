import { MOTIVATION_GUARD, mustGuard, canPayRequiredMp, randomTarget, necroTarget } from './battleEffectCompletion';
import { assistEligible, isAttributeRestrictedAssist } from './battleSupportEffects';
import type { ActionChoice, ActionPolicy, BattleCombatantState, BattleState, PlannedAction, TargetIntent } from './battleTypes';
import { BattleInputError } from './battleTypes';

function restrictedByReviewedRule(actor: BattleCombatantState, skill: BattleCombatantState['skills'][number], combatants: readonly BattleCombatantState[]) {
  return actor.statuses['motivation-down'] && actor.motivationBlocked?.includes(skill.key)
    || (necroTarget(skill) || isAttributeRestrictedAssist(skill)) && !assistEligible(actor, skill, combatants)
    || !canPayRequiredMp(actor, skill)
    || skill.canonicalSkillId === 0xf3 && actor.side === 'enemy' && actor.isBoss
      && !combatants.some(a => a.side === 'enemy' && a.id !== actor.id && a.currentHp === 0);
}
export function selectableSkills(actor: BattleCombatantState, combatants: readonly BattleCombatantState[]) {
  if (mustGuard(actor)) return [MOTIVATION_GUARD];
  return actor.skills.filter(s => !restrictedByReviewedRule(actor, s, combatants))
    .filter(s => s.kind === 'assist' ? assistEligible(actor, s, combatants) : s.legacyTech.ap > 0 || s.kind === 'interrupt');
}
export const legacyActionPolicy: ActionPolicy = {
  chooseAction(actor, context, rng) {
    const skills = selectableSkills(actor, context.combatants);
    if (!skills.length) {
      // Preserve Phase J's planned-but-ineligible Assist and its RNG ordering.
      // Only the newly restricted cases need an explicit no-legal-order skip.
      const restricted = actor.skills.some(s => restrictedByReviewedRule(actor, s, context.combatants));
      return { kind: restricted ? 'skip' : 'skill', skillKey: actor.skills[0].key };
    }
    // The old synthetic fallback consumes no technique-choice draw.
    const skill = skills.length === 1 && (skills[0].source === 'synthetic-legacy-fallback' || skills[0] === MOTIVATION_GUARD)
      ? skills[0] : skills[rng.nextIntExclusive(skills.length, 'action-choice')];
    return { kind: 'skill', skillKey: skill.key };
  },
};
export function nextActionId(state: BattleState): string {
  return `s${state.simulationIndex}-r${state.round}-a${state.nextActionNumber++}`;
}
export function planAction(state: BattleState, actor: BattleCombatantState, choice: ActionChoice): PlannedAction {
  if (choice.kind !== 'skill' && choice.kind !== 'skip') throw new BattleInputError('Guard and other non-skill choices are excluded from simulation.', 'unsupported');
  const skill = choice.skillKey === MOTIVATION_GUARD.key && mustGuard(actor) ? MOTIVATION_GUARD : actor.skills.find(s => s.key === choice.skillKey);
  if (!skill) throw new BattleInputError(`Policy selected unknown skill ${choice.skillKey}.`);
  if (choice.kind === 'skip' && selectableSkills(actor, state.combatants).length) throw new BattleInputError('Cannot skip while a legal technique or Motivation Guard is available.');
  if (choice.kind !== 'skip' && (actor.statuses['motivation-down'] && actor.motivationBlocked?.includes(skill.key) || !canPayRequiredMp(actor, skill))) throw new BattleInputError('Technique is currently blocked or lacks required MP.');
  if ((randomTarget(skill) || necroTarget(skill)) && choice.targetIntent?.kind === 'combatants') throw new BattleInputError('This technique requires engine-policy targeting.');
  const targetIntent: TargetIntent = skill === MOTIVATION_GUARD ? { kind: 'combatants', targetIds: [] } : choice.kind === 'skill' && choice.targetIntent ? structuredClone(choice.targetIntent) : {
    kind: 'opponents', side: actor.side === 'player' ? 'enemy' : 'player', selection: skill?.legacyTech.target === 'All' ? 'all' : 'random-at-execution',
  };
  const base = { id: nextActionId(state), round: state.round, actorId: actor.id, targetIntent, state: 'planned' as const, initiative: null, priority: skill.kind === 'interrupt' ? 'interrupt-waiting' as const : skill.kind === 'counter' ? 'counter-last' as const : 'normal' as const, reaction: null, chainFromActionId: null };
  const action: PlannedAction = { ...base, kind: skill.kind, skill, counter: skill.kind === 'counter' ? { selected: true, executionMode: 'waiting', activatedMechanics: false } : null };
  if (skill === MOTIVATION_GUARD) action.guard = true;
  if (skill.kind === 'interrupt') action.interrupt = { selected: true, state: 'waiting', selectedSkillId: skill.canonicalSkillId };
  if (choice.kind === 'skip') { action.state = 'skipped'; delete action.interrupt; }
  actor.plannedActionId = action.id;
  state.plannedActions.push(action);
  return action;
}
/** Future beforeActionExecution hook: no Interrupt/status implementation here. */
export function revalidateAction(state: BattleState, action: PlannedAction): string | null {
  if (action.counter?.executionMode === 'prevented') return 'counter-prevented-by-banana-slip';
  if (action.state === 'cancelled' || action.state === 'skipped') return action.state;
  const actor = state.combatants.find(a => a.id === action.actorId);
  if (actor && !canPayRequiredMp(actor, action.skill)) return 'insufficient-interrupt-mp';
  return actor?.revivedRound === state.round ? 'revived-this-round' : actor?.isAlive ? null : 'actor-ko';
}
