import { Tech } from '@/types/digimon';
import { getBattleSkillById } from '@/data/battleSkills';
import { LEGACY_TECH_IDENTITIES } from '@/data/legacyTechIdentities';
import { toLegacyTech } from '@/utils/battleSkillCompatibility';

/** Temporary UI catalog. Identities only are curated; WAZADATA owns all mechanics. */
export const TECHS: Tech[] = LEGACY_TECH_IDENTITIES.map(([skillId, id, name]) => {
  const skill = getBattleSkillById(skillId);
  if (!skill) throw new Error(`Missing WAZADATA compatibility identity: ${skillId}`);
  return toLegacyTech(skill, id, name);
});
