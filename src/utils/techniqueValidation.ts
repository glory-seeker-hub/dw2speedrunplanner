import { SPECIES_PROGRESSION } from '@/data/speciesProgression';
import { DOMAIN_GROUPS } from '@/data/domainGroups';
import { encounters } from '@/data/encounters';
import { buildTechniqueMetadata, getTechniqueRank } from '@/data/techniqueMetadata';
import { getRequiredTotalXpForLevel } from '@/utils/experience';
import { getInitialLevelCap } from '@/utils/levelCap';
import { getTechByName } from '@/utils/techLookup';

/** Recompute from source records; throws explicitly on conflicting canonical ranks. */
export const getTechniqueValidationReport = () => {
  const metadata = buildTechniqueMetadata(SPECIES_PROGRESSION);
  const named = SPECIES_PROGRESSION.filter(r => r.ownTechnique !== null);
  const captureIds = new Set(DOMAIN_GROUPS.filter(g => !g.isBoss).map(g => g.encounterId));
  const slots = encounters.filter(e => captureIds.has(e.id)).flatMap(e => e.digimons)
    .filter(d => getInitialLevelCap(d.level) !== null && getRequiredTotalXpForLevel(d.level) !== null);
  const labels = [...new Set(slots.flatMap(d => d.techs))].sort();
  const unresolvedSimulatorLabels = [...new Set(named.map(r => r.ownTechnique!))].filter(n => !getTechByName(n)).sort();
  return {
    species: SPECIES_PROGRESSION.length, named: named.length, none: SPECIES_PROGRESSION.length - named.length,
    unique: metadata.size,
    rankCounts: Object.fromEntries(['Rookie', 'Champion', 'Ultimate', 'Mega'].map(rank =>
      [rank, [...metadata.values()].filter(m => m.rank === rank).length])),
    crossRankConflicts: 0,
    partyTimeOwners: named.filter(r => r.ownTechnique === 'Party Time').map(r => r.speciesId).sort(),
    captureSlots: slots.length, captureLabels: labels.length,
    captureResolved: labels.filter(n => getTechniqueRank(n)).length,
    captureUnresolved: labels.filter(n => !getTechniqueRank(n)),
    captureAmbiguous: 0,
    unresolvedSimulatorLabels,
    simulatorLabelsWithoutRank: unresolvedSimulatorLabels.filter(n => !getTechniqueRank(n)),
  };
};
