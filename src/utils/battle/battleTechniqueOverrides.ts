import type { TeamDigimon } from '@/types/digimon';
import { linkLegacySkill } from './battleInput';

export type PlayerTechniqueSelections = Record<string, string[]>;
type IdentifiedMember = TeamDigimon & { instanceId?: string; plannerDigimonInstanceId?: string };

/** Slot fallback is only meaningful within one source team; the UI scopes drafts to that source. */
export function techniqueMemberKey(member: IdentifiedMember, slot: number): string {
  return member.plannerDigimonInstanceId ?? member.instanceId ?? `slot-${slot}-${member.digimon.id}`;
}

/** Reset uses the supplied historical/manual list, never species progression or display names. */
export function createPlayerTechniqueSelections(team: readonly TeamDigimon[]): PlayerTechniqueSelections {
  return Object.fromEntries(team.map((member, slot) => [techniqueMemberKey(member, slot), member.techs.map(t => t.id)]));
}

export function resolvePlayerTechniqueSelections<T extends TeamDigimon>(
  source: readonly T[], selections: PlayerTechniqueSelections,
) {
  const team = structuredClone(source) as T[];
  const errors: Record<string, string> = {};
  let changed = false;
  team.forEach((member, slot) => {
    const key = techniqueMemberKey(member, slot);
    const enabled = new Set(selections[key] ?? source[slot].techs.map(t => t.id));
    // Intersect with the source: even a stale/injected selection cannot add a technique.
    member.techs = member.techs.filter(t => enabled.has(t.id));
    const filtered = member.techs.length !== source[slot].techs.length;
    changed ||= filtered;
    // Match createMember's usable-technique rule. Preserve untouched legacy fallback inputs,
    // but never let customization manufacture a synthetic fallback by removing usable skills.
    if (filtered && !member.techs.some(t => {
      const skill = linkLegacySkill(t);
      return skill.canonicalSkillId !== 0xea && (t.ap > 0 || skill.kind === 'interrupt' || skill.kind === 'assist');
    })) errors[key] = 'Select at least one usable technique for this Digimon.';
  });
  return { team, errors, valid: Object.keys(errors).length === 0, changed };
}
