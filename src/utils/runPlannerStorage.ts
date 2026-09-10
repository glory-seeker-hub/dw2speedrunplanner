import { validateRunPlan } from '@/utils/runInvariants';
import { isRosterDigimon } from '@/utils/runActionCheckpoint';
import { isValidRunEvent } from '@/utils/runEventValidation';
import { MAX_DIGILINE_SIZE, PersistedRunPlannerData, RosterDigimon, RunPlan } from '@/types/runPlanner';

export const RUN_PLANNER_STORAGE_KEY = 'dw2-run-planner';
export const RUN_PLANNER_SCHEMA_VERSION = 7 as const;

export const emptyRunPlannerData = (): PersistedRunPlannerData => ({
  schemaVersion: RUN_PLANNER_SCHEMA_VERSION,
  runs: [],
  activeRunId: null,
});

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNonNegativeNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(item => typeof item === 'string');

const isRunPlan = (v: unknown): v is RunPlan => {
  if (!isObject(v)) return false;
  if (!isNonEmptyString(v.id) || typeof v.name !== 'string') return false;
  if (v.starterInstanceId !== null && !isNonEmptyString(v.starterInstanceId)) return false;
  if (!Array.isArray(v.roster) || !v.roster.every(isRosterDigimon)) return false;
  if (!isStringArray(v.digiline) || v.digiline.length > MAX_DIGILINE_SIZE) return false;
  if (!Array.isArray(v.history) || !v.history.every(isValidRunEvent)) return false;
  if (!isNonNegativeNumber(v.totalBits)) return false;
  if (!isNonEmptyString(v.createdAt) || !isNonEmptyString(v.updatedAt)) return false;

  const rosterIds = new Set((v.roster as RosterDigimon[]).map((r) => r.instanceId));
  if ((v.digiline as string[]).some((id) => !rosterIds.has(id))) return false;

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

export interface RunPlannerLoadResult { data: PersistedRunPlannerData; warning: string | null }
const invalidStorageWarning = 'Saved data could not be validated and was not automatically deleted. Creating or saving new data may replace it.';

/** Invalid payloads remain in storage; distinguish them from a fresh browser. */
export const loadRunPlannerDataResult = (): RunPlannerLoadResult => {
  try {
    const raw = localStorage.getItem(RUN_PLANNER_STORAGE_KEY);
    if (raw === null) return { data: emptyRunPlannerData(), warning: null };
    const parsed = JSON.parse(raw);
    if (!isValidPersistedRunPlannerData(parsed)) return { data: emptyRunPlannerData(), warning: invalidStorageWarning };
    return { data: parsed, warning: null };
  } catch {
    return { data: emptyRunPlannerData(), warning: invalidStorageWarning };
  }
};
export const loadRunPlannerData = (): PersistedRunPlannerData => loadRunPlannerDataResult().data;

export type RunPlannerSaveResult = { ok: true } | { ok: false; reason: 'invalid' | 'quota' | 'unavailable' };
export const saveRunPlannerDataResult = (data: PersistedRunPlannerData): RunPlannerSaveResult => {
  try {
    if (!isValidPersistedRunPlannerData(data)) return { ok: false, reason: 'invalid' };
    localStorage.setItem(RUN_PLANNER_STORAGE_KEY, JSON.stringify({ ...data, schemaVersion: RUN_PLANNER_SCHEMA_VERSION }));
    return { ok: true };
  } catch (cause) {
    const error = cause as { name?: string; code?: number } | null;
    const quota = error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error?.code === 22 || error?.code === 1014;
    return { ok: false, reason: quota ? 'quota' : 'unavailable' };
  }
};
export const saveRunPlannerData = (data: PersistedRunPlannerData): boolean => saveRunPlannerDataResult(data).ok;

/** UTF-8 serialized size, not an estimate of the browser quota. */
export const getRunPlannerSerializedBytes = (data: PersistedRunPlannerData): number => new TextEncoder().encode(JSON.stringify(data)).byteLength;

export const resetRunPlannerData = (): boolean => {
  try {
    localStorage.removeItem(RUN_PLANNER_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
};
