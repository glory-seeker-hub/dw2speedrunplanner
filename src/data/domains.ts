import { Domain } from '@/types/encounter';

/**
 * DOMAIN / LOCATION MAPPINGS  (Phase 1 foundation)
 *
 * DEVELOPER NOTE: No authoritative domain, floor or boss information exists anywhere in this
 * repository (checked: src/data/*.ts, src/data/*.csv and the imported encounter spreadsheet,
 * which only contains enemy compositions and stats). Nothing is invented here.
 *
 * To populate: add one Domain entry per in-game domain and reference existing encounter IDs
 * from src/data/encounters.ts. Never copy enemy stats into this file.
 *
 * Example (do not treat as real data):
 *   { id: 'directory-continent', name: 'Directory Continent', encounters: [
 *       { encounterId: 1, floors: [1, 2] },
 *       { encounterId: 12, floors: [5], isBoss: true },
 *   ]}
 */
export const DOMAINS: Domain[] = [];

export const getDomainById = (id: string): Domain | undefined =>
  DOMAINS.find((d) => d.id === id);

/** All domains where a given encounter appears (may be more than one). */
export const getDomainsForEncounter = (encounterId: number): Domain[] =>
  DOMAINS.filter((d) => d.encounters.some((e) => e.encounterId === encounterId));

export const getDomainEncounter = (
  domainId: string,
  encounterId: number
) => getDomainById(domainId)?.encounters.find((e) => e.encounterId === encounterId);
