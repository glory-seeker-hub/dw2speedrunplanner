import { DomainPhase } from '@/types/encounter';

/**
 * AUTHORITATIVE EXTERNAL DOMAIN LISTINGS
 *
 * Each entry describes one enemy group as it appears in a domain, for one story phase.
 * Entries are matched against src/data/encounters.ts by a deterministic signature
 * (enemy count + normalized names + levels + techs when known) — see utils/encounterMatching.ts.
 *
 * RULES
 * - Never invent a group. Add only verified data.
 * - Never write an encounter ID here; IDs are resolved by matching.
 * - XP/Bits are only propagated to an encounter when the match is unique.
 */
export interface ExternalEnemy {
  name: string;
  level: number;
  /** Optional; improves match precision when known. */
  techs?: string[];
}

export interface ExternalDomainGroup {
  domainId: string;
  domainName: string;
  phase: DomainPhase;
  /** Highest floor of this domain in this phase, when verified. */
  maxFloor?: number;
  floors?: number[];
  isBoss?: boolean;
  xp?: number;
  bits?: number;
  enemies: ExternalEnemy[];
}

export const EXTERNAL_DOMAIN_GROUPS: ExternalDomainGroup[] = [
  {
    domainId: 'boot-domain',
    domainName: 'Boot Domain',
    phase: 'before-blood-knights',
    floors: [1],
    isBoss: false,
    xp: 39,
    bits: 280,
    enemies: [
      { name: 'Gazimon', level: 5 },
      { name: 'Gizamon', level: 5 },
    ],
  },
];
