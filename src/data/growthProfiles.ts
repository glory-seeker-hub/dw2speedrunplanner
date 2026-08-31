import { DigimonGrowthProfile } from '@/types/runPlanner';

/**
 * SPECIES STAT-GROWTH PROFILES  (Phase 1 foundation)
 *
 * DEVELOPER NOTE: no authoritative DW2 growth rates exist anywhere in this repository.
 * Nothing is invented here — keep this empty until real data is supplied.
 *
 * To populate: one entry per species, keyed by the species `id` from src/data/digimons.ts.
 */
export const GROWTH_PROFILES: DigimonGrowthProfile[] = [];

const bySpeciesId = new Map(GROWTH_PROFILES.map((p) => [p.speciesId, p]));

export const getGrowthProfile = (
  speciesId: string
): DigimonGrowthProfile | undefined => bySpeciesId.get(speciesId);
