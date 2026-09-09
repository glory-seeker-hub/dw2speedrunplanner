import { DigimonRank } from '@/types/techniqueInheritance';
import { Digimon, DigimonStats } from '@/types/digimon';
import { LevelCapState } from '@/types/runPlanner';

export const DNA_FAMILIES = ['Junk', 'Insect', 'Plant', 'Flying', 'Spirit', 'Beast', 'Dragon', 'Marine'] as const;
export const DNA_SELECTION_RANKS = ['Rookie', 'Champion', 'Ultimate'] as const;
export const DNA_TYPES = ['Data', 'Vaccine', 'Virus'] as const;
export type DnaFamily = typeof DNA_FAMILIES[number];
export type DnaSelectionRank = typeof DNA_SELECTION_RANKS[number];
export type DnaRank = DigimonRank;
export type DnaType = Digimon['type'];

export interface DnaMatrixSourceEntry {
  matrixSelectionRank: DnaSelectionRank;
  matrixSelectionType: DnaType;
  familyA: DnaFamily;
  familyB: DnaFamily;
  resultLabel: string;
  sourceCell: string;
}

export interface DnaMatrixResult extends DnaMatrixSourceEntry {
  actualResultSpeciesId: string;
  actualResultName: string;
  actualResultRank: DnaRank;
  actualResultType: DnaType;
  isMutation: boolean;
}

export interface DnaParentMetadata {
  instanceId: string;
  speciesId: string;
  name: string;
  rank: DnaRank;
  type: DnaType;
  family: DnaFamily;
}

export type DnaFailureCode = 'same-instance' | 'invalid-instance' | 'invalid-species' |
  'rookie-parent-ineligible' | 'missing-family' | 'invalid-dp' | 'invalid-level' |
  'invalid-stats' | 'missing-matrix-result' | 'unresolved-result-species' |
  'unsupported-result-rank' | 'missing-xp-threshold' | 'invalid-child-cap';
export interface DnaFailure {
  status: 'unavailable';
  reason: DnaFailureCode;
}

interface DnaPreviewMetadata {
  /** Stable ID order makes previews identical when callers reverse parents. */
  parents: readonly [DnaParentMetadata, DnaParentMetadata];
  matrixSelectionRank: DnaSelectionRank;
  matrixSelectionType: DnaType;
  actualResultSpeciesId: string;
  actualResultName: string;
  actualResultRank: DnaRank;
  actualResultType: DnaType;
  childDp: number;
  childMaxLevel: number;
  childLevelCap: LevelCapState;
}

export type DnaPreview = DnaFailure | (DnaPreviewMetadata & {
  status: 'success';
  initializationStatus: 'initialized';
  isMutation: boolean;
  startingLevel: number;
  childTotalXp: number;
  childStats: DigimonStats;
});
