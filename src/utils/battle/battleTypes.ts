import type { DigimonStats, Tech, TeamDigimon } from '@/types/digimon';
import type { ActionKind, Ailment, SkillElement } from '@/types/battleSkill';
import type { Encounter } from '@/types/encounter';
import type { BattleRng } from './battleRng';
import type { ExecutionOutcome, TimingClass, InterruptTiming } from './battleTiming';
import type { AccuracyResolution } from './battleAccuracy';
import type { BattleStatus, StatusSnapshot, StatusRecoveryResult, StatusApplicationResult } from './battleStatuses';
import type { ConfusionResolution } from './battleConfusion';

export type BattleSide = 'player' | 'enemy';
export type BattleActionKind = ActionKind;
export type ActionState = 'planned' | 'waiting' | 'resolving' | 'resolved' | 'cancelled' | 'skipped';
export interface BattleSkillSelection {
  key: string;
  canonicalSkillId: number | null;
  kind: ActionKind;
  source: 'legacy-known-technique' | 'legacy-custom-technique' | 'synthetic-legacy-fallback';
  /** Compatibility input for the retained base damage and ordinary legacy effects. */
  legacyTech: Tech;
}
export type CounterExecutionMode = 'activated' | 'shared-trigger-promoted' | 'untriggered-end-of-turn';
export interface CounterRuntimeState {
  selected: true;
  executionMode: 'waiting' | CounterExecutionMode | 'resolved';
  activatedMechanics: boolean;
  triggerActionId?: string; triggerActorId?: string; triggerActorName?: string;
  triggerImpactTargetId?: string; damageReceivedFromTrigger?: number;
  targetRule?: 'causal-attacker' | 'base-single' | 'base-aoe' | 'activated-aoe' | 'confusion-replacement';
  replacedByConfusion?: boolean;
}
export interface InterruptRuntimeState {
  selected: true; state: 'waiting' | 'executing' | 'resolved' | 'skipped-no-opportunity';
  selectedSkillId: number | null; targetActionId?: string; interruptedActorId?: string;
}
export interface InterruptResolution {
  targetActionId: string; targetActorId: string; targetActorName: string; executorId: string;
  targetPolicy: 'player-random' | 'enemy-first-attacker';
  initialTargetOutcome: 'hit'; interruptOutcome?: 'hit' | 'miss';
  restarted: boolean; cancelled: boolean; sentLast: boolean; cancellationReason?: 'action-deleted' | 'actor-ko';
  deleteActionRoll?: number; deletionImmunity?: 'boss'; forcedMissRoll?: number;
  forceMiss?: boolean; damageRetained?: { numerator: number; denominator: number };
  confusionSuppressedForActionId?: string;
}
export interface PreparedActionContext {
  targetIds: string[]; statusesBefore: StatusSnapshot; statusesAfterRecovery: StatusSnapshot;
  statusRecoveries: StatusRecoveryResult[]; confusion: ConfusionResolution;
  initialAccuracy: AccuracyResolution; interruptConsumed: boolean;
  interruptedByActionId?: string; resolution?: InterruptResolution;
}
export interface BattleCombatantState {
  isBoss: boolean;
  confusionSuppressedForActionId?: string;
  id: string;
  sourceInstanceId: string | null;
  name: string;
  side: BattleSide;
  position: number;
  speciesId: string;
  type: TeamDigimon['digimon']['type'];
  specialty: TeamDigimon['digimon']['specialty'];
  baseStats: DigimonStats;
  maxHp: number;
  currentHp: number;
  maxMp: number;
  currentMp: number;
  atkStage: number; defStage: number; spdStage: number;
  parametersSuppressed: boolean; revivedRound?: number;
  elementalPower: SkillElement | null;
  /** Custom legacy inputs only; canonical effects use discrete stages. */
  parameterModifiers: Partial<Record<'atk' | 'def' | 'spd', number>>;
  /** Scheduling/target eligibility: players remain active at zero HP; enemies KO. */
  isAlive: boolean;
  skills: BattleSkillSelection[];
  plannedActionId: string | null;
  legacy: { lastTechUsed?: string; consecutiveTechCount: number; damageTakenThisTurn: number };
  statuses: Partial<Record<Ailment | 'poison-body' | 'zombie' | 'invisibility' | 'invincibility', true>>;
  temporaryPowers: Partial<Record<SkillElement | 'poison' | 'paralysis' | 'confusion', true>>;
}
export type TargetIntent =
  | { kind: 'opponents'; side: BattleSide; selection: 'random-at-execution' | 'all' }
  | { kind: 'combatants'; targetIds: readonly string[] };
