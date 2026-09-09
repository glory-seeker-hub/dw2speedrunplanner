import { SPECIES_PROGRESSION } from '@/data/speciesProgression';
import { DigimonRank } from '@/types/techniqueInheritance';

const spellingKey = (name: string): string => name.toLowerCase().replace(/[\s._'’-]/g, '');
const aliases: Readonly<Record<string, string>> = {
  blazeblaster: 'Blaze Buster',
  flercannon: 'Flower Cannon',
  ninjafler: 'Ninja Flower',
};

/** Only reviewed aliases and punctuation/case normalization; never fuzzy matching. */
export const normalizeTechniqueName = (name: string): string =>
  spellingKey(aliases[spellingKey(name)] ?? name);

export const buildTechniqueMetadata = (rows: readonly { ownTechnique: string | null; rank: DigimonRank }[]) => {
  const result = new Map<string, { key: string; name: string; rank: DigimonRank }>();
  for (const row of rows) {
    if (!row.ownTechnique) continue;
    const key = normalizeTechniqueName(row.ownTechnique);
    const previous = result.get(key);
    if (previous && previous.rank !== row.rank) throw new Error(`Conflicting technique rank: ${key}`);
    if (!previous) result.set(key, { key, name: aliases[spellingKey(row.ownTechnique)] ?? row.ownTechnique, rank: row.rank });
  }
  return result;
};

const metadata = buildTechniqueMetadata(SPECIES_PROGRESSION);
export const getTechniqueIdentity = (name: string) => {
  const value = metadata.get(normalizeTechniqueName(name));
  return value ? { ...value } : undefined;
};
export const getTechniqueRank = (name: string): DigimonRank | undefined => getTechniqueIdentity(name)?.rank;
export const TECHNIQUE_UNLOCK_LEVELS: Readonly<Record<DigimonRank, number>> = {
  Rookie: 2, Champion: 12, Ultimate: 22, Mega: 32,
};
