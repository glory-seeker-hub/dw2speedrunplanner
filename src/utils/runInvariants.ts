import { MAX_TECHNIQUES } from '@/types/techniqueCapacity';
import { isValidRunEvent } from '@/utils/runEventValidation';
import { isRosterDigimon } from '@/utils/runActionCheckpoint';
import {
  MAX_DIGILINE_SIZE,
  RosterDigimon,
  RunBattleEvent,
  RunPlan,
} from '@/types/runPlanner';
import { encounters } from '@/data/encounters';
import { isValidLevelCap } from '@/utils/levelCap';
import { isValidTechniqueState } from '@/utils/techniqueInheritance';

/**
 * Data-layer invariants. The UI must never be the only guard — impossible states are
 * rejected here.
 */
export interface InvariantViolation {
  code: string;
  message: string;
}

export const validateDigiline = (
  digiline: string[],
  roster: RosterDigimon[]
): InvariantViolation[] => {
  const violations: InvariantViolation[] = [];
  if (digiline.length > MAX_DIGILINE_SIZE) {
    violations.push({
      code: 'digiline-too-large',
      message: `Digiline has ${digiline.length} members (max ${MAX_DIGILINE_SIZE}).`,
    });
  }
  if (new Set(digiline).size !== digiline.length) {
    violations.push({ code: 'digiline-duplicate', message: 'Digiline has duplicate IDs.' });
  }
  const ids = new Set(roster.map((r) => r.instanceId));
  for (const id of digiline) {
    if (!ids.has(id)) {
      violations.push({
        code: 'digiline-unknown-instance',
        message: `Digiline references unknown roster instance "${id}".`,
      });
    }
  }
  return violations;
};

export const validateRosterDigimonInvariants = (
  entry: RosterDigimon
): InvariantViolation[] => {
  const violations: InvariantViolation[] = [];
  if (entry.techs?.length > MAX_TECHNIQUES) violations.push({ code: 'roster-technique-capacity', message: `A Digimon may possess at most ${MAX_TECHNIQUES} techniques.` });
  if (!isValidTechniqueState(entry)) violations.push({ code: 'roster-invalid-techniques', message: 'Technique pool metadata and available techniques must agree.' });
  if (!Number.isInteger(entry.dp) || entry.dp < 0) violations.push({ code: 'roster-invalid-dp', message: 'DP must be a non-negative integer.' });
  if (!isValidLevelCap(entry.levelCap)) violations.push({ code: 'roster-invalid-cap', message: 'Invalid level cap state.' });
  else if (entry.level > (entry.levelCap.resolved ?? entry.levelCap.max)) violations.push({ code: 'roster-above-cap', message: 'Level exceeds the individual cap.' });
  if (!Number.isInteger(entry.level) || entry.level < 1) {
    violations.push({
      code: 'roster-invalid-level',
      message: `Roster "${entry.instanceId}" has invalid level ${entry.level} (min 1).`,
    });
  }
  if (!Number.isFinite(entry.totalXp) || entry.totalXp < 0) {
    violations.push({
      code: 'roster-negative-xp',
      message: `Roster "${entry.instanceId}" has negative totalXp.`,
    });
  }
  return violations;
};

export const validateBattleEvent = (
  event: RunBattleEvent,
  roster: RosterDigimon[]
): InvariantViolation[] => {
  const violations: InvariantViolation[] = [];
  violations.push(...validateDigiline(event.digilineInstanceIds, roster));

  if (event.xpReward < 0 || event.bitsReward < 0) {
    violations.push({
      code: 'battle-negative-reward',
      message: `Battle "${event.id}" has a negative XP/Bits reward.`,
    });
  }
  if (event.capturedEnemySlot !== undefined && event.capturedEnemySlot !== null) {
    const encounter = encounters.find((e) => e.id === event.encounterId);
    if (!encounter?.digimons.some((d) => d.slot === event.capturedEnemySlot)) {
      violations.push({
        code: 'battle-invalid-capture-slot',
        message: `Battle "${event.id}" captures slot ${event.capturedEnemySlot}, which does not exist in encounter ${event.encounterId}.`,
      });
    }
  }
  return violations;
};

export const validateRunPlan = (run: RunPlan): InvariantViolation[] => {
  const violations: InvariantViolation[] = [];

  const instanceIds = new Set<string>();
  for (const entry of run.roster) {
    if (!isRosterDigimon(entry)) violations.push({ code: 'invalid-roster-entry', message: 'Invalid roster instance fields.' });
    if (instanceIds.has(entry.instanceId)) {
      violations.push({
        code: 'roster-duplicate-instance',
        message: `Duplicate roster instance "${entry.instanceId}".`,
      });
    }
    instanceIds.add(entry.instanceId);
    violations.push(...validateRosterDigimonInvariants(entry));
  }

  violations.push(...validateDigiline(run.digiline, run.roster));

  if (run.starterInstanceId !== null && !instanceIds.has(run.starterInstanceId)) {
    violations.push({
      code: 'unknown-starter-instance',
      message: `starterInstanceId "${run.starterInstanceId}" is not in the roster.`,
    });
  }

  if (!Number.isFinite(run.totalBits) || run.totalBits < 0) {
    violations.push({ code: 'negative-bits', message: 'totalBits cannot be negative.' });
  }

  // One contiguous chronological sequence for every recorded action.
  const eventIds = new Set<string>();
  run.history.forEach((event, index) => {
    if (!isValidRunEvent(event)) {
      violations.push({ code: 'invalid-run-event', message: 'Invalid action fields or checkpoint.' });
      return;
    }
    if (event.order !== index || eventIds.has(event.id)) {
      violations.push({ code: 'history-order-not-deterministic', message: 'Run actions require unique IDs and contiguous order values starting at zero.' });
    }
    eventIds.add(event.id);
    if (event.preActionCheckpoint.roster.some(member => !instanceIds.has(member.instanceId)) ||
        (run.starterInstanceId !== null && !event.preActionCheckpoint.roster.some(member => member.instanceId === run.starterInstanceId))) {
      violations.push({ code: 'checkpoint-unknown-instance', message: 'Checkpoint roster must preserve the starter and reference existing instances.' });
    }
    if (event.type === 'battle') {
      violations.push(...validateBattleEvent(event, event.preActionCheckpoint.roster));
      if (event.capturedInstanceId !== null) {
        const captured = run.roster.find(member => member.instanceId === event.capturedInstanceId);
        const cap = event.capturedLevelCap!;
        if (!captured || captured.source.type !== 'capture' ||
            captured.source.encounterId !== event.encounterId || captured.source.enemySlot !== event.capturedEnemySlot ||
            captured.levelCap.min !== cap.min || captured.levelCap.max !== cap.max || captured.levelCap.resolved !== cap.resolved ||
            run.history.slice(0, index).some(previous => previous.type === 'battle' && previous.capturedInstanceId === event.capturedInstanceId)) {
          violations.push({ code: 'capture-audit-mismatch', message: 'Capture audit must match the newly acquired roster instance and its exact cap.' });
        }
      }
    }
    else if (!instanceIds.has(event.instanceId)) violations.push({ code: 'digivolve-unknown-instance', message: 'Digivolution references an unknown roster instance.' });
  });

  return violations;
};

export const isValidRunPlan = (run: RunPlan): boolean =>
  validateRunPlan(run).length === 0;
