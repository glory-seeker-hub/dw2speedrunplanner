import { Domain, DomainEncounter, DomainPhase, DomainVariant } from '@/types/encounter';
import { DOMAIN_GROUPS, DomainGroup } from '@/data/domainGroups';
import {
  REWARDS_BY_ENCOUNTER_ID,
  ResolvedReward,
  getResolvedReward,
} from '@/utils/rewardMatching';

/**
 * DOMAIN / LOCATION MAPPINGS
 *
 * DOMAINS is derived from the fully resolved external group list in domainGroups.ts
 * (456 strict CSV matches + 17 explicit contextual corrections = 473/473).
 *
 * Encounter stats are NEVER duplicated here — domains only reference encounter IDs.
 * XP/Bits come from the reward source records (see utils/rewardMatching.ts), which the
 * battle engine never reads.
 */

export interface EncounterReward {
  xp: number;
  bits: number;
}

const buildDomains = (): Domain[] => {
  const domainMap = new Map<string, Domain>();

  for (const group of DOMAIN_GROUPS) {
    let domain = domainMap.get(group.domainId);
    if (!domain) {
      domain = { id: group.domainId, name: group.domainName, variants: [] };
      domainMap.set(group.domainId, domain);
    }

    let variant = domain.variants.find((v) => v.phase === group.phase);
    if (!variant) {
      variant = { phase: group.phase, encounters: [] };
      domain.variants.push(variant);
    }

    const maxGroupFloor = group.floors.length > 0 ? Math.max(...group.floors) : undefined;
    if (maxGroupFloor !== undefined) {
      variant.maxFloor =
        variant.maxFloor === undefined
          ? maxGroupFloor
          : Math.max(variant.maxFloor, maxGroupFloor);
    }

    const existing = variant.encounters.find((e) => e.encounterId === group.encounterId);
    if (existing) {
      const floors = new Set([...(existing.floors ?? []), ...group.floors]);
      existing.floors = floors.size > 0 ? [...floors].sort((a, b) => a - b) : undefined;
      existing.isBoss = Boolean(existing.isBoss) || group.isBoss;
    } else {
      const entry: DomainEncounter = { encounterId: group.encounterId };
      if (group.floors.length > 0) entry.floors = [...group.floors];
      entry.isBoss = group.isBoss;
      variant.encounters.push(entry);
    }
  }

  return [...domainMap.values()];
};

export const DOMAINS: Domain[] = buildDomains();

/** Encounter rewards resolved from the reward source table by unique full-data match. */
export const ENCOUNTER_REWARDS: Map<number, EncounterReward> = new Map(
  [...REWARDS_BY_ENCOUNTER_ID.entries()].map(([id, r]) => [id, { xp: r.xp, bits: r.bits }])
);

export const getEncounterRewards = (encounterId: number): EncounterReward | undefined => {
  const resolved: ResolvedReward | undefined = getResolvedReward(encounterId);
  return resolved ? { xp: resolved.xp, bits: resolved.bits } : undefined;
};

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
  ...new Set(DOMAIN_GROUPS.map((g) => g.encounterId)),
];

export const getGroupsForEncounter = (encounterId: number): DomainGroup[] =>
  DOMAIN_GROUPS.filter((g) => g.encounterId === encounterId);
