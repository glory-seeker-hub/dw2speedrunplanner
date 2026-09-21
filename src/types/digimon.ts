import type { BattleActionRecord } from '@/utils/battle/battleTypes';
export interface DigimonStats {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface Tech {
  id: string;
  name: string;
  ap: number;
  type?: 'Physical' | 'Magic' | 'Support';
  element: 'Fire' | 'Water' | 'Earth' | 'Air' | 'Nature' | 'Dark' | 'Machine' | 'None' | 'Wave' | 'Darkness' | 'Neutral';
  target: 'Single' | 'All';
  isCounter: boolean;
  specialEffect?: {
    type: 'counterDamageMultiplier' | 'debuffStat' | 'counterTargetAll' | 'counterApMultiplier' | 'noTriggerCounter' | 'chainOnKill' | 'consecutiveApIncrease' | 'healOnDamage' | 'counterApMultiplierAndTargetAll';
    value?: number;
    stat?: 'spd' | 'def' | 'atk';
    maxStacks?: number;
  };
}

export interface Digimon {
  id: string;
  name: string;
  baseStats: DigimonStats;
  type: 'Vaccine' | 'Data' | 'Virus';
  specialty: 'Fire' | 'Water' | 'Earth' | 'Air' | 'Nature' | 'Dark' | 'Machine' | 'None' | 'Wave' | 'Darkness' | 'Neutral';
  sprite?: string;
}

export interface TeamDigimon {
  digimon: Digimon;
  customStats: DigimonStats;
  techs: Tech[];
}

export interface Team {
  id: string;
  name: string;
  digimons: TeamDigimon[];
  createdAt: Date;
}

export interface BattleSettings {
  userTeam: Team;
  enemyTeam: Team;
  floorSpecialty: 'None' | 'Fire' | 'Water' | 'Earth' | 'Air' | 'Nature' | 'Dark' | 'Machine';
  simulationCount: number;
}

export interface BattleResult {
  minTurns: number;
  minRounds: number;
  turnHistory: BattleTurn[];
  winRate: number;
}

export interface BattleTurn {
  turn: number;
  round: number;
  digimon: string;
  tech: string;
  target: string;
  damage: number;
  hpRemaining: number;
  result: string;
  targetsHit: number;
}

export interface BattleDigimon {
  id: string;
  name: string;
  type: 'Vaccine' | 'Data' | 'Virus';
  specialty: 'Fire' | 'Water' | 'Earth' | 'Air' | 'Nature' | 'Dark' | 'Machine' | 'None' | 'Wave' | 'Darkness' | 'Neutral';
  stats: DigimonStats;
  currentHp: number;
  techs: Tech[];
  isAlive: boolean;
  debuffs?: {
    spd?: number;
    def?: number;
    atk?: number;
  };
  lastTechUsed?: string;
  consecutiveTechCount?: number;
  damageTakenThisTurn?: number;
}

export interface SimulationResult {
  report?: import('@/utils/battle/battleSimulationReport').BattleSimulationReport;
  optimized?: import('@/utils/battle/battleOptimizedSearch').OptimizedSearchResult;
  playerStatProvenance?: import('@/utils/battle/battleStatOverrides').PlayerStatProvenance;
  rngPolicy?: import('@/utils/battle/battleRngPolicy').BattleRngPolicy;
  rngOverrideCounts?: import('@/utils/battle/battleRngAudit').RngOverrideCounts;
  accuracyMode?: import('@/utils/battle/battleSimulationRules').AccuracyMode;
  search?: import('@/utils/battle/battleSimulationSearch').SimulationSearchMetadata;
  winRate: number;
  totalSimulations: number;
  completedSuccesses: number;
  timedSuccesses: number;
  incompleteTimingSuccesses: number;
  outcomeCounts: Record<'player-win' | 'enemy-win' | 'limit-reached' | 'invalid' | 'unsupported', number>;
  minTurns: number | null;
  avgTurns: number | null;
  maxTurns: number | null;
  /** Aggregates cover only completed successes with complete measured timing. */
  minFrames: number | null;
  avgFrames: number | null;
  maxFrames: number | null;
  fastestBattleHistory: BattleActionRecord[];
  fastestBattleByFrames: BattleActionRecord[];
  timingDiagnostics: string[];
  resourceDiagnostics: string[];
  runsWithResourceAlerts: number;
}
