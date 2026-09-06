import { encounters } from '@/data/encounters';
import { DIGIMONS } from '@/data/digimons';
import { DOMAINS, ENCOUNTER_REWARDS, getMappedEncounterIds } from '@/data/domains';
import {
  CONTEXTUAL_CORRECTION_GROUPS,
  DOMAIN_GROUPS,
  STRICT_CSV_UNIQUE_GROUPS,
} from '@/data/domainGroups';
import { STARTERS, STARTER_BUILD_ISSUES } from '@/data/starters';
import {
  DUPLICATE_GROWTH_PROFILE_SPECIES,
  GROWTH_PROFILES,
  GROWTH_PROFILE_SOURCE_COUNT,
  INVALID_GROWTH_RATE_VALUES,
  UNRESOLVED_GROWTH_PROFILES,
} from '@/data/growthProfiles';
import {
  ATK_DEF_GROWTH_ROWS,
  GROWTH_OUTCOMES_PER_ROW,
  GROWTH_OUTCOME_PROBABILITY,
  HP_MP_GROWTH_ROWS,
  PLANNER_SCOPE_MAX_EL,
  RANK_MINIMUM_EL,
  SPD_GROWTH_ROWS,
} from '@/data/statGrowthTables';
import { PROJECT_ONLY_ENCOUNTERS_WITHOUT_SOURCE_REWARD } from '@/data/rewardMatchOverrides';
import { ENCOUNTER_REWARD_SOURCE } from '@/data/encounterRewardSource';
import {
  AMBIGUOUS_REWARD_MATCHES,
  EXPLICIT_ZERO_REWARD_RECORDS,
  REWARDS_BY_ENCOUNTER_ID,
  UNMATCHED_REWARD_MATCHES,
} from '@/utils/rewardMatching';
import {
  getHighestContinuousExperienceLevel,
  isExperienceTableCompleteThrough,
} from '@/data/experience';
import { getDigimonByName } from '@/utils/digimonLookup';
import { getTechByName } from '@/utils/techLookup';
import { isBattleOnlySpecies } from '@/data/speciesClassification';
import { rollsExpected } from '@/utils/statGrowth';
import { runDataSelfChecks, SelfCheckResult } from '@/utils/dataSelfChecks';

export interface ValidationIssue {
  severity: 'error' | 'missing-data';
  code: string;
  message: string;
}

export interface RewardReport {
  sourceRecords: number;
  uniqueMatches: number;
  ambiguousMatches: { sourceRow: number; sourceLabel: string; candidateIds: number[] }[];
  unmatchedRecords: { sourceRow: number; sourceLabel: string; signature: string }[];
  encountersWithRewards: number;
  explicitZeroRewardRecords: number;
  domainReferencedEncountersMissingRewards: number[];
  /** Informational: these project-only encounters intentionally have no source reward. */
  projectOnlyEncountersWithoutRewards: number[];
}

export interface DomainReport {
  externalGroups: number;
  strictCsvUnique: number;
  contextualCorrections: number;
  resolvedGroups: number;
  unresolvedGroups: number;
  ambiguousGroups: number;
  distinctEncounterIds: number;
}

export interface GrowthReport {
  sourceProfiles: number;
  canonicalProfiles: number;
  unresolvedSpecies: { sourceRow: number; name: string; reason: string }[];
  duplicateSpecies: string[];
  invalidRateValues: { name: string; stat: string; value: string }[];
}

