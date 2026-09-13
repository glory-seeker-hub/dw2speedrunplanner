import type { ActionChoice, ActionPolicy, BattleCombatantState, BattleState, PlannedAction, TargetIntent } from './battleTypes';
import { BattleInputError } from './battleTypes';

export const legacyActionPolicy: ActionPolicy = {
  chooseAction(actor, _context, rng) {
    const skills = actor.skills.filter(s => s.legacyTech.ap > 0 || s.kind === 'interrupt');
    if (!skills.length) throw new BattleInputError(`No usable technique for ${actor.name}.`, 'unsupported');
    // The old synthetic fallback consumes no technique-choice draw.
    const skill = skills.length === 1 && skills[0].source === 'synthetic-legacy-fallback'
      ? skills[0] : skills[rng.nextIntExclusive(skills.length, 'action-choice')];
    return { kind: 'skill', skillKey: skill.key };
  },
};
export function nextActionId(state: BattleState): string {
  return `s${state.simulationIndex}-r${state.round}-a${state.nextActionNumber++}`;
}
export function planAction(state: BattleState, actor: BattleCombatantState, choice: ActionChoice): PlannedAction {
  if (choice.kind !== 'skill') throw new BattleInputError('Guard and other non-skill choices are excluded from simulation.', 'unsupported');
  const skill = actor.skills.find(s => s.key === choice.skillKey);
  if (!skill) throw new BattleInputError(`Policy selected unknown skill ${choice.skillKey}.`);
  const targetIntent: TargetIntent = choice.kind === 'skill' && choice.targetIntent ? structuredClone(choice.targetIntent) : {
    kind: 'opponents', side: actor.side === 'player' ? 'enemy' : 'player', selection: skill?.legacyTech.target === 'All' ? 'all' : 'random-at-execution',
  };
  const base = { id: nextActionId(state), round: state.round, actorId: actor.id, targetIntent, state: 'planned' as const, initiative: null, priority: skill.kind === 'interrupt' ? 'interrupt-waiting' as const : skill.kind === 'counter' ? 'counter-last' as const : 'normal' as const, reaction: null, chainFromActionId: null };
  const action: PlannedAction = { ...base, kind: skill.kind, skill, counter: skill.kind === 'counter' ? { selected: true, executionMode: 'waiting', activatedMechanics: false } : null };
  if (skill.kind === 'interrupt') action.interrupt = { selected: true, state: 'waiting', selectedSkillId: skill.canonicalSkillId };
  actor.plannedActionId = action.id;
  state.plannedActions.push(action);
  return action;
}
/** Future beforeActionExecution hook: no Interrupt/status implementation here. */
export function revalidateAction(state: BattleState, action: PlannedAction): string | null {
  if (action.state === 'cancelled' || action.state === 'skipped') return action.state;
  const actor = state.combatants.find(a => a.id === action.actorId);
  return actor?.isAlive ? null : 'actor-ko';
}
