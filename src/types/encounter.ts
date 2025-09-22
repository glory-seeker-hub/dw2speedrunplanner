export interface EncounterDigimon {
  slot: number;
  name: string;
  level: number;
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  techs: string[];
}

export interface Encounter {
  id: number;
  digimons: EncounterDigimon[];
}

export interface FloorSpecialty {
  id: string;
  name: string;
}