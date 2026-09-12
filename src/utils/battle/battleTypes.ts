import type { DigimonStats, Tech, TeamDigimon } from '@/types/digimon';
import type { ActionKind, Ailment, SkillElement } from '@/types/battleSkill';
import type { Encounter } from '@/types/encounter';
import type { BattleRng } from './battleRng';
import type { ExecutionOutcome, TimingClass } from './battleTiming';
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
  /** The sole executed effect path in this phase; canonical effects stay diagnostic. */
  legacyTech: Tech;
}
export interface BattleCombatantState {
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
  parameterModifiers: Partial<Record<'atk' | 'def' | 'spd', number>>;
  /** Scheduling/target eligibility: players remain active at zero HP; enemies KO. */
  isAlive: boolean;
  skills: BattleSkillSelection[];
  plannedActionId: string | null;
  reaction: { counterUsed: boolean; isCountering: boolean };
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
  state: ActionState; initiative: number | null; priority: 'normal' | 'legacy-counter-last' | 'legacy-reaction';
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
  reaction: ReactionContext | null; state: ActionState; reason?: string;
  accuracy: AccuracyResolution | null; statusesBefore: StatusSnapshot; statusesAfterRecovery: StatusSnapshot;
  statusRecoveries: StatusRecoveryResult[]; confusion: ConfusionResolution | null;
  outcome: ExecutionOutcome; timingClass: TimingClass; durationFrames: number | null;
  timingDiagnostics: string[]; chainFromActionId: string | null;
  resourceAlerts: BattleResourceAlert[]; resourceDiagnostics: string[];
  mpAccounting: { before: number; costCharged: number | null; after: number; completeness: 'complete' | 'incomplete' } | null;
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
export type BattleTeamMember = TeamDigimon & { instanceId?: string; initialStatuses?: Partial<Record<BattleStatus, boolean>> };
export interface BattleInput { player: readonly BattleTeamMember[]; enemy: readonly BattleTeamMember[] | Encounter; floorSpecialty: string }
export interface BattleEngineOptions {
  rng?: BattleRng;
  /** Operational safety only, not a DW2 rule. Default 1000. */
  maxRounds?: number;
  simulationIndex?: number;
  actionPolicy?: ActionPolicy;
}
export class BattleInputError extends Error {
  constructor(message: string, public outcome: 'invalid' | 'unsupported' = 'invalid') { super(message); }
}
