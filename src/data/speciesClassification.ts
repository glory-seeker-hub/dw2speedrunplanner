/**
 * SPECIES CLASSIFICATION
 *
 * Distinguishes entities that can never enter the player's roster from normal species,
 * so validation does not report false "missing growth profile" warnings.
 *
 * Only entities with obvious existing game-data evidence are classified here
 * (they were added purely as battle-only entities). Everything else stays 'unclassified'.
 */
export type SpeciesClassification = 'recruitable' | 'battle-only' | 'unclassified';

/** Battle-only entities: story/boss constructs that are never recruitable. */
export const BATTLE_ONLY_SPECIES_IDS: string[] = [
  'dataguardian',
  'virusguardian',
  'vaccineguardian',
  'gaia1',
  'gaia2',
  'lefthand',
  'righthand',
];

const battleOnly = new Set(BATTLE_ONLY_SPECIES_IDS);

export const classifySpecies = (speciesId: string): SpeciesClassification =>
  battleOnly.has(speciesId) ? 'battle-only' : 'unclassified';

export const isBattleOnlySpecies = (speciesId: string): boolean =>
  battleOnly.has(speciesId);
