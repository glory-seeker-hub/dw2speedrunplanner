import { toLegacyTech } from './battleSkillCompatibility';
import { getTechByName } from '@/utils/techLookup';
import { getBattleSkillByName } from '@/data/battleSkills';
import type { Tech } from '@/types/digimon';

/** Legacy engine input boundary. Resolution errors never produce fake AP10 data. */
export function requireEncounterTech(label: string): Tech {
  const tech = getTechByName(label);
  if (tech) return tech;
  const skill = getBattleSkillByName(label);
  if (skill?.actionKind === 'assist' && skill.recordKind === 'technique' && skill.name) return {
    id: 'waza-' + skill.id, canonicalSkillId: skill.id, name: skill.name, ap: 0,
    element: skill.element === 'Darkness' ? 'Dark' : skill.element === 'Neutral' || !skill.element ? 'None' : skill.element,
    target: ['all-allies', 'all-enemies', 'field'].includes(skill.targetGroup ?? '') ? 'All' : 'Single', isCounter: false,
  } as Tech & { canonicalSkillId: number };
  if (skill?.recordKind === 'technique' && skill.attackPower !== null && skill.name) return { ...toLegacyTech(skill, 'waza-' + skill.id, skill.name), canonicalSkillId: skill.id } as Tech;
  throw new Error(skill
    ? `Technique "${label}" is not supported by the current simulator.`
    : `Unresolved authoritative encounter technique: "${label}".`);
}

export function requireEncounterTechs(labels: readonly string[]): Tech[] {
  if (labels.length === 0) throw new Error('Encounter has no technique data. Simulation cannot continue.');
  return labels.filter(label => label !== 'Alias Fake').map(requireEncounterTech);
}
