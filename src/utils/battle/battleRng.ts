export type BattleDrawCategory = 'motivation-blocked-choice' | 'status-recovery-motivation-down' | 'status-apply-motivation-down' | 'random-digimon-target' | 'necro-ko-target' | 'shadow-scythe-hp-tie' | 'fantasmic-element' | 'revive-target-choice' | 'assist-status-cure-target' | 'assist-target-choice' | `status-recovery-${'poison-body' | 'poison-power' | 'paralysis-power' | 'confusion-power' | 'elemental-power' | 'invincibility' | 'invisibility'}` | 'action-choice' | 'target-choice' | 'initiative' | 'hit-miss' | 'status-application' | 'status-recovery' | 'interrupt' | 'counter' | 'assist' | 'status-recovery-paralysis' | 'status-recovery-confusion' | 'confusion-action-choice' | 'confusion-target' | 'paralysis-failure' | 'accuracy' | 'status-apply-poison' | 'status-apply-paralysis' | 'status-apply-confusion' | 'tail-blade-evasion' | 'interrupt-target-choice' | 'interrupt-user-choice' | 'interrupt-delete-action' | 'interrupt-force-miss';
export interface BattleRng {
  position?: () => number;
  tasLuck?: import('./battleTasLuck').TasLuckControl;
  nextFloat(category?: BattleDrawCategory): number;
  nextIntExclusive(max: number, category?: BattleDrawCategory): number;
  nextIntInclusive(min: number, max: number, category?: BattleDrawCategory): number;
}
export class BattleRngError extends Error {}
export function createBattleRng(draw: () => number, observe?: (category: BattleDrawCategory | undefined, value: number) => void): BattleRng {
  const nextFloat = (category?: BattleDrawCategory) => {
    const value = draw();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new BattleRngError('RNG must return a finite float in [0, 1).');
    observe?.(category, value);
    return value;
  };
  const nextIntExclusive = (max: number, category?: BattleDrawCategory) => {
    if (!Number.isSafeInteger(max) || max <= 0) throw new BattleRngError('RNG exclusive maximum must be a positive safe integer.');
    return Math.floor(nextFloat(category) * max);
  };
  return { nextFloat, nextIntExclusive, nextIntInclusive(min, max, category) {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max || !Number.isSafeInteger(max - min + 1)) throw new BattleRngError('Invalid inclusive RNG bounds.');
    return min + nextIntExclusive(max - min + 1, category);
  } };
}
/** The only production Math.random boundary. */
export const createProductionBattleRng = (): BattleRng => createBattleRng(() => Math.random());
export function createSequenceBattleRng(sequence: readonly number[]) {
  const values = [...sequence]; let index = 0;
  const draws: { category: BattleDrawCategory | undefined; value: number }[] = [];
  const rng = createBattleRng(() => {
    if (index >= values.length) throw new BattleRngError(`Programmed RNG exhausted after ${index} draws.`);
    return values[index++];
  }, (category, value) => draws.push({ category, value }));
  return { ...rng, draws, get consumed() { return index; } };
}
/** mulberry32-v1: unsigned 32-bit seed; simulator reproducibility, not DW2 RNG. */
export const SEEDED_RNG_VERSION = 'mulberry32-v1';
export function createSeededBattleRng(seed: number): BattleRng {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new BattleRngError('Seed must be an unsigned 32-bit integer.');
  let state = seed >>> 0, consumed = 0;
  const rng = createBattleRng(() => {
    consumed++;
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  });
  return {...rng,position:()=>consumed};
}
