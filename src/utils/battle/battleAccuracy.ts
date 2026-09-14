import type { AccuracyMode } from './battleSimulationRules';
import type { ActionKind } from '@/types/battleSkill';
import type { BattleCombatantState } from './battleTypes';
import { BattleInputError } from './battleTypes';
import { effectiveParameter } from './battleState';
import type { BattleRng } from './battleRng';

export interface AccuracyResolution {
  outcome: 'hit' | 'miss' | 'unsupported';
  mode?: 'strategy'; standardRollSkipped?: true;
  cause: 'strategy-accuracy-bypass' | 'invisibility' | 'assist-target-lost' | 'normal-accuracy' | 'paralysis' | 'guaranteed' | 'no-effective-target' | 'tail-blade-evasion' | 'counter-not-activated' | 'interrupt-forced-miss';
  hitThreshold128?: number; roll128?: number; paralysisRoll?: number; tailBladeRoll?: number;
  referenceTargetId: string | null;
  referenceRule?: 'single-target' | 'average-effective-target-spd';
  targetEffectiveSpd?: number;
}
// Convert the decimal representation of runtime effective SPD to an exact
// rational before integer division. This also supports existing fractional stats.
function ratio(value: number): [bigint, bigint] {
  const [mantissa, exponent = '0'] = value.toString().toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const scale = fraction.length - Number(exponent);
  const numerator = BigInt(whole + fraction);
  return scale >= 0 ? [numerator, 10n ** BigInt(scale)] : [numerator * 10n ** BigInt(-scale), 1n];
}
export function hitThreshold128(attackerSpd: number, targetSpd: number): number {
  return thresholdForTargetSpds(attackerSpd, [targetSpd]);
}
function validateAccuracySpds(attackerSpd: number, targets: readonly number[]): void {
  if (!Number.isFinite(attackerSpd) || attackerSpd <= 0 || !targets.length || targets.some(spd => !Number.isFinite(spd) || spd < 0))
    throw new BattleInputError('Accuracy requires positive finite attacker effective SPD and nonnegative finite target effective SPD.');
}
function thresholdForTargetSpds(attackerSpd: number, targets: readonly number[]): number {
  validateAccuracySpds(attackerSpd, targets);
  const [an, ad] = ratio(attackerSpd);
  let sumNumerator = 0n, denominator = 1n;
  for (const spd of targets) {
    const [n, d] = ratio(spd);
    // Decimal denominators are powers of ten: use the larger common scale.
    if (d > denominator) { sumNumerator *= d / denominator; denominator = d; }
    sumNumerator += n * (denominator / d);
  }
  const penalty = (128n * sumNumerator * ad) / (20n * an * denominator * BigInt(targets.length));
  return penalty >= 128n ? 0 : Number(128n - penalty);
}
/** One resolution per action. User-confirmed Phase 2K-E clarification:
 * multi-target accuracy uses the average of valid targets' effective SPD. */
export function resolveActionAccuracy(actor: BattleCombatantState, kind: ActionKind, targets: readonly BattleCombatantState[], rng: BattleRng, tailBladeEligible = false, accuracyMode: AccuracyMode = 'game-accurate'): AccuracyResolution {
  if (kind === 'assist') return { outcome: 'hit', cause: 'guaranteed', referenceTargetId: null };
  const audit: { paralysisRoll?: number; tailBladeRoll?: number } = {};
  if (actor.statuses.paralysis) {
    audit.paralysisRoll = rng.nextIntExclusive(2, 'paralysis-failure');
    if (audit.paralysisRoll === 1) return { outcome: 'miss', cause: 'paralysis', referenceTargetId: null, ...audit };
  }
  if (!targets.length) return { outcome: 'unsupported', cause: 'no-effective-target', referenceTargetId: null, ...audit };
  const livingTargets = targets.filter(t => t.currentHp > 0);
  const visibleScope = livingTargets.length ? livingTargets : targets;
  if (visibleScope.length === 1 && visibleScope[0].side !== actor.side && visibleScope[0].statuses.invisibility) return { outcome: 'miss', cause: 'invisibility', referenceTargetId: visibleScope[0].id, ...audit };
  if (kind === 'attack' && tailBladeEligible && targets.length === 1) {
    audit.tailBladeRoll = rng.nextIntExclusive(3, 'tail-blade-evasion');
    if (audit.tailBladeRoll === 0) return { outcome: 'miss', cause: 'tail-blade-evasion', referenceTargetId: targets[0].id, ...audit };
  }
  // All earlier mechanical Miss gates remain authoritative in both modes.
  // Do not calculate a threshold or consume/discard an accuracy draw here.
  if (accuracyMode === 'strategy') {
    // Preserve invalid-input rejection even though the Hit Rate arithmetic is skipped.
    validateAccuracySpds(effectiveParameter(actor, 'spd'), targets.map(target => effectiveParameter(target, 'spd')));
    return { outcome: 'hit', cause: 'strategy-accuracy-bypass', mode: 'strategy', standardRollSkipped: true,
      referenceTargetId: targets.length === 1 ? targets[0].id : null, ...audit };
  }
  const targetSpds = targets.map(target => effectiveParameter(target, 'spd'));
  const threshold = thresholdForTargetSpds(effectiveParameter(actor, 'spd'), targetSpds);
  // Display only; threshold calculation averages exact rationals before flooring.
  const targetEffectiveSpd = targetSpds.reduce((sum, spd) => sum + spd / targets.length, 0);
  const roll = rng.nextIntExclusive(128, 'accuracy');
  return { outcome: roll < threshold ? 'hit' : 'miss', cause: 'normal-accuracy', hitThreshold128: threshold, roll128: roll,
    referenceTargetId: targets.length === 1 ? targets[0].id : null,
    referenceRule: targets.length === 1 ? 'single-target' : 'average-effective-target-spd', targetEffectiveSpd, ...audit };
}
