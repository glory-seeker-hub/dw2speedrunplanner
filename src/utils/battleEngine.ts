/** Stable public UI facade. Canonical records are available through simulateBattleCore. */
export { runLegacyBattleSimulation as runBattleSimulation } from '@/utils/battle/battleCompatibility';
export { simulateBattleCore, BATTLE_ENGINE_VERSION, DEFAULT_MAX_ROUNDS } from '@/utils/battle/battleSimulation';
export { assessBattleSkill, assessBattleScenario } from '@/utils/battle/battleSupport';
export { resolveActionTiming, summarizeBattleTiming, ACTION_TIMING_PROFILE, INTERRUPT_PRELUDE_FRAMES } from '@/utils/battle/battleTiming';
export { aggregateBattleRuns } from '@/utils/battle/battleCompatibility';
export type { BattleEngineOptions, BattleRunResult, BattleCombatantState, PlannedAction, BattleActionRecord, BattleImpact, ActionPolicy } from '@/utils/battle/battleTypes';

export { canInterruptCounter } from '@/utils/battle/battleReactions';
export type { CounterRuntimeState, CounterExecutionMode } from '@/utils/battle/battleTypes';

export { getStatusImmunity } from '@/utils/battle/battleImmunity';
export { potentiallyInterruptible } from '@/utils/battle/battleInterrupts';
export type { InterruptRuntimeState, InterruptResolution, PreparedActionContext } from '@/utils/battle/battleTypes';
