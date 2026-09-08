import { INITIAL_LEVEL_CAP_RULES, SPECIES_PROGRESSION_SOURCE } from '@/data/progressionSource';
import { SPECIES_PROGRESSION, UNRESOLVED_PROGRESSION_SPECIES } from '@/data/speciesProgression';
import { METALKID_DIGIMON_SOURCE, METALKID_EVOLUTION_SOURCE } from '@/data/evolutionSource';
import { EVOLUTION_RANGES, lookupNormalEvolution } from '@/utils/normalDigivolution';
import { getGrowthProfile } from '@/data/growthProfiles';
import { getDigimonById } from '@/utils/digimonLookup';
import { getTechByName } from '@/utils/techLookup';
import { PLANNER_SCOPE_MAX_EL } from '@/data/statGrowthTables';

/** Diagnostics are separate from fatal errors: planner labels and Piddomon DP6 are usable source facts. */
export const getProgressionValidationReport = () => {
  const rules = Object.values(INITIAL_LEVEL_CAP_RULES);
  const assertions = SPECIES_PROGRESSION.filter(r => r.workbookDp0Evolution !== null);
  const dp0AssertionMismatches = assertions.filter(r => {
    const result = lookupNormalEvolution(r.speciesId, 0);
    return result.status !== 'unique' || result.targetSpeciesId !== r.workbookDp0Evolution;
  });
  const ambiguities = EVOLUTION_RANGES.flatMap((a, i) => EVOLUTION_RANGES.slice(i + 1).flatMap(b => {
    const min = Math.max(a.min, b.min), max = Math.min(a.max ?? Infinity, b.max ?? Infinity);
    return a.from && a.from === b.from && a.to !== b.to && min <= max ? [{
      speciesId: a.from, min, max: Number.isFinite(max) ? max : null,
      candidateSpeciesIds: [a.to, b.to], sourceRowIds: [a.id, b.id],
      known: a.from === 'piddomon' && min === 6 && max === 6,
    }] : [];
  }));
  return {
    capRulesTotal: rules.length, fixedCapRules: rules.filter(r => r.min === r.max).length,
    randomCapRules: rules.filter(r => r.min < r.max).length,
    progressionSourceTotal: SPECIES_PROGRESSION_SOURCE.length, canonicalSpeciesTotal: SPECIES_PROGRESSION.length,
    unresolvedProgressionSpecies: UNRESOLVED_PROGRESSION_SPECIES,
    rankMatches: SPECIES_PROGRESSION.filter(r => getGrowthProfile(r.speciesId)?.rank === r.rank).length,
    typeMatches: SPECIES_PROGRESSION.filter(r => getDigimonById(r.speciesId)?.type === r.type).length,
    metalKidDigimonCount: METALKID_DIGIMON_SOURCE.length, metalKidEvolutionRowCount: METALKID_EVOLUTION_SOURCE.length,
    unresolvedEndpoints: EVOLUTION_RANGES.filter(r => !r.from || !r.to),
    workbookDp0AssertionsChecked: assertions.length, dp0AssertionMismatches,
    workbookNullMetalKidPresent: SPECIES_PROGRESSION.filter(r => r.workbookDp0Evolution === null && lookupNormalEvolution(r.speciesId, 0).status === 'unique').map(r => r.speciesId),
    evolutionRangeAmbiguities: ambiguities,
    unresolvedPlannerTechniqueLabels: SPECIES_PROGRESSION.filter(r => r.ownTechnique && !getTechByName(r.ownTechnique)).map(r => ({ speciesId: r.speciesId, technique: r.ownTechnique })),
    noOwnTechnique: SPECIES_PROGRESSION.filter(r => r.ownTechnique === null).length,
    plannerXpSupportedRange: { min: 1, max: PLANNER_SCOPE_MAX_EL },
  };
};
