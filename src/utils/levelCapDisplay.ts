import { RosterDigimon } from '@/types/runPlanner';

/** Presentation of persisted state only; never resolves a cap or applies progression. */
export const getLevelCapDisplay = ({ level, levelCap }: Pick<RosterDigimon, 'level' | 'levelCap'>) => {
  const isUnresolved = levelCap.resolved === null;
  const isMax = !isUnresolved && level >= levelCap.resolved;
  const requiresResolution = isUnresolved && level >= levelCap.min;
  return {
    currentLevel: level,
    knownMaxLevel: levelCap.resolved,
    rangeMin: levelCap.min,
    rangeMax: levelCap.max,
    isMax,
    isUnresolved,
    requiresResolution,
    levelLabel: isUnresolved ? `EL ${level} · Max EL ${levelCap.min}–${levelCap.max}` : `EL ${level} / ${levelCap.resolved}`,
    statusLabel: isMax ? 'MAX' : requiresResolution ? 'Cap resolution required' : isUnresolved ? 'Cap unresolved' : null,
  };
};
