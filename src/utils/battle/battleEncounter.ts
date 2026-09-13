import type { Tech } from '@/types/digimon';
import type { Encounter } from '@/types/encounter';
import type { BattleTeamMember } from './battleTypes';
import { DOMAIN_GROUPS } from '@/data/domainGroups';
import { getDigimonByName } from '@/utils/digimonLookup';
import { requireEncounterTechs } from '@/utils/encounterBattleSkills';
/** Shared manual and historical encounter conversion. Metadata from species,
 * battle stats/slot/tech order from the exact encounter; boss only from reviewed groups. */
export function encounterToBattleTeam(encounter: Encounter, resolveTechs: (names: readonly string[]) => Tech[] = requireEncounterTechs): (BattleTeamMember & { level: number; encounterSlot: number })[] {
  return encounter.digimons.map(d => {
    const species = getDigimonByName(d.name);
    const stats = { hp: d.hp, mp: d.mp, atk: d.atk, def: d.def, spd: d.spd };
    return { isBoss: DOMAIN_GROUPS.some(group => group.encounterId === encounter.id && group.isBoss),
      level: d.level, encounterSlot: d.slot,
      digimon: structuredClone(species ?? { id: d.name, name: d.name, type: 'Data', specialty: 'None', baseStats: stats }),
      customStats: stats, techs: resolveTechs(d.techs) };
  });
}
