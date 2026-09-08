import { INITIAL_LEVEL_CAP_RULES } from '@/data/progressionSource';
import { LevelCapState } from '@/types/runPlanner';

export const isValidLevelCap = (value: unknown): value is LevelCapState => {
  if (!value || typeof value !== 'object') return false;
  const c = value as LevelCapState;
  return Number.isInteger(c.min) && Number.isInteger(c.max) && c.min >= 1 && c.max >= c.min &&
    (c.resolved === null ? c.min < c.max : Number.isInteger(c.resolved) && c.resolved >= c.min && c.resolved <= c.max);
};

export const getInitialLevelCap = (startingLevel: number): LevelCapState | null => {
  if (!Number.isInteger(startingLevel)) return null;
  const rule = INITIAL_LEVEL_CAP_RULES[String(startingLevel) as keyof typeof INITIAL_LEVEL_CAP_RULES];
  return rule ? { min: rule.min, max: rule.max, resolved: rule.min === rule.max ? rule.min : null } : null;
};

export const getResolvedMaxLevel = (cap: LevelCapState): number | null => {
  if (!isValidLevelCap(cap)) throw new Error('Invalid level cap');
  return cap.resolved;
};

export const resolveLevelCap = (cap: LevelCapState, chosen: number): LevelCapState => {
  if (!isValidLevelCap(cap) || !Number.isInteger(chosen) || chosen < cap.min || chosen > cap.max) {
    throw new Error('Choose an integer within the individual level-cap range');
  }
  return { ...cap, resolved: chosen };
};

/** Inclusive authoritative choices; never selects an individual cap implicitly. */
export const getLevelCapChoices = (cap: LevelCapState): number[] =>
  Array.from({ length: cap.max - cap.min + 1 }, (_, index) => cap.min + index);

export const getAcquisitionLevelCap = (level: number, selected?: number | null): LevelCapState => {
  const cap = getInitialLevelCap(level);
  if (!cap) throw new Error('No authoritative acquisition cap for EL' + level);
  if (cap.resolved !== null && selected == null) return cap;
  if (selected == null) throw new Error('Select the exact Maximum EL before recording capture.');
  return resolveLevelCap(cap, selected);
};
