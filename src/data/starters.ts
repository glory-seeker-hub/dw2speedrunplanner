import { StarterDefinition } from '@/types/runPlanner';

/**
 * STARTER DEFINITIONS  (Phase 1 foundation)
 *
 * DEVELOPER NOTE: no authoritative starter data exists in this repository. The encounter
 * dataset only describes enemy teams, and digimons.ts baseStats are generic placeholders,
 * so they must NOT be used as starter stats. Nothing is invented here.
 *
 * To populate: add one entry per selectable starter with its real starting level, stats and techs.
 */
export const STARTERS: StarterDefinition[] = [];

export const getStarterById = (id: string): StarterDefinition | undefined =>
  STARTERS.find((s) => s.id === id);
