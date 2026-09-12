import type { BattleSkillDefinition } from '@/types/battleSkill';
import type { Tech } from '@/types/digimon';

/**
 * Temporary lossy projection for the existing simulator, not the authoritative API.
 * Existing resolution approximations (AP vs damage multiplier, drain quantity,
 * stack limits, consecutive cap) stay in the engine for its later redesign.
 * No identity/name controls a mechanical field here.
 */
export function toLegacyTech(skill: BattleSkillDefinition, id: string, name: string): Tech {
  if (skill.attackPower === null || !skill.element || !skill.actionKind || !skill.targetGroup) {
    throw new Error(`Cannot project unresolved WAZADATA skill ${skill.id} into Tech`);
  }
  let specialEffect: Tech['specialEffect'];
  const returned = skill.effects.find(e => e.kind === 'damage-modifier' && e.modifier === 'returned-damage' && e.condition === 'counter-triggered');
  const counter = skill.effects.find(e => e.kind === 'damage-modifier' && e.modifier === 'multiplier' && e.condition === 'counter-triggered');
  const allOnCounter = skill.targetModes.includes('all-on-counter');
  const consecutive = skill.effects.find(e => e.kind === 'consecutive-power');
  const reduction = skill.effects.find(e => e.kind === 'parameter-modifier' && e.direction === 'down' && e.subject === 'target' && !e.attribute && e.stats.length === 1);
  if (returned?.kind === 'damage-modifier') specialEffect = { type: 'counterDamageMultiplier', value: returned.multiplier };
  else if (counter?.kind === 'damage-modifier') specialEffect = { type: allOnCounter ? 'counterApMultiplierAndTargetAll' : 'counterApMultiplier', value: counter.multiplier };
  else if (allOnCounter) specialEffect = { type: 'counterTargetAll' };
  else if (consecutive?.kind === 'consecutive-power') specialEffect = { type: 'consecutiveApIncrease', value: consecutive.displayedIncrement };
  else if (skill.effects.some(e => e.kind === 'drain' && e.resource === 'hp')) specialEffect = { type: 'healOnDamage' };
  else if (skill.effects.some(e => e.kind === 'action-protection' && e.against === 'counter' && e.scope === 'skill')) specialEffect = { type: 'noTriggerCounter' };
  else if (reduction?.kind === 'parameter-modifier') specialEffect = { type: 'debuffStat', stat: reduction.stats[0] };
  return {
    id, name, ap: skill.attackPower,
    element: skill.element === 'Neutral' ? 'None' : skill.element === 'Darkness' ? 'Dark' : skill.element,
    target: skill.targetGroup === 'all-enemies' || skill.targetGroup === 'all-allies' ? 'All' : 'Single',
    isCounter: skill.actionKind === 'counter',
    ...(specialEffect ? { specialEffect } : {}),
  };
}
