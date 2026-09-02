import { encounters } from '@/data/encounters';
import { DIGIMONS } from '@/data/digimons';
import { DOMAINS, GROUP_MATCHES, ENCOUNTER_REWARDS, getMappedEncounterIds } from '@/data/domains';
import { STARTERS, STARTER_BUILD_ISSUES } from '@/data/starters';
import { GROWTH_PROFILES } from '@/data/growthProfiles';
import {
  getHighestContinuousExperienceLevel,
  isExperienceTableCompleteThrough,
} from '@/data/experience';
import { getDigimonByName } from '@/utils/digimonLookup';
import { getTechByName } from '@/utils/techLookup';
import { isBattleOnlySpecies } from '@/data/speciesClassification';

export interface ValidationIssue {
  severity: 'error' | 'missing-data';
  code: string;
  message: string;
}

/** Developer-facing report about domain/encounter mapping. */
export interface EncounterMappingReport {
  mapped: { domainId: string; phase: string; encounterId: number }[];
  ambiguous: { domainId: string; phase: string; candidateIds: number[]; enemies: string }[];
  unmatchedExternalGroups: { domainId: string; phase: string; enemies: string }[];
  encountersWithoutLocation: number[];
  encountersWithoutRewards: number[];
}

export interface ValidationReport {
  issues: ValidationIssue[];
  mapping: EncounterMappingReport;
  speciesMissingGrowthProfiles: string[];
  battleOnlySpeciesWithoutProfiles: string[];
  unresolvedEncounterNames: string[];
  unresolvedTechNames: { source: string; techName: string }[];
  experience: { highestContinuousLevel: number; completeThrough50: boolean };
}

