import { TeamDigimon, Digimon } from '@/types/digimon';
import { RosterDigimon } from '@/types/runPlanner';
import { getDigimonById, getDigimonByName } from '@/utils/digimonLookup';
import { TECHS } from '@/data/techs';

/**
 * Adapter between the Run Planner model and the existing Battle Simulator model.
 * The battle engine is untouched — this only maps data shapes.
 */
export const rosterDigimonToTeamDigimon = (
  entry: RosterDigimon
): TeamDigimon | null => {
  const species: Digimon | undefined =
    getDigimonById(entry.speciesId) ?? getDigimonByName(entry.name);
  if (!species) return null;

  const techs = entry.techs
    .map((name) => TECHS.find((t) => t.name === name))
    .filter((t): t is (typeof TECHS)[number] => Boolean(t));

  return {
    digimon: species,
    customStats: { ...entry.stats },
    techs,
  };
};

/** Converts a digiline (instance IDs) into the simulator's team format. */
export const digilineToTeam = (
  digiline: string[],
  roster: RosterDigimon[]
): TeamDigimon[] =>
  digiline
    .map((id) => roster.find((r) => r.instanceId === id))
    .filter((r): r is RosterDigimon => Boolean(r))
    .map(rosterDigimonToTeamDigimon)
    .filter((t): t is TeamDigimon => Boolean(t));