export interface StatGrowthTableReport {
  hpMpRows: number;
  atkDefRows: number;
  spdRows: number;
  rowsWithoutFourOutcomes: number;
  outcomeProbability: number;
  expectedEqualsMean: boolean;
  rankMinimumEL: Record<string, number>;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  rewards: RewardReport;
  domains: DomainReport;
  growth: GrowthReport;
  statGrowthTables: StatGrowthTableReport;
  speciesMissingGrowthProfiles: string[];
  battleOnlySpeciesWithoutProfiles: string[];
  unresolvedEncounterNames: string[];
  unresolvedTechNames: { source: string; techName: string }[];
  encountersWithoutLocation: number[];
  experience: {
    highestContinuousLevel: number;
    completeThroughPlannerScope: boolean;
    plannerScopeMaxEL: number;
  };
  selfChecks: SelfCheckResult[];
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
              'missing-data',
              'unresolved-tech',
              `Encounter ${e.id}: tech "${techName}" is not in TECHS (expected for assists, which are not implemented)`
            );
          }
        }
      }
    }
  }

  // Starters
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

  const unresolvedGroups = DOMAIN_GROUPS.filter(
    (g) => !Number.isInteger(g.encounterId) || !seenEncounters.has(g.encounterId)
  );
  const domainsReport: DomainReport = {
    externalGroups: DOMAIN_GROUPS.length,
    strictCsvUnique: STRICT_CSV_UNIQUE_GROUPS,
    contextualCorrections: CONTEXTUAL_CORRECTION_GROUPS,
    resolvedGroups: DOMAIN_GROUPS.length - unresolvedGroups.length,
    unresolvedGroups: unresolvedGroups.length,
    ambiguousGroups: 0,
    distinctEncounterIds: new Set(DOMAIN_GROUPS.map((g) => g.encounterId)).size,
  };
  if (domainsReport.externalGroups !== 473) {
    push(
      'error',
      'domain-group-count',
      `Expected 473 external domain groups, found ${domainsReport.externalGroups}`
    );
  }
  if (unresolvedGroups.length > 0) {
    push(
      'error',
      'unresolved-domain-groups',
      `${unresolvedGroups.length} domain group(s) do not resolve to an existing encounter`
    );
  }

  // Rewards
  const domainEncounterIds = getMappedEncounterIds();
  const domainReferencedMissingRewards = domainEncounterIds
    .filter((id) => !REWARDS_BY_ENCOUNTER_ID.has(id))
    .sort((a, b) => a - b);

  const rewards: RewardReport = {
    sourceRecords: ENCOUNTER_REWARD_SOURCE.length,
    uniqueMatches: REWARDS_BY_ENCOUNTER_ID.size,
    ambiguousMatches: AMBIGUOUS_REWARD_MATCHES.map((m) => ({
      sourceRow: m.record.sourceRow,
      sourceLabel: m.record.sourceLabel,
      candidateIds: m.status === 'ambiguous' ? m.candidateIds : [],
    })),
    unmatchedRecords: UNMATCHED_REWARD_MATCHES.map((m) => ({
      sourceRow: m.record.sourceRow,
      sourceLabel: m.record.sourceLabel,
      signature: m.status === 'unmatched' ? m.signature : '',
    })),
    encountersWithRewards: ENCOUNTER_REWARDS.size,
    explicitZeroRewardRecords: EXPLICIT_ZERO_REWARD_RECORDS.length,
    domainReferencedEncountersMissingRewards: domainReferencedMissingRewards,
    projectOnlyEncountersWithoutRewards: encounters
      .filter((e) => PROJECT_ONLY_ENCOUNTERS_WITHOUT_SOURCE_REWARD.includes(e.id) &&
        !REWARDS_BY_ENCOUNTER_ID.has(e.id) && !domainEncounterIds.includes(e.id))
      .map((e) => e.id).sort((a, b) => a - b),
  };

  if (rewards.sourceRecords !== 184) {
    push(
      'error',
      'reward-source-count',
      `Expected 184 reward source records, found ${rewards.sourceRecords}`
    );
  }
  if (rewards.uniqueMatches !== 184) {
    push('error', 'reward-match-count',
      `Expected 184 resolved encounter rewards, found ${rewards.uniqueMatches}`);
  }
  if (rewards.explicitZeroRewardRecords !== 36) {
    push(
      'error',
      'zero-reward-count',
      `Expected 36 explicit zero-reward records, found ${rewards.explicitZeroRewardRecords}`
    );
  }
  if (rewards.ambiguousMatches.length > 0) {
    push(
      'missing-data',
      'ambiguous-reward-match',
      `${rewards.ambiguousMatches.length} reward record(s) match multiple encounters and were not assigned`
    );
  }
  if (rewards.unmatchedRecords.length > 0) {
    push(
      'missing-data',
      'unmatched-reward-record',
      `${rewards.unmatchedRecords.length} reward record(s) match no encounter by full battle data`
    );
  }
  if (domainReferencedMissingRewards.length > 0) {
    push(
      'missing-data',
      'domain-encounter-without-reward',
      `${domainReferencedMissingRewards.length} domain-referenced encounter(s) have no reward metadata: ${domainReferencedMissingRewards.join(', ')}`
    );
  }

  const encountersWithoutLocation = encounters
    .filter((e) => !new Set(domainEncounterIds).has(e.id))
    .map((e) => e.id);
  if (encountersWithoutLocation.length > 0) {
    push(
      'missing-data',
      'encounters-without-location',
      `${encountersWithoutLocation.length} encounter(s) have no domain/floor mapping (special/custom records)`
    );
  }

  // Growth profiles
  const profileIds = new Set(GROWTH_PROFILES.map((p) => p.speciesId));
  const speciesMissingGrowthProfiles = DIGIMONS.filter(
    (d) => !profileIds.has(d.id) && !isBattleOnlySpecies(d.id)
  ).map((d) => d.id);
  const battleOnlySpeciesWithoutProfiles = DIGIMONS.filter(
    (d) => !profileIds.has(d.id) && isBattleOnlySpecies(d.id)
  ).map((d) => d.id);

  const growth: GrowthReport = {
    sourceProfiles: GROWTH_PROFILE_SOURCE_COUNT,
    canonicalProfiles: GROWTH_PROFILES.length,
    unresolvedSpecies: UNRESOLVED_GROWTH_PROFILES,
    duplicateSpecies: DUPLICATE_GROWTH_PROFILE_SPECIES,
    invalidRateValues: INVALID_GROWTH_RATE_VALUES,
  };
  if (growth.sourceProfiles !== 195) {
    push(
      'error',
      'growth-source-count',
      `Expected 195 growth source profiles, found ${growth.sourceProfiles}`
    );
  }
  if (growth.unresolvedSpecies.length > 0) {
    push(
      'missing-data',
      'unresolved-growth-species',
      `${growth.unresolvedSpecies.length} growth source profile(s) do not resolve to a canonical species`
    );
  }
  if (growth.duplicateSpecies.length > 0) {
    push(
      'error',
      'duplicate-growth-profile',
      `Duplicate growth profiles for: ${growth.duplicateSpecies.join(', ')}`
    );
  }
  if (growth.invalidRateValues.length > 0) {
    push(
      'error',
      'invalid-growth-rate',
      `${growth.invalidRateValues.length} growth rate value(s) are not low/normal/high`
    );
  }
  if (speciesMissingGrowthProfiles.length > 0) {
    push(
      'missing-data',
      'missing-growth-profiles',
      `${speciesMissingGrowthProfiles.length} non-battle-only species lack growth profiles ` +
        `(${battleOnlySpeciesWithoutProfiles.length} battle-only entities excluded)`
    );
  }

  // Stat growth tables
  const allRows = [...HP_MP_GROWTH_ROWS, ...ATK_DEF_GROWTH_ROWS, ...SPD_GROWTH_ROWS];
  const rowsWithoutFourOutcomes = allRows.filter(
    (r) => r.rolls.length !== GROWTH_OUTCOMES_PER_ROW
  ).length;
  const expectedEqualsMean = allRows.every(
    (r) =>
      Math.abs(
        rollsExpected(r.rolls) - r.rolls.reduce((s, v) => s + v, 0) / r.rolls.length
      ) < 1e-9
  );
  const statGrowthTables: StatGrowthTableReport = {
    hpMpRows: HP_MP_GROWTH_ROWS.length,
    atkDefRows: ATK_DEF_GROWTH_ROWS.length,
    spdRows: SPD_GROWTH_ROWS.length,
    rowsWithoutFourOutcomes,
    outcomeProbability: GROWTH_OUTCOME_PROBABILITY,
    expectedEqualsMean,
    rankMinimumEL: RANK_MINIMUM_EL,
  };
  if (rowsWithoutFourOutcomes > 0) {
    push(
      'error',
      'growth-row-outcomes',
      `${rowsWithoutFourOutcomes} growth row(s) do not have exactly four 25% outcomes`
    );
  }
  if (GROWTH_OUTCOME_PROBABILITY !== 0.25) {
    push('error', 'growth-probability', 'Growth outcome probability must be 25%');
  }
  if (allRows.length === 0) {
    push('error', 'missing-growth-tables', 'Stat-growth tables are empty');
  }

  // Experience — the planner only needs Lv50. Lv51+ is intentionally out of scope.
  const highestContinuousLevel = getHighestContinuousExperienceLevel();
  const completeThroughPlannerScope = isExperienceTableCompleteThrough(PLANNER_SCOPE_MAX_EL);
  if (!completeThroughPlannerScope) {
    push(
      'error',
      'incomplete-xp-table',
      `Experience table is only continuous through level ${highestContinuousLevel} (planner requires ${PLANNER_SCOPE_MAX_EL})`
    );
  }

  const selfChecks = runDataSelfChecks();
  for (const failed of selfChecks.filter((c) => !c.passed)) {
    push('error', 'self-check-failed', `${failed.name}: ${failed.detail ?? 'failed'}`);
  }

  return {
    issues,
    rewards,
    domains: domainsReport,
    growth,
    statGrowthTables,
    speciesMissingGrowthProfiles,
    battleOnlySpeciesWithoutProfiles,
    unresolvedEncounterNames: [...unresolvedEncounterNames],
    unresolvedTechNames,
    encountersWithoutLocation,
    experience: {
      highestContinuousLevel,
      completeThroughPlannerScope,
      plannerScopeMaxEL: PLANNER_SCOPE_MAX_EL,
    },
    selfChecks,
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
    console.info('rewards', report.rewards);
    console.info('domains', report.domains);
    console.info('growth', report.growth);
    console.info('statGrowthTables', report.statGrowthTables);
    console.info('experience', report.experience);
    console.info(
      'selfChecks',
      `${report.selfChecks.filter((c) => c.passed).length}/${report.selfChecks.length} passed`
    );
    console.groupEnd();
  }
  return report;
};
