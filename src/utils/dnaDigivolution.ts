import { getDnaInitializationRule, getDnaFamily, getDnaMatrixResult, getDnaSelectionRank, getDnaSelectionType, isDnaRank } from '@/data/dna';
import { getSpeciesProgression } from '@/data/speciesProgression';
import { DigimonStats } from '@/types/digimon';
import { DnaFailure, DnaParentMetadata, DnaPreview, DnaSelectionRank } from '@/types/dna';
import { RosterDigimon } from '@/types/runPlanner';
import { getDigimonById } from '@/utils/digimonLookup';
import { getRequiredTotalXpForLevel } from '@/utils/experience';

const parentMetadata = (parent: RosterDigimon): DnaParentMetadata | DnaFailure => {
  if (!parent || typeof parent.instanceId !== 'string' || !parent.instanceId.trim()) return { status: 'unavailable', reason: 'invalid-instance' };
  const species = getDigimonById(parent.speciesId);
  const metadata = species && getSpeciesProgression(species.id);
  if (!species || !metadata || !isDnaRank(metadata.rank)) return { status: 'unavailable', reason: 'invalid-species' };
  const family = getDnaFamily(species.id);
  if (!family) return { status: 'unavailable', reason: 'missing-family' };
  if (metadata.rank === 'Rookie') return { status: 'unavailable', reason: 'rookie-parent-ineligible' };
  if (!Number.isSafeInteger(parent.dp) || parent.dp < 0 || parent.dp >= Number.MAX_SAFE_INTEGER) return { status: 'unavailable', reason: 'invalid-dp' };
  if (!Number.isSafeInteger(parent.level) || parent.level < 1) return { status: 'unavailable', reason: 'invalid-level' };
  if (!parent.stats || !(['hp', 'mp', 'atk', 'def', 'spd'] as const).every(stat =>
    Number.isFinite(parent.stats[stat]) && parent.stats[stat] >= 0)) return { status: 'unavailable', reason: 'invalid-stats' };
  return { instanceId: parent.instanceId, speciesId: species.id, name: species.name,
    rank: metadata.rank, type: species.type, family };
};

// Integer percentages preserve the complete formula before its single final floor.
const coefficients: Record<DnaSelectionRank, readonly [number, number, number, number]> = {
  Rookie: [10, 40, 30, 30], Champion: [34, 50, 30, 45], Ultimate: [45, 50, 40, 50],
};
const calculateDnaStats = (rank: DnaSelectionRank, a: DigimonStats, b: DigimonStats): DigimonStats => {
  const [vital, higher, lower, speed] = coefficients[rank];
  const sum = (stat: keyof DigimonStats, percent: number) => Math.floor((a[stat] + b[stat]) * percent / 100);
  const weighted = (stat: 'atk' | 'def') => Math.floor((Math.max(a[stat], b[stat]) * higher + Math.min(a[stat], b[stat]) * lower) / 100);
  return { hp: sum('hp', vital), mp: sum('mp', vital), atk: weighted('atk'), def: weighted('def'), spd: sum('spd', speed) };
};

/** Calculation only: no child instance, techniques, IDs, storage, history or parent consumption. */
export const previewDnaDigivolution = (parentA: RosterDigimon, parentB: RosterDigimon): DnaPreview => {
  if (parentA?.instanceId && parentA.instanceId === parentB?.instanceId) return { status: 'unavailable', reason: 'same-instance' };
  // Stable ordering also makes error precedence and returned parent metadata symmetric.
  const [a, b] = [parentA, parentB].sort((x, y) => (x?.instanceId ?? '') < (y?.instanceId ?? '') ? -1 : 1);
  const first = parentMetadata(a), second = parentMetadata(b);
  if ('status' in first) return first;
  if ('status' in second) return second;
  const matrixSelectionRank = getDnaSelectionRank(first.rank, second.rank)!;
  const matrixSelectionType = getDnaSelectionType(first.type, second.type);
  const result = getDnaMatrixResult(matrixSelectionRank, matrixSelectionType, first.family, second.family);
  if ('status' in result) return result;
  const childDp = Math.max(a.dp, b.dp) + 1;
  const childMaxLevel = Math.max(a.level, b.level) + Math.floor(Math.min(a.level, b.level) / 5);
  if (!Number.isSafeInteger(childMaxLevel)) return { status: 'unavailable', reason: 'invalid-child-cap' };
  const shared = { parents: [first, second] as const, matrixSelectionRank, matrixSelectionType,
    actualResultSpeciesId: result.actualResultSpeciesId, actualResultName: result.actualResultName,
    actualResultRank: result.actualResultRank, actualResultType: result.actualResultType,
    childDp, childMaxLevel, childLevelCap: { min: childMaxLevel, max: childMaxLevel, resolved: childMaxLevel } };
  // v4: matrix rank/type select the species; its actual rank selects EL, XP and stats.
  const initialization = getDnaInitializationRule(result.actualResultRank);
  if (!initialization) return { status: 'unavailable', reason: 'unsupported-result-rank' };
  const startingLevel = initialization.startingLevel;
  if (childMaxLevel < startingLevel) return { status: 'unavailable', reason: 'invalid-child-cap' };
  const childTotalXp = getRequiredTotalXpForLevel(startingLevel);
  if (childTotalXp === null) return { status: 'unavailable', reason: 'missing-xp-threshold' };
  const childStats = calculateDnaStats(initialization.statFormulaRank, a.stats, b.stats);
  if (!Object.values(childStats).every(Number.isSafeInteger)) return { status: 'unavailable', reason: 'invalid-stats' };
  return { ...shared, status: 'success', initializationStatus: 'initialized', isMutation: result.isMutation,
    startingLevel, childTotalXp, childStats };
};
