import { PersistedRunPlannerData, RunPlan } from '@/types/runPlanner';
import { newInstanceId } from '@/utils/capture';
import { isValidPersistedRunPlannerData, RUN_PLANNER_SCHEMA_VERSION } from '@/utils/runPlannerStorage';
import { runPlannerWireShape } from '@/utils/runPlannerShape';
import { validateExternalRunReferences } from '@/utils/runInstanceLifecycle';

export const BACKUP_FORMAT = 'dw2-speedrun-planner-backup' as const;
export const BACKUP_VERSION = 1 as const;
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
export interface RunBackup {
  format: typeof BACKUP_FORMAT;
  backupVersion: typeof BACKUP_VERSION;
  plannerSchemaVersion: typeof RUN_PLANNER_SCHEMA_VERSION;
  exportedAt: string;
  scope: 'active-run' | 'all-runs';
  activeRunId: string | null;
  runs: RunPlan[];
}
const invalid = () => new Error('Run data is incomplete or invalid. No runs were imported.');
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reject unsafe keys before any object copying. Bound depth without recursive walking. */
function checkJsonTree(value: unknown) {
  const pending = [{ value, depth: 0 }];
  while (pending.length) {
    const entry = pending.pop()!;
    if (entry.depth > 32) throw invalid();
    if (entry.value && typeof entry.value === 'object') {
      if (!Array.isArray(entry.value) && Object.getPrototypeOf(entry.value) !== Object.prototype) throw invalid();
      for (const [key, child] of Object.entries(entry.value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw invalid();
        pending.push({ value: child, depth: entry.depth + 1 });
      }
    }
  }
}

export function validateRunBackup(value: unknown): RunBackup {
  if (!object(value) || value.format !== BACKUP_FORMAT) throw new Error('This is not a DW2 Speedrun Planner backup.');
  if (value.backupVersion !== BACKUP_VERSION) throw new Error('Unsupported backup version. This application supports backup version 1.');
  if (value.plannerSchemaVersion !== RUN_PLANNER_SCHEMA_VERSION) throw new Error('Unsupported Planner schema. This application supports schema 7 backups.');
  checkJsonTree(value);
  const fields = ['format', 'backupVersion', 'plannerSchemaVersion', 'exportedAt', 'scope', 'activeRunId', 'runs'];
  if (Object.keys(value).some(key => !fields.includes(key))) throw invalid();
  if (typeof value.exportedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.exportedAt) ||
      !Number.isFinite(Date.parse(value.exportedAt)) || new Date(value.exportedAt).toISOString() !== value.exportedAt) throw invalid();
  if (value.scope !== 'active-run' && value.scope !== 'all-runs') throw invalid();
  const payload = { schemaVersion: value.plannerSchemaVersion, activeRunId: value.activeRunId, runs: value.runs };
  // Shape check protects the existing semantic validators from arbitrary nested objects.
  if (!runPlannerWireShape.safeParse(payload).success || !isValidPersistedRunPlannerData(payload) || !payload.runs.length) throw invalid();
  if (payload.runs.some(run => validateExternalRunReferences(run).length)) throw invalid();
  if (value.scope === 'active-run' && (payload.runs.length !== 1 || payload.activeRunId !== payload.runs[0].id)) throw invalid();
  return { format: BACKUP_FORMAT, backupVersion: BACKUP_VERSION, plannerSchemaVersion: RUN_PLANNER_SCHEMA_VERSION,
    exportedAt: value.exportedAt, scope: value.scope, activeRunId: payload.activeRunId, runs: structuredClone(payload.runs) };
}

export function parseRunBackup(text: string): RunBackup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error('The backup file is too large (maximum 32 MiB).');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('The backup file is not valid JSON.'); }
  return validateRunBackup(value);
}

export async function readRunBackupFile(file: Pick<File, 'size' | 'text'>): Promise<RunBackup> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('The backup file is too large (maximum 32 MiB).');
  let text: string;
  try { text = await file.text(); } catch { throw new Error('Could not read the backup file. Please choose it again.'); }
  return parseRunBackup(text);
}

export function createRunBackup(data: PersistedRunPlannerData, scope: RunBackup['scope'], now = new Date()): RunBackup {
  if (!isValidPersistedRunPlannerData(data)) throw invalid();
  const active = data.runs.find(run => run.id === data.activeRunId);
  if (!data.runs.length || (scope === 'active-run' && !active)) throw new Error('There is no saved run to export.');
  return validateRunBackup({ format: BACKUP_FORMAT, backupVersion: BACKUP_VERSION,
    plannerSchemaVersion: RUN_PLANNER_SCHEMA_VERSION, exportedAt: now.toISOString(), scope,
    activeRunId: data.activeRunId, runs: scope === 'active-run' ? [active] : data.runs });
}
export const serializeRunBackup = (backup: RunBackup): string => {
  const text = JSON.stringify(backup, null, 2) + '\n';
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error('This backup exceeds 32 MiB. Export individual runs or reduce the backup size.');
  return text;
};

export function backupFilename(backup: RunBackup): string {
  const name = backup.runs[0]?.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/g, '') || 'run';
  return `dw2-speedrunplanner-${backup.scope === 'active-run' ? `run-${name}` : 'backup'}-${backup.exportedAt.slice(0, 10)}.json`;
}

export function resolveImportedRunNames(existing: RunPlan[], imported: RunPlan[]): string[] {
  const names = new Set(existing.map(run => run.name));
  return imported.map(run => {
    let name = run.name;
    for (let index = 1; names.has(name); index++) name = `${run.name} (Imported${index === 1 ? '' : ` ${index}`})`;
    names.add(name);
    return name;
  });
}

/** Nested identities are run-local (including analysis event IDs). A new run ID
 * gives them a new namespace; retaining them preserves DNA ordering/provenance. */
export function prepareRunImport(data: PersistedRunPlannerData, input: RunBackup, makeId = newInstanceId): PersistedRunPlannerData {
  const backup = validateRunBackup(input);
  if (!isValidPersistedRunPlannerData(data)) throw invalid();
  const names = resolveImportedRunNames(data.runs, backup.runs);
  const ids = new Set([...data.runs, ...backup.runs].map(run => run.id));
  const mapping = new Map<string, string>();
  const runs = backup.runs.map((run, index) => {
    let id = '';
    for (let attempt = 0; attempt < 100; attempt++) { id = makeId(); if (id && !ids.has(id)) break; }
    if (!id || ids.has(id)) throw new Error('Could not create unique run identities. Please try again.');
    ids.add(id); mapping.set(run.id, id);
    return { ...run, id, name: names[index] };
  });
  const next = { ...data, runs: [...data.runs, ...runs], activeRunId: data.runs.length ? data.activeRunId : mapping.get(backup.activeRunId ?? '') ?? runs[0].id };
  if (!isValidPersistedRunPlannerData(next)) throw invalid();
  return next;
}
