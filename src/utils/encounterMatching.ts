import { Encounter } from '@/types/encounter';
import { encounters } from '@/data/encounters';
import { ExternalDomainGroup } from '@/data/externalDomainGroups';
import { normalizeDigimonName } from '@/utils/digimonLookup';
import { normalizeTechName } from '@/utils/techLookup';

/**
 * Deterministic matching between external domain enemy groups and existing encounters.
 * A group is only mapped when EXACTLY ONE encounter matches. Never guess.
 */

const enemyKey = (
  name: string,
  level: number,
  techs?: string[]
): string => {
  const techPart =
    techs && techs.length > 0
      ? techs.map(normalizeTechName).sort().join('+')
      : '';
  return `${normalizeDigimonName(name)}@${level}${techPart ? `#${techPart}` : ''}`;
};

/** Signature of an existing encounter, optionally ignoring techs. */
export const encounterSignature = (
  encounter: Encounter,
  withTechs: boolean
): string =>
  [...encounter.digimons]
    .sort((a, b) => a.slot - b.slot)
    .map((d) => enemyKey(d.name, d.level, withTechs ? d.techs : undefined))
    .sort()
    .join('|');

const groupSignature = (group: ExternalDomainGroup, withTechs: boolean): string =>
  group.enemies
    .map((e) => enemyKey(e.name, e.level, withTechs ? e.techs : undefined))
    .sort()
    .join('|');

/** All encounters that match a group exactly. Techs are used only when the group lists them. */
export const findMatchingEncounters = (group: ExternalDomainGroup): Encounter[] => {
  const withTechs = group.enemies.every((e) => (e.techs?.length ?? 0) > 0);
  const target = groupSignature(group, withTechs);
  return encounters.filter(
    (e) =>
      e.digimons.length === group.enemies.length &&
      encounterSignature(e, withTechs) === target
  );
};

export type GroupMatch =
  | { status: 'mapped'; group: ExternalDomainGroup; encounterId: number }
  | { status: 'ambiguous'; group: ExternalDomainGroup; candidateIds: number[] }
  | { status: 'unmatched'; group: ExternalDomainGroup };

export const matchGroup = (group: ExternalDomainGroup): GroupMatch => {
  const matches = findMatchingEncounters(group);
  if (matches.length === 1) {
    return { status: 'mapped', group, encounterId: matches[0].id };
  }
  if (matches.length > 1) {
    return { status: 'ambiguous', group, candidateIds: matches.map((m) => m.id) };
  }
  return { status: 'unmatched', group };
};
