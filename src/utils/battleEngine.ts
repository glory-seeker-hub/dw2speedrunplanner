/** Stable public UI facade. Canonical records are available through simulateBattleCore. */
export { runLegacyBattleSimulation as runBattleSimulation } from '@/utils/battle/battleCompatibility';
export { simulateBattleCore, BATTLE_ENGINE_VERSION, DEFAULT_MAX_ROUNDS } from '@/utils/battle/battleSimulation';
export { assessBattleSkill, assessBattleScenario } from '@/utils/battle/battleSupport';
export type { BattleEngineOptions, BattleRunResult, BattleCombatantState, PlannedAction, BattleActionRecord, BattleImpact, ActionPolicy } from '@/utils/battle/battleTypes';
