import { TechniquePotential, TechniqueState } from '@/types/techniqueInheritance';

export const MAX_TECHNIQUES = 12;

/** A calculation, not a committed roster: candidates may exceed capacity. */
export interface TechniqueChoice {
  state: TechniqueState;
  candidates: TechniquePotential[];
  newlyUnlockedKeys: string[];
  selectionRequired: boolean;
}

export interface TechniqueSelection {
  instanceId: string;
  keptKeys: string[];
}

export interface BattleTechniqueChoice {
  instanceId: string;
  name: string;
  newLevel: number;
  currentlyPossessed: string[];
  choice: TechniqueChoice;
}

/** Stable canonical display labels, not a second pool snapshot. */
export interface BattleTechniqueAudit {
  instanceId: string;
  learned: string[];
  discarded: string[];
}
