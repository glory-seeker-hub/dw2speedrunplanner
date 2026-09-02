import { DigimonGrowthProfile } from '@/types/runPlanner';

/**
 * SPECIES STAT-GROWTH PROFILES
 *
 * DEVELOPER NOTE: no authoritative DW2 per-species growth classification (stage/rank +
 * Low/Normal/High per stat) exists anywhere in this repository or in the imported
 * spreadsheet. Nothing is invented here — this stays empty until real data is supplied.
 *
 * To populate: one entry per RECRUITABLE species, keyed by the species `id`
 * from src/data/digimons.ts. Battle-only entities (see data/speciesClassification.ts)
 * must not get profiles.
 */
export const GROWTH_PROFILES: DigimonGrowthProfile[] = [];

const bySpeciesId = new Map(GROWTH_PROFILES.map((p) => [p.speciesId, p]));

export const getGrowthProfile = (
  speciesId: string
): DigimonGrowthProfile | undefined => bySpeciesId.get(speciesId);
