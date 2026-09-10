import { RunEvent, RunActionCheckpoint } from '@/types/runPlanner';
import { resolveBattle } from '@/utils/runProgression';
import { getEncountersForFloor } from '@/utils/runBattleSelection';
import { getBattleTechniqueChoices } from '@/utils/battleTechniqueChoices';
import { applyNormalDigivolution } from '@/utils/normalDigivolution';
import { proposeDnaChild, replaceDnaParents } from '@/utils/dnaProposal';
import { normalizeTechniqueName } from '@/data/techniqueMetadata';
import { createTradeReceivedProposal } from '@/utils/tradeProposal';

/** Property order is irrelevant; array order (including roster and techniques) is significant. */
export const equalRunState = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k =>
    Object.prototype.hasOwnProperty.call(y, k) && equalRunState(x[k], y[k]));
};

/** Replay one action only. Never call recording APIs, allocate IDs, or validate earlier history. */
export const deriveActionPostState = (event: RunEvent): Pick<RunActionCheckpoint, 'roster' | 'totalBits'> => {
  const before = event.preActionCheckpoint;
  if (event.type === 'battle') {
    const option = getEncountersForFloor(event.domainId, event.phase, event.floor)
      .find(o => o.encounterId === event.encounterId);
    if (!option?.preview?.reward || (event.capturedInstanceId !== null && option.isBoss)) throw new Error('Invalid encounter or capture location.');
    if (before.roster.some(p => before.digiline.includes(p.instanceId) && p.levelCap.resolved === null && p.level >= p.levelCap.min)) throw new Error('Participant Maximum EL is unresolved.');
    const choices = getBattleTechniqueChoices(before.roster, before.digiline, option.preview.reward.xp);
    const resolution = resolveBattle({
      roster: before.roster, totalBits: before.totalBits, encounterId: event.encounterId,
      digilineInstanceIds: event.digilineInstanceIds,
      capturedEnemySlot: event.capturedEnemySlot, capturedMaxLevel: event.capturedLevelCap?.resolved,
      captureIdFactory: () => {
        if (!event.capturedInstanceId) throw new Error('Missing historical capture ID.');
        return event.capturedInstanceId;
      },
      techniqueSelections: choices.map(c => ({ instanceId: c.instanceId,
        keptKeys: c.choice.candidates.filter(p => !event.techniqueChoices.find(a => a.instanceId === c.instanceId)?.discarded.includes(p.name)).map(p => p.key),
      })),
    });
    if (resolution.captureError || resolution.rewardUnknown) throw new Error(resolution.captureError ?? 'Unknown reward.');
    if (resolution.xpAwarded !== event.xpReward || resolution.bitsAwarded !== event.bitsReward ||
        !equalRunState(resolution.techniqueChoices, event.techniqueChoices)) throw new Error('Reward or technique decision audit differs from authoritative battle.');
    return resolution;
  }
  if (event.type === 'digivolve') return { totalBits: before.totalBits,
    roster: before.roster.map(p => p.instanceId === event.instanceId ? applyNormalDigivolution(p) : p) };
  if (event.type === 'trade') {
    const given = before.roster.find(p => p.instanceId === event.givenInstanceId);
    if (!given) throw new Error('Given individual is missing.');
    const received = { ...createTradeReceivedProposal(event.tradeId, given), instanceId: event.receivedInstanceId };
    return { totalBits: before.totalBits, roster: before.roster.map(p => p.instanceId === given.instanceId ? received : p) };
  }
  const a = before.roster.find(p => p.instanceId === event.parentAInstanceId);
  const b = before.roster.find(p => p.instanceId === event.parentBInstanceId);
  if (!a || !b) throw new Error('DNA parent is missing.');
  const proposal = proposeDnaChild(a, b, event.techniqueChoice.kept.map(normalizeTechniqueName));
  if (proposal.status !== 'ready') throw new Error('DNA proposal is unavailable.');
  return { totalBits: before.totalBits, roster: replaceDnaParents(before.roster, p => p.instanceId,
    [a.instanceId, b.instanceId], { ...proposal.child, instanceId: event.childInstanceId }) };
};

export const validateActionContinuity = (event: RunEvent, after: Pick<RunActionCheckpoint, 'roster' | 'totalBits'>) => {
  const prefix = `Action ${event.order + 1} ${event.type}: `;
  try {
    const expected = deriveActionPostState(event);
    const errors: { code: string; message: string }[] = [];
    if (!equalRunState(expected.roster, after.roster)) {
      const changed = expected.roster.find((p, i) => !equalRunState(p, after.roster[i]));
      errors.push({ code: 'transition-roster-mismatch', message: prefix + `post-action roster${changed ? ` member ${changed.instanceId}` : ''} does not match the next chronological state.` });
    }
    if (expected.totalBits !== after.totalBits) errors.push({ code: 'transition-bits-mismatch', message: prefix + 'post-action Bits do not match the next chronological state.' });
    return errors;
  } catch (cause) {
    return [{ code: 'transition-replay-invalid', message: prefix + (cause instanceof Error ? cause.message : 'Action cannot be replayed.') }];
  }
};
