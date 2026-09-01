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
  /** Reward SNAPSHOT taken when the event was created. Never a computed getter. */
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

/** Growth classification. Only these three categories are verified for DW2. */
export type GrowthRate = 'low' | 'normal' | 'high';

export interface DigimonGrowthProfile {
  speciesId: string;
  /** Stage/rank drives which growth table row applies. */
  stage?: string;
  rank?: string;
  hpGrowth: GrowthRate;
  mpGrowth: GrowthRate;
  atkGrowth: GrowthRate;
  defGrowth: GrowthRate;
  spdGrowth: GrowthRate;
}

/**
 * Growth outcome for one stat on one level-up.
 * `expected` is null when only min/max are verified — never assume a uniform distribution.
 */
export type StatGrowthEstimate =
  | { available: true; min: number; max: number; expected: number | null }
  | { available: false; reason: string };

/**
 * Stat progression model. Keeps ACTUAL known stats separate from estimates so the
 * Run Planner never re-rolls random growth on recalculation or page reload.
 */
export interface StatProgression {
  /** Known/authoritative stats (starter record, capture record, or user-entered). */
  currentStats: DigimonStats;
  /** Deterministic estimate — null entries mean "not estimable with verified data". */
  estimatedStats: Partial<Record<keyof DigimonStats, number | null>>;
  /** Possible growth window per stat for the next level-up. */
  growthRange: Record<keyof DigimonStats, StatGrowthEstimate>;
}

/** Starter definition — enough data to build the initial RosterDigimon. */
export interface StarterDefinition {
  id: string;
  /** In-game starter path label (Gold Hawk / Blue Falcon / Black Sword). */
  label: string;
  speciesId: string;
  name: string;
  level: number;
  stats: DigimonStats;
  techs: string[];
  totalXp: number;
}
