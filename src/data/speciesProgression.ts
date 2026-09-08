import { SPECIES_PROGRESSION_SOURCE } from '@/data/progressionSource';
import { getDigimonByName } from '@/utils/digimonLookup';

export const UNRESOLVED_PROGRESSION_SPECIES = SPECIES_PROGRESSION_SOURCE.filter(r => !getDigimonByName(r.name));
export const SPECIES_PROGRESSION = SPECIES_PROGRESSION_SOURCE.flatMap(r => {
  const species = getDigimonByName(r.name);
  return species ? [{ speciesId: species.id, rank: r.rank, type: r.type,
    ownTechnique: r.ownTechnique === '-None-' ? null : r.ownTechnique,
    workbookDp0Evolution: r.dp0Evolution ? getDigimonByName(r.dp0Evolution)?.id ?? null : null }] : [];
});
const byId = new Map(SPECIES_PROGRESSION.map(r => [r.speciesId, r]));
export const getSpeciesProgression = (speciesId: string) => byId.get(speciesId);
