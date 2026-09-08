import { RunBattleCheckpoint, RunBattleEvent, RunPlan } from '@/types/runPlanner';
import { BattleSelection, getEncountersForFloor } from '@/utils/runBattleSelection';
import { BattleResolution, resolveBattle } from '@/utils/runProgression';
import { getRequiredTotalXpForLevel } from '@/utils/experience';
import { newInstanceId } from '@/utils/capture';
import { validateRunPlan } from '@/utils/runInvariants';
import { getInitialLevelCap } from '@/utils/levelCap';

export type RecordBattleRequest = BattleSelection & { capturedEnemySlot?: number | null };

/** Re-query location metadata at submission time; never trust a UI-provided boss flag. */
export const getRecordingEncounter = (selection: BattleSelection) =>
  selection.floor === null ? undefined : getEncountersForFloor(selection.domainId, selection.phase, selection.floor)
    .find((option) => option.encounterId === selection.encounterId);

export const getCaptureChoices = (selection: BattleSelection) => {
  const option = getRecordingEncounter(selection);
  return !option || option.isBoss ? [] : option.preview?.encounter.digimons.map((enemy) => ({
    slot: enemy.slot, name: enemy.name, level: enemy.level,
    unavailableReason: !getInitialLevelCap(enemy.level) ? 'No authoritative acquisition cap for this level'
      : getRequiredTotalXpForLevel(enemy.level) === null ? 'No verified XP threshold for this level' : null,
  })) ?? [];
};

export interface RecordedBattle {
  run: RunPlan;
  resolution: BattleResolution;
  event: RunBattleEvent;
}

/** Build one complete replacement without mutating the input or writing storage. */
export const recordRunBattle = (run: RunPlan, request: RecordBattleRequest): RecordedBattle => {
  const violations = validateRunPlan(run);
  if (violations.length) throw new Error(violations.map(v => v.message).join(' '));
  if (run.digiline.length === 0) throw new Error('Add at least one Digimon to the Digiline before recording a battle.');
  const option = getRecordingEncounter(request);
  if (!option?.preview) throw new Error('Select a valid Domain, phase, floor and encounter.');
  if (!option.preview.reward) throw new Error('Reward metadata is missing. This battle cannot be recorded.');
  const slot = request.capturedEnemySlot ?? null;
  if (slot !== null) {
    if (option.isBoss) throw new Error('Boss encounters cannot be captured.');
    const choice = getCaptureChoices(request).find(enemy => enemy.slot === slot);
    if (!choice) throw new Error('Select a valid enemy slot to capture.');
    if (choice.unavailableReason) throw new Error(choice.unavailableReason);
  }
  const checkpoint: RunBattleCheckpoint = structuredClone({
    roster: run.roster, digiline: run.digiline, totalBits: run.totalBits,
  });
  const resolution = resolveBattle({
    encounterId: option.encounterId, digilineInstanceIds: [...run.digiline],
    roster: run.roster, totalBits: run.totalBits, capturedEnemySlot: slot,
  });
  if (resolution.rewardUnknown) throw new Error('Reward metadata is missing. This battle cannot be recorded.');
  if (resolution.captureError) throw new Error(resolution.captureError);
  const event: RunBattleEvent = {
    id: newInstanceId(), order: run.battles.length ? run.battles[run.battles.length - 1].order + 1 : 0,
    domainId: request.domainId, phase: request.phase, floor: request.floor!, encounterId: option.encounterId,
    digilineInstanceIds: [...resolution.participantIds], capturedEnemySlot: slot,
    xpReward: resolution.xpAwarded, bitsReward: resolution.bitsAwarded,
    checkpoint,
  };
  if (run.battles.some(battle => battle.id === event.id)) throw new Error('Could not generate a unique battle ID. Try again.');
  const next: RunPlan = { ...run, roster: resolution.roster, totalBits: resolution.totalBits,
    battles: [...run.battles, event], updatedAt: new Date().toISOString() };
  const nextViolations = validateRunPlan(next);
  if (nextViolations.length) throw new Error(nextViolations.map(v => v.message).join(' '));
  return { run: next, resolution, event };
};
