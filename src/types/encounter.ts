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
  /** Total XP rewarded for defeating the whole encounter. Undefined = not yet verified. */
  xp?: number;
  /** Total Bits rewarded for defeating the whole encounter. Undefined = not yet verified. */
  bits?: number;
}

/** Where an encounter appears in the world. Encounters are never duplicated here. */
export interface DomainEncounter {
  encounterId: number;
  floors?: number[];
  isBoss?: boolean;
}

export interface Domain {
  id: string;
  name: string;
  encounters: DomainEncounter[];
}


export interface FloorSpecialty {
  id: string;
  name: string;
}