export interface ReactionContext { reactionToActionId: string; triggeredByActorId: string; counterActorId: string }
interface PlannedActionBase {
  id: string; round: number; actorId: string; targetIntent: TargetIntent;
  state: ActionState; initiative: number | null; priority: 'normal' | 'counter-last' | 'counter-promoted' | 'interrupt-waiting';
  counter: CounterRuntimeState | null;
  interrupt?: InterruptRuntimeState;
  prepared?: PreparedActionContext;
  assistTargetIds?: string[]; assistEligibleAtPlanning?: boolean; assistCandidateIds?: string[];
  supportEvents?: import('./battleSupportEffects').SupportEvent[];
  reaction: ReactionContext | null;
  chainFromActionId: string | null;
}
export type PlannedAction = PlannedActionBase & { kind: ActionKind; skill: BattleSkillSelection };
export type ActionChoice = { kind: 'skill'; skillKey: string; targetIntent?: TargetIntent };
export interface ActionPolicy {
  chooseAction(actor: Readonly<BattleCombatantState>, context: { round: number; combatants: readonly BattleCombatantState[] }, rng: BattleRng): ActionChoice;
}
export interface BattleImpact {
  targetId: string; targetName: string; hpBefore: number; hpAfter: number;
  baseDamage: number; poisonBonusDamage: number; statusApplications: StatusApplicationResult[];
  damage: number; healing: number; outcome: 'hit' | 'ko' | 'miss' | 'blocked' | 'invincible';
  appliedEffects: { source: 'legacy'; kind: 'parameter-modifier' | 'drain'; combatantId: string; amount: number; stat?: 'atk' | 'def' | 'spd' }[];
  damageBeforeInterruptReduction?: number;
  effectiveElement?: SkillElement; invincibilityPreventedDamage?: number;
  ko: boolean;
}
export interface BattleResourceAlert {
  kind: 'player-hp-depleted' | 'player-mp-depleted'; combatantId: string; combatantName: string;
}
export interface BattleActionRecord {
  id: string; round: number; sequence: number; actorId: string; actorName: string;
  skillKey: string | null; skillName: string | null; canonicalSkillId: number | null;
  kind: BattleActionKind; source: BattleSkillSelection['source'];
  targetIntent: TargetIntent; effectiveTargetIds: string[]; impacts: BattleImpact[];
  reaction: ReactionContext | null; counter: CounterRuntimeState | null; state: ActionState; reason?: string;
  supportEvents?: import('./battleSupportEffects').SupportEvent[];
  interrupt?: InterruptResolution;
  restart?: { wasInterrupted: true; interruptedByActionId: string; initialAccuracyResolution: AccuracyResolution;
    recoverySuppressedOnRestart: true; targetLocked: true; skillLocked: true; statusesAtRestart: StatusSnapshot };
  accuracy: AccuracyResolution | null; statusesBefore: StatusSnapshot; statusesAfterRecovery: StatusSnapshot;
  statusRecoveries: StatusRecoveryResult[]; confusion: ConfusionResolution | null;
  outcome: ExecutionOutcome; timingClass: TimingClass; durationFrames: number | null;
  interruptTiming?: InterruptTiming;
  effectDiagnostics?: string[];
  timingDiagnostics: string[]; chainFromActionId: string | null;
  resourceAlerts: BattleResourceAlert[]; resourceDiagnostics: string[];
  mpAccounting: { before: number; costCharged: number | null; after: number; completeness: 'complete' | 'incomplete'; payerCombatantId: string | null; payerName: string | null; payerSide: BattleSide | null; paymentRule: 'own' | 'counter-triggering-actor' | 'shadow-scythe-free-repeat' | 'none-on-miss' | 'unknown' } | null;
}
export interface BattleState {
  combatants: BattleCombatantState[];
  plannedActions: PlannedAction[];
  queue: string[];
  round: number;
  nextActionNumber: number;
  simulationIndex: number;
}
export type BattleOutcome = 'player-win' | 'enemy-win' | 'limit-reached' | 'invalid' | 'unsupported';
export interface BattleRunResult {
  engineVersion: string; outcome: BattleOutcome; winner: BattleSide | null;
  rounds: number; actionCount: number; actions: BattleActionRecord[];
  state: BattleState; diagnostics: string[];
  totalFrames: number | null; knownFrames: number; timingCompleteness: 'complete' | 'incomplete'; timingDiagnostics: string[];
}
export type BattleTeamMember = TeamDigimon & { instanceId?: string; isBoss?: boolean; initialStatuses?: Partial<Record<BattleStatus | 'poison-body' | 'invincibility' | 'invisibility' | 'motivation-down', boolean>>; initialPowers?: Partial<Record<BattleStatus, boolean>>; initialElementalPower?: SkillElement; initialStages?: Partial<Record<'atk' | 'def' | 'spd', number>>; currentHp?: number; currentMp?: number };
export interface BattleInput { player: readonly BattleTeamMember[]; enemy: readonly BattleTeamMember[] | Encounter; floorSpecialty: string }
export interface BattleEngineOptions {
  simulationRules?: import('./battleSimulationRules').BattleSimulationRules;
  rng?: BattleRng;
  /** Operational safety only, not a DW2 rule. Default 1000. */
  maxRounds?: number;
  simulationIndex?: number;
  actionPolicy?: ActionPolicy;
}
export class BattleInputError extends Error {
  constructor(message: string, public outcome: 'invalid' | 'unsupported' = 'invalid') { super(message); }
}
