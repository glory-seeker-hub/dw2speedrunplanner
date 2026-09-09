import { TechniqueSelection } from '@/types/techniqueCapacity';
import { createRunActionCheckpoint } from '@/utils/runActionCheckpoint';
import { RunBattleEvent, RunPlan } from '@/types/runPlanner';
import { BattleSelection, getEncountersForFloor } from '@/utils/runBattleSelection';
import { BattleResolution, resolveBattle } from '@/utils/runProgression';
import { getRequiredTotalXpForLevel } from '@/utils/experience';
import { newInstanceId } from '@/utils/capture';
import { validateRunPlan } from '@/utils/runInvariants';
import { getInitialLevelCap, getAcquisitionLevelCap } from '@/utils/levelCap';

export type RecordBattleRequest = BattleSelection & { capturedEnemySlot?: number | null; capturedMaxLevel?: number | null; techniqueSelections?: TechniqueSelection[]; reviewTechniques?: boolean; expectedRunState?: string };

/** Re-query location metadata at submission time; never trust a UI-provided boss flag. */
export const getRecordingEncounter = (selection: BattleSelection) =>
  selection.floor === null ? undefined : getEncountersForFloor(selection.domainId, selection.phase, selection.floor)
    .find((option) => option.encounterId === selection.encounterId);

export const getCaptureChoices = (selection: BattleSelection) => {
  const option = getRecordingEncounter(selection);
  return !option || option.isBoss ? [] : option.preview?.encounter.digimons.map((enemy) => ({
    slot: enemy.slot, name: enemy.name, level: enemy.level, levelCap: getInitialLevelCap(enemy.level),
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
  const unresolved = run.roster.find(member => run.digiline.includes(member.instanceId) &&
    member.levelCap.resolved === null && member.level >= member.levelCap.min);
  if (unresolved) throw new Error('Maximum EL is unresolved for ' + unresolved.name + '. This battle cannot be recorded safely.');
  const option = getRecordingEncounter(request);
  if (!option?.preview) throw new Error('Select a valid Domain, phase, floor and encounter.');
  if (!option.preview.reward) throw new Error('Reward metadata is missing. This battle cannot be recorded.');
  const slot = request.capturedEnemySlot ?? null;
  if (slot === null && request.capturedMaxLevel != null) throw new Error('Maximum EL requires a capture target.');
  if (slot !== null) {
    if (option.isBoss) throw new Error('Boss encounters cannot be captured.');
    const choice = getCaptureChoices(request).find(enemy => enemy.slot === slot);
    if (!choice) throw new Error('Select a valid enemy slot to capture.');
    if (choice.unavailableReason) throw new Error(choice.unavailableReason);
    getAcquisitionLevelCap(choice.level, request.capturedMaxLevel);
  }
  const preActionCheckpoint = createRunActionCheckpoint(run);
  const resolution = resolveBattle({
    encounterId: option.encounterId, digilineInstanceIds: [...run.digiline],
    techniqueSelections: request.techniqueSelections, reviewTechniques: request.reviewTechniques,
    roster: run.roster, totalBits: run.totalBits, capturedEnemySlot: slot, capturedMaxLevel: request.capturedMaxLevel,
  });
  if (resolution.rewardUnknown) throw new Error('Reward metadata is missing. This battle cannot be recorded.');
  if (resolution.captureError) throw new Error(resolution.captureError);
  const event: RunBattleEvent = {
    type: 'battle', techniqueChoices: resolution.techniqueChoices,
    id: newInstanceId(), order: run.history.length ? run.history[run.history.length - 1].order + 1 : 0,
    domainId: request.domainId, phase: request.phase, floor: request.floor!, encounterId: option.encounterId,
    digilineInstanceIds: [...resolution.participantIds], capturedEnemySlot: slot,
    capturedInstanceId: resolution.capturedInstanceId,
    capturedLevelCap: resolution.capturedInstanceId
      ? { ...resolution.roster.find(member => member.instanceId === resolution.capturedInstanceId)!.levelCap } : null,
    xpReward: resolution.xpAwarded, bitsReward: resolution.bitsAwarded,
    preActionCheckpoint,
  };
  if (run.history.some(battle => battle.id === event.id)) throw new Error('Could not generate a unique battle ID. Try again.');
  const next: RunPlan = { ...run, roster: resolution.roster, totalBits: resolution.totalBits,
    history: [...run.history, event], updatedAt: new Date().toISOString() };
  const nextViolations = validateRunPlan(next);
  if (nextViolations.length) throw new Error(nextViolations.map(v => v.message).join(' '));
  return { run: next, resolution, event };
};
