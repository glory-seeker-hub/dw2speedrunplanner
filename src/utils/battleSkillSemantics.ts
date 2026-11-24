/** Known execution semantics; nonstandard WAZADATA byte4 stays undecoded. */
export const RANDOM_ELEMENT_SKILL_IDS = [0xf1, 0xf4] as const;

export function isRandomElementSkillId(id: number | null | undefined): boolean {
  return RANDOM_ELEMENT_SKILL_IDS.some(skillId => skillId === id);
}
