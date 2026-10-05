import type { BattleInput, BattleRunResult } from './battleTypes';
import type { Encounter } from '@/types/encounter';

/** Engine positions are zero-based; encounter slots are authoritative source metadata. */
export interface BattleCaptureTarget { position: number; encounterSlot?: number; name: string }
export interface LastDefeatedEnemy extends BattleCaptureTarget {
  combatantId: string; actionId: string; sequence: number; simultaneousPositions: number[];
}
export interface CaptureObjectiveEvaluation {
  target: BattleCaptureTarget; lastDefeated: LastDefeatedEnemy | null; satisfied: boolean;
}
export interface CaptureSummary extends CaptureObjectiveEvaluation {
  successes: number; successRate: number; timedSuccesses: number;
  minFrames: number | null; averageFrames: number | null; maxFrames: number | null;
}
export const CAPTURE_RULE = 'Capture target must be the last Enemy defeated.';
export const CAPTURE_TIE_RULE = 'For multiple Enemy KOs in one action, the rightmost Enemy wins the capture tie-break (E3 > E2 > E1).';
export const NO_CAPTURE_ROUTE = 'No capture-qualified route was found within the configured search effort.';

export function captureTargetForSlot(enemies: readonly { encounterSlot: number; digimon: { name: string } }[], slot: number): BattleCaptureTarget {
  const positions = enemies.flatMap((enemy, position) => enemy.encounterSlot === slot ? [position] : []);
  if (!Number.isSafeInteger(slot) || positions.length !== 1) throw new Error('Invalid or ambiguous capture encounter slot: ' + slot);
  const position = positions[0];
  return { position, encounterSlot: slot, name: enemies[position].digimon.name };
}
export function validateCaptureTarget(input: BattleInput, target?: BattleCaptureTarget): void {
  if (!target) return;
  const enemies = Array.isArray(input.enemy) ? input.enemy : (input.enemy as Encounter).digimons;
  if (!Number.isSafeInteger(target.position) || target.position < 0 || target.position >= enemies.length) throw new Error('Invalid capture target position.');
  const member = enemies[target.position] as { encounterSlot?: number; slot?: number };
  if (target.encounterSlot !== undefined && (member.encounterSlot ?? member.slot) !== target.encounterSlot) throw new Error('Capture target does not match the authoritative encounter slot.');
}
/** Canonical records are chronological. Sequence comparisons make that ordering explicit,
 * without sorting histories or depending on impact-array order. KO flags are authoritative. */
export function resolveLastDefeatedEnemy(result: BattleRunResult): LastDefeatedEnemy | null {
  const enemies = new Map(result.state.combatants.filter(a => a.side === 'enemy').map(a => [a.id, a]));
  let last: LastDefeatedEnemy | null = null;
  for (const action of result.actions) {
    if (action.state !== 'resolved') continue;
    const defeated = new Map<number, NonNullable<ReturnType<typeof enemies.get>>>();
    for (const impact of action.impacts) {
      const enemy = enemies.get(impact.targetId);
      if (impact.ko && enemy) defeated.set(enemy.position, enemy);
    }
    if (!defeated.size || last && action.sequence < last.sequence) continue;
    const position = Math.max(...defeated.keys()), enemy = defeated.get(position)!;
    last = { position, name: enemy.name, combatantId: enemy.id, actionId: action.id,
      sequence: action.sequence, simultaneousPositions: [...defeated.keys()].sort((a, b) => a - b) };
  }
  return last;
}
export function evaluateCaptureObjective(result: BattleRunResult, target: BattleCaptureTarget): CaptureObjectiveEvaluation {
  const lastDefeated = resolveLastDefeatedEnemy(result);
  if (lastDefeated?.position === target.position && target.encounterSlot !== undefined) lastDefeated.encounterSlot = target.encounterSlot;
  return { target, lastDefeated, satisfied: result.outcome === 'player-win' && lastDefeated !== null && lastDefeated.position === target.position };
}
export function isCaptureQualifiedVictory(result: BattleRunResult, target?: BattleCaptureTarget): boolean {
  return result.outcome === 'player-win' && (!target || evaluateCaptureObjective(result, target).satisfied);
}
