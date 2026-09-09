import { RunActionCheckpoint, RunTradeEvent } from '@/types/runPlanner';
import { createTradeReceivedProposal } from '@/utils/tradeProposal';

export const isValidTradeEvent = (v: Record<string, unknown>, checkpoint: RunActionCheckpoint): v is Record<string, unknown> & RunTradeEvent => {
  try {
    if (typeof v.tradeId !== 'string' || typeof v.givenInstanceId !== 'string' ||
        typeof v.receivedInstanceId !== 'string' || !v.receivedInstanceId.trim() ||
        checkpoint.roster.some(p => p.instanceId === v.receivedInstanceId)) return false;
    const given = checkpoint.roster.find(p => p.instanceId === v.givenInstanceId);
    if (!given || given.speciesId !== v.givenSpeciesId || given.name !== v.givenName) return false;
    const received = createTradeReceivedProposal(v.tradeId, given);
    return v.receivedSpeciesId === received.speciesId && v.receivedName === received.name &&
      v.receivedLevel === received.level && v.receivedDp === 0 && v.receivedMaxLevel === received.levelCap.resolved;
  } catch { return false; }
};
