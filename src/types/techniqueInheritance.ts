export type DigimonRank = 'Rookie' | 'Champion' | 'Ultimate' | 'Mega';

export type TechniqueUnlock =
  | { status: 'available' }
  | { status: 'discarded' }
  | { status: 'pending' | 'missed'; level: number };

export type TechniqueSource =
  | { type: 'starter' | 'own-species'; speciesId: string }
  | { type: 'capture'; encounterId: number; enemySlot: number }
  | { type: 'inherited'; parentInstanceId: string };

export interface TechniquePotential {
  key: string;
  name: string;
  rank: DigimonRank;
  unlock: TechniqueUnlock;
  sources: TechniqueSource[];
}

export interface TechniqueState {
  techs: string[];
  techniquePool: TechniquePotential[];
}
