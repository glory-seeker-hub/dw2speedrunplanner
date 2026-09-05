import { DigimonGrowthProfile } from '@/types/runPlanner';
import { GROWTH_PROFILE_SOURCE, GrowthProfileSourceRecord } from '@/data/growthProfileSource';
import { getDigimonByName } from '@/utils/digimonLookup';

/**
 * SPECIES STAT-GROWTH PROFILES (generated from DW2_Lovable_JSON_Pack_v2 / growth_profiles.json)
 *
 * Source records are resolved to canonical project species through the shared
 * species lookup. Nothing is invented: a source name that does not resolve to exactly
 * one canonical species is reported instead of being guessed.
 */
export interface UnresolvedGrowthProfile {
  sourceRow: number;
  name: string;
  reason: string;
}

const resolved: DigimonGrowthProfile[] = [];
const unresolved: UnresolvedGrowthProfile[] = [];
const duplicates: string[] = [];
const seen = new Set<string>();

const isRate = (v: string): v is DigimonGrowthProfile['hpGrowth'] =>
  v === 'low' || v === 'normal' || v === 'high';

const invalidRates: { name: string; stat: string; value: string }[] = [];

for (const record of GROWTH_PROFILE_SOURCE as GrowthProfileSourceRecord[]) {
  const species = getDigimonByName(record.name);
  if (!species) {
    unresolved.push({
      sourceRow: record.sourceRow,
      name: record.name,
      reason: 'does not resolve to a canonical project species',
    });
    continue;
  }
  const rates = {
    hpGrowth: record.hpGrowth,
    mpGrowth: record.mpGrowth,
    atkGrowth: record.atkGrowth,
    defGrowth: record.defGrowth,
    spdGrowth: record.spdGrowth,
  };
  let ratesOk = true;
  for (const [stat, value] of Object.entries(rates)) {
    if (!isRate(value)) {
      invalidRates.push({ name: record.name, stat, value });
      ratesOk = false;
    }
  }
  if (!ratesOk) continue;
  if (seen.has(species.id)) {
    duplicates.push(species.id);
    continue;
  }
  seen.add(species.id);
  resolved.push({
    speciesId: species.id,
    rank: record.rank,
    hpGrowth: rates.hpGrowth,
    mpGrowth: rates.mpGrowth,
    atkGrowth: rates.atkGrowth,
    defGrowth: rates.defGrowth,
    spdGrowth: rates.spdGrowth,
  });
}

export const GROWTH_PROFILES: DigimonGrowthProfile[] = resolved;
export const GROWTH_PROFILE_SOURCE_COUNT = GROWTH_PROFILE_SOURCE.length;
export const UNRESOLVED_GROWTH_PROFILES: UnresolvedGrowthProfile[] = unresolved;
export const DUPLICATE_GROWTH_PROFILE_SPECIES: string[] = duplicates;
export const INVALID_GROWTH_RATE_VALUES = invalidRates;

const bySpeciesId = new Map(GROWTH_PROFILES.map((p) => [p.speciesId, p]));

export const getGrowthProfile = (
  speciesId: string
): DigimonGrowthProfile | undefined => bySpeciesId.get(speciesId);
