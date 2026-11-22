import { getStarterById } from '@/data/starters';
import { getDigimonById } from '@/utils/digimonLookup';

export const CORE_TOWER_GUARDIAN_IDS = [146, 148, 150] as const;

/** Initial starter species only: current roster/evolutions never affect this choice. */
export const getCoreTowerGuardianEncounterId = (starterDefinitionId: string): number | undefined => {
  const starter = getStarterById(starterDefinitionId);
  const type = starter && getDigimonById(starter.speciesId)?.type;
  switch (type) {
    case 'Vaccine': return 148;
    case 'Data': return 146;
    case 'Virus': return 150;
    default: return undefined;
  }
};

export const isCoreTowerGuardianLocation = (location: { domainId: string; phase: string; floor: number | null }) =>
  location.domainId === 'core-tower' && location.phase === 'after-blood-knights' && location.floor === 24;
