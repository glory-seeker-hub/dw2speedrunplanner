import { validateRunPlan } from '@/utils/runInvariants';
import { DigimonStats } from '@/types/digimon';
import {
  MAX_DIGILINE_SIZE,
  PersistedRunPlannerData,
  RosterDigimon,
  RunBattleEvent,
  RunPlan,
} from '@/types/runPlanner';

export const RUN_PLANNER_STORAGE_KEY = 'dw2-run-planner';
export const RUN_PLANNER_SCHEMA_VERSION = 1 as const;

export const emptyRunPlannerData = (): PersistedRunPlannerData => ({
  schemaVersion: RUN_PLANNER_SCHEMA_VERSION,
  runs: [],
  activeRunId: null,
});

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0;

const isNonNegativeNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((item) => typeof item === 'string');

const isStats = (v: unknown): v is DigimonStats =>
  isObject(v) &&
  (['hp', 'mp', 'atk', 'def', 'spd'] as const).every((k) =>
    isNonNegativeNumber(v[k])
  );

const isRosterSource = (v: unknown): boolean => {
  if (!isObject(v)) return false;
  if (v.type === 'starter') return true;
  return (
    v.type === 'capture' &&
    typeof v.encounterId === 'number' &&
    typeof v.enemySlot === 'number'
  );
};

const isRosterDigimon = (v: unknown): v is RosterDigimon =>
  isObject(v) &&
  isNonEmptyString(v.instanceId) &&
  isNonEmptyString(v.speciesId) &&
  isNonEmptyString(v.name) &&
  isRosterSource(v.source) &&
  typeof v.level === 'number' &&
  Number.isInteger(v.level) &&
  v.level >= 1 &&
  isNonNegativeNumber(v.totalXp) &&
  isStats(v.stats) &&
  isStringArray(v.techs);

const isRunBattleEvent = (v: unknown): v is RunBattleEvent =>
  isObject(v) &&
  isNonEmptyString(v.id) &&
  typeof v.order === 'number' &&
  Number.isInteger(v.order) &&
  v.order >= 0 &&
  isNonEmptyString(v.domainId) &&
  typeof v.encounterId === 'number' &&
  isStringArray(v.digilineInstanceIds) &&
  v.digilineInstanceIds.length <= MAX_DIGILINE_SIZE &&
  (v.capturedEnemySlot === undefined ||
    v.capturedEnemySlot === null ||
    (typeof v.capturedEnemySlot === 'number' && Number.isInteger(v.capturedEnemySlot))) &&
  isNonNegativeNumber(v.xpReward) &&
  isNonNegativeNumber(v.bitsReward);

const isRunPlan = (v: unknown): v is RunPlan => {
  if (!isObject(v)) return false;
  if (!isNonEmptyString(v.id) || typeof v.name !== 'string') return false;
  if (v.starterInstanceId !== null && !isNonEmptyString(v.starterInstanceId)) return false;
  if (!Array.isArray(v.roster) || !v.roster.every(isRosterDigimon)) return false;
  if (!isStringArray(v.digiline) || v.digiline.length > MAX_DIGILINE_SIZE) return false;
  if (!Array.isArray(v.battles) || !v.battles.every(isRunBattleEvent)) return false;
  if (!isNonNegativeNumber(v.totalBits)) return false;
  if (!isNonEmptyString(v.createdAt) || !isNonEmptyString(v.updatedAt)) return false;

  const rosterIds = new Set((v.roster as RosterDigimon[]).map((r) => r.instanceId));
  if ((v.digiline as string[]).some((id) => !rosterIds.has(id))) return false;
  if (v.starterInstanceId !== null && !rosterIds.has(v.starterInstanceId as string)) {
    return false;
  }
  return validateRunPlan(v as unknown as RunPlan).length === 0;
};

export const isValidPersistedRunPlannerData = (
  value: unknown
): value is PersistedRunPlannerData => {
  if (!isObject(value)) return false;
  if (value.schemaVersion !== RUN_PLANNER_SCHEMA_VERSION) return false;
  if (!Array.isArray(value.runs) || !value.runs.every(isRunPlan)) return false;
  if (new Set(value.runs.map((run) => run.id)).size !== value.runs.length) return false;
  if (value.activeRunId !== null && !isNonEmptyString(value.activeRunId)) return false;
  if (
    value.activeRunId !== null &&
    !(value.runs as RunPlan[]).some((r) => r.id === value.activeRunId)
  ) {
    return false;
  }
  return true;
};

/** Loads persisted data. Corrupted or outdated payloads fail safely to an empty state. */
export const loadRunPlannerData = (): PersistedRunPlannerData => {
  try {
    const raw = localStorage.getItem(RUN_PLANNER_STORAGE_KEY);
    if (!raw) return emptyRunPlannerData();
    const parsed = JSON.parse(raw);
    if (!isValidPersistedRunPlannerData(parsed)) return emptyRunPlannerData();
    return parsed;
  } catch {
    return emptyRunPlannerData();
  }
};

export const saveRunPlannerData = (data: PersistedRunPlannerData): boolean => {
  try {
    if (!isValidPersistedRunPlannerData({ ...data, schemaVersion: RUN_PLANNER_SCHEMA_VERSION })) {
      return false;
    }
    localStorage.setItem(
      RUN_PLANNER_STORAGE_KEY,
      JSON.stringify({ ...data, schemaVersion: RUN_PLANNER_SCHEMA_VERSION })
    );
    return true;
  } catch {
    return false;
  }
};

export const resetRunPlannerData = (): boolean => {
  try {
    localStorage.removeItem(RUN_PLANNER_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
};
