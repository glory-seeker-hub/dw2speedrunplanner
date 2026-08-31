import { DigimonStats } from '@/types/digimon';

export type RosterSource =
  | { type: 'starter' }
  | { type: 'capture'; encounterId: number; enemySlot: number };

/** A specific owned Digimon instance (not a species). */
export interface RosterDigimon {
  /** Stable unique identity. Never use array index as identity. */
  instanceId: string;
  speciesId: string;
  name: string;
  source: RosterSource;
  level: number;
  totalXp: number;
  stats: DigimonStats;
  techs: string[];
}

export interface RunBattleEvent {
  id: string;
  order: number;
  domainId: string;
  encounterId: number;
  /** Snapshot of the digiline at the time this battle happened (up to 3 instance IDs). */
  digilineInstanceIds: string[];
  capturedEnemySlot?: number | null;
  xpReward: number;
  bitsReward: number;
}

export interface RunPlan {
  id: string;
  name: string;
  starterInstanceId: string | null;
  roster: RosterDigimon[];
  /** Current active party: RosterDigimon instance IDs, max 3. */
  digiline: string[];
  battles: RunBattleEvent[];
  totalBits: number;
  createdAt: string;
  updatedAt: string;
}

export const MAX_DIGILINE_SIZE = 3;

export interface PersistedRunPlannerData {
  schemaVersion: 1;
  runs: RunPlan[];
  activeRunId: string | null;
}

/** Growth foundation — real DW2 growth data is not yet available in this project. */
export type GrowthRate = 'low' | 'normal' | 'high' | string;

export interface DigimonGrowthProfile {
  speciesId: string;
  hpGrowth: GrowthRate;
  mpGrowth: GrowthRate;
  atkGrowth: GrowthRate;
  defGrowth: GrowthRate;
  spdGrowth: GrowthRate;
  /** Optional extra parameters required by the real DW2 formula (stage/rank, DNA, etc.). */
  stage?: string;
  rank?: string;
}

export type StatGrowthEstimate =
  | { available: true; min: number; expected: number; max: number }
  | { available: false; reason: string };

/** Starter definition — enough data to build the initial RosterDigimon. */
export interface StarterDefinition {
  id: string;
  speciesId: string;
  name: string;
  level: number;
  stats: DigimonStats;
  techs: string[];
  totalXp?: number;
}
