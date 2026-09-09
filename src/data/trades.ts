import { encounters } from '@/data/encounters';
import { getDigimonByName } from '@/utils/digimonLookup';

export interface TradeDefinition {
  readonly id: string;
  readonly giveSpeciesId: string;
  readonly receiveEncounterId: number;
  readonly fixedMaxLevel: number;
  readonly availabilityNote?: string;
}

const speciesId = (name: string) => {
  const species = getDigimonByName(name);
  if (!species) throw new Error(`Unresolved trade species: ${name}`);
  return species.id;
};

export const TRADE_DEFINITIONS: readonly TradeDefinition[] = Object.freeze(([
  ['ToyAgumon', 191, 14, 'Normally available around the first Video/Disk Domain period.'],
  ['Crabmon', 192, 19, 'Normally available around the first BIOS/Device Dome period.'],
  ['Numemon', 193, 27, 'Normally available around the Blood Knights / Modem-era progression.'],
  ['Garurumon', 194, 27, 'Normally available during the Blood Knights progression.'],
  ['N-Drimogemon', 195, 27, 'Normally available around Code/Laser Domain progression.'],
  ['D-Tyrannomon', 196, 27, 'Normally available around the later Blood Knights / Esteena progression.'],
  ['Angewomon', 197, 35, 'Normally available around the Bug/RAM/Soft Domain progression.'],
  ['M-Seadramon', 198, 35, 'Normally available before/around the Kernel Zone progression.'],
  ['SkullGreymon', 199, 33, 'Normally available in the late/post-game period.'],
] as const).map(([give, encounter, cap, note]) => Object.freeze({
  id: `trade-${encounter}`, giveSpeciesId: speciesId(give), receiveEncounterId: encounter,
  fixedMaxLevel: cap, availabilityNote: note,
})));

export const getTradeDefinition = (id: string) => TRADE_DEFINITIONS.find(t => t.id === id);

// Drift assertions only. Received state is always copied from encounters, never from these fixtures.
const RECEIPT_ASSERTIONS = [
  ['SnowAgumon', 3, 41, 42, 38, 40, 19, ['Hail Storm', 'Rock Fist']],
  ['Wizardmon', 11, 102, 79, 49, 52, 31, ['Thunder Ball', 'Necro Magic']],
  ['Megadramon', 21, 188, 210, 85, 73, 52, ['Darkside Attack', 'Wing Blade']],
  ['MagnaAngemon', 21, 195, 183, 76, 81, 49, ['HP Recovery', 'Magical Tail']],
  ['MetalMamemon', 21, 214, 176, 80, 79, 51, ['Energetic Bomb', 'Fire Blast II']],
  ['Myotismon', 21, 161, 203, 96, 77, 50, ['Grisly Wing', 'Full Recovery']],
  ['Magnadramon', 31, 285, 281, 99, 112, 62, ['Fire Tornado', 'Sad Water Blast']],
  ['M-Garurumon', 31, 298, 267, 110, 113, 83, ['Freeze Breath', 'Venom Infusion']],
  ['Machinedramon', 31, 249, 280, 125, 102, 82, ['Giga Cannon', 'Giga Scissor Claw']],
] as const;

export const getTradeReceipt = (tradeId: string) => {
  const trade = getTradeDefinition(tradeId);
  if (!trade) throw new Error('Unknown trade definition');
  const matches = encounters.filter(e => e.id === trade.receiveEncounterId);
  const record = matches[0]?.digimons[0];
  const expected = RECEIPT_ASSERTIONS[trade.receiveEncounterId - 191];
  if (matches.length !== 1 || matches[0].digimons.length !== 1 || !record || record.slot !== 1 ||
      JSON.stringify([record.name, record.level, record.hp, record.mp, record.atk, record.def, record.spd, record.techs]) !== JSON.stringify(expected)) {
    throw new Error(`Authoritative trade encounter ${trade.receiveEncounterId} has drifted`);
  }
  return { trade, record: structuredClone(record), speciesId: speciesId(record.name) };
};

// Fail loudly at startup as well as rechecking the source on every preview/recording.
TRADE_DEFINITIONS.forEach(t => getTradeReceipt(t.id));
