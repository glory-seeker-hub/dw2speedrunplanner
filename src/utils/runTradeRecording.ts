import { RunPlan, RosterDigimon, RunTradeEvent } from '@/types/runPlanner';
import { createTradeReceivedProposal } from '@/utils/tradeProposal';
import { createRunActionCheckpoint } from '@/utils/runActionCheckpoint';
import { validateRunPlan } from '@/utils/runInvariants';
import { getHistoricalInstanceIds } from '@/utils/runInstanceLifecycle';
import { newInstanceId } from '@/utils/capture';

export const recordTradeAction = (run: RunPlan, tradeId: string, givenId: string, generateId: () => string = newInstanceId) => {
  const violations = validateRunPlan(run);
  if (violations.length) throw new Error(violations.map(v => v.message).join(' '));
  const given = run.roster.find(p => p.instanceId === givenId);
  if (!given) throw new Error('The given Digimon must be in the current roster');
  const proposal = createTradeReceivedProposal(tradeId, given);
  const used = getHistoricalInstanceIds(run);
  run.history.forEach(e => used.add(e.id));
  const freshId = () => {
    const id = generateId();
    if (typeof id !== 'string' || !id.trim() || used.has(id)) throw new Error('Could not generate a fresh Trade ID');
    used.add(id); return id;
  };
  const received: RosterDigimon = { ...proposal, instanceId: freshId() };
  const event: RunTradeEvent = {
    type: 'trade', id: freshId(), order: run.history.length, preActionCheckpoint: createRunActionCheckpoint(run),
    tradeId, givenInstanceId: givenId, givenSpeciesId: given.speciesId, givenName: given.name,
    receivedInstanceId: received.instanceId, receivedSpeciesId: received.speciesId, receivedName: received.name,
    receivedLevel: received.level, receivedDp: 0, receivedMaxLevel: received.levelCap.resolved!,
  };
  const next: RunPlan = { ...run,
    roster: run.roster.map(p => p.instanceId === givenId ? received : p),
    digiline: run.digiline.map(id => id === givenId ? received.instanceId : id),
    history: [...run.history, event], updatedAt: new Date().toISOString(),
  };
  const errors = validateRunPlan(next);
  if (errors.length) throw new Error(errors.map(e => e.message).join(' '));
  return { run: next, event, received };
};
