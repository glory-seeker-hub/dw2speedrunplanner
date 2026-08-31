import { encounters } from '@/data/encounters';
import { DIGIMONS } from '@/data/digimons';
import { DOMAINS } from '@/data/domains';
import { STARTERS } from '@/data/starters';
import { GROWTH_PROFILES } from '@/data/growthProfiles';
import { isExperienceTableComplete } from '@/data/experience';
import { getDigimonByName } from '@/utils/digimonLookup';

export interface ValidationIssue {
  severity: 'error' | 'missing-data';
  code: string;
  message: string;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  encounterIdsMissingRewards: number[];
  speciesMissingGrowthProfiles: string[];
  unresolvedEncounterNames: string[];
}

/** Developer-facing game-data validation. Missing future metadata never blocks the app. */
export const validateGameData = (): ValidationReport => {
  const issues: ValidationIssue[] = [];
  const push = (severity: ValidationIssue['severity'], code: string, message: string) =>
    issues.push({ severity, code, message });

  // Duplicate encounter IDs
  const seenEncounters = new Set<number>();
  for (const e of encounters) {
    if (seenEncounters.has(e.id)) {
      push('error', 'duplicate-encounter-id', `Duplicate encounter ID ${e.id}`);
    }
    seenEncounters.add(e.id);
  }

  // Duplicate species IDs
  const seenSpecies = new Set<string>();
  for (const d of DIGIMONS) {
    if (seenSpecies.has(d.id)) {
      push('error', 'duplicate-species-id', `Duplicate Digimon species ID "${d.id}"`);
    }
    seenSpecies.add(d.id);
  }

  // Encounter contents
  const unresolvedEncounterNames = new Set<string>();
  const encounterIdsMissingRewards: number[] = [];
  for (const e of encounters) {
    const slots = new Set<number>();
    for (const enemy of e.digimons) {
      if (!Number.isInteger(enemy.slot) || enemy.slot < 1 || enemy.slot > 3) {
        push('error', 'invalid-slot', `Encounter ${e.id}: invalid enemy slot ${enemy.slot}`);
      }
      if (slots.has(enemy.slot)) {
        push('error', 'duplicate-slot', `Encounter ${e.id}: duplicate slot ${enemy.slot}`);
      }
      slots.add(enemy.slot);

      if (!getDigimonByName(enemy.name)) {
        unresolvedEncounterNames.add(enemy.name);
        push(
          'error',
          'unresolved-species',
          `Encounter ${e.id}: "${enemy.name}" cannot be resolved to a Digimon species`
        );
      }
    }
    if (e.xp === undefined || e.bits === undefined) {
      encounterIdsMissingRewards.push(e.id);
    }
  }
  if (encounterIdsMissingRewards.length > 0) {
    push(
      'missing-data',
      'missing-rewards',
      `${encounterIdsMissingRewards.length} encounter(s) still lack XP/Bits metadata`
    );
  }

  // Domains
  const seenDomains = new Set<string>();
  for (const domain of DOMAINS) {
    if (seenDomains.has(domain.id)) {
      push('error', 'duplicate-domain-id', `Duplicate domain ID "${domain.id}"`);
    }
    seenDomains.add(domain.id);
    for (const de of domain.encounters) {
      if (!seenEncounters.has(de.encounterId)) {
        push(
          'error',
          'unknown-encounter-ref',
          `Domain "${domain.id}" references nonexistent encounter ${de.encounterId}`
        );
      }
    }
  }
  if (DOMAINS.length === 0) {
    push('missing-data', 'missing-domains', 'No domain/location mappings populated yet');
  }

  // Growth profiles
  const profileIds = new Set(GROWTH_PROFILES.map((p) => p.speciesId));
  const speciesMissingGrowthProfiles = DIGIMONS.filter((d) => !profileIds.has(d.id)).map(
    (d) => d.id
  );
  if (speciesMissingGrowthProfiles.length > 0) {
    push(
      'missing-data',
      'missing-growth-profiles',
      `${speciesMissingGrowthProfiles.length} species lack growth profiles`
    );
  }

  if (STARTERS.length === 0) {
    push('missing-data', 'missing-starters', 'No starter definitions populated yet');
  }
  if (!isExperienceTableComplete()) {
    push('missing-data', 'missing-xp-table', 'Experience threshold table is incomplete');
  }

  return {
    issues,
    encounterIdsMissingRewards,
    speciesMissingGrowthProfiles,
    unresolvedEncounterNames: [...unresolvedEncounterNames],
  };
};

/** Logs the report once in development. Intentionally quiet for end users. */
export const logGameDataValidation = (): ValidationReport => {
  const report = validateGameData();
  if (import.meta.env.DEV) {
    const errors = report.issues.filter((i) => i.severity === 'error');
    const missing = report.issues.filter((i) => i.severity === 'missing-data');
    console.groupCollapsed(
      `[data validation] ${errors.length} error(s), ${missing.length} missing-data note(s)`
    );
    errors.forEach((i) => console.warn(`${i.code}: ${i.message}`));
    missing.forEach((i) => console.info(`${i.code}: ${i.message}`));
    console.groupEnd();
  }
  return report;
};
