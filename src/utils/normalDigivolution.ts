import { METALKID_DIGIMON_SOURCE, METALKID_EVOLUTION_SOURCE } from '@/data/evolutionSource';
import { getSpeciesProgression } from '@/data/speciesProgression';
import { getDigimonById, getDigimonByName } from '@/utils/digimonLookup';
import { RosterDigimon } from '@/types/runPlanner';

const ids = new Map<number, string | undefined>(METALKID_DIGIMON_SOURCE.map(r => [r.id, getDigimonByName(r.name)?.id]));
export const EVOLUTION_RANGES = METALKID_EVOLUTION_SOURCE.map(r => {
  const from = ids.get(r.from), to = ids.get(r.to);
  return { id: r.id, from, to, min: r.min, max: r.max as number | null };
});
export type EvolutionLookup =
  | { status: 'unique'; targetSpeciesId: string }
  | { status: 'unavailable' }
  | { status: 'ambiguous'; candidateSpeciesIds: string[] }
  | { status: 'invalid'; reason: string };

export const lookupNormalEvolution = (speciesId: string, dp: number): EvolutionLookup => {
  if (!Number.isInteger(dp) || dp < 0 || !getDigimonById(speciesId)) return { status: 'invalid', reason: 'Invalid species or DP' };
  const matches = EVOLUTION_RANGES.filter(r => r.from === speciesId && dp >= r.min && (r.max === null || dp <= r.max));
  if (matches.some(r => !r.to)) return { status: 'invalid', reason: 'Unresolved evolution endpoint' };
  const candidates = [...new Set(matches.map(r => r.to!))];
  if (!candidates.length) return { status: 'unavailable' };
  return candidates.length === 1 ? { status: 'unique', targetSpeciesId: candidates[0] }
    : { status: 'ambiguous', candidateSpeciesIds: candidates };
};

const thresholds = { Rookie: { level: 11, target: 'Champion' }, Champion: { level: 21, target: 'Ultimate' }, Ultimate: { level: 31, target: 'Mega' } };
export const getNormalDigivolutionRule = (speciesId: string) => {
  const metadata = getSpeciesProgression(speciesId);
  return metadata && thresholds[metadata.rank as keyof typeof thresholds];
};
export type DigivolutionPreview = { canDigivolve: true; targetSpeciesId: string; digimon: RosterDigimon }
  | { canDigivolve: false; reason: string };

export const previewNormalDigivolution = (entry: RosterDigimon): DigivolutionPreview => {
  const rule = getNormalDigivolutionRule(entry.speciesId);
  if (!rule) return { canDigivolve: false, reason: 'No normal higher rank or missing progression metadata' };
  if (!Number.isInteger(entry.level) || entry.level < rule.level) return { canDigivolve: false, reason: `Requires EL${rule.level}` };
  const lookup = lookupNormalEvolution(entry.speciesId, entry.dp);
  if (lookup.status !== 'unique') return { canDigivolve: false, reason: `Evolution target is ${lookup.status}` };
  const target = getDigimonById(lookup.targetSpeciesId);
  if (!target || getSpeciesProgression(target.id)?.rank !== rule.target) return { canDigivolve: false, reason: 'Invalid target rank metadata' };
  return { canDigivolve: true, targetSpeciesId: target.id, digimon: { ...entry,
    speciesId: target.id, name: target.name, source: { ...entry.source }, levelCap: { ...entry.levelCap },
    stats: { ...entry.stats, hp: entry.stats.hp + 30, mp: entry.stats.mp + 30 }, techs: [...entry.techs] } };
};

export const applyNormalDigivolution = (entry: RosterDigimon): RosterDigimon => {
  const result = previewNormalDigivolution(entry);
  if (result.canDigivolve === false) throw new Error(result.reason);
  return result.digimon;
};

export const getLearnedTechniques = (entry: RosterDigimon, newLevel: number): string[] => {
  const metadata = getSpeciesProgression(entry.speciesId);
  const unlock = { Champion: 12, Ultimate: 22, Mega: 32 };
  const tech = metadata?.ownTechnique;
  return tech && newLevel === entry.level + 1 && newLevel === unlock[metadata.rank as keyof typeof unlock] && !entry.techs.includes(tech) ? [tech] : [];
};
