import { RosterDigimon, StarterDefinition } from '@/types/runPlanner';
import { encounters } from '@/data/encounters';
import { getDigimonByName } from '@/utils/digimonLookup';
import { getRequiredTotalXpForLevel } from '@/utils/experience';

const newInstanceId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `inst-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export type CaptureResult =
  | { ok: true; digimon: RosterDigimon }
  | { ok: false; reason: string };

/**
 * Creates a roster Digimon from an enemy record in an encounter.
 * All values come directly from encounters.ts — never from generic species baseStats.
 *
 * GAME RULE: a recruited wild Digimon starts with the CUMULATIVE XP threshold of its
 * level (Lv5 -> 57, Lv12 -> 600, ...). If that threshold is unknown the capture fails
 * explicitly — it never falls back to zero.
 */
export const tryCreateCapturedDigimon = (
  encounterId: number,
  enemySlot: number
): CaptureResult => {
  const encounter = encounters.find((e) => e.id === encounterId);
  if (!encounter) return { ok: false, reason: `Unknown encounter ${encounterId}` };

  const enemy = encounter.digimons.find((d) => d.slot === enemySlot);
  if (!enemy) {
    return { ok: false, reason: `Encounter ${encounterId} has no slot ${enemySlot}` };
  }

  const totalXp = getRequiredTotalXpForLevel(enemy.level);
  if (totalXp === null) {
    return {
      ok: false,
      reason: `No verified cumulative XP threshold for level ${enemy.level} — cannot create capture without fabricating XP.`,
    };
  }

  const species = getDigimonByName(enemy.name);

  return {
    ok: true,
    digimon: {
      instanceId: newInstanceId(),
      speciesId: species?.id ?? enemy.name.toLowerCase(),
      name: species?.name ?? enemy.name,
      source: { type: 'capture', encounterId, enemySlot },
      level: enemy.level,
      totalXp,
      stats: {
        hp: enemy.hp,
        mp: enemy.mp,
        atk: enemy.atk,
        def: enemy.def,
        spd: enemy.spd,
      },
      techs: [...enemy.techs],
    },
  };
};

/** Convenience wrapper: `null` when the capture cannot be created safely. */
export const createCapturedDigimon = (
  encounterId: number,
  enemySlot: number
): RosterDigimon | null => {
  const result = tryCreateCapturedDigimon(encounterId, enemySlot);
  return result.ok ? result.digimon : null;
};

/** Creates the initial roster Digimon from a starter definition. */
export const createStarterDigimon = (starter: StarterDefinition): RosterDigimon => ({
  instanceId: newInstanceId(),
  speciesId: starter.speciesId,
  name: starter.name,
  source: { type: 'starter' },
  level: starter.level,
  totalXp: starter.totalXp ?? getRequiredTotalXpForLevel(starter.level) ?? 0,
  stats: { ...starter.stats },
  techs: [...starter.techs],
});

export { newInstanceId };
