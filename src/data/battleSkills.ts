import type { BattleSkillDefinition } from '@/types/battleSkill';
import { WAZADATA_RECORDS } from '@/data/wazaSource';
import { normalizeWazaRecord } from '@/utils/battleSkillDecoder';
import { normalizeTechniqueName } from '@/data/techniqueMetadata';

/** Reuse the reviewed Planner aliases (Blaze Blaster, Fler Cannon, Ninja Fler). */
export const BATTLE_SKILL_NAME_ALIASES: Readonly<Record<string, string>> = {
  // ENCOUNTERSET spelling vs the single WAZADATA row 412 (ID F9).
  destabilizerray: 'Destablizer Ray',
};
export const normalizeBattleSkillName = (name: string): string => {
  const key = normalizeTechniqueName(name);
  return normalizeTechniqueName(BATTLE_SKILL_NAME_ALIASES[key] ?? name);
};

export const BATTLE_SKILLS: readonly BattleSkillDefinition[] = WAZADATA_RECORDS.map(normalizeWazaRecord);
export function buildBattleSkillIndex(skills: readonly BattleSkillDefinition[]) {
  const byId = new Map<number, BattleSkillDefinition>();
  const byName = new Map<string, BattleSkillDefinition>();
  for (const skill of skills) {
    if (byId.has(skill.id)) throw new Error(`Duplicate WAZADATA ID: ${skill.id}`);
    byId.set(skill.id, skill);
    // Items may share technique labels (AntiDote / Antidote). Never merge them.
    if (skill.recordKind !== 'technique' || !skill.name) continue;
    const key = normalizeBattleSkillName(skill.name);
    if (byName.has(key)) throw new Error(`Ambiguous WAZADATA name: ${skill.name}`);
    byName.set(key, skill);
  }
  return { byId, byName };
}
const index = buildBattleSkillIndex(BATTLE_SKILLS);
export const getBattleSkillById = (id: number) => index.byId.get(id);
export const getBattleSkillByName = (name: string) => index.byName.get(normalizeBattleSkillName(name));

export function resolveBattleSkillNames(names: readonly string[]) {
  const resolved: BattleSkillDefinition[] = [];
  const unresolved: string[] = [];
  for (const name of names) {
    const skill = getBattleSkillByName(name);
    if (skill) resolved.push(skill);
    else unresolved.push(name);
  }
  return { resolved, unresolved };
}
