import { RosterDigimon, StarterDefinition } from '@/types/runPlanner';
import { encounters } from '@/data/encounters';
import { getDigimonByName } from '@/utils/digimonLookup';

const newInstanceId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `inst-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Creates a roster Digimon from an enemy record in an encounter.
 * All values come directly from encounters.ts — never from generic species baseStats.
 */
export const createCapturedDigimon = (
  encounterId: number,
  enemySlot: number
): RosterDigimon | null => {
  const encounter = encounters.find((e) => e.id === encounterId);
  if (!encounter) return null;

  const enemy = encounter.digimons.find((d) => d.slot === enemySlot);
  if (!enemy) return null;

  const species = getDigimonByName(enemy.name);

  return {
    instanceId: newInstanceId(),
    speciesId: species?.id ?? enemy.name.toLowerCase(),
    name: species?.name ?? enemy.name,
    source: { type: 'capture', encounterId, enemySlot },
    level: enemy.level,
    totalXp: 0,
    stats: {
      hp: enemy.hp,
      mp: enemy.mp,
      atk: enemy.atk,
      def: enemy.def,
      spd: enemy.spd,
    },
    techs: [...enemy.techs],
  };
};

/** Creates the initial roster Digimon from a starter definition. */
export const createStarterDigimon = (starter: StarterDefinition): RosterDigimon => ({
  instanceId: newInstanceId(),
  speciesId: starter.speciesId,
  name: starter.name,
  source: { type: 'starter' },
  level: starter.level,
  totalXp: starter.totalXp ?? 0,
  stats: { ...starter.stats },
  techs: [...starter.techs],
});

export { newInstanceId };
