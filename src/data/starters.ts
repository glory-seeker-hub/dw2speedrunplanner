import { StarterDefinition } from '@/types/runPlanner';
import { encounters } from '@/data/encounters';
import { getDigimonByName } from '@/utils/digimonLookup';
import { getRequiredTotalXpForLevel } from '@/utils/experience';

/**
 * STARTER DEFINITIONS
 *
 * The three selectable starters. Their authoritative Lv1 stat records live in
 * encounters.ts (special starter records 182/183/184), so they are read from there
 * instead of being duplicated.
 *
 * Starter identity (id/label/species) stays explicit here, and building fails loudly if
 * a future encounter refactor removes or changes a referenced record — so starters can
 * never silently disappear.
 */
interface StarterSeed {
  id: string;
  label: string;
  /** Authoritative encounter record holding the Lv1 starter stats. */
  encounterId: number;
  expectedName: string;
  expectedLevel: 1;
  expectedTechs: string[];
}

const STARTER_SEEDS: StarterSeed[] = [
  {
    id: 'gold-hawk',
    label: 'Gold Hawk',
    encounterId: 183,
    expectedName: 'Agumon',
    expectedLevel: 1,
    expectedTechs: ['Pepper Breath'],
  },
  {
    id: 'blue-falcon',
    label: 'Blue Falcon',
    encounterId: 182,
    expectedName: 'Patamon',
    expectedLevel: 1,
    expectedTechs: ['Boom Bubble'],
  },
  {
    id: 'black-sword',
    label: 'Black Sword',
    encounterId: 184,
    expectedName: 'DemiDevimon',
    expectedLevel: 1,
    expectedTechs: ['Demi Dart'],
  },
];

export interface StarterBuildIssue {
  starterId: string;
  message: string;
}

export const STARTER_BUILD_ISSUES: StarterBuildIssue[] = [];

const buildStarter = (seed: StarterSeed): StarterDefinition | null => {
  const encounter = encounters.find((e) => e.id === seed.encounterId);
  const record = encounter?.digimons.find((d) => d.slot === 1);

  if (!record) {
    STARTER_BUILD_ISSUES.push({
      starterId: seed.id,
      message: `Encounter ${seed.encounterId} (slot 1) not found — starter stats unavailable.`,
    });
    return null;
  }
  if (record.name !== seed.expectedName || record.level !== seed.expectedLevel) {
    STARTER_BUILD_ISSUES.push({
      starterId: seed.id,
      message: `Encounter ${seed.encounterId} no longer matches ${seed.expectedName} Lv${seed.expectedLevel} (found ${record.name} Lv${record.level}).`,
    });
    return null;
  }

  const species = getDigimonByName(record.name);
  if (!species) {
    STARTER_BUILD_ISSUES.push({
      starterId: seed.id,
      message: `Species "${record.name}" cannot be resolved.`,
    });
    return null;
  }

  const techs = seed.expectedTechs.every((t) => record.techs.includes(t))
    ? [...record.techs]
    : [...seed.expectedTechs];

  return {
    id: seed.id,
    label: seed.label,
    speciesId: species.id,
    name: species.name,
    level: record.level,
    stats: {
      hp: record.hp,
      mp: record.mp,
      atk: record.atk,
      def: record.def,
      spd: record.spd,
    },
    techs,
    totalXp: getRequiredTotalXpForLevel(record.level) ?? 0,
  };
};

export const STARTERS: StarterDefinition[] = STARTER_SEEDS.map(buildStarter).filter(
  (s): s is StarterDefinition => s !== null
);

export const getStarterById = (id: string): StarterDefinition | undefined =>
  STARTERS.find((s) => s.id === id);
