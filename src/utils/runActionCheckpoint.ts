import { DigimonStats } from '@/types/digimon';
import { MAX_DIGILINE_SIZE, RosterDigimon, RunActionCheckpoint, RunPlan } from '@/types/runPlanner';
import { isValidLevelCap } from '@/utils/levelCap';

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

export const isRosterDigimon = (v: unknown): v is RosterDigimon =>
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
  isStringArray(v.techs) &&
  Number.isInteger(v.dp) && (v.dp as number) >= 0 &&
  isValidLevelCap(v.levelCap) && v.level <= (v.levelCap.resolved ?? v.levelCap.max);

/** Shared by storage and Undo: reject malformed or recursive checkpoint payloads. */
export const isValidRunActionCheckpoint = (v: unknown): v is RunActionCheckpoint => {
  if (!isObject(v) || Object.keys(v).some(key => !['roster', 'digiline', 'totalBits'].includes(key))) return false;
  if (!Array.isArray(v.roster) || !v.roster.every(isRosterDigimon)) return false;
  if (!isStringArray(v.digiline) || v.digiline.length > MAX_DIGILINE_SIZE) return false;
  if (!isNonNegativeNumber(v.totalBits)) return false;
  const ids = new Set(v.roster.map(member => member.instanceId));
  return ids.size === v.roster.length && new Set(v.digiline).size === v.digiline.length &&
    v.digiline.every(id => ids.has(id));
};

/** Snapshot only progression state, never the history containing this checkpoint. */
export const createRunActionCheckpoint = (run: RunPlan): RunActionCheckpoint => structuredClone({
  roster: run.roster, digiline: run.digiline, totalBits: run.totalBits,
});
