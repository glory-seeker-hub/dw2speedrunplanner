import { getTechByName } from '@/utils/techLookup';
import { getBattleSkillByName } from '@/data/battleSkills';
import type { Tech } from '@/types/digimon';

/** Legacy engine input boundary. Resolution errors never produce fake AP10 data. */
export function requireEncounterTech(label: string): Tech {
  const tech = getTechByName(label);
  if (tech) return tech;
  const skill = getBattleSkillByName(label);
  throw new Error(skill
    ? `Technique "${label}" is not supported by the current simulator.`
    : `Unresolved authoritative encounter technique: "${label}".`);
}

export function requireEncounterTechs(labels: readonly string[]): Tech[] {
  if (labels.length === 0) throw new Error('Encounter has no technique data. Simulation cannot continue.');
  return labels.map(requireEncounterTech);
}
