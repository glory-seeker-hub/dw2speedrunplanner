import { DNA_FAMILY_SOURCE, DNA_MATRIX_SOURCE, DNA_ACTUAL_RANK_INITIALIZATION } from '@/data/dnaSource';
import { getSpeciesProgression } from '@/data/speciesProgression';
import { getDigimonById, getDigimonByName } from '@/utils/digimonLookup';
import { DnaFamily, DnaFailure, DnaMatrixResult, DnaRank, DnaSelectionRank, DnaType } from '@/types/dna';

/** Exact DNA matrix-label override, never a global alias or an M- expansion. */
export const resolveDnaMatrixLabel = (label: string) =>
  getDigimonByName(label === 'M-Tyrannomon' ? 'MasterTyrannomon' : label);

const families = new Map<string, DnaFamily>();
for (const [name, family] of DNA_FAMILY_SOURCE) {
  const species = getDigimonByName(name);
  if (species) families.set(species.id, family);
}

export const getDnaFamily = (speciesId: string): DnaFamily | null => families.get(speciesId) ?? null;

export const isDnaRank = (rank: string): rank is DnaRank =>
  ['Rookie', 'Champion', 'Ultimate', 'Mega'].includes(rank);

export const getDnaSelectionRank = (a: DnaRank, b: DnaRank): DnaSelectionRank | null => {
  const ranks: DnaRank[] = ['Rookie', 'Champion', 'Ultimate', 'Mega'];
  return (ranks[Math.min(ranks.indexOf(a), ranks.indexOf(b)) - 1] as DnaSelectionRank) ?? null;
};

export const getDnaSelectionType = (a: DnaType, b: DnaType): DnaType => {
  const beats: Record<DnaType, DnaType> = { Vaccine: 'Virus', Virus: 'Data', Data: 'Vaccine' };
  return a === b || beats[a] === b ? a : b;
};

const key = (rank: string, type: string, a: string, b: string) => [rank, type, a, b].join('|');
const matrix = new Map(DNA_MATRIX_SOURCE.map(row => [key(row.matrixSelectionRank, row.matrixSelectionType, row.familyA, row.familyB), row]));

/** Exact indexed lookup; retain the workbook cell even when it is a mutation. */
export const getDnaMatrixResult = (
  rank: DnaSelectionRank, type: DnaType, a: DnaFamily, b: DnaFamily,
): DnaMatrixResult | DnaFailure => {
  const row = matrix.get(key(rank, type, a, b));
  if (!row) return { status: 'unavailable', reason: 'missing-matrix-result' };
  const species = resolveDnaMatrixLabel(row.resultLabel);
  const metadata = species && getSpeciesProgression(species.id);
  if (!species || !metadata || !getDigimonById(species.id)) return { status: 'unavailable', reason: 'unresolved-result-species' };
  if (!isDnaRank(metadata.rank)) return { status: 'unavailable', reason: 'unsupported-result-rank' };
  return { ...row, actualResultSpeciesId: species.id, actualResultName: species.name,
    actualResultRank: metadata.rank, actualResultType: species.type,
    isMutation: metadata.rank !== rank || species.type !== type };
};

/** v4: actual canonical rank controls initialization for ordinary results and mutations. */
export const getDnaInitializationRule = (actualRank: DnaRank) =>
  actualRank === 'Mega' ? null : DNA_ACTUAL_RANK_INITIALIZATION[actualRank] ?? null;
