import {
  MAX_DIGILINE_SIZE,
  RosterDigimon,
  RunBattleEvent,
  RunPlan,
} from '@/types/runPlanner';
import { encounters } from '@/data/encounters';
import { isValidLevelCap } from '@/utils/levelCap';

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

  if (run.totalBits < 0) {
    violations.push({ code: 'negative-bits', message: 'totalBits cannot be negative.' });
  }

  // Battle order must be deterministic: strictly increasing, no duplicates.
  const orders = run.battles.map((b) => b.order);
  const sorted = [...orders].sort((a, b) => a - b);
  if (orders.some((o, i) => o !== sorted[i]) || new Set(orders).size !== orders.length) {
    violations.push({
      code: 'battle-order-not-deterministic',
      message: 'Battle events must have unique, ascending order values.',
    });
  }

  for (const event of run.battles) {
    violations.push(...validateBattleEvent(event, run.roster));
  }

  return violations;
};

export const isValidRunPlan = (run: RunPlan): boolean =>
  validateRunPlan(run).length === 0;

/** Reorders battles and reassigns `order` deterministically (0-based). */
export const normalizeBattleOrder = (battles: RunBattleEvent[]): RunBattleEvent[] =>
  [...battles]
    .sort((a, b) => a.order - b.order)
    .map((b, index) => ({ ...b, order: index }));
