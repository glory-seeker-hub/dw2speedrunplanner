import { TeamDigimon, Digimon } from '@/types/digimon';
import { RosterDigimon } from '@/types/runPlanner';
import { getDigimonById, getDigimonByName } from '@/utils/digimonLookup';
import { resolveTechNames } from '@/utils/techLookup';

/**
 * Adapter between the Run Planner model and the existing Battle Simulator model.
 * The battle engine is untouched — this only maps data shapes.
 *
 * It stays defensive (unresolved techs are dropped) but reports them so validation
 * can surface missing tech mappings instead of losing them silently.
 */
export interface AdapterResult {
  team: TeamDigimon[];
  unresolvedTechs: { instanceId: string; techName: string }[];
  unresolvedInstanceIds: string[];
}

export const rosterDigimonToTeamDigimon = (
  entry: RosterDigimon
): TeamDigimon | null => {
  const species: Digimon | undefined =
    getDigimonById(entry.speciesId) ?? getDigimonByName(entry.name);
  if (!species) return null;

  const { resolved } = resolveTechNames(entry.techs);

  return {
    digimon: species,
    customStats: { ...entry.stats },
    techs: resolved,
  };
};

/** Converts a digiline (instance IDs) into the simulator's team format. */
export const digilineToTeam = (
  digiline: string[],
  roster: RosterDigimon[]
): TeamDigimon[] => digilineToTeamDetailed(digiline, roster).team;

/** Same conversion, but reports what could not be resolved. */
export const digilineToTeamDetailed = (
  digiline: string[],
  roster: RosterDigimon[]
): AdapterResult => {
  const team: TeamDigimon[] = [];
  const unresolvedTechs: AdapterResult['unresolvedTechs'] = [];
  const unresolvedInstanceIds: string[] = [];

  for (const id of digiline) {
    const entry = roster.find((r) => r.instanceId === id);
    if (!entry) {
      unresolvedInstanceIds.push(id);
      continue;
    }
    const { unresolved } = resolveTechNames(entry.techs);
    unresolved.forEach((techName) =>
      unresolvedTechs.push({ instanceId: entry.instanceId, techName })
    );
    const mapped = rosterDigimonToTeamDigimon(entry);
    if (mapped) team.push(mapped);
    else unresolvedInstanceIds.push(id);
  }

  return { team, unresolvedTechs, unresolvedInstanceIds };
};
