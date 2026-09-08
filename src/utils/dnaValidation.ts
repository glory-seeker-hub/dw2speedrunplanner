import { DNA_FAMILY_SOURCE, DNA_MATRIX_SOURCE } from '@/data/dnaSource';
import { DNA_METALKID_COMBINATIONS, DNA_METALKID_SPECIES } from '@/data/dnaCrossValidationSource';
import { getDnaInitializationRule, getDnaFamily, getDnaMatrixResult, getDnaSelectionRank, getDnaSelectionType, resolveDnaMatrixLabel } from '@/data/dna';
import { getSpeciesProgression } from '@/data/speciesProgression';
import { getDigimonByName } from '@/utils/digimonLookup';
import { getRequiredTotalXpForLevel } from '@/utils/experience';
import { DNA_FAMILIES, DNA_SELECTION_RANKS, DNA_TYPES } from '@/types/dna';

/** Recompute the independent comparison; counts are never copied from an audit summary. */
export const validateDnaCombinations = (
  combinations = DNA_METALKID_COMBINATIONS,
  species = DNA_METALKID_SPECIES,
) => {
  const byId = new Map(species.map(([id, name]) => [id, getDigimonByName(name)]));
  const mismatches: { combinationId: number; expectedSpeciesId: string; actualSpeciesId: string }[] = [];
  const unresolved: number[] = [];
  let comparable = 0, matches = 0;
  for (const [id, aId, bId, resultId] of combinations) {
    const a = byId.get(aId), b = byId.get(bId), expected = byId.get(resultId);
    const pa = a && getSpeciesProgression(a.id), pb = b && getSpeciesProgression(b.id);
    const fa = a && getDnaFamily(a.id), fb = b && getDnaFamily(b.id);
    if (!a || !b || !expected || !pa || !pb || !fa || !fb) { unresolved.push(id); continue; }
    const rank = getDnaSelectionRank(pa.rank, pb.rank);
    if (!rank) { unresolved.push(id); continue; }
    const actual = getDnaMatrixResult(rank, getDnaSelectionType(a.type, b.type), fa, fb);
    if ('status' in actual) { unresolved.push(id); continue; }
    comparable++;
    if (actual.actualResultSpeciesId === expected.id) matches++;
    else mismatches.push({ combinationId: id, expectedSpeciesId: expected.id, actualSpeciesId: actual.actualResultSpeciesId });
  }
  return { comparable, matches, mismatches, unresolved };
};

/** Separate from the existing 46 checks: no new runtime or persistence integration. */
export const getDnaValidationReport = () => {
  const external = validateDnaCombinations();
  const results = DNA_MATRIX_SOURCE.map(row => getDnaMatrixResult(row.matrixSelectionRank, row.matrixSelectionType, row.familyA, row.familyB));
  const mutations = results.filter(result => !('status' in result) && result.isMutation);
  const asymmetries = DNA_MATRIX_SOURCE.filter(row => {
    const reverse = DNA_MATRIX_SOURCE.find(other => other.matrixSelectionRank === row.matrixSelectionRank &&
      other.matrixSelectionType === row.matrixSelectionType && other.familyA === row.familyB && other.familyB === row.familyA);
    return !reverse || resolveDnaMatrixLabel(reverse.resultLabel)?.id !== resolveDnaMatrixLabel(row.resultLabel)?.id;
  }).map(row => row.sourceCell);
  const keys = new Set(DNA_MATRIX_SOURCE.map(row => [row.matrixSelectionRank, row.matrixSelectionType, row.familyA, row.familyB].join('|')));
  const missingCells: string[] = [];
  for (const rank of DNA_SELECTION_RANKS) for (const type of DNA_TYPES) for (const a of DNA_FAMILIES) for (const b of DNA_FAMILIES) {
    const key = [rank, type, a, b].join('|');
    if (!keys.has(key)) missingCells.push(key);
  }
  return {
    familyRecords: DNA_FAMILY_SOURCE.length,
    familyNamesResolved: DNA_FAMILY_SOURCE.filter(([name]) => getDigimonByName(name)).length,
    familyUnresolved: DNA_FAMILY_SOURCE.filter(([name]) => !getDigimonByName(name)).map(([name]) => name),
    familyDuplicateSpecies: DNA_FAMILY_SOURCE.length - new Set(DNA_FAMILY_SOURCE.map(([name]) => getDigimonByName(name)?.id)).size,
    matrixEntries: DNA_MATRIX_SOURCE.length,
    matrixResultsResolved: results.filter(result => !('status' in result)).length,
    matrixUniqueResultLabels: new Set(DNA_MATRIX_SOURCE.map(row => row.resultLabel)).size,
    matrixAsymmetries: asymmetries.length, asymmetricCells: asymmetries,
    matrixDuplicateCells: DNA_MATRIX_SOURCE.length - keys.size, missingCells,
    MetalKidComparableCombinations: external.comparable,
    MetalKidMatches: external.matches,
    MetalKidMismatches: external.mismatches.length,
    MetalKidUnresolved: external.unresolved.length,
    MetalKidMismatchDetails: external.mismatches, MetalKidUnresolvedIds: external.unresolved,
    mutationCellCount: mutations.length,
    mutationInitializationUnresolved: mutations.filter(result => {
      if ('status' in result) return true;
      const rule = getDnaInitializationRule(result.actualResultRank);
      return !rule || getRequiredTotalXpForLevel(rule.startingLevel) === null;
    }).length,
    mutationResultSpecies: [...new Set(mutations.flatMap(result => 'status' in result ? [] : [result.actualResultName]))],
    mutationCells: mutations.flatMap(result => 'status' in result ? [] : [result.sourceCell]),
  };
};
