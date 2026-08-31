import { PersistedRunPlannerData } from '@/types/runPlanner';

export const RUN_PLANNER_STORAGE_KEY = 'dw2-run-planner';
export const RUN_PLANNER_SCHEMA_VERSION = 1 as const;

export const emptyRunPlannerData = (): PersistedRunPlannerData => ({
  schemaVersion: RUN_PLANNER_SCHEMA_VERSION,
  runs: [],
  activeRunId: null,
});

const isValid = (value: unknown): value is PersistedRunPlannerData => {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<PersistedRunPlannerData>;
  return (
    data.schemaVersion === RUN_PLANNER_SCHEMA_VERSION &&
    Array.isArray(data.runs) &&
    (data.activeRunId === null || typeof data.activeRunId === 'string')
  );
};

/** Loads persisted data. Corrupted or outdated payloads fail safely to an empty state. */
export const loadRunPlannerData = (): PersistedRunPlannerData => {
  try {
    const raw = localStorage.getItem(RUN_PLANNER_STORAGE_KEY);
    if (!raw) return emptyRunPlannerData();
    const parsed = JSON.parse(raw);
    if (!isValid(parsed)) return emptyRunPlannerData();
    return parsed;
  } catch {
    return emptyRunPlannerData();
  }
};

export const saveRunPlannerData = (data: PersistedRunPlannerData): boolean => {
  try {
    localStorage.setItem(
      RUN_PLANNER_STORAGE_KEY,
      JSON.stringify({ ...data, schemaVersion: RUN_PLANNER_SCHEMA_VERSION })
    );
    return true;
  } catch {
    return false;
  }
};

export const resetRunPlannerData = (): void => {
  try {
    localStorage.removeItem(RUN_PLANNER_STORAGE_KEY);
  } catch {
    /* storage unavailable — nothing to reset */
  }
};
