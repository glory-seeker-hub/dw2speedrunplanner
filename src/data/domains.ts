import { Domain, DomainEncounter, DomainPhase, DomainVariant } from '@/types/encounter';
import { EXTERNAL_DOMAIN_GROUPS } from '@/data/externalDomainGroups';
import { GroupMatch, matchGroup } from '@/utils/encounterMatching';

/**
 * DOMAIN / LOCATION MAPPINGS
 *
 * DOMAINS is derived from the verified external listings in externalDomainGroups.ts,
 * mapped to existing encounter IDs by unique signature match only. Groups that match
 * zero or multiple encounters are NOT mapped — they are reported instead.
 *
 * Encounter stats are never duplicated here. XP/Bits resolved from unique matches are
 * exposed through ENCOUNTER_REWARDS / getEncounterRewards (Run Planner concern only —
 * the battle engine keeps reading encounter.digimons exactly as before).
 */

export const GROUP_MATCHES: GroupMatch[] = EXTERNAL_DOMAIN_GROUPS.map(matchGroup);

export interface EncounterReward {
  xp: number;
  bits: number;
}

const buildDomains = (): { domains: Domain[]; rewards: Map<number, EncounterReward> } => {
  const domainMap = new Map<string, Domain>();
  const rewards = new Map<number, EncounterReward>();

  for (const match of GROUP_MATCHES) {
    if (match.status !== 'mapped') continue;
    const { group, encounterId } = match;

    let domain = domainMap.get(group.domainId);
    if (!domain) {
      domain = { id: group.domainId, name: group.domainName, variants: [] };
      domainMap.set(group.domainId, domain);
    }

    let variant = domain.variants.find((v) => v.phase === group.phase);
    if (!variant) {
      variant = { phase: group.phase, maxFloor: group.maxFloor, encounters: [] };
      domain.variants.push(variant);
    } else if (variant.maxFloor === undefined && group.maxFloor !== undefined) {
      variant.maxFloor = group.maxFloor;
    }

    const existing = variant.encounters.find((e) => e.encounterId === encounterId);
    if (existing) {
      const floors = new Set([...(existing.floors ?? []), ...(group.floors ?? [])]);
      existing.floors = floors.size > 0 ? [...floors].sort((a, b) => a - b) : undefined;
      existing.isBoss = existing.isBoss || group.isBoss;
    } else {
      const entry: DomainEncounter = { encounterId };
      if (group.floors) entry.floors = [...group.floors];
      if (group.isBoss !== undefined) entry.isBoss = group.isBoss;
      variant.encounters.push(entry);
    }

    if (typeof group.xp === 'number' && typeof group.bits === 'number') {
      rewards.set(encounterId, { xp: group.xp, bits: group.bits });
    }
  }

  return { domains: [...domainMap.values()], rewards };
};

const built = buildDomains();

export const DOMAINS: Domain[] = built.domains;
export const ENCOUNTER_REWARDS: Map<number, EncounterReward> = built.rewards;

export const getEncounterRewards = (encounterId: number): EncounterReward | undefined =>
  ENCOUNTER_REWARDS.get(encounterId);

export const getDomainById = (id: string): Domain | undefined =>
  DOMAINS.find((d) => d.id === id);

export const getDomainVariant = (
  domainId: string,
  phase: DomainPhase
): DomainVariant | undefined =>
  getDomainById(domainId)?.variants.find((v) => v.phase === phase);

export const getAllDomainVariants = (): { domain: Domain; variant: DomainVariant }[] =>
  DOMAINS.flatMap((domain) => domain.variants.map((variant) => ({ domain, variant })));

/** All domain/phase locations where a given encounter appears. */
export const getLocationsForEncounter = (
  encounterId: number
): { domain: Domain; variant: DomainVariant; entry: DomainEncounter }[] =>
  getAllDomainVariants().flatMap(({ domain, variant }) => {
    const entry = variant.encounters.find((e) => e.encounterId === encounterId);
    return entry ? [{ domain, variant, entry }] : [];
  });

export const getMappedEncounterIds = (): number[] => [
  ...new Set(
    getAllDomainVariants().flatMap(({ variant }) =>
      variant.encounters.map((e) => e.encounterId)
    )
  ),
];
