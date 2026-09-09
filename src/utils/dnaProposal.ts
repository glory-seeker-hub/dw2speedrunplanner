import { RosterDigimon } from '@/types/runPlanner';
import { previewDnaDigivolution } from '@/utils/dnaDigivolution';
import { calculateDnaTechniqueState } from '@/utils/techniqueInheritance';
import { buildTechniqueChoice, resolveTechniqueChoice } from '@/utils/techniqueCapacity';
import { isRosterDigimon } from '@/utils/runActionCheckpoint';
import { getSpeciesProgression } from '@/data/speciesProgression';
import { normalizeTechniqueName } from '@/data/techniqueMetadata';

/** No identity generation: an unresolved proposal is never a roster individual. */
export const proposeDnaChild = (a: RosterDigimon, b: RosterDigimon, keptKeys?: readonly string[]) => {
  const mechanical = previewDnaDigivolution(a, b);
  if (mechanical.status !== 'success') return mechanical;
  if (!isRosterDigimon(a) || !isRosterDigimon(b)) throw new Error('Invalid DNA parent roster state');
  const calculated = calculateDnaTechniqueState({ speciesId: mechanical.actualResultSpeciesId,
    actualRank: mechanical.actualResultRank, startingLevel: mechanical.startingLevel }, a, b);
  const own = getSpeciesProgression(mechanical.actualResultSpeciesId)?.ownTechnique;
  if (!own) throw new Error(`DNA result ${mechanical.actualResultName} has no authoritative own technique`);
  const choice = buildTechniqueChoice(calculated, calculated.techs, { kind: 'dna', mandatoryKeys: [normalizeTechniqueName(own)] });
  const resolution = resolveTechniqueChoice(choice, keptKeys);
  if (resolution.status === 'selection-required') return { status: 'selection-required' as const, mechanical, choice };
  const parentInstanceIds = [a.instanceId, b.instanceId].sort() as [string, string];
  const child: Omit<RosterDigimon, 'instanceId'> = {
    speciesId: mechanical.actualResultSpeciesId, name: mechanical.actualResultName,
    source: { type: 'dna', parentInstanceIds }, level: mechanical.startingLevel,
    totalXp: mechanical.childTotalXp, dp: mechanical.childDp, levelCap: { ...mechanical.childLevelCap },
    stats: { ...mechanical.childStats }, techs: resolution.techs, techniquePool: resolution.techniquePool,
  };
  return { status: 'ready' as const, mechanical, choice, child,
    techniqueChoice: { kept: choice.candidates.filter(p => resolution.keptKeys.includes(p.key)).map(p => p.name), discarded: resolution.discarded } };
};

/** Replace at the earliest occupied position; unaffected order is stable. */
export const replaceDnaParents = <T,>(items: readonly T[], id: (item: T) => string, parentIds: readonly string[], child: T): T[] => {
  const first = items.findIndex(item => parentIds.includes(id(item)));
  if (first < 0) return [...items];
  return items.flatMap((item, index) => index === first ? [child] : parentIds.includes(id(item)) ? [] : [item]);
};