const describeEnemies = (enemies: { name: string; level: number }[]): string =>
  enemies.map((e) => `${e.name} Lv${e.level}`).join(' + ');

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

  // Encounter contents + tech resolution
  const unresolvedEncounterNames = new Set<string>();
  const unresolvedTechNames: ValidationReport['unresolvedTechNames'] = [];
  const seenUnresolvedTech = new Set<string>();

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

      for (const techName of enemy.techs) {
        if (!getTechByName(techName)) {
          const key = `encounter:${techName}`;
          if (!seenUnresolvedTech.has(key)) {
            seenUnresolvedTech.add(key);
            unresolvedTechNames.push({ source: `encounter ${e.id}`, techName });
            push(
              'error',
              'unresolved-tech',
              `Encounter ${e.id}: tech "${techName}" cannot be resolved in TECHS`
            );
          }
        }
      }
    }
  }

  // Starter techs
  for (const starter of STARTERS) {
    for (const techName of starter.techs) {
      if (!getTechByName(techName)) {
        unresolvedTechNames.push({ source: `starter ${starter.id}`, techName });
        push(
          'error',
          'unresolved-starter-tech',
          `Starter "${starter.id}": tech "${techName}" cannot be resolved in TECHS`
        );
      }
    }
  }
  for (const issue of STARTER_BUILD_ISSUES) {
    push('error', 'starter-build-failed', `Starter "${issue.starterId}": ${issue.message}`);
  }
  if (STARTERS.length < 3) {
    push(
      'missing-data',
      'missing-starters',
      `Only ${STARTERS.length}/3 starter definitions could be built`
    );
  }

  // Domains
  const seenDomains = new Set<string>();
  for (const domain of DOMAINS) {
    if (seenDomains.has(domain.id)) {
      push('error', 'duplicate-domain-id', `Duplicate domain ID "${domain.id}"`);
    }
    seenDomains.add(domain.id);
    const seenPhases = new Set<string>();
    for (const variant of domain.variants) {
      if (seenPhases.has(variant.phase)) {
        push(
          'error',
          'duplicate-domain-variant',
          `Domain "${domain.id}" has duplicate phase "${variant.phase}"`
        );
      }
      seenPhases.add(variant.phase);
      for (const de of variant.encounters) {
        if (!seenEncounters.has(de.encounterId)) {
          push(
            'error',
            'unknown-encounter-ref',
            `Domain "${domain.id}" (${variant.phase}) references nonexistent encounter ${de.encounterId}`
          );
        }
      }
    }
  }

  // Mapping report
  const mapping: EncounterMappingReport = {
    mapped: [],
    ambiguous: [],
    unmatchedExternalGroups: [],
    encountersWithoutLocation: [],
    encountersWithoutRewards: [],
  };
  for (const match of GROUP_MATCHES) {
    const base = { domainId: match.group.domainId, phase: match.group.phase };
    if (match.status === 'mapped') {
      mapping.mapped.push({ ...base, encounterId: match.encounterId });
    } else if (match.status === 'ambiguous') {
      mapping.ambiguous.push({
        ...base,
        candidateIds: match.candidateIds,
        enemies: describeEnemies(match.group.enemies),
      });
      push(
        'missing-data',
        'ambiguous-encounter-mapping',
        `Domain "${base.domainId}" (${base.phase}) group [${describeEnemies(
          match.group.enemies
        )}] matches encounters ${match.candidateIds.join(', ')} — not mapped`
      );
    } else {
      mapping.unmatchedExternalGroups.push({
        ...base,
        enemies: describeEnemies(match.group.enemies),
      });
      push(
        'missing-data',
        'unmatched-external-group',
        `Domain "${base.domainId}" (${base.phase}) group [${describeEnemies(
          match.group.enemies
        )}] matches no existing encounter`
      );
    }
  }

  const mappedIds = new Set(getMappedEncounterIds());
  mapping.encountersWithoutLocation = encounters
    .filter((e) => !mappedIds.has(e.id))
    .map((e) => e.id);
  mapping.encountersWithoutRewards = encounters
    .filter((e) => !ENCOUNTER_REWARDS.has(e.id) && (e.xp === undefined || e.bits === undefined))
    .map((e) => e.id);

  if (DOMAINS.length === 0) {
    push('missing-data', 'missing-domains', 'No domain/location mappings populated yet');
  }
  if (mapping.encountersWithoutLocation.length > 0) {
    push(
      'missing-data',
      'encounters-without-location',
      `${mapping.encountersWithoutLocation.length} encounter(s) have no domain/floor mapping`
    );
  }
  if (mapping.encountersWithoutRewards.length > 0) {
    push(
      'missing-data',
      'missing-rewards',
      `${mapping.encountersWithoutRewards.length} encounter(s) still lack verified XP/Bits`
    );
  }

  // Growth profiles — battle-only entities are not expected to have one.
  const profileIds = new Set(GROWTH_PROFILES.map((p) => p.speciesId));
  const speciesMissingGrowthProfiles = DIGIMONS.filter(
    (d) => !profileIds.has(d.id) && !isBattleOnlySpecies(d.id)
  ).map((d) => d.id);
  const battleOnlySpeciesWithoutProfiles = DIGIMONS.filter(
    (d) => !profileIds.has(d.id) && isBattleOnlySpecies(d.id)
  ).map((d) => d.id);

  if (speciesMissingGrowthProfiles.length > 0) {
    push(
      'missing-data',
      'missing-growth-profiles',
      `${speciesMissingGrowthProfiles.length} non-battle-only species lack growth profiles ` +
        `(${battleOnlySpeciesWithoutProfiles.length} battle-only entities excluded)`
    );
  }

  // Experience table
  const highestContinuousLevel = getHighestContinuousExperienceLevel();
  const completeThrough50 = isExperienceTableCompleteThrough(50);
  if (!completeThrough50) {
    push(
      'missing-data',
      'missing-xp-table',
      `Experience table is only continuous through level ${highestContinuousLevel}`
    );
  }

  return {
    issues,
    mapping,
    speciesMissingGrowthProfiles,
    battleOnlySpeciesWithoutProfiles,
    unresolvedEncounterNames: [...unresolvedEncounterNames],
    unresolvedTechNames,
    experience: { highestContinuousLevel, completeThrough50 },
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
    console.info('mapping', {
      mapped: report.mapping.mapped.length,
      ambiguous: report.mapping.ambiguous.length,
      unmatched: report.mapping.unmatchedExternalGroups.length,
      withoutLocation: report.mapping.encountersWithoutLocation.length,
      withoutRewards: report.mapping.encountersWithoutRewards.length,
    });
    console.groupEnd();
  }
  return report;
};
