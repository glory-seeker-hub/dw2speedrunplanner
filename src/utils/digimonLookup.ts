import { Digimon } from '@/types/digimon';
import { DIGIMONS } from '@/data/digimons';

/**
 * Canonical species lookup. Use these helpers instead of scattering string comparisons.
 *
 * IMPORTANT: `baseStats` in src/data/digimons.ts are generic placeholders
 * (hp 1000 / mp 200 / atk 150 / def 120 / spd 100) and are NOT real DW2 values.
 * They exist only for the Battle Simulator's editable defaults. The Run Planner must never
 * use them to estimate captured Digimon or level progression — use encounter records
 * (see utils/capture.ts) or starter data instead.
 */

/** Species metadata only — no runtime/player-instance stats. */
export interface DigimonSpecies {
  id: string;
  name: string;
  type: Digimon['type'];
  specialty: Digimon['specialty'];
}

/** Centralized alias table for naming differences between data files. */
export const DIGIMON_NAME_ALIASES: Record<string, string> = {
  dokunemmon: 'dokunemon',
  mudfrigimon: 'mudfrigimon',
};

export const normalizeDigimonName = (name: string): string => {
  const key = (name ?? '')
    .toLowerCase()
    .replace(/[\s._'’-]/g, '');
  return DIGIMON_NAME_ALIASES[key] ?? key;
};

const byNormalizedName = new Map<string, Digimon>();
const byId = new Map<string, Digimon>();
for (const d of DIGIMONS) {
  byNormalizedName.set(normalizeDigimonName(d.name), d);
  byId.set(d.id, d);
}

export const getDigimonByName = (name: string): Digimon | undefined =>
  byNormalizedName.get(normalizeDigimonName(name));

export const getDigimonById = (id: string): Digimon | undefined => byId.get(id);

export const getSpecies = (nameOrId: string): DigimonSpecies | undefined => {
  const d = getDigimonById(nameOrId) ?? getDigimonByName(nameOrId);
  if (!d) return undefined;
  return { id: d.id, name: d.name, type: d.type, specialty: d.specialty };
};

export const ALL_SPECIES: DigimonSpecies[] = DIGIMONS.map((d) => ({
  id: d.id,
  name: d.name,
  type: d.type,
  specialty: d.specialty,
}));
