import { getDigimonById, getDigimonByName } from '@/utils/digimonLookup';
import { getRequiredTotalXpForLevel } from '@/utils/experience';

/** Unknown special entities retain their existing fallback identity; known species must agree. */
export const hasConsistentRosterIdentity = (speciesId: string, name: string): boolean => {
  const byId = getDigimonById(speciesId), byName = getDigimonByName(name);
  return (!byId || byId.name === name) && (!byName || byName.id === speciesId);
};

export const hasSufficientLevelXp = (level: number, totalXp: number): boolean => {
  const threshold = getRequiredTotalXpForLevel(level);
  return threshold === null || totalXp >= threshold;
};
