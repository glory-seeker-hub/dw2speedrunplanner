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
}

export interface SimulationResult {
  winRate: number;
  totalSimulations: number;
  minTurns: number;
  avgTurns: number;
  maxTurns: number;
  fastestBattleHistory: BattleTurn[];
}