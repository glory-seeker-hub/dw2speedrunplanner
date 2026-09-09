import { getTradeReceipt } from '@/data/trades';
import { RosterDigimon } from '@/types/runPlanner';
import { createAvailableTechniqueState } from '@/utils/techniqueInheritance';
import { getRequiredTotalXpForLevel } from '@/utils/experience';

/** Reference preview only: no generated identity and no mutation of a run or given individual. */
export const previewTrade = (tradeId: string) => {
  const { trade, record, speciesId } = getTradeReceipt(tradeId);
  const totalXp = getRequiredTotalXpForLevel(record.level);
  if (totalXp === null) throw new Error(`No authoritative XP threshold for trade EL${record.level}`);
  return { trade, received: {
    speciesId, name: record.name, level: record.level, dp: 0, totalXp,
    levelCap: { min: trade.fixedMaxLevel, max: trade.fixedMaxLevel, resolved: trade.fixedMaxLevel },
    stats: { hp: record.hp, mp: record.mp, atk: record.atk, def: record.def, spd: record.spd },
    ...createAvailableTechniqueState(record.techs, { type: 'trade', tradeId }),
  } };
};

export const createTradeReceivedProposal = (tradeId: string, given: Pick<RosterDigimon, 'instanceId' | 'speciesId'>): Omit<RosterDigimon, 'instanceId'> => {
  const { trade, received } = previewTrade(tradeId);
  if (!given.instanceId?.trim() || given.speciesId !== trade.giveSpeciesId) throw new Error('The selected Digimon does not match the required Give species');
  return { ...received, source: { type: 'trade', tradeId, givenInstanceId: given.instanceId } };
};
