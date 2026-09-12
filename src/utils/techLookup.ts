import { Tech } from '@/types/digimon';
import { TECHS } from '@/data/techs';
import { normalizeBattleSkillName } from '@/data/battleSkills';

/**
 * Canonical tech lookup. Centralizes normalization and the (explicit) alias table so
 * unknown tech names are reported instead of silently disappearing in the battle adapter.
 */

/** Only unambiguous, verified aliases belong here. Never guess spellings. */
export const TECH_NAME_ALIASES: Record<string, string> = {
  trihornattack: 'trihornattack', // "Trihorn Attack" -> "Tri-Horn Attack" (hyphen only)
};

export const normalizeTechName = (name: string): string => {
  const key = normalizeBattleSkillName(name ?? '');
  return TECH_NAME_ALIASES[key] ?? key;
};

const byNormalizedName = new Map<string, Tech>();
const byId = new Map<string, Tech>();
for (const t of TECHS) {
  byNormalizedName.set(normalizeTechName(t.name), t);
  byId.set(t.id, t);
}

export const getTechByName = (name: string): Tech | undefined =>
  byNormalizedName.get(normalizeTechName(name));

export const getTechById = (id: string): Tech | undefined => byId.get(id);

export const resolveTechNames = (
  names: string[]
): { resolved: Tech[]; unresolved: string[] } => {
  const resolved: Tech[] = [];
  const unresolved: string[] = [];
  for (const name of names) {
    const tech = getTechByName(name);
    if (tech) resolved.push(tech);
    else unresolved.push(name);
  }
  return { resolved, unresolved };
};
