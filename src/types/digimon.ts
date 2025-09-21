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
  mpCost: number;
  power: number;
  type: 'Physical' | 'Magic' | 'Support';
  element: 'Fire' | 'Water' | 'Earth' | 'Air' | 'Nature' | 'Dark' | 'Machine' | 'Neutral';
  target: 'Single' | 'All' | 'Self' | 'Team';
  description: string;
}

export interface Digimon {
  id: string;
  name: string;
  baseStats: DigimonStats;
  type: string;
  level: number;
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
  result: string;
}